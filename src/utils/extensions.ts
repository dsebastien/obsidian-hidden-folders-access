/**
 * Normalize raw user input into a clean list of file extensions.
 *
 * Accepts comma and/or whitespace-separated input; strips leading dots,
 * trims, lowercases, and removes duplicates while preserving first-seen order.
 *
 *   "md, canvas, .Base,,png  jpg" → ["md", "canvas", "base", "png", "jpg"]
 */
export const parseExtensions = (raw: string): string[] => {
    const seen = new Set<string>()
    const result: string[] = []
    for (const token of raw.split(/[\s,]+/)) {
        const normalized = token.replace(/^\.+/, '').trim().toLowerCase()
        if (!normalized) continue
        if (seen.has(normalized)) continue
        seen.add(normalized)
        result.push(normalized)
    }
    return result
}

/**
 * Returns true when `path` represents a file whose extension is not in the
 * allowlist. Paths without an extension (or hidden-only names like ".claude")
 * always pass through — the caller is expected to combine this with a stat
 * check that confirms file-vs-folder, since folder names can also contain dots.
 */
export const extensionNotAllowed = (path: string, allowed: ReadonlySet<string>): boolean => {
    if (allowed.size === 0) return false
    const name = path.slice(path.lastIndexOf('/') + 1)
    const dot = name.lastIndexOf('.')
    if (dot <= 0) return false
    const ext = name.slice(dot + 1).toLowerCase()
    return !allowed.has(ext)
}
