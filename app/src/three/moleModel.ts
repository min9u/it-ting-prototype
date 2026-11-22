import type * as THREE from 'three'
import moleUrl from '../assets/models/mole_v1_4_draco_webp.glb?url'
import { loadGlb } from './glb'

/*
 * 두더지 glb 하나 (3D 핸드오프 mole_v1_4, 2026-11-22): 땅굴 방 · 탐색 · 온보딩 미리보기 · 채팅방(찻방)이 같이 씀.
 * v1_3 의 25개 동작 + 채팅용 mole_sit_talk = 26개. Draco + WebP (glb.ts 가 해독기를 준비함).
 * 예전 mole.glb(v1_3, 텍스처만 줄인 파일)와 채팅 전용 mole_chat.glb(눈 트랙이 틀려 눈이 안 보였음)는 없앰 → docs/mole-v1-4-2026-11-22.md
 */
/** 반복 동작 (첫 자세 = 마지막 자세인 것). animation_list_v1_4.md "반복 O" */
export const LOOP_CLIPS: ReadonlySet<string> = new Set([
  'mole_idle', 'mole_walk', 'mole_sit_idle', 'mole_sit_idle_chair', 'mole_sit_idle_beanbag', 'mole_butt_wiggle', 'mole_look_around', 'mole_showcase',
])

/**
 * 반복 동작의 이음매 1프레임 멈칫 없애기 (핸드오프 "시작 시간" 주의): v1_3 부터 모든 동작이 0.0417초(1프레임)에서 시작하고 마지막 키가 길이 + 0.0417초에 있음.
 * 첫 키 = 마지막 키인 반복 동작은 한 바퀴 끝에서 한 번, 다음 바퀴 처음 0~0.0417초에서 한 번 같은 자세가 머물러 1프레임(0.0417초) 더 멈춤.
 * 트랙 시간을 첫 키만큼 앞으로 당기고 길이를 다시 재서 정확히 한 바퀴로 만듦. 한 번만 하는 동작은 안 건드림(걸음 맞추기 · 일어나기 같은 단계 시간이 이 시작 시간 기준).
 * 여러 번 불러도 같은 결과 (이미 0초에서 시작하면 아무것도 안 함). 돌려주는 값 = 고친 동작 수
 */
export function trimLoopSeams(clips: THREE.AnimationClip[]): number {
  let n = 0
  for (const c of clips) {
    if (!LOOP_CLIPS.has(c.name)) continue
    let t0 = Infinity
    for (const t of c.tracks) if (t.times.length) t0 = Math.min(t0, t.times[0])
    if (!Number.isFinite(t0) || t0 < 1e-6) continue
    for (const t of c.tracks) for (let i = 0; i < t.times.length; i++) t.times[i] -= t0
    c.resetDuration()
    n++
  }
  return n
}

export const loadMoleGltf = () => loadGlb(moleUrl).then((g) => { trimLoopSeams(g.animations); return g })

/**
 * glb 의 `mole` 노드(씬 맨 위) translation y = +0.03m (v1_3 부터. 채팅용 옛 glb 에는 없었음).
 * 두더지를 감싼 그룹의 위치에 sit point 높이를 "더하는" 쪽은 이만큼 뜨므로 빼 줘야 함 (채팅방 SIT_Y). 시험이 glb 값과 같은지 확인
 */
export const MOLE_NODE_Y = 0.03
