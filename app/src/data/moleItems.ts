/**
 * 두더지 꾸미기 아이템 (2026-11-11 Figma: 온보딩 1 – 이름 · 두더지 꾸미기 408:18310, 꾸미기 모드 682:7764)
 * - 최대 2개까지, 부위마다 하나씩 (머리 18 · 얼굴 6 · 목 5 · 손 12)
 * - 아이콘은 Figma 스크린샷에서 잘라 쓴 임시본 (assets/mole-items/). 원본 에셋으로 바꿔야 함
 * - 얼굴·목·손 아이템 목록은 Figma에서 확인 못 함 → 이름을 아는 "물감 팔레트"(손)만 넣었다
 */
import none from '../assets/mole-items/none.png'
import beret from '../assets/mole-items/hat_beret.png'
import beanie from '../assets/mole-items/hat_beanie.png'
import straw from '../assets/mole-items/hat_straw.png'
import tuft from '../assets/mole-items/hair_tuft.png'
import thin1 from '../assets/mole-items/hair_thin_1.png'
import party from '../assets/mole-items/hat_party.png'
import flower from '../assets/mole-items/hat_flower_pin.png'
import curl from '../assets/mole-items/hair_curl.png'
import ponytail from '../assets/mole-items/hair_ponytail.png'
import ribbon from '../assets/mole-items/hair_ribbon.png'
import thin2 from '../assets/mole-items/hair_thin_2.png'
import crown from '../assets/mole-items/hat_crown.png'
import thin3 from '../assets/mole-items/hair_thin_3.png'
import tiara from '../assets/mole-items/hat_tiara.png'
import headphones from '../assets/mole-items/headphones.png'
import sweatband from '../assets/mole-items/headband_sport.png'
import chef from '../assets/mole-items/hat_chef.png'
import sprout from '../assets/mole-items/hat_sprout.png'
import palette from '../assets/mole-items/hand_palette.png'

export type MolePart = '머리' | '얼굴' | '목' | '손'
export const MOLE_PARTS: { part: MolePart; total: number }[] = [
  { part: '머리', total: 18 }, { part: '얼굴', total: 6 }, { part: '목', total: 5 }, { part: '손', total: 12 },
]
export const MAX_WORN = 2

export interface MoleItem {
  id: string
  name: string
  part: MolePart
  icon: string
  /** 관심사 아이템: 그 관심사를 고른 사람에게 바로 열림 (Figma 배지 "음악·운동·요리·식물") */
  interest?: string
}

export const NONE_ICON = none

export const MOLE_ITEMS: MoleItem[] = [
  { id: 'hat_beret', name: '베레모', part: '머리', icon: beret },
  { id: 'hat_beanie', name: '비니', part: '머리', icon: beanie },
  { id: 'hat_straw', name: '밀짚모자', part: '머리', icon: straw },
  { id: 'hair_tuft', name: '삐죽 머리털', part: '머리', icon: tuft },
  { id: 'hair_thin_1', name: '얇은 한 가닥', part: '머리', icon: thin1 },
  { id: 'hat_party', name: '고깔모자', part: '머리', icon: party },
  { id: 'hat_flower_pin', name: '꽃 핀', part: '머리', icon: flower },
  { id: 'hair_curl', name: '곱슬 앞머리', part: '머리', icon: curl },
  { id: 'hair_ponytail', name: '꽁지머리', part: '머리', icon: ponytail },
  { id: 'hair_ribbon', name: '리본 머리핀', part: '머리', icon: ribbon },
  { id: 'hair_thin_2', name: '얇은 두 가닥', part: '머리', icon: thin2 },
  { id: 'hat_crown', name: '작은 왕관', part: '머리', icon: crown },
  { id: 'hair_thin_3', name: '얇은 세 가닥', part: '머리', icon: thin3 },
  { id: 'hat_tiara', name: '하트 티아라', part: '머리', icon: tiara },
  { id: 'headphones', name: '헤드폰', part: '머리', icon: headphones, interest: '음악' },
  { id: 'headband_sport', name: '땀 밴드', part: '머리', icon: sweatband, interest: '운동' },
  { id: 'hat_chef', name: '요리사 모자', part: '머리', icon: chef, interest: '요리' },
  { id: 'hat_sprout', name: '새싹', part: '머리', icon: sprout, interest: '식물' },
  { id: 'hand_palette', name: '물감 팔레트', part: '손', icon: palette },
]

export const itemOf = (id: string) => MOLE_ITEMS.find((x) => x.id === id)

/** Figma 예시와 같은 기본 착용: 베레모 + 물감 팔레트 */
export const DEFAULT_WORN = ['hat_beret', 'hand_palette']
