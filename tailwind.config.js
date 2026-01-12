/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
            },
            colors: {
                primary: {
                    50: '#eff6ff',
                    100: '#dbeafe',
                    500: '#3b82f6',
                    600: '#2563eb',
                    700: '#1d4ed8',
                },
                teal: {
                    50: '#f0f9ff',
                    500: '#14b8a6',
                    600: '#0d9488',
                },
                rose: {
                    50: '#fff1f2',
                    500: '#f43f5e',
                    600: '#e11d48',
                    700: '#be123c',
                },
                slate: {
                    50: '#f8fafc',
                    200: '#e2e8f0',
                    500: '#64748b',
                    800: '#1e293b',
                    900: '#0f172a',
                },
                surface: {
                    white: '#ffffff',
                    glass: 'rgba(255, 255, 255, 0.8)',
                }
            },
            borderRadius: {
                xl: '12px',
                '2xl': '16px',
            }
        },
    },
    plugins: [],
}
