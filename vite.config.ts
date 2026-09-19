import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The API server (npm run api) listens on 127.0.0.1:8787 during local
// development. Vite proxies same-origin /api requests there so the frontend
// never needs a browser-global API base. Production serves /api on the same
// origin (Vercel serverless), so the proxy is dev-only.
const apiProxyTarget = process.env.VITE_API_PROXY_TARGET ?? 'http://127.0.0.1:8787'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': { target: apiProxyTarget, changeOrigin: true },
      '/healthz': { target: apiProxyTarget, changeOrigin: true },
      '/readyz': { target: apiProxyTarget, changeOrigin: true },
    },
  },
})
