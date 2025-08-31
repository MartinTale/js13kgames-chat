import { defineConfig } from 'vite';
import typescript from '@rollup/plugin-typescript';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist/widget',
    emptyOutDir: true,
    lib: {
      entry: 'src/chat-widget.ts',
      name: 'ChatWidget',
      fileName: 'chat-widget',
      formats: ['iife']
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      }
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log'],
        unsafe: true,
        unsafe_comps: true,
        passes: 5
      },
      mangle: {
        safari10: true
      },
      format: {
        comments: false
      }
    }
  },
  plugins: [
    typescript({
      target: 'es2020',
      module: 'esnext',
      moduleResolution: 'node',
      strict: true,
      declaration: false,
      outDir: 'dist/widget'
    })
  ]
});