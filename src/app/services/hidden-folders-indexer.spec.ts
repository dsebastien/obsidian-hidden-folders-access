import { beforeEach, describe, expect, test } from 'bun:test'
import type { App } from 'obsidian'
import { HiddenFoldersIndexer } from './hidden-folders-indexer'

interface FakeAdapter {
    list: (path: string) => Promise<{ files: string[]; folders: string[] }>
}

interface FakeApp {
    vault: {
        adapter: FakeAdapter
        configDir: string
        getAllLoadedFiles: () => []
    }
}

const DEFAULT_CONFIG_DIR = `.${'obsidian'}`

const makeApp = (folders: string[], configDir = DEFAULT_CONFIG_DIR): FakeApp => ({
    vault: {
        adapter: {
            list: () => Promise.resolve({ files: [], folders })
        },
        configDir,
        getAllLoadedFiles: () => []
    }
})

describe('HiddenFoldersIndexer', () => {
    let indexer: HiddenFoldersIndexer

    beforeEach(() => {
        indexer = new HiddenFoldersIndexer(makeApp([]) as unknown as App)
    })

    describe('excluded folders', () => {
        test('is empty by default (nothing skipped)', () => {
            expect(indexer.getExcludedFolders()).toEqual([])
        })

        test('setExcludedFolders trims, drops empty entries and replaces the list', () => {
            indexer.setExcludedFolders([' node_modules ', '', '.git'])
            expect(indexer.getExcludedFolders()).toEqual(['.git', 'node_modules'])
            indexer.setExcludedFolders(['dist'])
            expect(indexer.getExcludedFolders()).toEqual(['dist'])
        })
    })

    describe('extension allowlist', () => {
        test('is empty by default (no filtering)', () => {
            expect(indexer.getAllowedExtensions()).toEqual([])
        })

        test('setAllowedExtensions normalizes input', () => {
            indexer.setAllowedExtensions(['.MD', 'Canvas ', '  base', '.PDF'])
            expect(indexer.getAllowedExtensions()).toEqual(['base', 'canvas', 'md', 'pdf'])
        })

        test('setAllowedExtensions drops empty entries', () => {
            indexer.setAllowedExtensions(['md', '', '  ', '.'])
            expect(indexer.getAllowedExtensions()).toEqual(['md'])
        })

        test('setAllowedExtensions deduplicates', () => {
            indexer.setAllowedExtensions(['md', 'MD', '.md', 'canvas'])
            expect(indexer.getAllowedExtensions()).toEqual(['canvas', 'md'])
        })

        test('setAllowedExtensions can be called multiple times and replaces the list', () => {
            indexer.setAllowedExtensions(['md'])
            indexer.setAllowedExtensions(['canvas', 'base'])
            expect(indexer.getAllowedExtensions()).toEqual(['base', 'canvas'])
        })
    })

    describe('enabled prefixes', () => {
        test('starts empty', () => {
            expect(indexer.getEnabledPrefixes()).toEqual([])
        })

        test('isBusy returns false for any path when idle', () => {
            expect(indexer.isBusy('.claude')).toBe(false)
            expect(indexer.isBusy('.github')).toBe(false)
        })
    })

    describe('enablePath with missing folder', () => {
        test('resolves silently without throwing', async () => {
            const app = makeApp(['/.claude']) as unknown as App
            const idx = new HiddenFoldersIndexer(app)
            await idx.enablePath('.missing')
            expect(idx.getEnabledPrefixes()).toEqual([])
        })

        test('does not patch the adapter when the folder is missing', async () => {
            const app = makeApp([]) as unknown as App
            const idx = new HiddenFoldersIndexer(app)
            await idx.enablePath('.missing')
            const adapter = app.vault.adapter as unknown as { listRecursiveChild?: unknown }
            expect(adapter.listRecursiveChild).toBeUndefined()
        })

        test('is idempotent when called repeatedly for a missing folder', async () => {
            const app = makeApp([]) as unknown as App
            const idx = new HiddenFoldersIndexer(app)
            await idx.enablePath('.missing')
            await idx.enablePath('.missing')
            expect(idx.getEnabledPrefixes()).toEqual([])
        })
    })

    describe('pathExistsOnDisk', () => {
        test('returns true when the folder is at the vault root', async () => {
            const app = makeApp(['/.claude', '/.github']) as unknown as App
            const idx = new HiddenFoldersIndexer(app)
            expect(await idx.pathExistsOnDisk('.claude')).toBe(true)
            expect(await idx.pathExistsOnDisk('/.claude')).toBe(true)
        })

        test('returns false when the folder is not on disk', async () => {
            const app = makeApp(['/.claude']) as unknown as App
            const idx = new HiddenFoldersIndexer(app)
            expect(await idx.pathExistsOnDisk('.missing')).toBe(false)
        })

        test('returns false for an empty path', async () => {
            const app = makeApp(['/.claude']) as unknown as App
            const idx = new HiddenFoldersIndexer(app)
            expect(await idx.pathExistsOnDisk('')).toBe(false)
            expect(await idx.pathExistsOnDisk('/')).toBe(false)
        })
    })

    describe('listHiddenRootFolders', () => {
        test('returns only folders that start with a dot', async () => {
            const app = makeApp(['/.claude', '/.github', '/Projects', '/Archive']) as unknown as App
            const idx = new HiddenFoldersIndexer(app)
            expect(await idx.listHiddenRootFolders()).toEqual(['.claude', '.github'])
        })

        test('excludes the Obsidian config directory', async () => {
            const app = makeApp([
                '/.claude',
                `/${DEFAULT_CONFIG_DIR}`,
                '/.github'
            ]) as unknown as App
            const idx = new HiddenFoldersIndexer(app)
            expect(await idx.listHiddenRootFolders()).toEqual(['.claude', '.github'])
        })

        test('returns entries sorted alphabetically', async () => {
            const app = makeApp(['/.zeta', '/.alpha', '/.mu']) as unknown as App
            const idx = new HiddenFoldersIndexer(app)
            expect(await idx.listHiddenRootFolders()).toEqual(['.alpha', '.mu', '.zeta'])
        })

        test('normalises leading slashes in folder names', async () => {
            const app = makeApp(['///.claude', '.github']) as unknown as App
            const idx = new HiddenFoldersIndexer(app)
            expect(await idx.listHiddenRootFolders()).toEqual(['.claude', '.github'])
        })

        test('honours a custom configDir', async () => {
            const app = makeApp(['/.claude', '/.custom-config'], '.custom-config') as unknown as App
            const idx = new HiddenFoldersIndexer(app)
            expect(await idx.listHiddenRootFolders()).toEqual(['.claude'])
        })
    })
})

describe('HiddenFoldersIndexer metadata snapshot', () => {
    interface Entry {
        mtime: number
        size: number
        hash: string
    }

    /**
     * Fake app whose adapter "injects" `onDisk` files when the folder is
     * reconciled, the way Obsidian's cascade does.
     */
    const makeIndexingApp = (onDisk: string[], cachedHashes: string[]) => {
        const vaultFiles = new Set<string>()
        const metadataCache = {
            initialized: true,
            fileCache: {} as Record<string, Entry>,
            metadataCache: Object.fromEntries(cachedHashes.map((h) => [h, {}])) as Record<
                string,
                unknown
            >
        }
        const adapter = {
            list: () => Promise.resolve({ files: [], folders: ['/.claude'] }),
            listRecursiveChild: () => Promise.resolve(),
            reconcileFile: () => Promise.resolve(),
            reconcileFolderCreation: (path: string) => {
                // Obsidian looks up the file cache while it injects each file.
                seenAtInjection = onDisk.map((p) => [p, metadataCache.fileCache[p]?.hash ?? null])
                for (const p of onDisk) if (p.startsWith(`${path}/`)) vaultFiles.add(p)
                return Promise.resolve()
            },
            watchHiddenRecursive: () => Promise.resolve(),
            watchers: {}
        }
        let seenAtInjection: [string, string | null][] = []
        const app = {
            vault: {
                adapter,
                configDir: DEFAULT_CONFIG_DIR,
                getAllLoadedFiles: () => [],
                getAbstractFileByPath: (p: string) => (vaultFiles.has(p) ? { path: p } : null)
            },
            metadataCache
        }
        return { app, metadataCache, injectedHashes: () => seenAtInjection }
    }

    const snapshotOf = (entries: [string, number, number, string][]) => ({ version: 1, entries })

    test('restored entries are in place when the files are injected', async () => {
        const { app, injectedHashes } = makeIndexingApp(['.claude/a.md', '.claude/b.md'], ['ha'])
        const idx = new HiddenFoldersIndexer(app as unknown as App)
        idx.loadMetadataSnapshot(
            snapshotOf([
                ['.claude/a.md', 1, 1, 'ha'],
                ['.claude/b.md', 1, 1, 'purged']
            ])
        )

        expect(idx.restoreMetadata(['.claude'])).toBe(1)
        await idx.enablePath('.claude')

        expect(injectedHashes()).toEqual([
            ['.claude/a.md', 'ha'],
            ['.claude/b.md', null]
        ])
    })

    test('entries of files that were not injected are pruned after enable', async () => {
        const { app, metadataCache } = makeIndexingApp(['.claude/a.md'], ['ha', 'hgone'])
        const idx = new HiddenFoldersIndexer(app as unknown as App)
        idx.loadMetadataSnapshot(
            snapshotOf([
                ['.claude/a.md', 1, 1, 'ha'],
                ['.claude/deleted.md', 1, 1, 'hgone']
            ])
        )
        idx.restoreMetadata(['.claude'])
        expect(metadataCache.fileCache['.claude/deleted.md']).toBeDefined()

        await idx.enablePath('.claude')

        expect(metadataCache.fileCache['.claude/a.md']).toBeDefined()
        expect(metadataCache.fileCache['.claude/deleted.md']).toBeUndefined()
    })

    test('restores nothing before the metadata cache is initialized', () => {
        const { app, metadataCache } = makeIndexingApp([], ['ha'])
        metadataCache.initialized = false
        const idx = new HiddenFoldersIndexer(app as unknown as App)
        idx.loadMetadataSnapshot(snapshotOf([['.claude/a.md', 1, 1, 'ha']]))
        expect(idx.restoreMetadata(['.claude'])).toBe(0)
    })

    test('capture reads live folders and keeps the saved entries of the others', async () => {
        const { app, metadataCache } = makeIndexingApp(['.claude/a.md'], [])
        const idx = new HiddenFoldersIndexer(app as unknown as App)
        idx.loadMetadataSnapshot(
            snapshotOf([
                ['.claude/old.md', 1, 1, 'hold'],
                ['.agents/x.md', 1, 1, 'hx'],
                ['.unconfigured/y.md', 1, 1, 'hy']
            ])
        )
        await idx.enablePath('.claude')
        metadataCache.fileCache['.claude/a.md'] = { mtime: 5, size: 6, hash: 'ha' }
        metadataCache.fileCache['Notes/n.md'] = { mtime: 1, size: 1, hash: 'hn' }

        const snapshot = idx.captureMetadataSnapshot(['.claude', '.agents'])

        expect(snapshot?.entries).toEqual([
            ['.agents/x.md', 1, 1, 'hx'],
            ['.claude/a.md', 5, 6, 'ha']
        ])
    })

    test('capture returns null when the metadata cache internals are missing', () => {
        const idx = new HiddenFoldersIndexer(makeApp([]) as unknown as App)
        expect(idx.captureMetadataSnapshot(['.claude'])).toBeNull()
    })

    test('isIndexedPath is true only below enabled folders', async () => {
        const { app } = makeIndexingApp([], [])
        const idx = new HiddenFoldersIndexer(app as unknown as App)
        expect(idx.isIndexedPath('.claude/a.md')).toBe(false)
        await idx.enablePath('.claude')
        expect(idx.isIndexedPath('.claude/a.md')).toBe(true)
        expect(idx.isIndexedPath('.claudette/a.md')).toBe(false)
    })
})
