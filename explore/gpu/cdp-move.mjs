// 저사양 모드 확인용 (2026-11-11). 쉬기 → 키를 눌러 두더지 걷기 → 쉬기 구간별로 장면 그리기 fps(WebGL draw 묶음 수)·rAF fps·긴 작업을 잼
// 모드: gpu | hwoff(Local State 가속 끔 + unsafe-swiftshader) | swsh(--use-angle=swiftshader). 맥에는 WARP가 없어 둘 다 SwiftShader
// node explore/gpu/cdp-move.mjs <name> <gpu|hwoff> <url> [keys=d,a]
// phases: warm 8s -> idle 6s -> hold keys 8s -> release, settle 3s -> idle 6s
import { spawn } from 'node:child_process'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'
const [name, mode, url, keys = 'KeyD,KeyA'] = process.argv.slice(2)
const out = process.env.OUT || path.join(path.dirname(new URL(import.meta.url).pathname), 'results')
fs.mkdirSync(out, { recursive: true })
const port = 9300 + Math.floor(Math.random() * 500)
const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'cdpprof-'))
if (mode === 'hwoff') fs.writeFileSync(path.join(prof, 'Local State'), JSON.stringify({ hardware_acceleration_mode: { enabled: false } }))
const extra = mode === 'hwoff' ? ['--enable-unsafe-swiftshader'] : mode === 'swsh' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : []
const chrome = spawn(process.env.CHROME || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'), [`--user-data-dir=${prof}`, `--remote-debugging-port=${port}`, '--headless=new', '--no-first-run', '--window-size=1920,1080', ...extra, 'about:blank'], { stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let targets; for (let i = 0; i < 50; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (targets.length) break } catch {} await sleep(200) }
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener('open', r))
let id = 0; const pending = new Map()
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
await send('Page.enable')
await send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__f=[];window.__lt=[];(function loop(t){window.__f.push(t);requestAnimationFrame(loop)})(0);
 const _gc=HTMLCanvasElement.prototype.getContext; window.__draws=[]; HTMLCanvasElement.prototype.getContext=function(...a){const c=_gc.apply(this,a); if(c&&/webgl/.test(a[0])&&!c.__w){c.__w=1; for (const fn of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']){ const o=c[fn]; if(!o) continue; c[fn]=function(...b){ const n=performance.now(); if(!window.__lastDraw||n-window.__lastDraw>4) window.__draws.push(n); window.__lastDraw=n; return o.apply(this,b)} }} return c};
 try{new PerformanceObserver(l=>l.getEntries().forEach(e=>window.__lt.push([e.startTime,e.duration]))).observe({type:'longtask',buffered:true})}catch(e){}` })
await send('Page.navigate', { url })
await sleep(8000)
const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value
const stat = (s, e) => ev(`(()=>{const s=${s},e=${e};const f=__f.filter(t=>t>=s&&t<e),d=__draws.filter(t=>t>=s&&t<e),lt=__lt.filter(x=>x[0]>=s&&x[0]<e);const sec=(e-s)/1000;
 const gaps=f.slice(1).map((t,i)=>t-f[i]).sort((a,b)=>a-b);return{sec:+sec.toFixed(1),rafFps:+(f.length/sec).toFixed(1),renderFps:+(d.length/sec).toFixed(1),rafP50:Math.round(gaps[gaps.length>>1]||0),worstGap:Math.round(gaps[gaps.length-1]||0),longTasks:lt.length,longTaskMs:Math.round(lt.reduce((a,x)=>a+x[1],0))}})()`)
const now = () => ev('performance.now()')
const r = { name, mode, url, renderer: await ev(`(()=>{const c=document.createElement('canvas').getContext('webgl');const x=c&&c.getExtension('WEBGL_debug_renderer_info');return x?c.getParameter(x.UNMASKED_RENDERER_WEBGL):null})()`) }
let a = await now(); await sleep(6000); let b = await now(); r.idle1 = await stat(a, b)
const shot1 = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(out, name + '.png'), Buffer.from(shot1.result.data, 'base64'))
const ks = keys.split(','); a = await now()
for (const k of ks) {
  const key = k.replace('Key', '').toLowerCase(), vk = key.toUpperCase().charCodeAt(0)
  await send('Input.dispatchKeyEvent', { type: 'keyDown', code: k, key, windowsVirtualKeyCode: vk })
  await sleep(8000 / ks.length)
  await send('Input.dispatchKeyEvent', { type: 'keyUp', code: k, key, windowsVirtualKeyCode: vk })
}
b = await now(); r.moving = await stat(a, b)
await sleep(3000); a = await now(); await sleep(6000); b = await now(); r.idle2 = await stat(a, b)
const shot2 = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(out, name + '-after.png'), Buffer.from(shot2.result.data, 'base64'))
r.twoFramesMs = await ev(`new Promise(r=>{const s=performance.now();requestAnimationFrame(()=>requestAnimationFrame(()=>r(Math.round(performance.now()-s))))})`)
fs.writeFileSync(path.join(out, name + '.json'), JSON.stringify(r, null, 2)); console.log(JSON.stringify(r))
ws.close(); chrome.kill(); await sleep(1000); try { fs.rmSync(prof, { recursive: true, force: true }) } catch {}; process.exit(0)
