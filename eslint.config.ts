import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import eslintConfigPrettier from 'eslint-config-prettier'
import globals from 'globals'
import obsidianmd from 'eslint-plugin-obsidianmd'
// Passing `brands` REPLACES the plugin's default list rather than extending it
// (see sentenceCaseUtil.js: `options?.brands ?? DEFAULT_BRANDS`). Listing only
// this plugin's own names would therefore silently strip "Obsidian", "Git",
// "Markdown", "GitHub", "Windows" and the other 40-odd defaults — and the
// community catalog reviewer, which runs the plugin's own ruleset, would keep
// enforcing every one of them. The loss shows up as findings you never see
// locally, not as findings that go away.
// Deep path because the package exports only its default plugin object; it is
// pinned exactly, and a break here is a loud module-resolution error, never a
// silent shrinking of the list.
import { DEFAULT_BRANDS } from 'eslint-plugin-obsidianmd/dist/lib/rules/ui/brands.js'
import { defineConfig } from 'eslint/config'

export default defineConfig([
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    // @ts-expect-error - obsidianmd types are incomplete but the config works at runtime
    ...obsidianmd.configs['recommended'],
    eslintConfigPrettier,
    {
        ignores: [
            '**/dist/**',
            '**/node_modules/**',
            'scripts/**',
            '.cz-config.cjs',
            'prettier.config.cjs',
            'package.json'
        ]
    },
    {
        files: ['**/*.{js,mjs,cjs,ts}'],
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.browser,
                // Tests and build tooling run under the Bun runtime
                Bun: 'readonly',
                // Obsidian global functions
                createDiv: 'readonly',
                createEl: 'readonly',
                createSpan: 'readonly',
                createFragment: 'readonly',
                // Obsidian popout-window-aware globals
                activeWindow: 'readonly',
                activeDocument: 'readonly'
            },
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname
            }
        },
        rules: {
            '@typescript-eslint/no-require-imports': 'off',
            // The community-plugin reviewer treats both the rule violation
            // and any `eslint-disable @typescript-eslint/no-explicit-any` as
            // an ERROR that blocks the scorecard. Catch locally as error,
            // not warn. See AGENTS.md "Community catalog review".
            '@typescript-eslint/no-explicit-any': 'error',
            '@typescript-eslint/no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
            ],
            '@typescript-eslint/ban-ts-comment': 'off',
            '@typescript-eslint/no-deprecated': 'off',
            // These are too strict for dynamic plugin APIs
            '@typescript-eslint/no-unsafe-call': 'off',
            '@typescript-eslint/no-unsafe-member-access': 'off',
            '@typescript-eslint/no-unsafe-assignment': 'off',
            // Obsidian methods are dynamically added to prototypes
            '@typescript-eslint/no-unsafe-enum-comparison': 'off',
            'no-prototype-builtins': 'off',
            // Allow confirm for delete confirmations
            'no-alert': 'off',
            // Never disable obsidianmd/* rules here: the community catalog
            // reviewer runs its own ruleset against the git archive, so a
            // local disable only hides the finding until submission.
            // Brand names are the supported escape hatch for sentence-case.
            'obsidianmd/ui/sentence-case': [
                'error',
                {
                    brands: [
                        ...DEFAULT_BRANDS,
                        // Author and funding links. Add this plugin's own
                        // product names here; do NOT add ordinary UI words such
                        // as 'Settings' — as a brand it makes every lowercase
                        // occurrence a violation.
                        'Knowii',
                        'GitHub Sponsors',
                        'Sébastien Dubois',
                        'dSebastien',
                        // Obsidian feature names this plugin's copy refers to.
                        // Brand casing is enforced BOTH ways — the lowercase
                        // 'canvas'/'base' extension literals below are excused
                        // per exact string instead.
                        'Canvas',
                        'Bases'
                    ],
                    // A matching regex exempts the ENTIRE string
                    // (shouldIgnoreByRegex runs regex.test on the whole text),
                    // so every pattern is anchored to the one literal it
                    // excuses: the extension-list example and placeholder, and
                    // the description that names the Save button.
                    ignoreRegex: [
                        '^e\\.g\\. md, canvas, base, png, pdf$',
                        '^md, canvas, base, …$',
                        '^Changes are applied when you click Save — this triggers a full rebuild of every enabled folder in the background\\.$'
                    ]
                }
            ]
        }
    }
])
