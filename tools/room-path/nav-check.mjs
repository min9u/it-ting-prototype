// 땅굴 방 길 찾기 확인 (docs/room-pathfinding-2026-11-18.md): 빈 바닥 점 중 곧장 가면 가구에 막히는 두 점 10쌍을
// 예전(?nav=0)과 새 길(기본)로 걸어 보고 자취 · 도착 · 가구 변에 붙은 시간을 비교. 앱의 시험 손잡이 ?navdbg=1 (window.__roomNav) 를 씀
// 사용 (먼저 cd app && npm run build):
//   node tools/room-path/nav-check.mjs <저장소 루트> <결과 폴더> [--path=/burrow | --path=/burrow/yerin] [--gpu=off]
//   python -I tools/room-path/nav-plot.py <결과 폴더>/nav-check.json <그림.jpg> [1,5,7]   # 위에서 본 자취 그림 (고를 쌍 번호)
// Git Bash 에서는 MSYS_NO_PATHCONV=1 (안 하면 --path=/burrow 가 윈도 경로로 바뀜), 저장소 루트는 C:/… 꼴로
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'

const ROOT = path.resolve(process.argv[2]), OUT = path.resolve(process.argv[3])
const GPU = process.argv.includes('--gpu=off') ? 'off' : 'on'
const PAGE = (process.argv.find((a) => a.startsWith('--path=')) ?? '--path=/burrow').slice(7)
const DIST = path.join(ROOT, 'app/dist')
const W = 1440, H = 900
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
fs.mkdirSync(OUT, { recursive: true })

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm', '.woff2': 'font/woff2' }
const server = http.createServer((req, res) => {
  const u = decodeURIComponent((req.url ?? '/').split('?')[0])
  let f = path.join(DIST, u)
  if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, 'index.html')
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] ?? 'application/octet-stream' })
  fs.createReadStream(f).pipe(res)
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const base = `http://127.0.0.1:${server.address().port}`

const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'nav-check-'))
const flags = [`--user-data-dir=${prof}`, '--headless=new', '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--mute-audio', '--remote-debugging-port=0', `--window-size=${W},${H}`, 'about:blank']
if (GPU === 'off') { fs.writeFileSync(path.join(prof, 'Local State'), JSON.stringify({ hardware_acceleration_mode: { enabled: false } })); flags.unshift('--disable-gpu') }
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', flags, { stdio: ['ignore', 'ignore', 'pipe'] })
const wsUrl = await new Promise((resolve, reject) => {
  let buf = ''; const t = setTimeout(() => reject(new Error(buf)), 15000)
  chrome.stderr.on('data', (d) => { buf += d; const m = /DevTools listening on (ws:\/\/\S+)/.exec(buf); if (m) { clearTimeout(t); resolve(m[1]) } })
})
const port = new URL(wsUrl).port
let page
for (let i = 0; i < 50 && !page; i++) { try { page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page') } catch { /* */ } if (!page) await sleep(100) }
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j) })
let seq = 0; const pending = new Map(), logs = []
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result) }
  else if (m.method === 'Runtime.exceptionThrown') logs.push(`예외: ${m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text}`)
  else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') logs.push(`console.error: ${m.params.args.map((a) => a.value ?? a.description).join(' ')}`)
})
const send = (method, params = {}) => new Promise((resolve, reject) => { const i = ++seq; pending.set(i, { resolve, reject }); ws.send(JSON.stringify({ id: i, method, params })) })
const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.value
const waitFor = async (expr, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await ev(expr)) return true; await sleep(100) } return false }

await send('Page.enable'); await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false })
await send('Page.addScriptToEvaluateOnNewDocument', { source: `try{localStorage.setItem('digul.gpuNotice.dismissed','1')}catch(e){}` })

const EDGE = 1e-3
const insideAny = (p, rects, m = 0) => rects.some((r) => p.x > r.x0 + m && p.x < r.x1 - m && p.z > r.z0 + m && p.z < r.z1 - m)
const pos = () => ev('window.__roomNav && window.__roomNav.pos()')

async function walkAndTrace(x, z, ms = 12000) {
  const trace = []; const t0 = Date.now()
  await ev(`window.__roomNav.walkTo(${x}, ${z})`)
  await sleep(120)
  while (Date.now() - t0 < ms) {
    const p = await pos(); trace.push({ t: Date.now() - t0, x: p.x, z: p.z })
    if (p.idle && Date.now() - t0 > 300) break
    await sleep(40)
  }
  return trace
}

const result = { gpu: GPU, modes: {} }
for (const mode of ['new', 'old']) {
  logs.length = 0
  await send('Page.navigate', { url: `${base}${PAGE}?navdbg=1${mode === 'old' ? '&nav=0' : ''}` })
  if (!(await waitFor('!!window.__sceneReadyAt && !!window.__roomNav && !!window.__roomNav.pos()', 45000))) { console.log('scene not ready', mode); continue }
  await waitFor('window.__roomNav.pos().idle', 15000) // 천장에서 떨어지기 끝
  await sleep(500)
  const rects = await ev('window.__roomNav.rects()')
  // 시나리오: 빈 바닥 점(격자 0.25m) 중 곧장 가면 가구에 막히는 두 점 (두 모드 같은 쌍)
  if (!globalThis.CASES) {
    const crosses = (a, b, r) => { const x0 = r.x0 + EDGE, x1 = r.x1 - EDGE, z0 = r.z0 + EDGE, z1 = r.z1 - EDGE; const dx = b.x - a.x, dz = b.z - a.z; const p = [-dx, dx, -dz, dz], q = [a.x - x0, x1 - a.x, a.z - z0, z1 - a.z]; let t0 = 0, t1 = 1; for (let i = 0; i < 4; i++) { if (Math.abs(p[i]) < 1e-12) { if (q[i] < 0) return false; continue } const t = q[i] / p[i]; if (p[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t } else { if (t < t0) return false; if (t < t1) t1 = t } } return t1 > t0 }
    const free = []
    for (let x = -2.5; x <= 2.5; x += .25) for (let z = -2.5; z <= 2.5; z += .25) { const p = { x: +x.toFixed(2), z: +z.toFixed(2) }; if (Math.hypot(p.x, p.z) < 2.6 && !insideAny(p, rects, -.05)) free.push(p) }
    const pairs = []
    for (let i = 0; i < free.length; i++) for (let j = i + 1; j < free.length; j++) {
      const a = free[i], b = free[j], d = Math.hypot(a.x - b.x, a.z - b.z)
      if (d < 1.6) continue
      const hits = rects.filter((r) => crosses(a, b, r)).length
      if (hits) pairs.push({ a, b, d, hits })
    }
    // 고르게: 막는 가구 수 · 거리 순으로 섞어 10쌍 (결정적)
    pairs.sort((p, q) => q.hits - p.hits || q.d - p.d)
    const pick = []
    for (let k = 0; k < pairs.length && pick.length < 10; k += Math.max(1, Math.floor(pairs.length / 10))) pick.push(pairs[k])
    globalThis.CASES = pick
    console.log('free points', free.length, 'blocked pairs', pairs.length)
  }
  const cases = globalThis.CASES
  const runs = []
  for (const c of cases) {
    const pre = await walkAndTrace(c.a.x, c.a.z, 15000)
    const at = pre.at(-1)
    if (!at || Math.hypot(at.x - c.a.x, at.z - c.a.z) > .08) { runs.push({ ...c, skipped: 'start not reached', at }); continue }
    const tr = await walkAndTrace(c.b.x, c.b.z, 15000)
    const end = tr.at(-1)
    const dist = Math.hypot(end.x - c.b.x, end.z - c.b.z)
    let len = 0; for (let i = 1; i < tr.length; i++) len += Math.hypot(tr[i].x - tr[i - 1].x, tr[i].z - tr[i - 1].z)
    // 가구 변에 붙어 미끄러진 시간: 두더지가 어떤 발자리 경계에서 1cm 안에 있던 샘플 비율
    const onEdge = tr.filter((p) => rects.some((r) => p.x > r.x0 - .01 && p.x < r.x1 + .01 && p.z > r.z0 - .01 && p.z < r.z1 + .01)).length / tr.length
    runs.push({ ...c, arrived: dist < .05, dist: +dist.toFixed(3), time: end.t, len: +len.toFixed(2), straight: +Math.hypot(c.b.x - c.a.x, c.b.z - c.a.z).toFixed(2), onEdge: +onEdge.toFixed(2), trace: tr })
  }
  // 실제 클릭 한 번 (새 길만): 첫 시나리오 반대쪽 점을 화면에서 누름
  let click = null
  if (mode === 'new' && cases.length) {
    const c = cases[0]
    await walkAndTrace(c.a.x, c.a.z, 15000)
    const s = await ev(`window.__roomNav.screen(${c.b.x}, ${c.b.z})`)
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: s.x, y: s.y })
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: s.x, y: s.y, button: 'left', clickCount: 1 })
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: s.x, y: s.y, button: 'left', clickCount: 1 })
    const t0 = Date.now(), tr = []
    let shot = false
    while (Date.now() - t0 < 12000) {
      const p = await pos(); tr.push({ t: Date.now() - t0, x: p.x, z: p.z })
      if (!shot && Date.now() - t0 > 700) { shot = true; const img = await send('Page.captureScreenshot', { format: 'jpeg', quality: 80 }); fs.writeFileSync(path.join(OUT, 'click-mid.jpg'), Buffer.from(img.data, 'base64')) }
      if (p.idle && Date.now() - t0 > 400) break
      await sleep(40)
    }
    const end = tr.at(-1)
    click = { target: c.b, screen: s, end, dist: +Math.hypot(end.x - c.b.x, end.z - c.b.z).toFixed(3), time: end.t, trace: tr }
  }
  result.modes[mode] = { rects, runs, click, logs: [...logs] }
  const done = runs.filter((r) => !r.skipped)
  console.log(`${mode}: cases ${cases.length}, ran ${done.length}, arrived ${done.filter((r) => r.arrived).length}, median time ${done.map((r) => r.time).sort((a, b) => a - b)[Math.floor(done.length / 2)]}ms, median onEdge ${done.map((r) => r.onEdge).sort((a, b) => a - b)[Math.floor(done.length / 2)]}, logs ${logs.length}`)
  if (click) console.log(`  click: dist ${click.dist}, time ${click.time}ms`)
}
fs.writeFileSync(path.join(OUT, 'nav-check.json'), JSON.stringify(result))
ws.close(); chrome.kill(); server.close()
