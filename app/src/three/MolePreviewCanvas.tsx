import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js'
import { createRenderer, destroyRenderer, disposeObject, startLoop } from './engine'
import { loadMoleGltf } from './moleActor'
import { createMoleDress, loadAccessories, type MoleDress } from './moleDress'
import { blobShadow } from './roomLook'

/*
 * 온보딩 1 "두더지 꾸미기" 3D 미리 보기 (accessories.md 7번)
 * - mole_showcase(3초) 반복 + 받침을 초당 60° 회전 (한 바퀴 6초)
 * - 조명은 땅굴 방과 같은 값 (room_spec.md 3번)
 */
interface Handle { setWorn(ids: string[]): void; setSpin(on: boolean): void; dispose(): void }

function mountPreview(el: HTMLElement, o: { worn: string[]; spin: boolean; onReady(): void }): Handle {
  const renderer = createRenderer(el, { alpha: true, exposure: 1, shadowType: THREE.PCFSoftShadowMap })
  renderer.toneMapping = THREE.AgXToneMapping
  renderer.shadowMap.enabled = false
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 50)
  camera.position.set(0, 0.95, 3.3)
  camera.lookAt(0, 0.5, 0)
  scene.add(new THREE.AmbientLight(0xF0B47A, 0.785))
  const key = new THREE.PointLight(0xFFDDB3, 48.4, 0, 2); key.position.set(0.4, 2.436, 1.2); scene.add(key)
  const fill = new THREE.DirectionalLight(0xFFE7CB, 1.8); fill.position.set(0, 2.86, 4.55); scene.add(fill)

  const stand = new THREE.Group(); scene.add(stand)
  stand.add(blobShadow(0.95))
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  let spin = o.spin, worn = o.worn, dead = false
  let mixer: THREE.AnimationMixer | null = null, dress: MoleDress | null = null, model: THREE.Object3D | null = null

  Promise.all([loadMoleGltf(), loadAccessories()]).then(([g, acc]) => {
    if (dead) return
    model = cloneSkinned(g.scene)
    model.traverse((m) => { if ((m as THREE.Mesh).isMesh) (m as THREE.Mesh).frustumCulled = false })
    stand.add(model)
    mixer = new THREE.AnimationMixer(model)
    const clip = THREE.AnimationClip.findByName(g.animations, reduce ? 'mole_idle' : 'mole_showcase')
    if (clip) mixer.clipAction(clip).play()
    dress = createMoleDress(model, acc)
    dress.setWorn(worn)
    mixer.update(0); dress.update(0, 'mole_showcase')
    loop.redraw()
    o.onReady()
  }).catch((e) => console.warn('[3D] 미리 보기 두더지를 못 불러왔어요', e))

  stand.rotation.y = -0.5
  const loop = startLoop(el, {
    resize(w, h) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix() },
    frame(dt) {
      if (spin && !reduce) stand.rotation.y += THREE.MathUtils.degToRad(60) * dt
      mixer?.update(dt)
      dress?.update(dt, 'mole_showcase')
      renderer.render(scene, camera)
    },
  })
  return {
    setWorn(ids) { worn = ids; dress?.setWorn(ids); dress?.update(0, 'mole_showcase'); loop.redraw() },
    setSpin(on) { spin = on },
    dispose() {
      dead = true; loop.stop(); dress?.dispose(); mixer?.stopAllAction()
      disposeObject(scene); destroyRenderer(renderer)
    },
  }
}

export default function MolePreviewCanvas({ worn, spin, label, className, onReady }: { worn: string[]; spin: boolean; label?: string; className?: string; onReady?: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const h = useRef<Handle | null>(null)
  const latest = useRef({ worn, spin, onReady })
  latest.current = { worn, spin, onReady }
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let handle: Handle
    try {
      handle = mountPreview(el, { worn: latest.current.worn, spin: latest.current.spin, onReady: () => latest.current.onReady?.() })
    } catch (err) {
      console.warn('[3D] 미리 보기를 만들지 못했어요', err) // WebGL 없음 → 2D 그대로
      return
    }
    h.current = handle
    return () => { handle.dispose(); h.current = null }
  }, [])
  useEffect(() => { h.current?.setWorn(worn) }, [worn])
  useEffect(() => { h.current?.setSpin(spin) }, [spin])
  return <div ref={ref} className={className} role="img" aria-label={label ?? '두더지 미리 보기'} />
}
