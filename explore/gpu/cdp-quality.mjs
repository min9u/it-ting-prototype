// 같은 장면 스크린샷 (화질 비교용, 2026-11-16, docs/rendering-experiments-2.md)
// node explore/gpu/cdp-quality.mjs <name> <gpu|hwoff> <url(?qshot=1 포함)>
// - Math.random 을 고정 시드로 바꿔서 두더지 처음 자세·목 데이터가 매번 같게, 장면은 ?qshot=1 로 두더지 자세를 멈춤
// - 장면이 다 차려진 뒤(window.__sceneReadyAt) WAIT ms(기본 4000, 선명한 배경 찍기까지) 기다리고, 캔버스만 보이게(나머지 UI 숨김) 찍음
// - 결과: results/quality/<name>.png + <name>.json (장면 사각형·두더지 사각형·렌더러)
// 비교는 explore/gpu/quality.py
import { spawn } from 'node:child_process'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { fileURLToPath } from 'node:url'
const [name, mode, url] = process.argv.slice(2)
const out = process.env.OUT || path.join(path.dirname(fileURLToPath(import.meta.url)), 'results', 'quality')
fs.mkdirSync(out, { recursive: true })
const exe = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'cdpq-'))
if (mode === 'hwoff') fs.writeFileSync(path.join(prof, 'Local State'), JSON.stringify({ hardware_acceleration_mode: { enabled: false } }))
const port = 9300 + Math.floor(Math.random() * 500)
const chrome = spawn(exe, [`--user-data-dir=${prof}`, `--remote-debugging-port=${port}`, '--headless=new', '--no-first-run', '--window-size=1920,1080', 'about:blank'], { stdio: 'ignore' })
let targets; for (let i = 0; i < 60; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (targets.find((t) => t.type === 'page')) break } catch {} await sleep(200) }
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener('open', r))
let id = 0; const pending = new Map()
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value
await send('Page.enable')
// 고정 시드 난수 (mulberry32)
await send('Page.addScriptToEvaluateOnNewDocument', { source: `(()=>{let a=0x2F6E2B1;Math.random=function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}})();
try{localStorage.setItem('digul.gpuNotice.dismissed','1')}catch(e){}` })
if (process.env.LAB) await send('Page.addScriptToEvaluateOnNewDocument', { source: `try{localStorage.setItem('digul.lowlab.v2', ${JSON.stringify(process.env.LAB)})}catch(e){}` })
await send('Page.navigate', { url })
for (let i = 0; i < 400; i++) { if (await ev('window.__sceneReadyAt')) break; await sleep(100) }
await sleep(+(process.env.WAIT || 4000))
await ev(`(()=>{const s=document.createElement('style');s.textContent='body *{visibility:hidden!important;transition:none!important} canvas{visibility:visible!important}';document.head.appendChild(s)})()`)
await sleep(1500)
const info = await ev(`({mole:window.__moleRect??null,renderer:(()=>{const c=document.createElement('canvas').getContext('webgl');const x=c&&c.getExtension('WEBGL_debug_renderer_info');return x?c.getParameter(x.UNMASKED_RENDERER_WEBGL):null})(),dpr:devicePixelRatio,captures:window.__captures??null})`)
const shot = await send('Page.captureScreenshot', { format: 'png' })
fs.writeFileSync(path.join(out, name + '.png'), Buffer.from(shot.result.data, 'base64'))
fs.writeFileSync(path.join(out, name + '.json'), JSON.stringify({ name, mode, url, ...info }, null, 2))
console.log(JSON.stringify({ name, ...info }))
try { await send('Browser.close') } catch {}
ws.close(); chrome.kill(); await sleep(800)
try { fs.rmSync(prof, { recursive: true, force: true }) } catch {}
process.exit(0)
