//! VTOP credentials remain in the macOS login Keychain, outside settings and chat history.
#[cfg(target_os = "macos")]
mod mac {
    use std::ffi::c_void;
    use std::ptr;
    const SERVICE: &[u8] = b"in.co.nfks.pihu.vtop";
    const ACCOUNT: &[u8] = b"login";
    #[link(name = "Security", kind = "framework")]
    extern "C" {
        fn SecKeychainFindGenericPassword(keychain: *const c_void, service_len: u32, service: *const u8, account_len: u32, account: *const u8, len: *mut u32, data: *mut *mut c_void, item: *mut *mut c_void) -> i32;
        fn SecKeychainAddGenericPassword(keychain: *const c_void, service_len: u32, service: *const u8, account_len: u32, account: *const u8, len: u32, data: *const c_void, item: *mut *mut c_void) -> i32;
        fn SecKeychainItemModifyAttributesAndData(item: *mut c_void, attrs: *const c_void, len: u32, data: *const c_void) -> i32;
        fn SecKeychainItemFreeContent(attrs: *mut c_void, data: *mut c_void) -> i32;
    }
    #[link(name = "CoreFoundation", kind = "framework")]
    extern "C" { fn CFRelease(value: *const c_void); }
    pub fn credentials(setup: bool) -> Result<serde_json::Value, String> {
        let value = if setup {
            // Native hidden-password prompt: credentials never enter shell arguments or logs.
            let script = r#"set u to text returned of (display dialog "VTOP username" default answer "" with title "Pihu VTOP Setup")
set p to text returned of (display dialog "VTOP password" default answer "" with hidden answer with title "Pihu VTOP Setup")
return u & linefeed & p"#;
            let output = std::process::Command::new("/usr/bin/osascript").args(["-e", script]).output().map_err(|_| "Could not show credential setup")?;
            if !output.status.success() { return Err("VTOP setup cancelled.".into()); }
            let text = String::from_utf8(output.stdout).map_err(|_| "Invalid credential response")?;
            let (username, password) = text.trim_end_matches('\n').split_once('\n').ok_or("Invalid credential response")?;
            if username.trim().is_empty() || password.is_empty() { return Err("Username and password are required.".into()); }
            Some(serde_json::json!({"username":username.trim(),"password":password}))
        } else { None };
        unsafe {
            let mut len = 0; let mut data = ptr::null_mut(); let mut item = ptr::null_mut();
            let status = SecKeychainFindGenericPassword(ptr::null(), SERVICE.len() as u32, SERVICE.as_ptr(), ACCOUNT.len() as u32, ACCOUNT.as_ptr(), &mut len, &mut data, &mut item);
            if let Some(value) = value {
                let bytes = serde_json::to_vec(&value).map_err(|_| "Could not encode credentials")?;
                let stored = if status == 0 {
                    SecKeychainItemModifyAttributesAndData(item, ptr::null(), bytes.len() as u32, bytes.as_ptr().cast())
                } else if status == -25300 {
                    SecKeychainAddGenericPassword(ptr::null(), SERVICE.len() as u32, SERVICE.as_ptr(), ACCOUNT.len() as u32, ACCOUNT.as_ptr(), bytes.len() as u32, bytes.as_ptr().cast(), ptr::null_mut())
                } else { status };
                if !data.is_null() { SecKeychainItemFreeContent(ptr::null_mut(), data); }
                if !item.is_null() { CFRelease(item); }
                if stored != 0 { return Err(format!("Keychain could not save VTOP credentials ({stored}).")); }
                return Ok(serde_json::json!({"saved":true}));
            }
            if status != 0 { return Err("Say ‘Set up VTOP’ to save your login credentials first.".into()); }
            let result = serde_json::from_slice(std::slice::from_raw_parts(data.cast::<u8>(), len as usize)).map_err(|_| "Invalid saved credentials".into());
            SecKeychainItemFreeContent(ptr::null_mut(), data);
            if !item.is_null() { CFRelease(item); }
            result
        }
    }
}
#[tauri::command]
pub async fn vtop_credentials(setup: bool) -> Result<serde_json::Value, String> {
    #[cfg(target_os = "macos")]
    { tauri::async_runtime::spawn_blocking(move || mac::credentials(setup)).await.map_err(|e|e.to_string())? }
    #[cfg(not(target_os = "macos"))]
    { let _ = setup; Err("VTOP credential storage currently requires macOS Keychain.".into()) }
}
