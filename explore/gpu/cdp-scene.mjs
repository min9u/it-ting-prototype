// 화면별 시나리오 측정 (2026-11-16, docs/rendering-experiments-2.md)
// node explore/gpu/cdp-scene.mjs <name> <gpu|hwoff> <url> <explore|chat|room|nav|still>
// 환경변수: REPS=3(반복, 중앙값) AFF=3(CPU 코어 제한, 16진 마스크) LAB='{"A":false}'(저사양 실험실) WINDOW=1(창 있는 크롬, 화면 밖)
//          SHOT=1(단계별 스크린샷) OUT=결과 폴더(기본 results/scene) PROFILE=1(첫 진입 CPU 프로필, 첫 반복만)
//          PRELOAD=ms (3차, 두 번째 방문): 같은 프로필로 한 번 먼저 열고 다 차려진 뒤 ms 기다렸다가(선명한 배경 굽기·IndexedDB 저장·기기 단계 기억) 빈 페이지로 갔다가 다시 엶
//
// 단계마다 잼: 페이지 rAF fps(버튼·스크롤이 얼마나 부드러운지), 장면 fps(WebGL 그리기 묶음 수), 긴 작업 합·최대, rAF 최악 간격,
//            장면 최악 간격(그리기 묶음 사이), 프로세스별 CPU 사용률(렌더러 = 페이지 메인 스레드 포함, GPU = WARP 가 그리는 곳)
// - load: 새 프로필(캐시 없음)로 열고 화면이 다 차려질 때까지(readyMs) + 3초. 긴 작업·가장 긴 멈춤
// - explore: idle 6초 → 방향키 점프 4번(1.7초 간격) → idle 6초 → 구멍 클릭 점프 → 들판 바꾸기(다른 캠퍼스-층)
// - chat: idle 8초 → 메시지 보내기(인사 동작) 4초 → idle 8초
// - room: idle 6초 → D·A 키로 걷기 8초 → idle 6초
// - nav: 내 땅굴 → 탐색 → 다른 땅굴 → 탐색 → 채팅 (해시 주소 바꾸기, 각 전환 시간·긴 작업)
// - landing: 시작 화면을 휠로 4구간 끝까지 스크롤 (방이 생기는 시간 roomReadyMs) → idle 6초
// - still: load 만, idle: load + 6초 (?spin=1 과 같이 쓰면 한 프레임 비용 재기)
import { spawn } from 'node:child_process'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { fileURLToPath } from 'node:url'
const [name, mode, url, scenario = 'still'] = process.argv.slice(2)
const out = process.env.OUT || path.join(path.dirname(fileURLToPath(import.meta.url)), 'results', 'scene')
fs.mkdirSync(out, { recursive: true })
const exe = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const REPS = +(process.env.REPS || 3)

// 화면이 다 차려졌는지: 장면이 loop.ready() 로 첫 그림을 그린 시각(engine.ts markSceneReady) 이 이번 이동 뒤인지
// (로더는 캐시가 있으면 한 번도 안 그려질 수 있어서 DOM 대신 앱이 남기는 표시를 씀)
const READY = `(()=>(window.__sceneReadyAt||0)>(window.__navAt||0))()`
const INJECT = `window.__f=[];window.__lt=[];window.__draws=[];window.__sceneT=[];window.__panT=[];window.__ready=null;window.__navAt=0;window.__readyFn=()=>(window.__sceneReadyAt||0)>(window.__navAt||0);
(function loop(t){window.__f.push(t);if(window.__ready===null&&window.__readyFn){try{if(window.__readyFn())window.__ready=performance.now()}catch(e){}}requestAnimationFrame(loop)})(0);
const _gc=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(...a){const c=_gc.apply(this,a);if(c&&/webgl/.test(a[0])&&!c.__w){c.__w=1;for(const fn of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']){const o=c[fn];if(!o)continue;const ci=fn.startsWith('drawElements')?1:2,ii=fn==='drawElementsInstanced'?4:fn==='drawArraysInstanced'?3:-1;c[fn]=function(...b){const n=performance.now();if(!window.__lastDraw||n-window.__lastDraw>4)window.__draws.push(n);window.__lastDraw=n;window.__nDraw=(window.__nDraw||0)+1;window.__nTri=(window.__nTri||0)+b[ci]*(ii>0?b[ii]:1)/3;return o.apply(this,b)}}}return c};
try{new PerformanceObserver(l=>l.getEntries().forEach(e=>window.__lt.push([e.startTime,e.duration]))).observe({type:'longtask',buffered:true})}catch(e){}
try{localStorage.setItem('digul.gpuNotice.dismissed','1')}catch(e){}`

async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl); await new Promise((r) => ws.addEventListener('open', r))
  let id = 0; const pending = new Map(); const listeners = []
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } else if (m.method) listeners.forEach((f) => f(m)) })
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
  return { ws, send, on: (f) => listeners.push(f) }
}

async function run(rep) {
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'cdpscene-'))
  if (mode === 'hwoff') fs.writeFileSync(path.join(prof, 'Local State'), JSON.stringify({ hardware_acceleration_mode: { enabled: false } }))
  const port = 9300 + Math.floor(Math.random() * 500)
  // WINDOW=1: 창 있는 크롬을 화면 밖에 띄움 (헤드리스가 SwiftShader 로 나오는 환경 대비. 사용자 화면을 가리지 않게)
  const view = process.env.WINDOW ? ['--window-position=-3000,0', '--window-size=1920,1080'] : ['--headless=new', '--window-size=1920,1080']
  const args = [`--user-data-dir=${prof}`, `--remote-debugging-port=${port}`, '--no-first-run', '--no-default-browser-check', ...view, 'about:blank']
  const chrome = process.env.AFF
    ? spawn('cmd', ['/c', 'start', '""', '/wait', '/affinity', process.env.AFF.replace(/^0x/i, ''), exe, ...args], { stdio: 'ignore' })
    : spawn(exe, args, { stdio: 'ignore' })
  let targets; for (let i = 0; i < 60; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (targets.find((t) => t.type === 'page')) break } catch {} await sleep(200) }
  const ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()
  const B = await connect(ver.webSocketDebuggerUrl)
  const P = await connect(targets.find((t) => t.type === 'page').webSocketDebuggerUrl)
  let bytes = 0
  P.on((m) => { if (m.method === 'Network.loadingFinished') bytes += m.params.encodedDataLength })
  const ev = async (x) => (await P.send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value
  await P.send('Page.enable'); await P.send('Network.enable')
  await P.send('Page.addScriptToEvaluateOnNewDocument', { source: INJECT })
  if (process.env.LAB) await P.send('Page.addScriptToEvaluateOnNewDocument', { source: `try{localStorage.setItem('digul.lowlab.v2', ${JSON.stringify(process.env.LAB)})}catch(e){}` })
  if (process.env.WINDOW) await P.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false })
  // 프로세스별 CPU 시간 (초, 누적)
  const cpu = async () => { const r = await B.send('SystemInfo.getProcessInfo'); const o = {}; for (const p of r.result?.processInfo ?? []) o[p.type] = (o[p.type] ?? 0) + p.cpuTime; return o }
  const now = () => ev('performance.now()')
  const stat = async (s, e, c0, c1) => {
    // 장면 fps: 앱 루프가 그린 횟수(engine.ts countFrame → __sceneT). 그리기 호출 묶음(__draws)은 느린 프레임이 둘로 쪼개져 세어질 수 있어 참고만
    const r = await ev(`(()=>{const s=${s},e=${e};const f=__f.filter(t=>t>=s&&t<e),lt=__lt.filter(x=>x[0]>=s&&x[0]<e);const sec=(e-s)/1000;const d=(__sceneT.length?__sceneT:__draws).filter(t=>t>=s&&t<e);
      const gaps=f.slice(1).map((t,i)=>t-f[i]).sort((a,b)=>a-b);const dg=d.slice(1).map((t,i)=>t-d[i]).sort((a,b)=>a-b);
      return{sec:+sec.toFixed(1),rafFps:+(f.length/sec).toFixed(1),sceneFps:+(d.length/sec).toFixed(1),worstGap:Math.round(gaps[gaps.length-1]||0),sceneWorstGap:Math.round(dg[dg.length-1]||0),
      longTaskMs:Math.round(lt.reduce((a,x)=>a+x[1],0)),longTaskMax:Math.round(Math.max(0,...lt.map(x=>x[1]))),
      // 점프 카메라 이동(0.4초)마다 그린 프레임 수 → fps (holeField 가 __panT 에 남김)
      ...(()=>{const p=__panT.filter(t=>t>=s&&t<e);if(!p.length)return{};let n=1;const g=[];for(let i=1;i<p.length;i++){const d=p[i]-p[i-1];if(d>250)n++;else g.push(d)}return{panFps:+(p.length/n/0.4).toFixed(1),panWorstGap:Math.round(Math.max(0,...g))}})()}})()`)
    if (c0 && c1) { const dt = r.sec; r.cpuRenderer = +(((c1.renderer ?? 0) - (c0.renderer ?? 0)) / dt * 100).toFixed(0); r.cpuGpu = +(((c1.gpu ?? c1.GPU ?? 0) - (c0.gpu ?? c0.GPU ?? 0)) / dt * 100).toFixed(0) }
    return r
  }
  const counts = () => ev('[window.__nDraw||0,window.__nTri||0]')
  const phase = async (label, ms, act) => {
    const c0 = await cpu(); const n0 = await counts(); const a = await now()
    if (act) await act(); else await sleep(ms)
    const b = await now(); const n1 = await counts(); const c1 = await cpu()
    const r = await stat(a, b, c0, c1)
    const frames = Math.max(1, Math.round(r.sceneFps * r.sec))
    if (r.sceneFps > 0) { r.drawsPerFrame = Math.round((n1[0] - n0[0]) / frames); r.ktrisPerFrame = Math.round((n1[1] - n0[1]) / frames / 1000) }
    if (process.env.SHOT) { const s = await P.send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(out, `${name}-${rep}-${label}.png`), Buffer.from(s.result.data, 'base64')) }
    return r
  }
  const key = async (code, k, vk) => {
    await P.send('Input.dispatchKeyEvent', { type: 'keyDown', code, key: k, windowsVirtualKeyCode: vk })
    await sleep(60)
    await P.send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: k, windowsVirtualKeyCode: vk })
  }
  const seatNow = () => ev(`(location.hash.match(/seat=(\\d+)/)||[])[1]||null`)
  const waitReady = async (maxMs = 40000) => {
    for (let i = 0; i < maxMs / 100; i++) { const r = await ev('window.__ready'); if (r !== null && r !== undefined) return r; await sleep(100) }
    return null
  }

  const res = { rep }
  if (process.env.PRELOAD) {
    await P.send('Page.navigate', { url })
    await sleep(300)
    await waitReady()
    await sleep(+process.env.PRELOAD)
    res.preTier = await ev(`localStorage.getItem('digul.tier.v1')`)
    await P.send('Page.navigate', { url: 'about:blank' })
    await sleep(800)
  }
  // ---------- 첫 진입 ----------
  // 랜딩은 스크롤해야 3D 방이 생김 → 첫 진입은 화면 글자가 보일 때까지
  if (scenario === 'landing') await P.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__readyFn=()=>!!document.querySelector('main h1, main h2')` })
  if (process.env.PROFILE && rep === 0) { await P.send('Profiler.enable'); await P.send('Profiler.setSamplingInterval', { interval: 200 }); await P.send('Profiler.start') }
  const c0 = await cpu()
  await P.send('Page.navigate', { url })
  await sleep(300)
  const ready = await waitReady()
  await sleep(3000)
  const c1 = await cpu()
  const ld = await ev(`(()=>{const e=(window.__ready??performance.now())+3000;const lt=__lt.filter(x=>x[0]<e);const f=__f.filter(t=>t>0&&t<e);const gaps=f.slice(1).map((t,i)=>t-f[i]);
    return{readyMs:Math.round(window.__ready??-1),longTaskMs:Math.round(lt.reduce((a,x)=>a+x[1],0)),longTaskMax:Math.round(Math.max(0,...lt.map(x=>x[1]))),worstFreezeMs:Math.round(Math.max(0,...gaps)),
    heapMB:+((performance.memory?.usedJSHeapSize||0)/1e6).toFixed(0),warmMs:window.__warmMs??null,fieldWarmMs:window.__fieldWarmMs??null,stillAt:window.__stillAt!=null?Math.round(window.__stillAt):null}})()`)
  ld.mb = +(bytes / 1e6).toFixed(1)
  ld.cpuGpuSec = +(((c1.gpu ?? c1.GPU ?? 0) - (c0.gpu ?? c0.GPU ?? 0))).toFixed(2)
  ld.cpuRendererSec = +(((c1.renderer ?? 0) - (c0.renderer ?? 0))).toFixed(2)
  res.load = ld
  if (process.env.PROFILE && rep === 0) { const pr = (await P.send('Profiler.stop')).result.profile; fs.writeFileSync(path.join(out, name + '.cpuprofile'), JSON.stringify(pr)) }
  if (rep === 0) res.renderer = await ev(`(()=>{const c=document.createElement('canvas').getContext('webgl');const x=c&&c.getExtension('WEBGL_debug_renderer_info');return x?c.getParameter(x.UNMASKED_RENDERER_WEBGL):null})()`)
  if (process.env.SHOT) { const s = await P.send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(out, `${name}-${rep}-load.png`), Buffer.from(s.result.data, 'base64')) }

  if (scenario === 'idle') {
    res.idle = await phase('idle', 6000)
  } else if (scenario === 'explore') {
    res.idle = await phase('idle', 6000)
    const seats = [await seatNow()]
    res.hop = await phase('hop', 0, async () => {
      // 오른쪽 ↔ 왼쪽 (없으면 위·아래) 4번, 한 번에 0.42 + 0.4 + 0.5 초
      const tries = [['ArrowRight', 39], ['ArrowLeft', 37], ['ArrowRight', 39], ['ArrowLeft', 37]]
      for (const [k, vk] of tries) {
        const before = await seatNow()
        await key(k, k, vk); await sleep(1700)
        if ((await seatNow()) === before) { const alt = k === 'ArrowRight' ? ['ArrowUp', 38] : ['ArrowDown', 40]; await key(alt[0], alt[0], alt[1]); await sleep(1700) }
        seats.push(await seatNow())
      }
    })
    res.hop.seats = seats
    res.idle2 = await phase('idle2', 6000)
    // 구멍 클릭: 마우스를 화면 가운데 둘레로 움직여 이름표가 뜨는 곳(다른 구멍)을 찾고 누름
    const found = await (async () => {
      const pts = []
      for (let x = 80; x <= 1500; x += 70) for (let y = 100; y <= 960; y += 70) { const d = Math.hypot(x - 770, y - 500); if (d > 170) pts.push([d, x, y]) }
      pts.sort((a, b) => a[0] - b[0])
      for (const [, x, y] of pts) {
        await P.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
        await sleep(30)
        if (await ev(`!!document.querySelector('[class*=_nameTag_]')`)) return { x, y }
      }
      return null
    })()
    res.clickAt = found
    if (found) {
      const before = await seatNow()
      res.click = await phase('click', 0, async () => {
        await P.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: found.x, y: found.y, button: 'left', clickCount: 1 })
        await P.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: found.x, y: found.y, button: 'left', clickCount: 1 })
        await sleep(2200)
      })
      res.click.moved = before !== (await seatNow())
    }
    // 들판 바꾸기: 다른 캠퍼스-층 (구역 3개짜리 서울-3층 ↔ 원래)
    // 후보 쿼리(?fsharp=1 등)는 그대로 넘김 (floor·seat 만 바꿈)
    const keep = new URLSearchParams((url.split('#')[1] ?? '').split('?')[1] ?? ''); keep.delete('floor'); keep.delete('seat')
    if (!/floor=/.test(url)) keep.set('floor', '2026 하반기|서울|3')
    const other = `/burrow/explore${keep.toString() ? '?' + keep.toString() : ''}`
    res.floor = await phase('floor', 0, async () => {
      const t0 = await ev(`(()=>{window.__ready=null;window.__navAt=performance.now();location.hash=${JSON.stringify(other)};return window.__navAt})()`)
      const r = await waitReady(); res.floorSwitchMs = r === null ? null : Math.round(r - t0)
      await sleep(1500)
    })
  } else if (scenario === 'chat') {
    res.idle = await phase('idle', 8000)
    res.send = await phase('send', 0, async () => {
      await ev(`document.querySelector('form textarea')?.focus()`)
      await P.send('Input.insertText', { text: '안녕하세요' })
      await P.send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'Enter', key: 'Enter', windowsVirtualKeyCode: 13, text: '\r' })
      await P.send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'Enter', key: 'Enter', windowsVirtualKeyCode: 13 })
      await sleep(4000)
    })
    // 글자 입력 반응: 키 하나 → 다음 두 프레임까지 (메인 스레드가 막혀 있으면 길어짐)
    res.typeLatencyMs = await ev(`new Promise(r=>{const t=document.querySelector('form textarea');t?.focus();const s=performance.now();t?.dispatchEvent(new InputEvent('input',{bubbles:true}));requestAnimationFrame(()=>requestAnimationFrame(()=>r(Math.round(performance.now()-s))))})`)
    res.idle2 = await phase('idle2', 8000)
  } else if (scenario === 'room') {
    res.idle = await phase('idle', 6000)
    res.walk = await phase('walk', 0, async () => {
      for (const [k, vk] of [['KeyD', 68], ['KeyA', 65]]) {
        const kk = k.slice(3).toLowerCase()
        await P.send('Input.dispatchKeyEvent', { type: 'keyDown', code: k, key: kk, windowsVirtualKeyCode: vk })
        await sleep(4000)
        await P.send('Input.dispatchKeyEvent', { type: 'keyUp', code: k, key: kk, windowsVirtualKeyCode: vk })
      }
    })
    await sleep(2000)
    res.idle2 = await phase('idle2', 6000)
  } else if (scenario === 'landing') {
    // 4구간 스크롤: 휠을 0.35초마다 한 번씩 (방이 생기는 순간 포함)
    await ev(`(()=>{window.__ready=null;window.__navAt=performance.now();window.__readyFn=()=>(window.__sceneReadyAt||0)>(window.__navAt||0)})()`)
    const a0 = await now()
    res.scroll = await phase('scroll', 0, async () => {
      for (let i = 0; i < 24; i++) { await P.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 900, y: 600, deltaX: 0, deltaY: 260 }); await sleep(350) }
      await sleep(1500)
    })
    const r = await ev('window.__ready'); res.roomReadyMs = r == null ? null : Math.round(r - a0)
    res.idle = await phase('idle', 6000)
  } else if (scenario === 'nav') {
    // 해시 주소로 화면 전환. 각 화면이 다 차려질 때까지 시간 + 그 사이 긴 작업
    const steps = ['/burrow/explore', '/burrow/yerin', '/burrow/explore', '/chat/r-yerin', '/burrow']
    res.nav = []
    for (const to of steps) {
      const a = await ev(`(()=>{window.__ready=null;window.__navAt=performance.now();location.hash=${JSON.stringify(to)};return window.__navAt})()`)
      const r = await waitReady()
      await sleep(1500)
      const b = await now()
      const st = await stat(a, b)
      res.nav.push({ to, switchMs: r === null ? null : Math.round(r - a), longTaskMs: st.longTaskMs, longTaskMax: st.longTaskMax, worstGap: st.worstGap })
      await sleep(1500)
    }
  }
  // 3차: 기기 단계 (lib/deviceTier.ts) 측정값·기억
  res.tier = await ev(`({samples:window.__tierSamples??null,store:localStorage.getItem('digul.tier.v1')})`)
  // 배경 다시 찍기 (holeField noteCapture: 메인 스레드 ms). 선명한 배경(sharp)은 읽어 오기까지 기다려서 실제 멈춤에 가까움
  const caps = await ev('window.__captures ?? null')
  if (caps) { const by = (k) => caps.filter((c) => c[0] === k).map((c) => c[1]).sort((a, b) => a - b); const sh = by('sharp'), bd = by('bd'), sw = by('sharpWait'); res.captures = { kinds: Object.fromEntries([...new Set(caps.map((c) => c[0]))].map((k) => { const v = by(k); return [k, { n: v.length, med: v[v.length >> 1], max: v.at(-1) }] })), raw: caps.slice(0, 40), n: caps.length, bdMax: bd.at(-1) ?? null, sharpMed: sh.length ? sh[sh.length >> 1] : null, sharpMax: sh.at(-1) ?? null, waitMed: sw.length ? sw[sw.length >> 1] : null, waitMax: sw.at(-1) ?? null } }
  try { await B.send('Browser.close') } catch {}
  B.ws.close(); P.ws.close(); chrome.kill(); await sleep(800)
  try { fs.rmSync(prof, { recursive: true, force: true }) } catch {}
  return res
}

const runs = []
for (let i = 0; i < REPS; i++) { const r = await run(i); runs.push(r); process.stderr.write(`rep ${i}: ${JSON.stringify(r)}\n`) }
// 중앙값 (단계·지표마다)
const med = (arr) => { const v = arr.filter((x) => typeof x === 'number').sort((a, b) => a - b); return v.length ? v[v.length >> 1] : null }
const summary = { name, mode, url, scenario, aff: process.env.AFF ?? null, lab: process.env.LAB ?? null, window: !!process.env.WINDOW, renderer: runs[0]?.renderer }
for (const ph of ['load', 'idle', 'hop', 'idle2', 'click', 'floor', 'send', 'walk', 'scroll']) {
  if (!runs.some((r) => r[ph])) continue
  summary[ph] = {}
  for (const k of Object.keys(runs.find((r) => r[ph])[ph])) { const m = med(runs.map((r) => r[ph]?.[k])); if (m !== null) summary[ph][k] = m }
}
if (runs.some((r) => r.captures)) { summary.captures = {}; for (const k of ['n', 'bdMax', 'sharpMed', 'sharpMax', 'waitMed', 'waitMax']) { const m = med(runs.map((r) => r.captures?.[k])); if (m !== null) summary.captures[k] = m } }
for (const k of ['floorSwitchMs', 'typeLatencyMs', 'roomReadyMs']) { const m = med(runs.map((r) => r[k])); if (m !== null) summary[k] = m }
if (runs[0]?.nav) summary.nav = runs[0].nav.map((s, i) => ({ to: s.to, switchMs: med(runs.map((r) => r.nav[i]?.switchMs)), longTaskMs: med(runs.map((r) => r.nav[i]?.longTaskMs)), longTaskMax: med(runs.map((r) => r.nav[i]?.longTaskMax)), worstGap: med(runs.map((r) => r.nav[i]?.worstGap)) }))
fs.writeFileSync(path.join(out, name + '.json'), JSON.stringify({ summary, runs }, null, 2))
console.log(JSON.stringify(summary))
process.exit(0)
