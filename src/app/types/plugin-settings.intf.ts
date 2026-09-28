export interface PluginSettings {
    /**
     * Names of hidden folders (at the vault root) that should be indexed by Obsidian.
     * Entries keep their literal name, including the leading dot (e.g. ".claude").
     */
    enabledFolders: string[]

    /**
     * File extensions (without the leading dot, lowercase) that should be indexed
     * inside enabled hidden folders. Folders are always traversed — this list
     * only controls which files get injected into Obsidian's vault cache.
     */
    allowedExtensions: string[]
}

/**
 * Default allowlist covering the file types Obsidian natively supports
 * (markdown, Canvas, Bases, images, PDF, audio, video).
 */
export const DEFAULT_ALLOWED_EXTENSIONS: readonly string[] = [
    'md',
    'canvas',
    'base',
    'pdf',
    'png',
    'jpg',
    'jpeg',
    'gif',
    'bmp',
    'svg',
    'webp',
    'avif',
    'mp3',
    'wav',
    'm4a',
    'ogg',
    'flac',
    '3gp',
    'mp4',
    'mov',
    'webm',
    'mkv',
    'ogv'
]

/**
 * A fresh default settings object, safe to hand to Immer.
 *
 * `produce` deep-freezes what it returns, including any subtree it shares
 * with its base. Producing from the shared DEFAULT_SETTINGS froze that
 * constant (and its arrays) for the rest of the process, so any later code
 * or test touching it failed with "Attempted to assign to readonly
 * property". Produce from this instead.
 */
export function createDefaultSettings(): PluginSettings {
    return {
        enabledFolders: [],
        allowedExtensions: [...DEFAULT_ALLOWED_EXTENSIONS]
    }
}

/** The defaults, for reading and comparing. Never produce from it. */
export const DEFAULT_SETTINGS: PluginSettings = createDefaultSettings()
