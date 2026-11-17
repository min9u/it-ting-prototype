import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { createRenderer, destroyRenderer, quality, startLoop, testParam } from './engine'
import { createMoleActor, loadMoleGltf, type MoleActor } from './moleActor'
import { loadAccessories } from './moleDress'
import { warmScene } from './warm'

/*
 * 채팅 찻방의 3D 두더지 (Figma 02 F6 "찻방"). 방 그림은 2D(TeaRoom.tsx)이고, 그 위에 투명 캔버스로 두더지만 그림.
 * - 직교 카메라를 캔버스 픽셀 단위로 맞춰서, 자리(seat)의 x·y 비율이 HTML 이름표와 정확히 같은 곳에 옴
 * - 두더지마다 각자 꾸민 액세서리. 가만히 숨쉬다 가끔 두리번, 메시지를 보내면 그 두더지가 손 인사(greet)
 * - 저사양이면 engine 품질대로 (해상도 낮춤 · 쉬면 그리기 멈춤)
 * - 저사양에서 숨쉬기·두리번만 할 때는 낮은 fps (docs/rendering-experiments-2.md: 모임 5마리는 서로 번갈아 두리번해서
 *   쉬지 못하고 계속 그림 → CPU 4코어 넘게 씀). 인사(메시지 보냄)할 때는 제한 없이. 시험용 ?teafps=0 으로 끔
 */
export interface TeaSeat {
  id: string
  worn: string[]
  /** 발 위치 (찻방 상자 기준 0–1) */
  x: number
  y: number
  /** 두더지 키 = 상자 높이 × h */
  h: number
  /** 바라보는 방향 (0 = 정면, + = 오른쪽으로 돎) */
  yaw: number
  /** 뒤쪽 자리일수록 작게 (앞에 그려지는 순서용) */
  depth: number
}

interface Handle { greet(id: string): void; dispose(): void }

const TILT = 0.2 // 살짝 위에서 내려다보는 느낌

function mountTea(el: HTMLElement, seats: TeaSeat[], onReady: () => void): Handle {
  const q = quality()
  const renderer = createRenderer(el, { alpha: true, exposure: 1, shadowType: THREE.PCFSoftShadowMap, quality: q })
  renderer.toneMapping = THREE.AgXToneMapping
  renderer.shadowMap.enabled = false
  const scene = new THREE.Scene()
  const camera = new THREE.OrthographicCamera(0, 1, 1, 0, -4000, 4000)
  camera.position.z = 1000
  scene.add(new THREE.AmbientLight(0xF0B47A, 1.1))
  scene.add(new THREE.HemisphereLight(0xFFF2DE, 0xC99A6E, 1.2))
  const key = new THREE.DirectionalLight(0xFFDDB3, 2.4); key.position.set(-0.4, 1, 1.2); scene.add(key)

  let W = 1, H = 1, dead = false
  // 기기 단계 strong 15fps, weak 10fps (engine.ts idleFps, docs/rendering-experiments-3.md)
  const teaFps = q.level === 'low' ? +(testParam('teafps') ?? String(q.idleFps)) : 0
  let livelyUntil = 0 // 인사 동작이 끝날 때까지는 fps 제한 없음
  const actors = new Map<string, { actor: MoleActor; group: THREE.Group; seat: TeaSeat }>()
  const place = () => {
    actors.forEach(({ group, seat }) => {
      group.position.set(seat.x * W, (1 - seat.y) * H, -seat.depth * 400)
      group.scale.setScalar((seat.h * H) / 0.985) // 두더지 키 0.985m
    })
  }

  Promise.all([loadMoleGltf(), loadAccessories().catch(() => undefined)]).then(async ([g, acc]) => {
    if (dead) return
    for (const seat of seats) {
      const actor = createMoleActor(g, { scale: 1, start: new THREE.Vector3(), yaw: seat.yaw, drop: false, lookEvery: [5, 12], acc, worn: seat.worn, simple: q.level === 'low' && !!q.lab?.F })
      const group = new THREE.Group()
      group.rotation.x = TILT
      group.add(actor.object)
      scene.add(group)
      actors.set(seat.id, { actor, group, seat })
    }
    place()
    // 예열 (warm.ts, 3차): 두더지 셰이더·텍스처·첫 그리기를 나눠서 → 첫 프레임 멈춤(0.2초 남짓)을 짧은 작업 여럿으로. 그동안 두더지는 숨김
    if (testParam('compile') !== '0') {
      const groups = [...actors.values()].map((a) => a.group)
      groups.forEach((gr) => { gr.visible = false })
      await warmScene(renderer, scene, camera, { roots: groups, dead: () => dead })
      if (dead) return
      groups.forEach((gr) => { gr.visible = true })
    }
    loop.ready()
    onReady()
  }).catch((e) => console.warn('[3D] 찻방 두더지를 못 불러왔어요', e))

  const loop = startLoop(el, {
    resize(w, h) {
      W = w; H = h
      renderer.setSize(w, h, false)
      camera.left = 0; camera.right = w; camera.top = h; camera.bottom = 0
      camera.updateProjectionMatrix()
      place()
    },
    frame(dt) {
      actors.forEach(({ actor }) => actor.update(dt))
      renderer.render(scene, camera)
    },
    busy: () => [...actors.values()].some(({ actor }) => !actor.isResting()),
    maxFps: () => (teaFps && performance.now() > livelyUntil && ![...actors.values()].some(({ actor }) => actor.isGreeting()) ? teaFps : 0),
    downgrade(nq) { renderer.setPixelRatio(nq.pixelRatio) },
  }, q)

  return {
    greet(id) { const a = actors.get(id); if (a) { a.actor.greet(0); livelyUntil = performance.now() + 600; loop.wake() } },
    dispose() {
      dead = true
      loop.stop()
      actors.forEach(({ actor }) => actor.dispose())
      // 두더지 지오메트리·재질은 glb 캐시라 남김
      destroyRenderer(renderer)
    },
  }
}

/** seats 가 바뀌면(다른 대화방) 새로 만듦. greet = {id, n}: n 이 바뀔 때마다 그 두더지가 인사 */
export default function TeaRoomCanvas({ seats, greet, className, onReady }: { seats: TeaSeat[]; greet?: { id: string; n: number }; className?: string; onReady?: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const h = useRef<Handle | null>(null)
  const key = seats.map((s) => `${s.id}:${s.worn.join('+')}`).join('|')
  const latest = useRef({ seats, onReady })
  latest.current = { seats, onReady }
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let handle: Handle
    try { handle = mountTea(el, latest.current.seats, () => latest.current.onReady?.()) } catch (err) {
      console.warn('[3D] 찻방을 만들지 못했어요', err) // WebGL 없음 → 2D 두더지 그림 그대로
      return
    }
    h.current = handle
    return () => { handle.dispose(); h.current = null }
  }, [key])
  useEffect(() => { if (greet && greet.n > 0) h.current?.greet(greet.id) }, [greet?.id, greet?.n]) // eslint-disable-line react-hooks/exhaustive-deps
  return <div ref={ref} className={className} aria-hidden />
}
