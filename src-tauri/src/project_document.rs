use std::path::Path;
#[tauri::command]
pub async fn project_document_context(project_path: String) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let root = std::fs::canonicalize(project_path).map_err(|e| e.to_string())?;
        if !root.is_dir() { return Err("Select a project directory first".into()); }
        let mut files = Vec::new(); let mut budget = 100_000usize;
        fn collect(root: &Path, dir: &Path, depth: usize, budget: &mut usize, files: &mut Vec<serde_json::Value>) {
            if depth > 5 || *budget == 0 || files.len() >= 60 { return; }
            let Ok(entries) = std::fs::read_dir(dir) else { return; };
            let mut entries: Vec<_> = entries.flatten().collect();
            entries.sort_by_key(|e| { let n = e.file_name().to_string_lossy().to_lowercase(); (!n.starts_with("readme"), n) });
            for entry in entries {
                let path = entry.path(); let name = entry.file_name().to_string_lossy().to_string();
                let Ok(kind) = entry.file_type() else { continue; };
                if kind.is_symlink() || name.starts_with('.') || ["node_modules","target","dist","build","vendor","venv","runtime","coverage"].contains(&name.as_str()) { continue; }
                if kind.is_dir() { collect(root, &path, depth + 1, budget, files); continue; }
                let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
                if !["md","rs","ts","tsx","js","jsx","py","go","toml","json","yaml","yml"].contains(&ext) || name.contains("lock") || name.to_lowercase().contains("secret") || name.to_lowercase().contains("credential") { continue; }
                if entry.metadata().map(|m| m.len() > 100_000).unwrap_or(true) { continue; }
                let Ok(content) = std::fs::read_to_string(&path) else { continue; };
                // Skip likely credentials instead of sending them to the document model.
                if content.contains("PRIVATE KEY-----") || content.contains("\"refresh_token\"") || content.contains("\"client_secret\"") { continue; }
                let text: String = content.chars().take((*budget).min(6000)).collect();
                *budget = budget.saturating_sub(text.len());
                files.push(serde_json::json!({"path": path.strip_prefix(root).unwrap_or(&path).to_string_lossy(), "content": text}));
                if *budget == 0 || files.len() >= 60 { break; }
            }
        }
        collect(&root, &root, 0, &mut budget, &mut files);
        Ok(serde_json::json!({"files": files, "limited": files.len() >= 60 || budget == 0}))
    }).await.map_err(|e| e.to_string())?
}
