import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, type UserConfig } from 'vite';

const PROJECT_ROOT = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ mode }) => {
  if (mode === 'main') {
    return defineMainConfig();
  }
  if (mode === 'renderer') {
    return defineRendererConfig();
  }
  throw new Error(`Unsupported Vite config mode: ${mode}`);
});

/**
 * Builds the Node.js code that runs in the MōBrowser main process.
 */
function defineMainConfig(): UserConfig {
  return {
    root: path.resolve(PROJECT_ROOT, 'src/main'),
    build: {
      target: 'esnext',
      outDir: path.resolve(PROJECT_ROOT, 'out/main'),
      emptyOutDir: true,
      sourcemap: true,
      lib: {
        entry: path.resolve(PROJECT_ROOT, 'src/main/index.ts'),
        formats: ['es'],
        fileName: () => 'index.js',
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(PROJECT_ROOT, 'src/main'),
      },
    },
    server: {
      forwardConsole: {
        unhandledErrors: true,
        logLevels: ['warn', 'error'],
      },
    },
  };
}

/**
 * Builds the React code that runs inside the application window.
 */
function defineRendererConfig(): UserConfig {
  return {
    root: path.resolve(PROJECT_ROOT, 'src/renderer'),
    plugins: [react()],
    build: {
      outDir: path.resolve(PROJECT_ROOT, 'out/renderer'),
      emptyOutDir: true,
      sourcemap: true,
    },
    resolve: {
      alias: {
        '@': path.resolve(PROJECT_ROOT, 'src/renderer'),
      },
    },
    server: {
      forwardConsole: {
        unhandledErrors: true,
        logLevels: ['warn', 'error'],
      },
    },
  };
}
