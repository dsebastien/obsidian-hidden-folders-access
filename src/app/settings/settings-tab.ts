import { Notice, PluginSettingTab } from 'obsidian'
import type { App, ButtonComponent, SettingDefinitionItem, SettingGroupItem } from 'obsidian'
import type { HiddenFoldersAccessPlugin } from '../plugin'
import { DEFAULT_ALLOWED_EXTENSIONS } from '../types/plugin-settings.intf'
import { parseExtensions } from '../../utils/extensions'
import { log } from '../../utils/log'
import { BUY_ME_A_COFFEE_BADGE_DATA_URL } from '../assets/buy-me-a-coffee'
import { renderSupportSection } from '../ui/support-links'

/** Control keys for the per-folder toggles: `folder:` + the folder name. */
const FOLDER_KEY_PREFIX = 'folder:'

/**
 * Settings tab, declared rather than rendered (Obsidian 1.13+).
 *
 * `getSettingDefinitions()` REPLACES `display()`: when it returns a non-empty
 * array, `display()` is never called. There is no partial adoption — the whole
 * settings UI is declarative, or none of it. In exchange, Obsidian owns
 * navigation, focus and ARIA, and every declared `name`/`desc` is indexed by
 * the settings search.
 *
 * Two shapes specific to this pane:
 *
 * - The folder list is DISCOVERED from the filesystem, and the scan is async
 *   while `getSettingDefinitions()` is sync. The scan result is cached on the
 *   tab; a missing cache renders a scanning row and starts the scan, which
 *   calls `update()` when it lands. Each discovered folder becomes a toggle
 *   behind a `folder:<name>` control key, so folders are searchable and the
 *   framework rolls a failed write back.
 * - The extensions editor keeps its draft-plus-Save semantics: applying the
 *   list triggers a full background rebuild of every enabled folder, which
 *   must not fire per keystroke.
 */
export class HiddenFoldersAccessSettingsTab extends PluginSettingTab {
    plugin: HiddenFoldersAccessPlugin

    /** Cached folder scan; null = not scanned yet (or refresh requested). */
    private hiddenFolders: string[] | null = null
    private folderScanFailed = false
    private folderScanRunning = false

    constructor(app: App, plugin: HiddenFoldersAccessPlugin) {
        super(app, plugin)
        this.plugin = plugin
    }

    override getSettingDefinitions(): SettingDefinitionItem[] {
        return [
            {
                type: 'group',
                heading: 'Hidden folders',
                items: [
                    {
                        name: '',
                        desc: 'Select which hidden root-level folders (names starting with a dot) Obsidian should index. Toggling a folder on kicks off indexing in the background — you can close this tab and keep working while it runs. A notification updates live and disappears when the folder is fully indexed. Only folders at the vault root are listed. The Obsidian configuration folder is always excluded.',
                        searchable: false,
                        // The no-op render hook is load-bearing: the framework
                        // skips a definition with neither control nor render.
                        render: (): void => {}
                    },
                    {
                        name: 'Refresh folder list',
                        desc: 'Re-scan the vault root to pick up newly created hidden folders. This does not re-index folders that are already enabled — it only refreshes the list below.',
                        render: (setting): void => {
                            setting.addButton((button) =>
                                button
                                    .setButtonText('Refresh')
                                    .setCta()
                                    .onClick(() => {
                                        this.hiddenFolders = null
                                        this.folderScanFailed = false
                                        this.update()
                                        new Notice('Hidden folder list refreshed')
                                    })
                            )
                        }
                    },
                    ...this.folderDefinitions()
                ]
            },
            {
                type: 'group',
                heading: 'File types',
                items: this.fileTypeDefinitions()
            },
            {
                type: 'group',
                // No heading: renderSupportSection draws its own.
                items: [
                    {
                        name: 'Support',
                        // Not a setting — keep it out of the settings search.
                        searchable: false,
                        render: (setting): void => {
                            setting.infoEl.remove() // the section draws its own headings
                            // `.setting-item` is a flex ROW. The support block
                            // is a stack of full-width rows, so without this it
                            // would lay heading, buttons and badge side by side.
                            setting.settingEl.addClass('hf-settings-embed')
                            renderSupportSection(setting.settingEl, (el) => {
                                this.renderBuyMeACoffeeBadge(el)
                            })
                        }
                    }
                ]
            }
        ]
    }

    // ─── Folder list ───────────────────────────────────────────────────────

    private folderDefinitions(): SettingGroupItem[] {
        if (this.folderScanFailed) {
            return [
                {
                    name: '',
                    desc: 'Failed to list hidden folders. Check the developer console.',
                    searchable: false,
                    render: (): void => {}
                }
            ]
        }
        if (this.hiddenFolders === null) {
            this.ensureFolderScan()
            return [
                {
                    name: '',
                    desc: 'Scanning vault root…',
                    searchable: false,
                    render: (): void => {}
                }
            ]
        }
        if (this.hiddenFolders.length === 0) {
            return [
                {
                    name: '',
                    desc: 'No hidden folders found at the vault root.',
                    searchable: false,
                    render: (): void => {}
                }
            ]
        }
        // Enabled entries that no longer exist on disk are intentionally kept
        // in the config. The indexer silently skips them and the plugin will
        // pick them up again if/when the folder reappears (restart, toggle,
        // rescan command).
        return this.hiddenFolders.map((folder) => ({
            name: folder,
            control: { type: 'toggle' as const, key: `${FOLDER_KEY_PREFIX}${folder}` }
        }))
    }

    /** Starts the async folder scan once; `update()` re-renders when it lands. */
    private ensureFolderScan(): void {
        if (this.folderScanRunning) {
            return
        }
        this.folderScanRunning = true
        void this.plugin.indexer
            .listHiddenRootFolders()
            .then((folders) => {
                this.hiddenFolders = folders
            })
            .catch((err: unknown) => {
                log('Failed to list hidden folders', 'error', err)
                this.folderScanFailed = true
            })
            .finally(() => {
                this.folderScanRunning = false
                this.update()
            })
    }

    // ─── File types ────────────────────────────────────────────────────────

    /**
     * The draft-plus-Save extensions editor. The three rows share draft state
     * through this closure scope; applying the draft triggers a background
     * rebuild, so it must never fire per keystroke.
     */
    private fileTypeDefinitions(): SettingGroupItem[] {
        let pending = this.plugin.settings.allowedExtensions.join(', ')
        let saveButton: ButtonComponent | null = null
        let applyInFlight = false

        // A change is "effective" only when the parsed extension list differs
        // from what's currently persisted — whitespace, casing, duplicates and
        // leading dots in the textarea must not count as dirty, otherwise the
        // button is enabled when the user has changed nothing meaningful.
        const isDirty = (raw: string): boolean => {
            const parsed = parseExtensions(raw).join(',')
            const current = this.plugin.settings.allowedExtensions.join(',')
            return parsed !== current
        }

        const refreshDirty = (): void => {
            saveButton?.setDisabled(applyInFlight || !isDirty(pending))
        }

        return [
            {
                name: '',
                desc: 'Comma-separated list of file extensions (without leading dot) that should be indexed inside enabled hidden folders. Folders are always traversed — this list only filters which files are injected into Obsidian. Defaults cover every format Obsidian supports natively (Markdown, Canvas, Bases, images, PDF, audio, video). Changes are applied when you click Save — this triggers a full rebuild of every enabled folder in the background.',
                searchable: false,
                render: (): void => {}
            },
            {
                name: 'Allowed extensions',
                desc: 'e.g. md, canvas, base, png, pdf',
                render: (setting): void => {
                    setting.addTextArea((textArea) => {
                        textArea
                            .setPlaceholder('md, canvas, base, …')
                            .setValue(pending)
                            .onChange((value) => {
                                pending = value
                                refreshDirty()
                            })
                        textArea.inputEl.rows = 3
                        textArea.inputEl.classList.add('w-full')
                    })
                }
            },
            {
                name: '',
                searchable: false,
                render: (setting): void => {
                    setting.infoEl.remove()
                    setting.addButton((button) => {
                        saveButton = button
                        button
                            .setButtonText('Save')
                            .setCta()
                            .setDisabled(true)
                            .onClick(() => {
                                if (applyInFlight || !isDirty(pending)) return
                                applyInFlight = true
                                refreshDirty()
                                const extensions = parseExtensions(pending)
                                void this.plugin
                                    .updateAllowedExtensions(extensions)
                                    .then(() => {
                                        new Notice(
                                            'Rebuilding enabled folders with the new file-type filter…'
                                        )
                                    })
                                    .catch(() => {
                                        new Notice('Failed to save settings.')
                                    })
                                    .finally(() => {
                                        applyInFlight = false
                                        refreshDirty()
                                    })
                            })
                    })
                    setting.addButton((button) =>
                        button.setButtonText('Reset to defaults').onClick(() => {
                            if (applyInFlight) return
                            applyInFlight = true
                            void this.plugin
                                .updateAllowedExtensions([...DEFAULT_ALLOWED_EXTENSIONS])
                                .then(() => {
                                    new Notice('Allowed extensions reset to defaults. Rebuilding…')
                                    this.update()
                                })
                                .catch(() => {
                                    new Notice('Failed to save settings.')
                                })
                                .finally(() => {
                                    applyInFlight = false
                                })
                        })
                    )
                }
            }
        ]
    }

    // ─── Control values ────────────────────────────────────────────────────

    /**
     * Reads the value behind a control `key`. Only the per-folder toggles are
     * declared controls; everything else is a render row.
     */
    override getControlValue(key: string): unknown {
        if (key.startsWith(FOLDER_KEY_PREFIX)) {
            const folder = key.slice(FOLDER_KEY_PREFIX.length)
            return this.plugin.settings.enabledFolders.includes(folder)
        }
        return undefined
    }

    /**
     * Persists a control edit. Rejecting (not resolving) on failure is what
     * lets the framework roll the toggle back to the stored truth.
     *
     * The new list is computed INSIDE the domain method from the committed
     * state (updateEnabledFolders dedupes and sorts); the background sync it
     * spawns runs only after the write lands.
     */
    override async setControlValue(key: string, value: unknown): Promise<void> {
        if (key.startsWith(FOLDER_KEY_PREFIX)) {
            const folder = key.slice(FOLDER_KEY_PREFIX.length)
            if (typeof value !== 'boolean') {
                throw new Error(`Setting "${key}" expects a boolean.`)
            }
            // Compute from the latest persisted state, not from a snapshot
            // taken when the pane was rendered.
            const current = new Set(this.plugin.settings.enabledFolders)
            if (value) {
                current.add(folder)
            } else {
                current.delete(folder)
            }
            await this.plugin.updateEnabledFolders([...current])
            return
        }
        new Notice('Failed to save settings.')
        throw new Error(`Setting "${key}" does not address a known field.`)
    }

    private renderBuyMeACoffeeBadge(contentEl: HTMLElement | DocumentFragment, width = 175): void {
        const linkEl = contentEl.createEl('a', {
            href: 'https://www.buymeacoffee.com/dsebastien'
        })
        const imgEl = linkEl.createEl('img')
        imgEl.src = BUY_ME_A_COFFEE_BADGE_DATA_URL
        imgEl.alt = 'Buy me a coffee'
        imgEl.width = width
    }
}
