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

## Installation

### Community plugins (recommended)

1. In Obsidian, go to **Settings → Community plugins**.
2. Disable **Restricted mode** if it's enabled.
3. Select **Browse**, search for **Hidden Folders Access**, install it, then enable it.

You can also browse the catalog on the [Obsidian Community](https://community.obsidian.md/) website.

### Manual installation

If the plugin isn't listed in the community catalog yet (or you want a specific version):

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/dsebastien/obsidian-hidden-folders-access/releases).
2. Copy them into `<Vault>/.obsidian/plugins/hidden-folders-access/`.
3. Reload Obsidian and enable **Hidden Folders Access** in **Settings → Community plugins**.

### BRAT (bleeding edge)

[BRAT](https://github.com/TfTHacker/obsidian42-brat) (Beta Reviewers Auto-update Tool) installs plugins straight from a GitHub repo and keeps them updated automatically. Use this if you want the latest commits — **things might break**.

1. Install **Obsidian42 - BRAT** from **Settings → Community plugins → Browse** and enable it.
2. Run **BRAT: Add a beta plugin for testing** from the command palette.
3. Paste `https://github.com/dsebastien/obsidian-hidden-folders-access`.
4. Select the latest version and confirm.
5. Enable **Hidden Folders Access** in **Settings → Community plugins**.

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

<!-- support-cta -->
## News & support

To stay up to date about this plugin, Obsidian in general, Personal Knowledge Management and note-taking:

- Subscribe to [my newsletter](https://dsebastien.net/newsletter)
- Subscribe to [my YouTube channel](https://youtube.com/@dsebastien)
- Join the [Knowii community](https://www.store.dsebastien.net/product/knowii-community/) and learn to organize your notes and put your knowledge to work, together with fellow knowledge workers

If this plugin is useful to you, here are the best ways to support my work ❤️:

- [Join the Knowii community](https://www.store.dsebastien.net/product/knowii-community/)
- [Become a GitHub Sponsor](https://github.com/sponsors/dsebastien)
- [Buy me a coffee](https://www.buymeacoffee.com/dsebastien)
- [Subscribe to my YouTube channel](https://youtube.com/@dsebastien)
- [Check out my products](https://store.dsebastien.net)

Found a bug or have an idea? [Open an issue](https://github.com/dsebastien/obsidian-hidden-folders-access/issues).
