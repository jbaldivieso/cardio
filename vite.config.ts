import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// Deployed to https://jbaldivieso.github.io/cardio/ — every asset path is base-relative.
const BASE = '/cardio/'

// The settings screen shows the app version (§7.8). package.json is the one
// place it is written down; the build stamps it in so nothing can drift.
const pkg: { version: string } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
)

export default defineConfig({
  base: BASE,
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      // Everything in `public/` is already in `dist/` when `workbox.globPatterns`
      // sweeps it, so neither `includeAssets` nor the plugin's own manifest-icon
      // pass adds anything — they only put the five icons in the precache
      // manifest twice each. With both off, the sweep is what caches every file
      // the app ships; the one entry it does not account for is
      // `manifest.webmanifest`, which the plugin injects itself whenever
      // `manifest` is set below, and which `globPatterns` does not match.
      includeManifestIcons: false,
      manifest: {
        id: BASE,
        name: 'Cardio',
        short_name: 'Cardio',
        description: 'Offline flash cards with mastery-weighted quizzing',
        theme_color: '#00d1b2',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: BASE,
        start_url: BASE,
        // Precached by the `globPatterns` sweep below, not by the plugin: any
        // icon added here needs an extension that sweep matches.
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // The extension list has to cover every manifest icon above.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  css: {
    preprocessorOptions: {
      // Bulma 1.x still uses a few Sass constructs that are deprecated in
      // sass-embedded; those warnings are not ours to fix.
      scss: { quietDeps: true },
    },
  },
  server: { port: 5173 },
  preview: { port: 4173 },
})
