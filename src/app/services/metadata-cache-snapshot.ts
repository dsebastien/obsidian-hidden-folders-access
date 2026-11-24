/**
 * Keeps the metadata of indexed hidden files warm across Obsidian restarts.
 *
 * Why: at startup, `MetadataCache.initialize()` drops the file-cache entry of
 * every path its vault scan did not find. The scan skips dot-folders, so each
 * restart forgets the entries of every hidden file. When the plugin injects
 * the files again, Obsidian treats each one as new: it reads and hashes the
 * file, re-parses it in the worker when the parsed metadata was purged too,
 * writes both caches to IndexedDB, and fires `changed`. On a large hidden
 * folder this keeps the main thread busy for minutes.
 *
 * The parsed metadata itself is stored under the content hash, and Obsidian
 * only purges it in `cleanupDeletedCache()` (first run 60 s after startup,
 * then every 10 minutes) when no file-cache entry refers to that hash. So the
 * plugin keeps its own copy of the `{ mtime, size, hash }` entries and puts
 * them back early in `onload`, before the purge and before the files are
 * injected. Obsidian then takes the same path as for any unchanged vault file
 * at startup: mtime and size match, the hash is known, so the file only goes
 * through link resolution (`resolve` / `resolved` events, no `changed`).
 *
 * Everything here touches undocumented internals. Every function degrades to
 * a no-op when the expected shape is missing.
 */

export interface FileCacheEntry {
    mtime: number
    size: number
    hash: string
}

/**
 * Undocumented internals of `app.metadataCache` that we rely on.
 */
export interface InternalMetadataCache {
    fileCache: Record<string, FileCacheEntry>
    metadataCache: Record<string, unknown>
    initialized?: boolean
}

/** One persisted entry: [path, mtime, size, hash]. Compact on purpose. */
export type SnapshotEntry = [string, number, number, string]

export interface MetadataSnapshot {
    version: 1
    entries: SnapshotEntry[]
}

export const SNAPSHOT_VERSION = 1

const isFiniteNumber = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value)

const isValidEntry = (value: unknown): value is SnapshotEntry =>
    Array.isArray(value) &&
    value.length === 4 &&
    typeof value[0] === 'string' &&
    value[0].length > 0 &&
    isFiniteNumber(value[1]) &&
    isFiniteNumber(value[2]) &&
    typeof value[3] === 'string' &&
    value[3].length > 0

/**
 * True when `cache` has the internal shape we need. Guards against Obsidian
 * renaming its internals.
 */
export const isUsableMetadataCache = (cache: unknown): cache is InternalMetadataCache => {
    if (typeof cache !== 'object' || cache === null) return false
    const c = cache as Partial<InternalMetadataCache>
    return (
        typeof c.fileCache === 'object' &&
        c.fileCache !== null &&
        typeof c.metadataCache === 'object' &&
        c.metadataCache !== null
    )
}

/**
 * Parse a persisted snapshot into a path → entry map. Invalid input, an
 * unknown version and malformed entries are dropped, never thrown.
 */
export const parseSnapshot = (raw: unknown): Map<string, FileCacheEntry> => {
    const result = new Map<string, FileCacheEntry>()
    if (typeof raw !== 'object' || raw === null) return result
    const snapshot = raw as Partial<MetadataSnapshot>
    if (snapshot.version !== SNAPSHOT_VERSION || !Array.isArray(snapshot.entries)) return result
    for (const entry of snapshot.entries as unknown[]) {
        if (!isValidEntry(entry)) continue
        const [path, mtime, size, hash] = entry
        result.set(path, { mtime, size, hash })
    }
    return result
}

/**
 * Build the persisted form of `entries`, sorted by path so that the stored
 * value is stable.
 */
export const serializeSnapshot = (
    entries: ReadonlyMap<string, FileCacheEntry>
): MetadataSnapshot => ({
    version: SNAPSHOT_VERSION,
    entries: Array.from(entries.entries())
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([path, e]): SnapshotEntry => [path, e.mtime, e.size, e.hash])
})

/**
 * Copy the file-cache entries that `include` accepts. Only entries with a
 * content hash are kept: non-markdown files have an empty hash, and Obsidian
 * handles them without parsing, so restoring them gains nothing.
 */
export const collectEntries = (
    cache: InternalMetadataCache,
    include: (path: string) => boolean
): Map<string, FileCacheEntry> => {
    const result = new Map<string, FileCacheEntry>()
    for (const path of Object.keys(cache.fileCache)) {
        if (!include(path)) continue
        const entry = cache.fileCache[path]
        if (!entry || !entry.hash) continue
        result.set(path, { mtime: entry.mtime, size: entry.size, hash: entry.hash })
    }
    return result
}

/**
 * Put saved entries back into the in-memory file cache.
 *
 * An entry is restored only when `include` accepts its path, the path has no
 * entry yet (a live entry always wins), and the parsed metadata for its hash
 * is still in memory (otherwise Obsidian would re-parse anyway).
 *
 * The entries are not written to IndexedDB: Obsidian drops them again at the
 * next startup, and the plugin keeps its own copy.
 *
 * Returns the restored entry objects by path, so that the caller can later
 * remove the ones that no file claimed (see `pruneUnclaimed`).
 */
export const restoreEntries = (
    cache: InternalMetadataCache,
    saved: ReadonlyMap<string, FileCacheEntry>,
    include: (path: string) => boolean
): Map<string, FileCacheEntry> => {
    const restored = new Map<string, FileCacheEntry>()
    for (const [path, entry] of saved) {
        if (!include(path)) continue
        if (Object.hasOwn(cache.fileCache, path)) continue
        if (!Object.hasOwn(cache.metadataCache, entry.hash)) continue
        const copy: FileCacheEntry = { mtime: entry.mtime, size: entry.size, hash: entry.hash }
        cache.fileCache[path] = copy
        restored.set(path, copy)
    }
    return restored
}

/**
 * Remove restored entries whose file was not injected (deleted on disk, or
 * now filtered out by the extension or excluded-folder settings). An entry is
 * only removed while it is still the exact object that was restored: once
 * Obsidian has updated it for a real file, it is left alone.
 *
 * Returns the number of removed entries.
 */
export const pruneUnclaimed = (
    cache: InternalMetadataCache,
    restored: ReadonlyMap<string, FileCacheEntry>,
    fileExists: (path: string) => boolean
): number => {
    let removed = 0
    for (const [path, entry] of restored) {
        if (fileExists(path)) continue
        if (cache.fileCache[path] !== entry) continue
        delete cache.fileCache[path]
        removed++
    }
    return removed
}
