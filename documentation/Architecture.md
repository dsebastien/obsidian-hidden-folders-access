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

- `onload`: load settings → register settings tab → register `rescan-hidden-folders` command → on `workspace.onLayoutReady`, call `runBackgroundSync(settings.enabledFolders)`.
- `loadSettings` also pushes `settings.allowedExtensions` into the indexer before any reconcile happens, so the filter is live for the initial `runBackgroundSync`.
- `updateAllowedExtensions(list)`: persists the new list, refreshes the indexer's allowlist, then calls `runBackgroundRebuild` which spawns one disable-then-enable task per currently-enabled folder. Each task shows a single "Rebuilding index for <path>… N entries" notice that converges to the final count.
- `onunload`: `indexer.teardown()` removes every injected entry, stops every watcher, and restores the adapter methods.

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
- **Large folders** — the initial cascade indexes every descendant synchronously (awaited). A folder with thousands of markdown files can freeze the UI for a few seconds while the metadata worker catches up. One-off per plugin load.
- **Sync** — Sync operates on the adapter's logical paths. Because we preserve on-disk names (`.claude/...`) and inject them into the vault cache, Sync sees files under their real paths. Other devices running the plugin see the same content; devices without the plugin simply don't see the files, identical to baseline Obsidian.
