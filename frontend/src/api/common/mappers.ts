/**
 * 공통 DTO → 앱 모양. 사람(사용자 표시)은 거의 모든 영역이 받으므로 여기 한 곳에서 바꾼다.
 *
 * - id: toAppId (숫자 → 문자열, 목 번호면 원래 글자 id)
 * - 탈퇴한 사람은 GONE_ID('gone') 의 "탈퇴한 사용자"
 * - 응답에 온 사람은 rememberPerson 으로 USERS 에 채워 둔다 (화면 여러 곳이 아직 USERS[id] 로 닉네임을 찾기 때문.
 *   화면을 usePerson 류로 바꾸면 없앨 다리)
 */
import { USERS } from '../../data/mock'
import type { User } from '../../data/types'
import { toAppId } from './ids'
import { wornOfMole } from './moleCodes'
import type { CampusDto, GenerationDto, InterestTagDto, ItemsDto, MoleDto, UserDisplayDto } from './types'

export const GONE_ID = 'gone'

/* ===== 사람 ===== */
export type Person = User & { campus?: string; gen?: number; floor?: number }

const GONE_PERSON: Person = { id: GONE_ID, nickname: '탈퇴한 사용자', affiliation: '', intro: '', interests: [] }

/** 응답에 온 사람을 USERS 에 채워 둠 (없으면 넣고, 관심사가 비어 있던 기록은 더 자세한 값으로) */
export function rememberPerson(u: Person, full: boolean) {
  if (u.id === GONE_ID) return
  const old = USERS[u.id]
  if (!old) USERS[u.id] = u
  else if (full && !old.interests.length) USERS[u.id] = { ...old, ...u }
}

/** 두더지 코드(명세 대문자 CAP_RED) → 앱의 입은 아이템 id 목록. 모르는 코드 · 부위가 틀린 코드는 빼서 "없음"으로 그림 (common/moleCodes) */
export const wornOf = (m: MoleDto | null | undefined): string[] => wornOfMole(m)

/** "SSAFY 16기 · 서울 · 2층" */
export const affiliationOf = (campus: string | null, gen: number | null, floor: number | null) => (campus ? `SSAFY ${gen ?? ''}기 · ${campus} · ${floor ?? ''}층` : '')

/**
 * 사용자 표시(명세) → 앱 사람. interests 를 주면(프로필 팝업 · 땅굴처럼 관심사 태그가 같이 온 경우) 그 순서로 채운다
 */
export function toPersonFromDisplay(d: UserDisplayDto, interests?: InterestTagDto[]): Person {
  if (d.isWithdrawn || !d.nickname) return { ...GONE_PERSON }
  const id = toAppId(d.id)
  const u: Person = {
    id, nickname: d.nickname,
    affiliation: affiliationOf(d.campusName, d.generation, d.floor),
    intro: USERS[id]?.intro ?? '',
    interests: interests ? interests.map((i) => i.name) : USERS[id]?.interests ?? [],
    worn: wornOf(d.mole),
    ...(d.campusName ? { campus: d.campusName, gen: d.generation ?? undefined, floor: d.floor ?? undefined } : {}),
  }
  rememberPerson(u, !!interests)
  return u
}

/* ===== 캠퍼스 · 기수 ===== */
/** 캠퍼스 하나 (앱 모양). id 는 앱 id 문자열 */
export interface CampusOption { id: string; name: string; floors: { id: string; floor: number }[] }
export const toCampuses = (d: ItemsDto<CampusDto>): CampusOption[] =>
  d.items.map((c) => ({ id: toAppId(c.id), name: c.name, floors: c.floors.map((f) => ({ id: toAppId(f.id), floor: f.floor })) }))
/** 기수 숫자 목록 (큰 것부터) */
export const toGenerations = (d: ItemsDto<GenerationDto>): number[] => d.items.map((g) => g.generation)
