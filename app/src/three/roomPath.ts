/**
 * 땅굴 방 길 찾기 (2026-11-18, 사용자 요청 "중간에 가구가 있다면 슬쩍 돌아가게")
 *
 * 전에는 누른 곳으로 일직선으로 걷고, 가구 발자리(roomScene 의 feet)에 닿으면 clampRoom 이 밖으로 밀어내기만 해서
 * 가구 가장자리를 따라 미끄러지거나 멈췄음. 이제 걷기 시작할 때 길을 한 번 정함:
 *
 * - 장애물 = 가구 발자리 사각형(두더지 반지름만큼 이미 넓힌 것, 축 정렬) + 집주인 두더지 자리
 * - 곧장 갈 수 있으면 그대로 (예전과 같음)
 * - 막혀 있으면 사각형 모서리에서 조금 바깥(CORNER)에 점을 찍고, 서로 보이는 점끼리 이은 그래프에서 가장 짧은 길(A*)
 *   방은 둥근 볼록 모양이라 방 안의 두 점을 잇는 선은 늘 방 안 → 방 밖 모서리 점만 뺌
 * - 걷는 동안(moleActor walkStep)은 다음 점이 바로 보이면 앞당겨 넘어가서 모서리를 살짝 둥글게 돎
 *
 * three 없이 순수 함수 (시험: src/tests/room-path.test.ts)
 */

export interface Rect { x0: number; x1: number; z0: number; z1: number }
export interface Pt { x: number; z: number }

/** 모서리 점을 사각형 밖으로 띄우는 거리 (m). 너무 작으면 모서리를 스치며 미끄러지고, 크면 크게 돌아감 */
export const CORNER = .12
/** 경계 위에 있는 점(clampRoom 이 변으로 밀어낸 점)은 막힌 것으로 안 봄 */
const EDGE = 1e-3

const inside = (p: Pt, r: Rect, e = EDGE) => p.x > r.x0 + e && p.x < r.x1 - e && p.z > r.z0 + e && p.z < r.z1 - e

/** 선분 a→b 가 사각형 안쪽(경계에서 EDGE 만큼 줄인 것)을 지나는지 (Liang–Barsky) */
function crosses(a: Pt, b: Pt, r: Rect): boolean {
  const x0 = r.x0 + EDGE, x1 = r.x1 - EDGE, z0 = r.z0 + EDGE, z1 = r.z1 - EDGE
  if (x0 >= x1 || z0 >= z1) return false
  const dx = b.x - a.x, dz = b.z - a.z
  const p = [-dx, dx, -dz, dz], q = [a.x - x0, x1 - a.x, a.z - z0, z1 - a.z]
  let t0 = 0, t1 = 1
  for (let i = 0; i < 4; i++) {
    if (Math.abs(p[i]) < 1e-12) { if (q[i] < 0) return false; continue }
    const t = q[i] / p[i]
    if (p[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t } else { if (t < t0) return false; if (t < t1) t1 = t }
  }
  return t1 > t0
}

/**
 * a 에서 b 로 곧장 갈 수 있는지. a 나 b 가 이미 들어가 있는 사각형은 무시 (그 안에서 빠져나오는 길은 막지 않음:
 * 일어난 자리가 방석 발자리 안이거나, 겹친 발자리 때문에 clampRoom 이 다 못 밀어낸 경우)
 */
export function clearPath(a: Pt, b: Pt, rects: readonly Rect[]): boolean {
  for (const r of rects) {
    if (inside(a, r) || inside(b, r)) continue
    if (crosses(a, b, r)) return false
  }
  return true
}

/**
 * start → goal 길 (start 는 빼고 goal 까지의 점들). 곧장 갈 수 있으면 [goal], 길이 없으면 null (부르는 쪽이 예전처럼 곧장 감)
 * @param roomR 두더지 중심이 갈 수 있는 방 반지름 (clampRoom 과 같은 값)
 */
export function planPath(start: Pt, goal: Pt, rects: readonly Rect[], roomR: number): Pt[] | null {
  if (clearPath(start, goal, rects)) return [{ x: goal.x, z: goal.z }]
  // 점: 0 = start, 1 = goal, 나머지 = 모서리
  const nodes: Pt[] = [{ x: start.x, z: start.z }, { x: goal.x, z: goal.z }]
  const lim = roomR - .02
  for (const r of rects) {
    for (const c of [{ x: r.x0 - CORNER, z: r.z0 - CORNER }, { x: r.x1 + CORNER, z: r.z0 - CORNER }, { x: r.x0 - CORNER, z: r.z1 + CORNER }, { x: r.x1 + CORNER, z: r.z1 + CORNER }]) {
      if (Math.hypot(c.x, c.z) > lim) continue
      if (rects.some((o) => inside(c, o, 0))) continue
      nodes.push(c)
    }
  }
  // A*: 이웃(보이는 점)은 꺼낼 때만 검사 (점 100개 안팎, 클릭 한 번에 한 번)
  const n = nodes.length
  const g = new Array<number>(n).fill(Infinity), prev = new Array<number>(n).fill(-1), done = new Array<boolean>(n).fill(false)
  const h = (i: number) => Math.hypot(nodes[i].x - goal.x, nodes[i].z - goal.z)
  g[0] = 0
  for (;;) {
    let u = -1, best = Infinity
    for (let i = 0; i < n; i++) if (!done[i] && g[i] + h(i) < best) { best = g[i] + h(i); u = i }
    if (u < 0) return null
    if (u === 1) break
    done[u] = true
    for (let v = 1; v < n; v++) {
      if (done[v] || v === u) continue
      const d = g[u] + Math.hypot(nodes[u].x - nodes[v].x, nodes[u].z - nodes[v].z)
      if (d >= g[v]) continue
      if (!clearPath(nodes[u], nodes[v], rects)) continue
      g[v] = d; prev[v] = u
    }
  }
  const out: Pt[] = []
  for (let i = 1; i > 0; i = prev[i]) out.unshift(nodes[i])
  return out
}
