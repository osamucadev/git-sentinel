# Git Sentinel

A local-first desktop dashboard for developers who juggle many Git repositories
on one machine.

> I have many repositories and many branches. I frequently lose track of which
> branch is checked out where, whether I have uncommitted work somewhere, and how
> far my current work has diverged from the project's main local branch.

Git Sentinel aggregates your local repositories into a single window so you can
answer *"what is happening across my repositories?"* in seconds — without walking
directories and re-running `git status`, `git branch`, `git log`.

Git Sentinel is an **observer**. It does not replace Git, your terminal, your IDE,
or your file manager.

## Status

- **Linux only** for now (developed on Ubuntu). No Windows/macOS behavior.
- First functional version: observation, not actions.

## Features

- First-run onboarding: pick a **personality**, a **language**, and what Sentinel
  should call you.
- Four presentation personalities — **Technical**, **Cute**, **Sci-Fi**,
  **Jarbas** — sharing one underlying data model. Personality changes copy,
  color, typography, spacing and shape; never the Git facts.
- Three languages: **English** (canonical), **Português (Brasil)**, **Español**.
- **HQ**: a scannable grid of repository cards showing current branch,
  clean/dirty state, working-tree counts, latest commit, and divergence.
- **Local divergence** vs a detected base branch (`main` / `master` / `develop`).
- **Remote-tracking divergence** vs the current branch's upstream, clearly
  labelled as last-known (tracking) information, not live server state.
- **Refresh** (re-read local Git state) and **Fetch** / **Fetch all** (update
  remote-tracking refs only — never automatic).
- Repository **details** view: overview, working tree, searchable branch list,
  remotes, latest commit.
- **Open in Terminal** and **Open folder** at the repository path.
- **Remove from Sentinel** — removes only Sentinel's reference; never touches the
  repository.

## Safety philosophy

Git Sentinel does not own your repositories. Registering a repository stores only
its path. **Nothing** in this version mutates a repository: no pull, push,
checkout, merge, rebase, reset, branch or stash operations exist in the code.

`Fetch` is the single network operation, and it only updates remote-tracking
refs; it never integrates changes into your working branch.

Removing a repository deletes Sentinel's saved reference and nothing else.

## Credentials and remotes

Git Sentinel does **not** manage authentication. No GitHub/GitLab login, OAuth,
tokens, or SSH keys. It assumes your Git environment is already configured. If a
fetch fails due to auth/network/SSH, Sentinel shows the Git error and moves on —
it does not try to solve it. A remote is just a Git remote (any host).

## Development setup

Prerequisites:

- Node.js 18+
- Rust (stable) via [rustup](https://rustup.rs)
- System libraries for Tauri v2 on Debian/Ubuntu:

  ```bash
  sudo apt install -y libwebkit2gtk-4.1-dev libsoup-3.0-dev \
    libjavascriptcoregtk-4.1-dev libxdo-dev libssl-dev librsvg2-dev \
    build-essential pkg-config file
  ```

Then:

```bash
npm install
npm run tauri dev        # run the desktop app in development
npm run tauri build      # produce a .deb / AppImage in src-tauri/target/release/bundle
```

Tests:

```bash
npm test                 # frontend logic (Vitest)
cargo test               # Rust: git inspection unit + integration tests
```

## Architecture

```
Git repository
      ↓  (git CLI, machine-readable output)
core crate  — pure Rust: parse status, pick base branch, compute divergence
      ↓  RepositoryState  (normalized, personality-independent)
src-tauri   — thin Tauri commands over the core
      ↓  invoke()
React UI    — one state model, four personalities (tokens + copy)
```

- **`core/`** — `git-sentinel-core`: a GUI-free crate holding all Git logic. It
  shells out to the system `git` with an explicit argv and working directory
  (never a shell string) and parses `--porcelain=v2` / `for-each-ref` /
  `rev-list` output. Unit- and integration-tested with throwaway repositories.
- **`src-tauri/`** — the Tauri app. `commands.rs` exposes five commands:
  `validate_repository`, `inspect_repository`, `fetch_repository`,
  `open_in_terminal`, `open_folder`. No state lives here.
- **`src/`** — the React front end.
  - `state/AppState.tsx` — one context: config + registered repos + inspection
    results, plus all actions.
  - `store.ts` — persistence via `tauri-plugin-store`, a single JSON file
    (`~/.local/share/com.gitsentinel.app/sentinel.json`) holding preferences and
    repository paths. Git state is never persisted as authoritative.
  - `i18n/` — plain TypeScript dictionaries and a `fill()` interpolator.
  - `personality/` — `themes.css` (design tokens per `[data-personality]`) and
    `copy.ts` (tone per personality). Components are shared.

## Deliberate V1 limitations

- Repository state is inspected on demand (startup, Refresh, Fetch). No file
  watchers, polling, tray icon or notifications.
- Remote-tracking numbers can be stale until you fetch; the UI says so.
- Terminal detection tries `x-terminal-emulator`, then common emulators.
- The i18n layer is intentionally minimal (no plural rules engine, no ICU).
