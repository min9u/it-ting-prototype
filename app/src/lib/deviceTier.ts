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
 * 메가픽셀당 ms 로 바꾸고, 장면마다 다른 무게(KIND_WEIGHT)로 나눈 값이 WEAK_MS_PER_MP 를 넘으면 weak.
 * 결과는 localStorage 에 기억(digul.tier.v1) → 다음 방문부터는 처음부터 그 단계. 실험실(lib/lowLab.ts tier)로 덮어쓸 수 있음.
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
 * 이 값(메가픽셀당 ms)을 넘으면 weak. 처음 몇 번 중 가장 작은 값으로 (GPU 에 먼저 걸린 일이 끼면 길게 나와서).
 * 0.55배 배경(0.53MP) 측정: 16스레드 WARP 땅굴 25~49 · 탐색 들판 37, 2코어 땅굴 225 · 탐색 들판 206 → 그 사이 (양쪽 2배 여유)
 */
const WEAK_MS_PER_MP = 110

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
  return stored?.low ?? 'strong'
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
  if (samples.length < 2) return
  // 가장 작은 값 = 다른 일(텍스처 올리기·셰이더)이 끼지 않은 쪽
  const best = Math.min(...samples)
  const low: 'strong' | 'weak' = best > WEAK_MS_PER_MP ? 'weak' : 'strong'
  if (stored?.low === low && Math.abs((stored.score ?? 0) - best) < 5) return
  if (stored?.low && stored.low !== low) console.info(`[3D] 그리기 속도(${Math.round(best)}ms/MP)를 보고 저사양 단계를 ${stored.low} → ${low} 로 바꿨어요 (다음 화면부터)`)
  stored = { ...(stored ?? { v: 1, at: 0 }), v: 1, low, score: Math.round(best), at: Date.now() }
  write(stored)
}

/** 측정을 더 받을지 (이 탭에서 몇 번까지만) */
export const wantsRenderCost = () => graphicsTier() === 'software' && samples.length < 4

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
