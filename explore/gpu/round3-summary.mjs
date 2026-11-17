// 그래픽 3차 결과 모으기 (2026-11-17, docs/rendering-experiments-3.md)
// node explore/gpu/round3-summary.mjs [md]
// results/round3/scene/*.json(round3-perf.mjs) + results/round3/quality.json(round3-quality.py) → results/round3.json
// md 를 주면 문서용 표를 출력
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'
const here = path.dirname(fileURLToPath(import.meta.url))
const R = path.join(here, 'results', 'round3')
const SC = path.join(R, 'scene')

/** 실행 결과 → 화면별로 볼 숫자 (한 실행) */
function pick(screen, s, run) {
  const L = s.load ?? {}
  const o = { readyMs: L.readyMs, loadLongTaskMs: L.longTaskMs, loadLongTaskMax: L.longTaskMax, loadFreezeMs: L.worstFreezeMs }
  if (L.stillAt != null) o.stillAtMs = L.stillAt
  const caps = run?.captures?.kinds ?? {}
  if (screen === 'room' || screen === 'visit') {
    Object.assign(o, { idleCpuGpu: s.idle2?.cpuGpu, idleSceneFps: s.idle2?.sceneFps, walkFps: s.walk?.sceneFps, walkRafFps: s.walk?.rafFps, walkWorstGap: s.walk?.sceneWorstGap, walkCpuGpu: s.walk?.cpuGpu })
    // 첫 진입 직후 가만히(선명한 방 굽기 포함): 페이지 rAF 최악 간격 = 화면이 멈춘 시간
    Object.assign(o, { idle1RafWorst: s.idle?.worstGap, idle1LongTaskMax: s.idle?.longTaskMax })
    if (caps.roomBake) o.bakeMs = caps.roomBake.med
  } else if (screen === 'explore') {
    Object.assign(o, {
      idleCpuGpu: s.idle?.cpuGpu, hopFps: s.hop?.sceneFps, hopRafFps: s.hop?.rafFps, panFps: s.hop?.panFps, hopWorstGap: s.hop?.sceneWorstGap,
      hopRafWorst: s.hop?.worstGap, hopLongTaskMs: s.hop?.longTaskMs, hopCpuGpu: s.hop?.cpuGpu, clickFps: s.click?.sceneFps, floorSwitchMs: s.floorSwitchMs,
    })
    if (caps.sharpWait) { o.sharpReadyMed = caps.sharpWait.med; o.sharpReadyMax = caps.sharpWait.max; o.sharpN = caps.sharpWait.n }
    if (caps.sharpSaved) o.sharpSaved = caps.sharpSaved.n
  } else if (screen === 'landing') {
    Object.assign(o, { scrollLongTaskMs: s.scroll?.longTaskMs, scrollRafFps: s.scroll?.rafFps, roomReadyMs: s.roomReadyMs, idleCpuGpu: s.idle?.cpuGpu })
    if (L.fieldWarmMs != null) o.warmMs = L.fieldWarmMs
  } else if (screen === 'onb') {
    Object.assign(o, { idleCpuGpu: s.idle?.cpuGpu, idleSceneFps: s.idle?.sceneFps })
    if (caps.roomBake) o.bakeMs = caps.roomBake.med
  } else if (screen === 'tea') {
    Object.assign(o, { idleCpuGpu: s.idle?.cpuGpu, idleSceneFps: s.idle?.sceneFps, sendFps: s.send?.sceneFps, typeLatencyMs: s.typeLatencyMs, idle2CpuGpu: s.idle2?.cpuGpu })
  } else if (screen === 'nav') {
    for (const n of s.nav ?? []) {
      const k = n.to.replace(/^\/|\?.*$/g, '').replace(/\//g, '_')
      const kk = o[`${k}SwitchMs`] === undefined ? k : `${k}2`
      o[`${kk}SwitchMs`] = n.switchMs; o[`${kk}LongTaskMax`] = n.longTaskMax; o[`${kk}LongTaskMs`] = n.longTaskMs
    }
  }
  try { const st = JSON.parse(run?.tier?.store ?? 'null'); if (st?.low) o.tierStored = st.low } catch { /* 없음 */ }
  return o
}

const med = (v) => {
  const a = v.filter((x) => typeof x === 'number').sort((x, y) => x - y)
  if (!a.length) return v.find((x) => x != null) ?? null
  const m = a.length >> 1
  return a.length % 2 ? a[m] : +((a[m - 1] + a[m]) / 2).toFixed(1)
}

// set-screen-label-cfg-i
const groups = {}
for (const f of fs.readdirSync(SC).filter((f) => f.endsWith('.json'))) {
  const m = f.match(/^(\w+)-(\w+)-([\w-]+?)-(t16|c2|gpu)-(\d+)\.json$/)
  if (!m) continue
  const [, set, screen, label, cfg] = m
  const j = JSON.parse(fs.readFileSync(path.join(SC, f), 'utf8'))
  const k = `${set}|${screen}|${label}|${cfg}`
  ;(groups[k] ??= []).push(pick(screen, j.summary, j.runs?.[0]))
}
const agg = {}
for (const [k, rows] of Object.entries(groups)) {
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))]
  agg[k] = Object.fromEntries(keys.map((x) => [x, med(rows.map((r) => r[x]))]))
  agg[k].n = rows.length
}
const get = (set, screen, label, cfg) => agg[`${set}|${screen}|${label}|${cfg}`] ?? null

const quality = fs.existsSync(path.join(R, 'quality.json')) ? JSON.parse(fs.readFileSync(path.join(R, 'quality.json'), 'utf8')) : {}
const qOf = (screen, v) => {
  const q = quality[screen]?.[v]
  return q ? { quality: { psnr: q.psnr, ssim: q.ssim, bg: q.bg, mole: q.mole }, shot: q.shot, crops: q.crops } : { quality: null, shot: null, crops: {} }
}

const SCREEN_NAME = { room: '내 땅굴', visit: '남의 땅굴', explore: '탐색 들판', landing: '랜딩', onb: '온보딩 미리보기', tea: '찻방(모임 5마리)', nav: '화면 전환' }
const candidates = []
for (const screen of Object.keys(SCREEN_NAME)) {
  const add = (key, name, desc, adopted, perf, qv) => candidates.push({ key: `${screen}.${key}`, screen, name, desc, adopted, perf, ...qOf(screen, qv) })
  add('gpu', 'GPU 고화질 (가속 켬, 화질 기준)', '가속 켠 크롬(RTX). 3차 빌드. 저사양 기능은 꺼져 있음', false,
    { gpu: get('gpu', screen, 'new', 'gpu'), gpuBase: get('gpu', screen, 'base', 'gpu') }, 'gpu')
  add('base', '2차 결과 (기준)', '2차 결과 공유 빌드 (54c8b9f)', false, { t16: get('main', screen, 'base', 't16'), c2: get('main', screen, 'base', 'c2') }, 'base')
  add('def', '3차 기본값', '기기 단계 자동(첫 방문은 strong) + 예열(warm.ts) + 선명한 배경 띠 굽기(sharpBake) + 정지 그림', true,
    { t16: get('main', screen, 'new', 't16'), c2: get('main', screen, 'new', 'c2') }, 'new')
  add('mid', '3차 중간 (11-16 예열)', '11-16 에 해 둔 그대로: 예열에서 물체마다 compileAsync(확인 루프 54개) + 1×1 그리기마다 펜스 기다림. 11-17 에 한 번 기다리기·묶기로 바꿈', false,
    { t16: get('main', screen, 'mid', 't16'), c2: get('main', screen, 'mid', 'c2') }, null)
  if (screen === 'room' || screen === 'explore') {
    add('weak', '3차 약한 단계 (weak)', '2코어급으로 판정된 뒤(다음 방문부터): 굽기 6띠·MSAA 없음, 카메라 이동 0.22배', true,
      { t16: get('weak', screen, 'weak', 't16'), c2: get('weak', screen, 'weak', 'c2'), strongT16: get('weak', screen, 'strong', 't16'), strongC2: get('weak', screen, 'strong', 'c2') }, 'weak')
    add('revisit', '두 번째 방문', '같은 프로필로 다시 열기: 기기 단계 기억 + 구운 배경 IndexedDB (기준은 2차 빌드의 두 번째 방문)', true,
      { t16: get('revisit', screen, 'new', 't16'), c2: get('revisit', screen, 'new', 'c2'), baseT16: get('revisit', screen, 'base', 't16'), baseC2: get('revisit', screen, 'base', 'c2') }, null)
  }
  // 후보별 (손잡이로 하나씩 되돌림): cand-<screen>-<label>
  const CAND = {
    explore: [['bake1', '한 번에 굽기 (?fstrips=1&fmsaa=0)', '2차와 같은 한 장 굽기(띠 1, MSAA 없음). 2코어']],
    room: [['old-bake', '예전 선명한 방 (?rbake=0)', '2차: 1.5배 슈퍼샘플을 그 자리에서 읽음. 2코어']],
  }
  for (const [label, name, desc] of CAND[screen] ?? []) {
    add(label, name, desc, false, { t16: get('cand', screen, label, 't16'), c2: get('cand', screen, label, 'c2'), defT16: get('cand', screen, 'def', 't16'), defC2: get('cand', screen, 'def', 'c2') }, null)
  }
}

const out = {
  date: '2026-11-17',
  doc: 'docs/rendering-experiments-3.md',
  conditions: {
    t16: '가속 끈 크롬 157 헤드리스(WARP, i7-11700 16스레드), 1920×1080, 새 프로필',
    c2: '같은 조건 + 크롬을 CPU 2개에 묶음 (AFF=3, 약한 PC 흉내)',
    gpu: '가속 켠 크롬 (RTX 5060 Ti)',
    reps: '기준·개선을 번갈아(A/B/A/B) 2번씩, 중앙값(2개면 평균)',
    quality: 'GPU 고화질 대비 PSNR(dB)·SSIM. bg = 두더지 사각형+24px 를 뺀 곳, bg.edgeSsim = 배경 중 기준 밝기 기울기 상위 10%, mole = 두더지 사각형. 랜딩·찻방은 두더지 사각형이 없어 장면 전체만',
  },
  units: { '*Ms': 'ms', '*Fps': '초당 프레임', '*CpuGpu': 'GPU 프로세스(WARP 가 그리는 곳) CPU %, 100 = 코어 하나' },
  candidates,
  raw: agg,
}
fs.writeFileSync(path.join(here, 'results', 'round3.json'), JSON.stringify(out, null, 1))
console.log(`round3.json: 후보 ${candidates.length}개, 묶음 ${Object.keys(agg).length}개`)

if (process.argv[2] === 'md') {
  for (const [k, v] of Object.entries(agg).sort()) console.log(k, JSON.stringify(v))
}
