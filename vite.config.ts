import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': process.env.CIVIUM_API_URL ?? 'http://127.0.0.1:4000',
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Тяжёлые/стабильные зависимости — в отдельные чанки: recharts грузится
        // лениво только на дашборде (а не как общий код всех роутов), а vendor-ядро
        // кэшируется браузером между деплоями независимо от кода приложения.
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (/[\\/](recharts|d3-[^/\\]+|victory-vendor|internmap)[\\/]/.test(id))
            return 'charts'
          if (/[\\/]react-dom[\\/]/.test(id)) return 'react-dom'
          if (/[\\/]@tanstack[\\/]react-table[\\/]/.test(id)) return undefined
          if (/[\\/]@tanstack[\\/]/.test(id)) return 'tanstack'
        },
      },
    },
  },
})
