/**
 * 채팅방 3D 자리 · 카메라 · 앉는 사람 정하기 (design/digul_3d_handoff_chat_v1/docs/THREEJS_chat_room_v3.md 3 · 5번 + 6명 초과 규칙)
 * 순수 계산만 (three.js 없음) → 단위 테스트 가능. 장면은 chatRoomScene.ts
 */
export interface Seat { x: number; z: number; yaw: number; cushion: 'yellow' | 'sky' }
const seat = (x: number, z: number, yaw: number, cushion: Seat['cushion']): Seat => ({ x, z, yaw, cushion })

/** 두더지 발밑 높이 = 방석 위 sit point */
export const SIT_Y = 0.13
/** 방석은 두더지 위치에서 정면으로 0.05m 앞 */
export const CUSHION_AHEAD = 0.05

/** 자리표 (three.js 값). 1번 = "나". 1~3마리 반지름 1.16, 4마리 1.22, 6마리 1.30 */
export const LAYOUTS: Record<1 | 2 | 3 | 4 | 6, Seat[]> = {
  1: [seat(-1.120, -0.300, 0.9937, 'yellow')],
  2: [seat(-1.120, -0.300, 0.9937, 'yellow'), seat(1.120, -0.300, -0.9937, 'sky')],
  3: [seat(-1.120, -0.300, 0.9937, 'yellow'), seat(0, -1.160, 0, 'sky'), seat(1.120, -0.300, -0.9937, 'yellow')],
  4: [seat(-1.201, -0.212, 1.0120, 'yellow'), seat(-0.664, -1.023, 0.5760, 'sky'), seat(0.664, -1.023, -0.5760, 'yellow'), seat(1.201, -0.212, -1.0120, 'sky')],
  6: [
    seat(-1.222, 0.445, 1.3963, 'yellow'), seat(-1.188, -0.529, 0.9970, 'sky'), seat(-0.487, -1.205, 0.3840, 'yellow'),
    seat(0.487, -1.205, -0.3840, 'sky'), seat(1.188, -0.529, -0.9970, 'yellow'), seat(1.222, 0.445, -1.3963, 'sky'),
  ],
}

/** 자리에 앉는 최대 인원 */
export const MAX_SEATED = 6

/** 앉은 인원 → 자리표. 5명은 6자리 배치에서 4번 자리만 비움 (문서 제안: 3번 또는 4번을 뺌) */
export function seatsFor(n: number): Seat[] {
  const c = Math.max(1, Math.min(MAX_SEATED, n))
  if (c === 5) return LAYOUTS[6].filter((_, i) => i !== 3)
  return LAYOUTS[c as 1 | 2 | 3 | 4 | 6]
}

export type PresetName = 'close' | 'medium' | 'wide'
export interface CamPreset { pos: [number, number, number]; target: [number, number, number]; fov: number }
export const CAM_PRESETS: Record<PresetName, CamPreset> = {
  close: { pos: [0, 2.5, 4.4], target: [0, 1.2, -0.1], fov: 62 },
  medium: { pos: [0, 2.7, 4.7], target: [0, 1.3, -0.1], fov: 65 },
  wide: { pos: [0, 2.9, 5.0], target: [0, 1.45, -0.1], fov: 67.38 },
}
export const presetFor = (n: number): PresetName => (n <= 2 ? 'close' : n <= 4 ? 'medium' : 'wide')
/** 인원이 바뀔 때 카메라가 움직이는 시간 (초), easeInOutQuad */
export const CAM_SECONDS = 0.6
export const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
/** 핸드오프 기준 화면 비율 (780×1420). 이보다 좁으면 가로가 모자라 FOV 를 키움 */
export const REF_ASPECT = 780 / 1420
/** 화면 비율에 맞춘 세로 FOV (REF_ASPECT 보다 넓으면 그대로, 좁으면 같은 가로 범위가 보이게 키움) */
export function fovFor(fov: number, aspect: number) {
  if (aspect >= REF_ASPECT) return fov
  const k = Math.tan((fov * Math.PI) / 360) * (REF_ASPECT / aspect)
  return (Math.atan(k) * 360) / Math.PI
}

/** "나" 이름표 · 이름표 기준점: 자리 바닥에서 정면으로 0.3m 앞 */
export const TAG_AHEAD = 0.3
export const tagPoint = (s: Seat) => ({ x: s.x + Math.sin(s.yaw) * TAG_AHEAD, z: s.z + Math.cos(s.yaw) * TAG_AHEAD })
/** 빈자리 표시 (1명일 때만): 2명 배치의 2번 자리, 반지름 0.36, 색 #9A5C40 */
export const EMPTY_MARK = { x: 1.12, y: 0.032, z: -0.30, radius: 0.36, color: '#9A5C40' }

/* ---------- 6명보다 많을 때 ---------- */
/** 한 자리는 최소 이만큼(ms) 유지 */
export const SEAT_MIN_MS = 5000

export interface Roster { ids: string[]; meId: string; spoke: Record<string, number> }

/**
 * 처음 앉는 사람: 6명 이하면 모두 (나 먼저, 나머지는 받은 순서), 더 많으면 "나" + 최근에 말한 5명 (말한 적 없으면 뒤로, 받은 순서)
 */
export function initialSeated({ ids, meId, spoke }: Roster): string[] {
  const me = ids.includes(meId) ? [meId] : []
  const others = ids.filter((id) => id !== meId)
  if (me.length + others.length <= MAX_SEATED) return [...me, ...others]
  const rank = (id: string) => spoke[id] ?? -Infinity
  const top = others.map((id, i) => ({ id, i })).sort((a, b) => rank(b.id) - rank(a.id) || a.i - b.i).slice(0, MAX_SEATED - me.length).map((x) => x.id)
  // 자리 순서는 받은 순서를 따름 (말한 순서로 자리가 뒤섞이지 않게)
  return [...me, ...others.filter((id) => top.includes(id))]
}

/**
 * 자리에 없는 사람이 말했을 때 누가 자리를 내줄지: "나"(1번) 말고, 5초 이상 앉았던 사람 중 가장 오래 말이 없던 사람.
 * 없으면 null (다음 메시지 때 다시)
 */
export function seatToVacate(seated: string[], meId: string, seatedAt: Record<string, number>, spoke: Record<string, number>, now: number): string | null {
  const c = seated.filter((id) => id !== meId && now - (seatedAt[id] ?? 0) >= SEAT_MIN_MS)
  if (!c.length) return null
  return [...c].sort((a, b) => (spoke[a] ?? -Infinity) - (spoke[b] ?? -Infinity))[0]
}

/* ---------- 모션 스케줄 ---------- */
export const DRINK_EVERY = 10
/** 첫 talk 는 4.5초, 이후 drink 시작 후 4~7초 사이 */
export const FIRST_TALK = 4.5
export const talkDelayAfterDrink = (rand: number) => 4 + rand * 3
/** 마리마다 시작 시각을 어긋나게: 첫 drink 10~20초, sit_idle 시작 위상 0~2.5초 */
export const firstDrinkAt = (rand: number) => DRINK_EVERY + rand * DRINK_EVERY
export const idlePhase = (rand: number, idleSeconds = 2.5) => rand * idleSeconds
