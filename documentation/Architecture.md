# Architecture

## Goal

Make Obsidian treat selected hidden root-level folders (names starting with `.`, e.g. `.claude`) as first-class vault content: they appear in the file tree, the metadata cache, the link graph, and Bases, and they stay in sync with on-disk changes. On-disk names are preserved so external tools (Claude Code, git, etc.) keep working unchanged.

## Why monkey-patching

Obsidian has no public API for whitelisting hidden paths. The adapter-level hidden filter is applied in two undocumented helpers (`listRecursiveChild` and `reconcileFile`) via an internal `ru(path)` predicate. Symlinks and folder renames were rejected because they break Sync / cross-platform behaviour and surprise external tools. Plugins like Hider manipulate the DOM; that does not help the metadata cache or Bases.

## Components

```
src/
  main.ts                       Plugin default export
  app/
    plugin.ts                   Lifecycle, settings load/save, command registration
    services/
      hidden-folders-indexer.ts Core: scans, patches, populates, watches, tears down
    settings/
      settings-tab.ts           UI: lists hidden root folders, per-folder toggle, rescan
    types/
      plugin-settings.intf.ts   PluginSettings { enabledFolders: string[] }
  utils/
    log.ts                      Structured logging
```

## Indexer strategy (`HiddenFoldersIndexer`)

1. **Discover** — `adapter.list('/')` returns hidden folders (the filter is applied elsewhere). The indexer lists them, removes the Obsidian config directory, and exposes the result to the settings tab. The same listing powers `pathExistsOnDisk(path)`, which is used to skip configured-but-missing folders without mutating settings.
2. **Patch** — on first enable, wrap two adapter methods:
    - `listRecursiveChild(parent, name)`: the original drops hidden paths by calling `reconcileDeletion`. Our wrapper, for whitelisted paths, bypasses the filter and calls `reconcileFileInternal(path, path)` directly.
    - `reconcileFile(e, t, silent)`: same idea — when a watcher event fires for a whitelisted path, skip the hidden check and recurse via `reconcileFileInternal`.
      Originals are restored once the last folder is disabled.
3. **Filter** — both patched methods consult the indexer's `allowedExtensions` set. For a path whose basename has a disallowed extension, the indexer runs a single `fs.stat` (desktop-only) and skips the reconcile entirely when the entry is a file. Folders, extensionless names, and dot-prefixed names (like `.claude`) always pass through — they're cheap to traverse, and the filter would otherwise hide nested content. This keeps the cascade walking every directory while only injecting files the user cares about.
4. **Populate** — for each enabled folder call `reconcileFolderCreation(path, path)`. It triggers a cascade: `reconcileFolderCreation → listRecursive → listRecursiveChild (patched) → reconcileFileInternal → reconcileFileCreation/reconcileFolderCreation`. All descendants are injected into `adapter.files`, `vault.fileMap`, and emit the vault `create` events that drive the metadata cache and Bases.
5. **Watch** — call `adapter.watchHiddenRecursive(path)` to register fs.watch handlers on every subdirectory. Watcher events flow through the patched `reconcileFile`, so modify/rename/delete events propagate.
6. **Disable** — stop every watcher whose key falls under the disabled prefix, then call `reconcileDeletion` for every injected entry (bottom-up so folders empty before they are removed). When the last enabled folder is disabled, restore the original adapter methods.

## Lifecycle

- `onload`: load settings → register settings tab → register `rescan-hidden-folders` command → load the metadata snapshot and restore it for `settings.enabledFolders` → register the snapshot save triggers → on `workspace.onLayoutReady`, call `runBackgroundSync(settings.enabledFolders)`.
- `loadSettings` also pushes `settings.allowedExtensions` into the indexer before any reconcile happens, so the filter is live for the initial `runBackgroundSync`.
- `updateAllowedExtensions(list)`: persists the new list, refreshes the indexer's allowlist, then calls `runBackgroundRebuild` which spawns one disable-then-enable task per currently-enabled folder. Each task shows a single "Rebuilding index for <path>… N entries" notice that converges to the final count.
- `onunload`: save the metadata snapshot (synchronous), then `indexer.teardown()` removes every injected entry, stops every watcher, and restores the adapter methods.

## Metadata snapshot (fast restarts)

Problem: at startup, `MetadataCache.initialize()` calls `deletePath()` for every file-cache entry whose path the vault scan did not find. The scan skips dot-folders, so each restart forgets the entries of all hidden files. Re-injecting them made Obsidian read, hash, re-parse (when `cleanupDeletedCache()` had purged the parsed metadata), write both IndexedDB stores, and fire `changed` for each file. Measured on Obsidian 1.15.1 with 63 plugins: about 215 ms of main-thread time per markdown file, so minutes of frozen UI for a few hundred files, at every start.

Fix (`services/metadata-cache-snapshot.ts`, wired in the indexer and the plugin):

- The plugin keeps `[path, mtime, size, hash]` for every markdown file below an enabled folder, in `app.saveLocalStorage` (per vault, synchronous, not synced). Non-markdown files have no hash and are cheap, so they are not stored.
- `onload` puts the entries back into `metadataCache.fileCache` (memory only, never over a live entry, only when the parsed metadata for the hash is still in memory). This runs before the first `cleanupDeletedCache()` (60 s after startup), so the parsed metadata stays referenced and is not purged. `runEnable` restores again before the cascade (rebuilds, toggles).
- When a file is injected, Obsidian finds a matching `mtime` / `size` and a known hash: the same path as any unchanged vault file at startup. The file only goes through link resolution (`resolve` / `resolved`); it is not read, hashed, parsed or written to IndexedDB, and `changed` does not fire. Its metadata is already available in `create` handlers. Measured: about 7.5 ms per file.
- After the cascade, restored entries that no file claimed (deleted on disk, or now filtered out) are removed.
- The snapshot is saved (debounced 5 s) after `changed`, `delete` and `rename` events below an enabled folder, after each enable, rebuild and disable task, and synchronously in `onunload` before teardown. Folders that are busy or missing keep their previous entries; folders that are no longer configured are dropped.
- A file whose content changed while Obsidian was closed has a different `mtime` or `size`, so Obsidian parses it as usual.

## Missing configured folders

A folder listed in `settings.enabledFolders` may no longer exist on disk — the user may have deleted it externally, or it may be a stale entry from another machine. The plugin treats this as a non-error:

- `startEnableTask` and `startRebuildTask` in `plugin.ts` pre-check `indexer.pathExistsOnDisk(path)` and return early without creating any `Notice` when the folder is missing. A debug log records the skip.
- `HiddenFoldersIndexer.runEnable` runs the same check as a defensive second guard (the pre-check and the enable call are not atomic). A missing folder is logged at `debug` and the method returns without throwing, without adding to `enabledPrefixes`, and without calling `ensurePatched`.
- The settings tab does **not** prune missing entries from `enabledFolders`. The config is preserved verbatim, so the folder is automatically re-indexed on the next sync (Obsidian restart, plugin toggle, `Rescan hidden folders` command, or the folder reappearing and being toggled again).

The trade-off: a missing entry stays invisible in the settings list until it reappears on disk. Users who want to remove it permanently must untoggle it (once the folder exists) or edit `data.json` directly.

## Background task model

Discovery (`listHiddenRootFolders`) is decoupled from indexing: the settings tab shows the folder list instantly without touching the vault cache. Indexing only happens when the user toggles a folder or when settings change at load time.

Every enable/disable runs as a fire-and-forget background task owned by the plugin:

- `updateEnabledFolders` persists the new list synchronously (awaited `saveData`) and then calls `runBackgroundSync` which diffs the desired set against `indexer.getEnabledPrefixes()` and spawns one task per delta.
- Each task creates a persistent `Notice` (timeout 0), polls the loaded-file count every 500 ms to update the message, and hides the notice after a short grace period on completion or error.
- `HiddenFoldersIndexer` dedupes concurrent operations per path via an `inFlight` map: calling `enablePath('.claude')` twice before the first completes returns the same in-flight promise.
- The disable loop yields to the event loop every 250 `reconcileDeletion` calls so the main thread can keep servicing UI events on large trees.

## Desktop-only

The strategy relies on Obsidian's desktop `FileSystemAdapter` (`reconcile*`, `watchHiddenRecursive`, `watchers`). Mobile uses `CapacitorAdapter` which doesn't expose those internals. The manifest sets `isDesktopOnly: true`.

## Known trade-offs

- **Undocumented internals** — the plugin calls methods Obsidian may rename without notice. Updates across Obsidian releases may require adaptation.
- **Large folders** — the first cascade indexes every descendant synchronously (awaited). A folder with thousands of markdown files can freeze the UI while the metadata worker parses them. Later startups restore the metadata snapshot (see below), so only changed files are parsed again.
- **Obsidian Sync** — injected files are never synced. Sync tracks them (its `onFileAdd`/`onFileRemove` handlers react to the vault events our injection and cleanup fire), but every upload, download and deletion goes through its `allowSyncFile` filter, which is path-based and rejects any path starting with `.` (the config dir's special files aside). Consequences:
    - Each device only sees the hidden folders present on its own disk; Sync never copies `.claude/...` between devices. Use git or another tool for that.
    - Disabling a folder or unloading the plugin calls `reconcileDeletion`, which fires vault `delete` events. Sync's filter blocks these, so they never become remote deletions. Verified against Obsidian 1.14.4.
    - The config dir must never be indexed: Sync does track its files, so cleanup there could propagate deletions (the data-loss case reported for `obsidian-unhide`). The settings tab already hides it from the folder list.
- **Other sync tools** — third-party sync plugins (Remotely Save, Self-hosted LiveSync, obsidian-git, ...) may act on vault `delete` events without filtering dot-paths. Disabling a folder or unloading the plugin could then become a remote deletion. Not verified; users of those tools should keep backups.
- **Plugins act on injected files** — once indexed, the files are ordinary vault files to every other plugin and to Obsidian itself: rename-driven link updates can rewrite links inside them, and formatters, auto-movers and bulk editors can modify or move them. A user-initiated delete from the file explorer removes the file from disk.
