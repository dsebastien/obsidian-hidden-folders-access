import { describe, expect, test } from 'bun:test'
import { readChangelogDefine } from './build'

/**
 * The changelog define is what the What's new view ships with — a regression
 * that silently embeds an empty string would pass every constant-only test.
 */
describe('readChangelogDefine', () => {
    test('inlines the real CHANGELOG.md as a JSON string literal', async () => {
        const define = await readChangelogDefine()
        const literal = define['__PLUGIN_CHANGELOG__']
        expect(typeof literal).toBe('string')
        const text = JSON.parse(literal!) as string
        expect(text.length).toBeGreaterThan(100)
        expect(text).toContain('#')
    })
})
