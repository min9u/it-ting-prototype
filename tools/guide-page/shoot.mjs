// 헤드리스 크롬 스크린샷 (설치 패키지 없음, CDP 직접): 가이드 페이지 확인과 앱 화면 사진 찍기에 씀
// 사용
//   node tools/guide-page/shoot.mjs <jobs.json>
//   node tools/guide-page/shoot.mjs --url=file:///.../page.html --out=shot.png [--width=1366] [--height=900] [--dark] [--full] [--wait=1500]
// jobs.json: { "serve": "<정적 폴더>", "spa": true, "gpu": "on|off|none", "jobs": [ { "url": "{base}/board?api=slow", "out": "a.png",
//              "width": 1440, "height": 900, "dark": false, "full": false, "wait": 3000, "scrollTo": "#g-20", "clip": {x,y,width,height},
//              "eval": "자바스크립트(Promise 면 기다림)", "probe": "찍은 뒤 값을 출력할 식" } ] }   url 을 빼면 이동하지 않고 지금 화면을 찍음
//   serve 를 주면 그 폴더를 127.0.0.1 임의 포트로 띄우고 url 의 {base} 를 바꿈 (spa: 모르는 주소는 index.html)
//   상대 경로(out, serve)는 jobs.json 이 있는 폴더 기준. --serve=<폴더> 로 띄울 폴더를 바꿀 수 있음
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'

const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(a)
  return [m[1], m[2] ?? true]
}))
const file = process.argv.slice(2).find((a) => !a.startsWith('--'))
const spec = file ? JSON.parse(fs.readFileSync(file, 'utf8')) : { jobs: [{ url: args.url, out: args.out ?? 'shot.png', width: +(args.width ?? 1366), height: +(args.height ?? 900), dark: !!args.dark, full: !!args.full, wait: +(args.wait ?? 1500) }] }
const baseDir = file ? path.dirname(path.resolve(file)) : process.cwd()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm', '.woff2': 'font/woff2', '.ico': 'image/x-icon' }
function serve(dir, spa) {
  const server = http.createServer((req, res) => {
    const u = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    let p = path.join(dir, u)
    if (!p.startsWith(dir)) { res.writeHead(403); res.end(); return }
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html')
    if (!fs.existsSync(p)) {
      if (spa && !/\.[a-z0-9]+$/i.test(u)) p = path.join(dir, 'index.html')
      else { res.writeHead(404); res.end('not found'); return }
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(p).toLowerCase()] ?? 'application/octet-stream' })
    fs.createReadStream(p).pipe(res)
  })
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r(server)))
}

function chromePath() {
  if (process.env.CHROME) return process.env.CHROME
  const c = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome']
  const hit = c.find((p) => fs.existsSync(p))
  if (!hit) throw new Error('크롬을 못 찾았어요. CHROME=<경로>')
  return hit
}

async function launch(gpu = 'on') {
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'guide-shoot-'))
  const flags = [`--user-data-dir=${prof}`, '--headless=new', '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--mute-audio', '--remote-debugging-port=0', 'about:blank']
  if (gpu === 'off') { fs.writeFileSync(path.join(prof, 'Local State'), JSON.stringify({ hardware_acceleration_mode: { enabled: false } })); flags.unshift('--disable-gpu', '--enable-unsafe-swiftshader') }
  if (gpu === 'none') flags.unshift('--disable-gpu', '--disable-3d-apis')
  const chrome = spawn(chromePath(), flags, { stdio: ['ignore', 'ignore', 'pipe'] })
  const wsUrl = await new Promise((resolve, reject) => {
    let buf = ''
    const t = setTimeout(() => reject(new Error(`크롬이 뜨지 않았어요\n${buf}`)), 15000)
    chrome.stderr.on('data', (d) => { buf += d; const m = /DevTools listening on (ws:\/\/\S+)/.exec(buf); if (m) { clearTimeout(t); resolve(m[1]) } })
  })
  const port = new URL(wsUrl).port
  let page
  for (let i = 0; i < 50 && !page; i++) {
    try { page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page') } catch { /* 아직 */ }
    if (!page) await sleep(100)
  }
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j) })
  let id = 0
  const pending = new Map(), logs = []
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data)
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result) }
    else if (m.method === 'Runtime.exceptionThrown') logs.push(`예외: ${m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text}`)
    else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') logs.push(`console.error: ${m.params.args.map((a) => a.value ?? a.description).join(' ')}`)
  })
  const send = (method, params = {}) => new Promise((resolve, reject) => { const i = ++id; pending.set(i, { resolve, reject }); ws.send(JSON.stringify({ id: i, method, params })) })
  const close = async () => { try { ws.close() } catch { /* */ } chrome.kill(); await sleep(400); try { fs.rmSync(prof, { recursive: true, force: true }) } catch { /* */ } }
  return { send, close, logs }
}

const serveDir = typeof args.serve === 'string' ? path.resolve(args.serve) : spec.serve ? path.resolve(baseDir, spec.serve) : null // --serve=<폴더> 로 덮어씀
const server = serveDir ? await serve(serveDir, spec.spa !== false) : null
const base = server ? `http://127.0.0.1:${server.address().port}` : ''
const cdp = await launch(spec.gpu ?? args.gpu ?? 'on')
await cdp.send('Page.enable'); await cdp.send('Runtime.enable')
for (const job of spec.jobs) {
  const w = job.width ?? 1366, h = job.height ?? 900
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: job.scale ?? 1, mobile: false })
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: job.dark ? 'dark' : 'light' }] })
  cdp.logs.length = 0
  if (job.url) { // url 이 없으면 지금 화면 그대로 (앞 작업에 이어서 누른 뒤 찍기 등)
    await cdp.send('Page.navigate', { url: job.url.replace('{base}', base) })
    await sleep(job.wait ?? 1500)
  } else if (job.wait) await sleep(job.wait)
  if (job.eval) await cdp.send('Runtime.evaluate', { expression: job.eval, awaitPromise: true })
  if (job.scrollTo) {
    await cdp.send('Runtime.evaluate', { expression: `document.querySelector(${JSON.stringify(job.scrollTo)})?.scrollIntoView({block:'start'})` })
    await sleep(job.afterScroll ?? 400)
  }
  const params = { format: 'png' }
  if (job.full) {
    const { result } = await cdp.send('Runtime.evaluate', { expression: 'JSON.stringify([document.documentElement.scrollWidth, document.documentElement.scrollHeight])', returnByValue: true })
    const [sw, sh] = JSON.parse(result.value)
    params.clip = { x: 0, y: 0, width: sw, height: Math.min(sh, 16000), scale: 1 }
    params.captureBeyondViewport = true
  } else if (job.clip) params.clip = { scale: 1, ...job.clip }
  const shot = await cdp.send('Page.captureScreenshot', params)
  const out = path.resolve(baseDir, job.out)
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, Buffer.from(shot.data, 'base64'))
  if (job.probe) {
    const { result } = await cdp.send('Runtime.evaluate', { expression: job.probe, returnByValue: true })
    console.log(`  확인 ${job.out}: ${JSON.stringify(result.value)}`)
  }
  console.log(`${job.out}${cdp.logs.length ? `  (${cdp.logs.slice(0, 3).join(' | ')})` : ''}`)
}
await cdp.close()
server?.close()
