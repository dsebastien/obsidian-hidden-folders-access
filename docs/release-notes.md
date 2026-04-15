# Release Notes

## 0.1.0 (2026-04-15)

Initial release.

### Features

- Per-folder opt-in for hidden root-level folders (e.g. `.claude`, `.github`).
- Full Obsidian integration: file explorer, metadata cache, link graph, Bases.
- Live updates via filesystem watchers (create / modify / rename / delete).
- Clean disable and uninstall — injected entries are removed from the vault cache and the adapter is restored to its original state.
- `Hidden Folders Access: Rescan hidden folders` command for forcing a refresh.
