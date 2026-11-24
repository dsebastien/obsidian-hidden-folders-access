import { describe, expect, test } from 'bun:test'
import {
    collectEntries,
    type FileCacheEntry,
    type InternalMetadataCache,
    isUsableMetadataCache,
    parseSnapshot,
    pruneUnclaimed,
    restoreEntries,
    serializeSnapshot,
    SNAPSHOT_VERSION
} from './metadata-cache-snapshot'

const makeCache = (
    fileCache: Record<string, FileCacheEntry> = {},
    hashes: string[] = []
): InternalMetadataCache => ({
    fileCache: { ...fileCache },
    metadataCache: Object.fromEntries(hashes.map((h) => [h, { sections: [] }]))
})

const under =
    (prefix: string) =>
    (path: string): boolean =>
        path === prefix || path.startsWith(`${prefix}/`)

describe('isUsableMetadataCache', () => {
    test('accepts the expected internal shape', () => {
        expect(isUsableMetadataCache(makeCache())).toBe(true)
    })

    test('rejects anything else', () => {
        expect(isUsableMetadataCache(null)).toBe(false)
        expect(isUsableMetadataCache({})).toBe(false)
        expect(isUsableMetadataCache({ fileCache: {} })).toBe(false)
        expect(isUsableMetadataCache({ fileCache: null, metadataCache: {} })).toBe(false)
    })
})

describe('parseSnapshot / serializeSnapshot', () => {
    test('round-trips entries, sorted by path', () => {
        const entries = new Map<string, FileCacheEntry>([
            ['.claude/b.md', { mtime: 2, size: 20, hash: 'hb' }],
            ['.claude/a.md', { mtime: 1, size: 10, hash: 'ha' }]
        ])
        const snapshot = serializeSnapshot(entries)
        expect(snapshot).toEqual({
            version: SNAPSHOT_VERSION,
            entries: [
                ['.claude/a.md', 1, 10, 'ha'],
                ['.claude/b.md', 2, 20, 'hb']
            ]
        })
        expect(parseSnapshot(JSON.parse(JSON.stringify(snapshot)))).toEqual(entries)
    })

    test('returns an empty map for missing or invalid input', () => {
        expect(parseSnapshot(null).size).toBe(0)
        expect(parseSnapshot('oops').size).toBe(0)
        expect(parseSnapshot({ version: 99, entries: [['a.md', 1, 1, 'h']] }).size).toBe(0)
        expect(parseSnapshot({ version: SNAPSHOT_VERSION, entries: 'x' }).size).toBe(0)
    })

    test('drops malformed entries and keeps the valid ones', () => {
        const parsed = parseSnapshot({
            version: SNAPSHOT_VERSION,
            entries: [
                ['.claude/ok.md', 1, 2, 'h'],
                ['', 1, 2, 'h'],
                ['.claude/no-hash.md', 1, 2, ''],
                ['.claude/bad-mtime.md', 'x', 2, 'h'],
                ['.claude/nan.md', Number.NaN, 2, 'h'],
                ['.claude/short.md', 1, 2],
                'not an entry'
            ]
        })
        expect(Array.from(parsed.keys())).toEqual(['.claude/ok.md'])
    })
})

describe('collectEntries', () => {
    test('keeps only included paths with a content hash, as copies', () => {
        const cache = makeCache({
            '.claude/a.md': { mtime: 1, size: 1, hash: 'ha' },
            '.claude/img.png': { mtime: 1, size: 1, hash: '' },
            'Notes/n.md': { mtime: 1, size: 1, hash: 'hn' }
        })
        const collected = collectEntries(cache, under('.claude'))
        expect(Array.from(collected.keys())).toEqual(['.claude/a.md'])
        expect(collected.get('.claude/a.md')).not.toBe(cache.fileCache['.claude/a.md'])
    })
})

describe('restoreEntries', () => {
    const saved = new Map<string, FileCacheEntry>([
        ['.claude/a.md', { mtime: 1, size: 1, hash: 'ha' }],
        ['.claude/purged.md', { mtime: 1, size: 1, hash: 'gone' }],
        ['.claude/live.md', { mtime: 1, size: 1, hash: 'hl' }],
        ['.other/x.md', { mtime: 1, size: 1, hash: 'hx' }]
    ])

    test('restores included entries whose metadata is still cached', () => {
        const live: FileCacheEntry = { mtime: 9, size: 9, hash: 'hl2' }
        const cache = makeCache({ '.claude/live.md': live }, ['ha', 'hl', 'hx'])
        const restored = restoreEntries(cache, saved, under('.claude'))

        expect(Array.from(restored.keys())).toEqual(['.claude/a.md'])
        expect(cache.fileCache['.claude/a.md']).toEqual({ mtime: 1, size: 1, hash: 'ha' })
        // A live entry always wins.
        expect(cache.fileCache['.claude/live.md']).toBe(live)
        // Purged metadata: nothing to gain, not restored.
        expect(cache.fileCache['.claude/purged.md']).toBeUndefined()
        // Not included.
        expect(cache.fileCache['.other/x.md']).toBeUndefined()
    })

    test('does not share objects with the saved map', () => {
        const cache = makeCache({}, ['ha'])
        restoreEntries(cache, saved, under('.claude'))
        expect(cache.fileCache['.claude/a.md']).not.toBe(saved.get('.claude/a.md'))
    })
})

describe('pruneUnclaimed', () => {
    test('removes restored entries of files that do not exist', () => {
        const cache = makeCache({}, ['ha', 'hb'])
        const saved = new Map<string, FileCacheEntry>([
            ['.claude/a.md', { mtime: 1, size: 1, hash: 'ha' }],
            ['.claude/b.md', { mtime: 1, size: 1, hash: 'hb' }]
        ])
        const restored = restoreEntries(cache, saved, under('.claude'))
        const removed = pruneUnclaimed(cache, restored, (p) => p === '.claude/a.md')

        expect(removed).toBe(1)
        expect(cache.fileCache['.claude/a.md']).toBeDefined()
        expect(cache.fileCache['.claude/b.md']).toBeUndefined()
    })

    test('leaves an entry alone once Obsidian replaced it', () => {
        const cache = makeCache({}, ['ha'])
        const saved = new Map<string, FileCacheEntry>([
            ['.claude/a.md', { mtime: 1, size: 1, hash: 'ha' }]
        ])
        const restored = restoreEntries(cache, saved, under('.claude'))
        const replaced: FileCacheEntry = { mtime: 2, size: 2, hash: 'new' }
        cache.fileCache['.claude/a.md'] = replaced

        expect(pruneUnclaimed(cache, restored, () => false)).toBe(0)
        expect(cache.fileCache['.claude/a.md']).toBe(replaced)
    })
})
