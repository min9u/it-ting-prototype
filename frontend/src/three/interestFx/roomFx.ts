import * as THREE from 'three'
import { fxOn, subscribeFx } from '../../lib/fxLab'
import {
  FX_STYLE, RARITY_LABEL, SUB_TOTAL, TALK_LABEL, catName, fxColor, greetLine, greetTopicsOf, hasPet, leadOf, mainFurnitureOf, neighborsWith, peopleCount, rarestOf,
  rarityOf, rarityRank, rollcallOf, rollcallText, sharedSubs, subName, subsOfCat, summaryOf, type Rarity, type TalkMood,
} from '../../data/interestFx'
import { createOverlay, type OverlayFrame } from './overlay'
import { badge, glow, glyph, lighten, sticker, stickerSize, tag, toRgba } from './icons'

/*
 * 땅굴 안 관심사 이펙트 (docs/interest-effects.md). roomScene 은 만들기·마우스 올림·누름·인사·정리만 부름
 *
 * r_summary 관심사 한 줄 요약 (2차): 장면 위 가운데 관심사 줄 (겹치는 것 ♥ → 가장 드문 것 ✦ → 고른 순서) + "나와 N개 겹쳐요".
 *   하나에 마우스를 올리면 그 가구에 불이 들어오고 줄에서 가구까지 점선, 제목에 올리면 입장 이름표를 다시
 * r_rollcall 입장 이름표 (2차): 입장 연출이 끝나면 카테고리 가구마다 "음악 · 시티팝, 피아노" 이름표가 차례로 퐁 → 몇 초 뒤 사라짐
 * r_particles 관심사 숨결: 대분류 주 가구(피아노·이젤 …)와 소분류 소품에서 그 관심사다운 입자 (2차: 흰 테두리 스티커라 밝은 벽 위에서도 읽힘)
 *   2026-11-18 확정본 12개: 음악·댄스 음표 · 사진·영상 플래시 반짝 · 반려동물·식물 잎(+ 동물 바닥 발자국) · 게임 픽셀(계단식으로 오름) ·
 *   미술·수공예 물감 방울 · 책·글 종이 · 음식·음료 김 · 아웃도어 모닥불 불티 · 문화생활 팝콘 ·
 *   스포츠 통통 튀는 공 · 외국어·자기계발 말풍선 · 덕질·수집 반짝 별 (data/interestFx.ts FX_STYLE)
 * r_card 관심사 카드: 가구에 마우스를 올리면 관심사·고른 사람 수·드문 정도·내 들판 이웃 수·(남의 땅굴) 같이 좋아함 + 말 걸기 한마디
 * r_shared 나와 같은 관심사 (남의 땅굴): 그 가구에 따뜻한 빛 + "♥ 나도 캠핑" 배지 + 하트
 * r_rare 가장 드문 관심사: 방에서 가장 드문 관심사 가구에 반짝이 + "✦ 다도 · 드문 취미" 배지 (아주 드물면 무지개)
 * r_poke 누르면 관심사 톡 (2차): 관심사 가구를 누르면 그 관심사 입자가 한 움큼 + 이름표
 * r_greet 인사하면 겹치는 관심사 (2차, 남의 땅굴): 👋 인사가 시작되면 두 두더지 사이로 겹치는 관심사가 튀어 오르고 말 걸 한마디
 * r_talk 말 걸어도 돼요 반딧불 (2차, 남의 땅굴, 목 데이터): 집주인 곁에 반딧불 + "말 걸어도 돼요" / 작은 달 + "방명록부터 천천히"
 * r_notice 두더지가 알아챔 (2차): 내 두더지가 관심사 가구 곁을 지나가면 머리 위 "!" + 그 가구 위 이름표
 * r_beam 대표 관심사 빛줄기: 천장 구멍에서 내려오는 빛과 떠다니는 먼지를 대표 관심사 색으로
 *
 * 가림 (2차): 겹 캔버스는 늘 3D 위라 두더지 뒤에 있는 입자·반짝이도 앞에 그려졌음 → 두더지 둘레 타원 안이고 두더지보다 먼 것은 그리지 않음
 * (화면 타원 + 카메라 거리 비교라 싸다. 이름표·요약처럼 글자인 것은 늘 위)
 */

export interface RoomFxItem { g: THREE.Object3D; sub: string | null; category: string; rowId: string; type: string }

export interface RoomFxOptions {
  container: HTMLElement
  /** 이 뒤에 겹 캔버스를 붙임 (WebGL 캔버스) */
  after: Element
  camera: THREE.PerspectiveCamera
  /** 관심사 가구 목록 (꾸미기에서 갈아 끼우면 바뀌므로 함수) */
  items: () => RoomFxItem[]
  ownerId?: string
  /** 방 주인 관심사 */
  interests: string[]
  /** 남의 땅굴이면 내 관심사 (나와 같은 관심사) */
  viewer?: string[]
  /** 천장 구멍 가운데 (빛줄기 위쪽) */
  hole: THREE.Vector3
  /** 입장 연출 중 (천장 구멍·가구 낙하) → 이펙트를 숨겼다가 끝나면 서서히 */
  intro: () => boolean
  /** 내 두더지 · 집주인 두더지 (가림 · 알아챔 · 인사 · 반딧불) */
  actors?: () => { me: THREE.Object3D | null; host: THREE.Object3D | null }
  /** 집주인 대화 의향 (남의 땅굴, 목 데이터 data/interestFx talkMoodOf) */
  talk?: TalkMood | null
}

export interface RoomFx {
  /** 마우스를 올린 가구 (없으면 null). 카드를 띄웠으면 true → 장면의 이름표는 숨김 */
  hover(g: THREE.Object3D | null, action: string | null): boolean
  /** 가구를 누름 (r_poke) */
  poke(g: THREE.Object3D | null): void
  /** 👋 인사가 시작됨 (두 두더지가 마주 봄, r_greet) */
  greet(): void
  dispose(): void
}

interface Em {
  item: RoomFxItem
  cat: string
  color: string
  kind: 'main' | 'prop' | 'pet' | 'none'
  top: THREE.Vector3
  center: THREE.Vector3
  half: number
  acc: number
  heartAcc: number
  flashAt: number
  step: number
  shared: boolean
  rare: Rarity | null
  /** 알아챔을 마지막으로 띄운 시각 (실제 초) */
  noticeAt: number
  // 이번 프레임 화면 값
  sx: number; sy: number; ppm: number; on: boolean; depth: number
}

interface P {
  em: Em
  kind: string
  x: number; y: number; z: number
  vx: number; vy: number; vz: number
  age: number; life: number
  size: number
  rot: number; vr: number
  color: string
  seed: number
  /** 누르면 터짐(r_poke): 중력으로 떨어짐 */
  burst?: boolean
}

/** 잠깐 뜨는 이름표 (누름 · 알아챔) */
interface Pop { em: Em; t0: number; dur: number; text: string; bang: boolean }

const RATE_MAIN = 1.7, RATE_PROP = 0.45, PET_STEP = 0.42, HEART_RATE = 0.8
/** 입자 크기 배율 (첫 스크린샷에서 너무 작아 보였음) */
const K = 1.45
const pickOf = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]
/** 대분류 → 입자 모양 (data/interestFx.ts FX_STYLE). 인사 하트는 가짜 대분류 '__heart' */
const styleOf = (cat: string) => FX_STYLE[cat] ?? (cat === '__heart' ? 'heart' : 'star')
/** 입자 모양 → 스티커 글리프 이름 (three/interestFx/icons.ts) */
const STICKER_OF: Record<string, string> = { note: 'note', leaf: 'nature', heart: 'heart', talk: 'language_selfdev', ball: 'sports' }
const PAL = {
  leaf: ['#5FAE45', '#8CC56A', '#3F8A3A', '#A9D46F'],
  pixel: ['#58C4F6', '#F5C452', '#E8743B', '#8CC56A', '#B784F0'],
  paint: ['#E8705A', '#F2C14E', '#4E8FD0', '#6FB24A', '#B784F0'],
  ember: ['#FFB347', '#FF7A3A', '#FFD27A'],
  popcorn: ['#FFF6D8', '#FFE9A8', '#FFF0C0'],
  ball: ['#F28C38', '#F5D547', '#58C4F6', '#D23C54'],
  star5: ['#FF9EC7', '#FFD36E', '#9ED8FF', '#C7A6FF'],
}
/** 무지개 반짝이 색 (hsl 을 그때그때 만들면 글리프 캐시가 끝없이 늘어서 12단계로) */
const RAINBOW = Array.from({ length: 12 }, (_, i) => {
  const c = new THREE.Color().setHSL(i / 12, 0.85, 0.68)
  return `#${c.getHexString()}`
})
const GOLD = '#F5C452', SHARE = '#FF8A7A', SPRITE = 24
/** 입장 이름표: 하나씩 뜨는 간격 · 다 뜬 뒤 머무는 시간 (초) */
const ROLL_GAP = 0.16, ROLL_HOLD = 4.2
const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
const easeBack = (u: number) => { const c = 1.7; const x = u - 1; return 1 + (c + 1) * x * x * x + c * x * x }
/** 실제 시각 (초). 겹 캔버스의 t 는 그린 프레임 동안만 흐르므로(가속 꺼짐에서 쉬는 중·움직임 없는 단계) 정해진 시간 동안 보일 것은 이 시각으로 잼 */
const now = () => performance.now() / 1000

export function createRoomFx(o: RoomFxOptions): RoomFx {
  const { camera } = o
  const shared = new Set(o.viewer ? sharedSubs(o.interests, o.viewer) : [])
  const rarest = rarestOf(o.interests)
  const lead = leadOf(o.interests)
  const ems: Em[] = []
  let measured = false
  let lastMeasure = -1e9
  const box = new THREE.Box3()
  /** 관심사 가구 → 이펙트 자리 (위 가운데·크기). 1초마다 다시 잼 (갈아 끼우기·모양 바꾸기) */
  const measure = () => {
    const m0 = performance.now()
    const items = o.items()
    // items() 는 부를 때마다 새 배열이라 가구 묶음(g)·행이 같은지로 비교 (같으면 입자 쌓인 값을 그대로 둠)
    const same = items.length === ems.length && items.every((it, i) => ems[i].item.g === it.g && ems[i].item.rowId === it.rowId)
    if (!same) {
      ems.length = 0
      for (const it of items) {
        const pet = it.type === 'pet'
        const main = !it.sub && it.rowId === mainFurnitureOf(it.category)
        // 반려동물 용품(침대·집)은 동물이 발자국을 내므로 입자 없음 (반려동물·식물의 식물 소품은 잎)
        const kind: Em['kind'] = pet ? 'pet' : main ? 'main' : it.sub && !hasPet(it.sub) ? 'prop' : 'none'
        ems.push({
          item: it, cat: it.category, color: fxColor(it.category), kind, top: new THREE.Vector3(), center: new THREE.Vector3(), half: .3,
          acc: Math.random(), heartAcc: Math.random(), flashAt: 1 + Math.random() * 3, step: 0,
          shared: !!it.sub && shared.has(it.sub), rare: null, noticeAt: -1e9, sx: 0, sy: 0, ppm: 100, on: false, depth: 0,
        })
      }
      // 가장 드문 관심사: 그 관심사의 가구 하나 (동물이 있으면 동물, 없으면 소품)
      const r = rarest ? ems.filter((e) => e.item.sub === rarest.id) : []
      const target = r.find((e) => e.kind === 'pet') ?? r[0]
      if (target && rarest) target.rare = rarest.rarity
    }
    for (const e of ems) {
      e.item.g.updateMatrixWorld(true)
      box.setFromObject(e.item.g)
      if (box.isEmpty()) continue
      box.getCenter(e.center)
      e.top.set(e.center.x, box.max.y, e.center.z)
      e.half = Math.max(.08, Math.min(.9, Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2))
    }
    lastMeasure = performance.now(); measured = true
    cost('measure', lastMeasure - m0)
  }

  /** 측정용: 이펙트 일의 가장 긴 시간 (ms) → window.__fxCost */
  const cost = (k: string, ms: number) => { const w = window as unknown as { __fxCost?: Record<string, number> }; const c = (w.__fxCost ??= {}); c[k] = Math.max(c[k] ?? 0, Math.round(ms * 10) / 10) }
  /* ---------- 화면 투영 ---------- */
  const v = new THREE.Vector3()
  const S = { x: 0, y: 0, ok: false }
  let W = 1, H = 1
  const proj = (x: number, y: number, z: number) => {
    v.set(x, y, z).project(camera)
    S.x = (v.x * .5 + .5) * W; S.y = (-v.y * .5 + .5) * H; S.ok = v.z < 1 && v.z > -1
    return S
  }
  const camRight = new THREE.Vector3()
  const camPos = new THREE.Vector3()
  const dist = (x: number, y: number, z: number) => Math.hypot(x - camPos.x, y - camPos.y, z - camPos.z)

  /* ---------- 두더지 (가림 · 알아챔 · 인사 · 반딧불) ---------- */
  interface Actor { obj: THREE.Object3D; h: number; r: number; sx: number; sy: number; rx: number; ry: number; depth: number; headX: number; headY: number }
  const actorSize = new Map<THREE.Object3D, { h: number; r: number }>()
  const actorList: Actor[] = []
  let meA: Actor | null = null, hostA: Actor | null = null
  const updateActors = () => {
    actorList.length = 0; meA = hostA = null
    const a = o.actors?.()
    if (!a) return
    for (const [k, obj] of [['me', a.me], ['host', a.host]] as const) {
      if (!obj || !obj.visible) continue
      let sz = actorSize.get(obj)
      if (!sz) {
        // 크기는 한 번만 잼 (뼈대 묶음이라 매 프레임 재면 비쌈). 못 재면 두더지 기본 크기
        obj.updateMatrixWorld(true)
        box.setFromObject(obj)
        const hgt = box.isEmpty() ? 1.15 : Math.min(1.8, Math.max(.6, box.max.y - box.min.y))
        const rad = box.isEmpty() ? .4 : Math.min(.7, Math.max(.25, Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2))
        sz = { h: hgt, r: rad }
        actorSize.set(obj, sz)
      }
      const p = obj.position
      const c = proj(p.x, p.y + sz.h / 2, p.z), cx = c.x, cy = c.y
      const top = proj(p.x, p.y + sz.h, p.z).y, bot = proj(p.x, p.y, p.z).y
      const ry = Math.abs(bot - top) / 2 * 1.04, rx = ry * (sz.r / (sz.h / 2)) * 1.08
      const head = proj(p.x, p.y + sz.h, p.z)
      const act: Actor = { obj, h: sz.h, r: sz.r, sx: cx, sy: cy, rx, ry, depth: dist(p.x, p.y + sz.h / 2, p.z) - sz.r * .6, headX: head.x, headY: head.y }
      actorList.push(act)
      if (k === 'me') meA = act; else hostA = act
    }
  }
  /** 화면 (x, y) · 카메라 거리 d 인 점이 두더지 뒤에 가려지는지 */
  const hidden = (x: number, y: number, d: number) => {
    for (const a of actorList) {
      if (d <= a.depth) continue
      const dx = (x - a.sx) / a.rx, dy = (y - a.sy) / a.ry
      if (dx * dx + dy * dy < 1) return true
    }
    return false
  }

  /* ---------- 입자 ---------- */
  const ps: P[] = []
  const spawn = (e: Em, small: boolean) => {
    const r = Math.random
    const p: P = {
      em: e, kind: styleOf(e.cat), x: e.top.x + (r() - .5) * e.half * 1.1, y: e.top.y + .02, z: e.top.z + (r() - .5) * e.half * .5,
      vx: 0, vy: 0, vz: 0, age: 0, life: 2, size: .12, rot: 0, vr: 0, color: e.color, seed: r() * 10,
    }
    const k = (small ? .75 : 1) * K
    switch (p.kind) {
      case 'note': p.vy = .36; p.vx = (r() - .5) * .1; p.life = 2.4; p.size = .16 * k; p.color = r() < .5 ? e.color : lighten(e.color, .3); p.rot = (r() - .5) * .5; break
      case 'flash': p.y = e.top.y - r() * .25; p.vy = .04; p.life = .55; p.size = .16 * k; p.color = '#ffffff'; break
      case 'leaf': p.vy = .2; p.vx = (r() - .5) * .22; p.life = 3; p.size = .13 * k; p.vr = (r() - .5) * 2.5; p.rot = r() * 6; p.color = pickOf(PAL.leaf); break
      case 'pixel': p.vy = .34; p.vx = (r() - .5) * .12; p.life = 1.8; p.size = .07 * k; p.color = pickOf(PAL.pixel); break
      case 'paint': p.vy = .75 + r() * .3; p.vx = (r() - .5) * .45; p.vz = (r() - .5) * .2; p.life = 1.3; p.size = (.045 + r() * .03) * k; p.color = pickOf(PAL.paint); break
      case 'page': p.vy = .2; p.vx = (r() - .5) * .15; p.life = 2.6; p.size = .12 * k; p.color = '#fffaf0'; p.vr = (r() - .5) * .8; break
      case 'steam': p.x = e.top.x + (r() - .5) * e.half * .5; p.vy = .22; p.life = 2.4; p.size = .16 * k; p.color = '#ffffff'; break
      case 'ember': p.vy = .5 + r() * .3; p.vx = (r() - .5) * .15; p.life = 1.3 + r() * .5; p.size = .06 * k; p.color = pickOf(PAL.ember); break
      case 'popcorn': p.vy = 1 + r() * .4; p.vx = (r() - .5) * .5; p.vz = (r() - .5) * .3; p.life = 1.2; p.size = .075 * k; p.color = pickOf(PAL.popcorn); p.vr = (r() - .5) * 6; break
      // 스포츠: 가구 위에서 통통 튀는 작은 공 (떨어지면 가구 윗면에서 한 번 튐, stepParticles)
      case 'ball': p.vy = .95 + r() * .35; p.vx = (r() - .5) * .3; p.vz = (r() - .5) * .15; p.life = 1.6; p.size = .095 * k; p.color = pickOf(PAL.ball); p.vr = (r() - .5) * 5; break
      // 외국어·자기계발: 천천히 떠오르는 말풍선
      case 'talk': p.vy = .26; p.vx = (r() - .5) * .12; p.life = 2.5; p.size = .14 * k; p.color = r() < .5 ? e.color : lighten(e.color, .35); p.rot = (r() - .5) * .3; break
      // 덕질·수집: 반짝이며 도는 별 스티커
      case 'star5': p.vy = .22; p.vx = (r() - .5) * .16; p.life = 2.4; p.size = .13 * k; p.vr = (r() - .5) * 1.6; p.rot = r() * 6; p.color = pickOf(PAL.star5); break
      case 'heart': p.vy = .4; p.life = 1.6; p.size = .12 * k; p.color = SHARE; break
      default: p.vy = .3; p.life = 2; p.kind = 'star'; p.color = '#ffffff'
    }
    ps.push(p)
    return p
  }
  /** 반려동물: 동물 둘레를 도는 발자국 (바닥에 찍히고 사라짐) */
  const pawStep = (e: Em) => {
    e.step++
    const R = e.half + .35, a = e.step * .3 + e.center.x
    const side = e.step % 2 ? 1 : -1
    const hx = -Math.sin(a), hz = Math.cos(a) // 진행 방향 (원을 따라)
    ps.push({
      em: e, kind: 'paw', x: e.center.x + Math.cos(a) * R + hz * .06 * side, y: .025, z: e.center.z + Math.sin(a) * R * .8 - hx * .06 * side,
      vx: hx, vy: 0, vz: hz, age: 0, life: 2.6, size: .12, rot: 0, vr: 0, color: e.color, seed: 0,
    })
  }
  /** 누르면 터짐: 그 카테고리 입자를 사방으로 (중력으로 떨어짐) */
  const burst = (e: Em, n: number) => {
    const r = Math.random
    for (let i = 0; i < n; i++) {
      const p = spawn(e, false)
      const a = (i / n) * Math.PI * 2 + r() * .5, sp = .55 + r() * .55
      p.x = e.top.x + (r() - .5) * e.half * .4; p.z = e.top.z; p.y = e.top.y + .05
      p.vx = Math.cos(a) * sp; p.vz = Math.sin(a) * sp * .4; p.vy = .9 + r() * .8
      p.life = Math.min(p.life, 1.15 + r() * .35); p.burst = true
      if (p.kind === 'flash') { p.kind = 'star'; p.size = .14 * K }
      if (p.kind === 'steam') { p.vx *= .4; p.vz *= .4; p.vy *= .5; p.burst = false }
    }
  }

  /* ---------- 미리 그린 배지 (드문 취미·나도) ---------- */
  const pill = (text: string, bg: string, icon: string, iconColor: string, s: number) => tag({ text, bg, fg: '#ffffff', icon, iconColor, s, h: 22 })

  /* ---------- 카드 (DOM) ---------- */
  const card = document.createElement('div')
  card.setAttribute('role', 'tooltip')
  Object.assign(card.style, {
    position: 'absolute', left: '0', top: '0', zIndex: '5', pointerEvents: 'none', width: 'max-content', maxWidth: '260px',
    padding: '11px 13px 10px', borderRadius: '14px', background: 'rgba(251,248,244,.97)', color: '#3e2a1f',
    boxShadow: '0 6px 18px rgba(60,35,20,.22), 0 2px 0 rgba(116,74,50,.12)', font: '500 12px/1.45 Pretendard, system-ui, sans-serif',
    opacity: '0', transform: 'translate(-50%, -100%) translateY(-6px) scale(.96)', transformOrigin: '50% 100%',
    transition: 'opacity .14s, transform .18s cubic-bezier(.2,.7,.2,1.3)', display: 'none',
  } satisfies Partial<CSSStyleDeclaration>)
  o.container.append(card)
  let cardEm: Em | null = null
  let cardKey = ''
  const el = (tagName: string, css: Partial<CSSStyleDeclaration>, text?: string) => {
    const x = document.createElement(tagName); Object.assign(x.style, css); if (text != null) x.textContent = text; return x
  }
  const iconCanvas = (cat: string, px: number) => {
    const icon = badge(cat, px, fxColor(cat), Math.min(window.devicePixelRatio || 1, 2))
    const ic = document.createElement('canvas')
    ic.width = icon.width; ic.height = icon.height
    ic.setAttribute('aria-hidden', 'true')
    ic.getContext('2d')!.drawImage(icon, 0, 0)
    return ic
  }
  const fillCard = (e: Em, action: string | null) => {
    card.replaceChildren()
    const head = el('div', { display: 'flex', alignItems: 'center', gap: '9px' })
    const ic = iconCanvas(e.cat, 26)
    Object.assign(ic.style, { width: '30px', height: '30px', flex: 'none' })
    const titleBox = el('div', { display: 'flex', flexDirection: 'column' })
    const sub = e.item.sub
    titleBox.append(
      el('strong', { font: "400 17px/1.15 'Do Hyeon', Pretendard, sans-serif", color: '#3e2a1f' }, sub ? subName(sub) : catName(e.cat)),
      el('small', { fontSize: '11px', color: '#8a7262' }, sub ? catName(e.cat) : `${catName(e.cat)} 가구`),
    )
    head.append(ic, titleBox)
    card.append(head)
    const line = (text: string, css: Partial<CSSStyleDeclaration> = {}) => card.append(el('p', { margin: '6px 0 0', ...css }, text))
    if (sub) {
      const n = peopleCount(sub)
      if (n != null) line(`이 관심사를 고른 사람 ${n.toLocaleString()}명`)
      const r = rarityOf(n)
      if (r) {
        const rank = rarityRank(sub)
        const t = el('span', {
          display: 'inline-flex', marginTop: '6px', padding: '3px 8px', borderRadius: '999px', fontWeight: '700', fontSize: '11px',
          background: r === 'legend' ? 'linear-gradient(90deg,#ff9a9e,#fad0c4,#a1c4fd,#c2e9fb)' : r === 'rare' ? '#F5C452' : '#f3e6be',
          color: r === 'legend' ? '#4a2c3a' : '#5e4510',
        }, `✦ ${RARITY_LABEL[r]}`)
        card.append(t)
        // 순위는 드문 쪽 20위 안일 때만 (중간쯤이면 숫자가 오히려 평범해 보임)
        if (rank && rank <= 20) line(`관심사 ${SUB_TOTAL}개 중 ${rank}번째로 드물어요`, { color: '#8a6a2a', fontSize: '11px', marginTop: '3px' })
      }
      const nb = neighborsWith(sub, o.ownerId ? [o.ownerId] : [])
      line(nb.n ? `${nb.where} 들판 이웃 중 ${nb.n}명도 좋아해요` : `${nb.where} 들판엔 아직 같은 관심사 이웃이 없어요`, { color: '#6e5444' })
      if (o.viewer && shared.has(sub)) {
        line(`♥ 나도 좋아하는 관심사예요`, { color: '#c4473a', fontWeight: '700' })
        line(`“${subName(sub)}” 이야기로 먼저 말 걸어 볼까요?`, { color: '#6e5444' })
      }
    } else {
      const mine = subsOfCat(o.interests, e.cat)
      if (mine.length) {
        line(o.viewer ? '이 땅굴 주인이 고른 관심사' : '내가 고른 관심사', { color: '#8a7262', fontSize: '11px' })
        const chips = el('div', { display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' })
        for (const id of mine) {
          const on = o.viewer && shared.has(id)
          chips.append(el('span', {
            padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: '600',
            background: on ? '#ffe1dc' : toRgba(e.color, .14), color: on ? '#b23a2e' : '#4a3428',
          }, `${on ? '♥ ' : ''}${subName(id)} ${(peopleCount(id) ?? 0).toLocaleString()}명`))
        }
        card.append(chips)
      }
    }
    if (action && !/준비 중/.test(action)) line(`누르면 · ${action}`, { color: '#9a4a2c', fontWeight: '600', fontSize: '11px' })
  }
  const placeCard = () => {
    if (!cardEm) return
    const p = proj(cardEm.top.x, cardEm.top.y + .12, cardEm.top.z)
    const w = card.offsetWidth || 220, h = card.offsetHeight || 90
    const x = Math.min(W - w / 2 - 8, Math.max(w / 2 + 8, p.x))
    const y = Math.max(h + 12, p.y)
    card.style.left = `${Math.round(x)}px`; card.style.top = `${Math.round(y)}px`
  }
  const showCard = (e: Em | null, action: string | null) => {
    if (!e) {
      if (cardEm) { cardEm = null; card.style.opacity = '0'; card.style.transform = 'translate(-50%, -100%) translateY(-6px) scale(.96)'; card.style.display = 'none' }
      return
    }
    const key = `${e.item.rowId}|${e.item.sub}|${action}`
    if (key !== cardKey) { cardKey = key; fillCard(e, action) }
    cardEm = e
    card.style.display = 'block'
    placeCard()
    card.style.opacity = '1'; card.style.transform = 'translate(-50%, -100%) translateY(-10px) scale(1)'
  }

  /* ---------- 관심사 한 줄 요약 (DOM, r_summary) ---------- */
  const items = summaryOf(o.interests, o.viewer)
  const nShared = items.filter((x) => x.shared).length
  /** 지금 불을 켠 관심사 (요약 줄에 마우스를 올림) */
  let focusSub: string | null = null
  let focusEl: HTMLElement | null = null
  let focusAt = 0
  const strip = el('div', {
    position: 'absolute', top: '12px', left: '50%', transform: 'translateX(-50%)', zIndex: '4', display: 'none', alignItems: 'center', gap: '4px',
    padding: '4px 5px 4px 6px', borderRadius: '999px', background: 'rgba(251,248,244,.94)', color: '#3e2a1f',
    boxShadow: '0 4px 14px rgba(60,35,20,.18), 0 1px 0 rgba(116,74,50,.12)', font: '600 12px/1 Pretendard, system-ui, sans-serif',
    whiteSpace: 'nowrap', maxWidth: 'calc(100% - 24px)', overflow: 'hidden', pointerEvents: 'auto',
  })
  strip.dataset.fxSummary = ''
  strip.setAttribute('role', 'group')
  strip.setAttribute('aria-label', o.viewer ? `이 땅굴의 관심사 ${items.length}개, 나와 겹치는 것 ${nShared}개` : `내 관심사 ${items.length}개`)
  const head = el('span', {
    display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '5px 9px', borderRadius: '999px', cursor: 'default',
    background: o.viewer && nShared ? '#FF8A7A' : '#7a5340', color: '#fffaf2', font: "400 13px/1 'Do Hyeon', Pretendard, sans-serif",
  }, o.viewer ? (nShared ? `♥ 나와 ${nShared}개 겹쳐요` : '처음 보는 취미 구경') : `내 관심사 ${items.length}개`)
  head.title = '이름표 다시 보기'
  strip.append(head)
  const MAX_ITEMS = 7
  for (const it of items.slice(0, MAX_ITEMS)) {
    const b = document.createElement('button')
    b.type = 'button'
    Object.assign(b.style, {
      display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px 2px 2px', borderRadius: '999px', border: '0', cursor: 'pointer',
      background: it.shared ? '#FFE3DD' : it.rarest ? '#FFF1C9' : toRgba(fxColor(it.cat), .12), color: it.shared ? '#a8352a' : '#4a3428',
      font: 'inherit', transition: 'transform .12s',
    } satisfies Partial<CSSStyleDeclaration>)
    const ic = iconCanvas(it.cat, 18)
    Object.assign(ic.style, { width: '20px', height: '20px' })
    b.append(ic, document.createTextNode(`${it.shared ? '♥ ' : it.rarest ? '✦ ' : ''}${subName(it.sub)}`))
    b.setAttribute('aria-label', `${subName(it.sub)}${it.shared ? ', 나도 좋아함' : ''}${it.rarest ? ', 이 방에서 가장 드묾' : ''}. 가구 위치 보기`)
    const on = () => { focusSub = it.sub; focusEl = b; focusAt = now(); b.style.transform = 'translateY(-1px)'; overlay.invalidate() }
    const off = () => { if (focusEl === b) { focusSub = null; focusEl = null; overlay.invalidate() } b.style.transform = '' }
    b.addEventListener('pointerenter', on); b.addEventListener('focus', on)
    b.addEventListener('pointerleave', off); b.addEventListener('blur', off)
    strip.append(b)
  }
  if (items.length > MAX_ITEMS) {
    const more = el('span', { padding: '0 6px 0 2px', color: '#8a7262', fontWeight: '700' }, `+${items.length - MAX_ITEMS}`)
    more.title = items.slice(MAX_ITEMS).map((x) => subName(x.sub)).join(', ')
    strip.append(more)
  }
  // 제목에 올리면 입장 이름표를 다시
  head.addEventListener('pointerenter', () => { rollAgain(true) })
  head.addEventListener('pointerleave', () => { rollAgain(false) })
  // 요약 줄 위 마우스가 장면(땅굴 클릭·카드)에 닿지 않게
  strip.addEventListener('pointerdown', (e) => e.stopPropagation())
  o.container.append(strip)
  let stripX = -1
  const placeStrip = (show: boolean) => {
    const want = show && fxOn('r_summary') && items.length > 0
    if (strip.style.display !== (want ? 'flex' : 'none')) strip.style.display = want ? 'flex' : 'none'
    if (!want) return
    // 돔 가운데(천장 구멍 아래) 위에 → 오른쪽 정보 패널을 열고 닫아도 따라감
    const cx = Math.round(proj(o.hole.x, o.hole.y, o.hole.z).x)
    if (Math.abs(cx - stripX) > 1) { stripX = cx; strip.style.left = `${cx}px` }
  }

  /* ---------- 입장 이름표 (r_rollcall) ---------- */
  const groups = rollcallOf(o.interests, o.viewer)
  /** 이름표가 뜨기 시작한 시각 · 사라지기 시작할 시각 (실제 초). start < 0 = 아직 */
  const roll = { start: -1, end: -1, done: false }
  const rollAgain = (on: boolean) => {
    if (!fxOn('r_rollcall') && !fxOn('r_summary')) return
    const t = now()
    if (on) {
      // 이미 다 떠 있으면 그대로, 아니면 다시 차례로
      const visible = roll.start >= 0 && t < roll.end
      if (!visible) roll.start = t
      roll.end = Infinity
    } else roll.end = t + 1.2
    overlay.invalidate()
    if (!on) later(1800)
  }
  const anchorOf = (cat: string) => ems.find((e) => e.cat === cat && e.kind === 'main') ?? ems.find((e) => e.cat === cat && e.kind !== 'none') ?? ems.find((e) => e.cat === cat)
  /** 정해진 시간 뒤 한 번 다시 그림 (움직임 없는 단계·쉬는 중에도 사라질 것이 사라지게) */
  const timers = new Set<number>()
  const later = (ms: number) => { const id = window.setTimeout(() => { timers.delete(id); overlay.refresh() }, ms); timers.add(id) }

  /* ---------- 누름 · 알아챔 · 인사 ---------- */
  const pops: Pop[] = []
  const popText = (e: Em) => (e.item.sub ? `${catName(e.cat)} · ${subName(e.item.sub)}` : rollcallText(groups.find((g) => g.cat === e.cat) ?? { cat: e.cat, subs: [], shared: 0 }).replace(/ · $/, ''))
  let greetFx: { t0: number; subs: string[]; line: string; shared: boolean } | null = null
  /** 누른 가구의 카드를 잠깐 물림 (r_poke) */
  let cardMute: { em: Em; until: number } | null = null
  let disposedFx = false
  let lastMe: THREE.Vector3 | null = null

  /* ---------- 그리기 ---------- */
  /** 움직임 없는 단계 (아주 느린 PC·움직임 줄이기, overlay.ts) — 겹 캔버스를 만든 뒤 정함 */
  let still = false
  /** 이번 프레임은 멈춘 모습 (still 단계 또는 가속 꺼짐에서 쉬는 중, overlay calm) */
  let quiet = false
  let introEnd = -1
  const draw = (f: OverlayFrame) => {
    const d0 = performance.now()
    drawFrame(f)
    cost('roomDraw', performance.now() - d0)
  }
  /** 이번 프레임에 놓은 배지·이름표 자리 (선반 소품끼리 붙어 있어 겹치면 위로 올림) */
  const taken: { x0: number; y0: number; x1: number; y1: number }[] = []
  const place = (w: number, h: number, cx: number, bottom: number) => {
    const x0 = Math.min(W - w - 6, Math.max(6, cx - w / 2))
    let y0 = bottom - h
    for (let k = 0; k < 5; k++) {
      const hit = taken.find((r) => x0 < r.x1 && x0 + w > r.x0 && y0 < r.y1 && y0 + h > r.y0)
      if (!hit) break
      y0 = hit.y0 - h - 1
    }
    taken.push({ x0, y0, x1: x0 + w, y1: y0 + h })
    return { x0, y0 }
  }
  const placeBadge = (ctx: CanvasRenderingContext2D, cv: HTMLCanvasElement, s: number, cx: number, bottom: number, alpha = 1, scale = 1) => {
    const w = cv.width / s, h = cv.height / s
    const p = place(w, h, cx, bottom)
    if (alpha <= 0) return p
    const a0 = ctx.globalAlpha
    ctx.globalAlpha = a0 * alpha
    if (scale !== 1) ctx.drawImage(cv, p.x0 + w / 2 - w * scale / 2, p.y0 + h - h * scale, w * scale, h * scale)
    else ctx.drawImage(cv, p.x0, p.y0, w, h)
    ctx.globalAlpha = a0
    return p
  }

  const drawFrame = ({ ctx, W: w, H: h, dt, t, calm }: OverlayFrame) => {
    W = w; H = h
    quiet = still || calm
    const rt = now()
    camera.getWorldPosition(camPos)
    if (o.intro()) { introEnd = -1; placeStrip(false); return }
    if (introEnd < 0) {
      introEnd = t
      // 입장 이름표: 입장 연출이 끝나고 조금 뒤
      // (움직임 없는 단계는 다음 그림이 언제 올지 몰라서 기다림 없이 바로, 한꺼번에)
      if (!roll.done && fxOn('r_rollcall')) { const d = still ? 0 : .35; roll.start = rt + d; roll.end = rt + d + groups.length * ROLL_GAP + ROLL_HOLD; roll.done = true; later((d + groups.length * ROLL_GAP + ROLL_HOLD + .7) * 1000) }
    }
    if (!measured || performance.now() - lastMeasure > 1000) measure()
    const fade = still ? 1 : Math.min(1, (t - introEnd) / .6)
    const s = overlay.mode.dpr
    placeStrip(true)
    // 화면 값
    camRight.setFromMatrixColumn(camera.matrixWorld, 0)
    for (const e of ems) {
      const p = proj(e.top.x, e.top.y, e.top.z)
      e.sx = p.x; e.sy = p.y; e.on = p.ok && p.x > -80 && p.x < W + 80 && p.y > -80 && p.y < H + 120
      const y1 = proj(e.top.x, e.top.y + .5, e.top.z).y
      e.ppm = Math.max(10, Math.abs(e.sy - y1) * 2)
      e.depth = dist(e.center.x, e.center.y, e.center.z)
    }
    updateActors()
    ctx.globalAlpha = fade
    if (fxOn('r_beam') && lead) drawBeam(ctx, t, dt)
    if (fxOn('r_shared') && o.viewer) for (const e of ems) if (e.shared && e.on) drawShareGlow(ctx, e, t)
    if (focusSub) drawFocusGlow(ctx, t, rt)
    if (fxOn('r_talk') && o.talk && hostA) drawTalk(ctx, t, s, true)
    if (fxOn('r_particles') || fxOn('r_poke') || fxOn('r_greet')) stepParticles(ctx, dt, t, fade)
    else ps.length = 0
    ctx.globalAlpha = fade
    // 이름표·배지 자리 잡기 순서: 불 켠 관심사(직접 고른 것) → 입장 이름표 → 배지. 겹치면 나중 것이 위로 비켜남
    taken.length = 0
    ctx.globalAlpha = 1
    if (focusSub) drawFocusTag(ctx, rt, s)
    const rv = rollVis(rt)
    if (rv > 0 && (fxOn('r_rollcall') || roll.end === Infinity)) drawRollcall(ctx, rt, s)
    // 입장 이름표가 떠 있는 동안 "나도 ○○"·"드문 취미" 배지는 물러남 (같은 말을 두 번 하지 않게, 2차)
    const gv = greetVis(rt)
    const ba = (1 - rv) * (1 - gv)
    ctx.globalAlpha = fade
    if (fxOn('r_rare')) for (const e of ems) if (e.rare && e.on) drawRare(ctx, e, t, s, ba)
    if (fxOn('r_shared') && o.viewer && ba > .02) for (const e of ems) if (e.shared && e.on) drawShareBadge(ctx, e, s, ba)
    ctx.globalAlpha = 1
    // 글자인 것 (늘 위): 알아챔 · 인사 · 대화 의향 이름표
    if (fxOn('r_notice') && !still && meA) checkNotice(rt)
    drawPops(ctx, rt, s)
    if (greetFx) drawGreet(ctx, rt, s)
    if (fxOn('r_talk') && o.talk && hostA && gv < .98) { ctx.globalAlpha = 1 - gv; drawTalk(ctx, t, s, false) }
    ctx.globalAlpha = 1
    if (cardEm) placeCard()
  }

  const drawBeam = (ctx: CanvasRenderingContext2D, t: number, dt: number) => {
    const col = fxColor(lead!.cat)
    const hx = o.hole.x, hy = o.hole.y, hz = o.hole.z
    const rt = .34, rb = 1.45
    const a = proj(hx - camRight.x * rt, hy, hz - camRight.z * rt), ax = a.x, ay = a.y
    const b = proj(hx + camRight.x * rt, hy, hz + camRight.z * rt), bx = b.x, by = b.y
    const c = proj(hx + camRight.x * rb, .02, hz + camRight.z * rb), cx = c.x, cy = c.y
    const d = proj(hx - camRight.x * rb, .02, hz - camRight.z * rb), dxp = d.x, dyp = d.y
    const top = (ay + by) / 2, bot = (cy + dyp) / 2
    ctx.save()
    // 밝은 땅굴 벽 위라 screen 으로 섞으면 거의 안 보임 → 대표 색을 얇게 그대로 (위가 진하고 아래로 사라짐)
    const g = ctx.createLinearGradient(0, top, 0, bot)
    g.addColorStop(0, toRgba(lighten(col, .2), .34)); g.addColorStop(.6, toRgba(col, .12)); g.addColorStop(1, toRgba(col, 0))
    ctx.fillStyle = g
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx, cy); ctx.lineTo(dxp, dyp); ctx.closePath(); ctx.fill()
    // 바닥에 닿는 빛 웅덩이
    const f = proj(hx, .02, hz), fx = f.x, fy = f.y
    const rx = Math.abs(cx - dxp) / 2
    const fz = proj(hx, .02, hz + rb).y
    const ry = Math.max(6, Math.abs(fz - fy))
    ctx.translate(fx, fy); ctx.scale(1, ry / rx)
    const pg = ctx.createRadialGradient(0, 0, 0, 0, 0, rx)
    pg.addColorStop(0, toRgba(col, .26)); pg.addColorStop(1, toRgba(col, 0))
    ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
    // 떠다니는 먼지 (움직일 때만)
    if (quiet) return
    const n = overlay.mode.level === 'full' ? 16 : 7
    const dot = glow(lighten(col, .6), 16, .2)
    for (let i = 0; i < n; i++) {
      const ph = i * 2.399
      const u = ((t * .045 + i / n) % 1)
      const yy = hy - .2 - u * (hy - .4)
      const rr = (rt + (rb - rt) * ((hy - yy) / hy)) * (.25 + .6 * ((Math.sin(ph * 3.1) + 1) / 2))
      const ang = ph + t * .15
      const wx = hx + Math.cos(ang) * rr, wy = yy + Math.sin(t * .8 + ph) * .05, wz = hz + Math.sin(ang) * rr * .6
      const pp = proj(wx, wy, wz), px = pp.x, py = pp.y
      if (hidden(px, py, dist(wx, wy, wz))) continue
      const tw = .45 + .55 * Math.sin(t * 2.2 + ph * 5)
      ctx.globalAlpha = Math.max(0, tw) * .8 * Math.sin(u * Math.PI)
      const sz = 5 + (i % 3) * 2
      ctx.drawImage(dot, px - sz / 2, py - sz / 2, sz, sz)
    }
    ctx.globalAlpha = 1
    void dt
  }

  const drawShareGlow = (ctx: CanvasRenderingContext2D, e: Em, t: number) => {
    const c = proj(e.center.x, e.center.y, e.center.z), cx = c.x, cy = c.y
    const r = Math.max(34, e.half * e.ppm * 1.7)
    const k = quiet ? .8 : .5 + .5 * Math.sin(t * 3 + e.center.x)
    const base = ctx.globalAlpha
    // 밝은 벽 위라 screen 으로 섞으면 거의 안 보임 → 따뜻한 산호색을 그대로 얇게 (숨 쉬듯)
    ctx.save()
    ctx.globalAlpha = (.3 + .2 * k) * base
    ctx.drawImage(glow('#FF8A6A', 64, .2), cx - r, cy - r * .8, r * 2, r * 1.6)
    ctx.restore()
    // 둘레를 도는 작은 하트 셋 (움직임 없는 단계는 둘, 제자리)
    const n = quiet ? 2 : 3
    const g = sticker('heart', SPRITE, SHARE, overlay.mode.dpr)
    for (let i = 0; i < n; i++) {
      const a = (quiet ? .8 : t * 1.3) + i * Math.PI * 2 / n
      const z = 10 + 2 * Math.sin(t * 4 + i)
      const hx = cx + Math.cos(a) * r * .85, hy = cy + Math.sin(a) * r * .38
      // 둘레의 뒤쪽 반(sin a < 0)은 가구 뒤 → 두더지에 가려질 수 있음
      if (hidden(hx, hy, e.depth + (Math.sin(a) < 0 ? .3 : -.3))) continue
      ctx.globalAlpha = (.75 + .25 * Math.sin(a)) * base
      const zz = stickerSize(z, SPRITE)
      ctx.drawImage(g, hx - zz / 2, hy - zz / 2, zz, zz)
    }
    ctx.globalAlpha = base
  }
  const drawShareBadge = (ctx: CanvasRenderingContext2D, e: Em, s: number, ba: number) => {
    placeBadge(ctx, pill(`나도 ${subName(e.item.sub!)}`, SHARE, 'heart', '#ffffff', s), s, e.sx, e.sy - 8, ba * (hidden(e.sx, e.sy - 18, e.depth) ? .35 : 1))
  }
  const drawRare = (ctx: CanvasRenderingContext2D, e: Em, t: number, s: number, ba: number) => {
    const legend = e.rare === 'legend'
    const cx = e.center.x, cz = e.center.z
    const R = e.half + .16
    for (let i = 0; i < 6; i++) {
      const a = (quiet ? 0 : t * .7) + i * Math.PI / 3
      const yy = e.center.y + (i % 2 ? .12 : -.05) + (quiet ? 0 : Math.sin(t * 1.6 + i) * .05)
      const wx = cx + Math.cos(a) * R, wz = cz + Math.sin(a) * R * .7
      const p = proj(wx, yy, wz), px = p.x, py = p.y
      if (hidden(px, py, dist(wx, yy, wz))) continue
      const tw = quiet ? .8 : .45 + .55 * Math.max(0, Math.sin(t * 3.4 + i * 1.9))
      const col = legend ? RAINBOW[(i * 2 + (quiet ? 0 : Math.floor(t * 4))) % 12] : i % 3 ? GOLD : '#FFF1B8'
      const sz = (10 + (i % 3) * 3) * tw
      if (sz < 1) continue
      const gl = sticker('star4', SPRITE, col, s)
      const zz = stickerSize(sz, SPRITE)
      ctx.drawImage(gl, px - zz / 2, py - zz / 2, zz, zz)
    }
    if (ba <= .02) return
    placeBadge(ctx, rarePill(e.item.sub ?? '', e.rare!, s), s, e.sx, e.sy - 8, ba * (hidden(e.sx, e.sy - 18, e.depth) ? .35 : 1))
  }
  const rarePill = (sub: string, r: Rarity, s: number) => {
    const name = subName(sub)
    const text = r === 'legend' ? `${name} · 아주 드문 취미` : r === 'rare' ? `${name} · 드문 취미` : `${name} · 이 방에서 제일 드묾`
    return pill(text, r === 'legend' ? '#A86FDB' : '#D49A1F', 'gem', '#ffffff', s)
  }
  const rollTag = (g: (typeof groups)[number], s: number) => tag({
    text: `${g.shared ? '♥ ' : ''}${rollcallText(g)}`, cat: g.cat, catColor: fxColor(g.cat), s, h: 24,
    bg: g.shared ? '#FFF0EC' : '#fffaf2', fg: g.shared ? '#a8352a' : '#3e2a1f', border: g.shared ? SHARE : undefined,
  })

  /* ---------- 요약 줄에서 불 켜기 ---------- */
  const focusTargets = () => {
    if (!focusSub) return []
    const exact = ems.filter((e) => e.item.sub === focusSub && e.kind !== 'none')
    if (exact.length) return exact
    const any = ems.filter((e) => e.item.sub === focusSub)
    if (any.length) return any
    const cat = items.find((x) => x.sub === focusSub)?.cat
    const m = cat ? anchorOf(cat) : undefined
    return m ? [m] : []
  }
  const drawFocusGlow = (ctx: CanvasRenderingContext2D, t: number, rt: number) => {
    for (const e of focusTargets()) {
      if (!e.on) continue
      const c = proj(e.center.x, e.center.y, e.center.z), cx = c.x, cy = c.y
      const r = Math.max(40, e.half * e.ppm * 1.9)
      const k = quiet ? 1 : .75 + .25 * Math.sin(t * 5)
      const u = clamp01((rt - focusAt) / .25)
      ctx.save()
      ctx.globalAlpha = .55 * k * u
      ctx.drawImage(glow('#FFE7A0', 64, .25), cx - r, cy - r * .85, r * 2, r * 1.7)
      ctx.globalAlpha = .9 * u
      ctx.strokeStyle = fxColor(e.cat); ctx.lineWidth = 2.5; ctx.setLineDash([6, 5]); ctx.lineDashOffset = quiet ? 0 : -t * 20
      ctx.beginPath(); ctx.ellipse(cx, cy, r * .78, r * .62, 0, 0, Math.PI * 2); ctx.stroke()
      ctx.restore()
    }
  }
  const drawFocusTag = (ctx: CanvasRenderingContext2D, rt: number, s: number) => {
    const targets = focusTargets()
    if (!targets.length || !focusEl) return
    const it = items.find((x) => x.sub === focusSub)
    if (!it) return
    const u = clamp01((rt - focusAt) / .22)
    const cr = o.container.getBoundingClientRect(), br = focusEl.getBoundingClientRect()
    const fromX = br.left + br.width / 2 - cr.left, fromY = br.bottom - cr.top + 2
    const e = targets[0]
    const n = peopleCount(it.sub)
    const text = `${it.shared ? '♥ ' : it.rarest ? '✦ ' : ''}${subName(it.sub)}${n != null ? ` · ${n.toLocaleString()}명` : ''}`
    const cv = tag({ text, cat: it.cat, catColor: fxColor(it.cat), s, h: 26, bg: '#fffaf2', border: fxColor(it.cat) })
    const w = cv.width / s, h = cv.height / s
    const p = place(w, h, e.sx, e.sy - 14)
    // 요약 줄 → 이름표 점선 (어디 있는지 이어 줌)
    ctx.save()
    ctx.globalAlpha = .75 * u
    ctx.strokeStyle = fxColor(it.cat); ctx.lineWidth = 2; ctx.setLineDash([2, 5]); ctx.lineCap = 'round'
    const tx = p.x0 + w / 2, ty = p.y0 + 2
    ctx.beginPath(); ctx.moveTo(fromX, fromY); ctx.bezierCurveTo(fromX, fromY + 60, tx, ty - 60, tx, ty); ctx.stroke()
    ctx.restore()
    const sc = still ? 1 : .7 + .3 * easeBack(u)
    ctx.globalAlpha = u
    ctx.drawImage(cv, p.x0 + w / 2 - (w * sc) / 2, p.y0 + h - h * sc, w * sc, h * sc)
    ctx.globalAlpha = 1
  }

  /* ---------- 입장 이름표 ---------- */
  /** 입장 이름표가 얼마나 보이는지 (0~1, 배지를 물리는 데 씀) */
  const rollVis = (rt: number) => {
    if (roll.start < 0 || rt < roll.start) return 0
    return Math.min(still ? 1 : clamp01((rt - roll.start) / .3), roll.end === Infinity ? 1 : clamp01((roll.end - rt) / .5))
  }
  const drawRollcall = (ctx: CanvasRenderingContext2D, rt: number, s: number) => {
    groups.forEach((g, i) => {
      const e = anchorOf(g.cat)
      if (!e || !e.on) return
      const tIn = still ? 1 : clamp01((rt - roll.start - i * ROLL_GAP) / .28)
      const tOut = roll.end === Infinity ? 1 : clamp01((roll.end - rt) / .5)
      const a = Math.min(tIn, tOut)
      const cv = rollTag(g, s)
      // 자리는 보이지 않아도 잡아 둠 (차례로 뜰 때 이미 뜬 것이 자리를 옮기지 않게)
      const p = placeBadge(ctx, cv, s, e.sx, e.sy - 10, a, still ? 1 : .6 + .4 * easeBack(tIn))
      // 겹쳐서 위로 비켜난 이름표는 가구까지 점선
      const bx = p.x0 + cv.width / s / 2, by = p.y0 + cv.height / s - 3
      if (a > .05 && e.sy - 10 - by > 14) {
        ctx.save(); ctx.globalAlpha = a * .7; ctx.strokeStyle = fxColor(g.cat); ctx.lineWidth = 1.6; ctx.setLineDash([2, 4]); ctx.lineCap = 'round'
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(e.sx, e.sy - 6); ctx.stroke(); ctx.restore()
      }
    })
  }

  /* ---------- 누름 · 알아챔 ---------- */
  const checkNotice = (rt: number) => {
    const me = meA!.obj.position
    const moved = !lastMe || Math.hypot(me.x - lastMe.x, me.z - lastMe.z) > .004
    lastMe = (lastMe ?? new THREE.Vector3()).copy(me)
    if (!moved) return
    for (const e of ems) {
      if (e.kind === 'none' || !e.on || rt - e.noticeAt < 12) continue
      if (Math.hypot(me.x - e.center.x, me.z - e.center.z) > e.half + .7) continue
      e.noticeAt = rt
      pops.push({ em: e, t0: rt, dur: 1.9, text: popText(e), bang: true })
      if (pops.length > 4) pops.shift()
    }
  }
  const drawPops = (ctx: CanvasRenderingContext2D, rt: number, s: number) => {
    for (let i = pops.length - 1; i >= 0; i--) {
      const p = pops[i]
      const u = (rt - p.t0) / p.dur
      if (u >= 1) { pops.splice(i, 1); continue }
      const tIn = still ? 1 : clamp01(u * p.dur / .22), tOut = clamp01((1 - u) * p.dur / .4)
      const a = Math.min(tIn, tOut)
      const e = p.em
      if (!e.on) continue
      if (!p.text) {
        // 누름: 가구 둘레로 퍼지는 고리 두 겹 (이름은 장면이 이미 말풍선으로 보여 줌)
        const c = proj(e.center.x, e.center.y, e.center.z), cx = c.x, cy = c.y
        const r0 = Math.max(26, e.half * e.ppm * 1.3)
        ctx.save(); ctx.strokeStyle = e.color
        for (let k = 0; k < 2; k++) {
          const uu = still ? .5 : clamp01(u * 1.6 - k * .25)
          if (uu <= 0 || uu >= 1) continue
          ctx.globalAlpha = (1 - uu) * .9; ctx.lineWidth = 3.5 * (1 - uu) + 1
          ctx.beginPath(); ctx.ellipse(cx, cy, r0 * (.7 + uu * .9), r0 * (.5 + uu * .6), 0, 0, Math.PI * 2); ctx.stroke()
        }
        ctx.restore()
        continue
      }
      const cv = tag({ text: p.text, cat: e.cat, catColor: e.color, s, h: 24, bg: '#fffaf2', border: e.color })
      placeBadge(ctx, cv, s, e.sx, e.sy - 10 - (still ? 0 : 8 * tIn), a, still ? 1 : .6 + .4 * easeBack(tIn))
      // 알아챔: 내 두더지 머리 위 "!"
      if (p.bang && meA) {
        const z = 26 * (still ? 1 : .5 + .5 * easeBack(tIn))
        const g = sticker('bang', 24, '#F2A93B', s), zz = stickerSize(z, 24)
        ctx.globalAlpha = a
        ctx.drawImage(g, meA.headX - zz / 2, meA.headY - 22 - zz / 2 - (still ? 0 : Math.sin(Math.min(1, u * 3) * Math.PI) * 6), zz, zz)
        ctx.globalAlpha = 1
      }
    }
  }

  /* ---------- 인사하면 겹치는 관심사 ---------- */
  const drawGreet = (ctx: CanvasRenderingContext2D, rt: number, s: number) => {
    const g = greetFx!
    const u = rt - g.t0, DUR = 3.6
    if (u > DUR || !meA || !hostA) { greetFx = null; return }
    const tOut = clamp01((DUR - u) / .5)
    // 두 두더지 머리 사이 위: 아래에 말 걸 한마디, 그 위 한 줄에 관심사 (인사 말풍선 👋 보다 위)
    const mx = (meA.headX + hostA.headX) / 2, lineBottom = Math.min(meA.headY, hostA.headY) - 46
    const line = g.line ? tag({ text: g.line, bg: '#5a3a2a', fg: '#fff8ee', icon: g.shared ? 'heart' : 'star4', iconColor: g.shared ? '#FF9C8C' : GOLD, s, h: 26 }) : null
    const lh = line ? line.height / s : 0
    const cvs = g.subs.map((sub) => {
      const cat = items.find((x) => x.sub === sub)?.cat ?? ''
      return tag({ text: `${g.shared ? '♥ ' : '✦ '}${subName(sub)}`, cat, catColor: fxColor(cat), s, h: 28, bg: g.shared ? '#FFF0EC' : '#FFF6DA', fg: g.shared ? '#a8352a' : '#6b4a0e', border: g.shared ? SHARE : GOLD })
    })
    const gap = 6, total = cvs.reduce((a, c) => a + c.width / s, 0) + gap * (cvs.length - 1)
    let x0 = Math.min(W - total - 8, Math.max(8, mx - total / 2))
    const rowBottom = lineBottom - lh - 4
    cvs.forEach((cv, i) => {
      const tIn = still ? 1 : clamp01((u - i * .12) / .45)
      const e = easeBack(tIn)
      const w = cv.width / s, h = cv.height / s
      // 두 머리 사이에서 튀어나와 제자리로
      const tx = x0 + w / 2, x = mx + (tx - mx) * e
      const y = lineBottom + (rowBottom - lineBottom) * e + (still ? 0 : Math.sin(u * 3 + i) * 2)
      ctx.globalAlpha = Math.min(tIn, tOut)
      ctx.drawImage(cv, x - w / 2 * (.6 + .4 * e), y - h * (.6 + .4 * e), w * (.6 + .4 * e), h * (.6 + .4 * e))
      x0 += w + gap
    })
    // 말 걸 한마디
    const tl = still ? 1 : clamp01((u - .5) / .35)
    if (line) {
      const w = line.width / s
      ctx.globalAlpha = Math.min(tl, tOut)
      ctx.drawImage(line, Math.min(W - w - 8, Math.max(8, mx - w / 2)), lineBottom - lh, w, lh)
    }
    ctx.globalAlpha = 1
  }
  /** 인사 이펙트가 얼마나 보이는지 (0~1, 그동안 배지·대화 의향 이름표를 물림) */
  const greetVis = (rt: number) => {
    if (!greetFx) return 0
    const u = rt - greetFx.t0
    return Math.min(clamp01(u / .3), clamp01((3.6 - u) / .5))
  }

  /* ---------- 집주인 대화 의향 (반딧불 · 달) ---------- */
  const drawTalk = (ctx: CanvasRenderingContext2D, t: number, s: number, under: boolean) => {
    const a = hostA!
    const p = a.obj.position
    const open = o.talk === 'open'
    if (under) {
      if (!open) return
      // 반딧불: 집주인 둘레를 천천히 도는 작은 빛 (뒤쪽 반은 두더지에 가려짐)
      const n = quiet ? 4 : 7
      for (let i = 0; i < n; i++) {
        const ang = (quiet ? i * 1.6 : t * .45 + i * .9) + i
        const r = .62 + .18 * Math.sin((quiet ? 0 : t * .7) + i * 2.1)
        const y = .35 + ((i * .37 + (quiet ? 0 : t * .06)) % 1) * (a.h * .95)
        const wx = p.x + Math.cos(ang) * r, wz = p.z + Math.sin(ang) * r * .7
        const sp = proj(wx, p.y + y, wz), x = sp.x, yy = sp.y
        if (hidden(x, yy, dist(wx, p.y + y, wz))) continue
        const fl = quiet ? .8 : .45 + .55 * Math.max(0, Math.sin(t * 2.4 + i * 1.7))
        const z = 14 + 8 * fl
        ctx.globalAlpha = .9 * fl
        ctx.drawImage(glow('#E9FF7A', 32, .3), x - z / 2, yy - z / 2, z, z)
        ctx.globalAlpha = 1
        ctx.fillStyle = '#FBFFD8'; ctx.beginPath(); ctx.arc(x, yy, 1.8, 0, Math.PI * 2); ctx.fill()
      }
      return
    }
    // 이름표: 집주인 머리 오른쪽 (머리 위는 장면의 "대화 요청하기" 말풍선 자리)
    const cv = tag({ text: TALK_LABEL[o.talk!], icon: open ? 'star4' : 'moon', iconColor: open ? '#FBFFC4' : '#FFF3C4', bg: open ? '#4E9A3A' : '#7E6CB8', fg: '#ffffff', s, h: 22 })
    const w = cv.width / s, h = cv.height / s
    const x = Math.min(W - w - 6, a.headX + a.rx * .55 + 4), y = a.headY + a.ry * .35
    const a0 = ctx.globalAlpha
    ctx.globalAlpha = .96 * a0
    ctx.drawImage(cv, x, y - h / 2, w, h)
    ctx.globalAlpha = a0
  }

  /* ---------- 입자 ---------- */
  const stepParticles = (ctx: CanvasRenderingContext2D, dt: number, t: number, fade: number) => {
    const s = overlay.mode.dpr
    if (still) {
      // 움직임 없이: 주 가구 위에 작은 관심사 배지, 동물 곁에 발자국 하나
      if (!fxOn('r_particles')) return
      for (const e of ems) {
        if (!e.on) continue
        if (e.kind === 'main') {
          const b = badge(e.cat, 20, e.color, s)
          ctx.drawImage(b, e.sx - b.width / s / 2, e.sy - 8 - b.height / s, b.width / s, b.height / s)
        } else if (e.kind === 'pet') {
          const p = proj(e.center.x + e.half + .25, .02, e.center.z + .1)
          const g = glyph('pet', SPRITE, e.color, s)
          ctx.save(); ctx.globalAlpha = .55 * fade; ctx.translate(p.x, p.y); ctx.scale(1, .55); ctx.drawImage(g, -8, -8, 16, 16); ctx.restore()
        }
      }
      return
    }
    const lite = overlay.mode.level === 'lite'
    const cap = overlay.mode.maxParticles
    if (fxOn('r_particles')) {
      for (const e of ems) {
        if (!e.on || quiet) continue // 쉬는 중엔 새 입자 없음 (남은 것은 아래에서 마저 움직이고 사라짐)
        if (e.kind === 'pet') {
          e.acc += dt
          if (e.acc > PET_STEP && ps.length < cap) { e.acc = 0; pawStep(e) }
          continue
        }
        if (e.kind === 'none' || (lite && e.kind === 'prop')) continue
        const rate = e.kind === 'main' ? RATE_MAIN : RATE_PROP
        e.acc += dt * rate
        while (e.acc >= 1) { e.acc -= 1; if (ps.length < cap) spawn(e, e.kind === 'prop') }
        // 사진: 가끔 큰 플래시
        if (styleOf(e.cat) === 'flash' && e.kind === 'main') {
          e.flashAt -= dt
          if (e.flashAt <= 0 && ps.length < cap) {
            e.flashAt = 3 + Math.random() * 3
            ps.push({ em: e, kind: 'bigflash', x: e.center.x, y: e.top.y - .15, z: e.center.z + .1, vx: 0, vy: 0, vz: 0, age: 0, life: .4, size: .9, rot: 0, vr: 0, color: '#ffffff', seed: 0 })
          }
        }
      }
    }
    // 나와 같은 관심사: 하트
    if (fxOn('r_particles') && fxOn('r_shared') && o.viewer && !lite && !quiet) {
      for (const e of ems) {
        if (!e.shared || !e.on) continue
        e.heartAcc += dt * HEART_RATE
        if (e.heartAcc >= 1 && ps.length < cap) {
          e.heartAcc = 0
          ps.push({ em: e, kind: 'heart', x: e.top.x + (Math.random() - .5) * e.half, y: e.top.y, z: e.top.z, vx: (Math.random() - .5) * .08, vy: .3, vz: 0, age: 0, life: 1.8, size: .11, rot: 0, vr: 0, color: SHARE, seed: Math.random() * 6 })
        }
      }
    }
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i]
      p.age += dt
      if (p.age >= p.life) { ps.splice(i, 1); continue }
      if (p.kind === 'popcorn' || p.kind === 'paint') p.vy -= (p.kind === 'paint' ? 1.6 : 2.4) * dt
      else if (p.kind === 'ball') {
        p.vy -= 2.6 * dt
        // 가구 윗면에 닿으면 한 번 튐 (누르면 터진 공은 그대로 떨어짐)
        if (!p.burst && p.vy < 0 && p.y < p.em.top.y + .02 && p.age > .2) { p.y = p.em.top.y + .02; p.vy = -p.vy * .55; p.vx *= .7 }
      } else if (p.burst) { p.vy -= 1.7 * dt; p.vx *= 1 - dt * .8; p.vz *= 1 - dt * .8 }
      if (p.kind !== 'paw') { p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt }
      p.rot += p.vr * dt
      drawParticle(ctx, p, t, fade, s)
    }
  }

  const drawParticle = (ctx: CanvasRenderingContext2D, p: P, t: number, fade: number, s: number) => {
    const u = p.age / p.life
    let a = Math.min(1, u / .15) * (u > .6 ? 1 - (u - .6) / .4 : 1)
    if (p.burst) a = Math.min(1, u / .05) * (u > .7 ? 1 - (u - .7) / .3 : 1)
    const sway = Math.sin(p.age * 2.6 + p.seed) * .05
    const y = p.kind === 'pixel' ? Math.round(p.y / .05) * .05 : p.y
    const wx = p.x + (p.kind === 'note' || p.kind === 'leaf' || p.kind === 'page' || p.kind === 'heart' || p.kind === 'talk' || p.kind === 'star5' ? sway : 0)
    const sp = proj(wx, y, p.z)
    if (!sp.ok) return
    const x = sp.x, yy = sp.y
    // 두더지 뒤에 있으면 그리지 않음 (발자국은 바닥이라 두더지 발밑만)
    if (actorList.length && hidden(x, yy, dist(wx, y, p.z))) return
    const px = p.size * p.em.ppm
    ctx.globalAlpha = a * fade
    switch (p.kind) {
      case 'note': case 'leaf': case 'heart': case 'talk': case 'ball': {
        // 흰 테두리 스티커 (2차): 연보라 음표·연두 잎이 밝은 흙벽 위에서 묻히던 것
        const g = sticker(STICKER_OF[p.kind] ?? p.kind, SPRITE, p.color, s)
        const z = stickerSize(px, SPRITE)
        ctx.save(); ctx.translate(x, yy); ctx.rotate(p.rot + (p.kind === 'heart' ? sway * 2 : 0)); ctx.drawImage(g, -z / 2, -z / 2, z, z); ctx.restore()
        break
      }
      case 'star5': {
        // 덕질·수집: 돌면서 살짝 반짝 (크기가 숨 쉬듯)
        const g = sticker('fandom_collect', SPRITE, p.color, s)
        const z = stickerSize(px, SPRITE) * (.85 + .15 * Math.sin(p.age * 7 + p.seed))
        ctx.save(); ctx.translate(x, yy); ctx.rotate(p.rot); ctx.drawImage(g, -z / 2, -z / 2, z, z); ctx.restore()
        break
      }
      case 'flash': case 'star': {
        const tw = p.kind === 'flash' ? Math.sin(u * Math.PI) : .55 + .45 * Math.sin(p.age * 9 + p.seed)
        const z = px * tw
        const g = glyph('star4', SPRITE, p.color, s)
        ctx.drawImage(g, x - z / 2, yy - z / 2, z, z)
        break
      }
      case 'bigflash': {
        const k = Math.sin(u * Math.PI)
        ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = k * .85 * fade
        const r = px * (.6 + u * .6)
        ctx.drawImage(glow('#ffffff', 64, .15), x - r, yy - r, r * 2, r * 2)
        const g = glyph('star4', SPRITE, '#ffffff', s)
        ctx.drawImage(g, x - r * .45, yy - r * .45, r * .9, r * .9)
        ctx.restore()
        break
      }
      case 'pixel': {
        // 끝 무렵 깜빡임
        if (u > .7 && Math.floor(p.age * 14) % 2) break
        const z = Math.max(3, Math.round(px))
        ctx.fillStyle = 'rgba(60,35,20,.35)'
        ctx.fillRect(Math.round(x - z / 2) + 1, Math.round(yy - z / 2) + 1, z, z)
        ctx.fillStyle = p.color
        ctx.fillRect(Math.round(x - z / 2), Math.round(yy - z / 2), z, z)
        break
      }
      case 'paint': {
        const z = px * (u > .85 ? 1 + (u - .85) * 4 : 1)
        ctx.fillStyle = p.color
        ctx.beginPath(); ctx.ellipse(x, yy, z / 2, z / 2 * 1.12, 0, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = 'rgba(255,255,255,.7)'
        ctx.beginPath(); ctx.arc(x - z * .15, yy - z * .18, z * .14, 0, Math.PI * 2); ctx.fill()
        break
      }
      case 'page': {
        const g = sticker('page', SPRITE, p.color, s)
        const fx = Math.cos(p.age * 5 + p.seed)
        const z = stickerSize(px, SPRITE)
        ctx.save(); ctx.translate(x, yy); ctx.rotate(p.rot); ctx.scale(Math.abs(fx) < .12 ? .12 : fx, 1)
        ctx.drawImage(g, -z / 2, -z * .62, z, z * 1.24)
        ctx.restore()
        break
      }
      case 'steam': {
        const z = px * (1 + u * 1.8)
        ctx.globalAlpha = a * .38 * fade
        const g = glow('#ffffff', 64, .2)
        const wob = Math.sin(p.age * 2.2 + p.seed) * px * .4
        ctx.drawImage(g, x - z / 2 + wob, yy - z / 2, z, z)
        break
      }
      case 'ember': {
        const fl = .6 + .4 * Math.sin(p.age * 22 + p.seed * 3)
        const z = px * 2.4 * fl
        ctx.save(); ctx.globalCompositeOperation = 'lighter'
        ctx.drawImage(glow(p.color, 32, .35), x - z / 2, yy - z / 2, z, z)
        ctx.restore()
        break
      }
      case 'popcorn': {
        const g = sticker('popcorn', SPRITE, p.color, s)
        const z = stickerSize(px, SPRITE)
        ctx.save(); ctx.translate(x, yy); ctx.rotate(p.rot); ctx.drawImage(g, -z / 2, -z / 2, z, z); ctx.restore()
        break
      }
      case 'paw': {
        // 바닥에 찍힘: 진행 방향으로 돌리고 원근만큼 납작하게
        const ahead = proj(p.x + p.vx * .1, p.y, p.z + p.vz * .1)
        const ang = Math.atan2(ahead.y - yy, ahead.x - x) + Math.PI / 2
        a = u < .1 ? u / .1 : 1 - Math.max(0, (u - .45) / .55)
        ctx.globalAlpha = a * .75 * fade
        const g = glyph('pet', SPRITE, p.color, s)
        ctx.save(); ctx.translate(x, yy); ctx.scale(1, .55); ctx.rotate(ang); ctx.drawImage(g, -px / 2, -px / 2, px, px); ctx.restore()
        break
      }
    }
    void t
  }

  const anyTimed = () => roll.start >= 0 && now() < roll.end + .6 && (fxOn('r_rollcall') || roll.end === Infinity)
  const overlay = createOverlay(o.container, o.after, camera, draw, (calm) =>
    !o.intro() && (ps.length > 0 || pops.length > 0 || !!greetFx || anyTimed() || (!!focusSub && !calm)
      || (!calm && (fxOn('r_particles') || fxOn('r_rare') || (fxOn('r_shared') && !!o.viewer) || fxOn('r_beam') || (fxOn('r_talk') && !!o.talk) || fxOn('r_notice')))))
  still = overlay.mode.level === 'still'
  /*
   * 그림 미리 만들기 (2차): 이름표·배지·스티커는 처음 쓸 때 캔버스에 그려 두는데, 입장 이름표가 뜨는 순간 한꺼번에 만들면
   * 가속 꺼진 PC 에서 겹 캔버스 한 프레임이 32ms 까지 걸렸음 (그림자 흐림이 CPU 로 그려짐) → 입장 연출 동안 쉬는 틈에 하나씩
   */
  {
    const s0 = overlay.mode.dpr
    const warm: (() => void)[] = []
    for (const g of groups) warm.push(() => rollTag(g, s0))
    if (o.viewer) for (const id of shared) warm.push(() => pill(`나도 ${subName(id)}`, SHARE, 'heart', '#ffffff', s0))
    if (rarest) warm.push(() => rarePill(rarest.id, rarest.rarity, s0))
    if (o.talk) warm.push(() => tag({ text: TALK_LABEL[o.talk!], icon: o.talk === 'open' ? 'star4' : 'moon', iconColor: o.talk === 'open' ? '#FBFFC4' : '#FFF3C4', bg: o.talk === 'open' ? '#4E9A3A' : '#7E6CB8', fg: '#ffffff', s: s0, h: 22 }), () => glow('#E9FF7A', 32, .3))
    if (o.viewer) warm.push(() => glow('#FF8A6A', 64, .2))
    const cats = new Set(groups.map((g) => g.cat))
    if (!still) {
      for (const cat of cats) {
        const c = fxColor(cat)
        switch (styleOf(cat)) {
          case 'note': warm.push(() => sticker('note', SPRITE, c, s0), () => sticker('note', SPRITE, lighten(c, .3), s0)); break
          case 'talk': warm.push(() => sticker('language_selfdev', SPRITE, c, s0), () => sticker('language_selfdev', SPRITE, lighten(c, .35), s0)); break
          case 'leaf': for (const x of PAL.leaf) warm.push(() => sticker('nature', SPRITE, x, s0)); break
          case 'popcorn': for (const x of PAL.popcorn) warm.push(() => sticker('popcorn', SPRITE, x, s0)); break
          case 'ball': for (const x of PAL.ball) warm.push(() => sticker('sports', SPRITE, x, s0)); break
          case 'star5': for (const x of PAL.star5) warm.push(() => sticker('fandom_collect', SPRITE, x, s0)); break
          case 'page': warm.push(() => sticker('page', SPRITE, '#fffaf0', s0)); break
        }
      }
      if (o.viewer) warm.push(() => sticker('heart', SPRITE, SHARE, s0))
      if (rarest) for (const c of rarest.rarity === 'legend' ? RAINBOW : [GOLD, '#FFF1B8']) warm.push(() => sticker('star4', SPRITE, c, s0))
    }
    const idle = (f: () => void) => (window.requestIdleCallback ? window.requestIdleCallback(f, { timeout: 600 }) : window.setTimeout(f, 30))
    const step = () => { if (disposedFx) return; const f = warm.shift(); if (!f) return; const t0 = performance.now(); f(); cost('warm', performance.now() - t0); idle(step) }
    idle(step)
  }
  // 입장 연출이 끝나는 순간 다시 그림 (움직임 없는 단계는 카메라가 그대로면 스스로 다시 그리지 않아서, 연출 중에 비워 둔 그림이 그대로 남았음)
  let introWas = o.intro()
  const introPoll = window.setInterval(() => {
    const n = o.intro()
    if (introWas && !n) overlay.invalidate()
    introWas = n
    if (!n) clearInterval(introPoll)
  }, 150)
  const unsub = subscribeFx(() => { overlay.invalidate(); if (!fxOn('r_card')) showCard(null, null); placeStrip(!o.intro()) })

  const emOf = (g: THREE.Object3D | null) => {
    if (!g) return undefined
    if (!measured) measure()
    return ems.find((x) => x.item.g === g)
  }
  return {
    hover(g, action) {
      if (!g || !fxOn('r_card') || o.intro()) { showCard(null, null); return false }
      const e = emOf(g)
      if (!e) { showCard(null, null); return false }
      if (cardMute && cardMute.em === e && now() < cardMute.until) return false
      cardMute = null
      showCard(e, action)
      overlay.invalidate()
      return true
    },
    poke(g) {
      if (!fxOn('r_poke') || o.intro()) return
      const e = emOf(g)
      if (!e) return
      const lv = overlay.mode.level
      if (lv !== 'still') burst(e, lv === 'full' ? 14 : 7)
      const rt = now()
      // 같은 가구 고리는 하나만. 이름은 장면이 누른 자리에 말풍선으로 이미 보여 줘서 여기선 고리만
      for (let i = pops.length - 1; i >= 0; i--) if (pops[i].em === e && !pops[i].text) pops.splice(i, 1)
      pops.push({ em: e, t0: rt, dur: 1.1, text: '', bang: false })
      // 카드가 터지는 입자를 가리지 않게 잠깐 물림 (마우스를 다른 가구로 옮기면 바로 다시)
      cardMute = { em: e, until: rt + 1.6 }
      showCard(null, null)
      overlay.invalidate()
      later(1300)
    },
    greet() {
      if (!fxOn('r_greet') || !o.viewer) return
      const tp = greetTopicsOf(o.interests, o.viewer)
      if (!tp.subs.length) return
      greetFx = { t0: now(), subs: tp.subs, line: greetLine(tp), shared: tp.shared }
      // 겹치면 두 두더지 사이로 하트 몇 개
      if (tp.shared && overlay.mode.level !== 'still') {
        updateActors()
        const a = o.actors?.()
        if (a?.me && a.host) {
          const m = a.me.position.clone().add(a.host.position).multiplyScalar(.5)
          const fake = { cat: '__heart', top: new THREE.Vector3(m.x, 1.05, m.z), center: new THREE.Vector3(m.x, .9, m.z), half: .3, color: SHARE, ppm: 120 } as unknown as Em
          const ref = ems[0]
          if (ref) { fake.ppm = ref.ppm; burst(fake, overlay.mode.level === 'full' ? 8 : 4) }
        }
      }
      overlay.invalidate()
      later(3800)
    },
    dispose() {
      disposedFx = true
      unsub()
      clearInterval(introPoll)
      timers.forEach((id) => clearTimeout(id)); timers.clear()
      overlay.dispose()
      card.remove()
      strip.remove()
      ps.length = 0; pops.length = 0
    },
  }
}
