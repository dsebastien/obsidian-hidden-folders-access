import { App, Notice, PluginSettingTab, Setting } from 'obsidian'
import type { HiddenFoldersAccessPlugin } from '../plugin'
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
