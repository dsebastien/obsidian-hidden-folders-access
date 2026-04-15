export interface PluginSettings {
    /**
     * Names of hidden folders (at the vault root) that should be indexed by Obsidian.
     * Entries keep their literal name, including the leading dot (e.g. ".claude").
     */
    enabledFolders: string[]
}

export const DEFAULT_SETTINGS: PluginSettings = {
    enabledFolders: []
}
