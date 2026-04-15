# Tips and Best Practices

## Common Use Cases

### Browse Claude Code assets in Obsidian

Enable `.claude/` to index every agent, skill, command, and settings file. Combine with **Bases** to build dashboards over your AI-agent configuration:

- Create a base that lists all skills (`.claude/skills/**/SKILL.md`) with their frontmatter.
- Build a base over `.claude/commands/` showing each command's purpose and allowed tools.
- Use backlinks to see where a given skill is referenced from.

### Include project-level docs

Enable `.github/` to pull issue templates, workflows, and contribution guides into Obsidian search and backlinks.

### Share read-only references across vaults

If you symlink or git-submodule a common dotfile folder into every vault, enabling it with this plugin gives each vault the same indexed view without duplicating markdown.

## Working with Bases

Bases query the metadata cache, which this plugin populates. A minimal base over `.claude/skills/`:

```yaml
filters:
    and:
        - file.path.startsWith(".claude/skills/")
        - file.name == "SKILL.md"
views:
    - type: table
      name: Skills
      columns:
          - name
          - description
          - updated
```

Any property visible in the file's frontmatter is available as a column.

## Performance

- The initial scan of a large folder (thousands of files) runs in one shot. Obsidian may stutter for a few seconds while the metadata cache processes the new files. Subsequent startups are cheap — Obsidian re-reads its own cache.
- Disabling a previously-enabled folder with thousands of entries can block the UI briefly while entries are removed. Consider closing unrelated tabs before toggling.

## Troubleshooting

### A folder I expected isn't listed

- The plugin only lists folders at the vault root. Nested dot-folders aren't shown.
- The Obsidian config directory is always excluded.
- Make sure the folder exists on disk. Click **Rescan** in settings.

### Files don't appear after enabling a folder

- Obsidian may still be computing metadata. Wait a few seconds and check the file explorer again.
- Reload the vault (⌘/Ctrl+R) — the plugin re-applies indexing on layout-ready.

### Changes to files aren't picked up live

- The plugin relies on OS file watchers. On network-mounted filesystems watchers can be unreliable; run the **Rescan** command to force a refresh.
- Disable and re-enable the folder to rebuild the watchers.

### I want to remove everything this plugin did

Disable the plugin in **Settings → Community plugins**. Cleanup is automatic: all injected entries are removed and the adapter is restored. No files on disk are touched.
