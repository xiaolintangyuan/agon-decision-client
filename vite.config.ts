import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
    const plugins = [react(), tailwindcss()];

    const env = loadEnv(mode, process.cwd(), ['VITE_', 'NEXT_PUBLIC_']);
    const processEnvDefines: Record<string, string> = {};
    for (const [key, value] of Object.entries(env)) {
        processEnvDefines[`process.env.${key}`] = JSON.stringify(value);
    }

    return {
        // GitHub Pages serves project sites from /<repository-name>/, so the workflow sets BASE_PATH.
        base: process.env.BASE_PATH ?? '/',
        plugins,
        envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
        define: processEnvDefines,
        server: {
            open: true
        }
    };
})
