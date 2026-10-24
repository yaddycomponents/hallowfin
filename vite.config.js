import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { remote } from './tools/remote.js'

export default defineConfig({
  plugins: [react(), remote()],
  // on the Wi-Fi too, so the host's phone can open the remote (it needs the
  // key from the game's QR code to do anything)
  server: { host: true },
})
