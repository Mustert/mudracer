import js from '@eslint/js';
import globals from 'globals';

// npm run lint: the recommended rules (no-dupe-keys would have caught the doubled 'acc' key, ANALYSE.md T2) plus no-shadow
// (a local G hid the game state once, T10). The game is plain browser JavaScript in ES modules.
export default [
  { ignores: ['dist/**', 'node_modules/**', 'Obsidian/**', '.claude/**'] },
  js.configs.recommended,
  {
    files: ['src/**/*.js', '*.js', 'test/**/*.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: { ...globals.browser } },
    rules: {
      'no-shadow': ['error', { builtinGlobals: false, hoist: 'functions' }],
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  { files: ['test/**/*.js', 'vite.config.js', 'eslint.config.js'], languageOptions: { globals: { ...globals.node } } },
];
