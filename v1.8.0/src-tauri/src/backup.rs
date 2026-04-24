use crate::glob;
use crate::persist;
use anyhow::{anyhow, Context, Result};
use chrono::{DateTime, Utc};
use dashmap::DashMap;
use filetime::FileTime;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{Instant, SystemTime};
use tauri::{AppHandle, Emitter, Manager};
use tokio::fs;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio_util::sync::CancellationToken;
use tracing::{debug, info, warn};
use xxhash_rust::xxh3::Xxh3;

pub const MANIFEST_NAME: &str = "manifest.json";
pub const ERRORS_LOG: &str = "errors.log";

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
    #[serde(default, rename = "autoCleanupDays")]
    pub auto_cleanup_days: u32,
    #[serde(default, rename = "showNotifications")]
    pub show_notifications: bool,
    #[serde(default, rename = "incremental")]
    pub incremental: Option<bool>,
    #[serde(default, rename = "verify")]
    pub verify: Option<bool>,
    #[serde(default, rename = "continueOnError")]
    pub continue_on_error: Option<bool>,
    #[serde(default, rename = "preserveMtime")]
    pub preserve_mtime: Option<bool>,
    #[serde(flatten)]
    pub _rest: serde_json::Value,
}

impl Settings {
    fn incremental(&self) -> bool { self.incremental.unwrap_or(true) }
    fn verify(&self) -> bool { self.verify.unwrap_or(false) }
    fn continue_on_error(&self) -> bool { self.continue_on_error.unwrap_or(true) }
    fn preserve_mtime(&self) -> bool { self.preserve_mtime.unwrap_or(true) }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Manifest {
    pub version: String,
    pub task_id: String,
    pub task_name: String,
    pub source: String,
    pub destination: String,
    pub started_at: String,
    pub finished_at: String,
    pub duration_ms: u64,
    pub total_files: u64,
    pub total_bytes: u64,
    pub copied_files: u64,
    pub hardlinked_files: u64,
    pub failed_files: u64,
    pub skipped_files: u64,
    pub incremental_from: Option<String>,
    pub exclude_patterns: String,
    pub verified: bool,
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
    fn register(&self, task_id: &str) -> CancellationToken {
        let token = CancellationToken::new();
        self.active.insert(task_id.to_string(), token.clone());
        token
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
    pub hardlinked: Option<u64>,
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
    let s = p.as_os_str().to_string_lossy();
    if s.starts_with(r"\\?\") || s.starts_with(r"\\.\") {
        return p.to_path_buf();
    }
    if p.is_absolute() {
        // UNC paths look like \\server\share — prefix with \\?\UNC\
        if s.starts_with(r"\\") {
            return PathBuf::from(format!(r"\\?\UNC\{}", &s[2..]));
        }
        return PathBuf::from(format!(r"\\?\{}", s));
    }
    p.to_path_buf()
}

#[cfg(not(windows))]
fn long_path(p: &Path) -> PathBuf { p.to_path_buf() }

// Stable cross-volume detection: compare path roots.
// On Windows the first path component is a `Prefix` (`C:`, `\\server\share`),
// which is a good enough proxy for volume identity without depending on
// unstable `MetadataExt::volume_serial_number` or pulling in `windows-sys`.
// On Unix we have the real device id.

#[derive(PartialEq, Eq)]
pub struct VolumeId(String);

#[cfg(windows)]
fn volume_id(p: &Path) -> Option<VolumeId> {
    use std::path::Component;
    let abs = if p.is_absolute() {
        p.to_path_buf()
    } else {
        std::fs::canonicalize(p).ok()?
    };
    for comp in abs.components() {
        if let Component::Prefix(pref) = comp {
            let s = pref.as_os_str().to_string_lossy().to_uppercase();
            return Some(VolumeId(s));
        }
    }
    None
}

#[cfg(unix)]
fn volume_id(p: &Path) -> Option<VolumeId> {
    use std::os::unix::fs::MetadataExt;
    std::fs::metadata(p).ok().map(|m| VolumeId(m.dev().to_string()))
}

#[cfg(not(any(windows, unix)))]
fn volume_id(_: &Path) -> Option<VolumeId> { None }

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
    let token = state.register(&task.id);

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
                hardlinked: None,
                failed: None,
                verified: None,
            }
        }
    };

    // Persist lastBackup in Rust, emit task-updated (centralized ownership).
    if payload.success {
        if let Err(e) = update_last_backup(app, &task.id).await {
            warn!("could not persist lastBackup: {}", e);
        }
    }

    let _ = app.emit("backup-complete", payload.clone());
    Ok(payload)
}

async fn update_last_backup(app: &AppHandle, task_id: &str) -> Result<()> {
    let dir = app.path().app_data_dir().ok();
    let Some(dir) = dir else { return Ok(()); };
    let path = dir.join("tasks.json");
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

    let safe_name = sanitize_name(&task.name);
    let started_at = Utc::now();
    let timestamp = started_at.format("%Y-%m-%dT%H-%M-%S").to_string();
    let backup_path = destination.join(format!("{}_{}", safe_name, timestamp));

    let _ = app.emit(
        "backup-started",
        StartedPayload {
            backup_id: backup_id.to_string(),
            task_id: task.id.clone(),
        },
    );

    info!(task = %task.name, "walking source");
    let patterns = glob::parse_patterns(&settings.exclude_patterns);
    let (files, total_bytes, skipped_count) = walk(&source, &patterns).await?;
    let total_files = files.len() as u64;

    // Incremental base discovery — requires manifest.json, failed_files==0, and matching volume.
    let dest_volume = volume_id(&destination);
    let (base_dir, base_index) = if settings.incremental() {
        find_previous_backup(&destination, &safe_name, &backup_path, dest_volume).await
    } else {
        (None, HashMap::new())
    };

    fs::create_dir_all(long_path(&backup_path)).await?;
    let started = Instant::now();
    let mut copied_bytes: u64 = 0;
    let mut copied_files: u64 = 0;
    let mut hardlinked_files: u64 = 0;
    let mut failed_files: u64 = 0;
    let mut last_emit = Instant::now();
    let mut errors: Vec<String> = Vec::new();

    for file in &files {
        if token.is_cancelled() {
            let _ = fs::remove_dir_all(long_path(&backup_path)).await;
            return Err(anyhow!("ABORTED"));
        }
        let dest_path = backup_path.join(&file.rel);
        if let Some(parent) = dest_path.parent() {
            fs::create_dir_all(long_path(parent)).await?;
        }

        let mut linked = false;
        if let (Some(base), Some(prev)) = (base_dir.as_ref(), base_index.get(&file.rel)) {
            if prev.size == file.size && same_mtime(prev.mtime, file.mtime) {
                let prev_path = base.join(&file.rel);
                if fs::hard_link(long_path(&prev_path), long_path(&dest_path)).await.is_ok() {
                    hardlinked_files += 1;
                    copied_bytes += file.size;
                    copied_files += 1;
                    linked = true;
                    maybe_emit(
                        app, backup_id, &task.id, &mut last_emit, &started,
                        copied_bytes, total_bytes, copied_files, total_files, "linking",
                    );
                }
            }
        }

        if !linked {
            let result = copy_with_retries(&file.path, &dest_path, token, settings, |n| {
                copied_bytes += n;
                maybe_emit(
                    app, backup_id, &task.id, &mut last_emit, &started,
                    copied_bytes, total_bytes, copied_files, total_files, "copying",
                );
            })
            .await;

            match result {
                Ok(()) => copied_files += 1,
                Err(e) => {
                    if token.is_cancelled() {
                        let _ = fs::remove_dir_all(long_path(&backup_path)).await;
                        return Err(anyhow!("ABORTED"));
                    }
                    failed_files += 1;
                    errors.push(format!("{}: {}", file.rel, e));
                    if !settings.continue_on_error() {
                        let _ = fs::remove_dir_all(long_path(&backup_path)).await;
                        return Err(e);
                    }
                }
            }
        }
    }

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
        verify_files(&files, &backup_path, token).await?;
        verified = true;
    }

    if !errors.is_empty() {
        let log_path = backup_path.join(ERRORS_LOG);
        let _ = fs::write(long_path(&log_path), errors.join("\n")).await;
    }

    let finished_at = Utc::now();
    let duration_ms = started.elapsed().as_millis() as u64;
    let manifest = Manifest {
        version: env!("CARGO_PKG_VERSION").to_string(),
        task_id: task.id.clone(),
        task_name: task.name.clone(),
        source: task.source.clone(),
        destination: task.destination.clone(),
        started_at: started_at.to_rfc3339(),
        finished_at: finished_at.to_rfc3339(),
        duration_ms,
        total_files,
        total_bytes,
        copied_files: copied_files.saturating_sub(hardlinked_files),
        hardlinked_files,
        failed_files,
        skipped_files: skipped_count as u64,
        incremental_from: base_dir.as_ref().map(|p| p.to_string_lossy().into_owned()),
        exclude_patterns: settings.exclude_patterns.clone(),
        verified,
    };
    let manifest_path = backup_path.join(MANIFEST_NAME);
    let manifest_json = serde_json::to_vec_pretty(&manifest)?;
    fs::write(long_path(&manifest_path), &manifest_json).await?;

    // fsync the manifest and the backup directory itself so a power loss can't
    // leave us in a "looks complete" state without the manifest on disk.
    if let Ok(f) = fs::File::open(long_path(&manifest_path)).await {
        let _ = f.sync_all().await;
    }
    sync_dir(&backup_path).await;

    let mut cleaned = 0u64;
    if settings.auto_cleanup_days > 0 {
        cleaned = cleanup_old_backups(&destination, settings.auto_cleanup_days, &safe_name, &backup_path)
            .await
            .unwrap_or(0);
    }

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
        path: Some(backup_path.to_string_lossy().to_string()),
        total_bytes: Some(total_bytes),
        total_files: Some(total_files),
        duration_ms: Some(duration_ms),
        skipped: Some(skipped_count as u64),
        cleaned: Some(cleaned),
        hardlinked: Some(hardlinked_files),
        failed: Some(failed_files),
        verified: Some(verified),
    })
}

fn sanitize_name(name: &str) -> String {
    let s: String = name
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '_' || c == '-' { c } else { '_' })
        .take(60)
        .collect();
    if s.is_empty() { "backup".to_string() } else { s }
}

fn same_mtime(a: SystemTime, b: SystemTime) -> bool {
    let da = a.duration_since(std::time::UNIX_EPOCH).ok();
    let db = b.duration_since(std::time::UNIX_EPOCH).ok();
    match (da, db) {
        (Some(x), Some(y)) => x.as_secs() == y.as_secs(),
        _ => false,
    }
}

async fn sync_dir(path: &Path) {
    // Windows directories can't be fsync'd via the File API; this is a no-op there.
    #[cfg(unix)]
    {
        if let Ok(f) = fs::File::open(path).await {
            let _ = f.sync_all().await;
        }
    }
    #[cfg(windows)]
    {
        let _ = path;
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

async fn walk(root: &Path, patterns: &[String]) -> Result<(Vec<FileEntry>, u64, usize)> {
    let mut files = Vec::new();
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
            if glob::matches(&rel_str, patterns) { continue; }
            if file_type.is_dir() {
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
    Ok((files, total, skipped))
}

struct PrevEntry {
    size: u64,
    mtime: SystemTime,
}

async fn find_previous_backup(
    destination: &Path,
    safe_name: &str,
    current: &Path,
    dest_volume: Option<VolumeId>,
) -> (Option<PathBuf>, HashMap<String, PrevEntry>) {
    let pattern = match Regex::new(r"^[A-Za-z0-9_-]+_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$") {
        Ok(r) => r,
        Err(_) => return (None, HashMap::new()),
    };
    let mut entries = match fs::read_dir(long_path(destination)).await {
        Ok(e) => e,
        Err(_) => return (None, HashMap::new()),
    };
    let mut candidates: Vec<(PathBuf, DateTime<Utc>)> = Vec::new();
    while let Ok(Some(entry)) = entries.next_entry().await {
        let name = entry.file_name();
        let name_str = name.to_string_lossy().to_string();
        let caps = match pattern.captures(&name_str) {
            Some(c) => c,
            None => continue,
        };
        if !name_str.starts_with(&format!("{}_", safe_name)) { continue; }
        let path = entry.path();
        if path == current { continue; }
        let Ok(meta) = entry.metadata().await else { continue };
        if !meta.is_dir() { continue; }
        // Parse timestamp from folder name rather than trusting mtime.
        let ts_str = match caps.get(0).map(|m| m.as_str()) {
            Some(full) => match full.rfind('_') {
                Some(i) => &full[i + 1..],
                None => continue,
            },
            None => continue,
        };
        let naive = chrono::NaiveDateTime::parse_from_str(ts_str, "%Y-%m-%dT%H-%M-%S").ok();
        let Some(naive) = naive else { continue };
        let ts_utc: DateTime<Utc> = DateTime::from_naive_utc_and_offset(naive, Utc);
        candidates.push((path, ts_utc));
    }
    candidates.sort_by(|a, b| b.1.cmp(&a.1));

    // Require a valid manifest with failed_files == 0.
    let mut base: Option<PathBuf> = None;
    for (path, _) in &candidates {
        let manifest_path = path.join(MANIFEST_NAME);
        let Ok(bytes) = fs::read(long_path(&manifest_path)).await else { continue };
        let Ok(m): Result<Manifest, _> = serde_json::from_slice(&bytes) else { continue };
        if m.failed_files != 0 { continue; }
        base = Some(path.clone());
        break;
    }
    let Some(base) = base else { return (None, HashMap::new()); };

    // Require matching volume id. Hardlinks across volumes always fail.
    let base_vol = volume_id(&base);
    if let (Some(dv), Some(bv)) = (&dest_volume, &base_vol) {
        if dv != bv {
            debug!("incremental base skipped: cross-volume");
            return (None, HashMap::new());
        }
    }

    let mut index: HashMap<String, PrevEntry> = HashMap::new();
    let mut stack: Vec<PathBuf> = vec![base.clone()];
    while let Some(dir) = stack.pop() {
        let mut entries = match fs::read_dir(long_path(&dir)).await {
            Ok(e) => e,
            Err(_) => continue,
        };
        while let Ok(Some(entry)) = entries.next_entry().await {
            let path = entry.path();
            let Ok(file_type) = entry.file_type().await else { continue };
            if file_type.is_symlink() { continue; }
            if file_type.is_dir() {
                stack.push(path);
            } else if file_type.is_file() {
                let Ok(meta) = fs::metadata(&path).await else { continue };
                let rel = match path.strip_prefix(&base) {
                    Ok(r) => r.to_string_lossy().replace('\\', "/"),
                    Err(_) => continue,
                };
                if rel == MANIFEST_NAME || rel == ERRORS_LOG { continue; }
                index.insert(
                    rel,
                    PrevEntry {
                        size: meta.len(),
                        mtime: meta.modified().unwrap_or(SystemTime::UNIX_EPOCH),
                    },
                );
            }
        }
    }

    (Some(base), index)
}

async fn copy_with_retries<F: FnMut(u64)>(
    src: &Path,
    dest: &Path,
    token: &CancellationToken,
    settings: &Settings,
    mut on_bytes: F,
) -> Result<()> {
    let mut attempts = 0;
    let max = 3;
    loop {
        attempts += 1;
        let _ = fs::remove_file(long_path(dest)).await;
        let res = copy_file(src, dest, token, settings, &mut on_bytes).await;
        match res {
            Ok(()) => return Ok(()),
            Err(e) => {
                if token.is_cancelled() { return Err(e); }
                if attempts >= max { return Err(e); }
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
    mut on_bytes: F,
) -> Result<()> {
    let src_l = long_path(src);
    let dest_l = long_path(dest);
    let src_meta = fs::metadata(&src_l).await.context("stat source")?;
    let mut reader = fs::File::open(&src_l).await.context("open source")?;
    let mut writer = fs::File::create(&dest_l).await.context("create destination")?;

    let buf_size = if src_meta.len() > 4 * 1024 * 1024 { 1024 * 1024 } else { 256 * 1024 };
    let mut buf = vec![0u8; buf_size];

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
                on_bytes(n as u64);
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

async fn cleanup_old_backups(
    destination: &Path,
    days: u32,
    safe_name: &str,
    skip: &Path,
) -> Result<u64> {
    let cutoff = Utc::now() - chrono::Duration::days(days as i64);
    let pattern = Regex::new(r"^[A-Za-z0-9_-]+_(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})$")?;
    let mut deleted = 0u64;
    let mut entries = fs::read_dir(long_path(destination)).await?;
    while let Ok(Some(entry)) = entries.next_entry().await {
        let name = entry.file_name();
        let name_str = name.to_string_lossy().to_string();
        let Ok(meta) = entry.metadata().await else { continue };
        if !meta.is_dir() { continue; }
        let caps = match pattern.captures(&name_str) {
            Some(c) => c,
            None => continue,
        };
        if !name_str.starts_with(&format!("{}_", safe_name)) { continue; }
        let path = entry.path();
        if path == skip { continue; }
        let ts = caps.get(1).unwrap().as_str();
        let parsed = chrono::NaiveDateTime::parse_from_str(ts, "%Y-%m-%dT%H-%M-%S").ok();
        let Some(parsed) = parsed else { continue };
        let parsed_utc: DateTime<Utc> = DateTime::from_naive_utc_and_offset(parsed, Utc);
        if parsed_utc < cutoff {
            if fs::remove_dir_all(long_path(&path)).await.is_ok() {
                deleted += 1;
            }
        }
    }
    Ok(deleted)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitize_works() {
        assert_eq!(sanitize_name(""), "backup");
        assert_eq!(sanitize_name("My Docs/April"), "My_Docs_April");
        let long = "a".repeat(200);
        assert_eq!(sanitize_name(&long).len(), 60);
    }

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
}
