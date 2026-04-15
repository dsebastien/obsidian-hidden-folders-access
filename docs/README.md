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

## Install

The plugin is not yet in the community catalog. Two options:

- **Via BRAT (recommended)** — install [Obsidian42 - BRAT](https://github.com/TfTHacker/obsidian42-brat) from the community catalog, run **BRAT: Add a beta plugin for testing**, and paste `https://github.com/dsebastien/obsidian-hidden-folders-access`. BRAT keeps the plugin up to date automatically.
- **Manual** — download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/dsebastien/obsidian-hidden-folders-access/releases) and copy them into `<Vault>/.obsidian/plugins/hidden-folders-access/`.

Then enable **Hidden Folders Access** in **Settings → Community plugins**.

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
