import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import espnDevApi from './vite-plugin-espn-dev.js'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load every var (not just VITE_*) so the dev-only API middleware can read
  // the ESPN credentials. These stay in the Node process and are never bundled
  // into client code.
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), espnDevApi(env)],
  }
})
