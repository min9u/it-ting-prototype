// 탐색 들판 줌 3단계 스크린샷 (2026-11-18, docs/explore-field-v3-10.md)
// node explore/gpu/zoom/zoom-shots.mjs <기본 주소> <결과 폴더> <gpu|hwoff> [이름 거르기]
//   기본 주소 예: http://localhost:5344 (일반 빌드 vite preview) 또는 http://localhost:5344/# (공유 빌드)
// - 새 프로필 헤드리스 크롬 1920×1080. hwoff = 그래픽 가속 끔(이 PC 는 WARP), 저사양 경로(배경 굽기·선명한 배경·옮겨 그리기)
// - 화면마다: 주소를 열고 장면이 다 차려질 때까지(engine.ts __sceneReadyAt) + 기다림 → 동작(키·기다림) → 찍기. 콘솔 에러·예외를 모음
// - 결과: <폴더>/<이름>.png + shots.json (에러, 걸린 시간)
import { spawn } from 'node:child_process'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'
const [base, outDir, mode = 'gpu', only] = process.argv.slice(2)
if (!base || !outDir) { console.error('사용: node zoom-shots.mjs <기본 주소> <결과 폴더> <gpu|hwoff> [이름 거르기]'); process.exit(2) }
fs.mkdirSync(outDir, { recursive: true })
const exe = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const E = '/burrow/explore'
const F3 = encodeURIComponent('2026 하반기|서울|3') // 서울-3층: 61자리 → 구역 3개 (사과)
const F12 = encodeURIComponent('2026 하반기|서울|12') // 서울-12층: 17자리 → 구역 1개 (딸기)
const D1 = encodeURIComponent('2026 하반기|대전|1') // 대전-1층 → 고구마
const D2 = encodeURIComponent('2026 하반기|대전|2') // 대전-2층 → 당근
const KEY = { '-': ['Minus', '-', 189], '+': ['Equal', '+', 187], right: ['ArrowRight', 'ArrowRight', 39], left: ['ArrowLeft', 'ArrowLeft', 37], up: ['ArrowUp', 'ArrowUp', 38], down: ['ArrowDown', 'ArrowDown', 40] }
/** 찍을 것: 이름, 주소, 동작([키] 또는 숫자 = 기다림 ms), 찍기 전 기다림 */
const SHOTS = [
  { name: 'near-mine', url: `${E}?panel=closed`, wait: 2500 },
  { name: 'mid-mine', url: `${E}?panel=closed&zoom=mid`, wait: 2500 },
  { name: 'far-mine', url: `${E}?panel=closed&zoom=far`, wait: 2500 },
  // 켠 구역(1·2)과 안 켠 구역(3·5) 경계: 내 들판 남쪽 왼쪽 끝 구멍(구역 1 서쪽 끝)
  { name: 'near-edge-west', url: `${E}?panel=closed&seat=1`, wait: 2500 },
  { name: 'mid-edge-west', url: `${E}?panel=closed&seat=1&zoom=mid`, wait: 2500 },
  { name: 'far-3zones', url: `${E}?panel=closed&floor=${F3}&zoom=far`, wait: 2500 },
  { name: 'mid-3zones-link', url: `${E}?panel=closed&floor=${F3}&zoom=mid&seat=51`, wait: 2500 },
  { name: 'far-1zone', url: `${E}?panel=closed&floor=${F12}&zoom=far`, wait: 2500 },
  // 흙 노드를 뺀 같은 장면 (흙 메시 가장자리 색이 잔디 바닥과 같은지 비교용, holeField ?fhide=soil)
  { name: 'far-1zone-nosoil', url: `${E}?panel=closed&floor=${F12}&zoom=far&fhide=soil`, wait: 2500 },
  { name: 'far-3zones-nosoil', url: `${E}?panel=closed&floor=${F3}&zoom=far&fhide=soil`, wait: 2500 },
  { name: 'near-strawberry', url: `${E}?panel=closed&floor=${F12}`, wait: 2500 },
  { name: 'near-sweetpotato', url: `${E}?panel=closed&floor=${D1}`, wait: 2500 },
  { name: 'near-carrot', url: `${E}?panel=closed&floor=${D2}`, wait: 2500 },
  { name: 'near-apple', url: `${E}?panel=closed&floor=${F3}`, wait: 2500 },
  // 패널 열림 + 줌 단계 전환 (키)
  { name: 'panel-far-key', url: `${E}`, steps: [['-'], 1800, ['-'], 2500], wait: 1500 },
  { name: 'panel-near-back', url: `${E}?zoom=far`, steps: [['+'], 1800, ['+'], 2500], wait: 1500 },
  // 줌 전환 도중 (?zoomfreeze=0_5: 전환 가운데에서 멈춤) — 저사양은 지금 그림 + 미리 구운 도착 그림을 옮겨 그리는 중
  { name: 'tr-near-mid', url: `${E}?panel=closed&zoomfreeze=0_5`, steps: [['-'], 3000], wait: 500 },
  { name: 'tr-mid-far', url: `${E}?panel=closed&zoom=mid&zoomfreeze=0_5`, steps: [['-'], 3000], wait: 500 },
  { name: 'tr-far-mid', url: `${E}?panel=closed&zoom=far&zoomfreeze=0_5`, steps: [['+'], 3000], wait: 500 },
  // 관심사 이펙트 추천 묶음 켜고 (?fx=rec, lib/fxLab.ts) far · mid · near
  { name: 'fx-far', url: `${E}?zoom=far&fx=rec`, wait: 3000 },
  { name: 'fx-mid', url: `${E}?zoom=mid&fx=rec`, wait: 3000 },
  { name: 'fx-near', url: `${E}?fx=rec`, wait: 3000 },
]

async function shot(s) {
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'zoomshot-'))
  if (mode === 'hwoff') fs.writeFileSync(path.join(prof, 'Local State'), JSON.stringify({ hardware_acceleration_mode: { enabled: false } }))
  const port = 9300 + Math.floor(Math.random() * 500)
  const chrome = spawn(exe, [`--user-data-dir=${prof}`, `--remote-debugging-port=${port}`, '--headless=new', '--no-first-run', '--no-default-browser-check', '--window-size=1920,1080', 'about:blank'], { stdio: 'ignore' })
  let targets; for (let i = 0; i < 60; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (targets.find((t) => t.type === 'page')) break } catch {} await sleep(200) }
  const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener('open', r))
  let id = 0; const pending = new Map(); const errors = []
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data)
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
    else if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails?.exception?.description?.slice(0, 300) ?? m.params.exceptionDetails?.text)
    else if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) errors.push(`${m.params.type}: ${m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 300)}`)
  })
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
  const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value
  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false })
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `(()=>{let a=0x2F6E2B1;Math.random=function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}})();try{localStorage.setItem('digul.gpuNotice.dismissed','1')}catch(e){}` })
  const t0 = Date.now()
  await send('Page.navigate', { url: base + s.url })
  for (let i = 0; i < 600; i++) { if (await ev('!!window.__sceneReadyAt')) break; await sleep(100) }
  const readyMs = Date.now() - t0
  await sleep(1500)
  for (const st of s.steps ?? []) {
    if (typeof st === 'number') { await sleep(st); continue }
    const [code, key, vk] = KEY[st[0]]
    await send('Input.dispatchKeyEvent', { type: 'keyDown', code, key, windowsVirtualKeyCode: vk, text: key.length === 1 ? key : undefined })
    await send('Input.dispatchKeyEvent', { type: 'keyUp', code, key, windowsVirtualKeyCode: vk })
  }
  await sleep(s.wait ?? 2000)
  const renderer = await ev(`(()=>{const c=document.createElement('canvas').getContext('webgl');const x=c&&c.getExtension('WEBGL_debug_renderer_info');return x?c.getParameter(x.UNMASKED_RENDERER_WEBGL):null})()`)
  const url = await ev('location.href')
  const r = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(outDir, `${s.name}.png`), Buffer.from(r.result.data, 'base64'))
  ws.close(); chrome.kill()
  await sleep(300)
  try { fs.rmSync(prof, { recursive: true, force: true }) } catch {}
  return { name: s.name, readyMs, url, renderer, errors }
}

const out = []
for (const s of SHOTS) {
  if (only && !s.name.includes(only)) continue
  const r = await shot(s)
  console.log(`${r.name}: ${r.readyMs}ms ${r.errors.length ? '에러 ' + r.errors.length : ''} ${r.url}`)
  for (const e of r.errors) console.log('   ', e)
  out.push(r)
}
fs.writeFileSync(path.join(outDir, `shots-${mode}.json`), JSON.stringify(out, null, 2))
