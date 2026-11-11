import * as THREE from 'three'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js'
import accUrl from '../assets/models/accessories.glb?url'
import { loadGlb } from './glb'
import { handVisible, itemOf } from '../data/moleItems'

/*
 * 두더지 액세서리 입히기 (design/digul_3d_handoff_v1_1 accessories_v1.glb, 규칙 v2 accessories.md)
 * - 액세서리 노드는 원점이 소켓 위치에 맞춰져 있어서 소켓(socket_head·face·neck·hand_R)의 자식으로 그대로 붙임
 * - 등 리본은 뼈가 있어서 SkeletonUtils.clone + ribbon_back_sway 반복 (서 있을 때 약하게)
 * - 풍선 3종은 매 프레임 위로 세움 (5번)
 * - 손 소품은 동작에 따라 숨김 (2-2번, data/moleItems handVisible)
 */
export const loadAccessories = () => loadGlb(accUrl)

const BALLOONS = new Set(['prop_balloon', 'prop_balloon_star', 'prop_balloon_heart'])
const SOCKET: Record<string, string> = { 머리: 'socket_head', 얼굴: 'socket_face', 목: 'socket_neck', 손: 'socket_hand_R' }

export interface MoleDress {
  setWorn(ids: string[]): void
  /** mixer.update 다음에 부름. clip = 지금 두더지가 하는 동작 이름 (손 소품 숨김용), moving = 걷는 중 (리본 흔들림 세기) */
  update(dt: number, clip: string, moving?: boolean): void
  dispose(): void
}

export function createMoleDress(model: THREE.Object3D, acc: GLTF): MoleDress {
  let worn: string[] = []
  const on = new Map<string, THREE.Object3D>()
  let ribbonMixer: THREE.AnimationMixer | null = null
  let ribbonAction: THREE.AnimationAction | null = null
  const root = model.getObjectByName('root') ?? model
  const qRoot = new THREE.Quaternion(), qSock = new THREE.Quaternion()

  function take(id: string) {
    const src = acc.scene.getObjectByName(id)
    if (!src) return null
    const o = id === 'ribbon_back' ? cloneSkinned(src) : src.clone()
    o.traverse((m) => {
      const mesh = m as THREE.Mesh
      if (mesh.isMesh) { mesh.castShadow = true; mesh.frustumCulled = false }
    })
    return o
  }

  function setWorn(ids: string[]) {
    worn = ids.filter((id) => itemOf(id))
    for (const [id, o] of on) if (!worn.includes(id)) {
      o.removeFromParent(); on.delete(id)
      if (id === 'ribbon_back') { ribbonMixer?.stopAllAction(); ribbonMixer = null; ribbonAction = null }
    }
    for (const id of worn) {
      if (on.has(id)) continue
      const item = itemOf(id)!
      const sock = model.getObjectByName(SOCKET[item.part])
      const o = take(id)
      if (!sock || !o) continue
      sock.add(o); on.set(id, o)
      if (id === 'ribbon_back') {
        const clip = THREE.AnimationClip.findByName(acc.animations, 'ribbon_back_sway')
        if (clip) { ribbonMixer = new THREE.AnimationMixer(o); ribbonAction = ribbonMixer.clipAction(clip); ribbonAction.play() }
      }
    }
  }

  function update(dt: number, clip: string, moving = false) {
    if (ribbonMixer && ribbonAction) {
      ribbonAction.timeScale = moving ? 1.2 : .6
      ribbonAction.setEffectiveWeight(moving ? 1 : .5)
      ribbonMixer.update(dt)
    }
    for (const [id, o] of on) {
      const item = itemOf(id)
      if (item?.part === '손') o.visible = handVisible(clip, worn)
      if (BALLOONS.has(id) && o.parent) {
        model.updateWorldMatrix(true, true)
        root.getWorldQuaternion(qRoot)
        o.parent.getWorldQuaternion(qSock)
        o.quaternion.copy(qSock.invert().multiply(qRoot))
      }
    }
  }

  return {
    setWorn, update,
    dispose() { ribbonMixer?.stopAllAction(); for (const o of on.values()) o.removeFromParent(); on.clear() },
  }
}
