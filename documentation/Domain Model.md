# Domain Model

## Core concepts

| Concept            | Type                                            | Meaning                                                                                                                                                                                               |
| ------------------ | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hidden root folder | `string` (name starting with `.`)               | A folder that sits directly under the vault root whose name starts with a dot. Obsidian's default behaviour is to ignore these.                                                                       |
| Enabled prefix     | `string` (e.g. `.claude`)                       | A hidden root folder the user has opted in to. Every descendant of an enabled prefix is made visible to Obsidian.                                                                                     |
| Injection          | Operation                                       | The act of populating `adapter.files` and `vault.fileMap` for a path that Obsidian would otherwise ignore, via the `reconcile*` methods.                                                              |
| Patch              | Runtime wrapper on adapter methods              | Lightweight method replacement on `adapter.listRecursiveChild` and `adapter.reconcileFile` that bypasses the hidden filter for enabled prefixes.                                                      |
| Indexer            | `HiddenFoldersIndexer`                          | Service owning the state of enabled prefixes, patch lifecycle, injection, and teardown.                                                                                                               |
| Allowed extension  | `string` (lowercase, no leading dot, e.g. `md`) | A file-type suffix the user has opted in to indexing. Files whose extension is absent from the allowlist are skipped during injection and on live fs events. Folders are always traversed regardless. |

## State

The plugin holds state in three places:

1. **Persisted settings** (`data.json` via `Plugin.saveData`):

    ```ts
    interface PluginSettings {
        enabledFolders: string[]
        allowedExtensions: string[]
    }
    ```

    Source of truth for what the user wants indexed and which file types should pass the filter. Re-applied on every plugin load; missing fields fall back to `DEFAULT_SETTINGS`.

2. **Indexer runtime state** (in memory, `HiddenFoldersIndexer`):
    - `enabledPrefixes: Set<string>` — currently injected folders.
    - `watchedPrefixes: Set<string>` — folders with live fs watchers.
    - `allowedExtensions: Set<string>` — active extension allowlist. Synced from settings on load and whenever the user updates the list. Empty set means no filter.
    - `patches: PatchMemo | null` — references to the original adapter methods, for restoration.

3. **Obsidian's own state** (mutated by the plugin):
    - `adapter.files[path]` — internal file registry on the desktop adapter.
    - `adapter.watchers[path]` — active `fs.watch` handles.
    - `vault.fileMap[path]` — the `TFile` / `TFolder` tree consumed by every UI and plugin API.
    - `metadataCache.*` — automatically populated by the vault's `create` event.

## Invariants

- `enabledPrefixes ⊆ settings.enabledFolders` (runtime state may lag during `sync`, but converges).
- `watchedPrefixes ⊆ enabledPrefixes`.
- `patches !== null ⇔ enabledPrefixes.size > 0`. Patches are removed as soon as the last folder is disabled, so the adapter incurs no overhead when no folders are enabled.
- A patch never changes behaviour for non-enabled paths; each patched method short-circuits with the original behaviour otherwise.

## Lifecycle events

```
onload
  └─ loadSettings
  └─ register settings tab + "Rescan" command
  └─ workspace.onLayoutReady
       └─ indexer.sync(settings.enabledFolders)

user toggles a folder
  └─ plugin.updateEnabledFolders([...])
       └─ saveData
       └─ indexer.sync(newList)

user edits allowed extensions
  └─ plugin.updateAllowedExtensions([...])
       └─ saveData
       └─ indexer.setAllowedExtensions(newList)
       └─ runBackgroundRebuild — disable+enable every currently-enabled folder

user runs "Rescan" or clicks the button
  └─ plugin.applyEnabledFolders
       └─ indexer.sync(settings.enabledFolders)

fs event inside an enabled folder
  └─ adapter.onFileChange
       └─ adapter.reconcileFile  (patched — bypasses hidden filter)
            └─ adapter.reconcileFileInternal
                 └─ reconcileFileCreation / reconcileFolderCreation / reconcileDeletion
                      └─ vault.onChange  ("file-created" / "modified" / "file-removed")
                           └─ UI + metadataCache update

onunload
  └─ indexer.teardown
       └─ for each enabled prefix: disablePath
            └─ stopWatchPath for every watcher under the prefix
            └─ reconcileDeletion for every injected entry (bottom-up)
            └─ restore patches once enabledPrefixes is empty
```
