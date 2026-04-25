use crate::glob;
use anyhow::{anyhow, Result};
use chrono::Utc;
use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Instant;
use tauri::{AppHandle, Emitter};
use tokio::fs;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio_util::sync::CancellationToken;

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
    #[serde(flatten)]
    pub _rest: serde_json::Value,
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
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CompletePayload {
    backup_id: String,
    task_id: String,
    success: bool,
    cancelled: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    total_bytes: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    total_files: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    duration_ms: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    skipped: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    cleaned: Option<u64>,
}

struct FileEntry {
    path: PathBuf,
    rel: String,
    size: u64,
}

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
            let cancelled = err
                .to_string()
                .contains("ABORTED");
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
            }
        }
    };

    let _ = app.emit("backup-complete", payload.clone());
    Ok(payload)
}

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
    let src_meta = fs::metadata(&source)
        .await
        .map_err(|_| anyhow!("Source folder not found"))?;
    if !src_meta.is_dir() {
        return Err(anyhow!("Source is not a directory"));
    }
    let dest_meta = fs::metadata(&destination)
        .await
        .map_err(|_| anyhow!("Destination not found"))?;
    if !dest_meta.is_dir() {
        return Err(anyhow!("Destination is not a directory"));
    }

    let safe_name: String = task
        .name
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '_' || c == '-' {
                c
            } else {
                '_'
            }
        })
        .take(60)
        .collect();
    let safe_name = if safe_name.is_empty() {
        "backup".to_string()
    } else {
        safe_name
    };
    let timestamp = Utc::now().format("%Y-%m-%dT%H-%M-%S").to_string();
    let backup_path = destination.join(format!("{}_{}", safe_name, timestamp));

    let _ = app.emit(
        "backup-started",
        StartedPayload {
            backup_id: backup_id.to_string(),
            task_id: task.id.clone(),
        },
    );

    let patterns = glob::parse_patterns(&settings.exclude_patterns);
    let (files, total_bytes, mut skipped_count) = walk(&source, &patterns).await?;

    fs::create_dir_all(&backup_path).await?;
    let started = Instant::now();
    let mut copied_bytes: u64 = 0;
    let mut copied_files: u64 = 0;
    let total_files = files.len() as u64;
    let mut last_emit = Instant::now();

    for file in &files {
        if token.is_cancelled() {
            let _ = fs::remove_dir_all(&backup_path).await;
            return Err(anyhow!("ABORTED"));
        }
        let dest_path = backup_path.join(&file.rel);
        if let Some(parent) = dest_path.parent() {
            fs::create_dir_all(parent).await?;
        }

        let copy_result = copy_file(&file.path, &dest_path, token, |n| {
            copied_bytes += n;
            if last_emit.elapsed().as_millis() >= 100 {
                last_emit = Instant::now();
                let elapsed = started.elapsed().as_secs_f64();
                let speed = if elapsed > 0.0 {
                    (copied_bytes as f64 / elapsed) as u64
                } else {
                    0
                };
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
                        task_id: task.id.clone(),
                        progress,
                        copied_bytes,
                        total_bytes,
                        copied_files,
                        total_files,
                        speed_bps: speed,
                        eta_seconds: eta,
                    },
                );
            }
        })
        .await;

        match copy_result {
            Ok(()) => copied_files += 1,
            Err(e) => {
                let _ = fs::remove_dir_all(&backup_path).await;
                return Err(e);
            }
        }
    }

    let mut cleaned = 0u64;
    if settings.auto_cleanup_days > 0 {
        cleaned = cleanup_old_backups(&destination, settings.auto_cleanup_days, &safe_name)
            .await
            .unwrap_or(0);
    }

    let _ = skipped_count;
    let duration_ms = started.elapsed().as_millis() as u64;

    let payload = CompletePayload {
        backup_id: backup_id.to_string(),
        task_id: task.id.clone(),
        success: true,
        cancelled: false,
        error: None,
        path: Some(backup_path.to_string_lossy().to_string()),
        total_bytes: Some(total_bytes),
        total_files: Some(total_files),
        duration_ms: Some(duration_ms),
        skipped: Some(skipped_count as u64),
        cleaned: Some(cleaned),
    };

    Ok(payload)
}

async fn walk(root: &Path, patterns: &[String]) -> Result<(Vec<FileEntry>, u64, usize)> {
    let mut files = Vec::new();
    let mut total: u64 = 0;
    let mut skipped = 0usize;
    let mut stack: Vec<PathBuf> = vec![root.to_path_buf()];

    while let Some(dir) = stack.pop() {
        let read = fs::read_dir(&dir).await;
        let mut entries = match read {
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
            if file_type.is_symlink() {
                continue;
            }
            let rel = path.strip_prefix(root).unwrap_or(&path);
            let rel_str = rel.to_string_lossy().replace('\\', "/");
            if glob::matches(&rel_str, patterns) {
                continue;
            }
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
                total += meta.len();
                files.push(FileEntry {
                    path,
                    rel: rel_str,
                    size: meta.len(),
                });
            }
        }
    }
    Ok((files, total, skipped))
}

async fn copy_file<F: FnMut(u64)>(
    src: &Path,
    dest: &Path,
    token: &CancellationToken,
    mut on_bytes: F,
) -> Result<()> {
    let mut reader = fs::File::open(src).await?;
    let mut writer = fs::File::create(dest).await?;
    let mut buf = vec![0u8; 256 * 1024];
    loop {
        tokio::select! {
            biased;
            _ = token.cancelled() => {
                drop(writer);
                let _ = fs::remove_file(dest).await;
                return Err(anyhow!("ABORTED"));
            }
            read = reader.read(&mut buf) => {
                let n = read?;
                if n == 0 { break; }
                writer.write_all(&buf[..n]).await?;
                on_bytes(n as u64);
            }
        }
    }
    writer.flush().await?;
    Ok(())
}

async fn cleanup_old_backups(destination: &Path, days: u32, safe_name: &str) -> Result<u64> {
    let cutoff = chrono::Utc::now()
        - chrono::Duration::days(days as i64);
    let pattern = regex::Regex::new(r"^[A-Za-z0-9_-]+_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$")?;
    let mut deleted = 0u64;
    let mut entries = fs::read_dir(destination).await?;
    while let Ok(Some(entry)) = entries.next_entry().await {
        let name = entry.file_name();
        let name_str = name.to_string_lossy();
        let Ok(meta) = entry.metadata().await else { continue };
        if !meta.is_dir() {
            continue;
        }
        if !pattern.is_match(&name_str) {
            continue;
        }
        if !name_str.starts_with(&format!("{}_", safe_name)) {
            continue;
        }
        let modified = match meta.modified() {
            Ok(m) => m,
            Err(_) => continue,
        };
        let modified: chrono::DateTime<chrono::Utc> = modified.into();
        if modified < cutoff {
            if fs::remove_dir_all(entry.path()).await.is_ok() {
                deleted += 1;
            }
        }
    }
    Ok(deleted)
}
