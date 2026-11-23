import { lazy, Suspense, useState } from 'react'
import SceneBoundary from '../../components/SceneBoundary'
import Avatar from '../../components/Avatar'
import { testParam } from '../../lib/testParam'
import s from './TeaRoom.module.css'

const ChatRoomCanvas = lazy(() => import('../../three/ChatRoomCanvas'))

/**
 * 찻방 (Figma 02 F6 ①): 모든 대화가 같이 쓰는 채팅 전용 방. 3D 방 가운데 원탁에 두더지들이 방석을 깔고 둘러앉음 (채팅방 3D v1, docs/chat-room-3d.md).
 * - 1:1 → 2마리, 모임 → 참여자 수만큼 (최대 6자리: "나" + 최근에 말한 5명, 못 앉은 사람은 "+N" 배지), 대화 선택 전 → 나 혼자 앉고 맞은편은 빈자리 표시
 * - 두더지·이름표를 누르면 프로필 팝업 (나·탈퇴한 사용자는 제외). 메시지를 보내면 그 두더지가 손짓(sit_talk)
 * - 3D 가 준비되기 전·WebGL 을 못 쓸 때는 예전 2D 찻방 그림(밑그림 + 2D 두더지)을 그대로 보여 줌
 */
export interface TeaGuest { id: string; name: string; worn: string[]; me?: boolean; gone?: boolean }

const MAX = 5
// 2D 대체 그림 자리: [x, y, 키, 방향, 깊이]. 0 = 나 (앞 왼쪽)
const DUO: [number, number, number, number, number][] = [[0.22, 0.88, 0.22, 0.55, 0], [0.78, 0.88, 0.22, -0.55, 0]]
const GROUP: [number, number, number, number, number][] = [
  [0.2, 0.9, 0.21, 0.5, 0], [0.8, 0.9, 0.21, -0.5, 0],
  [0.3, 0.68, 0.17, 0.3, 1], [0.7, 0.68, 0.17, -0.3, 1], [0.5, 0.63, 0.15, 0, 2],
]

const MOCK_NAMES = ['하린', '서벅이', '민구', '하늘', '서연', '지후', '도윤', '다온']
const MOCK_WORN = [['hat_beret', 'prop_cup'], ['glasses_round', 'prop_balloon'], ['headphones', 'prop_book'], ['hat_sprout', 'prop_lightstick'], ['hat_mortarboard'], ['scarf_knit', 'prop_gamepad']]

export default function TeaRoom({ guests: given, mode, greet, spoke, roomKey, onPick, onMore }: {
  guests: TeaGuest[]
  mode: 'empty' | 'dm' | 'group'
  /** 메시지를 보낸(받은) 사람: n 이 바뀔 때마다 그 두더지가 말함 */
  greet?: { id: string; n: number }
  /** 사용자별 마지막으로 말한 시각 (ms) — 6명 초과일 때 누가 앉을지 */
  spoke?: Record<string, number>
  /** 대화방이 바뀌면 3D 방을 새로 만듦 */
  roomKey?: string
  onPick?: (id: string) => void
  /** "+N" 배지를 누름 (참여자 목록 열기) */
  onMore?: () => void
}) {
  let guests = given
  const [ready, setReady] = useState(false)
  const [overflow, setOverflow] = useState(0)
  // 시험 손잡이 ?mockguests=N : 참여자를 N명이 될 때까지 가짜로 채움 (인원별 자리 · 6명 초과 확인용, 손 소품을 든 두더지 포함)
  const fill = +(testParam('mockguests') ?? 0)
  if (fill > guests.length) guests = [...guests, ...Array.from({ length: fill - guests.length }, (_, i) => ({ id: `mock${i}`, name: MOCK_NAMES[i % MOCK_NAMES.length], worn: MOCK_WORN[i % MOCK_WORN.length] }))]
  const layout = mode === 'group' ? GROUP : DUO
  const shown = guests.slice(0, Math.min(MAX, layout.length))
  const extra = guests.length - shown.length
  const seats = shown.map((g, i) => ({ g, st: layout[i] }))
  return (
    <section className={s.wrap} aria-label={mode === 'empty' ? '찻방. 아직 고른 대화가 없어 내 두더지만 앉아 있어요' : `찻방. ${guests.map((g) => g.name).join(', ')}`}>
      {/* 2D 대체 그림 (3D 가 준비되면 숨김) */}
      <div className={ready ? s.boxHidden : s.box}>
        <RoomArt />
        {mode === 'empty' && <span className={s.emptySeat} style={{ left: '78%', top: '88%' }} aria-hidden />}
        {seats.map(({ g, st: [x, y, h] }) => (
          <span key={`ph-${g.id}`} className={s.placeholder} style={{ left: `${x * 100}%`, top: `${y * 100}%`, height: `${h * 100}%` }} aria-hidden>
            <Avatar size={64} />
          </span>
        ))}
        {shown.map((g, i) => {
          const [x, y, h] = layout[i]
          return <span key={g.id} className={s.hit2d} style={{ left: `${x * 100}%`, top: `${y * 100}%`, height: `${(h + 0.06) * 100}%` }}><span className={g.me ? s.tagMe : s.tag}>{g.me ? '나' : g.name}</span></span>
        })}
        {extra > 0 && <span className={s.more}>+{extra}명</span>}
      </div>
      <SceneBoundary>
        <Suspense fallback={null}>
          <ChatRoomCanvas roomKey={roomKey ?? mode} members={guests} spoke={spoke ?? {}} speak={greet} className={s.canvas}
            ui={{ tag: s.tag3d, tagMe: s.tag3dMe, tagBtn: s.tag3dBtn }}
            onPick={(id) => onPick?.(id)} onOverflow={setOverflow} onReady={() => setReady(true)} />
        </Suspense>
      </SceneBoundary>
      {ready && overflow > 0 && (
        <button type="button" className={s.moreBtn} onClick={onMore} aria-label={`참여자 ${overflow}명이 더 있어요. 참여자 목록 보기`}>+{overflow}</button>
      )}
    </section>
  )
}

/** 찻방 그림 (480×660). 명세 밑그림: 창문 · 펜던트 전등 · 선반 · 벽 아래 띠 · 바닥 · 러그 · 찻상 · 찻주전자 · 찻잔 */
function RoomArt() {
  return (
    <svg className={s.art} viewBox="0 0 480 660" preserveAspectRatio="none" aria-hidden>
      <rect width="480" height="440" fill="#f8ecdc" />
      <rect y="440" width="480" height="220" fill="#e4c39c" />
      <rect y="432" width="480" height="12" rx="2" fill="#b98a5e" />
      {/* 창문 */}
      <rect x="52" y="76" width="158" height="138" rx="10" fill="#a56f45" />
      <rect x="62" y="86" width="138" height="118" rx="5" fill="#cfe6ee" />
      <rect x="128" y="86" width="6" height="118" fill="#a56f45" />
      <rect x="62" y="142" width="138" height="6" fill="#a56f45" />
      <path d="M72 96 l30 0 l-18 30z" fill="#e6f3f6" opacity=".8" />
      {/* 전등 */}
      <rect x="238.5" y="0" width="3" height="78" fill="#8b5e3c" />
      <path d="M198 116 a42 40 0 0 1 84 0z" fill="#f2c56b" />
      <ellipse cx="240" cy="118" rx="22" ry="5" fill="#fff4cf" opacity=".9" />
      {/* 선반 */}
      <rect x="306" y="120" width="124" height="10" rx="3" fill="#a87447" />
      <rect x="318" y="84" width="20" height="36" rx="5" fill="#e9a77c" />
      <rect x="344" y="94" width="14" height="26" rx="4" fill="#9cc7a3" />
      <circle cx="390" cy="104" r="16" fill="#f2c56b" />
      {/* 러그 */}
      <ellipse cx="240" cy="560" rx="214" ry="72" fill="#f2c5a6" />
      <ellipse cx="240" cy="560" rx="186" ry="56" fill="#f6d4ba" />
      {/* 찻상 */}
      <rect x="226" y="482" width="28" height="74" fill="#a8774d" />
      <ellipse cx="240" cy="560" rx="50" ry="12" fill="#9a6a42" />
      <ellipse cx="240" cy="482" rx="98" ry="24" fill="#c9915f" />
      <ellipse cx="240" cy="476" rx="98" ry="24" fill="#deac7a" />
      {/* 찻주전자 · 찻잔 */}
      <ellipse cx="240" cy="458" rx="26" ry="20" fill="#fbf6ee" />
      <circle cx="240" cy="436" r="5" fill="#fbf6ee" />
      <path d="M214 452 q-14 -6 -16 6" stroke="#3d2a1f" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M264 448 q14 -10 22 0" stroke="#fbf6ee" strokeWidth="6" fill="none" strokeLinecap="round" />
      <path d="M186 470 h22 v6 a11 7 0 0 1 -22 0z" fill="#fbf6ee" stroke="#3d2a1f" strokeWidth="2.5" />
      <path d="M272 470 h22 v6 a11 7 0 0 1 -22 0z" fill="#fbf6ee" stroke="#3d2a1f" strokeWidth="2.5" />
      <path d="M190 452 q4 -8 0 -14 M200 452 q4 -8 0 -14 M276 452 q4 -8 0 -14 M286 452 q4 -8 0 -14" stroke="#d6c3b0" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  )
}
