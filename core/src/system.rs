use std::path::Path;
use std::process::Command;

/// A terminal emulator, the fixed args it needs, and how to tell it which
/// directory to open in.
struct Terminal {
    bin: &'static str,
    args: &'static [&'static str],
    /// `Some(prefix)` builds one argument as `{prefix}{dir}`; `None` relies on
    /// the inherited working directory.
    workdir_flag: Option<&'static str>,
}

/// Tried in order; the first emulator present on PATH wins. Client/server
/// emulators (ptyxis, gnome-terminal, kgx) ignore the inherited cwd, so they
/// are given an explicit flag and listed before the generic fallbacks.
const TERMINALS: [Terminal; 8] = [
    Terminal { bin: "ptyxis", args: &["--new-window"], workdir_flag: Some("--working-directory=") },
    Terminal { bin: "gnome-terminal", args: &[], workdir_flag: Some("--working-directory=") },
    Terminal { bin: "kgx", args: &[], workdir_flag: Some("--working-directory=") },
    Terminal { bin: "konsole", args: &[], workdir_flag: Some("--workdir=") },
    Terminal { bin: "xfce4-terminal", args: &[], workdir_flag: Some("--working-directory=") },
    Terminal { bin: "tilix", args: &[], workdir_flag: Some("--working-directory=") },
    Terminal { bin: "x-terminal-emulator", args: &[], workdir_flag: None },
    Terminal { bin: "xterm", args: &[], workdir_flag: None },
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
    cmd.args(terminal.args);
    if let Some(prefix) = terminal.workdir_flag {
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
