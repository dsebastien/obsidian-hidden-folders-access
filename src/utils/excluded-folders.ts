/**
 * Normalize raw user input into a clean list of folder names.
 *
 * Accepts comma and/or newline-separated input (folder names can contain
 * spaces); trims, strips surrounding slashes, and removes duplicates while
 * preserving first-seen order. Names are case-sensitive, like the paths they
 * match.
 *
 *   "node_modules, .git\n/.venv/,,node_modules" → ["node_modules", ".git", ".venv"]
 */
export const parseFolderNames = (raw: string): string[] => {
    const seen = new Set<string>()
    const result: string[] = []
    for (const token of raw.split(/[,\n]+/)) {
        const normalized = token.trim().replace(/^\/+|\/+$/g, '')
        if (!normalized || normalized.includes('/')) continue
        if (seen.has(normalized)) continue
        seen.add(normalized)
        result.push(normalized)
    }
    return result
}

/**
 * Returns true when a folder BELOW the enabled root of `path` has an excluded
 * name. The root segment itself (e.g. ".claude") never counts, so excluding a
 * name can't switch off a folder the user enabled explicitly.
 *
 *   isInExcludedFolder(".claude/skills/x/node_modules/a/README.md", {"node_modules"}) → true
 *   isInExcludedFolder(".claude/node_modules", {"node_modules"}) → true
 *   isInExcludedFolder(".git/HEAD", {".git"}) → false
 */
export const isInExcludedFolder = (path: string, excluded: ReadonlySet<string>): boolean => {
    if (excluded.size === 0) return false
    const segments = path.split('/')
    // The last segment may be a file or a folder: a folder named like an
    // excluded one is skipped too, so its subtree is never listed.
    for (let i = 1; i < segments.length; i++) {
        const segment = segments[i]
        if (segment !== undefined && excluded.has(segment)) return true
    }
    return false
}
