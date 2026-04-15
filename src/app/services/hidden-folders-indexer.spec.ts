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
            list: async () => ({ files: [], folders })
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
