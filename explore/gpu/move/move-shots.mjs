// 이동 도중 화질 비교용 스크린샷 (2026-11-17, docs/explore-move-quality.md)
// node explore/gpu/move/move-shots.mjs <out폴더> <name> <gpu|hwoff> <url> <키...>
//  - url 에 ?qshot=1&movefreeze=0_5 처럼 넣으면 카메라 이동이 그 지점에서 멈춤 (holeField). movefreeze 가 없으면 도착 뒤 STOPWAIT ms
//  - Math.random 고정 시드(목 데이터·두더지 처음 자세가 같게), 장면이 차려지고 WAIT ms(선명한 배경 굽기) 뒤 키를 누름
//  - 찍기 전 UI 를 숨기고 캔버스만 (숨겨 둔 캔버스는 그대로 숨김)
//  - 결과: <out>/<name>.png + .json (장면 사각형·렌더러·__captures)
import { spawn } from 'node:child_process'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'
const [out, name, mode, url, ...keys] = process.argv.slice(2)
fs.mkdirSync(out, { recursive: true })
const exe = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'mvshot-'))
if (mode === 'hwoff') fs.writeFileSync(path.join(prof, 'Local State'), JSON.stringify({ hardware_acceleration_mode: { enabled: false } }))
const port = 9300 + Math.floor(Math.random() * 500)
const args = [`--user-data-dir=${prof}`, `--remote-debugging-port=${port}`, '--headless=new', '--no-first-run', '--window-size=1920,1080', 'about:blank']
const chrome = process.env.AFF ? spawn('cmd', ['/c', 'start', '""', '/wait', '/affinity', process.env.AFF, exe, ...args], { stdio: 'ignore' }) : spawn(exe, args, { stdio: 'ignore' })
let targets; for (let i = 0; i < 60; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (targets.find((t) => t.type === 'page')) break } catch {} await sleep(200) }
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener('open', r))
let id = 0; const pending = new Map()
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value
await send('Page.enable')
await send('Page.addScriptToEvaluateOnNewDocument', { source: `(()=>{let a=0x2F6E2B1;Math.random=function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}})();
try{localStorage.setItem('digul.gpuNotice.dismissed','1')}catch(e){};window.__slide={n:0,gap:[]}` })
await send('Page.navigate', { url })
for (let i = 0; i < 400; i++) { if (await ev('window.__sceneReadyAt')) break; await sleep(100) }
await sleep(+(process.env.WAIT || 5000))
for (const k of keys) {
  const vk = { ArrowRight: 39, ArrowLeft: 37, ArrowUp: 38, ArrowDown: 40 }[k]
  await send('Input.dispatchKeyEvent', { type: 'keyDown', code: k, key: k, windowsVirtualKeyCode: vk })
  await sleep(60)
  await send('Input.dispatchKeyEvent', { type: 'keyUp', code: k, key: k, windowsVirtualKeyCode: vk })
  await sleep(+(process.env.STOPWAIT || 3500))
}
await ev(`(()=>{const s=document.createElement('style');s.textContent='body *{visibility:hidden!important;transition:none!important} canvas{visibility:visible!important} canvas[style*="visibility: hidden"]{visibility:hidden!important}';document.head.appendChild(s)})()`)
await sleep(800)
const info = await ev(`({mole:window.__moleRect??null,renderer:(()=>{const c=document.createElement('canvas').getContext('webgl');const x=c&&c.getExtension('WEBGL_debug_renderer_info');return x?c.getParameter(x.UNMASKED_RENDERER_WEBGL):null})(),dpr:devicePixelRatio,captures:window.__captures??null,slide:window.__slide,seat:(location.hash.match(/seat=(\\d+)/)||[])[1]||null})`)
const shot = await send('Page.captureScreenshot', { format: 'png' })
fs.writeFileSync(path.join(out, name + '.png'), Buffer.from(shot.result.data, 'base64'))
fs.writeFileSync(path.join(out, name + '.json'), JSON.stringify({ name, mode, url, keys, ...info }, null, 2))
console.log(JSON.stringify({ name, seat: info.seat, captures: info.captures?.slice(-8), slideN: info.slide?.n }))
try { await send('Browser.close') } catch {}
ws.close(); chrome.kill(); await sleep(800)
try { fs.rmSync(prof, { recursive: true, force: true }) } catch {}
process.exit(0)
