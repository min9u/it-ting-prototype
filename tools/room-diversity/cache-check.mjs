// 구운 방 그림 캐시(IndexedDB, three/stills.ts · roomScene sharpKeyOf)에 꾸미기 값이 들어가는지 (2026-11-18, docs/room-diversity-2-2026-11-18.md 저사양)
// 가속 끈 크롬(WARP) 한 프로필로: ① 다양성 켬으로 예린 땅굴 → 구운 그림 저장 ② ?look=designer 로 다시 → 예전(켬) 그림이 먼저 깔리면 안 됨
// ③ 다시 켬으로 → 이번엔 ① 그림이 먼저 깔려야 함(캐시 맞음). 단계마다 들어온 직후 · 다 차려진 뒤를 찍어 out/cache-check/
// 사용: node tools/room-diversity/cache-check.mjs  (app/dist-share 를 띄움, 먼저 cd app && npm run build:share)
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.resolve(HERE, '../../app/dist-share')
const OUT = path.join(HERE, 'out', 'cache-check')
fs.mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.woff2': 'font/woff2', '.png': 'image/png' }
const server = http.createServer((req, res) => {
  let f = path.join(DIST, decodeURIComponent((req.url ?? '/').split('?')[0]))
  if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, 'index.html')
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] ?? 'application/octet-stream' }); fs.createReadStream(f).pipe(res)
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const base = `http://127.0.0.1:${server.address().port}`
const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'room-cache-'))
fs.writeFileSync(path.join(prof, 'Local State'), JSON.stringify({ hardware_acceleration_mode: { enabled: false } }))
const exe = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const chrome = spawn(exe, [`--user-data-dir=${prof}`, '--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=0', '--window-size=1440,900', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] })
const wsUrl = await new Promise((resolve) => { let b = ''; chrome.stderr.on('data', (d) => { b += d; const m = /DevTools listening on (ws:\/\/\S+)/.exec(b); if (m) resolve(m[1]) }) })
const port = new URL(wsUrl).port
let page; for (let i = 0; i < 50 && !page; i++) { try { page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page') } catch { /* */ } if (!page) await sleep(100) }
const ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener('open', r))
let seq = 0; const pend = new Map()
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id) } })
const send = (method, params = {}) => new Promise((r) => { const i = ++seq; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }))?.result?.value
await send('Page.enable'); await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
await send('Page.addScriptToEvaluateOnNewDocument', { source: `try{localStorage.setItem('digul.gpuNotice.dismissed','1')}catch(e){}` })
const shot = async (name) => { const s = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, name), Buffer.from(s.data, 'base64')) }
const res = []
for (const [step, q] of [['1-auto', '?look=auto'], ['2-designer', '?look=designer'], ['3-auto-again', '?look=auto']]) {
  await send('Page.navigate', { url: 'about:blank' }); await sleep(400)
  await send('Page.navigate', { url: `${base}/${q}#/burrow/yerin` })
  await sleep(900)
  const early = await ev('({stillAt: window.__stillAt ?? null, look: window.__roomLook?.style?.theme ?? null})')
  await shot(`${step}-early.png`)
  await sleep(9000) // 입장 연출 + 선명한 방 굽기 + IndexedDB 저장(쉴 때)
  const late = await ev('({stillAt: window.__stillAt ?? null, look: window.__roomLook?.style?.theme ?? null, caps: window.__captures ?? null})')
  await shot(`${step}-late.png`)
  res.push({ step, early, late })
  console.log(step, JSON.stringify({ early, late: { stillAt: late.stillAt, look: late.look, bakes: (late.caps ?? []).filter((c) => c[0] === 'roomBake').length } }))
}
fs.writeFileSync(path.join(OUT, 'cache-check.json'), JSON.stringify(res, null, 2))
ws.close(); chrome.kill(); server.close(); await sleep(400)
try { fs.rmSync(prof, { recursive: true, force: true }) } catch { /* */ }
process.exit(0)
