import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// PDF.js needs its CJK cMaps at runtime (school exports use non-embedded Chinese fonts).
// Serve them in dev and copy them into the build; they are not committed.
const PDFJS = fileURLToPath(new URL('./node_modules/pdfjs-dist/', import.meta.url))
const CMAPS = path.join(PDFJS, 'cmaps')
function pdfjsCmaps() {
  return {
    name: 'pdfjs-cmaps',
    configureServer(server) {
      server.middlewares.use('/pdfjs-cmaps/', (req, res, next) => {
        const name = path.basename(decodeURIComponent(req.url.split('?')[0]))
        const file = path.join(CMAPS, name)
        if (!name.endsWith('.bcmap') || !fs.existsSync(file)) return next()
        res.setHeader('Content-Type', 'application/octet-stream')
        fs.createReadStream(file).pipe(res)
      })
    },
    generateBundle() {
      for (const name of fs.readdirSync(CMAPS).filter(name => name.endsWith('.bcmap'))) {
        this.emitFile({ type: 'asset', fileName: `pdfjs-cmaps/${name}`, source: fs.readFileSync(path.join(CMAPS, name)) })
      }
      // PDF.js is Apache-2.0; the Adobe cMaps require their notice in binary redistributions.
      this.emitFile({ type: 'asset', fileName: 'open-source/pdfjs/LICENSE.txt', source: fs.readFileSync(path.join(PDFJS, 'LICENSE')) })
      this.emitFile({ type: 'asset', fileName: 'open-source/pdfjs/cmaps-LICENSE.txt', source: fs.readFileSync(path.join(CMAPS, 'LICENSE')) })
    },
  }
}

export default defineConfig({
  plugins: [react(), pdfjsCmaps()],
  base: './',
  build: { outDir: 'dist', emptyOutDir: true },
})
