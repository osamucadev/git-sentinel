# Git Sentinel Guide

Git Sentinel is a local-first Linux desktop application for observing several Git repositories from one place. It helps you decide what to inspect next without replacing Git, an IDE, a terminal, or your normal workflow.

## Contents

- [Getting started](#getting-started)
- [Reading repository state](#reading-repository-state)
- [Actions and activity](#actions-and-activity)
- [Personalities and languages](#personalities-and-languages)
- [Safety model](#safety-model)
- [Platform support and limitations](#platform-support-and-limitations)
- [Architecture](#architecture)
- [Contributing](#contributing)

## Getting started

On first launch, choose a visual personality, interface language, and preferred name. Add local Git repositories from HQ. Sentinel validates each selected folder before registering it and remembers only the path plus its own preferences.

The initial inspection runs locally. A repository that has not returned a result yet remains visibly loading; it is never counted as healthy just because inspection is pending.

## Reading repository state

HQ groups repositories by urgency. The presentation can vary by personality, but the facts are identical.

### Current branch

The current branch is shown beside the repository name whenever HEAD is attached. A detached HEAD is called out explicitly. A conflict has higher visual priority than detached state because resolving the conflict is the immediate concern.

### Local

The **Local** signal describes the working tree. It can show a clean tree, a compact total for local changes, or a conflict count. Secondary text can break local work down into staged, modified, deleted, and untracked files.

### Upstream

The **Upstream** signal compares the current branch to its own configured tracking branch. It can be synchronized, ahead, behind, diverged, unavailable, or absent.

“Tracking unavailable” means Sentinel does not have enough Git information to compare the branch with its upstream. It does **not** mean the upstream is gone.

### Reference

The optional **Reference** signal compares the current branch with the project's configured reference branch. This is intentionally separate from upstream. A feature branch can be synchronized with its upstream and still differ from `origin/main`, `origin/homolog`, or another project reference.

### Freshness

Remote-tracking data is a local snapshot. Sentinel shows when it last fetched remote refs, because ahead/behind values do not prove the live state of a server. Automatic Fetch is optional, disabled by default, and only runs while the app is open.

## Actions and activity

### Refresh

Refresh re-inspects one repository using local Git information. It does not use the network. Sentinel also watches relevant local Git metadata with debouncing, so external commits and working-tree changes refresh only the repository that changed.

### Fetch and Fetch all

Fetch updates remote-tracking refs for one repository. Fetch all performs the same work across the fleet with a small concurrency limit. Network commands run outside the GUI event loop, so the application remains scrollable and navigable while an operation is running.

### Push and read-only review

Push is an explicit normal `git push` action for a branch with commits waiting for its configured upstream. Git Sentinel never uses force. Repository Details can also list changed files and show staged plus unstaged diffs without writing to the working tree or index.

The activity strip reports inspection and fetch progress, including completed items, failures, and an active repository. During conflicting work, affected actions can be disabled, but navigation remains available.

### Other actions

- **Open in Terminal** opens the repository path in an available terminal emulator.
- **Open folder** opens the repository directory in the system file manager.
- **Remove from Sentinel** deletes only Sentinel's saved registration. It never deletes the repository or changes its Git history.

## Personalities and languages

Technical, Cute, Sci-Fi, Jarbas, Retro, Line Art, Pixel Art, and Modern Glass are shared presentations of one application. They do not implement separate Git logic. Switching personality changes visual treatment and small pieces of tone only.

English, Brazilian Portuguese, and Spanish are included. Git refs, paths, hashes, and command results remain factual and are not localized.

## Safety model

Git Sentinel is an observer with one explicit publishing action: normal Push. It does not offer pull, checkout, merge, rebase, reset, stash, or branch-creation actions. It does not write Git hooks into registered repositories.

Fetch is the only network-facing Git operation. It updates tracking references but never integrates remote changes into a working branch.

Sentinel does not handle GitHub, GitLab, SSH, HTTPS, OAuth, tokens, or credentials. Your operating system and existing Git configuration remain responsible for authentication.

## Platform support and limitations

The app is currently developed for Linux, especially Debian and Ubuntu environments. Windows and macOS are not ready or supported yet.

Current boundaries:

- automatic Fetch is opt-in and runs only while the app is open; no remote polling service;
- no desktop notifications, tray integration, or background scheduler;
- no cloud synchronization or hosted account;
- terminal launch depends on an installed compatible terminal emulator;
- remote state is only as fresh as the latest successful fetch.

## Architecture

```text
Git repository
  -> Rust core inspection
  -> normalized RepositoryState
  -> Tauri commands and local watcher
  -> shared React state
  -> personality presentation
```

The Rust core gathers Git facts through explicit Git command arguments and machine-readable output. It produces a normalized `RepositoryState`; the frontend derives fleet priority, human copy, signals, translations, and visual treatment from those facts. This keeps Git behavior separate from presentation.

## Contributing

Run the checks before proposing a change:

```bash
npm test
npm run test:core
npm run build
```

Platform work, documentation improvements, accessibility fixes, translations, design refinements, and test coverage are all welcome. Git Sentinel is released under the [MIT License](../LICENSE), so you may also fork and adapt it for your own workflow.
