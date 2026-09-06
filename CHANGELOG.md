# Changelog

All notable changes to Git Sentinel are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-09-06

First public Linux release of Git Sentinel.

### Added

- A local-first Tauri desktop application for monitoring multiple Git repositories from one place.
- Headquarters with a dense, grouped fleet list for repositories that need attention, are ahead, or are healthy.
- Repository Details for inspecting the working tree, current branch, upstream, project reference, remotes, branches, and recent activity.
- Git inspection for local modifications, staging, untracked files, conflicts, detached HEAD, upstream tracking, ahead/behind counts, and a configurable reference branch.
- Explicit current-branch presentation and a shared semantic Git topology for attached repositories.
- Compact semantic repository signals for local state, upstream state, and reference-branch state, with a human interpretation and secondary Git details.
- Local Git metadata watching with debounce: external local Git changes re-inspect only the affected repository without automatic fetches or Git hooks.
- Non-blocking Fetch and Fetch All operations, with bounded concurrency and an activity strip that reports progress, completion, and failures.
- English, Brazilian Portuguese, and Spanish interfaces.
- Eight visual personalities using the same Git facts and behavior: Technical, Cute, Sci-Fi, Jarbas, Retro, Line Art, Pixel Art, and Modern Glass.
- An official neutral application icon plus runtime personality icon variants, applied on a best-effort basis while the application is running.
- Safe repository registration and removal: removing a repository from Sentinel never deletes its directory or Git history.
- Opening a registered repository in compatible Linux terminal emulators.

### Changed

- Replaced the early repository-card grid with a more scannable, horizontally structured fleet list.
- Reworked repository presentation so healthy repositories remain compact while complex Git states receive proportional detail.
- Kept the HQ focused on semantic signals and narrative, reserving topology detail for where it adds value.

### Fixed

- Conflict state now takes visual priority over detached HEAD when both are present.
- Repositories with an upstream but no tracking divergence are described as tracking unavailable instead of incorrectly assuming the upstream is gone.
- Pending repositories during initial inspection are represented as loading, rather than healthy.
- Fetch and Fetch All no longer run blocking Git network work on the graphical event loop.
- Restored readable language selectors in dark personalities.
- Added a dismiss action to success toasts.
- Prevented repository action menus from being clipped by the list in every personality.

### Known limitations

- Linux is the only supported platform. Windows and macOS are not ready yet.
- Git Sentinel observes local repositories and their locally stored remote-tracking refs; it does not automatically fetch or poll remotes.
- The application does not provide pull, push, checkout, merge, rebase, reset, branch creation, stash, desktop notifications, or tray support.
- Runtime window-icon changes can be ignored by the active Linux desktop environment or compositor; the official neutral icon remains the fallback.

[Unreleased]: https://github.com/osamucadev/git-sentinel/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/osamucadev/git-sentinel/releases/tag/v0.1.0
