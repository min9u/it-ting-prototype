// 벤치 빌드 (app 폴더에서): ./node_modules/.bin/vite build --config ../explore/gpu/vite.config.mjs
import { fileURLToPath } from 'node:url'
const here = fileURLToPath(new URL('.', import.meta.url))
const nm = here + '../../app/node_modules/'
export default {
  root: here,
  base: './',
  logLevel: 'warn',
  resolve: {
    alias: [
      { find: /^three$/, replacement: nm + 'three/build/three.module.js' },
      { find: /^three\/addons\//, replacement: nm + 'three/examples/jsm/' },
    ],
  },
  build: { outDir: here + 'dist', emptyOutDir: true, chunkSizeWarningLimit: 4000 },
}
