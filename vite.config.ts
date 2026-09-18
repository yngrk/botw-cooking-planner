import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'BotW Cooking Planner',
        short_name: 'Cooking Planner',
        description: 'The best dishes to cook in Zelda: Breath of the Wild, from your inventory',
        lang: 'en',
        display: 'standalone',
        orientation: 'any',
        // Dark like the menu: Android's splash screen and status bar.
        background_color: '#121212',
        theme_color: '#121212',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          // Android crops launcher icons to circles etc.; this one keeps the dish inside the safe zone.
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  server: { host: true },
  preview: { host: true },
})
