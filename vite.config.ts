import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'BotW Cooking Planner',
        short_name: 'Cooking Planner',
        description: 'The best dishes to cook in Zelda: Breath of the Wild, from your inventory',
        lang: 'de',
        display: 'standalone',
        orientation: 'any',
        background_color: '#f4f1e8',
        theme_color: '#f4f1e8',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  server: { host: true },
  preview: { host: true },
})
