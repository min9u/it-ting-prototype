// 탐색 들판 후보별 화질 ↔ 성능 (2026-11-16, docs/rendering-experiments-2.md)
// node explore/gpu/field-tradeoff.mjs <shots|perf|summary> [키 ...]
//   shots: 후보마다 같은 장면 스크린샷 (cdp-quality.mjs, ?qshot=1) → quality.py 로 GPU 기준 대비 PSNR·SSIM
//   perf: 후보마다 cdp-scene.mjs explore (REPS 번, 중앙값). AFF=3 이면 2코어 (결과 이름에 -c2)
//   summary: results/field-tradeoff.json 으로 모음 (후보 이름·설명·성능·화질·스크린샷 경로)
// 공유 빌드를 http://localhost:5301 에 띄워 둔 상태에서
import { execFileSync } from 'node:child_process'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'
import { CANDIDATES } from './field-candidates.mjs'
const here = path.dirname(fileURLToPath(import.meta.url))
const [cmd, ...keys] = process.argv.slice(2)
const list = keys.length ? CANDIDATES.filter((c) => keys.includes(c.key)) : CANDIDATES
const BASE = 'http://localhost:5301/#/burrow/explore'
const urlOf = (c, extra = '') => { const q = [c.query, extra].filter(Boolean).join('&'); return q ? `${BASE}?${q}` : BASE }
const node = (args, env = {}) => execFileSync('node', args, { encoding: 'utf8', env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'ignore'], timeout: 1800000 })
const aff = process.env.AFF ? '-c2' : ''

if (cmd === 'shots') {
  for (const c of list) { const o = node([path.join(here, 'cdp-quality.mjs'), `q-${c.key}`, c.mode, urlOf(c, 'qshot=1')], { WAIT: '6000' }); console.log(o.trim().slice(0, 200)) }
  console.log(execFileSync('python', [path.join(here, 'quality.py'), 'q-gpu', ...CANDIDATES.filter((c) => c.key !== 'gpu').map((c) => `q-${c.key}`)], { encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' } }))
} else if (cmd === 'perf') {
  for (const c of list) {
    const o = node([path.join(here, 'cdp-scene.mjs'), `ft-${c.key}${aff}`, c.mode, urlOf(c), 'explore'])
    console.log(c.key, o.trim().split('\n').pop().slice(0, 400))
  }
} else if (cmd === 'summary') {
  const read = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return null } }
  const pick = (s) => s && {
    readyMs: s.load?.readyMs, loadLongTaskMs: s.load?.longTaskMs, loadWorstFreezeMs: s.load?.worstFreezeMs, warmMs: s.load?.warmMs,
    idleSceneFps: s.idle?.sceneFps, idleCpuGpuPct: s.idle?.cpuGpu, idleCpuRendererPct: s.idle?.cpuRenderer, idleRafFps: s.idle?.rafFps,
    hopSceneFps: s.hop?.sceneFps, hopRafFps: s.hop?.rafFps, hopCpuGpuPct: s.hop?.cpuGpu, hopLongTaskMs: s.hop?.longTaskMs, hopWorstGapMs: s.hop?.worstGap, hopSceneWorstGapMs: s.hop?.sceneWorstGap,
    panFps: s.hop?.panFps, panWorstGapMs: s.hop?.panWorstGap,
    clickSceneFps: s.click?.sceneFps, floorSwitchMs: s.floorSwitchMs, floorLongTaskMs: s.floor?.longTaskMs,
    captureBdMaxMs: s.captures?.bdMax, captureSharpMedMs: s.captures?.sharpMed, captureSharpMaxMs: s.captures?.sharpMax, captureWaitMedMs: s.captures?.waitMed, captureWaitMaxMs: s.captures?.waitMax,
    renderer: s.renderer,
  }
  const out = {
    date: '2026-11-16', doc: 'docs/rendering-experiments-2.md',
    adopted: 'def (= S1_RA + 느리면 A_R)', reference: 'gpu',
    conditions: '공유 빌드(vite preview), 헤드리스 크롬 157 1920×1080, 새 프로필. hwoff = 그래픽 가속 끔 → WARP(Microsoft Basic Render Driver), i7-11700 16스레드. c2 = 크롬을 CPU 2코어로 묶음. 성능은 3번 중앙값',
    metrics: {
      performance: 'readyMs 다 보이기까지, loadWorstFreezeMs 들어올 때 가장 긴 멈춤, idle* 가만히 6초, hop* 방향키 점프 4번(1.7초 간격, hopSceneWorstGapMs = 장면 프레임 사이 최대 간격 = 배경 다시 찍기 멈춤 포함), pan* 점프 카메라 0.4초 동안, captureBd/Sharp* 배경 다시 찍기(메인 스레드 ms), captureWait* 비동기 읽기를 걸어 둔 뒤 고해상도 배경이 준비되기까지(ms), cpuGpuPct = 그리기(GPU 프로세스, WARP) CPU 사용률(100 = 코어 하나), cpuRendererPct = 페이지(메인 스레드 포함)',
      quality: 'GPU 기준 대비 PSNR(dB)·SSIM. bg = 배경(두더지 사각형 빼고), mole = 두더지 사각형, edge = 배경 중 기준 그림 밝기 기울기 상위 10%(계단·흐림이 드러나는 곳)',
    },
    candidates: CANDIDATES.map((c) => {
      const q = read(path.join(here, 'results', 'quality', `q-${c.key}.metrics.json`))
      return {
        key: c.key, label: c.label, desc: c.desc, mode: c.mode, query: c.query,
        perf16: pick(read(path.join(here, 'results', 'scene', `ft-${c.key}.json`))?.summary),
        perf2core: pick(read(path.join(here, 'results', 'scene', `ft-${c.key}-c2.json`))?.summary),
        quality: q && { psnr: q.psnr, ssim: q.ssim, psnrBg: q.psnrBg, ssimBg: q.ssimBg, psnrMole: q.psnrMole, ssimMole: q.ssimMole, ssimEdge: q.ssimEdge },
        shot: q?.shot ?? null, crops: q?.crops ?? null,
      }
    }),
  }
  fs.writeFileSync(path.join(here, 'results', 'field-tradeoff.json'), JSON.stringify(out, null, 2))
  for (const c of out.candidates) console.log(c.key.padEnd(10), JSON.stringify({ q: c.quality && [c.quality.ssimBg, c.quality.ssimEdge, c.quality.ssimMole], p16: c.perf16 && [c.perf16.hopSceneFps, c.perf16.panFps, c.perf16.idleCpuGpuPct, c.perf16.hopSceneWorstGapMs, c.perf16.captureSharpMaxMs], p2: c.perf2core && [c.perf2core.hopSceneFps, c.perf2core.panFps, c.perf2core.idleCpuGpuPct, c.perf2core.hopSceneWorstGapMs] }))
}
process.exit(0)
