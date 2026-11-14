import { fileURLToPath } from 'node:url'
import { defineConfig, mergeConfig } from 'vitest/config'
import config from '../vitest.config.js'

// Run the same lifecycle contract against the published minified entry point.
export default mergeConfig(config, defineConfig({
  resolve: {
    alias: {
      '../src/on-events.js': fileURLToPath(new URL('../dist/on-events.min.js', import.meta.url)),
    },
  },
}))
