use std::path::Path;

/// Account polling is a file read, not a shell/Python operation.
pub fn read(path: &Path) -> Result<String, String> {
    match std::fs::read_to_string(path) {
        Ok(contents) => Ok(contents),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok("{}".into()),
        Err(error) => Err(format!("Could not read Google account metadata: {error}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn first_run_without_account_file_is_empty() {
        let root = std::env::temp_dir().join(format!("pihu-account-absent-{}", std::process::id()));
        assert_eq!(read(&root.join("nonexistent-parent/accounts.json")).unwrap(), "{}");
    }

    #[test]
    fn reads_paths_with_spaces_and_reports_io_errors() {
        let root = std::env::temp_dir().join(format!("pihu account test {}", std::process::id()));
        std::fs::create_dir_all(&root).unwrap();
        let path = root.join("accounts.json");
        let contents = r#"{"accounts":[{"email":"example@example.com"}]}"#;
        std::fs::write(&path, contents).unwrap();
        assert_eq!(read(&path).unwrap(), contents);
        assert!(read(&root).is_err());
        std::fs::remove_dir_all(root).unwrap();
    }
}
