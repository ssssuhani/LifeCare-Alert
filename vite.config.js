import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Keep default dev server (localhost) to avoid OS networkInterfaces issues.
})
