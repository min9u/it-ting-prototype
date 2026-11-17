// 그래픽 3차 성능 측정 묶음 (2026-11-17, docs/rendering-experiments-3.md)
// node explore/gpu/round3-perf.mjs <묶음> [cfg ...]
//   묶음: main(화면 7개 기준 → 개선) · revisit(두 번째 방문) · weak(약한 단계 강제) · gpu(가속 켬, 회귀 확인) · cand(후보별)
//   cfg: t16(16스레드 WARP) c2(2코어 WARP, AFF=3) gpu
// 기준 빌드는 BASE(기본 http://localhost:5342/#, 2차 결과 54c8b9f 공유 빌드), 개선은 NEW(기본 http://localhost:5341/#).
// 같은 조건 둘을 번갈아(A/B/A/B) REPS 번씩 (기본 2). 실행마다 results/round3/scene/<화면>-<빌드>-<cfg>-<i>.json 으로 바로 저장
// 측정 전에 CPU 사용률을 확인함 (25% 넘으면 15초씩 기다림, 최대 3분)
import { execFileSync } from 'node:child_process'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'
const here = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(here, 'results', 'round3', 'scene')
fs.mkdirSync(OUT, { recursive: true })
const BASE = process.env.BASE || 'http://localhost:5342/#'
const NEW = process.env.NEW || 'http://localhost:5341/#'
/** 텍스처 묶기까지 넣은 최종 빌드 (tex 묶음에서 개선과 번갈아 잼) */
const FIN = process.env.FIN || 'http://localhost:5343/#'
const REPS = +(process.env.REPS || 2)
const [set = 'main', ...cfgArg] = process.argv.slice(2)
const cfgs = cfgArg.length ? cfgArg : set === 'gpu' ? ['gpu'] : ['t16', 'c2']

const SCREENS = {
  room: ['/burrow', 'room'],
  visit: ['/burrow/yerin', 'room'],
  explore: ['/burrow/explore', 'explore'],
  landing: ['/start', 'landing'],
  onb: ['/onboarding/preview?demo', 'idle'],
  tea: ['/chat/g-m1', 'chat'],
  nav: ['/burrow', 'nav'],
}
const q = (u, extra) => (extra ? u + (u.includes('?') ? '&' : '?') + extra : u)
/** 묶음마다 [화면, [라벨, 주소 앞, 덧붙일 쿼리]...] */
const PLAN = {
  main: Object.keys(SCREENS).map((k) => [k, [['base', BASE, ''], ['new', NEW, '']]]),
  gpu: ['room', 'explore', 'landing', 'tea'].map((k) => [k, [['base', BASE, ''], ['new', NEW, '']]]),
  // 두 번째 방문 (같은 프로필): 기기 단계 기억 + 구운 그림 IndexedDB
  revisit: ['room', 'explore'].map((k) => [k, [['base', BASE, ''], ['new', NEW, '']]]),
  // 약한 단계 강제 (2코어 첫 방문이 strong 으로 시작하므로 따로)
  weak: ['room', 'explore'].map((k) => [k, [['strong', NEW, 'tier=strong'], ['weak', NEW, 'tier=weak']]]),
  // 11-17 마지막 고침 (텍스처 올리기 묶기 + 기기 단계 판정·탐색 들판 그 자리에서 바꾸기): 개선(5341) ↔ 최종(5343)
  fin: [
    ['visit', [['new', NEW, ''], ['fin', FIN, '']]],
    ['onb', [['new', NEW, ''], ['fin', FIN, '']], 't16'],
    ['room', [['new', NEW, ''], ['fin', FIN, '']], 't16'],
    ['explore', [['new', NEW, ''], ['fin', FIN, '']], 'c2'],
    ['nav', [['new', NEW, ''], ['fin', FIN, '']], 't16'],
  ],
  // 후보별 (손잡이로 하나씩 되돌림). 굽기는 2코어(cand c2)에서 봄. 랜딩·찻방 예열은 main 의 기준(예열 없음)과 비교
  cand: [
    // 예열은 main 의 mid(11-16 예열: 물체마다 compileAsync·펜스, 결과 파일 이름을 new → mid 로 바꿔 둠)·base 와 비교
    ['explore', [['bake1', NEW, 'fstrips=1&fmsaa=0'], ['def', NEW, '']], 'c2'],
    ['room', [['old-bake', NEW, 'rbake=0'], ['def', NEW, '']], 'c2'],
  ],
}

function cpuNow() {
  try { return +execFileSync('powershell', ['-NoProfile', '-c', "[math]::Round((Get-Counter '\\Processor(_Total)\\% Processor Time' -SampleInterval 1 -MaxSamples 2 | ForEach-Object { $_.CounterSamples.CookedValue } | Measure-Object -Average).Average,1)"], { encoding: 'utf8' }).trim() } catch { return -1 }
}
async function waitCalm() {
  for (let i = 0; i < 12; i++) {
    const c = cpuNow()
    if (c >= 0 && c < 25) return c
    process.stderr.write(`  CPU ${c}% → 15초 뒤\n`)
    await new Promise((r) => setTimeout(r, 15000))
  }
  return cpuNow()
}

const log = path.join(OUT, `_log-${set}.txt`)
for (const cfg of cfgs) {
  for (const [screen, pair, only] of PLAN[set]) {
    if (only && only !== cfg) continue
    if (process.env.ONLY && !process.env.ONLY.split(',').includes(screen)) continue // ONLY=room,explore 처럼 화면 고르기
    const [p, scenario] = SCREENS[screen]
    for (let i = 0; i < REPS; i++) {
      for (const [label, host, extra] of pair) {
        const name = `${set}-${screen}-${label}-${cfg}-${i}`
        if (fs.existsSync(path.join(OUT, name + '.json')) && !process.env.FORCE) continue // 끊겼다 다시 돌릴 때 이어서
        const cpu = await waitCalm()
        const env = { ...process.env, REPS: '1', OUT }
        if (cfg === 'c2') env.AFF = '3'; else delete env.AFF
        if (set === 'revisit') env.PRELOAD = '6000'; else delete env.PRELOAD
        const mode = cfg === 'gpu' ? 'gpu' : 'hwoff'
        const t0 = Date.now()
        try {
          const outp = execFileSync('node', [path.join(here, 'cdp-scene.mjs'), name, mode, host + q(p, extra), scenario], { encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'ignore'], timeout: 600000 })
          const s = JSON.parse(outp.trim().split('\n').pop())
          const line = `${name} cpu${cpu}% ${((Date.now() - t0) / 1000).toFixed(0)}s ready ${s.load?.readyMs} ltMax ${s.load?.longTaskMax} frz ${s.load?.worstFreezeMs}`
          console.log(line); fs.appendFileSync(log, line + '\n')
        } catch (e) {
          const line = `${name} 실패 ${String(e.message).slice(0, 200)}`
          console.log(line); fs.appendFileSync(log, line + '\n')
        }
      }
    }
  }
}
