use crate::backup::{self, BackupState, Settings, Task};
use crate::persist;
use chrono::{DateTime, Utc};
use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::Mutex;
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
        time::sleep(Duration::from_secs(10)).await;
        // Tasks observed for the first time on this app run start their
        // schedule clock from "now" instead of 1970, so a fresh install with
        // five daily tasks doesn't fire all five 10s after launch (#13).
        let seen: Mutex<HashSet<String>> = Mutex::new(HashSet::new());
        loop {
            if let Err(e) = tick(&app, &seen).await {
                tracing::warn!("scheduler tick failed: {}", e);
            }
            time::sleep(Duration::from_secs(60)).await;
        }
    });
}

async fn tick(app: &AppHandle, seen: &Mutex<HashSet<String>>) -> anyhow::Result<()> {
    let Some(tasks_path) = data_path(app, "tasks.json") else { return Ok(()) };
    let Some(settings_path) = data_path(app, "settings.json") else { return Ok(()) };

    let tasks_json: serde_json::Value =
        persist::read_json_or(&tasks_path, serde_json::Value::Array(vec![])).await;
    let settings_json: serde_json::Value =
        persist::read_json_or(&settings_path, serde_json::json!({})).await;
    let settings: Settings = serde_json::from_value(settings_json).unwrap_or_default();
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
            .map(|d| d.with_timezone(&Utc));

        // First time we observe this scheduled task in this process: register
        // it as "seen now" without firing. The user's launch shouldn't double
        // as a backup trigger; the next interval boundary is when it should
        // start running on its own.
        let first_observation = {
            let mut s = seen.lock().unwrap();
            s.insert(task.id.clone())
        };
        if first_observation && last.is_none() {
            continue;
        }

        let last = last.unwrap_or(now);
        if now - last < interval { continue; }

        info!("scheduler: triggering backup for {}", task.name);
        let app_cloned = app.clone();
        let settings_cloned = settings.clone();
        async_runtime::spawn(async move {
            let state = match app_cloned.try_state::<BackupState>() {
                Some(s) => s,
                None => return,
            };
            // run_backup now owns lastBackup persistence and emits task-updated.
            let _ = backup::run_backup(&app_cloned, &state, task, settings_cloned).await;
        });
    }
    Ok(())
}
