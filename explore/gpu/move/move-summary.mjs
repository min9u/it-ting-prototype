// 이동 중 화질 작업 성능 숫자 모으기 (2026-11-17, docs/explore-move-quality.md)
// node explore/gpu/move/move-summary.mjs   → results/move.json 의 perf (중앙값) + 문서용 표 출력
// 입력: results/move/scene/<묶음>-explore-<라벨>-<cfg>-<i>.json (round3-perf.mjs move·moveab, PERF_OUT=results/move/scene, TRACE=1)
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'
const here = path.dirname(fileURLToPath(import.meta.url))
const DIR = path.join(here, '..', 'results', 'move', 'scene')
const OUT = path.join(here, '..', 'results', 'move.json')
const med = (a) => { const v = a.filter((x) => typeof x === 'number').sort((x, y) => x - y); return v.length ? (v.length % 2 ? v[v.length >> 1] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2) : null }
const files = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter((f) => f.endsWith('.json')) : []
const groups = {}
for (const f of files) {
  const m = f.match(/^(\w+)-explore-(\w+)-(t16|c2|gpu)-(\d+)\.json$/)
  if (!m) continue
  const [, set, label, cfg] = m
  const j = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))
  const r = j.runs?.[0]
  if (!r) continue
  const k = `${set}|${cfg}|${label}`
  ;(groups[k] ??= []).push(r)
}
const pick = {
  '다 보이기까지 (ms)': (r) => r.load?.readyMs,
  '첫 진입 가장 긴 멈춤 (ms)': (r) => r.load?.longTaskMax,
  '첫 진입 페이지 최악 간격 (ms)': (r) => r.load?.worstFreezeMs,
  '점프 장면 fps': (r) => r.hop?.sceneFps,
  '카메라 이동 fps (rAF)': (r) => r.hop?.panFps,
  '카메라 이동 fps (화면 합성)': (r) => r.hop?.compFps,
  '카메라 이동 중 가장 긴 합성 간격 (ms)': (r) => r.hop?.compWorstGap,
  '점프 중 가장 긴 장면 끊김 (ms)': (r) => r.hop?.sceneWorstGap,
  '점프 중 페이지 최악 간격 (ms)': (r) => r.hop?.worstGap,
  '점프 중 긴 작업 합 (ms)': (r) => r.hop?.longTaskMs,
  '점프 중 가장 긴 멈춤 (ms)': (r) => r.hop?.longTaskMax,
  '구멍 클릭 점프: 장면 fps': (r) => r.click?.sceneFps,
  '구멍 클릭 점프: 카메라 이동 fps (rAF)': (r) => r.click?.panFps,
  '구멍 클릭 점프: 가장 긴 장면 끊김 (ms)': (r) => r.click?.sceneWorstGap,
  '들판 바꾸기 (ms)': (r) => r.floorSwitchMs,
  '들판 바꾸기 가장 긴 멈춤 (ms)': (r) => r.floor?.longTaskMax,
  '가만히 그리기 CPU (%)': (r) => r.idle?.cpuGpu,
  '점프 중 그리기 CPU (%)': (r) => r.hop?.cpuGpu,
  '땅속 기다림 (중앙, ms)': (r) => r.captures?.kinds?.hold?.med,
  '땅속 기다림 (최대, ms)': (r) => r.captures?.kinds?.hold?.max,
  '도착 자리 준비 (중앙, ms)': (r) => r.captures?.kinds?.prep?.med,
  '도착하자마자 선명 (바꿔 끼운 횟수)': (r) => r.captures?.kinds?.swap?.n,
  '도착 뒤 다시 굽기 (횟수)': (r) => r.captures?.kinds?.sharpWait?.n,
  '도착 뒤 다시 굽기 시간 (중앙, ms)': (r) => r.captures?.kinds?.sharpWait?.med,
}
const perf = {}
for (const [k, runs] of Object.entries(groups)) {
  const [set, cfg, label] = k.split('|')
  const o = { n: runs.length }
  for (const [name, f] of Object.entries(pick)) { const v = med(runs.map(f)); if (v !== null) o[name] = v }
  ;((perf[set] ??= {})[cfg] ??= {})[label] = o
}
const data = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {}
data.perf = perf
fs.writeFileSync(OUT, JSON.stringify(data, null, 1))
// 표
for (const [set, byCfg] of Object.entries(perf)) {
  for (const [cfg, byLabel] of Object.entries(byCfg)) {
    const labels = Object.keys(byLabel).sort()
    console.log(`\n#### ${set} · ${cfg}`)
    console.log(`| | ${labels.map((l) => `${l} (n=${byLabel[l].n})`).join(' | ')} |`)
    console.log(`|---|${labels.map(() => '---').join('|')}|`)
    for (const name of Object.keys(pick)) {
      if (!labels.some((l) => byLabel[l][name] != null)) continue
      console.log(`| ${name} | ${labels.map((l) => byLabel[l][name] ?? '–').join(' | ')} |`)
    }
  }
}
