import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting'

export default defineConfigWithVueTs(
  {
    name: 'cardio/ignores',
    ignores: ['dist/**', 'dev-dist/**', 'coverage/**', 'playwright-report/**', 'test-results/**'],
  },
  { name: 'cardio/files', files: ['**/*.{ts,mts,vue,js}'] },
  js.configs.recommended,
  pluginVue.configs['flat/recommended'],
  vueTsConfigs.recommended,
  {
    name: 'cardio/rules',
    rules: {
      'vue/multi-word-component-names': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    name: 'cardio/domain-purity',
    files: ['src/domain/**/*.ts'],
    rules: {
      // The domain layer stays free of Vue, Dexie and browser globals so it can
      // be unit tested as plain functions. See CLAUDE.md > Architecture.
      'no-restricted-imports': [
        'error',
        { patterns: ['vue', 'vue-router', 'pinia', 'dexie', '@/db/*', '@/stores/*'] },
      ],
    },
  },
  skipFormatting,
)
