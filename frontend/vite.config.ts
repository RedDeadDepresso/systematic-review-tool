import { defineConfig } from 'vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import mdx from '@mdx-js/rollup'
import remarkGfm from 'remark-gfm' // <-- import remark-gfm
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { resolve } from 'node:path'

const isTest = process.env.VITEST === 'true'

export default defineConfig({
  plugins: [
    tanstackRouter({ autoCodeSplitting: !isTest }),
    {
      enforce: 'pre',
      ...mdx({
        jsxImportSource: 'react',
        remarkPlugins: [remarkGfm]
      }),
    },
    viteReact({
      include: /\.(jsx|tsx|mdx)$/,
      babel: {
        plugins: [["babel-plugin-react-compiler"]],
      },
    }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    include: ["pdfjs-dist"],
  },
  test: {
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
    globals: true,
    testTimeout: 10000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'cobertura'],
      all: true,
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/components/ui/**', // shadcn/ui components
        'src/main.tsx',
        'src/index.css',
        '**/*.d.ts',
      ],
    },
  },
} as any)
