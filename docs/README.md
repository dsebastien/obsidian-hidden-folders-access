---
title: Overview
nav_order: 1
permalink: /
---

# Hidden Folders Access

Make Obsidian index hidden root-level folders (names starting with a dot, e.g. `.claude`, `.github`) so they show up in the file explorer, the metadata cache, the link graph, and Bases — while keeping the folders hidden on disk so external tools (Claude Code, git, etc.) keep working unchanged.

## Key Features

- Per-folder opt-in: pick exactly which hidden root folders Obsidian should index.
- Full Obsidian integration: hidden files appear in the file explorer, graph view, search, metadata cache, and Bases.
- Live updates: creating, modifying, renaming, or deleting files inside an enabled folder updates Obsidian in real time.
- No on-disk changes: names keep their leading dot, no symlinks, no copies.
- Clean disable: turning a folder off immediately removes its entries from Obsidian.

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

## Quick Start

1. Install and enable the plugin (see above).
2. Open **Settings → Hidden Folders Access**.
3. Toggle on the folders you want Obsidian to index.
4. The files appear in the explorer and become usable from Bases, Dataview, search, etc.

## When to Use It

- You keep AI agent configuration in `.claude/` and want to browse / query it from Obsidian Bases.
- You want to include `.github/`, `.obsidian-templates/`, or other hidden folders in the vault without renaming them.
- You already manage dotted folders with external tools and don't want Obsidian to rename or duplicate them.

## About

Created by [Sébastien Dubois](https://dsebastien.net). Support development via [Buy Me a Coffee](https://www.buymeacoffee.com/dsebastien).

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
