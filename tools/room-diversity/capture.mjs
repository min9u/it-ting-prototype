// 땅굴 다양성 비교: 사람마다 같은 구도로 땅굴 찍기 (2026-11-18, docs/room-diversity-2026-11-18.md)
// 설치 패키지 없음 (헤드리스 크롬 + CDP 직접, tools/guide-page/shoot.mjs 와 같은 방식)
//
// 사용 (저장소 루트에서, 먼저 cd app && npm run build)
//   node tools/room-diversity/capture.mjs               # personas.json 전부 → out/raw/<key>.png + <key>.json
//   node tools/room-diversity/capture.mjs --only=a13    # 키에 a13 이 들어간 것만
//   node tools/room-diversity/capture.mjs --check       # 실험 경로와 실제 방문자 뷰(/burrow/yerin)가 같은 방인지 볼 사진 (out/check/)
// 옵션: --gpu=on|off (기본 on = 그래픽 가속 켬), --width=1440 --height=900, --wait=2500 (장면이 다 차려진 뒤 더 기다림 ms)
//
// 찍는 법
// - 앱의 실험 경로 /lab/rooms (app/src/screens/lab/RoomsLab.tsx): 방문자 뷰와 같은 RoomView · 헤더 아래 같은 크기 · 방 정보 패널을 접은 구도
// - 입장 연출이 끝난 상태와 같은 "다 차려진 방"(still), 관심사 이펙트 끔(?fx=0, 지금 기본값도 꺼짐)
// - 두더지 자세는 ?qshot=1 로 멈춤(roomScene). Math.random 은 고정 시드 (explore/gpu/cdp-quality.mjs 와 같음) → 방마다 두더지 자세가 같음
// - 분석용으로는 두더지를 숨기고(?nomole=1) 한 번 더 찍음 (두더지가 방 가운데 약 15%를 가려서)
// - 장면 div([data-owner]) 사각형만 PNG 로 (헤더 제외)
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../..')
const DIST = path.join(ROOT, 'app/dist')
const OUT = path.join(HERE, 'out')
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = /^--([^=]+)(?:=(.*))?$/.exec(a); return m ? [m[1], m[2] ?? true] : [a, true] }))
const GPU = String(args.gpu ?? 'on')
const W = +(args.width ?? 1440), H = +(args.height ?? 900), WAIT = +(args.wait ?? 2500)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.error('app/dist 가 없어요. 먼저 cd app && npm run build'); process.exit(2) }

/* ---------- dist 정적 서버 (SPA) ---------- */
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

/* ---------- 크롬 ---------- */
function chromePath() {
  if (process.env.CHROME) return process.env.CHROME
  const c = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome']
  const hit = c.find((p) => fs.existsSync(p))
  if (!hit) throw new Error('크롬을 못 찾았어요. CHROME=<경로>')
  return hit
}
const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'room-div-'))
const flags = [`--user-data-dir=${prof}`, '--headless=new', '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--mute-audio', '--remote-debugging-port=0', `--window-size=${W},${H}`, 'about:blank']
if (GPU === 'off') { fs.writeFileSync(path.join(prof, 'Local State'), JSON.stringify({ hardware_acceleration_mode: { enabled: false } })); flags.unshift('--disable-gpu') }
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
let seq = 0
const pending = new Map(), logs = []
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result) }
  else if (m.method === 'Runtime.exceptionThrown') logs.push(`예외: ${m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text}`)
  else if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) logs.push(`console.${m.params.type}: ${m.params.args.map((a) => a.value ?? a.description).join(' ')}`)
})
const send = (method, params = {}) => new Promise((resolve, reject) => { const i = ++seq; pending.set(i, { resolve, reject }); ws.send(JSON.stringify({ id: i, method, params })) })
const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.value
async function waitFor(expr, ms) {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) { if (await ev(expr)) return true; await sleep(150) }
  return false
}

await send('Page.enable'); await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false })
// 고정 시드 난수 (mulberry32) + 저사양 안내 띠 닫음
await send('Page.addScriptToEvaluateOnNewDocument', { source: `(()=>{let a=0x2F6E2B1;Math.random=function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}})();try{localStorage.setItem('digul.gpuNotice.dismissed','1')}catch(e){}` })

/** 한 장: 주소 열고 → 장면이 다 차려지면 → 기다렸다가 장면 div 만 찍음 */
async function shoot(url, outPng, { hideUi = false, before } = {}) {
  logs.length = 0
  await send('Page.navigate', { url })
  const ok = await waitFor('!!window.__sceneReadyAt', 45000)
  if (!ok) console.warn(`  ! 장면이 45초 안에 안 차려짐: ${url}`)
  if (before) await before()
  await sleep(WAIT)
  // 방 위 리액션 버튼 줄(👋 인사 …)은 방이 아니라 화면 UI 라 숨김 (방문자 뷰에도 같은 자리에 있음)
  await ev(`(()=>{const s=document.createElement('style');s.textContent='[data-owner] [role=toolbar]{visibility:hidden!important}';document.head.appendChild(s)})()`)
  await sleep(150)
  if (hideUi) {
    // 비교 확인용: 캔버스만 남김 (방문자 뷰의 버튼·말풍선을 지움, explore/gpu/cdp-quality.mjs 와 같은 방법)
    await ev(`(()=>{const s=document.createElement('style');s.textContent='body *{visibility:hidden!important;transition:none!important} canvas{visibility:visible!important}';document.head.appendChild(s)})()`)
    await sleep(600)
  }
  const info = await ev(`(()=>{const el=document.querySelector('[data-owner]');const r=el?el.getBoundingClientRect():{left:0,top:0,width:innerWidth,height:innerHeight};return {scene:{x:r.left,y:r.top,w:r.width,h:r.height},mole:window.__moleRect??null,lab:window.__roomLab??null,readyAt:window.__sceneReadyAt??null}})()`)
  const s = info.scene
  const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: s.x, y: s.y, width: s.w, height: s.h, scale: 1 } })
  fs.mkdirSync(path.dirname(outPng), { recursive: true })
  fs.writeFileSync(outPng, Buffer.from(shot.data, 'base64'))
  return { ...info, url: url.replace(base, ''), logs: [...logs] }
}

// 이 크롬이 실제로 쓰는 그래픽 (새로 만든 캔버스로 확인)
await send('Page.navigate', { url: `${base}/screens` })
await sleep(800)
const renderer = await ev(`(()=>{const c=document.createElement('canvas').getContext('webgl');const x=c&&c.getExtension('WEBGL_debug_renderer_info');return x?c.getParameter(x.UNMASKED_RENDERER_WEBGL):null})()`)
console.log(`그래픽: ${renderer}`)

const personas = JSON.parse(fs.readFileSync(path.join(HERE, 'personas.json'), 'utf8'))
const q = (o) => Object.entries(o).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
const jobs = [
  ...personas.a.map((p) => ({ key: p.key, group: 'a', persona: p, query: q({ interests: p.interests.join(','), name: p.name }) })),
  ...personas.b.seats.map((n) => ({ key: `b-seat${String(n).padStart(2, '0')}`, group: 'b', seat: n, query: q({ seat: n }) })),
  ...(personas.b.me ? [{ key: 'b-me', group: 'b', me: true, query: q({ user: 'me' }) }] : []),
  // 비교 기준: 관심사 0개 = 모든 방에 늘 있는 것만 (분석의 26개 방에는 안 들어감)
  { key: 'z-empty', group: 'z', query: q({ interests: '', name: '빈 방' }) },
]
const only = args.only ? String(args.only) : null
const meta = { renderer, gpu: GPU, viewport: [W, H], wait: WAIT, date: new Date().toISOString(), items: [] }
// 세 번 찍음: raw = 방문자 뷰 그대로(두더지 있음, 벽지도 관심사로) · raw-nomole = 두더지만 숨김(?nomole=1, 방만 비교) ·
// raw-wall01 = 두더지 숨김 + 벽지를 모두 01 기본으로 고정 (가구·소품 차이만 보려고)
const PASSES = [
  { dir: 'raw', extra: '' },
  { dir: 'raw-nomole', extra: '&nomole=1' },
  { dir: 'raw-wall01', extra: '&nomole=1&wallpaper=wallpaper_01_default' },
]

// 찍은 묶음 (2026-11-18 2단계 전·후 비교): out/<set>/raw… . 전 = out/before (11-18 1차 비교 때 찍은 그림, 같은 PC · 같은 앱 코드),
// 후 = out/after (기본). --look=designer 면 🎨 땅굴 색 다양하게를 끄고(디자이너 원래 색) 찍음 (lib/roomLookLab.ts)
const SET = String(args.set ?? 'after')
const LOOK = args.look ? `&look=${args.look}` : ''
meta.set = SET; meta.look = args.look ?? 'auto'
if ((!args.check && !args.me) || args.all) {
  for (const pass of PASSES) {
    if (args.pass && args.pass !== pass.dir) continue
    for (const j of jobs) {
      if (only && !j.key.includes(only)) continue
      const t0 = Date.now()
      const r = await shoot(`${base}/lab/rooms?${j.query}${pass.extra}&bare=1&qshot=1&fx=${args.fx ?? 0}${LOOK}`, path.join(OUT, SET, pass.dir, `${j.key}.png`))
      const rec = { key: j.key, group: j.group, kind: j.persona?.kind ?? (j.me ? '내 땅굴' : j.group === 'z' ? '기준' : '들판 이웃'), seat: j.seat ?? null, ...r }
      fs.writeFileSync(path.join(OUT, SET, pass.dir, `${j.key}.json`), JSON.stringify(rec, null, 2))
      meta.items.push(j.key)
      console.log(`${SET}/${pass.dir}/${j.key}  ${r.lab?.owner?.nickname ?? '?'}  관심사 ${r.lab?.owner?.interests?.length ?? '?'} · 놓인 것 ${r.lab?.summary?.items?.length ?? '?'} · ${r.lab?.summary?.look?.style?.theme ?? '디자이너 색'}  (${((Date.now() - t0) / 1000).toFixed(1)}초)${r.logs.filter((l) => !/HydrateFallback/.test(l)).length ? `  로그: ${r.logs.slice(0, 3).join(' | ')}` : ''}`)
    }
    if (!only) fs.writeFileSync(path.join(OUT, SET, pass.dir, '_capture.json'), JSON.stringify(meta, null, 2))
  }
}

if (args.check) {
  // 실험 경로와 실제 방문자 뷰가 같은 방인지: 둘 다 캔버스만 남기고 같은 크기로 찍어서 analyze.py --check 로 비교
  const dir = path.join(OUT, 'check')
  const lab = await shoot(`${base}/lab/rooms?user=yerin&bare=1&qshot=1&fx=0`, path.join(dir, 'lab-yerin.png'), { hideUi: true })
  const real = await shoot(`${base}/burrow/yerin?fx=0`, path.join(dir, 'visit-yerin.png'), {
    hideUi: true,
    // 입장 연출(천장 구멍 · 두더지 · 가구 낙하 약 2초)이 끝나길 기다린 뒤 방 정보 패널 접기
    before: async () => { await sleep(6000); await ev(`[...document.querySelectorAll('button')].find((b)=>b.textContent.includes('접기'))?.click()`); await sleep(1500) },
  })
  fs.writeFileSync(path.join(dir, 'check.json'), JSON.stringify({ renderer, lab, real }, null, 2))
  console.log(`확인용: ${path.relative(ROOT, dir)} (lab ${lab.logs.length} · visit ${real.logs.length} 로그)`)
}

if (args.me) {
  // 1단계 확인 (2026-11-18, docs/room-diversity-2-2026-11-18.md): "나"를 내 땅굴(/burrow)과 남이 보는 내 땅굴(/lab/rooms?user=me = 방문자 뷰와 같은
  // 땅굴 API 길)로 찍어서 같은 방인지. 두더지는 숨기고(nomole), 내 땅굴의 입장 연출은 "움직임 줄이기"로 끔(= 다 차려진 방), 캔버스만 남김
  // → check.py 로 비교. --me=decor 면 꾸미기 값(가구 선택 · 직접 고른 벽지)을 넣어 두고 찍음
  const dir = path.join(OUT, 'check-me')
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  await send('Page.navigate', { url: `${base}/screens` }); await sleep(600)
  // 우체통: 내 땅굴은 "새 방명록" 이면 깃발이 올라가서(방 모습과 상관없는 상태) 읽음으로 맞춰 둠
  await ev(`sessionStorage.setItem('digul.guestbookRead','1')`)
  if (args.me === 'decor') {
    // 내 관심사 소설(sf_books)의 가구를 두 번째 후보로, 벽지는 07 숲 · 색 테마는 오락실로 저장해 둠 (sessionStorage, data/myBurrow)
    await ev(`sessionStorage.setItem('digul.myFurnitureBySub', JSON.stringify({novel:'book_stack'}));sessionStorage.setItem('digul.myRoom.v1', JSON.stringify({wallpaperId:'wallpaper_07_forest',themeId:'cat_game'}))`)
  }
  const tag = args.me === 'decor' ? '-decor' : ''
  const mine = await shoot(`${base}/burrow?panel=closed&nomole=1&qshot=1&fx=0`, path.join(dir, `my${tag}.png`), { hideUi: true })
  mine.look = await ev('window.__roomLook ?? null')
  const seen = await shoot(`${base}/lab/rooms?user=me&nomole=1&bare=1&qshot=1&fx=0`, path.join(dir, `visit${tag}.png`), { hideUi: true })
  seen.look = await ev('window.__roomLook ?? null')
  fs.writeFileSync(path.join(dir, `check${tag}.json`), JSON.stringify({ renderer, mine, seen }, null, 2))
  console.log(`나: 내 땅굴 벽지 ${mine.look?.wallpaper} · 남이 보는 내 땅굴 벽지 ${seen.look?.wallpaper} · 가구 ${JSON.stringify(mine.look?.furniture)} / ${JSON.stringify(seen.look?.furniture)}`)
  console.log(`  → ${path.relative(ROOT, dir)} (python -I tools/room-diversity/check.py out/check-me/my${tag}.png out/check-me/visit${tag}.png)`)
}

try { await send('Browser.close') } catch { /* */ }
ws.close(); chrome.kill(); server.close()
await sleep(500)
try { fs.rmSync(prof, { recursive: true, force: true }) } catch { /* */ }
process.exit(0)
