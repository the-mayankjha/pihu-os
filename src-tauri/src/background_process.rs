use std::ffi::OsStr;
use std::process::Command;

/// Background services must not create a console window in the Windows GUI app.
pub fn command(program: impl AsRef<OsStr>) -> Command {
    #[allow(unused_mut)]
    let mut command = Command::new(program);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        command.creation_flags(CREATE_NO_WINDOW);
    }
    #[cfg(not(test))]
    crate::bundled_runtime::configure(&mut command);
    command
}

#[cfg(all(test, target_os = "windows"))]
mod tests {
    #[test]
    fn background_child_has_no_console_window() {
        // A hidden console executable must not inherit the test runner's console.
        let result = super::command("powershell.exe")
            .args(["-NoProfile", "-NonInteractive", "-Command", r#"
                $ErrorActionPreference = 'Stop';
                Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class PihuConsoleCheck { [DllImport("kernel32.dll")] public static extern IntPtr GetConsoleWindow(); }';
                if ([PihuConsoleCheck]::GetConsoleWindow() -ne [IntPtr]::Zero) { exit 1 }
                exit 0
            "#])
            .output()
            .expect("Windows PowerShell must start");
        assert!(result.status.success(), "{}", String::from_utf8_lossy(&result.stderr));
    }
}
