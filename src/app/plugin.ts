import { Notice, Plugin } from 'obsidian'
import { produce } from 'immer'
import type { Draft } from 'immer'
import { DEFAULT_ALLOWED_EXTENSIONS, DEFAULT_SETTINGS } from './types/plugin-settings.intf'
import type { PluginSettings } from './types/plugin-settings.intf'
import { HiddenFoldersAccessSettingsTab } from './settings/settings-tab'
import { HiddenFoldersIndexer } from './services/hidden-folders-indexer'
import { log } from '../utils/log'

const INDEX_PROGRESS_INTERVAL_MS = 500
const COMPLETION_NOTICE_MS = 4000
const ERROR_NOTICE_MS = 8000

export class HiddenFoldersAccessPlugin extends Plugin {
    settings: PluginSettings = produce(DEFAULT_SETTINGS, () => DEFAULT_SETTINGS)
    indexer: HiddenFoldersIndexer = new HiddenFoldersIndexer(this.app)

    override async onload(): Promise<void> {
        log('Initializing Hidden Folders Access', 'debug')
        await this.loadSettings()

        this.addSettingTab(new HiddenFoldersAccessSettingsTab(this.app, this))

        this.addCommand({
            id: 'rescan-hidden-folders',
            name: 'Rescan hidden folders',
            callback: () => {
                this.runBackgroundSync(this.settings.enabledFolders)
            }
        })

        // Wait until the vault layout is ready so that reconcile* calls
        // don't race with Obsidian's own startup scan.
        this.app.workspace.onLayoutReady(() => {
            this.runBackgroundSync(this.settings.enabledFolders)
        })
    }

    override onunload(): void {
        log('Unloading Hidden Folders Access', 'debug')
        void this.indexer.teardown()
    }

    async loadSettings(): Promise<void> {
        const loaded = (await this.loadData()) as Partial<PluginSettings> | null

        this.settings = produce(DEFAULT_SETTINGS, (draft: Draft<PluginSettings>) => {
            if (loaded && Array.isArray(loaded.enabledFolders)) {
                draft.enabledFolders = loaded.enabledFolders.filter(
                    (entry): entry is string => typeof entry === 'string'
                )
            }
            if (loaded && Array.isArray(loaded.allowedExtensions)) {
                draft.allowedExtensions = loaded.allowedExtensions
                    .filter((entry): entry is string => typeof entry === 'string')
                    .map((e) => e.replace(/^\./, '').trim().toLowerCase())
                    .filter(Boolean)
            } else {
                // Older installs (pre-allowlist) fall back to the defaults.
                draft.allowedExtensions = [...DEFAULT_ALLOWED_EXTENSIONS]
            }
        })

        this.indexer.setAllowedExtensions(this.settings.allowedExtensions)
    }

    async saveSettings(): Promise<void> {
        await this.saveData(this.settings)
    }

    /**
     * Replace the allowed-extension list and re-apply it to every currently
     * enabled folder. Returns once the new list is persisted — the rebuild of
     * each folder runs in the background with its own progress notice.
     */
    async updateAllowedExtensions(extensions: readonly string[]): Promise<void> {
        const normalized = Array.from(
            new Set(
                extensions.map((e) => e.replace(/^\./, '').trim().toLowerCase()).filter(Boolean)
            )
        ).sort()

        this.settings = produce(this.settings, (draft: Draft<PluginSettings>) => {
            draft.allowedExtensions = normalized
        })
        await this.saveSettings()
        this.indexer.setAllowedExtensions(normalized)
        this.runBackgroundRebuild(this.settings.enabledFolders)
    }

    /**
     * Update persisted settings and kick off background indexing.
     * Returns as soon as settings are persisted — the actual indexing/cleanup
     * runs asynchronously with per-folder progress notices.
     */
    async updateEnabledFolders(folders: readonly string[]): Promise<void> {
        const deduped = Array.from(new Set(folders)).sort()
        this.settings = produce(this.settings, (draft: Draft<PluginSettings>) => {
            draft.enabledFolders = deduped
        })
        await this.saveSettings()
        this.runBackgroundSync(deduped)
    }

    /**
     * Diff the current indexer state against `target` and spawn one background
     * task per folder that needs to be enabled or disabled.
     */
    private runBackgroundSync(target: readonly string[]): void {
        const desired = new Set(target)
        const current = new Set(this.indexer.getEnabledPrefixes())

        for (const path of desired) {
            if (!current.has(path) && !this.indexer.isBusy(path)) {
                void this.startEnableTask(path)
            }
        }
        for (const path of current) {
            if (!desired.has(path) && !this.indexer.isBusy(path)) {
                this.startDisableTask(path)
            }
        }
    }

    /**
     * Force a full disable + re-enable for every folder in `target`. Used when
     * a setting (allowlist) changes and the existing injected entries need to
     * be rebuilt under the new filter.
     */
    private runBackgroundRebuild(target: readonly string[]): void {
        for (const path of target) {
            if (this.indexer.isBusy(path)) continue
            void this.startRebuildTask(path)
        }
    }

    private async startRebuildTask(path: string): Promise<void> {
        // Skip silently if the folder is no longer on disk — the config entry
        // is preserved and will be indexed again next time it reappears.
        if (!(await this.indexer.pathExistsOnDisk(path))) {
            log(`Skipping rebuild for missing folder "${path}"`, 'debug')
            return
        }

        const notice = new Notice(`Rebuilding index for ${path}…`, 0)
        const tick = window.setInterval(() => {
            const count = this.countLoaded(path)
            notice.setMessage(`Rebuilding index for ${path}… ${count} entries`)
        }, INDEX_PROGRESS_INTERVAL_MS)

        this.indexer
            .disablePath(path)
            .then(() => this.indexer.enablePath(path))
            .then(() => {
                const count = this.countLoaded(path)
                notice.setMessage(`Indexed ${path} (${count} entries)`)
                window.setTimeout(() => notice.hide(), COMPLETION_NOTICE_MS)
            })
            .catch((err: unknown) => {
                log(`Rebuild failed for "${path}"`, 'error', err)
                const message = err instanceof Error ? err.message : String(err)
                notice.setMessage(`Failed to rebuild ${path}: ${message}`)
                window.setTimeout(() => notice.hide(), ERROR_NOTICE_MS)
            })
            .finally(() => {
                window.clearInterval(tick)
            })
    }

    private async startEnableTask(path: string): Promise<void> {
        // Skip silently if the configured folder is missing on disk. No notice,
        // no error — the config stays as-is and will be picked up on the next
        // sync (restart, toggle, rescan command) when the folder reappears.
        if (!(await this.indexer.pathExistsOnDisk(path))) {
            log(`Skipping indexing for missing folder "${path}"`, 'debug')
            return
        }

        const notice = new Notice(`Indexing ${path}…`, 0)
        const tick = window.setInterval(() => {
            const count = this.countLoaded(path)
            notice.setMessage(`Indexing ${path}… ${count} entries`)
        }, INDEX_PROGRESS_INTERVAL_MS)

        this.indexer
            .enablePath(path)
            .then(() => {
                const count = this.countLoaded(path)
                notice.setMessage(`Indexed ${path} (${count} entries)`)
                window.setTimeout(() => notice.hide(), COMPLETION_NOTICE_MS)
            })
            .catch((err: unknown) => {
                log(`Enable failed for "${path}"`, 'error', err)
                const message = err instanceof Error ? err.message : String(err)
                notice.setMessage(`Failed to index ${path}: ${message}`)
                window.setTimeout(() => notice.hide(), ERROR_NOTICE_MS)
            })
            .finally(() => {
                window.clearInterval(tick)
            })
    }

    private startDisableTask(path: string): void {
        const notice = new Notice(`Removing ${path} from index…`, 0)
        const tick = window.setInterval(() => {
            const remaining = this.countLoaded(path)
            notice.setMessage(`Removing ${path} from index… ${remaining} entries left`)
        }, INDEX_PROGRESS_INTERVAL_MS)

        this.indexer
            .disablePath(path)
            .then(() => {
                notice.setMessage(`Removed ${path} from index`)
                window.setTimeout(() => notice.hide(), COMPLETION_NOTICE_MS)
            })
            .catch((err: unknown) => {
                log(`Disable failed for "${path}"`, 'error', err)
                const message = err instanceof Error ? err.message : String(err)
                notice.setMessage(`Failed to remove ${path}: ${message}`)
                window.setTimeout(() => notice.hide(), ERROR_NOTICE_MS)
            })
            .finally(() => {
                window.clearInterval(tick)
            })
    }

    private countLoaded(prefix: string): number {
        const needle = `${prefix}/`
        return this.app.vault
            .getAllLoadedFiles()
            .filter((f) => f.path === prefix || f.path.startsWith(needle)).length
    }
}
