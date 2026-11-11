// 벤치 서버: dist/ 를 띄우고, 페이지가 POST 한 결과를 results/<name>.json(+ .png)로 저장
// node explore/gpu/serve.mjs [포트=5191]
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const dist = path.join(here, 'dist'), outDir = path.join(here, 'results')
fs.mkdirSync(outDir, { recursive: true })
const port = Number(process.argv[2] || 5191)
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.css': 'text/css' }

http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x')
  if (req.method === 'POST' && u.pathname === '/result') {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      const name = (u.searchParams.get('name') || 'run').replace(/[^\w.-]/g, '_')
      try {
        const j = JSON.parse(body)
        if (j.shot) { fs.writeFileSync(path.join(outDir, name + '.png'), Buffer.from(j.shot.split(',')[1], 'base64')); delete j.shot }
        fs.writeFileSync(path.join(outDir, name + '.json'), JSON.stringify(j, null, 2))
      } catch (e) { fs.writeFileSync(path.join(outDir, name + '.json'), JSON.stringify({ parseError: String(e), body: body.slice(0, 2000) })) }
      res.end('ok')
    })
    return
  }
  let f = path.join(dist, u.pathname === '/' ? 'index.html' : u.pathname)
  if (!f.startsWith(dist) || !fs.existsSync(f)) { res.statusCode = 404; return res.end('404') }
  res.setHeader('content-type', TYPES[path.extname(f)] || 'application/octet-stream')
  fs.createReadStream(f).pipe(res)
}).listen(port, '127.0.0.1', () => console.log('bench http://127.0.0.1:' + port))
