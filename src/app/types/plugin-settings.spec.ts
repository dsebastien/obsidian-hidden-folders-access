import { describe, expect, test } from 'bun:test'
import { DEFAULT_ALLOWED_EXTENSIONS, DEFAULT_SETTINGS } from './plugin-settings.intf'

describe('DEFAULT_ALLOWED_EXTENSIONS', () => {
    test('covers Obsidian-native formats', () => {
        const set = new Set(DEFAULT_ALLOWED_EXTENSIONS)
        expect(set.has('md')).toBe(true)
        expect(set.has('canvas')).toBe(true)
        expect(set.has('base')).toBe(true)
        expect(set.has('pdf')).toBe(true)
    })

    test('includes common image formats', () => {
        const set = new Set(DEFAULT_ALLOWED_EXTENSIONS)
        for (const ext of ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp']) {
            expect(set.has(ext)).toBe(true)
        }
    })

    test('includes common audio/video formats', () => {
        const set = new Set(DEFAULT_ALLOWED_EXTENSIONS)
        for (const ext of ['mp3', 'wav', 'm4a', 'ogg', 'mp4', 'webm']) {
            expect(set.has(ext)).toBe(true)
        }
    })

    test('entries are lowercase and have no leading dots', () => {
        for (const ext of DEFAULT_ALLOWED_EXTENSIONS) {
            expect(ext).toBe(ext.toLowerCase())
            expect(ext.startsWith('.')).toBe(false)
        }
    })
})

describe('DEFAULT_SETTINGS', () => {
    test('starts with no enabled folders', () => {
        expect(DEFAULT_SETTINGS.enabledFolders).toEqual([])
    })

    test('starts with every default extension allowed', () => {
        expect(DEFAULT_SETTINGS.allowedExtensions.sort()).toEqual(
            [...DEFAULT_ALLOWED_EXTENSIONS].sort()
        )
    })

    test('allowedExtensions is an independent copy (not aliased to DEFAULT_ALLOWED_EXTENSIONS)', () => {
        // Mutating the default settings array must never mutate the shared constant.
        const originalLength = DEFAULT_ALLOWED_EXTENSIONS.length
        DEFAULT_SETTINGS.allowedExtensions.push('__test__')
        expect(DEFAULT_ALLOWED_EXTENSIONS.length).toBe(originalLength)
        DEFAULT_SETTINGS.allowedExtensions.pop()
    })
})
