import * as THREE from 'three'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js'
import { createMoleDress } from './moleDress'

/*
 * E 2D 두더지 (저사양 실험실 시험판, docs/gpu-lowspec-ideas.md).
 * 처음 한 번 3D 두더지를 방향 4개 × (쉬기 4장 + 걷기 6장) 그림으로 찍어 아틀라스(2D 캔버스)에 모아 둔다.
 * 그 뒤 탐색하기는 3D를 매 프레임 그리지 않고 이 그림을 2D 캔버스에 붙이기만 함.
 *
 * 투명 배경: 렌더러가 alpha 없이 만들어져 있어서, 검은 바탕·흰 바탕에 두 번 그려 차이로 알파를 구함 (difference matting).
 * 화면 버퍼에 그리므로 톤매핑·색공간이 실제 장면과 같다. 찍은 뒤 화면은 다시 그려야 함 (호출하는 쪽에서 전체 다시 그리기)
 */
export const SPRITE_DIRS = 4 // 0 앞(카메라 쪽) 1 오른쪽 2 뒤 3 왼쪽
export const IDLE_FRAMES = 4, WALK_FRAMES = 6
const COLS = IDLE_FRAMES + WALK_FRAMES

export interface MoleSprites {
  atlas: HTMLCanvasElement
  /** 한 칸 크기 (px) */
  S: number
  /** 칸 안에서 발이 놓이는 y (0 위 ~ 1 아래) 와 두더지 키가 칸 높이에서 차지하는 비율 */
  footY: number
  heightFrac: number
  /** 칸 위치 */
  cell(dir: number, walk: boolean, i: number): { sx: number; sy: number }
}

export async function bakeMoleSprites(renderer: THREE.WebGLRenderer, gltf: GLTF, o: {
  acc?: GLTF; worn?: string[]; environment: THREE.Texture | null; envIntensity: number
  sun: THREE.DirectionalLight; pitchDeg: number; size?: number
}): Promise<MoleSprites> {
  const buf = renderer.getDrawingBufferSize(new THREE.Vector2())
  const S = Math.max(64, Math.min(o.size ?? 224, Math.floor(Math.min(buf.x, buf.y))))
  const pr = renderer.getPixelRatio()

  const scene = new THREE.Scene()
  scene.environment = o.environment
  scene.environmentIntensity = o.envIntensity
  const sun = o.sun.clone(); sun.castShadow = false
  const sunTarget = new THREE.Object3D(); sunTarget.position.copy(o.sun.target.position).sub(o.sun.position).add(sun.position)
  sun.target = sunTarget
  scene.add(sun, sunTarget)

  const model = cloneSkinned(gltf.scene)
  model.traverse((c) => { const m = c as THREE.Mesh; if (m.isMesh) m.frustumCulled = false })
  const dress = o.acc ? createMoleDress(model, o.acc) : null
  dress?.setWorn(o.worn ?? [])
  scene.add(model)
  const mixer = new THREE.AnimationMixer(model)
  const clip = (n: string) => THREE.AnimationClip.findByName(gltf.animations, n)

  // 두더지 크기 (쉬는 자세 기준) → 카메라 거리. 걷기·모자 여유로 키의 1.35배를 칸 높이로
  mixer.clipAction(clip('mole_idle')).play(); mixer.update(0); dress?.update(0, 'mole_idle')
  const box = new THREE.Box3().setFromObject(model)
  const h = box.max.y - box.min.y
  const span = h * 1.35, fov = 30
  const cam = new THREE.PerspectiveCamera(fov, 1, .01, 100)
  const dist = span / 2 / Math.tan(THREE.MathUtils.degToRad(fov / 2))
  const pitch = THREE.MathUtils.degToRad(o.pitchDeg)
  const center = new THREE.Vector3(0, box.min.y + span / 2 - h * .12, 0)
  cam.position.set(0, center.y + Math.sin(pitch) * dist, Math.cos(pitch) * dist)
  cam.lookAt(center); cam.updateMatrixWorld()
  const project = (y: number) => 1 - (new THREE.Vector3(0, y, 0).project(cam).y + 1) / 2
  const footY = project(box.min.y), headY = project(box.max.y)

  const atlas = document.createElement('canvas')
  atlas.width = S * COLS; atlas.height = S * SPRITE_DIRS
  const ctx = atlas.getContext('2d')!
  const gl = renderer.getContext()
  const black = new Uint8Array(S * S * 4), white = new Uint8Array(S * S * 4)
  const img = ctx.createImageData(S, S)

  const prev = { autoClear: renderer.autoClear, color: renderer.getClearColor(new THREE.Color()), alpha: renderer.getClearAlpha() }
  const vp = renderer.getViewport(new THREE.Vector4()), sc = renderer.getScissor(new THREE.Vector4()), scOn = renderer.getScissorTest()
  const shoot = () => {
    renderer.setViewport(0, 0, S / pr, S / pr); renderer.setScissor(0, 0, S / pr, S / pr); renderer.setScissorTest(true)
    renderer.autoClear = true
    renderer.setClearColor(0x000000, 1); renderer.render(scene, cam); gl.readPixels(0, 0, S, S, gl.RGBA, gl.UNSIGNED_BYTE, black)
    renderer.setClearColor(0xffffff, 1); renderer.render(scene, cam); gl.readPixels(0, 0, S, S, gl.RGBA, gl.UNSIGNED_BYTE, white)
    const d = img.data
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const i = ((S - 1 - y) * S + x) * 4, j = (y * S + x) * 4 // readPixels 는 아래부터
        const a = 1 - ((white[i] - black[i]) + (white[i + 1] - black[i + 1]) + (white[i + 2] - black[i + 2])) / (3 * 255)
        d[j + 3] = Math.round(Math.max(0, Math.min(1, a)) * 255)
        const k = a > .004 ? 1 / a : 0
        d[j] = Math.min(255, black[i] * k); d[j + 1] = Math.min(255, black[i + 1] * k); d[j + 2] = Math.min(255, black[i + 2] * k)
      }
    }
  }
  const restore = () => {
    renderer.setViewport(vp); renderer.setScissor(sc); renderer.setScissorTest(scOn)
    renderer.autoClear = prev.autoClear; renderer.setClearColor(prev.color, prev.alpha)
  }

  const yaws = [0, Math.PI / 2, Math.PI, -Math.PI / 2]
  const kinds: [string, number][] = [['mole_idle', IDLE_FRAMES], ['mole_walk', WALK_FRAMES]]
  let n = 0
  for (let dir = 0; dir < SPRITE_DIRS; dir++) {
    model.rotation.y = yaws[dir]
    let col = 0
    for (const [name, count] of kinds) {
      const c = clip(name)
      mixer.stopAllAction()
      const a = mixer.clipAction(c); a.reset().play()
      for (let f = 0; f < count; f++) {
        a.time = (f / count) * c.duration
        mixer.update(0)
        dress?.update(0, name, name === 'mole_walk')
        model.updateMatrixWorld(true)
        shoot()
        ctx.putImageData(img, col * S, dir * S)
        col++
        // 긴 작업을 쪼갬: 몇 장마다 한 프레임 쉼
        if (++n % 6 === 0) { restore(); await new Promise((r) => requestAnimationFrame(() => r(null))) }
      }
    }
  }
  restore()
  dress?.dispose(); mixer.stopAllAction(); mixer.uncacheRoot(model)

  return {
    atlas, S, footY, heightFrac: footY - headY,
    cell: (dir, walk, i) => ({ sx: ((walk ? IDLE_FRAMES : 0) + i) * S, sy: dir * S }),
  }
}
