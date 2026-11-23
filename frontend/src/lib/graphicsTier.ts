/*
 * 그래픽 가속 감지 (docs/gpu-fallback-research.md 1번).
 * 크롬·엣지는 가속을 끄면 CPU 렌더러(WARP "Microsoft Basic Render Driver", SwiftShader, llvmpipe)로 그린다.
 * 그림은 같지만 1~3fps라 페이지 전체가 멈춤 → 'software'면 저사양 모드 + 안내 띠.
 *
 * 신호: failIfMajorPerformanceCaveat 로 컨텍스트를 못 받으면 소프트웨어 (주 신호),
 * 렌더러 문자열은 보조·기록용. 몇 ms면 끝나고 결과는 한 번만 계산한다.
 * 시험용: 주소에 ?gpu=software (또는 gpu=gpu) 를 붙이면 강제로 바꿀 수 있다.
 */

import { getLab } from './lowLab'

export type GraphicsTier = 'gpu' | 'software'

let cached: { tier: GraphicsTier; renderer: string } | null = null

const SOFTWARE_RE = /basic render driver|swiftshader|llvmpipe|softpipe|software/i

function forced(): GraphicsTier | null {
  try {
    const q = location.search + location.hash
    const m = q.match(/[?&]gpu=(gpu|software)\b/)
    if (m) return m[1] as GraphicsTier
  } catch { /* 무시 */ }
  return null
}

export function detectGraphics() {
  if (cached) return cached
  const f = forced()
  if (f) return (cached = { tier: f, renderer: 'forced' })

  let renderer = ''
  let tier: GraphicsTier = 'gpu'
  try {
    const c = document.createElement('canvas')
    const opts = { failIfMajorPerformanceCaveat: true }
    const fast = (c.getContext('webgl2', opts) ?? c.getContext('webgl', opts)) as WebGLRenderingContext | null
    const gl = fast ?? (document.createElement('canvas').getContext('webgl') as WebGLRenderingContext | null)
    if (gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info')
      renderer = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : ''
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
    // 대상 PC는 모두 WebGL이 된다 (2026-11-11 사용자 확인). 그래도 못 받으면 가장 느린 쪽으로 취급
    if (!fast || SOFTWARE_RE.test(renderer)) tier = 'software'
  } catch {
    tier = 'software'
  }
  return (cached = { tier, renderer })
}

/** 3D 품질을 정할 때 쓰는 값. 저사양 실험실(lib/lowLab.ts)에서 모드를 강제했으면 그것을 따름 (안내 띠는 detectGraphics 의 실제 값) */
export const graphicsTier = (): GraphicsTier => {
  const f = getLab().force
  if (f === 'low') return 'software'
  if (f === 'high') return 'gpu'
  return detectGraphics().tier
}

/** 크롬과 엣지는 설정 주소·메뉴 이름이 다르다 */
export function browserSettings() {
  const brands = (navigator as Navigator & { userAgentData?: { brands?: { brand: string }[] } }).userAgentData?.brands ?? []
  const edge = brands.some((b) => /edge/i.test(b.brand)) || /Edg\//.test(navigator.userAgent)
  return edge
    ? { name: 'Edge', url: 'edge://settings/system', menu: '설정 → 시스템 및 성능', toggle: '사용 가능한 경우 그래픽 가속 사용' }
    : { name: 'Chrome', url: 'chrome://settings/system', menu: '설정 → 시스템', toggle: '가능한 경우 그래픽 가속 사용' }
}
