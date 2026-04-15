# Usage

## Getting Started

1. Install the plugin (see the [install section of the overview](./README.md#install) for BRAT or manual install) and enable it in **Settings → Community plugins**.
2. Open **Settings → Hidden Folders Access**. The tab opens instantly and lists every hidden folder it finds at the vault root (excluding Obsidian's own `.obsidian/` config folder). No indexing happens yet.
3. Toggle on any folder you want Obsidian to index. A notification appears (_"Indexing .claude…"_) and the work runs in the background. You can close the settings tab and keep working — when the folder is fully indexed the notification updates to _"Indexed .claude (N entries)"_ and disappears on its own.
4. Toggle off to reverse the process. Another background task removes the entries from Obsidian's cache; nothing on disk is touched.

Your selection is persisted per-vault in `.obsidian/plugins/hidden-folders-access/data.json` and re-applied on startup.

## Commands

| Command                                      | Description                                                                                                                                             |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hidden Folders Access: Rescan hidden folders | Re-apply indexing for every enabled folder in the background. Useful after bulk-changing files on disk through a tool that can't trigger file watchers. |

The settings tab also has a **Refresh** button that re-scans the vault root for newly-created hidden folders. That only refreshes the list — it does not touch already-indexed folders.

## Controlling which file types get indexed

Under the **File types** heading in the settings tab you'll find an **Allowed extensions** field — a comma-separated list of extensions (no leading dot) that are actually injected into Obsidian. Defaults cover every format Obsidian supports natively (Markdown, Canvas, Bases, images, PDF, audio, video). To restrict indexing to a subset:

1. Replace the list with the extensions you care about (e.g. `md, canvas, base`).
2. Click **Save**. Every enabled folder is rebuilt in the background with its own progress notice. The Save button stays disabled until your edits actually differ from the persisted list.
3. Click **Reset to defaults** to restore the full list — this applies immediately without needing Save.

Folders are always traversed regardless of the allowlist, so nested markdown files remain reachable even if their parent folder sits under sub-folders containing disallowed files.

## What gets indexed

For every enabled folder (and every file type present in the allowlist), Obsidian treats every descendant as normal vault content:

- **File explorer**: folders and files appear under their real names (leading dot preserved).
- **Quick Switcher / Search**: hidden files are searchable by name and content.
- **Metadata cache**: frontmatter, headings, tags, and links are parsed.
- **Graph view / backlinks**: links to and from hidden files are resolved.
- **Bases**: `.base` files can query hidden files like any other note (see the Bases docs tips below).
- **Community plugins**: plugins that use `app.vault.getMarkdownFiles()` or `app.metadataCache.getFileCache()` automatically see the new files.

## Disabling a folder

Turning a folder off:

- Stops all fs watchers for that folder.
- Removes every descendant from the Obsidian vault cache.
- Does **not** delete anything on disk.

Re-enabling the folder re-injects everything.

## Uninstalling the plugin

Disabling the plugin triggers the same cleanup automatically — every injected entry is removed from the vault cache and the adapter is restored to its original behaviour. Uninstall is a no-op beyond that.
