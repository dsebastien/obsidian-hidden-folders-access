import { describe, expect, test, mock } from 'bun:test'
import { produce } from 'immer'
import { HiddenFoldersAccessPlugin } from '../plugin'
import { HiddenFoldersAccessSettingsTab } from './settings-tab'
import { DEFAULT_SETTINGS } from '../types/plugin-settings.intf'

/**
 * Behavioral coverage for the settings write path.
 *
 * `settings-guard.spec.ts` only scans source text, and nothing in CI renders a
 * settings pane. These tests exercise the properties no UI test can reach:
 * writes are serialized, memory is committed only after persistence succeeds,
 * and the background indexing side effects fire only after a successful
 * commit.
 */

async function expectRejection(promise: Promise<unknown>, contains: string): Promise<void> {
    let caught: unknown
    await promise.catch((error: unknown) => {
        caught = error
    })
    expect(caught).toBeInstanceOf(Error)
    expect((caught as Error).message).toContain(contains)
}

interface Harness {
    plugin: HiddenFoldersAccessPlugin
    tab: HiddenFoldersAccessSettingsTab
    saveData: ReturnType<typeof mock>
    runBackgroundSync: ReturnType<typeof mock>
    runBackgroundRebuild: ReturnType<typeof mock>
    setAllowedExtensions: ReturnType<typeof mock>
}

function createHarness(options?: { saveData?: () => Promise<void> }): Harness {
    const saveData = mock(async () => {
        if (options?.saveData) {
            await options.saveData()
        }
    })
    const runBackgroundSync = mock(() => {})
    const runBackgroundRebuild = mock(() => {})
    const setAllowedExtensions = mock(() => {})

    const plugin = Object.create(HiddenFoldersAccessPlugin.prototype) as HiddenFoldersAccessPlugin
    const internals = plugin as unknown as Record<string, unknown>
    internals['settings'] = produce(DEFAULT_SETTINGS, () => DEFAULT_SETTINGS)
    internals['settingsWriteChain'] = Promise.resolve()
    internals['saveData'] = saveData
    internals['runBackgroundSync'] = runBackgroundSync
    internals['runBackgroundRebuild'] = runBackgroundRebuild
    internals['indexer'] = { setAllowedExtensions }

    const tab = Object.create(
        HiddenFoldersAccessSettingsTab.prototype
    ) as HiddenFoldersAccessSettingsTab
    const tabInternals = tab as unknown as Record<string, unknown>
    tabInternals['plugin'] = plugin
    tabInternals['update'] = () => {}

    return { plugin, tab, saveData, runBackgroundSync, runBackgroundRebuild, setAllowedExtensions }
}

describe('updateSettings', () => {
    test('commits to memory only after the write is persisted', async () => {
        let release = (): void => {}
        const gate = new Promise<void>((resolve) => {
            release = resolve
        })
        const { plugin, saveData } = createHarness({ saveData: () => gate })

        const pending = plugin.updateSettings((draft) => {
            draft.enabledFolders = ['.claude']
        })

        // Let the queued write start and reach its save await; a bare
        // synchronous assertion would pass even with the ordering reversed,
        // because the chain defers the work to a microtask.
        await Promise.resolve()
        await Promise.resolve()
        expect(saveData).toHaveBeenCalledTimes(1)
        expect(plugin.settings.enabledFolders).toEqual(DEFAULT_SETTINGS.enabledFolders)

        release()
        await pending
        expect(plugin.settings.enabledFolders).toEqual(['.claude'])
    })

    test('leaves memory untouched when persistence fails', async () => {
        const { plugin } = createHarness({
            saveData: () => Promise.reject(new Error('disk full'))
        })

        await expectRejection(
            plugin.updateSettings((draft) => {
                draft.enabledFolders = ['.claude']
            }),
            'disk full'
        )

        expect(plugin.settings.enabledFolders).toEqual(DEFAULT_SETTINGS.enabledFolders)
    })

    test('overlapping writes do not drop each other', async () => {
        let releaseFirst = (): void => {}
        const first = new Promise<void>((resolve) => {
            releaseFirst = resolve
        })
        let call = 0
        const { plugin } = createHarness({
            saveData: () => {
                call += 1
                return call === 1 ? first : Promise.resolve()
            }
        })

        const a = plugin.updateSettings((draft) => {
            draft.enabledFolders = ['.claude']
        })
        const b = plugin.updateSettings((draft) => {
            draft.allowedExtensions = ['md']
        })

        releaseFirst()
        await Promise.all([a, b])

        expect(plugin.settings.enabledFolders).toEqual(['.claude'])
        expect(plugin.settings.allowedExtensions).toEqual(['md'])
    })
})

describe('domain methods', () => {
    test('updateEnabledFolders dedupes, sorts, and syncs only after the write lands', async () => {
        let release = (): void => {}
        const gate = new Promise<void>((resolve) => {
            release = resolve
        })
        const { plugin, runBackgroundSync } = createHarness({ saveData: () => gate })

        const pending = plugin.updateEnabledFolders(['.obsidian-x', '.claude', '.claude'])

        await Promise.resolve()
        await Promise.resolve()
        expect(runBackgroundSync).not.toHaveBeenCalled()

        release()
        await pending
        expect(plugin.settings.enabledFolders).toEqual(['.claude', '.obsidian-x'])
        expect(runBackgroundSync).toHaveBeenCalledTimes(1)
        expect(runBackgroundSync).toHaveBeenCalledWith(['.claude', '.obsidian-x'])
    })

    test('a failed folder write spawns no background sync', async () => {
        const { plugin, runBackgroundSync } = createHarness({
            saveData: () => Promise.reject(new Error('disk full'))
        })

        await expectRejection(plugin.updateEnabledFolders(['.claude']), 'disk full')

        expect(plugin.settings.enabledFolders).toEqual(DEFAULT_SETTINGS.enabledFolders)
        expect(runBackgroundSync).not.toHaveBeenCalled()
    })

    test('updateAllowedExtensions normalizes and rebuilds only after the write lands', async () => {
        const { plugin, runBackgroundRebuild, setAllowedExtensions } = createHarness()

        await plugin.updateAllowedExtensions(['.MD', ' md', 'Canvas', ''])

        expect(plugin.settings.allowedExtensions).toEqual(['canvas', 'md'])
        expect(setAllowedExtensions).toHaveBeenCalledWith(['canvas', 'md'])
        expect(runBackgroundRebuild).toHaveBeenCalledTimes(1)
    })

    test('a failed extensions write leaves the indexer filter untouched', async () => {
        const { plugin, runBackgroundRebuild, setAllowedExtensions } = createHarness({
            saveData: () => Promise.reject(new Error('disk full'))
        })

        await expectRejection(plugin.updateAllowedExtensions(['md']), 'disk full')

        expect(plugin.settings.allowedExtensions).toEqual(DEFAULT_SETTINGS.allowedExtensions)
        expect(setAllowedExtensions).not.toHaveBeenCalled()
        expect(runBackgroundRebuild).not.toHaveBeenCalled()
    })
})

describe('setControlValue', () => {
    test('folder toggles compute from committed state and persist through the domain method', async () => {
        const { tab, plugin, runBackgroundSync } = createHarness()

        await tab.setControlValue('folder:.claude', true)
        await tab.setControlValue('folder:.secrets', true)
        await tab.setControlValue('folder:.claude', false)

        expect(plugin.settings.enabledFolders).toEqual(['.secrets'])
        expect(runBackgroundSync).toHaveBeenCalledTimes(3)
        expect(tab.getControlValue('folder:.secrets')).toBe(true)
        expect(tab.getControlValue('folder:.claude')).toBe(false)
    })

    test('two rapid toggles on different folders both survive', async () => {
        // The regression the adversarial review flagged as High: computing
        // the new list at the call site captures a pre-commit snapshot, and
        // the second write silently drops the first folder. The delta is
        // derived INSIDE the mutator instead.
        let releaseFirst = (): void => {}
        const first = new Promise<void>((resolve) => {
            releaseFirst = resolve
        })
        let call = 0
        const { tab, plugin } = createHarness({
            saveData: () => {
                call += 1
                return call === 1 ? first : Promise.resolve()
            }
        })

        const a = tab.setControlValue('folder:.claude', true)
        const b = tab.setControlValue('folder:.github', true)
        releaseFirst()
        await Promise.all([a, b])

        expect(plugin.settings.enabledFolders).toEqual(['.claude', '.github'])
    })

    test('rejects a wrongly typed toggle value and an unknown key without writing', async () => {
        const { tab, saveData } = createHarness()

        await expectRejection(tab.setControlValue('folder:.claude', 'yes'), 'boolean')
        await expectRejection(tab.setControlValue('nope', true), 'known field')
        expect(saveData).not.toHaveBeenCalled()
    })
})
