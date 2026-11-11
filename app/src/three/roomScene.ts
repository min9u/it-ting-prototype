import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import shellUrl from '../assets/models/room_shell.glb?url'
import baseUrl from '../assets/models/room_base.glb?url'
import decoUrl from '../assets/models/room_deco.glb?url'
import holeUrl from '../assets/models/room_ceiling_hole.glb?url'
import catalog from '../data/furnitureCatalog.json'
import { loadGlb } from './glb'
import { bindMoleKeys } from './mole'
import { createMoleActor, loadMoleGltf, REACTIONS, type FurnitureData, type MoleActor, type Seat } from './moleActor'
import { loadAccessories } from './moleDress'
import { blobShadow } from './roomLook'
import { approach, createRenderer, destroyRenderer, frameCamera, startLoop, type SceneHandle } from './engine'

/*
 * 땅굴 방 장면 — 3D 핸드오프 v2 (design/digul_3d_handoff_v2, docs/room_spec.md)
 * - 껍데기·소품: 조명을 구운 텍스처(emissive)라 실시간 조명을 받지 않음. 가구(base)·두더지만 실시간 조명
 * - 가구는 docs/furniture_catalog.json (app/src/data/furnitureCatalog.json) 을 읽어 처리. glb 가 null 인 가구(관심사 31개)는 건너뜀
 * - 좌표: 1 unit = 1m, 방 중심 바닥 = 원점, 방 지름 6.5m, 돔은 뒤쪽 절반만
 * - 들어올 때: 천장 구멍 열림(0.417초) → 두더지 떨어짐 → 1.5초에 구멍 닫힘 (HANDOFF_v2 2번)
 * - 구도: 스펙 카메라(위치 (0,1.56,6.37), target (0,2.04,0), 세로 FOV 48.5° @4:3)를 4:3 "가상 화면"에 그리고,
 *   가상 화면 높이 = 장면 높이의 114.5%, 위로 5.4% 올림, 가로 가운데 = focusX (Figma 내 땅굴 화면과 돔 크기·위치를 맞춤)
 */

export interface RoomSceneOptions {
  ownerId?: string
  interests?: string[]
  focusX?: number
  /** 남의 땅굴이면 집주인 닉네임. 집주인 두더지가 방에 서 있음 */
  hostName?: string
  hostWorn?: string[]
  /** 내 두더지 액세서리 */
  worn?: string[]
}

interface CatalogItem {
  id: string; name_ko: string; category: 'base' | 'deco' | 'interest'; interest: string | null
  glb: string | null; node: string; size_m: { w: number; d: number; h: number }; sit_point: string | null
}
const CATALOG = catalog as CatalogItem[]
/** 가구별 동작 (카탈로그에 없는 정보). 원탁엔 찻주전자·컵이 있어서 커피 */
const ACTS: Record<string, FurnitureData['act']> = { round_table: 'drink' }

const ROOM_R = 3.25            // 방 반지름
const FLOOR_Y = .03            // 러그 위 (두더지 기본 자리)
const MOLE_R = .36             // 두더지 몸 반지름 (폭 약 0.8m)
const HOLE_OPEN = .417, HOLE_CLOSE = 1.5

export function mountRoomScene(container: HTMLElement, opts: RoomSceneOptions = {}): SceneHandle {
  const renderer = createRenderer(container, { alpha: true, exposure: 1, shadowType: THREE.PCFSoftShadowMap })
  renderer.toneMapping = THREE.AgXToneMapping   // Blender 기본(AgX)과 맞춤
  renderer.shadowMap.enabled = false             // 바닥·벽은 그림자가 구워져 있음. 두더지는 발밑 그림자 판
  const scene = new THREE.Scene()
  // 배경은 투명 (페이지 흙색이 보임. 스펙 배경 0x805B38 대신 Figma 화면색을 따름)

  const camera = new THREE.PerspectiveCamera(48.5, 4 / 3, 0.1, 100)
  camera.position.set(0, 1.56, 6.37)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.target.set(0, 2.04, 0)
  controls.minDistance = 3.2; controls.maxDistance = 6.37
  controls.minAzimuthAngle = THREE.MathUtils.degToRad(-15); controls.maxAzimuthAngle = THREE.MathUtils.degToRad(15)
  controls.minPolarAngle = THREE.MathUtils.degToRad(75); controls.maxPolarAngle = THREE.MathUtils.degToRad(94.3)
  controls.enablePan = false
  controls.enableDamping = true; controls.dampingFactor = .12
  controls.rotateSpeed = .5; controls.zoomSpeed = .6
  controls.update()

  // 조명 (room_spec 3번. glTF 와트 변환 ×683 쓰지 않음)
  scene.add(new THREE.AmbientLight(0xF0B47A, 0.785))
  const bulb = new THREE.PointLight(0xFFDDB3, 48.4, 0, 2); bulb.position.set(0, 2.436, -0.455); scene.add(bulb)
  const fill = new THREE.DirectionalLight(0xFFE7CB, 1.8); fill.position.set(0, 2.86, 4.55); fill.target.position.set(0, 1, 0); scene.add(fill, fill.target)

  const furniture = new THREE.Group(); furniture.name = 'furniture'; scene.add(furniture)
  /** 두더지가 못 들어가는 가구 바닥 영역 (월드 xz 사각형, 두더지 반지름만큼 넓힘) */
  const feet: { x0: number; x1: number; z0: number; z1: number }[] = []

  const clampRoom = (p: THREE.Vector3) => {
    const fr = ROOM_R - .5, d = Math.hypot(p.x, p.z)
    if (d > fr) { p.x *= fr / d; p.z *= fr / d }
    for (let k = 0; k < 2; k++) for (const f of feet) {
      if (p.x <= f.x0 || p.x >= f.x1 || p.z <= f.z0 || p.z >= f.z1) continue
      // 가장 가까운 변으로 밀어냄
      const out = [p.x - f.x0, f.x1 - p.x, p.z - f.z0, f.z1 - p.z], m = Math.min(...out), i = out.indexOf(m)
      if (i === 0) p.x = f.x0; else if (i === 1) p.x = f.x1; else if (i === 2) p.z = f.z0; else p.z = f.z1
    }
    if (host) {
      const h = host.object.position, dx = p.x - h.x, dz = p.z - h.z, dd = Math.hypot(dx, dz), need = MOLE_R * 2.1
      if (dd < need) { p.x = h.x + dx / (dd || 1) * need; p.z = h.z + dz / (dd || 1) * need }
    }
    return p
  }

  let host: MoleActor | null = null
  let mole: MoleActor | null = null
  let disposed = false
  let worn = opts.worn ?? []
  const shadows = new Map<MoleActor, THREE.Mesh>()
  let holeMixer: THREE.AnimationMixer | null = null
  let holeObj: THREE.Object3D | null = null, holeClosing = false
  let holeT = -1, holeOpen: THREE.AnimationAction | null = null, holeClose: THREE.AnimationAction | null = null
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

  const glbOf: Record<string, string> = { 'room_base_v1.glb': baseUrl, 'room_deco_v1.glb': decoUrl }

  Promise.all([loadGlb(shellUrl), loadGlb(baseUrl), loadGlb(decoUrl), loadGlb(holeUrl), loadMoleGltf(), loadAccessories()]).then(([shell, base, deco, hole, moleG, acc]) => {
    if (disposed) return
    // glb 는 캐시를 같이 씀 → 장면마다 복제 (재질·텍스처는 공유)
    const shellS = shell.scene.clone(), decoS = deco.scene.clone(), baseS = base.scene.clone(), holeS = hole.scene.clone()
    scene.add(shellS, decoS, holeS)
    furniture.add(baseS)
    baseS.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh && /^shadow_/.test(m.name)) {
        const mat = (m.material as THREE.Material); mat.depthWrite = false; m.renderOrder = 1
      }
    })
    const roots: Record<string, THREE.Object3D> = { [baseUrl]: baseS, [decoUrl]: decoS }
    scene.updateMatrixWorld(true)
    for (const c of CATALOG) {
      if (!c.glb || c.category === 'deco') continue
      const node = roots[glbOf[c.glb] ?? '']?.getObjectByName(c.node)
      if (!node) continue
      const box = new THREE.Box3().setFromObject(node)
      if (box.min.y > 1) continue // 천장 램프처럼 매달린 것: 누를 수 없고 걸리지도 않음
      const data: FurnitureData = { id: c.id, label: c.name_ko, act: ACTS[c.id], stand: Math.max(c.size_m.w, c.size_m.d) / 2 + .55 }
      if (c.sit_point) {
        const sp = node.getObjectByName(c.sit_point)
        if (sp) {
          const ex = sp.userData as { seat_type?: Seat['kind']; seat_height_m?: number }
          data.seat = { kind: ex.seat_type ?? 'cushion', h: ex.seat_height_m ?? sp.getWorldPosition(new THREE.Vector3()).y }
          data.sitAt = sp
        }
      }
      node.userData.furniture = data
      // 방석처럼 앉는 낮은 가구는 발자리를 조금 작게 (앞까지 걸어와야 해서)
      const pad = c.sit_point ? MOLE_R * .6 : MOLE_R
      feet.push({ x0: box.min.x - pad, x1: box.max.x + pad, z0: box.min.z - pad, z1: box.max.z + pad })
    }

    // 천장 구멍
    holeObj = holeS
    holeMixer = new THREE.AnimationMixer(holeS)
    const clip = (n: string) => THREE.AnimationClip.findByName(hole.animations, n)
    const once = (c: THREE.AnimationClip | null) => {
      if (!c || !holeMixer) return null
      const a = holeMixer.clipAction(c); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; return a
    }
    holeOpen = once(clip('ceiling_hole_open')); holeClose = once(clip('ceiling_hole_close'))
    const drop = !reduce
    holeS.visible = drop
    if (drop && holeOpen) { holeOpen.play(); holeT = 0 }

    if (opts.hostName) {
      host = createMoleActor(moleG, { scale: 1, start: new THREE.Vector3(.95, FLOOR_Y, .55), yaw: -.45, drop: false, lookEvery: [5, 11], floorY: FLOOR_Y, acc, worn: opts.hostWorn })
      scene.add(host.object)
    }
    mole = createMoleActor(moleG, { scale: 1, start: new THREE.Vector3(0, FLOOR_Y, 0), clamp: clampRoom, drop, dropDelay: HOLE_OPEN, floorY: FLOOR_Y, acc, worn })
    scene.add(mole.object)
    for (const a of [host, mole]) if (a) { const sh = blobShadow(.9); scene.add(sh); shadows.set(a, sh) }
    loop.redraw()
  }).catch((err) => console.warn('[3D] 땅굴 모델을 못 불러왔어요', err))

  // 직접 조종: 방향키·WASD, 바닥을 누르면 그쪽으로, 동작이 있는 가구를 누르면 그 동작. 끌면 카메라가 돎
  const keyProxy = { drive: (x: number, z: number) => mole?.drive(x, z) }
  const unbindKeys = bindMoleKeys(keyProxy)
  const el = renderer.domElement, ray = new THREE.Raycaster(), ndc = new THREE.Vector2()
  const furnitureOf = (o: THREE.Object3D | null) => {
    for (; o; o = o.parent) if (o.userData.furniture) return o
    return null
  }
  const pick = (e: PointerEvent) => {
    const rect = el.getBoundingClientRect()
    ndc.set((e.clientX - rect.left) / rect.width * 2 - 1, -((e.clientY - rect.top) / rect.height * 2 - 1))
    ray.setFromCamera(ndc, camera)
    const hit = ray.intersectObject(furniture, true).find((h) => !/^shadow_/.test(h.object.name))
    // 집주인 두더지: 몸을 세로 막대(키 1m)로 보고 광선과의 거리로 판정
    let onHost = false
    if (host) {
      const hp = host.object.position, a = new THREE.Vector3(hp.x, hp.y + .1, hp.z), b2 = new THREE.Vector3(hp.x, hp.y + 1, hp.z)
      const pr = new THREE.Vector3(), ps = new THREE.Vector3()
      const d2 = ray.ray.distanceSqToSegment(a, b2, pr, ps)
      onHost = d2 < .45 ** 2 && (!hit || pr.distanceTo(ray.ray.origin) < hit.distance)
    }
    return { g: hit && !onHost ? furnitureOf(hit.object) : null, onHost }
  }
  const actionOf = (g: THREE.Object3D | null) => {
    const f = g?.userData.furniture as FurnitureData | undefined
    return f?.seat ? `${f.label}에 앉기` : f?.act === 'drink' ? '커피 마시기' : null
  }
  // 말풍선(리액션)·가구 이름표(마우스를 올렸을 때). 말풍선은 두더지 오른쪽 위, 꼬리는 왼쪽 아래
  const makeBubble = () => {
    const b = document.createElement('div')
    Object.assign(b.style, { position: 'absolute', left: '0', top: '0', pointerEvents: 'none', zIndex: '4', font: '600 22px/1 system-ui, sans-serif', padding: '8px 11px', borderRadius: '16px 16px 16px 4px', background: 'rgba(251,248,244,.96)', boxShadow: '0 4px 14px rgba(60,35,20,.18)', transformOrigin: '0 100%', transform: 'translate(0,-100%) scale(.6)', opacity: '0', transition: 'opacity .18s, transform .22s cubic-bezier(.2,.7,.2,1.4)' })
    container.append(b)
    return { el: b, from: 0, until: 0, who: null as MoleActor | null }
  }
  const bubbles = [makeBubble(), makeBubble()]
  const say = (i: number, who: MoleActor, emoji: string, delay = 0) => {
    const b = bubbles[i]; b.el.textContent = emoji; b.who = who; b.from = clock + delay; b.until = clock + delay + 2.2
  }
  const headV = new THREE.Vector3(), sideV = new THREE.Vector3()
  const drawBubbles = (t: number) => {
    for (const b of bubbles) {
      const on = !!b.who && t >= b.from && t < b.until
      if (on && b.who) {
        b.who.headTop(headV); headV.y -= .25
        sideV.copy(headV).project(camera)
        b.el.style.left = `${(sideV.x * .5 + .5) * W + 34}px`; b.el.style.top = `${(-sideV.y * .5 + .5) * H}px`
      }
      const op = on ? '1' : '0'
      if (b.el.style.opacity !== op) { b.el.style.opacity = op; b.el.style.transform = `translate(0,-100%) scale(${on ? 1 : .6})` }
    }
  }
  const hint = document.createElement('div')
  Object.assign(hint.style, { position: 'absolute', left: '0', top: '0', pointerEvents: 'none', zIndex: '4', font: '500 13px/1 Pretendard, system-ui, sans-serif', padding: '7px 10px', borderRadius: '8px', background: 'rgba(62,42,31,.88)', color: '#fbf4ec', transform: 'translate(-50%, calc(-100% - 14px))', opacity: '0', transition: 'opacity .12s', whiteSpace: 'nowrap' })
  container.append(hint)
  let clock = 0

  let down: { x: number; y: number } | null = null
  const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY } }
  const onUp = (e: PointerEvent) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) { down = null; return }
    down = null
    if (!mole) return
    const { g, onHost } = pick(e)
    if (onHost) return
    if (g && mole.interact(g)) return
    if (g) return // 동작 없는 가구는 interact 가 앞까지 걸어감
    const o = ray.ray.origin, dir = ray.ray.direction; if (dir.y >= 0) return
    const t = (FLOOR_Y - o.y) / dir.y; mole.walkTo(new THREE.Vector3(o.x + dir.x * t, FLOOR_Y, o.z + dir.z * t))
  }
  let moveQueued: PointerEvent | null = null
  const onMove = (e: PointerEvent) => { moveQueued = e }
  const onLeave = () => { moveQueued = null; hint.style.opacity = '0'; el.style.cursor = 'pointer' }
  el.addEventListener('pointerdown', onDown); el.addEventListener('pointerup', onUp)
  el.addEventListener('pointermove', onMove); el.addEventListener('pointerleave', onLeave)
  el.style.cursor = 'pointer'

  let W = 1, H = 1
  let focusTarget = opts.focusX ?? 0.5, focus = focusTarget
  const applyFrame = () => {
    if (W / H < 1) {
      // 세로 화면: 가로를 꽉 채움 (스펙: 가로 화각 유지 → 돔 양옆이 잘리지 않게)
      const bw = W * 1.02, bh = bw * 3 / 4
      frameCamera(camera, W, H, { left: (W - bw) / 2, top: (H - bh) * .62, w: bw, h: bh })
    } else {
      const bh = H * 1.145, bw = bh * 4 / 3
      frameCamera(camera, W, H, { left: focus * W - bw / 2, top: -0.054 * H, w: bw, h: bh })
    }
  }

  const loop = startLoop(container, {
    resize(w, h) {
      W = w; H = h
      renderer.setSize(w, h, false)
      applyFrame()
    },
    frame(dt, t) {
      if (focus !== focusTarget) { focus = approach(focus, focusTarget, dt); applyFrame() }
      clock = t
      controls.update()
      if (moveQueued) {
        const e = moveQueued; moveQueued = null
        const pk = pick(e), rect = el.getBoundingClientRect()
        const label = pk.onHost ? opts.hostName ?? null : actionOf(pk.g)
        hint.textContent = label ?? ''
        hint.style.opacity = label ? '1' : '0'
        hint.style.left = `${e.clientX - rect.left}px`; hint.style.top = `${e.clientY - rect.top}px`
      }
      // 천장 구멍: 열림 → (두더지 떨어짐) → 1.5초에 닫힘
      if (holeMixer && holeT >= 0) {
        holeT += dt
        if (!holeClosing && holeT >= HOLE_CLOSE) { holeClosing = true; holeOpen?.stop(); holeClose?.play() }
        holeMixer.update(dt)
        if (holeT > HOLE_CLOSE + .7 && holeObj) { holeT = -1; holeMixer.stopAllAction(); holeObj.visible = false }
      }
      host?.update(dt)
      mole?.update(dt)
      for (const [a, sh] of shadows) {
        sh.visible = a.object.visible
        sh.position.set(a.object.position.x, .012, a.object.position.z)
      }
      drawBubbles(t)
      renderer.render(scene, camera)
    },
  })

  return {
    resize: () => loop.resize(),
    setFocusX(x) {
      focusTarget = x
      // 루프가 안 도는 환경(헤드리스·숨은 탭)에서도 최종 위치는 맞게
      if (document.hidden) { focus = x; applyFrame() }
    },
    setWorn(ids) { worn = ids; mole?.setWorn(ids) },
    react(kind) {
      if (!mole) return
      const emoji = REACTIONS.find((r) => r.kind === kind)?.emoji ?? ''
      if (kind === 'greet' && host) {
        // 집주인 앞까지 가서 마주 보고 인사 → 집주인도 0.25초 뒤 인사. 말풍선은 인사를 시작할 때
        const me = mole, hs = host
        me.greetWith(hs)
        const started = clock
        const watch = () => {
          if (disposed || clock - started > 20) return
          if (me.isGreeting()) { say(0, me, emoji); say(1, hs, emoji, .25); return }
          requestAnimationFrame(watch)
        }
        requestAnimationFrame(watch)
        return
      }
      mole.react(kind)
      say(0, mole, emoji)
    },
    dispose() {
      disposed = true
      loop.stop()
      controls.dispose()
      unbindKeys()
      mole?.dispose(); host?.dispose()
      holeMixer?.stopAllAction()
      bubbles.forEach((b) => b.el.remove()); hint.remove()
      el.removeEventListener('pointerdown', onDown); el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointermove', onMove); el.removeEventListener('pointerleave', onLeave)
      // glb 지오메트리·텍스처는 캐시가 다음 장면에서 다시 쓰므로 해제하지 않음 (GPU 쪽은 렌더러·컨텍스트와 함께 풀림)
      for (const sh of shadows.values()) { sh.geometry.dispose(); (sh.material as THREE.Material).dispose() }
      destroyRenderer(renderer)
    },
  }
}
