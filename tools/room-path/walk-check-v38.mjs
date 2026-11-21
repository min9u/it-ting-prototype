// 땅굴 방 걷기 시험 (v3.8 3단계, docs/room-interest-v3-8-step3.md): 관심사 조합 A·B·C 방에서 두더지가 여러 경로를 걷는 동안
//  - 몸 자리(발자리 + 몸 반지름)가 다른 가구·동물 네모 안으로 1cm 넘게 들어간 적이 있는지
//  - 도착 자리 오차, 걸린 시간
//  - 걷다 멈춘 뒤 기본 방석(노랑)으로 스스로 돌아와 앉는지
// 앱의 시험 손잡이 ?navdbg=1 (window.__roomNav: pos · rects · walkTo · seated) 을 씀. 개발 서버를 먼저 띄울 것 (cd app && npm run dev -- --port 5175)
//   node tools/room-path/walk-check-v38.mjs <앱 주소 http://localhost:5175> [결과 json 경로]
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const BASE = process.argv[2] ?? 'http://localhost:5175', OUT = process.argv[3]
const CH = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const SETS = {
  A: ['맛집탐방', '카페/커피', '주류/와인/위스키', '다이어트/건강식', '베이킹/디저트', '차/다도', '러닝/마라톤', '클라이밍'],
  B: ['요리/레시피', '헬스/필라테스/요가', '영화', '기타/베이스/일렉', '피아노/건반', '캠핑/글램핑', '자전거/바이크/드라이브', '굿즈/포토카드'],
  C: ['강아지', '고양이', '새', '설치류/소동물', '곤충/파충류/기타', '카페/커피', '영화'],
}
// 바닥 위 시험 점 (three.js x, z). 방 앞쪽(+z)이 카메라 쪽
const GOALS = [[0, 1.5], [-1.0, 1.7], [1.0, 1.7], [-2.0, 0.4], [2.0, 0.4], [0.0, -1.5], [-1.5, -1.2], [1.6, -1.1], [-0.2, 0.9], [0.9, -0.4],
  // v3.8.1 고정 장식 둘레 (수납장 · 스탠드 조명 · 큰 화분 사이사이) + 러그 위(걸어 넘음)
  [-2.15, 0.95], [-2.2, -0.9], [-1.75, 0.15], [-1.9, 0.9], [0.0, 1.85], [1.7, 2.0]]
const EPS = 0.01

const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'walk-check-'))
const ch = spawn(CH, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${prof}`, '--hide-scrollbars', '--window-size=1440,960', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] })
const wsUrl = await new Promise((res, rej) => { let b = ''; const t = setTimeout(() => rej(new Error(b)), 15000); ch.stderr.on('data', (d) => { b += d; const m = /DevTools listening on (ws:\/\/\S+)/.exec(b); if (m) { clearTimeout(t); res(m[1]) } }) })
const port = new URL(wsUrl).port
let tab
for (let i = 0; i < 50 && !tab; i++) { try { tab = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page') } catch { /* */ } if (!tab) await sleep(100) }
const ws = new WebSocket(tab.webSocketDebuggerUrl)
await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j) })
let seq = 0; const pend = new Map()
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id) } })
const send = (method, params = {}) => new Promise((r) => { const i = ++seq; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.value

const inside = (p, r) => p.x > r.x0 + EPS && p.x < r.x1 - EPS && p.z > r.z0 + EPS && p.z < r.z1 - EPS
const result = {}
for (const [name, interests] of Object.entries(SETS)) {
  await send('Page.navigate', { url: `${BASE}/burrow?device=any` }); await sleep(2500)
  await ev(`sessionStorage.setItem('digul.myInterests', ${JSON.stringify(JSON.stringify(interests))})`)
  await send('Page.navigate', { url: `${BASE}/burrow?device=any&navdbg=1` })
  // 떨어져서 방석에 앉을 때까지
  let seated = false
  for (let i = 0; i < 60 && !seated; i++) { await sleep(500); seated = await ev('!!window.__roomNav?.seated?.()') }
  const rects = await ev('JSON.stringify(window.__roomNav.rects())').then(JSON.parse)
  const rows = []
  for (const [gx, gz] of GOALS) {
    // 도착점이 장애물 안이면 시험하지 않음 (clampRoom 이 밀어냄)
    if (rects.some((r) => inside({ x: gx, z: gz }, r))) { rows.push({ goal: [gx, gz], skipped: 'goal inside obstacle' }); continue }
    await ev(`window.__roomNav.walkTo(${gx}, ${gz})`)
    const t0 = Date.now(); let worst = 0, worstRect = null
    const p0 = await ev('JSON.stringify(window.__roomNav.pos())').then(JSON.parse)
    while (Date.now() - t0 < 25000) {
      await sleep(60)
      const p = await ev('JSON.stringify(window.__roomNav.pos())').then(JSON.parse)
      // 앉아 있다 일어나는 동안(방석 네모 안에서 시작)은 빼고, 시작점에서 40cm 벗어난 뒤부터 잼
      if (Math.hypot(p.x - p0.x, p.z - p0.z) < 0.4 && rects.some((r) => inside(p0, r))) continue
      for (const r of rects) {
        const d = Math.min(p.x - r.x0, r.x1 - p.x, p.z - r.z0, r.z1 - p.z)
        if (d > EPS && p.x > r.x0 && p.x < r.x1 && p.z > r.z0 && p.z < r.z1 && d > worst) { worst = d; worstRect = r }
      }
      if (p.idle && Date.now() - t0 > 600) { const err = Math.hypot(p.x - gx, p.z - gz); rows.push({ goal: [gx, gz], ok: err < 0.08, err: +err.toFixed(3), sec: +((Date.now() - t0) / 1000).toFixed(1), maxPenetration: +worst.toFixed(3) }); break }
    }
    if (rows.length === 0 || rows.at(-1).goal[0] !== gx || rows.at(-1).goal[1] !== gz) rows.push({ goal: [gx, gz], ok: false, timeout: true, maxPenetration: +worst.toFixed(3) })
  }
  // 멈춘 뒤 방석으로 돌아와 앉는지 (걷기가 끝난 지점에서 최대 15초)
  let back = false, t1 = Date.now()
  while (Date.now() - t1 < 15000 && !back) { await sleep(300); const p = await ev('JSON.stringify(window.__roomNav.pos())').then(JSON.parse); back = await ev('!!window.__roomNav.seated()') && Math.abs(p.x + 0.68) < 0.05 }
  result[name] = { seatedAtStart: seated, returnedToCushion: back, returnSec: +((Date.now() - t1) / 1000).toFixed(1), rows }
  const bad = rows.filter((r) => !r.skipped && (!r.ok || r.maxPenetration > 0))
  console.log(`${name}: 경로 ${rows.length}개 · 시험 ${rows.filter((r) => !r.skipped).length}개 · 실패/박힘 ${bad.length}개 · 처음 앉음 ${seated} · 걷고 난 뒤 방석 복귀 ${back} (${result[name].returnSec}s)`)
  for (const b of bad) console.log('   ', JSON.stringify(b))
}
if (OUT) fs.writeFileSync(OUT, JSON.stringify(result, null, 1))
ch.kill(); process.exit(0)
