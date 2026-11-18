// 저사양 측정 요약 → tools/room-diversity/perf.json (비교 페이지 "저사양 PC" 표, docs/room-diversity-2-2026-11-18.md)
// 사용: node tools/room-diversity/perf-summary.mjs <결과 폴더>   (explore/gpu/cdp-scene.mjs 가 만든 <이름>.json 들, 기본 explore/gpu/results/room-diversity-2)
// 이름 규칙: before-gpu · after-gpu · before-hwoff · after-hwoff · before-hwoff2c · after-hwoff2c (+ after-hwoff2c-lite = ?stylepat=0, 있으면)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const dir = path.resolve(process.argv[2] ?? path.join(HERE, '../../explore/gpu/results/room-diversity-2'))
const read = (n) => { const f = path.join(dir, `${n}.json`); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')).summary : null }
const CONDS = [
  ['가속 켬 (RTX 5060 Ti)', 'gpu'],
  ['가속 끔 · 16스레드 (WARP)', 'hwoff'],
  ['가속 끔 · CPU 2코어 (WARP)', 'hwoff2c'],
]
const METRICS = [
  ['첫 진입 가장 긴 멈춤', (s) => s.load?.longTaskMax, 'ms'],
  ['다 보이기까지', (s) => s.load?.readyMs, 'ms'],
  ['걷기 장면 fps', (s) => s.walk?.sceneFps, 'fps'],
  ['가만히 있을 때 CPU (페이지 + 그리기)', (s) => (s.idle ? Math.round((s.idle.cpuRenderer ?? 0) + (s.idle.cpuGpu ?? 0)) : undefined), '%'],
]
const fmt = (v, u) => (v == null ? '-' : `${typeof v === 'number' && u !== 'fps' ? Math.round(v) : v}${u === '%' ? '%' : u === 'ms' ? 'ms' : ''}`)
const rows = []
for (const [cond, key] of CONDS) {
  const b = read(`before-${key}`), a = read(`after-${key}`)
  if (!b || !a) continue
  for (const [what, f, u] of METRICS) rows.push({ cond, what, before: fmt(f(b), u), after: fmt(f(a), u) })
  const lite = read(`after-${key}-lite`)
  if (lite) for (const [what, f, u] of METRICS.slice(0, 3)) rows.push({ cond: `${cond} · 무늬 없이(가벼운 꾸미기)`, what, before: fmt(f(b), u), after: fmt(f(lite), u) })
  // 측정 뒤 고친 마지막 빌드(덧붙이 재질을 가구 재질 복제로 · 꾸미기 한 번만 입히기)로 다시 잰 것 (같은 시간대 전 묶음은 없음)
  const fin = read(`after-final-${key}`)
  if (fin) for (const [what, f, u] of METRICS.slice(0, 3)) rows.push({ cond: `${cond} · 마지막 빌드로 다시`, what, before: fmt(f(b), u), after: fmt(f(fin), u) })
}
const renderer = read('after-gpu')?.renderer ?? ''
const out = {
  rows,
  how: `explore/gpu/cdp-scene.mjs room 시나리오, 공유 빌드(npm run build:share), 헤드리스 크롬 1920×1080, 반복 3번 가운데 값. 가만히 6초 → 걷기(D·A) 8초 → 가만히 6초. CPU 100% = 코어 하나. ${renderer ? `가속 켬 = ${renderer.replace(/^ANGLE \(|\)$/g, '')}. ` : ''}2코어 = 크롬을 CPU 2개에 묶음(start /affinity 3), 이 시험에서는 기기 단계가 strong 으로 잡혀 무늬를 그림 (실제 2코어 PC 는 weak → 무늬 없이)`,
}
fs.writeFileSync(path.join(HERE, 'perf.json'), JSON.stringify(out, null, 1))
console.log(rows.map((r) => `${r.cond} · ${r.what}: ${r.before} → ${r.after}`).join('\n'))
