use std::path::Path;
use std::process::Command;

/// A terminal emulator and how to tell it which directory to start in.
/// `None` means the emulator honors the inherited working directory.
struct Terminal {
    bin: &'static str,
    workdir_arg: Option<&'static str>,
}

/// Tried in order; the first emulator present on PATH wins. Emulators that are
/// known to ignore the inherited cwd (notably gnome-terminal) are listed with
/// an explicit flag and placed before the generic `x-terminal-emulator` entry.
const TERMINALS: [Terminal; 6] = [
    Terminal { bin: "gnome-terminal", workdir_arg: Some("--working-directory=") },
    Terminal { bin: "konsole", workdir_arg: Some("--workdir=") },
    Terminal { bin: "xfce4-terminal", workdir_arg: Some("--working-directory=") },
    Terminal { bin: "tilix", workdir_arg: Some("--working-directory=") },
    Terminal { bin: "x-terminal-emulator", workdir_arg: None },
    Terminal { bin: "xterm", workdir_arg: None },
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
        .find(|t| on_path(t.bin))
        .ok_or("no supported terminal emulator found")?;

    let mut cmd = Command::new(terminal.bin);
    cmd.current_dir(path);
    if let Some(prefix) = terminal.workdir_arg {
        cmd.arg(format!("{prefix}{dir}"));
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
