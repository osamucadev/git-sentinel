//! Pure Git inspection logic for Git Sentinel.
//!
//! This crate has no dependency on Tauri or any GUI toolkit, so its logic
//! can be unit- and integration-tested with a plain `cargo test`. It only
//! reads Git state and opens external programs (terminal, file manager);
//! it never mutates a repository.

pub mod git;
pub mod inspect;
pub mod model;
pub mod system;
