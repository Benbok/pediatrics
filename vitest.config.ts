import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: [
            'src/**/*.{test,spec}.{ts,tsx}',
            'tests/**/*.test.{ts,tsx}'
        ],
        exclude: [
            '**/node_modules/**',
            '**/dist/**',
            '**/.{idea,git,cache,output,temp}/**',
            'tests/**/*.test.{cjs,js}' // Исключаем CommonJS тесты, которые требуют Electron
        ],
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
});
