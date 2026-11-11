// 검증용: 실제 앱 페이지를 그래픽 가속 설정별로 띄우고, CDP로 rAF 프레임 수·긴 작업·스크린샷을 잰다.
// (벤치 페이지와 다른 방법: 앱 코드를 고치지 않고 페이지에 측정 스크립트만 끼워 넣음)
// node explore/gpu/cdp-measure.mjs <이름> <gpu|hwoff|nowebgl> <url> [측정초=8] [대기초=6]
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const [name, mode, url, secs = '8', warm = '6'] = process.argv.slice(2)
const port = 9300 + Math.floor(Math.random() * 500)
const prof = fs.mkdtempSync(path.join(process.env.BENCH_TMP || os.tmpdir(), 'cdpprof-'))
if (mode === 'hwoff' || mode === 'nowebgl') fs.writeFileSync(path.join(prof, 'Local State'), JSON.stringify({ hardware_acceleration_mode: { enabled: false } }))
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  `--user-data-dir=${prof}`, `--remote-debugging-port=${port}`, '--headless=new', '--no-first-run', '--window-size=1920,1080', ...(mode === 'nowebgl' ? ['--disable-webgl'] : []), 'about:blank',
], { stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let targets
for (let i = 0; i < 50; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (targets.length) break } catch {} await sleep(200) }
const page = targets.find((t) => t.type === 'page')
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r) => ws.addEventListener('open', r))
let id = 0
const pending = new Map()
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })

await send('Page.enable')
// 모든 rAF 콜백 시각과 긴 작업을 기록
await send('Page.addScriptToEvaluateOnNewDocument', { source: `
  window.__f = []; window.__lt = [];
  (function loop(t){ window.__f.push(t); requestAnimationFrame(loop) })(0);
  try { new PerformanceObserver(l => l.getEntries().forEach(e => window.__lt.push(e.duration))).observe({ type: 'longtask', buffered: true }) } catch (e) {}
` })
const t0 = Date.now()
await send('Page.navigate', { url })
await sleep(Number(warm) * 1000)
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value
const mark = await ev('performance.now()')
await sleep(Number(secs) * 1000)
const res = await ev(`(() => {
  const s = ${mark}, f = window.__f.filter(t => t >= s), gaps = f.slice(1).map((t, i) => t - f[i]);
  const c = document.createElement('canvas').getContext('webgl'); const x = c && c.getExtension('WEBGL_debug_renderer_info');
  return { fps: +(f.length / ((performance.now() - s) / 1000)).toFixed(1), worstGap: Math.round(Math.max(0, ...gaps)),
    p50: Math.round(gaps.sort((a, b) => a - b)[Math.floor(gaps.length / 2)] || 0),
    longTasks: window.__lt.length, longTaskMs: Math.round(window.__lt.reduce((a, b) => a + b, 0)),
    canvases: document.querySelectorAll('canvas').length, renderer: x ? c.getParameter(x.UNMASKED_RENDERER_WEBGL) : null }
})()`)
const shot = await send('Page.captureScreenshot', { format: 'png' })
fs.mkdirSync(path.join(here, 'results'), { recursive: true })
if (shot.result?.data) fs.writeFileSync(path.join(here, 'results', name + '.png'), Buffer.from(shot.result.data, 'base64'))
// 입력 반응: 키를 눌렀다 뗄 때까지 다음 프레임이 나오기까지 걸린 시간
const inputLag = await ev(`new Promise(r => { const s = performance.now(); requestAnimationFrame(() => requestAnimationFrame(() => r(Math.round(performance.now() - s)))) })`)
const out = { name, mode, url, wallSec: Math.round((Date.now() - t0) / 1000), twoFramesMs: inputLag, ...res }
fs.writeFileSync(path.join(here, 'results', name + '.json'), JSON.stringify(out, null, 2))
console.log(JSON.stringify(out))
ws.close(); chrome.kill()
await sleep(1500)
try { fs.rmSync(prof, { recursive: true, force: true }) } catch {}
process.exit(0)
