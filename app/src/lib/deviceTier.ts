/*
 * 기기 자동 맞춤 (docs/rendering-experiments-3.md 2번)
 *
 * 단계 세 개:
 * - gpu: 그래픽 가속 켬 (원래 품질 그대로)
 * - strong: 가속이 꺼져 CPU(WARP)로 그리지만 CPU 가 넉넉함 (실제 SSAFY PC, 16스레드). 저사양 기본값
 * - weak: 가속이 꺼졌고 CPU 도 약함 (크롬을 2코어로 묶은 것 정도). 한 번에 크게 그리는 일을 더 잘게 나누고 해상도를 조금 낮춤
 *
 * gpu / 저사양은 graphicsTier(감지, 실험실 강제 포함)로 정하고, 저사양 안에서 strong / weak 는 **실제 그리기 시간**으로 정한다:
 * 배경을 한 번 그릴 때(staticBackdrop capture, 장면이 다 차려진 뒤 처음 몇 번) GPU 펜스로 끝날 때까지 걸린 시간을 재서
 * 메가픽셀당 ms 로 바꾸고, 장면마다 다른 무게(KIND_WEIGHT)로 나눈 값이 아래 기준(WEAK_MIN·WEAK_SECOND)을 넘으면 weak.
 * 2026-11-17 판정 고침 (docs/rendering-experiments-3.md 4-1, 이번 측정 88번의 값으로 고름): 처음엔 "가장 작은 값 > 110"이었는데
 *   땅굴은 2코어에서도 가끔 빠른 값(60~78)이 나와 2코어 40번 중 14번을 strong 으로 잘못 봤음. 16스레드도 다른 3D 가 같이 돌면
 *   (랜딩의 밭 + 방, 화면 전환) 큰 값이 섞임. 그래서 3개 모이면 **가장 작은 값 > 50 이고, 첫 값(텍스처 올리기가 끼어 늘 큼)을 뺀 나머지 중
 *   두 번째로 작은 값 > 110** 일 때만 weak → 16스레드 48번 중 0번, 2코어 40번 중 1번(strong 쪽으로) 틀림.
 *   strong 을 weak 로 잘못 보면 화질이 내려가므로(MSAA 없음) 애매하면 strong 쪽으로.
 * 결과는 localStorage 에 기억(digul.tier.v1) → 다음 방문부터는 처음부터 그 단계. 바뀌면 onLowTierChange 로 알려서 탐색 들판은 그 자리에서 바꿈.
 * 기억이 없으면(첫 방문) 논리 프로세서가 4개 이하인 PC 는 weak 로 시작 (navigator.hardwareConcurrency).
 * 실험실(lib/lowLab.ts tier)로 덮어쓸 수 있음.
 * GPU 로 감지됐는데 처음 2초가 느려 저사양으로 내려간 적이 있으면(engine.ts) 그것도 3일 동안 기억.
 */
import { graphicsTier } from './graphicsTier'
import { getLab } from './lowLab'

export type DeviceTier = 'gpu' | 'strong' | 'weak'

interface Stored {
  v: 1
  /** 저사양 안에서 정한 단계 */
  low?: 'strong' | 'weak'
  /** 정할 때 쓴 값 (장면 무게로 나눈 메가픽셀당 ms) */
  score?: number
  /** GPU 로 감지됐지만 느려서 저사양으로 내린 시각 (ms, Date.now) */
  downAt?: number
  at: number
}

const KEY = 'digul.tier.v1'
/** GPU 인데 느려서 내린 것을 기억하는 기간 */
const DOWN_KEEP_MS = 3 * 24 * 3600 * 1000
/**
 * 장면 무게: 같은 기기에서 배경 한 번 그리기의 메가픽셀당 ms 가 장면마다 다름 (재질·물체 수). 이 값으로 나눠 "들판 기준"으로 맞춤.
 * 측정 (docs/rendering-experiments-3.md 2번): 탐색 들판 hole · 땅굴 room · 옛 밭 field
 */
const KIND_WEIGHT: Record<string, number> = { hole: 1, room: 1, field: 1 }
/**
 * weak 판정 기준 (메가픽셀당 ms, 0.55배 배경 0.53MP). 측정 (docs/rendering-experiments-3.md 4-1):
 * 가장 작은 값 16스레드 22~80 · 2코어 60~415, 첫 값 뺀 두 번째 16스레드 30~169 · 2코어 68~883
 */
const WEAK_MIN = 50, WEAK_SECOND = 110

const read = (): Stored | null => {
  try { const r = localStorage.getItem(KEY); return r ? (JSON.parse(r) as Stored) : null } catch { return null }
}
const write = (s: Stored) => { try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* 막혀 있으면 이 탭에서만 */ } }

let stored = read()
/** 이 탭에서 잰 값 (장면 무게로 나눈 메가픽셀당 ms) */
const samples: number[] = []

/** 측정용 주소 손잡이 ?tier=strong|weak (실험실보다 먼저) */
function forced(): 'strong' | 'weak' | null {
  try { return ((location.search + location.hash).match(/[?&]tier=(strong|weak)\b/)?.[1] as 'strong' | 'weak' | undefined) ?? null } catch { return null }
}

/** 지금 단계 */
export function deviceTier(): DeviceTier {
  if (graphicsTier() === 'gpu' && !gpuWasSlow()) return 'gpu'
  return lowTier()
}

/** 저사양 안의 단계 (주소 손잡이 → 실험실 → 기억 → 기본 strong) */
export function lowTier(): 'strong' | 'weak' {
  const f = forced()
  if (f) return f
  const lab = getLab().tier
  if (lab === 'strong' || lab === 'weak') return lab
  return stored?.low ?? guess()
}

/** 기억이 없을 때 첫 짐작: 논리 프로세서 4개 이하면 weak (크롬을 CPU 2개에 묶은 시험에서는 16 으로 나와 시험되지 않음) */
function guess(): 'strong' | 'weak' {
  try { const n = navigator.hardwareConcurrency; return n > 0 && n <= 4 ? 'weak' : 'strong' } catch { return 'strong' }
}

const subs = new Set<(t: 'strong' | 'weak') => void>()
/** 저사양 단계가 바뀌면 알림 (그 장면에서 바로 바꿀 수 있는 것만: 탐색 들판 굽기 띠·MSAA·카메라 이동 해상도). 해제 함수를 돌려줌 */
export function onLowTierChange(cb: (t: 'strong' | 'weak') => void): () => void {
  subs.add(cb)
  return () => { subs.delete(cb) }
}

/** GPU 로 감지됐지만 최근에 느려서 저사양으로 내린 적이 있음 (engine.ts 가 처음부터 low 로) */
export function gpuWasSlow(): boolean {
  if (getLab().force !== 'auto') return false
  const at = stored?.downAt
  return !!at && Date.now() - at < DOWN_KEEP_MS
}

/** engine.ts: GPU 인데 처음 2초가 느려 저사양으로 내림 → 기억 */
export function noteGpuSlow() {
  stored = { ...(stored ?? { v: 1, at: 0 }), v: 1, downAt: Date.now(), at: Date.now() }
  write(stored)
}

/**
 * 배경 한 번 그리기 시간 알림 (staticBackdrop 이 장면이 다 차려진 뒤 처음 몇 번 부름)
 * @param kind 장면 종류 (KIND_WEIGHT)
 * @param ms 그리기를 건 때부터 GPU 펜스가 풀릴 때까지
 * @param mp 그린 픽셀 수 (메가픽셀)
 */
export function noteRenderCost(kind: string, ms: number, mp: number) {
  if (!(mp > 0) || !(ms > 0)) return
  const score = ms / mp / (KIND_WEIGHT[kind] ?? 1)
  samples.push(score)
  const w = window as unknown as { __tierSamples?: [string, number, number, number][] }
  ;(w.__tierSamples ??= []).push([kind, Math.round(ms), +mp.toFixed(2), Math.round(score)]) // 측정용
  if (samples.length < 3) return
  // 둘 다 넘을 때만 weak (위 설명): 가장 작은 값 + 첫 값(텍스처 올리기·첫 그리기가 끼어 늘 큼)을 뺀 나머지 중 두 번째로 작은 값
  const rest = samples.slice(1).sort((a, b) => a - b)
  const best = rest[1]
  const low: 'strong' | 'weak' = Math.min(...samples) > WEAK_MIN && best > WEAK_SECOND ? 'weak' : 'strong'
  const before = lowTier()
  if (stored?.low === low && Math.abs((stored.score ?? 0) - best) < 5) return
  stored = { ...(stored ?? { v: 1, at: 0 }), v: 1, low, score: Math.round(best), at: Date.now() }
  write(stored)
  const now = lowTier() // 주소 손잡이·실험실로 덮어썼으면 그대로
  if (now !== before) {
    console.info(`[3D] 그리기 속도(${Math.round(best)}ms/MP)를 보고 저사양 단계를 ${before} → ${now} 로 바꿨어요`)
    subs.forEach((f) => { try { f(now) } catch { /* 무시 */ } })
  }
}

/** 측정을 더 받을지 (이 탭에서 몇 번까지만) */
export const wantsRenderCost = () => graphicsTier() === 'software' && samples.length < 5

/** 실험실 패널 표시용 */
export function tierInfo() {
  return { tier: deviceTier(), low: lowTier(), stored, samples: [...samples] }
}

/** 실험실 "기억 지우기" */
export function forgetTier() {
  stored = null
  samples.length = 0
  try { localStorage.removeItem(KEY) } catch { /* 무시 */ }
}
