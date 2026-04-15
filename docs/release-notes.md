---
title: Release notes
nav_order: 5
---

# Release Notes

## 0.1.0 (2026-04-15)

Initial release.

### Features

- Per-folder opt-in for hidden root-level folders (e.g. `.claude`, `.github`). Each folder discovered at the vault root can be toggled independently from the settings tab.
- Full Obsidian integration: indexed files appear in the file explorer, Quick Switcher, search, graph view, metadata cache, Bases, Dataview, and any plugin that uses the standard vault API.
- Live updates via filesystem watchers (create / modify / rename / delete) driven through Obsidian's own `reconcileFile` path.
- Configurable file-type allowlist with a default that covers every format Obsidian supports natively — Markdown, Canvas, Bases, PDF, common image / audio / video types. Folders are always traversed; the allowlist only controls which files get injected.
- Explicit **Save** button for allowlist edits so the full background rebuild fires once per deliberate change, not on every keystroke. **Reset to defaults** applies immediately.
- Clean disable and uninstall: every injected entry is removed from the vault cache, all fs watchers are torn down, and the monkey-patched adapter methods are restored. Nothing is left behind and nothing on disk is touched.
- `Hidden Folders Access: Rescan hidden folders` command for forcing a refresh after bulk on-disk changes or when fs watchers miss events (network mounts, editors using atomic replace, etc.).
