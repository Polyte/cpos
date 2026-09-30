import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id: string) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig({
  plugins: [
    figmaAssetResolver(),
    svelte(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  assetsInclude: ['**/*.svg', '**/*.csv'],
  server: {
    // Allow the active ngrok hostname to proxy the dev server. This is
    // required for QR-menu testing from phones on the public tunnel.
    allowedHosts: true,
  },
  preview: {
    // Required when the local preview is opened through a temporary HTTPS
    // tunnel for mobile testing or QR menu access.
    allowedHosts: true,
  },
})
