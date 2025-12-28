import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(),
    tailwindcss()
  ],
  server: {
    proxy: {
      // proxy API requests to the api gateway
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
     },
      // proxy websocket connections for game
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true,
        changeOrigin: true,
     },
   },
 },
})
