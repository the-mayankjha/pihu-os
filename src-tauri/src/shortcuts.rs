use std::collections::HashMap;
use std::str::FromStr;
use std::sync::Mutex;

use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};

#[derive(Default)]
pub struct DynamicShortcutState {
    by_action: Mutex<HashMap<String, (u32, String)>>,
    by_id: Mutex<HashMap<u32, String>>,
}

#[tauri::command]
pub fn set_global_shortcut(
    app: AppHandle,
    state: State<'_, DynamicShortcutState>,
    action: String,
    accelerator: String,
) -> Result<(), String> {
    let shortcut = Shortcut::from_str(&accelerator).map_err(|error| error.to_string())?;
    let shortcut_id = shortcut.id();

    {
        let by_action = state.by_action.lock().map_err(|error| error.to_string())?;
        if let Some((current_id, _current_accelerator)) = by_action.get(&action) {
            if *current_id == shortcut_id {
                return Ok(());
            }
        }

        let by_id = state.by_id.lock().map_err(|error| error.to_string())?;
        if let Some(existing_action) = by_id.get(&shortcut_id) {
            if existing_action != &action {
                return Err(format!("That shortcut is already assigned to {existing_action}."));
            }
        }
    }

    app.global_shortcut()
        .register(accelerator.as_str())
        .map_err(|error| format!("Could not register {accelerator}: {error}"))?;

    let previous = state
        .by_action
        .lock()
        .map_err(|error| error.to_string())?
        .insert(action.clone(), (shortcut_id, accelerator));

    if let Some((previous_id, previous_accelerator)) = previous {
        state
            .by_id
            .lock()
            .map_err(|error| error.to_string())?
            .remove(&previous_id);
        if previous_id != shortcut_id {
            let _ = app.global_shortcut().unregister(previous_accelerator.as_str());
        }
    }

    state
        .by_id
        .lock()
        .map_err(|error| error.to_string())?
        .insert(shortcut_id, action);
    Ok(())
}

#[tauri::command]
pub fn clear_global_shortcut(
    app: AppHandle,
    state: State<'_, DynamicShortcutState>,
    action: String,
) -> Result<(), String> {
    let previous = state
        .by_action
        .lock()
        .map_err(|error| error.to_string())?
        .remove(&action);

    if let Some((shortcut_id, accelerator)) = previous {
        state
            .by_id
            .lock()
            .map_err(|error| error.to_string())?
            .remove(&shortcut_id);
        app.global_shortcut()
            .unregister(accelerator.as_str())
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}

pub fn dispatch(app: &AppHandle, shortcut: &Shortcut) {
    let registry = app.state::<DynamicShortcutState>();
    let Ok(state) = registry.by_id.lock() else {
        return;
    };
    let Some(action) = state.get(&shortcut.id()) else {
        return;
    };

    if action == "globalCommandPalette" {
        let _ = app.emit_to("main", "pihu-command-palette-global-toggle", ());
    } else {
        let _ = app.emit_to("main", "pihu-global-shortcut", action.clone());
    }
}
