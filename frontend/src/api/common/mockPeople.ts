/**
 * 목 서버가 여러 영역에서 같이 쓰는 "사람" 직렬화 (저장소 data/* → DTO).
 * 실제 서버가 user · user_profile · campus_floor 를 이어 읽어 "사용자 표시"를 만드는 자리와 같다.
 *
 * - 명세 모양: userDisplay(id) · interestTags(id) · moleDto(worn)
 * id 는 toDtoId 로 숫자로 바꿔 담는다 (common/ids.ts). 앱 쪽에서는 toAppId 로 원래 글자 id 가 돌아온다.
 */
import { ME_ID, USERS, categoryOf } from '../../data/mock'
import { getMyInterests, subOf } from '../../data/interests'
import { getMyWorn } from '../../data/moleItems'
import { moleDto as moleDtoOf } from './moleCodes'
import { ME_HOME, affOf, fieldUserOf } from '../../data/field'
import type { User } from '../../data/types'
import { toDtoId } from './ids'
import { categorySeedId, interestSeedId } from '../mock/seedIds'
import type { InterestTagDto, MoleDto, UserDisplayDto } from './types'

/** 목 데이터에서 탈퇴한 사람을 가리키는 id (앱의 GONE_ID 와 같음) */
const GONE = 'gone'

/** 목 저장소의 사람 (없거나 탈퇴면 undefined) */
export function rawPerson(id: string): User | undefined {
  if (!id || id === GONE) return undefined
  return USERS[id] ?? fieldUserOf(id)
}
/** "SSAFY 16기 · 서울 · 2층" → 숫자들 (목 데이터의 소속 문자열을 칼럼으로 나눔) */
export function affParts(id: string, u: User): { gen: number | null; campus: string | null; floor: number | null } {
  if (id === ME_ID) return { gen: ME_HOME.gen, campus: ME_HOME.campus, floor: ME_HOME.floor }
  const m = /(\d+)기\s*·\s*([^·]+?)\s*·\s*(\d+)층/.exec(affOf(u))
  return m ? { gen: +m[1], campus: m[2].trim(), floor: +m[3] } : { gen: null, campus: null, floor: null }
}
/** 입은 아이템 id 목록 → 부위별 코드 (명세 대문자, common/moleCodes) */
export const moleDto = (worn: string[]): MoleDto => moleDtoOf(worn)
const wornOf = (id: string, u: User) => (id === ME_ID ? getMyWorn() : u.worn ?? [])
const NO_MOLE: MoleDto = { head: null, face: null, neck: null, hand: null }

/* ===== 명세 모양 ===== */
/** 사용자 표시 (00 공통). 없는 사람은 탈퇴한 사용자로 */
export function userDisplay(id: string): UserDisplayDto {
  const u = rawPerson(id)
  if (!u) return { id: toDtoId(id || GONE), nickname: null, profileImageUrl: null, mole: { ...NO_MOLE }, campusName: null, generation: null, floor: null, isWithdrawn: true }
  const a = affParts(id, u)
  return {
    id: toDtoId(u.id), nickname: u.nickname, profileImageUrl: null, mole: moleDto(wornOf(id, u)),
    campusName: a.campus, generation: a.gen, floor: a.floor, isWithdrawn: false,
  }
}
/** 한 사람의 관심사 태그 (고른 순서, 첫 번째가 대표). isShared 는 보는 사람(기본 나) 기준 */
export function interestTags(id: string, viewerId: string = ME_ID): InterestTagDto[] {
  const u = rawPerson(id)
  if (!u) return []
  const names = id === ME_ID ? getMyInterests(u.interests) : u.interests
  const viewer = rawPerson(viewerId)
  const mine = new Set(viewer ? (viewerId === ME_ID ? getMyInterests(viewer.interests) : viewer.interests) : [])
  return names.map((name) => ({
    // 관심사 · 대분류 id 는 백엔드 처음 값과 같은 번호 (api/mock/seedIds)
    id: interestSeedId(subOf(name)?.id ?? name), name, interestCategoryId: categorySeedId(categoryOf(name)?.id ?? 'etc'),
    isShared: id !== viewerId && mine.has(name),
  }))
}
