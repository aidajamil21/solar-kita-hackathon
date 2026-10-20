import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // BASE_PATH is set by the GitHub Pages workflow (e.g. /solar-kita-hackathon/); '/' everywhere else
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  build: { chunkSizeWarningLimit: 1600 },
})
