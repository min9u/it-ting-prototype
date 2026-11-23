import * as THREE from 'three'

/**
 * PlayCanvas 버전과 같은 방식의 환경광: 세로 그라데이션 한 장을 PMREM으로 구워 scene.environment로 쓴다.
 * stops = [위치(0=위, 1=아래), 색] 목록
 */
export function gradientEnv(renderer: THREE.WebGLRenderer, stops: [number, string][]) {
  const c = document.createElement('canvas')
  c.width = 512; c.height = 256
  const g = c.getContext('2d')!
  const gr = g.createLinearGradient(0, 0, 0, 256)
  for (const [p, col] of stops) gr.addColorStop(p, col)
  g.fillStyle = gr; g.fillRect(0, 0, 512, 256)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.mapping = THREE.EquirectangularReflectionMapping
  const pmrem = new THREE.PMREMGenerator(renderer)
  const env = pmrem.fromEquirectangular(t).texture
  t.dispose()
  pmrem.dispose()
  return env
}

/** 방: 크림(위) → 살구 → 테라코타(아래) */
export const ROOM_ENV: [number, string][] = [[0, '#fff4ea'], [0.5, '#f2ddd0'], [1, '#b88a70']]
/** 밭: 하늘 → 지평선 → 풀빛 */
export const FIELD_ENV: [number, string][] = [[0, '#c4dcf0'], [0.45, '#e4eef2'], [0.5, '#f0f2e8'], [0.54, '#d6d2bc'], [1, '#b0a892']]
