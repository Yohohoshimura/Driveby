use anyhow::Result;
use serde::{de::DeserializeOwned, Serialize};
use std::path::Path;
use tokio::fs;
use tokio::io::AsyncWriteExt;

pub async fn read_json_or<T: DeserializeOwned>(path: &Path, fallback: T) -> T {
    match fs::read_to_string(path).await {
        Ok(data) => serde_json::from_str(&data).unwrap_or(fallback),
        Err(_) => fallback,
    }
}

pub async fn write_json_atomic<T: Serialize>(path: &Path, value: &T) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).await?;
    }
    let json = serde_json::to_vec_pretty(value)?;
    let tmp = path.with_extension("json.tmp");
    let mut f = fs::File::create(&tmp).await?;
    f.write_all(&json).await?;
    f.sync_all().await?;
    drop(f);
    fs::rename(&tmp, path).await?;
    Ok(())
}
