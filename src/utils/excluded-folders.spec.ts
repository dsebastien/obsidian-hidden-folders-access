import { describe, expect, test } from 'bun:test'
import { isInExcludedFolder, parseFolderNames } from './excluded-folders'

describe('parseFolderNames', () => {
    test('splits on commas and newlines, keeps spaces inside names', () => {
        expect(parseFolderNames('node_modules, .git\nmy cache')).toEqual([
            'node_modules',
            '.git',
            'my cache'
        ])
    })

    test('strips surrounding slashes and drops nested paths', () => {
        expect(parseFolderNames('/.venv/, a/b, dist/')).toEqual(['.venv', 'dist'])
    })

    test('removes duplicates and empty tokens, keeps case', () => {
        expect(parseFolderNames(' , node_modules,, Node_Modules, node_modules ,')).toEqual([
            'node_modules',
            'Node_Modules'
        ])
    })

    test('returns an empty array for blank input', () => {
        expect(parseFolderNames('')).toEqual([])
        expect(parseFolderNames(' ,\n, ')).toEqual([])
    })
})

describe('isInExcludedFolder', () => {
    const excluded = new Set(['node_modules', '.git'])

    test('matches a file anywhere under an excluded folder', () => {
        expect(
            isInExcludedFolder('.claude/skills/publish/node_modules/kind-of/README.md', excluded)
        ).toBe(true)
    })

    test('matches the excluded folder itself', () => {
        expect(isInExcludedFolder('.claude/skills/publish/node_modules', excluded)).toBe(true)
        expect(isInExcludedFolder('.claude/.git', excluded)).toBe(true)
    })

    test('never matches the enabled root folder', () => {
        expect(isInExcludedFolder('.git', excluded)).toBe(false)
        expect(isInExcludedFolder('.git/HEAD', excluded)).toBe(false)
    })

    test('does not match partial names', () => {
        expect(isInExcludedFolder('.claude/node_modules_notes/a.md', excluded)).toBe(false)
        expect(isInExcludedFolder('.claude/skills/SKILL.md', excluded)).toBe(false)
    })

    test('matches nothing when the list is empty', () => {
        expect(isInExcludedFolder('.claude/node_modules/a.md', new Set())).toBe(false)
    })
})
