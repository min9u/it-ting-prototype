// 빌드에 넣을 고해상도 정지 그림 찍기 (2026-11-16, docs/rendering-experiments-3.md 4번)
// node explore/gpu/make-stills.mjs [이름 ...]   (공유 빌드를 BASE(기본 http://localhost:5341) 에 띄워 둔 상태에서)
// - 그래픽 가속 켠 헤드리스 크롬(새 프로필, 이 PC 는 RTX)으로 화면을 열고, 다 차려진 뒤 3D 캔버스만 보이게 해서(배경 투명) 찍음
// - 기기 배율 DSF(기본 1.5) → 1920×1080 화면이면 2880×1620 픽셀로 그려짐 (GPU 고화질: 안티앨리어싱·그림자·후처리)
// - 땅굴 방은 ?stillshot=1 로 4:3 구도 상자를 화면 안에 다 들어오게 하고(roomScene) 그 상자만 잘라 찍음
// - 결과: app/src/assets/stills/<이름>.webp (three/stills.ts 가 씀). 긴 변을 MAXW 로 줄임 (PIL, 고품질 축소)
import { spawn, execFileSync } from 'node:child_process'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { fileURLToPath } from 'node:url'
const here = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(here, '..', '..', 'app', 'src', 'assets', 'stills')
fs.mkdirSync(outDir, { recursive: true })
const BASE = process.env.BASE || 'http://localhost:5341/#'
const DSF = +(process.env.DSF || 1.5)
// 맥: CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' CHROME_FLAGS='--use-angle=metal --enable-gpu' PYTHON=python3 BASE=http://localhost:5199 (개발 서버, # 없는 브라우저 라우터)
const exe = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const extraFlags = (process.env.CHROME_FLAGS || '').split(' ').filter(Boolean)
const py = process.env.PYTHON || 'python'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** 찍을 것: 주소, 자를 곳(box = 땅굴 4:3 상자, canvas = 캔버스 사각형, sel = 그 요소), 기다릴 시간, 줄일 긴 변 */
const SHOTS = [
  { name: 'room', url: '/start?stillshot=1', clip: 'box', wait: 3500, maxw: 2048, note: '랜딩 방 (관심사 6개, 연출 없음) = 내 땅굴·온보딩 미리 보기 대신' },
  { name: 'visit', url: '/burrow/yerin?stillshot=1', clip: 'box', wait: 6000, maxw: 2048, note: '남의 땅굴 (집주인 + 나)' },
  { name: 'field', url: '/burrow/explore?stillshot=1', clip: 'canvas', wait: 5000, maxw: 1920, note: '탐색 들판 (서울-2층, 내 자리)' },
  { name: 'landing', url: '/start?stillshot=1', clip: 'canvas', wait: 5000, maxw: 1920, note: '랜딩·둘러보기 밭' },
  { name: 'tea-duo', url: '/chat/r-yerin?stillshot=1', clip: 'canvas', wait: 3000, maxw: 1200, note: '찻방 1:1 두더지 (투명 배경)' },
  { name: 'tea-group', url: '/chat/g-m1?stillshot=1', clip: 'canvas', wait: 3000, maxw: 1200, note: '찻방 모임 두더지 5마리 (투명 배경)' },
]
const only = process.argv.slice(2)

async function shoot(s) {
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'stills-'))
  const port = 9300 + Math.floor(Math.random() * 500)
  const chrome = spawn(exe, [`--user-data-dir=${prof}`, `--remote-debugging-port=${port}`, '--headless=new', '--no-first-run', ...extraFlags, '--window-size=1920,1080', 'about:blank'], { stdio: 'ignore' })
  let targets; for (let i = 0; i < 60; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (targets.find((t) => t.type === 'page')) break } catch {} await sleep(200) }
  const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener('open', r))
  let id = 0; const pending = new Map()
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
  const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value
  await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: DSF, mobile: false })
  // 같은 그림이 나오게 고정 시드 난수 (cdp-quality.mjs 와 같은 mulberry32), 안내 띠 닫음
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `(()=>{let a=0x2F6E2B1;Math.random=function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}})();
try{localStorage.setItem('digul.gpuNotice.dismissed','1')}catch(e){}` })
  await send('Page.navigate', { url: BASE + s.url })
  for (let i = 0; i < 400; i++) { if (await ev('window.__sceneReadyAt')) break; await sleep(100) }
  await sleep(s.wait)
  const renderer = await ev(`(()=>{const c=document.createElement('canvas').getContext('webgl');const x=c&&c.getExtension('WEBGL_debug_renderer_info');return x?c.getParameter(x.UNMASKED_RENDERER_WEBGL):null})()`)
  // 3D 캔버스만 보이게, 배경 투명
  await ev(`(()=>{const st=document.createElement('style');st.textContent='html,body{background:transparent!important} body *{visibility:hidden!important;transition:none!important;animation:none!important} canvas{visibility:visible!important}';document.head.appendChild(st)})()`)
  await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } })
  await sleep(800)
  let clip
  if (s.clip === 'box') clip = await ev('window.__stillBox')
  else clip = await ev(`(()=>{const cs=[...document.querySelectorAll('canvas')].filter(c=>{const r=c.getBoundingClientRect();let o=1;for(let e=c;e;e=e.parentElement)o*=+getComputedStyle(e).opacity;return r.width>50&&o>0.5});cs.sort((a,b)=>b.getBoundingClientRect().width*b.getBoundingClientRect().height-a.getBoundingClientRect().width*a.getBoundingClientRect().height);const r=cs[0].getBoundingClientRect();return{x:Math.max(0,r.left),y:Math.max(0,r.top),w:Math.min(r.width,1920-Math.max(0,r.left)),h:Math.min(r.height,1080-Math.max(0,r.top))}})()`)
  const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: clip.x, y: clip.y, width: clip.w, height: clip.h, scale: 1 }, captureBeyondViewport: true })
  const raw = path.join(prof, 'raw.png')
  fs.writeFileSync(raw, Buffer.from(shot.result.data, 'base64'))
  // 줄이고 webp 로 (알파 유지)
  const out = path.join(outDir, `${s.name}.webp`)
  const info = execFileSync(py, ['-I', '-c', `
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert('RGBA')
m = int(sys.argv[3])
if max(im.size) > m:
    k = m / max(im.size)
    im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
a = im.getchannel('A')
opaque = a.getextrema()[0] == 255
(im.convert('RGB') if opaque else im).save(sys.argv[2], 'WEBP', quality=86, method=6)
print(im.width, im.height, 'opaque' if opaque else 'alpha')
`, raw, out, String(s.maxw)], { encoding: 'utf8' }).trim().split(' ')
  try { await send('Browser.close') } catch {}
  ws.close(); chrome.kill(); await sleep(800)
  try { fs.rmSync(prof, { recursive: true, force: true }) } catch {}
  return { name: s.name, width: +info[0], height: +info[1], alpha: info[2] === 'alpha', bytes: fs.statSync(out).size, renderer, clip, note: s.note }
}

const res = []
for (const s of SHOTS) { if (only.length && !only.includes(s.name)) continue; const r = await shoot(s); console.log(JSON.stringify(r)); res.push(r) }
// 크기 목록 (three/stills.ts 의 STILLS 에 옮겨 적음). 일부만 다시 찍으면 나머지는 그대로
const listP = path.join(here, 'results', 'round3', 'stills.json')
fs.mkdirSync(path.dirname(listP), { recursive: true })
let list = []; try { list = JSON.parse(fs.readFileSync(listP, 'utf8')) } catch {}
for (const r of res) { list = list.filter((x) => x.name !== r.name); list.push({ name: r.name, width: r.width, height: r.height, alpha: r.alpha, bytes: r.bytes, renderer: r.renderer, note: r.note }) }
fs.writeFileSync(listP, JSON.stringify(list, null, 1))
process.exit(0)
