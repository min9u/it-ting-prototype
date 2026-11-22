/**
 * 접촉 그림자 판(shadow_*) 위치 바로잡기.
 * 디자이너 room_base_v3_1 의 shadow_cabinet_low · shadow_floor_lamp · shadow_floor_plant_big 은 shadow_round_table 과 같은 판 메시
 * (가운데가 (-0.72, -1.18)에 치우쳐 있음)를 쓰는데, 원탁·방석 판은 node translation 으로 그 치우침을 되돌려 놓고 이 셋은 translation 이 0 이라
 * 수납장·스탠드·큰 화분의 그림자가 가구에서 1.2m 안팎 떨어진 방 바깥(왼쪽 아래)에 검은 타원으로 떠 있었음 (2026-11-22, 관심사 10개 내 땅굴에서 발견).
 * → 판 가운데(= 노드 위치 + 크기 배율 × 메시 가운데)가 부모(가구) 원점에서 THRESHOLD 보다 멀면 가구 아래로 옮김.
 * 원탁·방석·가구 glb 의 판은 처음부터 가구 아래라 안 움직임.
 */
import type * as THREE from 'three'

export const SHADOW_OFFSET_MAX = 0.3

/** 판의 메시 가운데(x,z) · 노드 배율 · 노드 위치(x,z) → 가구 원점 기준 판 가운데 어긋남 */
export function shadowOffset(center: { x: number; z: number }, scale: { x: number; z: number }, pos: { x: number; z: number }) {
  return { x: pos.x + scale.x * center.x, z: pos.z + scale.z * center.z }
}

/** 새 노드 위치 (어긋나지 않았으면 그대로) */
export function shadowFixedPos(center: { x: number; z: number }, scale: { x: number; z: number }, pos: { x: number; z: number }) {
  const o = shadowOffset(center, scale, pos)
  if (Math.hypot(o.x, o.z) <= SHADOW_OFFSET_MAX) return { x: pos.x, z: pos.z }
  return { x: pos.x - o.x, z: pos.z - o.z }
}

/** 접촉 그림자 판(shadow_*): 깊이를 안 써서 위에 놓인 것을 가리지 않게 먼저 그리고, 가구에서 떨어진 판은 가구 아래로 옮김 (땅굴 방 · 채팅방 공용) */
export function markShadows(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.isMesh && /^shadow_/.test(m.name)) {
      (m.material as THREE.Material).depthWrite = false; m.renderOrder = 1
      m.geometry.computeBoundingBox()
      const b = m.geometry.boundingBox!
      const np = shadowFixedPos({ x: (b.min.x + b.max.x) / 2, z: (b.min.z + b.max.z) / 2 }, m.scale, m.position)
      m.position.x = np.x; m.position.z = np.z
    }
  })
}
