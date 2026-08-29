# Changelog

All notable changes to this project will be documented in this file.

## [2.0.0](https://github.com/dsebastien/obsidian-hidden-folders-access/compare/1.3.0...2.0.0) (2026-08-29)

### ⚠ BREAKING CHANGES

* **plugin:** minAppVersion is now 1.13.0 (was 1.8.7). The settings pane
uses the declarative settings API introduced in Obsidian 1.13.

- getSettingDefinitions() replaces display(). The filesystem-discovered
  folder list is cached on the tab (the scan is async while the definitions
  are sync): a missing cache renders a scanning row, starts the scan, and
  update() re-renders when it lands. Each discovered folder is a toggle
  behind a folder:<name> control key — searchable, and a failed write rolls
  the toggle back.
- Persistence stays in the domain methods (updateEnabledFolders,
  updateAllowedExtensions), now routed through the serialized
  persist-then-commit updateSettings; their background indexing side effects
  (sync, rebuild, indexer filter) run strictly AFTER the write lands, so a
  failed persist can no longer rebuild the index against a filter that was
  never stored.
- The extensions editor keeps its draft-plus-Save semantics (applying the
  list triggers a full background rebuild — never per keystroke), gains an
  in-flight guard, and reports a failed persist instead of a false success
  notice.
- Info rows carry a no-op render hook — the framework skips a definition
  with neither control nor render.
- Support block via an unlayered .setting-item.hf-settings-embed rule.
- Tests: settings-guard.spec.ts + settings-write.spec.ts (10 behavioral
  tests; mutation-checked against an optimistic commit, an unserialized
  chain, and side-effects-before-commit — 4/1/3 tests fail respectively).
- README states the 1.13 requirement; AGENTS.md gains the
  declarative-settings section with the repo-specific shapes.

### Features

* **plugin:** declare the settings tab (Obsidian 1.13 declarative settings) ([90835e3](https://github.com/dsebastien/obsidian-hidden-folders-access/commit/90835e3d5d41569d9b74ae5a663cbf83bbfd6f18))
* **plugin:** show what's new in a tab instead of a modal dialog ([e634d56](https://github.com/dsebastien/obsidian-hidden-folders-access/commit/e634d56ba54e6b4c0893e2b4b653119e691cbf60))
* **plugin:** surface support CTAs everywhere users can see them ([deb2d31](https://github.com/dsebastien/obsidian-hidden-folders-access/commit/deb2d31a1616d2f619c59d726a7db25d144ff82c))

### Bug Fixes

* **build:** align with the catalog reviewer's archive, ruleset and audit ([5b3444b](https://github.com/dsebastien/obsidian-hidden-folders-access/commit/5b3444b41fed9123dd37bf63d8196de7eef7921d))
* **plugin:** harden after adversarial review ([15b46ec](https://github.com/dsebastien/obsidian-hidden-folders-access/commit/15b46ecafd5746f23ccacc17d67bd74677059424))
* **release:** dispatch the workflow at the pushed branch ([6407103](https://github.com/dsebastien/obsidian-hidden-folders-access/commit/6407103ee771252cb98f8d2813bf7b59c6fdbd42))

## [1.3.0](https://github.com/dsebastien/obsidian-hidden-folders-access/compare/1.2.0...1.3.0) (2026-07-29)

### Features

* **plugin:** aggregate what's new dialogs across simultaneously updated plugins ([16ed1e3](https://github.com/dsebastien/obsidian-hidden-folders-access/commit/16ed1e3ef1b1dc6d0966f70feba22542374466f3))

## [1.2.0](https://github.com/dsebastien/obsidian-hidden-folders-access/compare/1.1.0...1.2.0) (2026-07-29)

### Features

* **plugin:** add Knowii community to the what's new dialog and harden it ([3c3362b](https://github.com/dsebastien/obsidian-hidden-folders-access/commit/3c3362be42dfcc5b07ef80a5d343ffef33d7059c))

## [1.1.0](https://github.com/dsebastien/obsidian-hidden-folders-access/compare/1.0.4...1.1.0) (2026-07-27)

### Features

* **plugin:** show a what's new dialog once after plugin updates ([f775b01](https://github.com/dsebastien/obsidian-hidden-folders-access/commit/f775b01f40047cbb51aaf53bc2dbbb3f53d411e0))

## [1.0.4](https://github.com/dsebastien/obsidian-hidden-folders-access/compare/1.0.3...1.0.4) (2026-07-17)

## [1.0.3](https://github.com/dsebastien/obsidian-hidden-folders-access/compare/1.0.2...1.0.3) (2026-05-14)

## [1.0.2](https://github.com/dsebastien/obsidian-hidden-folders-access/compare/1.0.1...1.0.2) (2026-05-13)

## [1.0.1](https://github.com/dsebastien/obsidian-hidden-folders-access/compare/1.0.0...1.0.1) (2026-05-13)

## [1.0.0](https://github.com/dsebastien/obsidian-hidden-folders-access/compare/0.2.0...1.0.0) (2026-05-13)

## [0.2.0](https://github.com/dsebastien/obsidian-hidden-folders-access/compare/0.1.0...0.2.0) (2026-04-22)

### Features

* **all:** indexing does not fail anymore when a configured folder does not exist ([db78f3f](https://github.com/dsebastien/obsidian-hidden-folders-access/commit/db78f3f2253934c3f46819129e839c9fef83c2ce))

## 0.1.0 (2026-04-15)

### Features

* **all:** added explicit save buttons for the settings ([66ecc56](https://github.com/dsebastien/obsidian-hidden-folders-access/commit/66ecc56fc1ad4693fac93b834651f468eacbbe2e))
* **all:** added extension filtering ([05e1e55](https://github.com/dsebastien/obsidian-hidden-folders-access/commit/05e1e55d3c17fccf7c5aacd16ceb19556e15dac4))

## 0.1.0 (2026-04-15)

Initial release. See [docs/release-notes.md](./docs/release-notes.md) for details.











