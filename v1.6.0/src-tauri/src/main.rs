#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod backup;
mod glob;
mod persist;

use backup::{BackupState, CompletePayload, Settings, Task};
use serde_json::Value;
use std::path::PathBuf;
use tauri::Manager;

fn data_path(app: &tauri::AppHandle, name: &str) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir: {}", e))?;
    Ok(dir.join(name))
}

fn default_settings() -> Value {
    serde_json::json!({
        "defaultDestination": "",
        "excludePatterns": "",
        "autoCleanupDays": 0,
        "confirmBeforeBackup": true,
        "showNotifications": true,
        "accentColor": "blue",
        "theme": "system"
    })
}

#[tauri::command]
async fn get_settings(app: tauri::AppHandle) -> Result<Value, String> {
    let path = data_path(&app, "settings.json")?;
    Ok(persist::read_json_or(&path, default_settings()).await)
}

#[tauri::command]
async fn save_settings(app: tauri::AppHandle, settings: Value) -> Result<(), String> {
    let path = data_path(&app, "settings.json")?;
    persist::write_json_atomic(&path, &settings)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_tasks(app: tauri::AppHandle) -> Result<Value, String> {
    let path = data_path(&app, "tasks.json")?;
    Ok(persist::read_json_or(&path, Value::Array(vec![])).await)
}

#[tauri::command]
async fn save_tasks(app: tauri::AppHandle, tasks: Value) -> Result<(), String> {
    let path = data_path(&app, "tasks.json")?;
    persist::write_json_atomic(&path, &tasks)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_history(app: tauri::AppHandle) -> Result<Value, String> {
    let path = data_path(&app, "history.json")?;
    Ok(persist::read_json_or(&path, Value::Array(vec![])).await)
}

#[tauri::command]
async fn save_history(app: tauri::AppHandle, history: Value) -> Result<(), String> {
    let path = data_path(&app, "history.json")?;
    persist::write_json_atomic(&path, &history)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn start_backup(
    app: tauri::AppHandle,
    state: tauri::State<'_, BackupState>,
    task: Task,
    settings: Settings,
) -> Result<CompletePayload, String> {
    backup::run_backup(&app, &state, task, settings)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn cancel_backup(
    state: tauri::State<'_, BackupState>,
    task_id: String,
) -> Result<(), String> {
    state.cancel(&task_id);
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .manage(BackupState::default())
        .setup(|app| {
            if let Ok(dir) = app.path().app_data_dir() {
                let _ = std::fs::create_dir_all(&dir);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_settings,
            save_settings,
            get_tasks,
            save_tasks,
            get_history,
            save_history,
            start_backup,
            cancel_backup,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
