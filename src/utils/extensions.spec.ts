import { describe, expect, test } from 'bun:test'
import { extensionNotAllowed, parseExtensions } from './extensions'

describe('parseExtensions', () => {
    test('splits on commas and whitespace', () => {
        expect(parseExtensions('md, canvas base\tpng')).toEqual(['md', 'canvas', 'base', 'png'])
    })

    test('strips leading dots and lowercases', () => {
        expect(parseExtensions('.MD, .Canvas, .Base')).toEqual(['md', 'canvas', 'base'])
    })

    test('strips multiple leading dots', () => {
        expect(parseExtensions('...md')).toEqual(['md'])
    })

    test('removes duplicates while preserving order', () => {
        expect(parseExtensions('md, MD, .md, canvas, md')).toEqual(['md', 'canvas'])
    })

    test('ignores empty tokens and extra separators', () => {
        expect(parseExtensions(' , md,, , canvas  ,')).toEqual(['md', 'canvas'])
    })

    test('returns empty array for blank input', () => {
        expect(parseExtensions('')).toEqual([])
        expect(parseExtensions('   ')).toEqual([])
        expect(parseExtensions(',,,')).toEqual([])
    })
})

describe('extensionNotAllowed', () => {
    const allowed = new Set(['md', 'canvas', 'base'])

    test('returns false when allowlist is empty (no filtering)', () => {
        expect(extensionNotAllowed('any/file.png', new Set())).toBe(false)
    })

    test('returns false for files with allowed extensions', () => {
        expect(extensionNotAllowed('.claude/notes/foo.md', allowed)).toBe(false)
        expect(extensionNotAllowed('.claude/skills/bar.canvas', allowed)).toBe(false)
        expect(extensionNotAllowed('bar.MD', allowed)).toBe(false)
    })

    test('returns true for files with disallowed extensions', () => {
        expect(extensionNotAllowed('.claude/notes/foo.png', allowed)).toBe(true)
        expect(extensionNotAllowed('bar.exe', allowed)).toBe(true)
    })

    test('returns false for paths without extensions (likely folders or extensionless files)', () => {
        expect(extensionNotAllowed('.claude/notes/README', allowed)).toBe(false)
        expect(extensionNotAllowed('.claude/subfolder', allowed)).toBe(false)
    })

    test('returns false for hidden-only names (.hidden, .claude, .github)', () => {
        expect(extensionNotAllowed('.claude', allowed)).toBe(false)
        expect(extensionNotAllowed('.hidden', allowed)).toBe(false)
        expect(extensionNotAllowed('parent/.github', allowed)).toBe(false)
    })

    test('uses only the last dot for extension detection', () => {
        expect(extensionNotAllowed('.claude/archive.backup/foo.md', allowed)).toBe(false)
        expect(extensionNotAllowed('.claude/file.tar.gz', allowed)).toBe(true)
    })

    test('is case-insensitive', () => {
        expect(extensionNotAllowed('foo.MD', allowed)).toBe(false)
        expect(extensionNotAllowed('foo.PNG', allowed)).toBe(true)
    })
})
