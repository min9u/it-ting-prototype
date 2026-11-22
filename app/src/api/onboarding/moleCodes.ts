/**
 * 두더지 아이템 코드 (명세 03 "두더지 아이템"): 서버로는 부위마다 코드만 보낸다.
 * 코드 모양은 영어 대문자 · 숫자 · 밑줄 30자 이하(CAP_RED). 앱의 아이템 id(data/moleItems, glb 노드 이름)는 소문자(hat_beret)라
 * **보낼 때 대문자로, 받을 때 소문자로** 바꿔 앱 아이템을 찾는다. 모르는 코드는 "없음"으로 그린다 (명세).
 * (공통 계층의 common/mockPeople moleDto · common/mappers wornOf 는 아직 소문자 그대로라 공통 담당에게 알림)
 */
import { MOLE_PARTS, itemOf, wornByPart } from '../../data/moleItems'
import type { MoleDto } from '../common/types'

/** 코드 모양 (서버가 검사하는 것과 같음) */
export const MOLE_CODE = /^[A-Z0-9_]{1,30}$/

/** 앱 아이템 id → 서버 코드 */
export const moleCodeOf = (itemId: string) => itemId.toUpperCase()
/** 서버 코드 → 앱 아이템 id (모르는 코드면 null = "없음") */
export const itemIdOfCode = (code: string | null | undefined): string | null => {
  if (!code) return null
  const id = code.toLowerCase()
  return itemOf(id) ? id : null
}

/** 입은 아이템 id 목록 → 요청 본문 mole (네 부위 모두, 없으면 null) */
export function moleDto(worn: string[]): MoleDto {
  const by = wornByPart(worn)
  const c = (id: string | null) => (id ? moleCodeOf(id) : null)
  return { head: c(by.머리), face: c(by.얼굴), neck: c(by.목), hand: c(by.손) }
}

/** 응답의 mole → 입은 아이템 id 목록 (부위 순서: 머리 · 얼굴 · 목 · 손). 모르는 코드 · 부위가 틀린 코드는 뺌 */
export function wornOfMole(m: MoleDto | null | undefined): string[] {
  if (!m) return []
  const parts = { 머리: m.head, 얼굴: m.face, 목: m.neck, 손: m.hand } as const
  return MOLE_PARTS.flatMap(({ part }) => {
    const id = itemIdOfCode(parts[part])
    return id && itemOf(id)?.part === part ? [id] : []
  })
}
