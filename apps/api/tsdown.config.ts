import { defineConfig } from 'tsdown'

// Bundles the API into dist/index.mjs. npm packages stay external (installed on the
// server); the workspace's own TypeScript packages are bundled in.
export default defineConfig({
  entry: ['src/index.ts'],
  format: 'esm',
  platform: 'node',
  target: 'node24',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  dts: false,
  noExternal: [/^@fingbo\//],
})
