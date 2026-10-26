import { networkInterfaces } from 'node:os'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { remote } from './tools/remote.js'

// this laptop on the Wi-Fi, so a dev game's QR codes open the dev phone pages
const lan = Object.values(networkInterfaces()).flat().find((a) => a.family === 'IPv4' && !a.internal)?.address ?? 'localhost'

export default defineConfig({
  plugins: [react(), remote()],
  define: { __LAN__: JSON.stringify(lan) },
  // on the Wi-Fi too, so the host's phone can open the remote (it needs the
  // key from the game's QR code to do anything)
  server: { host: true },
})
