// 합성 비용 시험 (docs/explore-move-quality.md 2번): comp-bench.html 을 가속 끈 크롬에서 모드별로 열고
// rAF 간격 + 화면 합성(viz) 프레임 수를 잼. 합성 프레임은 Chrome 추적의 Display::DrawAndSwap 개수
// node explore/gpu/move/comp-bench.mjs [모드 ...]   환경변수 AFF=3(2코어) MODE=hwoff|gpu REPS=2
import { spawn } from 'node:child_process'; import fs from 'node:fs'; import http from 'node:http'; import os from 'node:os'; import path from 'node:path'; import { fileURLToPath } from 'node:url'
const here = path.dirname(fileURLToPath(import.meta.url))
const exe = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const modes = process.argv.slice(2).length ? process.argv.slice(2) : ['static', 'tx', 'm3d', 'm3d2', 'm3d3', 'gl1x']
const REPS = +(process.env.REPS || 2)
const srv = http.createServer((q, s) => { s.setHeader('content-type', 'text/html; charset=utf-8'); fs.createReadStream(path.join(here, 'comp-bench.html')).pipe(s) }).listen(5353)
async function connect(u) {
  const ws = new WebSocket(u); await new Promise((r) => ws.addEventListener('open', r))
  let id = 0; const pend = new Map(); const ls = []
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } else ls.forEach((f) => f(m)) })
  return { ws, send: (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) }), on: (f) => ls.push(f) }
}
async function one(mode) {
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'compb-'))
  if ((process.env.MODE || 'hwoff') === 'hwoff') fs.writeFileSync(path.join(prof, 'Local State'), JSON.stringify({ hardware_acceleration_mode: { enabled: false } }))
  const port = 9800 + Math.floor(Math.random() * 100)
  const args = [`--user-data-dir=${prof}`, `--remote-debugging-port=${port}`, '--no-first-run', '--headless=new', '--window-size=1920,1080', 'about:blank']
  const chrome = process.env.AFF ? spawn('cmd', ['/c', 'start', '""', '/wait', '/affinity', process.env.AFF, exe, ...args], { stdio: 'ignore' }) : spawn(exe, args, { stdio: 'ignore' })
  let t; for (let i = 0; i < 60; i++) { try { t = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (t.find((x) => x.type === 'page')) break } catch {} await sleep(200) }
  const ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()
  const B = await connect(ver.webSocketDebuggerUrl)
  const P = await connect(t.find((x) => x.type === 'page').webSocketDebuggerUrl)
  const evs = []
  B.on((m) => { if (m.method === 'Tracing.dataCollected') evs.push(...m.params.value) })
  const done = new Promise((r) => B.on((m) => { if (m.method === 'Tracing.tracingComplete') r() }))
  await P.send('Page.navigate', { url: `http://127.0.0.1:5353/?mode=${mode.split('&')[0]}&sec=4${mode.includes('&') ? '&' + mode.split('&').slice(1).join('&') : ''}` })
  await sleep(1500)
  await B.send('Tracing.start', { traceConfig: { includedCategories: ['viz', 'disabled-by-default-viz.quads', 'cc', 'gpu'] }, transferMode: 'ReportEvents' })
  let res = null
  for (let i = 0; i < 80 && !res; i++) { await sleep(100); res = (await P.send('Runtime.evaluate', { expression: 'window.__result', returnByValue: true })).result?.result?.value ?? null }
  // 시험 페이지는 다시 불러서 추적 구간과 맞춤
  await P.send('Runtime.evaluate', { expression: 'location.reload()' })
  await sleep(300)
  const ta = Date.now()
  res = null
  for (let i = 0; i < 100 && !res; i++) { await sleep(100); res = (await P.send('Runtime.evaluate', { expression: 'window.__result', returnByValue: true })).result?.result?.value ?? null }
  await B.send('Tracing.end'); await done
  const names = {}
  for (const e of evs) if (e.ph === 'X' || e.ph === 'B') { names[e.name] ??= { n: 0, dur: 0 }; names[e.name].n++; names[e.name].dur += (e.dur || 0) / 1000 }
  const pick = (re) => Object.entries(names).filter(([k]) => re.test(k)).map(([k, v]) => [k, v.n, Math.round(v.dur)])
  res.trace = pick(/DrawAndSwap|DrawFrame|SoftwareRenderer|SkiaRenderer|SubmitCompositorFrame|Draw$/i).slice(0, 12)
  res.wallSec = +((Date.now() - ta) / 1000).toFixed(1)
  try { await B.send('Browser.close') } catch {}
  chrome.kill(); await sleep(600); try { fs.rmSync(prof, { recursive: true, force: true }) } catch {}
  return res
}
for (let r = 0; r < REPS; r++) for (const m of modes) { const x = await one(m); console.log(JSON.stringify(x)) }
srv.close()
