use crate::glob;
use crate::persist;
use anyhow::{anyhow, Context, Result};
use chrono::Utc;
use dashmap::DashMap;
use filetime::FileTime;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{Instant, SystemTime};
use tauri::{AppHandle, Emitter, Manager};
use tokio::fs;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio_util::sync::CancellationToken;
use tracing::{info, warn};
use xxhash_rust::xxh3::Xxh3;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Task {
    pub id: String,
    pub name: String,
    pub source: String,
    pub destination: String,
    #[serde(default)]
    pub schedule: Option<String>,
    #[serde(default, rename = "lastBackup")]
    pub last_backup: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct Settings {
    #[serde(default, rename = "excludePatterns")]
    pub exclude_patterns: String,
    #[serde(default, rename = "showNotifications")]
    pub show_notifications: bool,
    #[serde(default, rename = "verify")]
    pub verify: Option<bool>,
    #[serde(default, rename = "continueOnError")]
    pub continue_on_error: Option<bool>,
    #[serde(default, rename = "preserveMtime")]
    pub preserve_mtime: Option<bool>,
}

impl Settings {
    fn verify(&self) -> bool { self.verify.unwrap_or(false) }
    fn continue_on_error(&self) -> bool { self.continue_on_error.unwrap_or(true) }
    fn preserve_mtime(&self) -> bool { self.preserve_mtime.unwrap_or(true) }
}

#[derive(Default)]
pub struct BackupState {
    active: Arc<DashMap<String, CancellationToken>>,
}

impl BackupState {
    pub fn cancel(&self, task_id: &str) {
        if let Some((_, token)) = self.active.remove(task_id) {
            token.cancel();
        }
    }
    pub fn is_active(&self, task_id: &str) -> bool {
        self.active.contains_key(task_id)
    }
    /// Atomic register-if-absent. Returns None when a backup is already
    /// running for this task — the caller must not start a second one.
    fn try_register(&self, task_id: &str) -> Option<CancellationToken> {
        let token = CancellationToken::new();
        // DashMap::entry gives us a single locked slot; insert only if vacant.
        match self.active.entry(task_id.to_string()) {
            dashmap::mapref::entry::Entry::Occupied(_) => None,
            dashmap::mapref::entry::Entry::Vacant(v) => {
                v.insert(token.clone());
                Some(token)
            }
        }
    }
    fn unregister(&self, task_id: &str) {
        self.active.remove(task_id);
    }
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct StartedPayload {
    backup_id: String,
    task_id: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ProgressPayload {
    backup_id: String,
    task_id: String,
    progress: u32,
    copied_bytes: u64,
    total_bytes: u64,
    copied_files: u64,
    total_files: u64,
    speed_bps: u64,
    eta_seconds: Option<u64>,
    phase: &'static str,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CompletePayload {
    pub backup_id: String,
    pub task_id: String,
    pub success: bool,
    pub cancelled: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_bytes: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_files: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration_ms: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub skipped: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cleaned: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub unchanged: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub failed: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub verified: Option<bool>,
}

struct FileEntry {
    path: PathBuf,
    rel: String,
    size: u64,
    mtime: SystemTime,
}

// ─────────────────────────────────────────────────────────────────────
// Cross-platform helpers
// ─────────────────────────────────────────────────────────────────────

#[cfg(windows)]
fn long_path(p: &Path) -> PathBuf {
    // `\\?\`-prefixed paths require backslashes only — Windows treats forward
    // slashes under that prefix as literal filename characters. Normalize
    // separators *first*, then apply the prefix.
    let normalized: String = p.as_os_str().to_string_lossy().replace('/', r"\");
    if normalized.starts_with(r"\\?\") || normalized.starts_with(r"\\.\") {
        return PathBuf::from(normalized);
    }
    if Path::new(&normalized).is_absolute() {
        if normalized.starts_with(r"\\") {
            return PathBuf::from(format!(r"\\?\UNC\{}", &normalized[2..]));
        }
        return PathBuf::from(format!(r"\\?\{}", normalized));
    }
    PathBuf::from(normalized)
}

#[cfg(not(windows))]
fn long_path(p: &Path) -> PathBuf { p.to_path_buf() }

// ─── Windows file attributes (preserves Hidden/System/ReadOnly so that
// custom-folder-icon machinery — `desktop.ini` + the parent's System
// attribute — keeps working in the destination tree) ─────────────────────

#[cfg(windows)]
fn read_attrs(p: &Path) -> Option<u32> {
    use std::os::windows::fs::MetadataExt;
    std::fs::metadata(long_path(p)).ok().map(|m| m.file_attributes())
}

#[cfg(windows)]
fn apply_attrs(p: &Path, attrs: u32) {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::SetFileAttributesW;
    // Preserve only the user-meaningful bits — never propagate transient
    // flags like ARCHIVE/REPARSE_POINT/etc. that the OS manages itself.
    const KEEP: u32 = 0x1 /*READONLY*/ | 0x2 /*HIDDEN*/ | 0x4 /*SYSTEM*/;
    let masked = attrs & KEEP;
    if masked == 0 { return; }
    let lp = long_path(p);
    let wide: Vec<u16> = lp.as_os_str().encode_wide().chain(std::iter::once(0)).collect();
    unsafe { SetFileAttributesW(wide.as_ptr(), masked); }
}

#[cfg(not(windows))]
fn read_attrs(_p: &Path) -> Option<u32> { None }
#[cfg(not(windows))]
fn apply_attrs(_p: &Path, _attrs: u32) {}

// ─── Path containment check for source/dest overlap (#3) ─────────────────

/// True if `child` equals or is nested under `parent` (case-insensitive on
/// Windows). Both inputs must be absolute. Falls back to lossy string compare
/// if the paths can't be canonicalised yet (e.g. the destination doesn't
/// exist) — we already validated existence in the caller.
fn path_contains(parent: &Path, child: &Path) -> bool {
    let p = std::fs::canonicalize(parent).unwrap_or_else(|_| parent.to_path_buf());
    let c = std::fs::canonicalize(child).unwrap_or_else(|_| child.to_path_buf());
    let p_norm = normalize_for_compare(&p);
    let c_norm = normalize_for_compare(&c);
    if c_norm == p_norm { return true; }
    let mut prefix = p_norm.clone();
    if !prefix.ends_with(std::path::MAIN_SEPARATOR) {
        prefix.push(std::path::MAIN_SEPARATOR);
    }
    c_norm.starts_with(&prefix)
}

#[cfg(windows)]
fn normalize_for_compare(p: &Path) -> String {
    p.to_string_lossy().to_lowercase().replace('/', r"\")
}
#[cfg(not(windows))]
fn normalize_for_compare(p: &Path) -> String {
    p.to_string_lossy().to_string()
}

// ─────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────

pub async fn run_backup(
    app: &AppHandle,
    state: &BackupState,
    task: Task,
    settings: Settings,
) -> Result<CompletePayload> {
    let backup_id = uuid::Uuid::new_v4().to_string();

    // Atomic guard: refuse a second concurrent run for the same task. Without
    // this, double-click or scheduler-while-manual would race two writers
    // against the same destination tree (#1).
    let token = match state.try_register(&task.id) {
        Some(t) => t,
        None => {
            return Err(anyhow!("A backup is already running for this task"));
        }
    };

    let result = execute(app, &backup_id, &task, &settings, &token).await;

    state.unregister(&task.id);

    let payload = match result {
        Ok(p) => p,
        Err(err) => {
            let cancelled = err.to_string().contains("ABORTED");
            CompletePayload {
                backup_id: backup_id.clone(),
                task_id: task.id.clone(),
                success: false,
                cancelled,
                error: if cancelled { None } else { Some(err.to_string()) },
                path: None,
                total_bytes: None,
                total_files: None,
                duration_ms: None,
                skipped: None,
                cleaned: None,
                unchanged: None,
                failed: None,
                verified: None,
            }
        }
    };

    // Persist lastBackup in Rust, emit task-updated (centralized ownership).
    // Only on success — partial failures shouldn't reset the schedule clock,
    // otherwise a permanently-broken task hides behind a fresh timestamp and
    // the user never notices it's stuck.
    if !payload.cancelled && payload.success {
        let upd = tokio::time::timeout(
            std::time::Duration::from_secs(15),
            update_last_backup(app, &task.id),
        ).await;
        match upd {
            Ok(Ok(())) => {}
            Ok(Err(e)) => warn!("could not persist lastBackup: {}", e),
            Err(_) => warn!("lastBackup persist timed out"),
        }
    }

    info!(task = %task.name, success = payload.success, "emitting backup-complete");
    let _ = app.emit("backup-complete", payload.clone());
    Ok(payload)
}

async fn update_last_backup(app: &AppHandle, task_id: &str) -> Result<()> {
    let dir = app.path().app_data_dir().ok();
    let Some(dir) = dir else { return Ok(()); };
    let path = dir.join("tasks.json");
    // Serialise with the JS-side writer via the shared persist mutex (#7).
    persist::with_tasks_lock(|| async {
        let mut value: serde_json::Value = persist::read_json_or(&path, serde_json::Value::Array(vec![])).await;
        let now = Utc::now().to_rfc3339();
        let mut updated_task: Option<serde_json::Value> = None;
        if let Some(arr) = value.as_array_mut() {
            for t in arr.iter_mut() {
                if t.get("id").and_then(|v| v.as_str()) == Some(task_id) {
                    t["lastBackup"] = serde_json::Value::String(now.clone());
                    updated_task = Some(t.clone());
                }
            }
        }
        persist::write_json_atomic(&path, &value).await?;
        if let Some(t) = updated_task {
            let _ = app.emit("task-updated", t);
        }
        Ok(())
    }).await
}

// ─────────────────────────────────────────────────────────────────────
// Main pipeline
// ─────────────────────────────────────────────────────────────────────

async fn execute(
    app: &AppHandle,
    backup_id: &str,
    task: &Task,
    settings: &Settings,
    token: &CancellationToken,
) -> Result<CompletePayload> {
    let source = PathBuf::from(&task.source);
    let destination = PathBuf::from(&task.destination);

    if !source.is_absolute() || !destination.is_absolute() {
        return Err(anyhow!("Paths must be absolute"));
    }
    let src_meta = fs::metadata(long_path(&source)).await.map_err(|_| anyhow!("Source folder not found"))?;
    if !src_meta.is_dir() {
        return Err(anyhow!("Source is not a directory"));
    }
    let dest_meta = fs::metadata(long_path(&destination)).await.map_err(|_| anyhow!("Destination not found"))?;
    if !dest_meta.is_dir() {
        return Err(anyhow!("Destination is not a directory"));
    }
    // Reject self-syncs and any nested overlap (#3): if dest sits inside src,
    // walk() would enumerate the destination's own contents, copy them onto
    // themselves, and the prune pass would loop on its own output. If src
    // sits inside dest, prune would wipe the source on the next run.
    if path_contains(&source, &destination) {
        return Err(anyhow!("Destination cannot be inside the source folder"));
    }
    if path_contains(&destination, &source) {
        return Err(anyhow!("Source cannot be inside the destination folder"));
    }

    let _ = app.emit(
        "backup-started",
        StartedPayload {
            backup_id: backup_id.to_string(),
            task_id: task.id.clone(),
        },
    );

    info!(task = %task.name, "walking source");
    let patterns = glob::parse_patterns(&settings.exclude_patterns);
    // Walk returns BOTH the files we'll actually copy AND the set of relative
    // paths matched by exclude patterns, so prune can leave the latter alone.
    let (files, dirs, total_bytes, skipped_count, excluded_rels) =
        walk(&source, &patterns).await?;
    let total_files = files.len() as u64;

    // Sync mode: mirror source into the destination directly. Files already
    // present with matching size + mtime (within 2s tolerance) are skipped.
    let target = destination.clone();
    let started = Instant::now();
    let mut copied_bytes: u64 = 0;
    let mut copied_files: u64 = 0;
    let mut unchanged_files: u64 = 0;
    let mut failed_files: u64 = 0;
    let mut last_emit = Instant::now();
    let mut errors: Vec<String> = Vec::new();

    for file in &files {
        if token.is_cancelled() {
            return Err(anyhow!("ABORTED"));
        }
        let dest_path = target.join(&file.rel);
        if let Some(parent) = dest_path.parent() {
            // Don't kill the whole job because one parent can't be made (#8).
            if let Err(e) = fs::create_dir_all(long_path(parent)).await {
                failed_files += 1;
                warn!(target = %file.rel, "create parent failed: {}", e);
                errors.push(format!("{}: create parent: {}", file.rel, e));
                if !settings.continue_on_error() {
                    return Err(anyhow!("create parent for {}: {}", file.rel, e));
                }
                continue;
            }
        }

        // Skip if destination already has an identical file (size + mtime
        // match within tolerance — see same_mtime).
        let mut skip = false;
        if let Ok(meta) = fs::metadata(long_path(&dest_path)).await {
            if meta.is_file() && meta.len() == file.size {
                if let Ok(m) = meta.modified() {
                    if same_mtime(m, file.mtime) {
                        skip = true;
                    }
                }
            }
        }

        if skip {
            unchanged_files += 1;
            copied_bytes += file.size;
            copied_files += 1;
            maybe_emit(
                app, backup_id, &task.id, &mut last_emit, &started,
                copied_bytes, total_bytes, copied_files, total_files, "syncing",
            );
            continue;
        }

        // Track bytes within this file so retries don't double-count toward
        // the global total — progress would overshoot and "stick" at 100%
        // while the loop kept copying. The callback receives this file's
        // cumulative bytes so far (resets to 0 on a retry).
        let base_bytes = copied_bytes;
        let result = copy_with_retries(&file.path, &dest_path, token, settings, |file_so_far| {
            copied_bytes = base_bytes + file_so_far;
            maybe_emit(
                app, backup_id, &task.id, &mut last_emit, &started,
                copied_bytes, total_bytes, copied_files, total_files, "copying",
            );
        })
        .await;

        match result {
            Ok(()) => {
                copied_files += 1;
                copied_bytes = base_bytes + file.size;
            }
            Err(e) => {
                if token.is_cancelled() {
                    return Err(anyhow!("ABORTED"));
                }
                failed_files += 1;
                copied_bytes = base_bytes; // discard partial progress for failed file
                warn!(target = %file.rel, "copy failed: {}", e);
                errors.push(format!("{}: {}", file.rel, e));
                if !settings.continue_on_error() {
                    return Err(e);
                }
            }
        }
    }

    // Mirror-delete pass: remove anything in the destination that is no
    // longer in the source. Excluded paths are *preserved* — exclude means
    // "don't copy", not "delete from dest" (#2). We pass the full set of
    // names the user said to leave alone (matched basenames + relative paths).
    let _ = app.emit(
        "backup-progress",
        ProgressPayload {
            backup_id: backup_id.to_string(),
            task_id: task.id.clone(),
            progress: 100,
            copied_bytes,
            total_bytes,
            copied_files,
            total_files,
            speed_bps: 0,
            eta_seconds: None,
            phase: "pruning",
        },
    );
    let source_paths: HashSet<String> = files.iter().map(|f| f.rel.clone()).collect();
    let mut deleted_files: u64 = 0;
    if let Err(e) = prune_destination(
        &target,
        &source_paths,
        &excluded_rels,
        &patterns,
        token,
        &mut deleted_files,
    ).await {
        if token.is_cancelled() {
            return Err(anyhow!("ABORTED"));
        }
        warn!("prune destination failed: {}", e);
    }

    // Mirror directory attributes (System bit on a folder + matching
    // attributes on its `desktop.ini` are what make custom folder icons
    // render in Explorer).
    for (src_dir, rel) in &dirs {
        if let Some(attrs) = read_attrs(src_dir) {
            let dest_dir = target.join(rel);
            apply_attrs(&dest_dir, attrs);
        }
    }

    // Force a final 100% emit so the UI reflects completion even when the
    // throttle would have skipped the last chunk.
    let _ = app.emit(
        "backup-progress",
        ProgressPayload {
            backup_id: backup_id.to_string(),
            task_id: task.id.clone(),
            progress: 100,
            copied_bytes: total_bytes,
            total_bytes,
            copied_files: total_files,
            total_files,
            speed_bps: 0,
            eta_seconds: Some(0),
            phase: "finishing",
        },
    );

    let mut verified = false;
    if settings.verify() && failed_files == 0 {
        let _ = app.emit(
            "backup-progress",
            ProgressPayload {
                backup_id: backup_id.to_string(),
                task_id: task.id.clone(),
                progress: 100,
                copied_bytes,
                total_bytes,
                copied_files,
                total_files,
                speed_bps: 0,
                eta_seconds: None,
                phase: "verifying",
            },
        );
        verify_files(&files, &target, token).await?;
        verified = true;
    }

    if !errors.is_empty() {
        for e in &errors {
            warn!("file error: {}", e);
        }
    }

    let duration_ms = started.elapsed().as_millis() as u64;

    Ok(CompletePayload {
        backup_id: backup_id.to_string(),
        task_id: task.id.clone(),
        success: failed_files == 0,
        cancelled: false,
        error: if failed_files > 0 {
            Some(format!("{} file(s) failed", failed_files))
        } else {
            None
        },
        path: Some(target.to_string_lossy().to_string()),
        total_bytes: Some(total_bytes),
        total_files: Some(total_files),
        duration_ms: Some(duration_ms),
        skipped: Some(skipped_count as u64),
        cleaned: Some(deleted_files),
        unchanged: Some(unchanged_files),
        failed: Some(failed_files),
        verified: Some(verified),
    })
}

/// Walk `root` and remove any file whose relative path is not present in
/// `keep` AND not protected by `excluded` / `patterns`. Excluded paths are
/// preserved so that adding `node_modules` to the exclude list never wipes
/// pre-existing destination data (#2). Skipped on cancellation.
async fn prune_destination(
    root: &Path,
    keep: &HashSet<String>,
    excluded: &HashSet<String>,
    patterns: &[String],
    token: &CancellationToken,
    deleted: &mut u64,
) -> Result<()> {
    let mut dirs_to_check: Vec<PathBuf> = Vec::new();
    let mut stack: Vec<PathBuf> = vec![long_path(root)];
    let root_canonical = long_path(root);

    while let Some(dir) = stack.pop() {
        if token.is_cancelled() { return Err(anyhow!("ABORTED")); }
        let mut entries = match fs::read_dir(&dir).await {
            Ok(v) => v,
            Err(_) => continue,
        };
        loop {
            if token.is_cancelled() { return Err(anyhow!("ABORTED")); }
            let entry = match entries.next_entry().await {
                Ok(Some(e)) => e,
                Ok(None) => break,
                Err(_) => break,
            };
            let path = entry.path();
            let file_type = match entry.file_type().await {
                Ok(t) => t,
                Err(_) => continue,
            };
            if file_type.is_symlink() { continue; }
            let rel = path.strip_prefix(&root_canonical).unwrap_or(&path);
            let rel_str = rel.to_string_lossy().replace('\\', "/");

            // Never touch destination paths the user told us to leave alone.
            if excluded.contains(&rel_str) || glob::matches(&rel_str, patterns) {
                if file_type.is_dir() {
                    // Don't recurse into protected dirs either — pruning their
                    // contents would still effectively delete excluded data.
                }
                continue;
            }

            if file_type.is_dir() {
                stack.push(path.clone());
                dirs_to_check.push(path);
            } else if file_type.is_file() {
                if !keep.contains(&rel_str) {
                    if fs::remove_file(&path).await.is_ok() {
                        *deleted += 1;
                    }
                }
            }
        }
    }

    // Bottom-up: remove now-empty directories. Sort deepest-first by length.
    dirs_to_check.sort_by_key(|p| std::cmp::Reverse(p.as_os_str().len()));
    for d in dirs_to_check {
        let _ = fs::remove_dir(&d).await; // succeeds only if empty
    }
    Ok(())
}

/// Compare mtimes with a 2-second tolerance. FAT/exFAT (very common on
/// external backup drives) rounds mtime to even seconds, so the round-trip
/// `set_file_mtime(dest, src)` can land 1s off the source — without this
/// tolerance every sync re-copies every file (#4).
fn same_mtime(a: SystemTime, b: SystemTime) -> bool {
    let da = a.duration_since(std::time::UNIX_EPOCH).ok();
    let db = b.duration_since(std::time::UNIX_EPOCH).ok();
    match (da, db) {
        (Some(x), Some(y)) => {
            let xs = x.as_secs() as i64;
            let ys = y.as_secs() as i64;
            (xs - ys).abs() <= 2
        }
        _ => false,
    }
}

#[allow(clippy::too_many_arguments)]
fn maybe_emit(
    app: &AppHandle,
    backup_id: &str,
    task_id: &str,
    last_emit: &mut Instant,
    started: &Instant,
    copied_bytes: u64,
    total_bytes: u64,
    copied_files: u64,
    total_files: u64,
    phase: &'static str,
) {
    if last_emit.elapsed().as_millis() < 100 {
        return;
    }
    *last_emit = Instant::now();
    let elapsed = started.elapsed().as_secs_f64();
    let speed = if elapsed > 0.0 { (copied_bytes as f64 / elapsed) as u64 } else { 0 };
    let eta = if speed > 0 {
        Some((total_bytes.saturating_sub(copied_bytes)) / speed)
    } else {
        None
    };
    let progress = if total_bytes > 0 {
        ((copied_bytes as f64 / total_bytes as f64) * 100.0).min(100.0) as u32
    } else {
        0
    };
    let _ = app.emit(
        "backup-progress",
        ProgressPayload {
            backup_id: backup_id.to_string(),
            task_id: task_id.to_string(),
            progress,
            copied_bytes,
            total_bytes,
            copied_files,
            total_files,
            speed_bps: speed,
            eta_seconds: eta,
            phase,
        },
    );
}

async fn walk(
    root: &Path,
    patterns: &[String],
) -> Result<(Vec<FileEntry>, Vec<(PathBuf, String)>, u64, usize, HashSet<String>)> {
    let mut files = Vec::new();
    let mut dirs: Vec<(PathBuf, String)> = Vec::new();
    let mut excluded: HashSet<String> = HashSet::new();
    let mut total: u64 = 0;
    let mut skipped = 0usize;
    let mut stack: Vec<PathBuf> = vec![long_path(root)];
    let root_canonical = long_path(root);

    while let Some(dir) = stack.pop() {
        let mut entries = match fs::read_dir(&dir).await {
            Ok(v) => v,
            Err(_) => {
                skipped += 1;
                continue;
            }
        };
        loop {
            let entry = match entries.next_entry().await {
                Ok(Some(e)) => e,
                Ok(None) => break,
                Err(_) => {
                    skipped += 1;
                    break;
                }
            };
            let path = entry.path();
            let file_type = match entry.file_type().await {
                Ok(t) => t,
                Err(_) => {
                    skipped += 1;
                    continue;
                }
            };
            if file_type.is_symlink() { continue; }
            let rel = path.strip_prefix(&root_canonical).unwrap_or(&path);
            let rel_str = rel.to_string_lossy().replace('\\', "/");
            if glob::matches(&rel_str, patterns) {
                excluded.insert(rel_str);
                continue;
            }
            if file_type.is_dir() {
                dirs.push((path.clone(), rel_str));
                stack.push(path);
            } else if file_type.is_file() {
                let meta = match fs::metadata(&path).await {
                    Ok(m) => m,
                    Err(_) => {
                        skipped += 1;
                        continue;
                    }
                };
                let mtime = meta.modified().unwrap_or(SystemTime::UNIX_EPOCH);
                total += meta.len();
                files.push(FileEntry {
                    path,
                    rel: rel_str,
                    size: meta.len(),
                    mtime,
                });
            }
        }
    }
    Ok((files, dirs, total, skipped, excluded))
}

async fn copy_with_retries<F: FnMut(u64)>(
    src: &Path,
    dest: &Path,
    token: &CancellationToken,
    settings: &Settings,
    mut on_progress: F,
) -> Result<()> {
    let mut attempts = 0;
    let max = 3;
    loop {
        attempts += 1;
        on_progress(0); // reset per-file progress for any prior failed attempt
        let _ = fs::remove_file(long_path(dest)).await;
        let res = copy_file(src, dest, token, settings, &mut on_progress).await;
        match res {
            Ok(()) => return Ok(()),
            Err(e) => {
                if token.is_cancelled() { return Err(e); }
                if attempts >= max {
                    // Don't leave a half-written file in the destination after
                    // we give up — the next sync would either skip it on a
                    // size collision or re-copy redundantly (#12).
                    let _ = fs::remove_file(long_path(dest)).await;
                    return Err(e);
                }
                let backoff = 150u64 * (1u64 << (attempts - 1));
                tokio::time::sleep(std::time::Duration::from_millis(backoff)).await;
            }
        }
    }
}

async fn copy_file<F: FnMut(u64)>(
    src: &Path,
    dest: &Path,
    token: &CancellationToken,
    settings: &Settings,
    mut on_progress: F,
) -> Result<()> {
    let src_l = long_path(src);
    let dest_l = long_path(dest);
    let src_meta = fs::metadata(&src_l).await.context("stat source")?;
    let mut reader = fs::File::open(&src_l).await.context("open source")?;
    let mut writer = fs::File::create(&dest_l).await.context("create destination")?;

    let buf_size = if src_meta.len() > 4 * 1024 * 1024 { 1024 * 1024 } else { 256 * 1024 };
    let mut buf = vec![0u8; buf_size];
    let mut file_so_far: u64 = 0;

    loop {
        tokio::select! {
            biased;
            _ = token.cancelled() => {
                drop(writer);
                let _ = fs::remove_file(&dest_l).await;
                return Err(anyhow!("ABORTED"));
            }
            read = reader.read(&mut buf) => {
                let n = read.context("read source")?;
                if n == 0 { break; }
                writer.write_all(&buf[..n]).await.context("write destination")?;
                file_so_far += n as u64;
                on_progress(file_so_far);
            }
        }
    }
    writer.flush().await?;
    // Durability: actually commit to disk before returning success.
    writer.sync_all().await.context("sync destination")?;
    drop(writer);

    if settings.preserve_mtime() {
        if let Ok(ft) = src_meta.modified() {
            let ft = FileTime::from_system_time(ft);
            let _ = filetime::set_file_mtime(&dest_l, ft);
        }
    }
    // Preserve Hidden / System / ReadOnly so things like `desktop.ini`
    // (which drives custom Windows folder icons) keep their attributes.
    if let Some(attrs) = read_attrs(src) {
        apply_attrs(dest, attrs);
    }
    Ok(())
}

async fn verify_files(files: &[FileEntry], backup_path: &Path, token: &CancellationToken) -> Result<()> {
    for f in files {
        if token.is_cancelled() {
            return Err(anyhow!("ABORTED"));
        }
        let dest = backup_path.join(&f.rel);
        let a = hash_file(&f.path).await?;
        let b = hash_file(&dest).await?;
        if a != b {
            return Err(anyhow!("Hash mismatch for {}", f.rel));
        }
    }
    Ok(())
}

async fn hash_file(path: &Path) -> Result<u64> {
    let mut f = fs::File::open(long_path(path)).await?;
    let mut buf = vec![0u8; 256 * 1024];
    let mut hasher = Xxh3::new();
    loop {
        let n = f.read(&mut buf).await?;
        if n == 0 { break; }
        hasher.update(&buf[..n]);
    }
    Ok(hasher.digest())
}


#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(windows)]
    #[test]
    fn long_path_prefixes_absolute() {
        let p = Path::new(r"C:\Users\me\file.txt");
        assert_eq!(long_path(p).to_string_lossy(), r"\\?\C:\Users\me\file.txt");
    }

    #[cfg(windows)]
    #[test]
    fn long_path_leaves_prefixed_alone() {
        let p = Path::new(r"\\?\C:\foo");
        assert_eq!(long_path(p).to_string_lossy(), r"\\?\C:\foo");
    }

    #[cfg(windows)]
    #[test]
    fn long_path_handles_unc() {
        let p = Path::new(r"\\server\share\file");
        assert_eq!(long_path(p).to_string_lossy(), r"\\?\UNC\server\share\file");
    }

    #[cfg(windows)]
    #[test]
    fn long_path_normalizes_forward_slashes() {
        let p = Path::new("C:/Users/me/sub/file.txt");
        assert_eq!(long_path(p).to_string_lossy(), r"\\?\C:\Users\me\sub\file.txt");
    }

    #[test]
    fn mtime_tolerates_2_seconds() {
        let base = SystemTime::UNIX_EPOCH + std::time::Duration::from_secs(1_700_000_000);
        let plus_1 = base + std::time::Duration::from_secs(1);
        let plus_2 = base + std::time::Duration::from_secs(2);
        let plus_3 = base + std::time::Duration::from_secs(3);
        assert!(same_mtime(base, plus_1));
        assert!(same_mtime(base, plus_2));
        assert!(!same_mtime(base, plus_3));
    }
}
