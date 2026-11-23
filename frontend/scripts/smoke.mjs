#!/usr/bin/env node
/**
 * 화면 스모크 테스트 (docs/testing-ci.md, Next.js 판: docs/nextjs-migration.md)
 * 빌드한 앱(.next/)을 `next start` 로 띄우고(기본 포트 3100), 시스템 크롬을 헤드리스로 열어 CDP 로 직접 조종한다 (설치 패키지 없음).
 * 화면 목록(src/screens/ScreenIndex.tsx)과 라우트(src/app 의 page.tsx · page.lab.tsx)의 모든 화면을 하나씩 열어
 *   - 콘솔 에러 · 처리 안 된 예외(Promise 포함) · 같은 주소 리소스 실패(4xx·5xx·네트워크 실패)
 *   - 빈 화면(#root 가 비었거나 글·그림이 없음) · 오류 화면("잠시 문제가 생겼어요") · 뜻밖의 "없는 주소" 화면 · 끝나지 않은 로딩 표시
 * 을 잡고 화면마다 스크린샷을 남긴 뒤 표로 출력한다.
 *
 * 사용 (frontend/ 에서)
 *   npm run build && npm run smoke                       # 실험실 꺼진 빌드: /lab · /screens · /dev/crash 는 "없는 주소"가 정상
 *   NEXT_PUBLIC_LABS=1 npm run build && npm run smoke    # 실험실까지 전부
 *   npm run smoke -- --gpu=off            # 그래픽 가속 끔 (소프트웨어 렌더: 윈도우 WARP · 리눅스 SwiftShader)
 *   npm run smoke -- --gpu=none           # WebGL 자체가 없는 경우 (3D 대신 그림이 나오는지)
 *   npm run smoke -- --gpu=swiftshader    # CI 처럼 GPU 없는 곳에서 WebGL 을 SwiftShader 로
 *   npm run smoke -- --url=http://127.0.0.1:3000   # 이미 떠 있는 서버(next dev 등)를 씀 (next start 안 띄움). 실험실 여부는 --labs=on|off 로
 *   npm run smoke -- --only=meetups --wait=8000    # 주소에 meetups 가 들어간 화면만, 화면마다 최대 8초 기다림
 * 옵션: --list (화면 목록만 출력) --settle=2000 (canvas 있는 화면 추가 대기) --port=3100 --width=1440 --height=960 --out=shots/smoke --no-fail (실패가 있어도 종료 코드 0)
 * 환경 변수: CHROME=<크롬 실행 파일>, CI=1 이면 --no-sandbox
 * 결과: 터미널 표 + <out>/<gpu>/report.md · report.json · 화면별 PNG (shots/ 는 .gitignore 의 **\/shots/* 로 커밋 안 됨)
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/* ---------- 옵션 ---------- */
const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(a)
  return m ? [m[1], m[2] ?? true] : [a, true]
}))
const GPU = String(args.gpu ?? 'on')
const PORT = Number(args.port ?? 3100)
const WIDTH = Number(args.width ?? 1440), HEIGHT = Number(args.height ?? 960)
const WAIT = Number(args.wait ?? 7000) // 화면마다 최대 기다림 (load 뒤 네트워크가 조용해질 때까지)
const QUIET = Number(args.quiet ?? 900) // 네트워크가 이만큼 조용하면 다 그렸다고 봄
const SETTLE_3D = Number(args.settle ?? 2000) // canvas 가 있는 화면은 조용해진 뒤 더 기다림
const NEXT_DIR = path.join(APP, '.next')
const OUT = path.resolve(APP, String(args.out ?? 'shots/smoke'), GPU)
const ONLY = args.only ? String(args.only) : null
const NO_FAIL = !!args['no-fail']
if (!['on', 'off', 'none', 'swiftshader'].includes(GPU)) { console.error(`--gpu 는 on | off | none | swiftshader (받은 값: ${GPU})`); process.exit(2) }

/* 화면 판정에 쓰는 글 (components/NotFound.tsx). 문구가 바뀌면 여기만 고치면 됨 */
const ERROR_TEXT = ['잠시 문제가 생겼어요', 'Unexpected Application Error']
const NOT_FOUND_TEXT = '없는 주소예요'
/** 기다린 뒤에도 남아 있으면 "로딩이 안 끝남" 경고 (components/RoomView.tsx · screens/burrow/ExploreBurrow.tsx) */
const LOADING_TEXT = ['땅굴 파는 중', '들판으로 나가는 중']
/**
 * 실험실이 이 빌드에 들어 있는지 (next.config.ts NEXT_PUBLIC_LABS). 빌드 결과의 라우트 목록에 /lab/style 이 있으면 켜짐.
 * --url 로 떠 있는 서버를 쓰면 --labs=on|off (기본: .next 가 있으면 거기서 읽고, 없으면 on)
 */
function labsInBuild() {
  if (args.labs) return String(args.labs) !== 'off'
  try { return Object.values(JSON.parse(fs.readFileSync(path.join(NEXT_DIR, 'app-path-routes-manifest.json'), 'utf8'))).includes('/lab/style') } catch { return true }
}
const LABS = labsInBuild()
/** 실험실 주소 (꺼진 빌드에서는 없는 주소가 정상) */
const LAB_PATHS = [/^\/lab\//, /^\/screens$/, /^\/dev\/crash$/]
/** 일부러 "없음" 화면을 보는 주소 (ScreenIndex 의 00 공통 21 항목) */
const EXPECT_GONE = [/^\/no-such-page/, /^\/gone\//, /^\/meetups\/nope/, /^\/board\/p2[78]$/, /^\/admin(\?as=user)?$/, ...(LABS ? [] : LAB_PATHS)] // /admin: 역할이 없으면 없는 주소처럼 (F11 1)
/** 일부러 오류 화면을 보는 주소: /dev/crash (실험실 켠 빌드에서만 있는 에러 경계 확인용 화면) */
const EXPECT_ERROR = LABS ? [/^\/dev\/crash$/] : []
/** 무시할 콘솔 · 네트워크 메시지 (알려진 소음) */
const IGNORE = [/favicon\.ico/, /GPU stall due to ReadPixels/, /Automatic fallback to software WebGL has been deprecated/,
  // --gpu=none 은 WebGL 이 없는지 보는 검사라 three.js 의 "컨텍스트를 못 만듦" 에러는 예상한 것 (대신 정지 그림이 나오는지는 스크린샷으로)
  ...(GPU === 'none' ? [/WebGL context could not be created|Error creating WebGL context/] : [])]

/* ---------- 화면 목록 ---------- */
/** :param 에 넣을 예시 값 (목 데이터에 있는 것) */
const SAMPLE = { userId: 'yerin', postId: 'p1', id: 'm1', roomId: 'r-yerin', step: 'name', what: 'meetup' }
const SAMPLE_BY_PATH = { '/board/:postId/edit': '/board/p6/edit', '/meetups/:id/edit': '/meetups/m3/edit', '/settings/notices/:id': '/settings/notices/sn2' }

/**
 * src/app 의 page.tsx · page.lab.tsx → 주소 목록. (묶음) 폴더는 주소에서 빠지고 [이름] 은 :이름.
 * Vite 앱 App.tsx 에만 있던 주소: /onboarding (next.config.ts redirects) · 없는 주소(path: '*' → not-found.tsx)
 */
function routesFromApp() {
  const root = path.join(APP, 'src/app')
  const out = []
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const f = path.join(dir, e.name)
      if (e.isDirectory()) walk(f)
      else if (e.name === 'page.tsx' || e.name === 'page.lab.tsx') {
        const segs = path.relative(root, dir).split(path.sep).filter((x) => x && !/^\(.*\)$/.test(x)).map((x) => x.replace(/^\[(\w+)\]$/, ':$1'))
        const p = `/${segs.join('/')}`
        const full = SAMPLE_BY_PATH[p] ?? p.replace(/:(\w+)/g, (_, k) => SAMPLE[k] ?? k)
        out.push({ path: full, label: `라우트 ${p}${e.name === 'page.lab.tsx' ? ' (실험실)' : ''}`, from: 'src/app' })
      }
    }
  }
  walk(root)
  out.sort((a, b) => a.path.localeCompare(b.path))
  out.push({ path: '/onboarding', label: '라우트 /onboarding (→ /onboarding/name)', from: 'next.config' }, { path: '/no-such-page', label: '라우트 * (없는 주소)', from: 'not-found' })
  return out
}
function routesFromScreenIndex() {
  const src = fs.readFileSync(path.join(APP, 'src/screens/ScreenIndex.tsx'), 'utf8')
    .replace(/\$\{encodeURIComponent\('([^']*)'\)\}/g, (_, s) => encodeURIComponent(s))
  return [...src.matchAll(/\[\s*'([^']+)',\s*['`](\/[^'`]*)['`]/g)].map((m) => ({ path: m[2], label: m[1], from: 'ScreenIndex' }))
}
function screens() {
  const seen = new Map()
  for (const r of [...routesFromScreenIndex(), ...routesFromApp()]) if (!seen.has(r.path)) seen.set(r.path, r)
  let list = [...seen.values()]
  if (ONLY) list = list.filter((r) => r.path.includes(ONLY) || r.label.includes(ONLY))
  return list
}

/* ---------- next start (빌드 결과 .next 를 띄움) ---------- */
async function startNext() {
  if (!fs.existsSync(path.join(NEXT_DIR, 'BUILD_ID'))) {
    console.error('.next/BUILD_ID 가 없어요. 먼저 npm run build 하거나 --url 로 떠 있는 서버를 주세요.')
    process.exit(2)
  }
  const bin = path.join(APP, 'node_modules/next/dist/bin/next')
  const child = spawn(process.execPath, [bin, 'start', '-p', String(PORT), '-H', '127.0.0.1'], { cwd: APP, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' } })
  let log = ''
  child.stdout.on('data', (d) => { log += d })
  child.stderr.on('data', (d) => { log += d })
  const base = `http://127.0.0.1:${PORT}`
  for (let i = 0; i < 300; i++) {
    if (child.exitCode != null) { console.error(`next start 가 끝났어요 (code ${child.exitCode})\n${log}`); process.exit(2) }
    try { if ((await fetch(`${base}/start`)).ok) return { close: () => child.kill() } } catch { /* 아직 */ }
    await sleep(100)
  }
  child.kill()
  console.error(`next start 가 30초 안에 뜨지 않았어요\n${log}`)
  process.exit(2)
}

/* ---------- 크롬 ---------- */
function chromePath() {
  if (process.env.CHROME) return process.env.CHROME
  const cands = process.platform === 'win32'
    ? ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`]
    : process.platform === 'darwin'
      ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
      : ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser']
  const hit = cands.find((p) => p && fs.existsSync(p))
  if (!hit) { console.error('크롬을 못 찾았어요. CHROME=<경로> 로 알려 주세요.'); process.exit(2) }
  return hit
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * 크롬 시작 대기 (CI 러너의 SwiftShader 크롬은 가끔 시작이 아주 늦음: 15초 안에 안 떠서 main CI 가 한 번 실패함).
 * 시작이 실패하면(안 뜸 · 바로 끝남 · 디버깅 창을 못 찾음) 크롬을 정리하고 한 번 더 시도. 시험용으로 SMOKE_CHROME_START_MS 로 바꿀 수 있음
 */
const START_TIMEOUT_MS = Number(process.env.SMOKE_CHROME_START_MS) || 45000
const START_TRIES = 2

async function launchChrome() {
  let lastErr
  for (let n = 1; n <= START_TRIES; n++) {
    try { return await launchChromeOnce() } catch (e) {
      lastErr = e
      console.error(`크롬 시작 실패 (${n}/${START_TRIES}): ${String(e.message).split('\n')[0]}${n < START_TRIES ? ' → 다시 시도' : ''}`)
    }
  }
  throw lastErr
}

async function launchChromeOnce() {
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'digul-smoke-'))
  const flags = [`--user-data-dir=${prof}`, '--headless=new', '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--mute-audio',
    `--window-size=${WIDTH},${HEIGHT}`, '--remote-debugging-port=0', 'about:blank']
  if (process.env.CI) flags.unshift('--no-sandbox')
  if (GPU === 'off') {
    // 크롬 설정의 "그래픽 가속 사용" 끔과 같은 상태 (docs/gpu-fallback-research.md) + 소프트웨어 WebGL 허용
    fs.writeFileSync(path.join(prof, 'Local State'), JSON.stringify({ hardware_acceleration_mode: { enabled: false } }))
    flags.unshift('--disable-gpu', '--enable-unsafe-swiftshader')
  }
  if (GPU === 'swiftshader') flags.unshift('--use-angle=swiftshader', '--enable-unsafe-swiftshader')
  if (GPU === 'none') flags.unshift('--disable-gpu', '--disable-3d-apis')
  const chrome = spawn(chromePath(), flags, { stdio: ['ignore', 'ignore', 'pipe'] })
  // 시작에 실패하면 크롬 프로세스와 임시 프로필을 정리하고 던짐 (다시 시도할 때 남지 않게)
  const abort = async () => { chrome.kill(); await sleep(300); try { fs.rmSync(prof, { recursive: true, force: true }) } catch { /* 무시 */ } }
  let wsUrl
  try {
    // 디버깅 포트는 stderr 의 "DevTools listening on ws://..." 로 알려 줌
    wsUrl = await new Promise((resolve, reject) => {
      let buf = ''
      const t = setTimeout(() => reject(new Error(`크롬이 ${START_TIMEOUT_MS / 1000}초 안에 뜨지 않았어요\n${buf}`)), START_TIMEOUT_MS)
      chrome.stderr.on('data', (d) => {
        buf += d
        const m = /DevTools listening on (ws:\/\/\S+)/.exec(buf)
        if (m) { clearTimeout(t); resolve(m[1]) }
      })
      chrome.once('exit', (c) => { clearTimeout(t); reject(new Error(`크롬이 바로 끝났어요 (code ${c})\n${buf}`)) })
    })
  } catch (e) { await abort(); throw e }
  const port = new URL(wsUrl).port
  let page
  for (let i = 0; i < 50 && !page; i++) {
    try { page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page') } catch { /* 아직 */ }
    if (!page) await sleep(100)
  }
  if (!page) { await abort(); throw new Error('크롬 디버깅 창(page)을 못 찾았어요') }
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j) })
  let id = 0
  const pending = new Map(), handlers = new Set()
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data)
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result) }
    else handlers.forEach((h) => h(m))
  })
  const send = (method, params = {}) => new Promise((resolve, reject) => { const i = ++id; pending.set(i, { resolve, reject }); ws.send(JSON.stringify({ id: i, method, params })) })
  const close = async () => { try { ws.close() } catch { /* 무시 */ } chrome.kill(); await sleep(500); try { fs.rmSync(prof, { recursive: true, force: true }) } catch { /* 윈도우는 잠깐 잠김 */ } }
  return { send, on: (h) => { handlers.add(h); return () => handlers.delete(h) }, close, version: (await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()).Browser }
}

/* ---------- 화면 하나 ---------- */
const short = (s, n = 160) => (s.length > n ? `${s.slice(0, n - 1)}…` : s).replace(/\s+/g, ' ')
const ignored = (s) => IGNORE.some((re) => re.test(s))

async function visit(cdp, base, origin, screen, idx) {
  const rec = { ...screen, errors: [], exceptions: [], failed: [], blank: false, errorScreen: false, notFound: false, loading: false, ms: 0, webgl: null }
  const inflight = new Set() // http(s) 요청만 셈 (blob: · data: 는 끝 신호가 안 올 때가 있음)
  let lastNet = Date.now(), loaded = false
  const onMsg = (m) => {
    const p = m.params
    switch (m.method) {
      case 'Runtime.exceptionThrown': {
        const d = p.exceptionDetails
        rec.exceptions.push(short(d.exception?.description ?? d.text ?? '예외', 300))
        break
      }
      case 'Runtime.consoleAPICalled':
        if (p.type === 'error' || p.type === 'assert') {
          const s = p.args.map((a) => a.value ?? a.description ?? '').join(' ')
          if (!ignored(s)) rec.errors.push(short(s, 300))
        }
        break
      case 'Log.entryAdded':
        if (p.entry.level === 'error' && !ignored(`${p.entry.text} ${p.entry.url ?? ''}`) && p.entry.source !== 'network') rec.errors.push(short(`[${p.entry.source}] ${p.entry.text}`, 300))
        break
      case 'Network.requestWillBeSent': if (/^https?:/.test(p.request.url)) inflight.add(p.requestId); lastNet = Date.now(); break
      case 'Network.loadingFinished': inflight.delete(p.requestId); lastNet = Date.now(); break
      case 'Network.loadingFailed':
        inflight.delete(p.requestId); lastNet = Date.now()
        if (!p.canceled && !ignored(p.errorText)) rec.failed.push(`${p.errorText} (${p.type})`)
        break
      case 'Network.responseReceived':
        // 없는 주소 화면은 문서 응답이 404 인 게 정상 (Next not-found.tsx)
        if (p.type === 'Document' && p.response.status === 404 && EXPECT_GONE.some((re) => re.test(screen.path))) break
        if (p.response.status >= 400 && p.response.url.startsWith(origin) && !ignored(p.response.url)) rec.failed.push(`${p.response.status} ${p.response.url.replace(origin, '')}`)
        break
      case 'Page.loadEventFired': loaded = true; break
    }
  }
  const off = cdp.on(onMsg)
  const t0 = Date.now()
  // 화면마다 저장소를 비움 (앞 화면의 sessionStorage · localStorage 가 다음 화면에 섞이지 않게)
  await cdp.send('Storage.clearDataForOrigin', { origin, storageTypes: 'local_storage,session_storage' }).catch(() => {})
  await cdp.send('Page.navigate', { url: `${base}${screen.path}` })
  while (Date.now() - t0 < WAIT) {
    await sleep(100)
    if (loaded && inflight.size === 0 && Date.now() - lastNet > QUIET) break
  }
  // 3D 화면은 모델을 받은 뒤에도 셰이더 · 첫 그리기가 남아 있어 조금 더 (그 사이 나는 예외도 잡게)
  const has3d = await cdp.send('Runtime.evaluate', { expression: "!!document.querySelector('canvas')", returnByValue: true }).then((r) => r.result.value).catch(() => false)
  await sleep(has3d ? SETTLE_3D : 300)
  // 로딩 표시("땅굴 파는 중" 등)가 남아 있으면 조금 더 기다림: 가속 끈 크롬은 네트워크가 조용해진 뒤에도 3D 준비(예열·굽기)가 이어짐 (2026-11-17)
  while (has3d && Date.now() - t0 < WAIT + SETTLE_3D) {
    const still = await cdp.send('Runtime.evaluate', { expression: `${JSON.stringify(LOADING_TEXT)}.some((t) => (document.body.innerText || '').includes(t))`, returnByValue: true }).then((r) => r.result.value).catch(() => false)
    if (!still) break
    await sleep(250)
  }
  rec.ms = Date.now() - t0
  off()
  const probe = await cdp.send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const root = document.getElementById('root')
      const text = (document.body.innerText || '').trim()
      const media = document.querySelectorAll('#root canvas, #root img, #root svg').length
      const canvas = [...document.querySelectorAll('canvas')]
      // three.js 렌더러 캔버스(data-engine)만 봄: 컨텍스트가 없는 캔버스에 getContext 를 부르면 새 컨텍스트가 생겨 버림
      // (저사양 '선명한 배경' 2D 캔버스가 굽기 전에 WebGL 캔버스가 되어 앱이 2D 컨텍스트를 못 얻던 일, 2026-11-17)
      const gl = canvas.filter((c) => c.hasAttribute('data-engine')).some((c) => { try { return !!(c.getContext('webgl2') || c.getContext('webgl')) } catch { return false } })
      return { kids: root ? root.childElementCount : -1, textLen: text.length, media, text: text.slice(0, 4000), canvases: canvas.length, gl }
    })()`,
  })
  const v = probe.result.value
  rec.blank = v.kids <= 0 || (v.textLen < 5 && v.media === 0)
  rec.errorScreen = ERROR_TEXT.some((t) => v.text.includes(t))
  rec.notFound = v.text.includes(NOT_FOUND_TEXT) && !EXPECT_GONE.some((re) => re.test(screen.path))
  rec.loading = LOADING_TEXT.some((t) => v.text.includes(t))
  rec.webgl = v.canvases ? v.gl : null
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png' })
  const slug = screen.path.replace(/^\//, '').replace(/[^\w가-힣-]+/g, '_').slice(0, 60) || 'root'
  rec.shot = path.join(OUT, `${String(idx + 1).padStart(2, '0')}-${slug}.png`)
  fs.writeFileSync(rec.shot, Buffer.from(shot.data, 'base64'))
  // 같은 메시지가 여러 번 나오면 하나로
  for (const k of ['errors', 'exceptions', 'failed']) rec[k] = [...new Set(rec[k])]
  // /dev/crash 는 일부러 깨뜨리는 화면: 오류 화면 · 그 예외 · 콘솔 에러가 나와야 정상 (안 나오면 실패)
  if (EXPECT_ERROR.some((re) => re.test(screen.path))) {
    const ok = rec.errorScreen
    rec.expected = '오류 화면'
    rec.exceptions = []; rec.errors = []; rec.errorScreen = false
    if (!ok) rec.exceptions.push('에러 경계 화면이 안 나왔어요')
  }
  rec.status = rec.exceptions.length || rec.blank || rec.errorScreen ? '실패' : rec.errors.length || rec.failed.length || rec.notFound || rec.loading ? '경고' : 'OK'
  return rec
}

/* ---------- 실행 ---------- */
const list = screens()
if (args.list) { list.forEach((s, i) => console.log(`${String(i + 1).padStart(3)} ${s.path}  (${s.from}: ${s.label})`)); process.exit(0) }
fs.mkdirSync(OUT, { recursive: true })
for (const f of fs.readdirSync(OUT)) if (f.endsWith('.png')) fs.rmSync(path.join(OUT, f))
let server = null
let base = args.url ? String(args.url).replace(/\/$/, '') : null
if (!base) { server = await startNext(); base = `http://127.0.0.1:${PORT}` }
const origin = new URL(base).origin
const cdp = await launchChrome()
await cdp.send('Runtime.enable'); await cdp.send('Log.enable'); await cdp.send('Page.enable'); await cdp.send('Network.enable')
await cdp.send('Network.setCacheDisabled', { cacheDisabled: false })
console.log(`스모크: ${list.length}개 화면 · ${base} · 실험실 ${LABS ? '켬' : '꺼짐(실험실 주소는 없는 주소가 정상)'} · gpu=${GPU} · ${cdp.version} · ${WIDTH}×${HEIGHT}`)
const results = []
const started = Date.now()
for (const [i, s] of list.entries()) {
  let r
  try { r = await visit(cdp, base, origin, s, i) } catch (e) { r = { ...s, status: '실패', errors: [], exceptions: [`스모크 도구 오류: ${e.message}`], failed: [], ms: 0 } }
  results.push(r)
  const first = r.exceptions[0] ?? r.errors[0] ?? r.failed[0] ?? (r.blank ? '빈 화면' : r.errorScreen ? '오류 화면' : r.notFound ? '없는 주소 화면' : r.loading ? '로딩이 안 끝남' : '')
  console.log(`${String(i + 1).padStart(3)} ${r.status === 'OK' ? 'OK  ' : r.status === '경고' ? '경고' : '실패'} ${String(r.ms).padStart(5)}ms ${s.path}${first ? `  ← ${short(first, 110)}` : ''}`)
}
await cdp.close()
server?.close()

/* ---------- 표 ---------- */
const esc = (s) => String(s).replace(/\|/g, '\\|')
const rows = results.map((r, i) => `| ${i + 1} | \`${esc(r.path)}\` | ${r.status} | ${r.exceptions.length} | ${r.errors.length} | ${r.failed.length} | ${r.blank ? '빈 화면' : r.errorScreen ? '오류 화면' : r.notFound ? '없는 주소' : r.loading ? '로딩 중' : r.expected ? `(예상) ${r.expected}` : ''} | ${r.webgl === null ? '' : r.webgl ? 'O' : 'X'} | ${r.ms} | ${esc(short(r.exceptions[0] ?? r.errors[0] ?? r.failed[0] ?? '', 120))} |`)
const count = (st) => results.filter((r) => r.status === st).length
const summary = `화면 ${results.length}개: OK ${count('OK')} · 경고 ${count('경고')} · 실패 ${count('실패')} (gpu=${GPU}, 실험실 ${LABS ? '켬' : '꺼짐'}, ${Math.round((Date.now() - started) / 1000)}초, ${cdp.version})`
const md = [
  `# 스모크 결과 (${new Date().toLocaleString('ko-KR')})`, '', summary, '',
  '| # | 주소 | 결과 | 예외 | 콘솔 에러 | 리소스 실패 | 화면 | WebGL | 시간(ms) | 첫 메시지 |',
  '|---|---|---|---|---|---|---|---|---|---|', ...rows, '',
  '- 실패 = 처리 안 된 예외 · 빈 화면 · 오류 화면, 경고 = 콘솔 에러 · 리소스 실패 · 뜻밖의 "없는 주소" 화면 · 기다린 뒤에도 로딩 표시',
  '- WebGL: 화면에 canvas 가 있을 때 WebGL 컨텍스트를 얻었는지 (O/X)',
].join('\n')
fs.writeFileSync(path.join(OUT, 'report.md'), md)
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ summary, gpu: GPU, base, browser: cdp.version, results }, null, 2))
console.log(`\n${summary}`)
console.log(`보고서: ${path.relative(APP, path.join(OUT, 'report.md'))} · 스크린샷: ${path.relative(APP, OUT)}/`)
const bad = results.filter((r) => r.status !== 'OK')
if (bad.length) {
  console.log('\n문제 있는 화면')
  for (const r of bad) {
    console.log(`- [${r.status}] ${r.path} (${r.label})`)
    for (const m of [...r.exceptions.map((x) => `예외: ${x}`), ...r.errors.map((x) => `콘솔: ${x}`), ...r.failed.map((x) => `리소스: ${x}`)].slice(0, 4)) console.log(`    ${short(m, 220)}`)
    if (r.blank) console.log('    빈 화면'); if (r.errorScreen) console.log('    오류 화면'); if (r.notFound) console.log('    없는 주소 화면'); if (r.loading) console.log('    로딩 표시가 남아 있음')
  }
}
process.exit(count('실패') && !NO_FAIL ? 1 : 0)
