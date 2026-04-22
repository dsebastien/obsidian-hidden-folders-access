# Business Rules

This document defines the core business rules. These rules MUST be respected in all implementations unless explicitly approved otherwise.

---

## Documentation Guidelines

When a new business rule is mentioned:

1. Add it to this document immediately
2. Use a concise format (single line or brief paragraph)
3. Maintain precision - do not lose important details for brevity
4. Include rationale where it adds clarity

---

## Indexing rules

### Missing configured folders are non-errors

If a folder listed in `settings.enabledFolders` does not exist on disk, the plugin MUST:

- Skip indexing silently — no error notification, no "Indexing…" notice, no warning log.
- Preserve the config entry as-is (do not prune it from `enabledFolders`).
- Re-attempt indexing on every subsequent sync trigger (plugin enable, Obsidian restart, `Rescan hidden folders` command, settings toggle). If the folder reappears, it is indexed then; if not, the plugin stays silent.

Rationale: external workflows (re-cloning `.claude/`, temporary deletion, cross-device config sync) routinely bring dot-folders in and out of existence. Treating "missing" as an error state would spam notifications and erase user configuration.
