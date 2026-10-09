---
title: FAQ
nav_order: 5
---

# FAQ

## Is it safe to use with Obsidian Sync?

Yes. Obsidian Sync never syncs paths starting with `.` (apart from the files it manages inside your config folder, e.g. `.obsidian`). That rule is applied to every upload, download and deletion, whether or not a file is indexed by Obsidian. So:

- Files in the hidden folders you enable are never uploaded to Sync.
- When the plugin removes its entries from Obsidian's index (disabling a folder, disabling or updating the plugin), Sync has nothing to delete remotely.
- The plugin never indexes your config folder, which is the one hidden folder Sync does track.

Some similar plugins warn about Sync data loss. That risk comes from un-hiding the config folder, which this plugin doesn't do.

## Will my hidden folders appear on my other devices?

Not through Obsidian Sync. Each device only sees the hidden folders that exist on its own disk. Use git, Syncthing, or another file-level tool to share them across devices.

## What about other sync plugins?

Third-party sync plugins (Remotely Save, Self-hosted LiveSync, obsidian-git, ...) may react to Obsidian's file events without excluding hidden paths. With those, disabling a folder or the plugin could be treated as a deletion and propagated. This hasn't been verified for each tool: test on a copy first and keep backups.

## Can other plugins change files in my hidden folders?

Yes. Once indexed, these are regular vault files for Obsidian and every plugin:

- Renaming a note can rewrite links inside them (if **Automatically update internal links** is on).
- Formatters, linters, auto-movers and bulk property editors can modify or move them.
- Deleting a file from the file explorer deletes it from disk.

If external tools (Claude Code, git, ...) rely on those files, configure such plugins to ignore the hidden folders.

## Does disabling the plugin delete my files?

No. Disabling a folder or the plugin only removes the entries from Obsidian's index. Nothing on disk is touched.
