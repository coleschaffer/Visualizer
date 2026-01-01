import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

const entry = process.env.ENTRY || 'all'

// Content script config - IIFE format
const contentConfig = defineConfig({
  plugins: [react()],
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/content/index.tsx'),
      name: 'VisualFeedback',
      formats: ['iife'],
      fileName: () => 'src/content/index.js',
    },
    rollupOptions: {
      output: {
        extend: true,
        assetFileNames: 'assets/[name].[ext]',
      },
    },
    sourcemap: true,
    minify: false,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
})

// Background service worker config
const backgroundConfig = defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/background/service-worker.ts'),
      name: 'ServiceWorker',
      formats: ['iife'],
      fileName: () => 'src/background/service-worker.js',
    },
    sourcemap: true,
    minify: false,
  },
})

// Popup config - regular build
const popupConfig = defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'popup.html'),
      },
      output: {
        entryFileNames: '[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
    sourcemap: true,
    minify: false,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
})

// Export based on ENTRY env var
export default (() => {
  switch (entry) {
    case 'content':
      return contentConfig
    case 'background':
      return backgroundConfig
    case 'popup':
      return popupConfig
    default:
      // For 'all', just return content config - we'll run multiple builds
      return contentConfig
  }
})()
