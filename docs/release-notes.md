# Release Notes

## 2.0.0 (2026-08-29)

### ⚠ BREAKING CHANGES

- **plugin:** minAppVersion is now 1.13.0 (was 1.8.7). The settings pane
  uses the declarative settings API introduced in Obsidian 1.13.

* getSettingDefinitions() replaces display(). The filesystem-discovered
  folder list is cached on the tab (the scan is async while the definitions
  are sync): a missing cache renders a scanning row, starts the scan, and
  update() re-renders when it lands. Each discovered folder is a toggle
  behind a folder:<name> control key — searchable, and a failed write rolls
  the toggle back.
* Persistence stays in the domain methods (updateEnabledFolders,
  updateAllowedExtensions), now routed through the serialized
  persist-then-commit updateSettings; their background indexing side effects
  (sync, rebuild, indexer filter) run strictly AFTER the write lands, so a
  failed persist can no longer rebuild the index against a filter that was
  never stored.
* The extensions editor keeps its draft-plus-Save semantics (applying the
  list triggers a full background rebuild — never per keystroke), gains an
  in-flight guard, and reports a failed persist instead of a false success
  notice.
* Info rows carry a no-op render hook — the framework skips a definition
  with neither control nor render.
* Support block via an unlayered .setting-item.hf-settings-embed rule.
* Tests: settings-guard.spec.ts + settings-write.spec.ts (10 behavioral
  tests; mutation-checked against an optimistic commit, an unserialized
  chain, and side-effects-before-commit — 4/1/3 tests fail respectively).
* README states the 1.13 requirement; AGENTS.md gains the
  declarative-settings section with the repo-specific shapes.

### Features

- **plugin:** declare the settings tab (Obsidian 1.13 declarative settings)
- **plugin:** show what's new in a tab instead of a modal dialog
- **plugin:** surface support CTAs everywhere users can see them

### Bug Fixes

- **build:** align with the catalog reviewer's archive, ruleset and audit
- **plugin:** harden after adversarial review
- **release:** dispatch the workflow at the pushed branch

## 1.3.0 (2026-07-29)

### Features

- **plugin:** aggregate what's new dialogs across simultaneously updated plugins

## 1.2.0 (2026-07-29)

### Features

- **plugin:** add Knowii community to the what's new dialog and harden it

## 1.1.0 (2026-07-27)

### Features

- **plugin:** show a what's new dialog once after plugin updates

## 1.0.4 (2026-07-17)

## 1.0.3 (2026-05-14)

## 1.0.2 (2026-05-13)

## 1.0.1 (2026-05-13)

## 1.0.0 (2026-05-13)

## 0.2.0 (2026-04-22)

### Features

- **all:** indexing does not fail anymore when a configured folder does not exist

## 0.1.0 (2026-04-15)

### Features

- **all:** added explicit save buttons for the settings
- **all:** added extension filtering

## 0.1.0 (2026-04-15)

Initial release. See [docs/release-notes.md](./docs/release-notes.md) for details.
