import { defineConfig } from 'tsdown'

// Bundles the API into dist/index.mjs, plus the migrate and create-user scripts
// (used in the Docker image). npm packages stay external (installed on the
// server); the workspace's own TypeScript packages are bundled in.
export default defineConfig({
  entry: {
    index: 'src/index.ts',
    migrate: 'src/scripts/migrate.ts',
    'create-user': 'src/scripts/create-user.ts',
  },
  format: 'esm',
  platform: 'node',
  target: 'node24',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  dts: false,
  noExternal: [/^@fingbo\//],
})
