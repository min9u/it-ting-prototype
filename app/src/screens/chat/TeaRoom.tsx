import { lazy, Suspense, useState } from 'react'
import Avatar from '../../components/Avatar'
import type { TeaSeat } from '../../three/TeaRoomCanvas'
import s from './TeaRoom.module.css'

const TeaRoomCanvas = lazy(() => import('../../three/TeaRoomCanvas'))

/**
 * 찻방 (Figma 02 F6 ①): 모든 대화가 같이 쓰는 채팅 전용 방. 찻상에 두더지들이 둘러앉음.
 * - 1:1: 나와 상대가 마주 봄 / 모임: 참여자들이 둘러앉음 (5마리까지 그리고 나머지는 "+N") / 대화 선택 전: 나 혼자, 맞은편 자리는 비어 있음
 * - 두더지·이름표를 누르면 프로필 팝업 (나·탈퇴한 사용자는 제외)
 * - 찻방 그림은 디자인이 아직 없어서 명세 밑그림을 따라 2D 로 그림 (창문·전등·선반·러그·찻상)
 */
export interface TeaGuest { id: string; name: string; worn: string[]; me?: boolean; gone?: boolean }

const MAX = 5
// 자리: [x, y, 키, 방향, 깊이]. 0 = 나 (앞 왼쪽)
const DUO: [number, number, number, number, number][] = [[0.22, 0.88, 0.22, 0.55, 0], [0.78, 0.88, 0.22, -0.55, 0]]
const GROUP: [number, number, number, number, number][] = [
  [0.2, 0.9, 0.21, 0.5, 0], [0.8, 0.9, 0.21, -0.5, 0],
  [0.3, 0.68, 0.17, 0.3, 1], [0.7, 0.68, 0.17, -0.3, 1], [0.5, 0.63, 0.15, 0, 2],
]

export default function TeaRoom({ guests, mode, greet, onPick }: {
  guests: TeaGuest[]
  mode: 'empty' | 'dm' | 'group'
  greet?: { id: string; n: number }
  onPick?: (id: string) => void
}) {
  const [ready, setReady] = useState(false)
  const shown = guests.slice(0, MAX)
  const extra = guests.length - shown.length
  const layout = mode === 'group' ? GROUP : DUO
  const seats: TeaSeat[] = shown.map((g, i) => {
    const [x, y, h, yaw, depth] = layout[i]
    return { id: g.id, worn: g.worn, x, y, h, yaw, depth }
  })
  return (
    <section className={s.wrap} aria-label={mode === 'empty' ? '찻방. 아직 고른 대화가 없어 내 두더지만 앉아 있어요' : `찻방. ${guests.map((g) => g.name).join(', ')}`}>
      <div className={s.box}>
        <RoomArt />
        {mode === 'empty' && <span className={s.emptySeat} style={{ left: '78%', top: '88%' }} aria-hidden />}
        {/* 발밑 그림자 (2D) */}
        {seats.map((st) => <span key={`sh-${st.id}`} className={s.shadow} style={{ left: `${st.x * 100}%`, top: `${st.y * 100}%`, width: `${st.h * 70}%` }} aria-hidden />)}
        {/* 3D 가 준비되기 전·못 쓸 때: 2D 두더지 그림 */}
        {!ready && seats.map((st) => (
          <span key={`ph-${st.id}`} className={s.placeholder} style={{ left: `${st.x * 100}%`, top: `${st.y * 100}%`, height: `${st.h * 100}%` }} aria-hidden>
            <Avatar size={64} />
          </span>
        ))}
        <Suspense fallback={null}>
          <TeaRoomCanvas seats={seats} greet={greet} className={s.canvas} onReady={() => setReady(true)} />
        </Suspense>
        {/* 이름표 + 누르는 자리 */}
        {shown.map((g, i) => {
          const st = seats[i]
          const clickable = !g.me && !g.gone && !!onPick
          return (
            <button key={g.id} type="button" className={s.hit} disabled={!clickable}
              style={{ left: `${st.x * 100}%`, top: `${st.y * 100}%`, height: `${(st.h + 0.06) * 100}%`, width: `${st.h * 62}%`, zIndex: 3 - st.depth }}
              onClick={() => clickable && onPick!(g.id)} aria-label={clickable ? `${g.name} 프로필 보기` : g.name}>
              <span className={g.me ? s.tagMe : s.tag}>{g.me ? '나' : g.name}</span>
            </button>
          )
        })}
        {extra > 0 && <span className={s.more}>+{extra}명</span>}
      </div>
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
