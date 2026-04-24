use crate::backup::{self, BackupState, Settings, Task};
use crate::persist;
use chrono::{DateTime, Utc};
use std::path::PathBuf;
use std::time::Duration;
use tauri::async_runtime;
use tauri::{AppHandle, Manager};
use tokio::time;
use tracing::info;

fn interval_for(schedule: Option<&str>) -> Option<chrono::Duration> {
    match schedule {
        Some("daily") => Some(chrono::Duration::days(1)),
        Some("weekly") => Some(chrono::Duration::weeks(1)),
        Some("monthly") => Some(chrono::Duration::days(30)),
        _ => None,
    }
}

fn data_path(app: &AppHandle, name: &str) -> Option<PathBuf> {
    app.path().app_data_dir().ok().map(|d| d.join(name))
}

pub fn spawn(app: AppHandle) {
    async_runtime::spawn(async move {
        // Stagger first tick so startup doesn't immediately blast backups.
        time::sleep(Duration::from_secs(10)).await;
        loop {
            if let Err(e) = tick(&app).await {
                tracing::warn!("scheduler tick failed: {}", e);
            }
            time::sleep(Duration::from_secs(60)).await;
        }
    });
}

async fn tick(app: &AppHandle) -> anyhow::Result<()> {
    let Some(tasks_path) = data_path(app, "tasks.json") else { return Ok(()) };
    let Some(settings_path) = data_path(app, "settings.json") else { return Ok(()) };

    let tasks_json: serde_json::Value =
        persist::read_json_or(&tasks_path, serde_json::Value::Array(vec![])).await;
    let settings_json: serde_json::Value =
        persist::read_json_or(&settings_path, serde_json::json!({})).await;
    let settings: Settings = serde_json::from_value(settings_json.clone()).unwrap_or_default();
    let tasks: Vec<Task> = serde_json::from_value(tasks_json).unwrap_or_default();

    let state = match app.try_state::<BackupState>() {
        Some(s) => s,
        None => return Ok(()),
    };

    let now = Utc::now();
    for task in tasks {
        let Some(interval) = interval_for(task.schedule.as_deref()) else { continue };
        if state.is_active(&task.id) { continue; }
        let last = task.last_backup
            .as_ref()
            .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
            .map(|d| d.with_timezone(&Utc))
            .unwrap_or(DateTime::<Utc>::from_timestamp(0, 0).unwrap());
        if now - last < interval { continue; }

        info!("scheduler: triggering backup for {}", task.name);
        let app_cloned = app.clone();
        let settings_cloned = settings.clone();
        let task_id = task.id.clone();
        async_runtime::spawn(async move {
            let state = match app_cloned.try_state::<BackupState>() {
                Some(s) => s,
                None => return,
            };
            let _ = backup::run_backup(&app_cloned, &state, task, settings_cloned).await;
            // After run, bump lastBackup on the task record
            if let Some(tasks_path) = data_path(&app_cloned, "tasks.json") {
                let mut cur: serde_json::Value =
                    persist::read_json_or(&tasks_path, serde_json::Value::Array(vec![])).await;
                if let Some(arr) = cur.as_array_mut() {
                    for t in arr.iter_mut() {
                        if t.get("id").and_then(|v| v.as_str()) == Some(&task_id) {
                            t["lastBackup"] = serde_json::Value::String(Utc::now().to_rfc3339());
                        }
                    }
                }
                let _ = persist::write_json_atomic(&tasks_path, &cur).await;
            }
        });
    }
    Ok(())
}
