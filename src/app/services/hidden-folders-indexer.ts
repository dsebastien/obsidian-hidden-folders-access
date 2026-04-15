import { type App, type DataAdapter, normalizePath, TAbstractFile } from 'obsidian'
import { stat } from 'node:fs/promises'
import { extensionNotAllowed } from '../../utils/extensions'
import { log } from '../../utils/log'

type ReconcileFn = (fullPath: string, path: string, silent?: boolean) => Promise<void>
type ListRecursiveChildFn = (parent: string, name: string) => Promise<void>

/**
 * Undocumented internals of the FileSystemAdapter that we rely on.
 * These exist on desktop (FileSystemAdapter) builds of Obsidian.
 * We cast to this shape explicitly rather than polluting the global typings.
 */
interface InternalAdapter extends DataAdapter {
    files: Record<string, { type: 'file' | 'folder'; realpath: string }>
    watchers?: Record<string, unknown>
    getFullRealPath(path: string): string
    listRecursive(path: string): Promise<void>
    listRecursiveChild: ListRecursiveChildFn
    reconcileFile: ReconcileFn
    reconcileFileInternal(fullPath: string, path: string): Promise<void>
    reconcileFolderCreation(fullPath: string, path: string): Promise<void>
    reconcileDeletion(fullPath: string, path: string, force?: boolean): Promise<void>
    watchHiddenRecursive(path: string): Promise<void>
    trigger(event: string, ...args: unknown[]): void
}

interface PatchMemo {
    originalListRecursiveChild: ListRecursiveChildFn
    originalReconcileFile: ReconcileFn
}

const hasFsENOENT = (err: unknown): boolean =>
    typeof err === 'object' && err !== null && (err as { code?: string }).code === 'ENOENT'

const yieldToEventLoop = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

/**
 * Makes a set of hidden root-level folders visible to Obsidian's vault cache,
 * metadata cache and Bases by bypassing the built-in hidden-path filter that
 * the data adapter normally applies.
 *
 * Strategy:
 *  1. Monkey-patch `adapter.listRecursiveChild` and `adapter.reconcileFile`.
 *     The originals call an internal `ru(path)` check that drops hidden paths
 *     and routes them through `reconcileDeletion`. Our patches skip that
 *     check for whitelisted paths and go straight to `reconcileFileInternal`.
 *  2. Call `reconcileFolderCreation(path, path)` for each enabled folder.
 *     That cascades through `listRecursive` (and therefore through our
 *     patched `listRecursiveChild`) and populates every descendant.
 *  3. Call `watchHiddenRecursive(path)` so fs.watch events fire on future
 *     changes. Obsidian funnels those events into `reconcileFile` — our
 *     patched version — so live updates keep working.
 *
 * On cleanup we remove the injected entries from the vault, stop watchers
 * and restore the original adapter methods.
 */
export class HiddenFoldersIndexer {
    private readonly enabledPrefixes = new Set<string>()
    private readonly watchedPrefixes = new Set<string>()
    private readonly inFlight = new Map<string, Promise<void>>()
    private allowedExtensions: Set<string> = new Set()
    private patches: PatchMemo | null = null

    constructor(private readonly app: App) {}

    /**
     * Replace the extension allowlist. Paths with extensions not in this set
     * are skipped during indexing and when fs events fire. Changing the list
     * only affects future operations — already-injected entries are not
     * retroactively removed. Call `sync()` or toggle the folders to re-apply.
     */
    setAllowedExtensions(extensions: readonly string[]): void {
        this.allowedExtensions = new Set(
            extensions.map((e) => e.replace(/^\./, '').trim().toLowerCase()).filter(Boolean)
        )
    }

    /**
     * Read-only view of the current extension allowlist (lowercase, no dots).
     */
    getAllowedExtensions(): readonly string[] {
        return Array.from(this.allowedExtensions).sort()
    }

    /**
     * Read-only view of the prefixes that are currently enabled.
     * Does not include prefixes whose enable/disable is still pending.
     */
    getEnabledPrefixes(): readonly string[] {
        return Array.from(this.enabledPrefixes)
    }

    /**
     * True while an enable or disable operation is still running for `rawPath`.
     * The UI uses this to avoid launching duplicate background tasks.
     */
    isBusy(rawPath: string): boolean {
        return this.inFlight.has(this.normalize(rawPath))
    }

    /**
     * List hidden folders (names starting with ".") that sit at the vault root,
     * excluding Obsidian's own config directory.
     */
    async listHiddenRootFolders(): Promise<string[]> {
        const listed = await this.app.vault.adapter.list('/')
        const configDir = normalizePath(this.app.vault.configDir)
        return listed.folders
            .map((p) => p.replace(/^\/+/, ''))
            .filter((name) => name.startsWith('.') && name !== configDir)
            .sort()
    }

    /**
     * Enable indexing for a set of hidden folders. Any folder already enabled
     * is left untouched. Any folder currently enabled but missing from `paths`
     * is disabled.
     */
    async sync(paths: readonly string[]): Promise<void> {
        const wanted = new Set(paths.map((p) => this.normalize(p)).filter((p) => p.length > 0))

        for (const existing of Array.from(this.enabledPrefixes)) {
            if (!wanted.has(existing)) {
                await this.disablePath(existing)
            }
        }

        for (const target of wanted) {
            if (!this.enabledPrefixes.has(target)) {
                await this.enablePath(target)
            }
        }
    }

    async enablePath(rawPath: string): Promise<void> {
        const path = this.normalize(rawPath)
        if (path.length === 0) return
        if (this.enabledPrefixes.has(path)) return

        const existing = this.inFlight.get(path)
        if (existing) return existing

        const task = this.runEnable(path)
        this.inFlight.set(path, task)
        try {
            await task
        } finally {
            this.inFlight.delete(path)
        }
    }

    private async runEnable(path: string): Promise<void> {
        const adapter = this.internalAdapter()
        // `adapter.exists` applies Obsidian's hidden-path filter so we can't
        // use it here. Fall back to listing the vault root and looking for
        // the entry ourselves.
        const rootListing = await adapter.list('/')
        const available = rootListing.folders.map((p) => this.normalize(p))
        if (!available.includes(path)) {
            log(`Hidden folder "${path}" does not exist on disk`, 'warn')
            throw new Error(`Hidden folder "${path}" does not exist on disk`)
        }

        this.enabledPrefixes.add(path)
        this.ensurePatched()

        // Obsidian's reconcile* methods take the logical vault path in both
        // arguments. The second arg is the insensitive/normalized variant —
        // on sensitive filesystems it's identical to the first.
        try {
            await adapter.reconcileFolderCreation(path, path)
        } catch (err) {
            log(`Failed to reconcile folder "${path}"`, 'error', err)
            this.enabledPrefixes.delete(path)
            throw err
        }

        try {
            await adapter.watchHiddenRecursive(path)
            this.watchedPrefixes.add(path)
        } catch (err) {
            log(`Failed to start file watcher for "${path}"`, 'warn', err)
        }

        log(`Enabled hidden folder indexing for "${path}"`, 'debug')
    }

    async disablePath(rawPath: string): Promise<void> {
        const path = this.normalize(rawPath)
        if (!this.enabledPrefixes.has(path)) return

        const existing = this.inFlight.get(path)
        if (existing) return existing

        const task = this.runDisable(path)
        this.inFlight.set(path, task)
        try {
            await task
        } finally {
            this.inFlight.delete(path)
        }
    }

    private async runDisable(path: string): Promise<void> {
        const adapter = this.internalAdapter()

        // Stop any watchers we registered under this prefix.
        const watchers = adapter.watchers ?? {}
        for (const key of Object.keys(watchers)) {
            if (this.isUnderPrefix(key, path)) {
                try {
                    const maybeFn = (adapter as unknown as { stopWatchPath?: (p: string) => void })
                        .stopWatchPath
                    maybeFn?.call(adapter, key)
                } catch (err) {
                    log(`Failed to stop watcher for "${key}"`, 'warn', err)
                }
            }
        }
        this.watchedPrefixes.delete(path)

        // Remove entries from the vault cache (bottom-up so parents are emptied
        // before being deleted). Yield to the event loop every chunk so the UI
        // stays responsive for large trees.
        const toRemove = this.app.vault
            .getAllLoadedFiles()
            .filter((f: TAbstractFile) => this.isUnderPrefix(f.path, path))
            .sort((a, b) => b.path.length - a.path.length)

        const chunkSize = 250
        for (let i = 0; i < toRemove.length; i++) {
            const file = toRemove[i]
            if (!file) continue
            try {
                adapter.trigger('raw', file.path)
                await adapter.reconcileDeletion(file.path, file.path, true)
            } catch (err) {
                log(`Failed to remove "${file.path}" from vault`, 'warn', err)
            }
            if ((i + 1) % chunkSize === 0) {
                await yieldToEventLoop()
            }
        }

        this.enabledPrefixes.delete(path)

        if (this.enabledPrefixes.size === 0) {
            this.restorePatches()
        }

        log(`Disabled hidden folder indexing for "${path}"`, 'debug')
    }

    /**
     * Remove all patches and all injected entries. Safe to call on unload.
     */
    async teardown(): Promise<void> {
        for (const path of Array.from(this.enabledPrefixes)) {
            await this.disablePath(path)
        }
        this.restorePatches()
    }

    private ensurePatched(): void {
        if (this.patches !== null) return

        const adapter = this.internalAdapter()
        const originalListRecursiveChild = adapter.listRecursiveChild.bind(adapter)
        const originalReconcileFile = adapter.reconcileFile.bind(adapter)
        const isEnabled = (path: string | undefined): boolean =>
            typeof path === 'string' && this.isAnyEnabled(path)

        adapter.listRecursiveChild = async (parent: string, name: string): Promise<void> => {
            const combined = parent === '' ? name : `${parent}/${name}`
            const normalized = this.normalize(combined)
            if (!isEnabled(normalized)) {
                return originalListRecursiveChild(parent, name)
            }
            if (await this.shouldSkipByExtension(adapter, normalized)) {
                return
            }
            adapter.trigger('raw', normalized)
            try {
                await adapter.reconcileFileInternal(normalized, normalized)
            } catch (err) {
                if (hasFsENOENT(err)) {
                    await adapter.reconcileDeletion(normalized, normalized, true)
                } else {
                    log(`listRecursiveChild failed for "${normalized}"`, 'warn', err)
                }
            }
        }

        adapter.reconcileFile = async (e: string, t: string, silent?: boolean): Promise<void> => {
            if (!isEnabled(t)) {
                return originalReconcileFile(e, t, silent)
            }
            if (await this.shouldSkipByExtension(adapter, t)) {
                return
            }
            const flag = silent ?? true
            adapter.trigger('raw', t)
            try {
                await adapter.reconcileFileInternal(e, t)
            } catch (err) {
                if (hasFsENOENT(err)) {
                    await adapter.reconcileDeletion(e, t, flag)
                } else {
                    log(`reconcileFile failed for "${t}"`, 'warn', err)
                }
            }
        }

        this.patches = { originalListRecursiveChild, originalReconcileFile }
    }

    private restorePatches(): void {
        if (this.patches === null) return
        const adapter = this.internalAdapter()
        adapter.listRecursiveChild = this.patches.originalListRecursiveChild
        adapter.reconcileFile = this.patches.originalReconcileFile
        this.patches = null
    }

    /**
     * Returns true when `path` points to a regular file whose extension is
     * not on the allowlist. Folders, symlinks, and paths that no longer exist
     * are always allowed through — the downstream reconcile logic handles them.
     *
     * Uses `fs.stat` (desktop-only) to distinguish files from folders reliably,
     * since folder names can contain dots and file names can lack extensions.
     */
    private async shouldSkipByExtension(adapter: InternalAdapter, path: string): Promise<boolean> {
        if (!extensionNotAllowed(path, this.allowedExtensions)) return false
        let fullPath: string
        try {
            fullPath = adapter.getFullRealPath(path)
        } catch {
            return false
        }
        try {
            const s = await stat(fullPath)
            return s.isFile()
        } catch {
            return false
        }
    }

    private isAnyEnabled(path: string): boolean {
        for (const prefix of this.enabledPrefixes) {
            if (this.isUnderPrefix(path, prefix)) return true
        }
        return false
    }

    private isUnderPrefix(path: string, prefix: string): boolean {
        if (path === prefix) return true
        return path.startsWith(`${prefix}/`)
    }

    private normalize(path: string): string {
        return normalizePath(path).replace(/^\/+|\/+$/g, '')
    }

    private internalAdapter(): InternalAdapter {
        return this.app.vault.adapter as unknown as InternalAdapter
    }
}
