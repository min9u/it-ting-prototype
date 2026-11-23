/*
 * 가구 낙하 "또로로록" 곡선 (design/digul_3d_handoff_v3/docs/furniture_drop_spec.md 2번 코드를 그대로 옮김)
 * t: 시작 후 경과 초 (0~0.60), H: 시작 높이(m), S: 방 중심 쪽 가로 오프셋(m), mode: 'fall' | 'pop'
 * 적용: position = 최종 + dir × side + (0, y, 0), rotation.y = 최종 + rotDeg, scale = (scaleH, scaleV, scaleH)
 */
const lerp = (a: number, b: number, u: number) => a + (b - a) * u
const clamp01 = (u: number) => Math.min(1, Math.max(0, u))
const easeOutCubic = (u: number) => 1 - (1 - u) ** 3
const easeInOutSine = (u: number) => 0.5 - 0.5 * Math.cos(Math.PI * u)
const easeOutQuad = (u: number) => 1 - (1 - u) * (1 - u)
type Key = [t: number, v: number, h: number]
const SQUASH: Key[] = [[0.30, 1.10, 0.953], [0.34, 0.80, 1.10], [0.40, 1.05, 0.976], [0.52, 1, 1], [0.555, 0.92, 1.04], [0.60, 1, 1]]
const POP: Key[] = [[0.00, 0, 0], [0.22, 1.08, 1.08], [0.30, 1, 1], [0.36, 0.90, 1.05], [0.46, 1.03, 0.985], [0.60, 1, 1]]

function keys(K: Key[], t: number, firstEase = easeInOutSine): [number, number] {
  for (let i = 0; i < K.length - 1; i++) {
    const [t0, v0, h0] = K[i], [t1, v1, h1] = K[i + 1]
    if (t >= t0 && t <= t1) { const e = (i === 0 ? firstEase : easeInOutSine)((t - t0) / (t1 - t0)); return [lerp(v0, v1, e), lerp(h0, h1, e)] }
  }
  return [1, 1]
}

export const DROP_DURATION = 0.6
/** 먼지를 트는 시점 (첫 착지 / pop 은 커지기가 끝날 때) */
export const DUST_AT = 0.3

export function furnitureDrop(t: number, H = 2.0, S = 0, mode: 'fall' | 'pop' = 'fall') {
  t = Math.min(DROP_DURATION, Math.max(0, t))
  if (mode === 'pop') { const [sv, sh] = keys(POP, t, easeOutCubic); return { y: 0, side: 0, rotDeg: 0, scaleV: sv, scaleH: sh } }
  const u = Math.min(t / 0.30, 1)
  let y = 0
  if (t <= 0.30) y = H * (1 - u * u)                                                         // easeInQuad
  else if (t > 0.40 && t <= 0.52) { const w = (t - 0.40) / 0.12; y = 0.15 * 4 * w * (1 - w) }   // 튕김
  const side = S * (1 - u)
  const rotDeg = t < 0.45 ? 8 * Math.cos(2 * Math.PI * t / 0.30) * (1 - t / 0.45) ** 2 : 0
  let sv: number, sh: number
  if (t <= 0.30) { const base = lerp(0.8, 1.0, easeOutCubic(clamp01(t / 0.20))); const st = 1 + 0.10 * u * u; sv = base * st; sh = base / Math.sqrt(st) }
  else [sv, sh] = keys(SQUASH, t)
  return { y, side, rotDeg, scaleV: sv, scaleH: sh }
}

/** 먼지 투명도 (tt = 먼지 재생 후 경과 초, spec 5번) */
export const dustOpacity = (tt: number) => 1 - easeOutQuad(clamp01((tt - 0.10) / 0.30))
