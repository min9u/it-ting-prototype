import type * as THREE from 'three'

/**
 * mole_chat.glb 애니메이션의 눈 트랙 고침 (2026-11-22, docs/chat-mole-eyes.md)
 *
 * 증상: 채팅방(찻방) 두더지에 눈이 안 보임. 내 땅굴 두더지(mole.glb)는 보임.
 * 원인: 눈 노드(mole_eye_L/R)는 두 파일에 똑같이 있고 재질(M_mole_eye)도 같은데, mole_chat.glb 의 거의 모든 클립에
 *   눈의 이동·회전 트랙이 구워져 있고 값이 틀림 — 이동 (±0.14, 0.293, **-0.072**)(원래 z 는 +0.2926 이라 머리 안쪽으로 들어감),
 *   회전 (-0.809, ±0.097, ∓0.069, 0.575)(원래는 거의 0). mole_sit_talk 은 눈 크기 트랙이 0 → 0.223 까지 튀고 첫 키가 0 이라 눈이 사라짐.
 *   mole.glb 는 눈 크기(깜빡임)만 있어서 정상.
 * 앱에서 막는 법: 눈의 이동·회전 트랙은 전부 빼고(노드 기본 자세 그대로), 눈 크기 트랙(깜빡임)은 정상 클립만 둠. mole_sit_talk 은 눈 트랙 전부 뺌.
 * 3D 쪽에서 mole_v1_4 로 통일되면(= mole.glb v1_3 에 mole_sit_talk 합침) 이 보정은 필요 없음.
 */
const EYE = /^mole_eye_[LR]\./
const EYE_MOVE = /^mole_eye_[LR]\.(position|quaternion)$/
const BROKEN_SCALE_CLIPS = new Set(['mole_sit_talk'])

/** 클립 배열을 제자리에서 고침 (여러 번 불러도 같음). 뺀 트랙 수를 돌려줌 */
export function fixChatMoleEyeTracks(clips: THREE.AnimationClip[]): number {
  let removed = 0
  for (const c of clips) {
    const bad = BROKEN_SCALE_CLIPS.has(c.name) ? EYE : EYE_MOVE
    const keep = c.tracks.filter((t) => !bad.test(t.name))
    removed += c.tracks.length - keep.length
    c.tracks = keep
  }
  return removed
}
