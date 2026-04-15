# Hidden Folders Access

An Obsidian plugin that makes hidden root-level folders (names starting with a dot, e.g. `.claude`, `.github`) fully visible to Obsidian — file explorer, search, graph, metadata cache, and Bases — while keeping their names hidden on disk so external tools (Claude Code, git, editors, etc.) keep working unchanged.

## Why

Obsidian normally ignores any path starting with `.`. That makes sense for `.obsidian/` and friends, but it means useful content stored in dot-folders can't participate in search, the link graph, or Bases. Renaming the folder breaks external tools. Symlinks break Obsidian Sync and cross-platform workflows.

This plugin solves the problem without touching the filesystem: you pick which hidden root folders Obsidian should index, and the plugin injects them into the live vault cache.

## Features

- Per-folder opt-in from the settings tab.
- Full integration: file explorer, Quick Switcher, search, graph, metadata cache, Bases, Dataview, and any plugin that uses the standard vault API.
- Live updates via filesystem watchers (create / modify / rename / delete).
- Clean disable: turning a folder off (or disabling the plugin) removes every injected entry — nothing on disk is touched.
- Desktop-only, cross-platform (Linux / macOS / Windows).

## Install

The plugin is not yet in the community catalog. Pick one of the two options below.

### Recommended: via BRAT

[BRAT](https://github.com/TfTHacker/obsidian42-brat) (Beta Reviewers Auto-update Tool) installs plugins straight from a GitHub repo and keeps them updated.

1. Install **Obsidian42 - BRAT** from **Settings → Community plugins → Browse** and enable it.
2. Open the command palette and run **BRAT: Add a beta plugin for testing**.
3. Paste the repository URL: `https://github.com/dsebastien/obsidian-hidden-folders-access`.
4. Select the latest version (or leave it on "Latest version") and confirm. BRAT downloads and installs the plugin.
5. Enable **Hidden Folders Access** in **Settings → Community plugins**.

BRAT will check for new releases automatically — no more manual updates until the plugin lands in the official catalog.

### Manual

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/dsebastien/obsidian-hidden-folders-access/releases).
2. Copy them into `<Vault>/.obsidian/plugins/hidden-folders-access/`.
3. Reload Obsidian and enable **Hidden Folders Access** in **Settings → Community plugins**.

## Use

1. Open **Settings → Hidden Folders Access**.
2. Toggle on any folder you want Obsidian to index (e.g. `.claude`).
3. The files immediately appear in the file explorer and become queryable from Bases, Dataview, search, etc.

Full user documentation lives in [`docs/`](./docs/README.md).

## How it works

The plugin wraps two undocumented methods on Obsidian's desktop `FileSystemAdapter` (`listRecursiveChild` and `reconcileFile`) so whitelisted hidden paths skip the internal hidden-path filter and flow through `reconcileFileInternal` just like normal files. A fs-watcher is registered for each enabled folder so changes propagate live. On disable, every injected entry is removed and the original methods are restored.

Technical design notes: [`documentation/Architecture.md`](./documentation/Architecture.md) and [`documentation/Domain Model.md`](./documentation/Domain%20Model.md).

## Development

```bash
bun install
bun run dev     # watch build, copies to $OBSIDIAN_VAULT_LOCATION/.obsidian/plugins/hidden-folders-access
bun run tsc:watch
bun run lint
bun test
```

See [`DEVELOPMENT.md`](./DEVELOPMENT.md) for the full workflow.

## Compatibility

- Obsidian 1.4+
- Desktop only (`isDesktopOnly: true`). Mobile Obsidian does not expose the filesystem primitives this plugin relies on.

## License

MIT — see [LICENSE](./LICENSE).

## Support

Created by [Sébastien Dubois](https://dsebastien.net). If this plugin is useful to you, consider [buying me a coffee](https://www.buymeacoffee.com/dsebastien).
