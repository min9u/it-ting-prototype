/**
 * 2D 조각: 두더지(서 있는 몸 전체) · 땅굴 미리보기(돔 단면 그림). 디자인 B·C·D 가 씀. 2026-11-16
 * - 두더지 얼굴·액세서리는 온보딩 2D 아바타(components/MoleAvatar)와 같은 그림을 씀. 3D 액세서리 id 는 비슷한 2D 그림으로 바꿔 끼움
 * - 땅굴 미리보기 벽지는 3D 땅굴과 같은 함수(data/roomLook.ts roomLookOf: 대표 관심사의 대분류 → 벽지 타일, 2026-11-18부터)
 */
import type { CSSProperties } from 'react'
import { findAcc, type Slot } from '../../../components/MoleAvatar'
import { tileUrl, wallpaperOf } from '../../../data/wallpapers'
import { mySavedRoom, roomLookOf } from '../../../data/roomLook'
import { themeOf } from '../../../data/roomStyle'
import { lookDiverse } from '../../../lib/roomLookLab'
import { categoriesByWeight } from './match'
import d from './designs.module.css'

/** 3D 액세서리 id → 2D 아바타 그림 (없는 건 안 그림) */
const TO_2D: Record<string, [Slot, string]> = {
  hat_beret: ['hat', 'beret'], hat_beanie: ['hat', 'beanie'], hat_straw: ['hat', 'straw'], hat_party: ['hat', 'party'],
  hat_flower_pin: ['hat', 'flower'], hat_crown: ['hat', 'crown'], hat_tiara: ['hat', 'crown'], hat_chef: ['hat', 'beanie'],
  hat_sprout: ['prop', 'sprout'],
  glasses_round: ['glasses', 'round'], glasses_sun: ['glasses', 'sun'], glasses_star: ['glasses', 'star'], glasses_heart: ['glasses', 'round'], glasses_3d: ['glasses', 'square'],
  scarf_knit: ['scarf', 'red'], scarf_stripe: ['scarf', 'stripe'], bowtie: ['scarf', 'bow'], bandana: ['scarf', 'bandana'],
  prop_cup: ['prop', 'coffee'], prop_book: ['prop', 'book'], prop_balloon: ['prop', 'balloon'], prop_balloon_heart: ['prop', 'balloon'],
}
const INK = '#3e2a1f'

/** 서 있는 2D 두더지 (viewBox 0 0 100 108, 발이 아래 끝) */
export function Mole2D({ worn = [], size = 48, color = '#6b4a3a', facing = 1, className, style }: {
  worn?: string[]; size?: number; color?: string; facing?: 1 | -1; className?: string; style?: CSSProperties
}) {
  const outfit: Partial<Record<Slot, string>> = {}
  for (const id of worn) { const m = TO_2D[id]; if (m && !outfit[m[0]]) outfit[m[0]] = m[1] }
  const layer = (slot: Slot) => findAcc(slot, outfit[slot])?.draw()
  return (
    <svg className={className} style={style} width={size} height={size * 1.08} viewBox="0 0 100 108" aria-hidden>
      <g transform={facing === -1 ? 'translate(100 0) scale(-1 1)' : undefined}>
        <ellipse cx="50" cy="104" rx="27" ry="4" fill="rgba(60,35,20,.22)" />
        <ellipse cx="38" cy="100" rx="8" ry="4.5" fill="#f0b9ae" />
        <ellipse cx="62" cy="100" rx="8" ry="4.5" fill="#f0b9ae" />
        <path d="M24 84 V60 C24 33 35 20 50 20 C65 20 76 33 76 60 V84 C76 95 66 100 50 100 C34 100 24 95 24 84 Z" fill={color} />
        <path d="M24 84 V60 C24 33 35 20 50 20 C40 25 33 38 33 60 V86 C33 92 36 96 40 98 C30 96 24 92 24 84 Z" fill="#fff" opacity=".07" />
        <ellipse cx="24.5" cy="68" rx="4.5" ry="6" fill="#f0b9ae" />
        <ellipse cx="75.5" cy="68" rx="4.5" ry="6" fill="#f0b9ae" />
        <circle cx="41.5" cy="45" r="2.6" fill={INK} /><circle cx="58.5" cy="45" r="2.6" fill={INK} />
        <circle cx="42.3" cy="44.2" r=".9" fill="#fff" /><circle cx="59.3" cy="44.2" r=".9" fill="#fff" />
        <circle cx="35" cy="56" r="4.5" fill="#e87a6e" opacity=".35" /><circle cx="65" cy="56" r="4.5" fill="#e87a6e" opacity=".35" />
        <ellipse cx="50" cy="56" rx="7.5" ry="5.5" fill="#f08e86" />
        <ellipse cx="48" cy="54.5" rx="2.4" ry="1.4" fill="#fff" opacity=".45" />
        {layer('scarf')}
        {layer('glasses')}
        {layer('hat')}
        {layer('prop')}
      </g>
    </svg>
  )
}

/** 소품 자리 (벽 선반 · 바닥 왼쪽 · 바닥 오른쪽 · 벽 액자) */
const PROP_SPOTS: CSSProperties[] = [
  { left: '17%', top: '30%' },
  { left: '9%', bottom: '9%' },
  { right: '9%', bottom: '9%' },
  { right: '17%', top: '30%' },
]

/**
 * 땅굴 미리보기: 돔 모양 단면 + 그 사람 벽지 + 관심 분류 소품(이모지) + 집주인 두더지.
 * width 는 px. mine 이면 내 벽지(꾸미기에서 고른 것)
 */
export function RoomPeek({ ownerId = '', interests, worn, width = 220, mine, online, className, showMole = true }: {
  /** 집주인 id (색 묶음 안에서 사람마다 다른 벽 · 바닥 빛깔을 3D 땅굴과 같게) */
  ownerId?: string
  interests: string[]; worn?: string[]; width?: number; mine?: boolean; online?: boolean; className?: string; showMole?: boolean
}) {
  // 3D 땅굴과 같은 함수 (data/roomLook.ts): 내 것이면 내가 저장한 방, 남의 것은 저장한 방을 모르는 목 데이터라 관심사로 계산
  const look = roomLookOf(ownerId, interests, mine ? mySavedRoom() : null)
  const wp = wallpaperOf(look.wallpaper)
  const tile = tileUrl(wp.id, 512)
  const cats = categoriesByWeight(interests).slice(0, 4)
  // 색 묶음 (🎨 땅굴 색 다양하게가 켜져 있으면): 벽은 타일 위에 묶음 색을 곱하고, 바닥 · 러그도 묶음 색 (2026-11-18 2단계)
  const th = lookDiverse() && look.style ? themeOf(look.style.theme) : null
  const wall = th?.shell ? look.style!.wall ?? th.shell.wall : null
  const floor = th?.shell ? look.style!.floor ?? th.shell.floor : null
  const rug = th ? look.style!.rug?.color ?? th.rug : null
  return (
    <div className={`${d.peek} ${className ?? ''}`} style={{ '--w': `${width}px` } as CSSProperties} aria-hidden>
      <div className={d.peekWall} style={{ backgroundColor: wall ?? wp.solid_color ?? wp.avg_color_srgb, backgroundImage: tile ? `url(${tile})` : undefined, backgroundBlendMode: wall ? 'multiply' : undefined }} />
      <div className={d.peekRibs} />
      <div className={d.peekFloor} style={floor ? { background: floor } : undefined} />
      <div className={d.peekRug} style={rug ? { background: rug } : undefined} />
      {cats.map((c, i) => <span key={c.id} className={i === 0 || i === 3 ? d.peekPropWall : d.peekProp} style={PROP_SPOTS[i]} title={c.name}>{c.emoji}</span>)}
      {showMole && <Mole2D worn={worn} size={width * 0.27} className={d.peekMole} />}
      {online && <span className={d.peekOnline}>접속 중</span>}
    </div>
  )
}
