// 땅굴에 처음 들어올 때의 멈춤을 잼 (2026-11-13, docs/rendering-experiments.md)
// node explore/gpu/cdp-load.mjs <name> <gpu|hwoff> <url> [반복 횟수=3]
// - 새 프로필(캐시 없음)로 url 을 열고, "땅굴 파는 중" 로더(role=status)가 사라질 때까지 시간(readyMs)
// - 그 구간의 긴 작업(50ms 넘게 메인 스레드를 막은 것) 합·최대, rAF 최악 간격(= 화면이 얼어 있던 가장 긴 시간)
// - 전송량(내려받은 바이트), 메모리(JS 힙)
// 같은 프로필로 두 번째 방문(캐시 있음)도 잼 → warm
// 환경변수: LAB='{"D":true}' 저사양 실험실 선택, AFF=3 코어 제한, MEASURE_TO=다른 주소로 전환(땅굴 → 탐색하기 등) 시간도 잼
import { spawn } from 'node:child_process'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { fileURLToPath } from 'node:url'
const [name, mode, url, reps = '3'] = process.argv.slice(2)
const out = process.env.OUT || path.join(path.dirname(fileURLToPath(import.meta.url)), 'results', 'load')
fs.mkdirSync(out, { recursive: true })
const exe = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const INJECT = `window.__lt=[];window.__f=[];window.__t0=performance.now();
(function loop(t){window.__f.push(t);requestAnimationFrame(loop)})(0);
try{new PerformanceObserver(l=>l.getEntries().forEach(e=>window.__lt.push([e.startTime,e.duration]))).observe({type:'longtask',buffered:true})}catch(e){}
window.__ready=null;
const chk=()=>{const s=document.querySelector('[role=status]');const c=document.querySelector('canvas');if(window.__seenLoader&&!s&&c&&window.__ready===null)window.__ready=performance.now();if(s)window.__seenLoader=1};
new MutationObserver(chk).observe(document,{subtree:true,childList:true});`

async function run(prof, label) {
  const port = 9300 + Math.floor(Math.random() * 500)
  const args = [`--user-data-dir=${prof}`, `--remote-debugging-port=${port}`, '--headless=new', '--no-first-run', '--window-size=1920,1080', 'about:blank']
  const chrome = process.env.AFF
    ? spawn('cmd', ['/c', 'start', '""', '/wait', '/affinity', process.env.AFF, exe, ...args], { stdio: 'ignore' })
    : spawn(exe, args, { stdio: 'ignore' })
  let targets; for (let i = 0; i < 50; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (targets.length) break } catch {} await sleep(200) }
  const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener('open', r))
  let id = 0; const pending = new Map(); let bytes = 0
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data)
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
    if (m.method === 'Network.loadingFinished') bytes += m.params.encodedDataLength
  })
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
  const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value
  await send('Page.enable'); await send('Network.enable')
  await send('Page.addScriptToEvaluateOnNewDocument', { source: INJECT })
  if (process.env.LAB) await send('Page.addScriptToEvaluateOnNewDocument', { source: `try{localStorage.setItem('digul.lowlab', ${JSON.stringify(process.env.LAB)});localStorage.setItem('digul.gpuNotice.dismissed','1')}catch(e){}` })
  else await send('Page.addScriptToEvaluateOnNewDocument', { source: `try{localStorage.setItem('digul.gpuNotice.dismissed','1')}catch(e){}` })
  const res = []
  for (let k = 0; k < 2; k++) {
    bytes = 0
    if (process.env.PROFILE && k === 0) { await send('Profiler.enable'); await send('Profiler.setSamplingInterval', { interval: 200 }); await send('Profiler.start') }
    if (k === 0) await send('Page.navigate', { url }); else await send('Page.reload', { ignoreCache: false })
    let ready = null
    await sleep(500)
    for (let i = 0; i < 150 && ready === null; i++) { await sleep(200); ready = await ev('window.__ready') }
    await sleep(3000) // 들어온 직후 3초 (선명한 방 찍기 등)
    const r = await ev(`(()=>{const e=(window.__ready??performance.now())+3000;const lt=__lt.filter(x=>x[0]<e);const f=__f.filter(t=>t>0&&t<e);
      const gaps=f.slice(1).map((t,i)=>t-f[i]);return{readyMs:Math.round(window.__ready??-1),longTaskMs:Math.round(lt.reduce((a,x)=>a+x[1],0)),longTaskMax:Math.round(Math.max(0,...lt.map(x=>x[1]))),
      worstFreezeMs:Math.round(Math.max(0,...gaps)),heapMB:+((performance.memory?.usedJSHeapSize||0)/1e6).toFixed(0)}})()`)
    r.mb = +(bytes / 1e6).toFixed(1)
    if (process.env.PROFILE && k === 0) { const pr = (await send('Profiler.stop')).result.profile; fs.writeFileSync(path.join(out, name + '.cpuprofile'), JSON.stringify(pr)) }
    r.visit = k === 0 ? 'cold' : 'warm'
    if (k === 0) r.renderer = await ev(`(()=>{const c=document.createElement('canvas').getContext('webgl');const x=c&&c.getExtension('WEBGL_debug_renderer_info');return x?c.getParameter(x.UNMASKED_RENDERER_WEBGL):null})()`)
    // 전환: 땅굴 → MEASURE_TO (해시 주소 바꾸기) → 다시 돌아오기
    if (k === 1 && process.env.MEASURE_TO) {
      for (const [to, tag] of [[process.env.MEASURE_TO, 'to'], [url.split('#')[1], 'back']]) {
        await ev(`(()=>{window.__ready=null;window.__seenLoader=0;window.__sw=performance.now();window.__lt=[];location.hash=${JSON.stringify(to.replace(/^#?/, ''))}})()`)
        let t = null
        for (let i = 0; i < 150; i++) { await sleep(100); t = await ev(`(()=>{const c=document.querySelector('canvas');const s=document.querySelector('[role=status]');return c&&!s&&(window.__lt.length===0||performance.now()-Math.max(...__lt.map(x=>x[0]+x[1]))>500)?Math.round(performance.now()-__sw):null})()`); if (t !== null) break }
        r[tag + 'SwitchMs'] = t; r[tag + 'LongTaskMs'] = await ev('Math.round(__lt.reduce((a,x)=>a+x[1],0))')
      }
    }
    res.push(r)
  }
  if (process.env.SHOT) { const s = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(out, `${name}-${label}.png`), Buffer.from(s.result.data, 'base64')) }
  try { await send('Browser.close') } catch {}
  ws.close(); chrome.kill(); await sleep(800)
  return res
}

const all = []
for (let i = 0; i < +reps; i++) {
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'cdpload-'))
  if (mode === 'hwoff') fs.writeFileSync(path.join(prof, 'Local State'), JSON.stringify({ hardware_acceleration_mode: { enabled: false } }))
  all.push(...(await run(prof, i)))
  try { fs.rmSync(prof, { recursive: true, force: true }) } catch {}
}
const med = (vis, k) => { const v = all.filter((r) => r.visit === vis).map((r) => r[k]).filter((x) => typeof x === 'number').sort((a, b) => a - b); return v.length ? v[v.length >> 1] : null }
const keys = ['readyMs', 'longTaskMs', 'longTaskMax', 'worstFreezeMs', 'mb', 'heapMB', 'toSwitchMs', 'toLongTaskMs', 'backSwitchMs', 'backLongTaskMs']
const summary = { name, mode, url, lab: process.env.LAB ?? null, renderer: all[0]?.renderer, cold: {}, warm: {} }
for (const v of ['cold', 'warm']) for (const k of keys) { const m = med(v, k); if (m !== null) summary[v][k] = m }
fs.writeFileSync(path.join(out, name + '.json'), JSON.stringify({ summary, runs: all }, null, 2))
console.log(JSON.stringify(summary))
process.exit(0)
