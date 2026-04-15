# Configuration

Settings are persisted via `Plugin.loadData` / `Plugin.saveData` (file: `.obsidian/plugins/hidden-folders-access/data.json`).

## Schema

```ts
interface PluginSettings {
    // Hidden root-level folder names (with leading dot) that should be
    // indexed by Obsidian, e.g. [".claude", ".github"].
    enabledFolders: string[]
    // File extensions (no leading dot, lowercase) that should be injected
    // when indexing. Folders are always traversed. Missing or empty entries
    // fall back to DEFAULT_ALLOWED_EXTENSIONS (every Obsidian-native format).
    allowedExtensions: string[]
}
```

Loader normalisation (`Plugin.loadSettings` in `src/app/plugin.ts`):

- `enabledFolders` entries of any non-string shape are discarded.
- `allowedExtensions` entries are lower-cased, stripped of leading dots, trimmed, and empty results dropped; when the key is absent entirely, `DEFAULT_ALLOWED_EXTENSIONS` is used.

## Settings tab

- **Hidden folders**: a list of every hidden folder discovered at the vault root (excluding the Obsidian config directory). Each entry has a toggle. Enabling a folder injects it and every descendant into the vault cache and starts fs watchers. Disabling it reverses the injection.
- **Rescan vault root**: re-scans on-disk hidden folders (picks up newly added ones) and re-applies indexing for every enabled folder.
- **Allowed extensions**: comma-separated list of file extensions that should be injected. Saves automatically — a short debounce on keystrokes plus an immediate save on blur — and triggers `runBackgroundRebuild` for every currently-enabled folder so the new filter is applied.
- **Reset to defaults**: rewrites `allowedExtensions` with `DEFAULT_ALLOWED_EXTENSIONS` and rebuilds.

## Commands

- `Hidden Folders Access: Rescan hidden folders` — same as the settings button.
