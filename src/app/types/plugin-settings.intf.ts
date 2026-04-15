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

export const DEFAULT_SETTINGS: PluginSettings = {
    enabledFolders: [],
    allowedExtensions: [...DEFAULT_ALLOWED_EXTENSIONS]
}
