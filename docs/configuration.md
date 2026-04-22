---
title: Configuration
nav_order: 3
---

# Configuration

Everything is configured in **Settings → Hidden Folders Access**.

## Settings

| Setting             | Type            | Default                     | Description                                                                                                                                                                                                                                                                        |
| ------------------- | --------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hidden folders      | List of toggles | All off                     | One toggle per hidden folder found at the vault root. Enabling a toggle kicks off indexing in the background with a progress notification; disabling it runs a background cleanup. Both are non-blocking.                                                                          |
| Refresh folder list | Button          | —                           | Re-scan the vault root to pick up hidden folders added after startup. This only refreshes the list — it does not re-index folders that are already enabled.                                                                                                                        |
| Allowed extensions  | Text (CSV)      | All Obsidian-native formats | Comma-separated list of file extensions (no leading dot) that should be indexed. Folders are always traversed — the filter only affects which files get injected. Edits become effective only when you click **Save**; that triggers a background rebuild of every enabled folder. |
| Save                | Button          | —                           | Apply the edited allowlist. Disabled while the textarea matches the persisted value (whitespace, casing, duplicates and leading dots are ignored in that comparison).                                                                                                              |
| Reset to defaults   | Button          | —                           | Restore the allowlist to every file type Obsidian supports natively (Markdown, Canvas, Bases, images, PDF, audio, video). Applies immediately — no Save required.                                                                                                                  |

Only folders at the **vault root** are shown. Nested dot-folders (e.g. `SomeFolder/.archive/`) are not listed individually — they are automatically included if their root ancestor is enabled and already visible to Obsidian.

The Obsidian configuration directory (usually `.obsidian/`) is never listed and cannot be enabled.

## Persistence

Settings are saved per-vault in:

```
<Vault>/.obsidian/plugins/hidden-folders-access/data.json
```

Schema:

```json
{
    "enabledFolders": [".claude", ".github"],
    "allowedExtensions": ["md", "canvas", "base", "png", "pdf"]
}
```

`allowedExtensions` is always stored lowercase, without leading dots. Missing or empty entries fall back to the defaults (every format Obsidian supports natively).

You can back up or version-control this file alongside your vault config.

## Missing folders

An entry in `enabledFolders` that no longer matches a folder on disk is kept as-is in the config. The plugin silently skips indexing for that entry — no error notification, no warning, no rebuild — and picks it up again automatically the next time the folder appears (Obsidian restart, plugin toggle, **Rescan hidden folders** command, or toggling the folder in the settings tab once it reappears). This keeps external workflows that delete and recreate dot-folders (e.g. re-cloning `.claude/`) from corrupting your configuration.

## Compatibility

- Desktop only (the plugin manifest sets `isDesktopOnly: true`). Mobile Obsidian does not expose the filesystem primitives this plugin relies on.
- Tested with Obsidian 1.4+ on Linux, macOS, and Windows.
