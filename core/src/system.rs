use std::path::Path;
use std::process::Command;

/// Terminal emulators tried in order. The first one found on PATH wins.
/// `x-terminal-emulator` is the Debian/Ubuntu alternatives entry and is
/// tried first so the user's configured default is honored.
const TERMINALS: [&str; 6] = [
    "x-terminal-emulator",
    "gnome-terminal",
    "konsole",
    "xfce4-terminal",
    "tilix",
    "xterm",
];

fn on_path(bin: &str) -> bool {
    Command::new("which")
        .arg(bin)
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

/// Opens a terminal emulator with `dir` as its working directory.
/// Arguments are passed as argv with an explicit `current_dir`; the path is
/// never concatenated into a shell string.
pub fn open_in_terminal(dir: &str) -> Result<(), String> {
    let path = Path::new(dir);
    if !path.is_dir() {
        return Err(format!("{dir} is not a directory"));
    }

    let terminal = TERMINALS
        .iter()
        .find(|t| on_path(t))
        .ok_or("no supported terminal emulator found")?;

    // Most emulators honor the inherited working directory; gnome-terminal
    // needs it stated explicitly.
    let mut cmd = Command::new(terminal);
    cmd.current_dir(path);
    if *terminal == "gnome-terminal" {
        cmd.arg(format!("--working-directory={dir}"));
    }

    cmd.spawn()
        .map(|_| ())
        .map_err(|e| format!("failed to open terminal: {e}"))
}

/// Opens `dir` in the system file manager via `xdg-open`.
pub fn open_folder(dir: &str) -> Result<(), String> {
    let path = Path::new(dir);
    if !path.is_dir() {
        return Err(format!("{dir} is not a directory"));
    }
    Command::new("xdg-open")
        .arg(dir)
        .current_dir(path)
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("failed to open folder: {e}"))
}
