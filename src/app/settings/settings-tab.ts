import { App, ButtonComponent, Notice, PluginSettingTab, Setting } from 'obsidian'
import type { HiddenFoldersAccessPlugin } from '../plugin'
import { DEFAULT_ALLOWED_EXTENSIONS } from '../types/plugin-settings.intf'
import { parseExtensions } from '../../utils/extensions'
import { log } from '../../utils/log'

export class HiddenFoldersAccessSettingsTab extends PluginSettingTab {
    plugin: HiddenFoldersAccessPlugin

    constructor(app: App, plugin: HiddenFoldersAccessPlugin) {
        super(app, plugin)
        this.plugin = plugin
    }

    override display(): void {
        const { containerEl } = this
        containerEl.empty()

        this.renderIntro(containerEl)
        void this.renderFolderList(containerEl)
        this.renderFileTypes(containerEl)
        this.renderSupportHeader(containerEl)
    }

    private renderIntro(containerEl: HTMLElement): void {
        new Setting(containerEl).setName('Hidden folders').setHeading()

        const desc = containerEl.createDiv()
        desc.createEl('p', {
            text: 'Select which hidden root-level folders (names starting with a dot) Obsidian should index. Toggling a folder on kicks off indexing in the background — you can close this tab and keep working while it runs. A notification updates live and disappears when the folder is fully indexed.'
        })
        desc.createEl('p', {
            text: 'Only folders at the vault root are listed. The Obsidian configuration folder is always excluded.'
        })

        new Setting(containerEl)
            .setName('Refresh folder list')
            .setDesc(
                'Re-scan the vault root to pick up newly created hidden folders. This does not re-index folders that are already enabled — it only refreshes the list below.'
            )
            .addButton((button) =>
                button
                    .setButtonText('Refresh')
                    .setCta()
                    .onClick(() => {
                        this.display()
                        new Notice('Hidden folder list refreshed')
                    })
            )
    }

    private async renderFolderList(containerEl: HTMLElement): Promise<void> {
        const listContainer = containerEl.createDiv()
        const loading = listContainer.createEl('p', { text: 'Scanning vault root…' })

        let hiddenFolders: string[]
        try {
            hiddenFolders = await this.plugin.indexer.listHiddenRootFolders()
        } catch (err) {
            log('Failed to list hidden folders', 'error', err)
            loading.setText('Failed to list hidden folders. Check the developer console.')
            return
        }

        loading.remove()

        if (hiddenFolders.length === 0) {
            listContainer.createEl('p', {
                text: 'No hidden folders found at the vault root.'
            })
            return
        }

        const enabled = new Set(this.plugin.settings.enabledFolders)
        const available = new Set(hiddenFolders)

        // Clean up any enabled entries that no longer exist on disk. Fire-and-
        // forget — the persisted list is corrected and cleanup runs in the
        // background.
        const stale = [...enabled].filter((p) => !available.has(p))
        if (stale.length > 0) {
            void this.plugin.updateEnabledFolders([...enabled].filter((p) => available.has(p)))
        }

        for (const folder of hiddenFolders) {
            new Setting(listContainer).setName(folder).addToggle((toggle) => {
                toggle
                    .setValue(this.plugin.settings.enabledFolders.includes(folder))
                    .onChange((value) => {
                        // Compute the new list from the latest persisted state,
                        // not from a snapshot taken when the tab was rendered.
                        const current = new Set(this.plugin.settings.enabledFolders)
                        if (value) {
                            current.add(folder)
                        } else {
                            current.delete(folder)
                        }
                        // Don't await: settings are saved and the background
                        // task is spawned inside updateEnabledFolders. Blocking
                        // here would freeze the toggle animation.
                        void this.plugin.updateEnabledFolders([...current])
                    })
            })
        }
    }

    private renderFileTypes(containerEl: HTMLElement): void {
        new Setting(containerEl).setName('File types').setHeading()

        const desc = containerEl.createDiv()
        desc.createEl('p', {
            text: 'Comma-separated list of file extensions (without leading dot) that should be indexed inside enabled hidden folders. Folders are always traversed — this list only filters which files are injected into Obsidian. Defaults cover every format Obsidian supports natively (Markdown, Canvas, Bases, images, PDF, audio, video).'
        })
        desc.createEl('p', {
            text: 'Changes are applied when you click Save — this triggers a full rebuild of every enabled folder in the background.'
        })

        let pending = this.plugin.settings.allowedExtensions.join(', ')
        let saveButton: ButtonComponent | null = null

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
            saveButton?.setDisabled(!isDirty(pending))
        }

        new Setting(containerEl)
            .setName('Allowed extensions')
            .setDesc('e.g. md, canvas, base, png, pdf')
            .addTextArea((textArea) => {
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

        new Setting(containerEl)
            .addButton((button) => {
                saveButton = button
                button
                    .setButtonText('Save')
                    .setCta()
                    .setDisabled(true)
                    .onClick(() => {
                        if (!isDirty(pending)) return
                        const extensions = parseExtensions(pending)
                        void this.plugin.updateAllowedExtensions(extensions)
                        new Notice('Rebuilding enabled folders with the new file-type filter…')
                        saveButton?.setDisabled(true)
                    })
            })
            .addButton((button) =>
                button.setButtonText('Reset to defaults').onClick(() => {
                    pending = [...DEFAULT_ALLOWED_EXTENSIONS].join(', ')
                    void this.plugin.updateAllowedExtensions([...DEFAULT_ALLOWED_EXTENSIONS])
                    new Notice('Allowed extensions reset to defaults. Rebuilding…')
                    this.display()
                })
            )
    }

    private renderSupportHeader(containerEl: HTMLElement): void {
        new Setting(containerEl).setName('Support').setHeading()

        const supportDesc = new DocumentFragment()
        supportDesc.createDiv({
            text: 'Buy me a coffee to support the development of this plugin ❤️'
        })

        new Setting(containerEl).setDesc(supportDesc)

        this.renderBuyMeACoffeeBadge(containerEl)
        const spacing = containerEl.createDiv()
        spacing.classList.add('support-header-margin')
    }

    private renderBuyMeACoffeeBadge(contentEl: HTMLElement | DocumentFragment, width = 175): void {
        const linkEl = contentEl.createEl('a', {
            href: 'https://www.buymeacoffee.com/dsebastien'
        })
        const imgEl = linkEl.createEl('img')
        imgEl.src =
            'https://github.com/dsebastien/obsidian-plugin-template/blob/main/src/assets/buy-me-a-coffee.png?raw=true'
        imgEl.alt = 'Buy me a coffee'
        imgEl.width = width
    }
}
