import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { fixChatMoleEyeTracks } from '../three/chatMoleClips'

const v = (name: string) => new THREE.VectorKeyframeTrack(name, [0, 1], [0, 0, 0, 1, 1, 1])
const q = (name: string) => new THREE.QuaternionKeyframeTrack(name, [0, 1], [0, 0, 0, 1, 0, 0, 0, 1])

describe('채팅방 두더지 눈 트랙 보정 (mole_chat.glb)', () => {
  const make = () => [
    new THREE.AnimationClip('mole_sit_idle', 1, [v('upper_body.position'), v('mole_eye_L.position'), q('mole_eye_L.quaternion'), v('mole_eye_L.scale'), v('mole_eye_R.position'), q('mole_eye_R.quaternion'), v('mole_eye_R.scale')]),
    new THREE.AnimationClip('mole_sit_talk', 1, [v('upper_body.position'), v('mole_eye_L.scale'), v('mole_eye_L.position'), v('mole_eye_R.scale')]),
  ]
  it('눈 이동·회전 트랙은 모든 클립에서 빼고, 깜빡임(크기)은 정상 클립에만 남김', () => {
    const clips = make()
    expect(fixChatMoleEyeTracks(clips)).toBe(4 + 3)
    expect(clips[0].tracks.map((t) => t.name)).toEqual(['upper_body.position', 'mole_eye_L.scale', 'mole_eye_R.scale'])
    // mole_sit_talk 은 눈 트랙 전부 (크기가 0 으로 시작)
    expect(clips[1].tracks.map((t) => t.name)).toEqual(['upper_body.position'])
  })
  it('두 번 불러도 같음', () => {
    const clips = make(); fixChatMoleEyeTracks(clips)
    expect(fixChatMoleEyeTracks(clips)).toBe(0)
  })
})
