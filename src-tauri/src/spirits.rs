use std::collections::HashMap;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

// The panel class must remain non-activating: hovering/clicking a Spirit
// should not pull the user out of the fullscreen app underneath it.
#[cfg(target_os = "macos")]
tauri_nspanel::tauri_panel! {
    panel!(SpiritPanel {
        config: {
            can_become_key_window: false,
            can_become_main_window: false
        }
    })
    panel!(VoicePanel {
        config: { can_become_key_window: true, can_become_main_window: false }
    })
}

#[cfg(target_os = "macos")]
pub(crate) fn configure_overlay(window: &tauri::WebviewWindow) -> Result<(), String> {
    use objc2_app_kit::{
        NSStatusWindowLevel, NSWindowCollectionBehavior as Behavior, NSWindowStyleMask,
    };
    use tauri_nspanel::{ManagerExt, WebviewWindowExt};

    // Reuse the registered panel; converting the same native object twice
    // would discard the original Tauri class and its restoration metadata.
    let panel = match window.app_handle().get_webview_panel(window.label()) {
        Ok(panel) => panel,
        Err(_) if window.label() == "voice-overlay" => window
            .to_panel::<VoicePanel>()
            .map_err(|e| format!("Could not create Voice panel: {e}"))?,
        Err(_) => window
            .to_panel::<SpiritPanel>()
            .map_err(|e| format!("Could not create Spirit panel: {e}"))?,
    };
    panel
        .add_style_mask(NSWindowStyleMask::NonactivatingPanel)
        .map_err(|e| e.to_string())?;
    panel.set_floating_panel(true);
    panel.set_hides_on_deactivate(false);
    panel.set_becomes_key_only_if_needed(true);
    panel.set_works_when_modal(true);
    panel.set_accepts_mouse_moved_events(true);
    panel.set_level(NSStatusWindowLevel as i64);
    let mut behavior = Behavior::CanJoinAllSpaces
        | Behavior::FullScreenAuxiliary
        | Behavior::Stationary
        | Behavior::IgnoresCycle;
    if objc2::available!(macos = 13.0) {
        behavior.insert(Behavior::CanJoinAllApplications);
    }
    panel.set_collection_behavior(behavior);
    panel.order_front_regardless();
    Ok(())
}

// Restore Tauri's native window class before it performs destruction. The
// panel integration retains the original class and restoration metadata.
#[cfg(target_os = "macos")]
fn release_overlay(window: &tauri::WebviewWindow) {
    use tauri_nspanel::ManagerExt;
    if let Some(panel) = window.app_handle().remove_webview_panel(window.label()) {
        panel.hide();
        let _ = panel.to_window();
    }
}

#[cfg(not(target_os = "macos"))]
fn release_overlay(_window: &tauri::WebviewWindow) {}

pub fn release_all(app: &tauri::AppHandle) {
    for (label, window) in app.webview_windows() {
        if label.starts_with("spirit-") || label == "voice-overlay" {
            release_overlay(&window);
        }
    }
}

#[cfg(not(target_os = "macos"))]
fn configure_overlay(_window: &tauri::WebviewWindow) -> Result<(), String> {
    Ok(())
}

#[derive(serde::Deserialize)]
pub struct SpiritPosition {
    x: f64,
    y: f64,
}

/// Reconcile companion windows on the event-loop thread. Main remains the owner;
/// closing it exits Pihu and all its Spirits together.
#[tauri::command]
pub async fn sync_spirits(
    app: tauri::AppHandle,
    ids: Vec<String>,
    size: f64,
    positions: HashMap<String, SpiritPosition>,
) -> Result<(), String> {
    if ids.len() > 12
        || ids.iter().any(|id| {
            id.is_empty()
                || id.len() > 80
                || !id
                    .bytes()
                    .all(|c| c.is_ascii_alphanumeric() || c == b'-' || c == b'_')
        })
    {
        return Err("Invalid Spirit selection (maximum 12).".into());
    }
    let size = if size.is_finite() {
        size.clamp(72.0, 192.0)
    } else {
        128.0
    };
    let (sender, receiver) = std::sync::mpsc::channel();
    let handle = app.clone();
    app.run_on_main_thread(move || {
        let result = reconcile(&handle, &ids, size, &positions);
        let _ = sender.send(result);
    })
    .map_err(|e| e.to_string())?;
    receiver.recv().map_err(|e| e.to_string())?
}

fn reconcile(
    app: &tauri::AppHandle,
    ids: &[String],
    size: f64,
    positions: &HashMap<String, SpiritPosition>,
) -> Result<(), String> {
    let labels: Vec<String> = ids.iter().map(|id| format!("spirit-{id}")).collect();
    for (label, window) in app.webview_windows() {
        if label.starts_with("spirit-") && !labels.contains(&label) {
            release_overlay(&window);
            window.destroy().map_err(|e| e.to_string())?;
        }
    }
    for (index, (id, label)) in ids.iter().zip(labels.iter()).enumerate() {
        if let Some(window) = app.get_webview_window(label) {
            window
                .set_size(tauri::LogicalSize::new(size, size * 208.0 / 192.0 + 44.0))
                .map_err(|e| e.to_string())?;
            configure_overlay(&window)?;
            continue;
        }
        let mut builder = WebviewWindowBuilder::new(
            app,
            label,
            WebviewUrl::App(format!("index.html?spirit={id}").into()),
        )
        .title("Pihu Spirit")
        .inner_size(size, size * 208.0 / 192.0 + 44.0)
        .transparent(true)
        .decorations(false)
        .shadow(false)
        .resizable(false)
        .always_on_top(true)
        .visible_on_all_workspaces(true)
        .skip_taskbar(true)
        .focusable(false)
        .accept_first_mouse(true)
        .focused(false)
        .visible(false);
        if let Ok(Some(monitor)) = app.primary_monitor() {
            let factor = monitor.scale_factor();
            let position = monitor.position();
            let screen = monitor.size();
            let columns = ((screen.width as f64 / factor - 16.0) / (size + 16.0))
                .floor()
                .max(1.0) as usize;
            let x = position.x as f64 / factor + screen.width as f64 / factor
                - (size + 16.0) * (index % columns + 1) as f64;
            let y = (position.y as f64 / factor + screen.height as f64 / factor
                - size * 208.0 / 192.0
                - 100.0
                - (index / columns) as f64 * (size * 208.0 / 192.0 + 44.0))
                .max(position.y as f64 / factor + 32.0);
            builder = builder.position(x, y);
        }
        if let Some(saved) = positions.get(id) {
            // Restore only positions still visible on a connected display.
            if saved.x.is_finite()
                && saved.y.is_finite()
                && app
                    .available_monitors()
                    .unwrap_or_default()
                    .iter()
                    .any(|monitor| {
                        let factor = monitor.scale_factor();
                        let origin = monitor.position();
                        let screen = monitor.size();
                        saved.x >= origin.x as f64 / factor
                            && saved.y >= origin.y as f64 / factor
                            && saved.x + size <= (origin.x as f64 + screen.width as f64) / factor
                            && saved.y + size * 208.0 / 192.0 + 44.0
                                <= (origin.y as f64 + screen.height as f64) / factor
                    })
            {
                builder = builder.position(saved.x, saved.y);
            }
        }
        let window = builder.build().map_err(|e| e.to_string())?;
        configure_overlay(&window)?;
        #[cfg(not(target_os = "macos"))]
        window.show().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn sync_voice_overlay(app: tauri::AppHandle, visible: bool) -> Result<(), String> {
    let (sender, receiver) = std::sync::mpsc::channel();
    let handle = app.clone();
    app.run_on_main_thread(move || {
        let result = (|| -> Result<(), String> {
            if let Some(window) = handle.get_webview_window("voice-overlay") {
                if visible { configure_overlay(&window)?; window.show().map_err(|e| e.to_string())?; }
                else { window.hide().map_err(|e| e.to_string())?; }
                return Ok(());
            }
            if !visible { return Ok(()); }
            let window = WebviewWindowBuilder::new(&handle, "voice-overlay", WebviewUrl::App("index.html?voiceOverlay=1".into()))
                .title("PIHU Voice").inner_size(900.0, 140.0)
                .transparent(true).decorations(false).shadow(false).resizable(false)
                .always_on_top(true).visible_on_all_workspaces(true).skip_taskbar(true)
                .focused(false).visible(false).build().map_err(|e| e.to_string())?;
            // Position the new panel below the menu bar, centered horizontally.
            // Subsequent shows preserve the user's dragged position.
            if let Some(monitor) = handle.primary_monitor().map_err(|e| e.to_string())? {
                let scale = monitor.scale_factor();
                let origin = monitor.position();
                let width = monitor.size().width as f64 / scale;
                window.set_position(tauri::LogicalPosition::new(
                    origin.x as f64 / scale + ((width - 900.0) / 2.0).max(0.0),
                    origin.y as f64 / scale + 28.0,
                )).map_err(|e| e.to_string())?;
            }
            configure_overlay(&window)?;
            window.show().map_err(|e| e.to_string())?;
            Ok(())
        })();
        let _ = sender.send(result);
    }).map_err(|e| e.to_string())?;
    receiver.recv().map_err(|e| e.to_string())?
}
