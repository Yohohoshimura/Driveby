use crate::backup::{Manifest, MANIFEST_NAME, ERRORS_LOG};
use anyhow::{anyhow, Context, Result};
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::time::Instant;
use tauri::{AppHandle, Emitter};
use tokio::fs;
use tokio::io::{AsyncReadExt, AsyncWriteExt};

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RestorePayload {
    pub backup_path: String,
    pub destination: String,
    pub success: bool,
    pub copied_files: u64,
    pub total_files: u64,
    pub total_bytes: u64,
    pub duration_ms: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct RestoreProgress {
    copied_files: u64,
    total_files: u64,
    copied_bytes: u64,
    total_bytes: u64,
    progress: u32,
}

pub async fn read_manifest(backup_path: &Path) -> Result<Manifest> {
    let path = backup_path.join(MANIFEST_NAME);
    let data = fs::read(&path).await.context("read manifest")?;
    let manifest: Manifest = serde_json::from_slice(&data).context("parse manifest")?;
    Ok(manifest)
}

pub async fn restore(
    app: &AppHandle,
    backup_path: PathBuf,
    destination: PathBuf,
) -> Result<RestorePayload> {
    if !backup_path.is_absolute() || !destination.is_absolute() {
        return Err(anyhow!("Paths must be absolute"));
    }
    let src_meta = fs::metadata(&backup_path).await.map_err(|_| anyhow!("Backup folder not found"))?;
    if !src_meta.is_dir() {
        return Err(anyhow!("Backup path is not a directory"));
    }
    let dest_meta = fs::metadata(&destination).await.map_err(|_| anyhow!("Destination not found"))?;
    if !dest_meta.is_dir() {
        return Err(anyhow!("Destination is not a directory"));
    }

    let files = walk(&backup_path).await?;
    let total_files = files.len() as u64;
    let total_bytes: u64 = files.iter().map(|(_, size)| *size).sum();

    let started = Instant::now();
    let mut copied_bytes: u64 = 0;
    let mut copied_files: u64 = 0;

    for (rel, size) in &files {
        let src = backup_path.join(rel);
        let dst = destination.join(rel);
        if let Some(parent) = dst.parent() {
            fs::create_dir_all(parent).await?;
        }
        if let Err(e) = copy(&src, &dst).await {
            return Ok(RestorePayload {
                backup_path: backup_path.to_string_lossy().to_string(),
                destination: destination.to_string_lossy().to_string(),
                success: false,
                copied_files,
                total_files,
                total_bytes,
                duration_ms: started.elapsed().as_millis() as u64,
                error: Some(format!("{}: {}", rel, e)),
            });
        }
        copied_files += 1;
        copied_bytes += *size;
        let progress = if total_bytes > 0 {
            ((copied_bytes as f64 / total_bytes as f64) * 100.0).min(100.0) as u32
        } else { 0 };
        let _ = app.emit(
            "restore-progress",
            RestoreProgress {
                copied_files,
                total_files,
                copied_bytes,
                total_bytes,
                progress,
            },
        );
    }

    Ok(RestorePayload {
        backup_path: backup_path.to_string_lossy().to_string(),
        destination: destination.to_string_lossy().to_string(),
        success: true,
        copied_files,
        total_files,
        total_bytes,
        duration_ms: started.elapsed().as_millis() as u64,
        error: None,
    })
}

async fn walk(root: &Path) -> Result<Vec<(String, u64)>> {
    let mut out = Vec::new();
    let mut stack: Vec<PathBuf> = vec![root.to_path_buf()];
    while let Some(dir) = stack.pop() {
        let mut entries = match fs::read_dir(&dir).await {
            Ok(e) => e,
            Err(_) => continue,
        };
        while let Ok(Some(entry)) = entries.next_entry().await {
            let path = entry.path();
            let Ok(ft) = entry.file_type().await else { continue };
            if ft.is_symlink() { continue; }
            if ft.is_dir() {
                stack.push(path);
            } else if ft.is_file() {
                let Ok(meta) = fs::metadata(&path).await else { continue };
                let Ok(rel) = path.strip_prefix(root) else { continue };
                let rel_str = rel.to_string_lossy().replace('\\', "/");
                if rel_str == MANIFEST_NAME || rel_str == ERRORS_LOG { continue; }
                out.push((rel_str, meta.len()));
            }
        }
    }
    Ok(out)
}

async fn copy(src: &Path, dst: &Path) -> Result<()> {
    let mut r = fs::File::open(src).await?;
    let mut w = fs::File::create(dst).await?;
    let mut buf = vec![0u8; 256 * 1024];
    loop {
        let n = r.read(&mut buf).await?;
        if n == 0 { break; }
        w.write_all(&buf[..n]).await?;
    }
    w.flush().await?;
    Ok(())
}
