import type { ReactNode } from 'react'

/*
 * 2D 두더지 아바타 (온보딩 1 – 나를 부르는 이름 408:18310 의 Avatar Preview).
 * 털 색 + 부위별 액세서리(모자·안경·목도리·소품)를 하나씩 얹는다. 3D 두더지(glb)에는 아직 반영하지 않음.
 * 좌표계: viewBox 0 0 100 100, 두더지 몸은 아래가 잘린 총알 모양.
 */

export const MOLE_COLORS = [
  { id: 'cocoa', name: '코코아', hex: '#6b4a3a' },
  { id: 'carrot', name: '당근', hex: '#c8643a' },
  { id: 'mustard', name: '겨자', hex: '#c98a3a' },
  { id: 'olive', name: '올리브', hex: '#7a8a3e' },
  { id: 'teal', name: '청록', hex: '#3f7a6a' },
  { id: 'navy', name: '바다', hex: '#4d6a8c' },
  { id: 'plum', name: '자두', hex: '#7a5b8c' },
  { id: 'rose', name: '장미', hex: '#b0607a' },
] as const

export type Slot = 'hat' | 'glasses' | 'scarf' | 'prop'
export interface Accessory {
  id: string
  name: string
  /** 미리보기 칩에 쓰는 긴 이름 (없으면 name) */
  full?: string
  /** 타일 아이콘을 그릴 때 보여 줄 영역 */
  vb: string
  draw: () => ReactNode
}

const INK = '#3e2a1f'

export const ACCESSORIES: Record<Slot, { label: string; items: Accessory[] }> = {
  hat: {
    label: '모자',
    items: [
      { id: 'beret', name: '베레모', vb: '24 6 54 28', draw: () => (
        <g transform="rotate(-8 50 22)">
          <ellipse cx="50" cy="22" rx="23" ry="8.5" fill="#c8643a" />
          <ellipse cx="46" cy="19.5" rx="12" ry="3" fill="#e08a5e" opacity=".6" />
          <circle cx="51" cy="13" r="2.4" fill="#a94f2c" />
        </g>
      ) },
      { id: 'beanie', name: '비니', vb: '24 6 52 30', draw: () => (
        <g>
          <path d="M28 31 C28 13 72 13 72 31 Z" fill="#7a8a3e" />
          <rect x="26.5" y="27" width="47" height="7" rx="3.5" fill="#5f6d2e" />
          <circle cx="50" cy="12" r="4.5" fill="#a9b86a" />
        </g>
      ) },
      { id: 'straw', name: '밀짚모자', vb: '18 8 64 26', draw: () => (
        <g>
          <ellipse cx="50" cy="27" rx="31" ry="6" fill="#e2b85a" />
          <path d="M36 27 C36 12 64 12 64 27 Z" fill="#ecc872" />
          <rect x="36" y="21.5" width="28" height="4" fill="#c8643a" />
        </g>
      ) },
      { id: 'party', name: '고깔모자', vb: '34 0 32 32', draw: () => (
        <g>
          <path d="M39 28 L50 3 L61 28 Z" fill="#b9a3d6" />
          <path d="M44.5 15.5 L55.5 15.5 M42 21.5 L58 21.5" stroke="#f4eadd" strokeWidth="2.4" />
          <circle cx="50" cy="3.5" r="3.2" fill="#f0c850" />
        </g>
      ) },
      { id: 'flower', name: '꽃 핀', vb: '52 12 24 24', draw: () => (
        <g transform="translate(64 24)">
          {[0, 72, 144, 216, 288].map((a) => <circle key={a} cx={Math.cos((a * Math.PI) / 180) * 4.6} cy={Math.sin((a * Math.PI) / 180) * 4.6} r="4" fill="#f2a3a0" />)}
          <circle r="3" fill="#f0c850" />
        </g>
      ) },
      { id: 'crown', name: '왕관', vb: '30 4 40 28', draw: () => <path d="M34 28 L36 10 L44 19 L50 7 L56 19 L64 10 L66 28 Z" fill="#f0c850" /> },
    ],
  },
  glasses: {
    label: '안경',
    items: [
      { id: 'round', name: '동그란 안경', vb: '30 36 40 20', draw: () => (
        <g fill="rgba(255,255,255,.28)" stroke={INK} strokeWidth="2">
          <circle cx="41.5" cy="45" r="6.5" /><circle cx="58.5" cy="45" r="6.5" />
          <path d="M48 44.5 Q50 42.5 52 44.5" fill="none" />
        </g>
      ) },
      { id: 'square', name: '네모 안경', vb: '30 36 40 20', draw: () => (
        <g fill="rgba(255,255,255,.28)" stroke={INK} strokeWidth="2">
          <rect x="34.5" y="39.5" width="13" height="10.5" rx="2.5" /><rect x="52.5" y="39.5" width="13" height="10.5" rx="2.5" />
          <path d="M47.5 44 L52.5 44" fill="none" />
        </g>
      ) },
      { id: 'sun', name: '선글라스', vb: '30 36 40 20', draw: () => (
        <g fill={INK}>
          <path d="M34 41 H48 V46 Q48 51 41 51 Q34 51 34 46 Z" /><path d="M52 41 H66 V46 Q66 51 59 51 Q52 51 52 46 Z" />
          <rect x="47" y="41" width="6" height="2" />
        </g>
      ) },
      { id: 'star', name: '별 안경', vb: '30 34 40 22', draw: () => (
        <g fill="#f0c850" stroke="#c98a3a" strokeWidth="1">
          {[41.5, 58.5].map((x) => <path key={x} transform={`translate(${x} 45)`} d="M0 -8 L2.4 -2.6 L8 -2.4 L3.6 1.2 L5 7 L0 3.8 L-5 7 L-3.6 1.2 L-8 -2.4 L-2.4 -2.6 Z" />)}
        </g>
      ) },
    ],
  },
  scarf: {
    label: '목도리',
    items: [
      { id: 'stripe', name: '줄무늬', full: '줄무늬 목도리', vb: '20 62 60 34', draw: () => (
        <g>
          <path d="M23 68 Q50 76 77 68 L77 77 Q50 85 23 77 Z" fill="#7a9a3e" />
          <rect x="58" y="76" width="9" height="17" rx="2" fill="#7a9a3e" />
          <path d="M32 71.5 V80 M41 73.5 V82 M50 74.5 V83 M59 73.5 V82 M68 71.5 V80 M58 84 H67 M58 89 H67" stroke="#f4eadd" strokeWidth="1.6" />
        </g>
      ) },
      { id: 'red', name: '빨간 목도리', vb: '20 62 60 34', draw: () => (
        <g>
          <path d="M23 68 Q50 76 77 68 L77 77 Q50 85 23 77 Z" fill="#c8503a" />
          <rect x="33" y="76" width="9" height="17" rx="2" fill="#c8503a" />
          <path d="M33 90 H42" stroke="#f4eadd" strokeWidth="1.6" />
        </g>
      ) },
      { id: 'bow', name: '나비넥타이', vb: '34 64 32 20', draw: () => (
        <g fill="#4d6a8c">
          <path d="M50 73 L38 66 L38 80 Z" /><path d="M50 73 L62 66 L62 80 Z" /><circle cx="50" cy="73" r="3.4" fill="#3b5571" />
        </g>
      ) },
      { id: 'bandana', name: '손수건', vb: '24 62 52 30', draw: () => (
        <g>
          <path d="M26 69 Q50 76 74 69 L50 90 Z" fill="#e2b85a" />
          {[[42, 75], [50, 80], [58, 75], [50, 72]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.4" fill="#fff6e0" />)}
        </g>
      ) },
    ],
  },
  prop: {
    label: '소품',
    items: [
      { id: 'coffee', name: '커피잔', vb: '62 70 30 30', draw: () => (
        <g>
          <rect x="66" y="79" width="16" height="15" rx="3" fill="#f4eadd" stroke={INK} strokeWidth="1.6" />
          <path d="M82 83 Q88 83 88 87 Q88 91 82 91" fill="none" stroke={INK} strokeWidth="1.6" />
          <path d="M70 75 Q72 72 70 69 M76 75 Q78 72 76 69" fill="none" stroke="#c9a27e" strokeWidth="1.4" />
        </g>
      ) },
      { id: 'book', name: '책', vb: '10 72 30 28', draw: () => (
        <g>
          <rect x="13" y="78" width="22" height="17" rx="2" fill="#b9d3df" stroke={INK} strokeWidth="1.4" />
          <path d="M24 78 V95" stroke={INK} strokeWidth="1.4" />
        </g>
      ) },
      { id: 'balloon', name: '풍선', vb: '66 24 30 52', draw: () => (
        <g>
          <path d="M81 48 Q78 60 80 74" fill="none" stroke={INK} strokeWidth="1" />
          <ellipse cx="81" cy="38" rx="10" ry="12" fill="#e87a6e" />
          <ellipse cx="77.5" cy="33" rx="2.6" ry="4" fill="#fff" opacity=".45" />
        </g>
      ) },
      { id: 'sprout', name: '새싹', vb: '38 0 24 24', draw: () => (
        <g>
          <path d="M50 19 V9" stroke="#5e8a3a" strokeWidth="2" />
          <ellipse cx="45" cy="8" rx="5.5" ry="3" fill="#8fae5c" transform="rotate(-25 45 8)" />
          <ellipse cx="55" cy="8" rx="5.5" ry="3" fill="#8fae5c" transform="rotate(25 55 8)" />
        </g>
      ) },
    ],
  },
}

export const SLOTS: Slot[] = ['hat', 'glasses', 'scarf', 'prop']
export type Outfit = Partial<Record<Slot, string>>

export const findAcc = (slot: Slot, id?: string) => (id ? ACCESSORIES[slot].items.find((a) => a.id === id) : undefined)

/** 액세서리 하나를 타일 아이콘으로 */
export function AccessoryIcon({ slot, id, size = 32 }: { slot: Slot; id: string; size?: number }) {
  const a = findAcc(slot, id)
  if (!a) return null
  return <svg width={size} height={size} viewBox={a.vb} aria-hidden>{a.draw()}</svg>
}

export default function MoleAvatar({ color = MOLE_COLORS[0].hex, outfit = {}, size = 150, bg = '#e7c9ae', radius, label }: {
  color?: string
  outfit?: Outfit
  size?: number
  bg?: string
  /** 기본은 크기의 17% (시안 208px 상자에 36px) */
  radius?: number
  label?: string
}) {
  const layer = (slot: Slot) => findAcc(slot, outfit[slot])?.draw()
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={label ?? '두더지 아바타'}
      style={{ display: 'block', flex: 'none', borderRadius: radius ?? Math.round(size * 0.17), background: bg }}>
      {/* 몸 */}
      <path d="M24 100 V60 C24 33 35 20 50 20 C65 20 76 33 76 60 V100 Z" fill={color} />
      <path d="M24 100 V60 C24 33 35 20 50 20 C40 25 33 38 33 60 V100 Z" fill="#fff" opacity=".06" />
      {/* 얼굴 */}
      <circle cx="41.5" cy="45" r="2.4" fill={INK} /><circle cx="58.5" cy="45" r="2.4" fill={INK} />
      <circle cx="42.3" cy="44.2" r=".8" fill="#fff" /><circle cx="59.3" cy="44.2" r=".8" fill="#fff" />
      <circle cx="35" cy="56" r="4.5" fill="#e87a6e" opacity=".35" /><circle cx="65" cy="56" r="4.5" fill="#e87a6e" opacity=".35" />
      <ellipse cx="50" cy="56" rx="7.5" ry="5.5" fill="#f08e86" />
      <ellipse cx="48" cy="54.5" rx="2.4" ry="1.4" fill="#fff" opacity=".45" />
      {layer('scarf')}
      {layer('glasses')}
      {layer('hat')}
      {layer('prop')}
    </svg>
  )
}
