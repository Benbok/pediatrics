import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // Load env file based on `mode` in the current working directory.
    // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
    const env = loadEnv(mode, process.cwd(), '');

    return {
        base: './', // Use relative paths for Electron
        server: {
            port: 5173,
            host: '0.0.0.0',
        },
        plugins: [react()],
        resolve: {
            alias: {
                '@': path.resolve(__dirname, './src'),
            }
        },
        // Expose env variables to the app
        define: {
            'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY),
            'import.meta.env.VITE_GEMINI_MODEL': JSON.stringify(env.GEMINI_MODEL || 'gemini-2.5-flash'),
        },
        optimizeDeps: {
            exclude: ['pdfjs-dist']
        },
        worker: {
            format: 'es'
        }
    };
});
