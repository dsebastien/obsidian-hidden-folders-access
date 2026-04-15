# Configuration

Everything is configured in **Settings → Hidden Folders Access**.

## Settings

| Setting             | Type            | Default | Description                                                                                                                                                                                               |
| ------------------- | --------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hidden folders      | List of toggles | All off | One toggle per hidden folder found at the vault root. Enabling a toggle kicks off indexing in the background with a progress notification; disabling it runs a background cleanup. Both are non-blocking. |
| Refresh folder list | Button          | —       | Re-scan the vault root to pick up hidden folders added after startup. This only refreshes the list — it does not re-index folders that are already enabled.                                               |

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
    "enabledFolders": [".claude", ".github"]
}
```

You can back up or version-control this file alongside your vault config.

## Compatibility

- Desktop only (the plugin manifest sets `isDesktopOnly: true`). Mobile Obsidian does not expose the filesystem primitives this plugin relies on.
- Tested with Obsidian 1.4+ on Linux, macOS, and Windows.
