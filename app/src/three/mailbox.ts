import * as THREE from 'three'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'

/*
 * 방명록 우체통 (3D 핸드오프 v3.6, design/digul_3d_handoff_v3_6/docs/mailbox_handoff.md, 정리 docs/mailbox-integration.md)
 * - 노드: Mailbox(원점 = 바닥 가운데, 앞면 +Z) → Mailbox_Body / Mailbox_Flag(피벗 = 경첩) / Mailbox_Letter
 * - 클립 FlagUp(0.42초, 깃발 회전만). 내릴 때는 역재생
 * - 새 방명록 있음: 깃발 올림 + 편지 보임 + 발광 1 (고사양은 0.5↔1.5 천천히 반복) / 없음: 깃발 내림 + 편지 숨김 + 발광 0
 * - 블룸: 방 장면엔 후처리(composer)가 없어서 "우체통에만 블룸"은 가산 혼합 빛무리 스프라이트로 흉내 (발광 세기에 따라 투명도)
 * - 마우스를 올리면 외곽선: 법선 방향으로 조금 부풀린 뒷면 껍데기 (후처리 없이, 메시 몇 개라 가벼움)
 * - 클릭 영역: 모델보다 큰 보이지 않는 상자 (hit). 화면에서 작게 보여서
 */

const GLOW = '#FFD27A'
const OUTLINE = '#FFF4D2'
const PULSE_SEC = 2.6

export interface Mailbox {
  /** 장면에 넣을 묶음 (위치·회전 적용됨) */
  root: THREE.Group
  /** 클릭 판정용 보이지 않는 상자 (layer 0, 그려지지 않음) */
  hit: THREE.Mesh
  /** 바닥 발자리 (월드 xz 반폭) */
  half: { x: number; z: number }
  setNew(on: boolean, instant?: boolean): void
  /** 외곽선 강조. 바뀌었으면 true */
  setHover(on: boolean): boolean
  /** 매 프레임. 그림이 바뀌었으면 true (부분 그리기에서 우체통 자리를 다시 그림) */
  update(dt: number, t: number): boolean
  /** 깃발·발광이 바뀌는 중 */
  busy(): boolean
  dispose(): void
}

function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64
  const g = c.getContext('2d')!
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.35, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** 법선 방향으로 d 만큼 부풀린 단색 뒷면 재질 (외곽선 껍데기) */
function outlineMaterial(d: number) {
  const m = new THREE.MeshBasicMaterial({ color: OUTLINE, side: THREE.BackSide, toneMapped: false })
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `vec3 transformed = vec3( position ) + normalize( normal ) * ${d.toFixed(4)};`)
  }
  m.customProgramCacheKey = () => `mailbox-outline-${d}`
  return m
}

export function createMailbox(gltf: GLTF, place: { pos: [number, number, number]; ryDeg: number }, o: { pulse: boolean }): Mailbox {
  const root = new THREE.Group(); root.name = 'mailbox'
  root.position.set(...place.pos)
  root.rotation.y = THREE.MathUtils.degToRad(place.ryDeg)
  const src = gltf.scene.getObjectByName('Mailbox') ?? gltf.scene
  const box = src.clone(true)
  box.position.set(0, 0, 0); box.rotation.set(0, 0, 0)
  root.add(box)

  // glb 재질은 장면끼리 공유(캐시) → 발광을 바꾸는 두 재질만 이 장면용으로 복제
  const glowMats: THREE.MeshStandardMaterial[] = []
  const made: THREE.Material[] = []
  const outlineMat = outlineMaterial(.012)
  made.push(outlineMat)
  const outlines: THREE.Mesh[] = []
  // 메시를 먼저 모은 뒤 외곽선을 붙임 (traverse 도중에 자식을 넣으면 끝없이 돎)
  const meshes: THREE.Mesh[] = []
  box.traverse((n) => { if ((n as THREE.Mesh).isMesh) meshes.push(n as THREE.Mesh) })
  meshes.forEach((m) => {
    const mat = m.material as THREE.MeshStandardMaterial
    if (mat.name === 'mailbox_flag_mat' || mat.name === 'mailbox_letter_mat') {
      const c = mat.clone(); c.emissive.set(GLOW); c.emissiveIntensity = 0
      m.material = c; glowMats.push(c); made.push(c)
    }
    const ol = new THREE.Mesh(m.geometry, outlineMat)
    ol.name = `${m.name}_outline`; ol.visible = false; ol.renderOrder = -1
    m.add(ol); outlines.push(ol)
  })
  const letter = box.getObjectByName('Mailbox_Letter')
  if (letter) letter.visible = false

  // 빛무리 (선택적 블룸 대신). 깃발·편지 언저리
  const glowTex = glowTexture()
  const glowMat = new THREE.SpriteMaterial({ map: glowTex, color: GLOW, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0, toneMapped: false })
  made.push(glowMat)
  const glow = new THREE.Sprite(glowMat)
  glow.position.set(-.06, .3, .05); glow.scale.setScalar(.85); glow.visible = false; glow.renderOrder = 5
  root.add(glow)

  // 클릭 상자: 모델(0.30×0.26×0.40)보다 넉넉하게
  const hitGeo = new THREE.BoxGeometry(.6, .72, .56)
  const hitMat = new THREE.MeshBasicMaterial({ visible: false })
  const hit = new THREE.Mesh(hitGeo, hitMat)
  hit.name = 'mailbox_hit'
  hit.position.set(place.pos[0], .36, place.pos[2]); hit.rotation.y = root.rotation.y

  // 깃발
  const mixer = new THREE.AnimationMixer(box)
  const clip = THREE.AnimationClip.findByName(gltf.animations, 'FlagUp')
  const flag = clip ? mixer.clipAction(clip) : null
  if (flag) { flag.setLoop(THREE.LoopOnce, 1); flag.clampWhenFinished = true }
  let flagT = -1 // 깃발이 움직이는 남은 시간 (−1 = 멈춤)

  let isNew = false, hover = false
  let level = 0 // 지금 발광 세기
  let changed = true

  const applyGlow = (v: number) => {
    for (const m of glowMats) m.emissiveIntensity = v
    glowMat.opacity = Math.min(1, v * .38)
    glow.visible = v > .01
  }

  const api: Mailbox = {
    root, hit,
    half: { x: .16, z: .14 },
    setNew(on, instant = false) {
      if (on === isNew && !instant) return
      isNew = on
      if (letter) letter.visible = on
      if (flag && clip) {
        flag.paused = false
        flag.timeScale = on ? 1 : -1
        if (instant) {
          // 바로 그 자세로: 올림은 마지막 프레임, 내림은 파일 기본 자세(액션 멈춤)
          if (on) { flag.reset(); flag.play(); flag.time = clip.duration; mixer.update(0) } else { flag.stop(); mixer.update(0) }
          flagT = -1
        } else {
          if (!flag.isRunning()) { flag.reset(); flag.time = on ? 0 : clip.duration; flag.play() }
          flagT = clip.duration + .05
        }
      }
      if (instant) { level = on ? 1 : 0; applyGlow(level) }
      changed = true
    },
    setHover(on) {
      if (on === hover) return false
      hover = on
      for (const ol of outlines) ol.visible = on
      changed = true
      return true
    },
    update(dt, t) {
      let c = changed
      changed = false
      if (flagT >= 0) {
        mixer.update(dt)
        flagT -= dt
        if (flagT < 0 && !isNew) flag?.stop()
        c = true
      }
      // 발광: 새 방명록이면 1 (고사양은 0.5↔1.5 반복), 아니면 0. 바뀔 때는 0.4초 안에 따라감
      const goal = isNew ? (o.pulse ? 1 + .5 * Math.sin(t * Math.PI * 2 / PULSE_SEC) : 1) : 0
      if (Math.abs(level - goal) > 1e-3) {
        const k = dt > 0 ? 1 - Math.exp(-dt * (o.pulse && isNew && Math.abs(level - goal) < .6 ? 30 : 8)) : 1
        level += (goal - level) * k
        if (Math.abs(level - goal) < 1e-3) level = goal
        applyGlow(level)
        c = true
      }
      return c
    },
    busy() {
      if (flagT >= 0) return true
      const goal = isNew ? 1 : 0
      return !o.pulse && Math.abs(level - goal) > 1e-3
    },
    dispose() {
      mixer.stopAllAction()
      made.forEach((m) => m.dispose())
      glowTex.dispose(); hitGeo.dispose(); hitMat.dispose()
    },
  }
  return api
}
