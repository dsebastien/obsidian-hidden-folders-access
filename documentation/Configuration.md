# Configuration

Settings are persisted via `Plugin.loadData` / `Plugin.saveData` (file: `.obsidian/plugins/hidden-folders-access/data.json`).

## Schema

```ts
interface PluginSettings {
    // Hidden root-level folder names (with leading dot) that should be
    // indexed by Obsidian, e.g. [".claude", ".github"].
    enabledFolders: string[]
}
```

## Settings tab

- **Hidden folders**: a list of every hidden folder discovered at the vault root (excluding the Obsidian config directory). Each entry has a toggle. Enabling a folder injects it and every descendant into the vault cache and starts fs watchers. Disabling it reverses the injection.
- **Rescan vault root**: re-scans on-disk hidden folders (picks up newly added ones) and re-applies indexing for every enabled folder.

## Commands

- `Hidden Folders Access: Rescan hidden folders` — same as the settings button.
