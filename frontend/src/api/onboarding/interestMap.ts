/**
 * 관심사 id(서버 숫자) ↔ 앱 관심사 코드(cafe_coffee …) 잇기 — 이 파일 한 곳.
 *
 * 왜 필요한가: 서버(명세 00 공통 5)는 대분류 12 · 세부 90 을 숫자 id 로 준다. 앱은 가구 · 아이콘 · 3D · 무드 · 이펙트를
 * 뜻 있는 코드(data/interestTags.ts TAG_TREE 의 id)로 고른다. 숫자 id 는 DB 가 정하는 값이라 앱이 미리 알 수 없다.
 *
 * 잇는 법: **이름으로** 잇는다. 서버의 대분류 · 세부 관심사 이름(interest_category.name · interest.name)은 명세 00 공통 5 표와 같고,
 * 앱의 TAG_TREE 이름도 같은 표(2026-11-18 사용자 확정본)에서 왔다 → 이름 → 코드 표 하나로 충분.
 * - 이름은 공백만 무시하고 비교한다 ("음식·음료" = "음식 · 음료")
 * - 서버 id 는 GET /interest-categories 를 받은 뒤에야 안다 → toInterestCatalog 가 받은 목록으로 id ↔ 코드 표를 만든다
 * - 이름이 표에 없는 관심사(서버에만 새로 생긴 것)는 code null: 화면에는 칩으로 보이고 고를 수도 있지만 가구 · 무드는 없다
 * - 검사: src/tests/interest-map.test.ts 가 명세 00 공통 5 표의 이름 102개가 모두 앱 코드로 이어지는지 본다
 *
 * 백엔드에 제안: interest · interest_category 에 바뀌지 않는 code 칼럼(예: "cafe_coffee")을 두고 응답에 실어 주면
 * 이름을 고쳐도(오타 · 문구 다듬기) 앱이 깨지지 않는다. 그때는 이 파일의 byName 대신 code 로 바로 찾으면 된다.
 */
import { TAG_TREE } from '../../data/interestTags'
import type { Category, Tag } from '../../data/types'
import { toAppId } from '../common/ids'
import { categoryCodeOfSeed } from '../mock/seedIds'
import type { Id, ItemsDto } from '../common/types'
import type { InterestCategoryDto } from './types'

/** 비교용 이름 (공백 · 유니코드 모양 차이 무시) */
export const normName = (s: string) => s.normalize('NFC').replace(/\s+/g, '')

const CAT_BY_NAME = new Map(TAG_TREE.map((c) => [normName(c.name), c]))
const SUB_BY_NAME = new Map(TAG_TREE.flatMap((c) => c.subs.map(([code, name]) => [normName(name), { code, name, cat: c.id }] as const)))
const CAT_BY_CODE = new Map(TAG_TREE.map((c) => [c.id, c]))

/** 대분류 이름 → 앱 대분류 코드 (없으면 null) */
export const categoryCodeOfName = (name: string): string | null => CAT_BY_NAME.get(normName(name))?.id ?? null
/** 세부 관심사 이름 → 앱 관심사 코드 (없으면 null) */
export const interestCodeOfName = (name: string): string | null => SUB_BY_NAME.get(normName(name))?.code ?? null
/** 세부 관심사 이름 → 앱이 화면에 쓰는 이름 (표에 있으면 앱 이름, 없으면 서버 이름 그대로) */
export const appInterestName = (name: string): string => SUB_BY_NAME.get(normName(name))?.name ?? name

/** 받은 관심사 목록 (앱 모양) */
export interface InterestCatalog {
  /**
   * 화면이 바로 쓰는 대분류 목록 (data/types Category 모양 — 예전 data/mock CATEGORIES 자리).
   * id = 앱 대분류 코드(없으면 서버 id 글자), tags[].id = 앱 관심사 코드(없으면 서버 id 글자), tags[].count = userCount
   */
  categories: Category[]
  /** 앱 관심사 이름 → 서버 id (요청 본문 interestIds) */
  idOfName: Map<string, Id>
  /** 서버 대분류 id(앱 id 글자) → 앱 대분류 코드 (질문의 interestCategoryId 를 잇는 데 씀) */
  categoryCodeOfId: Map<string, string>
  /** 이름이 앱 표에 없어 코드를 못 찾은 것 ("대분류 / 관심사") */
  unmapped: string[]
}

/** GET /interest-categories → 앱 모양 + id ↔ 코드 표 */
export function toInterestCatalog(dto: ItemsDto<InterestCategoryDto>): InterestCatalog {
  const idOfName = new Map<string, Id>()
  const categoryCodeOfId = new Map<string, string>()
  const unmapped: string[] = []
  const categories: Category[] = dto.items.map((c) => {
    const appCatId = toAppId(c.id)
    const code = categoryCodeOfName(c.name)
    const def = code ? CAT_BY_CODE.get(code) : undefined
    if (code) categoryCodeOfId.set(appCatId, code)
    else unmapped.push(c.name)
    const tags: Tag[] = c.interests.map((i) => {
      const subCode = interestCodeOfName(i.name)
      const name = appInterestName(i.name)
      if (!subCode) unmapped.push(`${c.name} / ${i.name}`)
      idOfName.set(name, i.id)
      return { id: subCode ?? `interest-${toAppId(i.id)}`, name, count: i.userCount }
    })
    return { id: code ?? `category-${appCatId}`, name: def?.name ?? c.name, emoji: def?.emoji ?? '•', tone: def?.tone ?? 'sand', tags }
  })
  return { categories, idOfName, categoryCodeOfId, unmapped }
}

/**
 * 앱 관심사 이름 목록 → 요청 본문 interestIds (고른 순서 그대로).
 * 목록에 없는 이름이 있으면 던진다 (서버에 없는 관심사를 조용히 빼면 대표 관심사가 바뀔 수 있어서)
 */
export function interestIdsOf(names: string[], catalog: InterestCatalog): Id[] {
  return names.map((n) => {
    const id = catalog.idOfName.get(n) ?? catalog.idOfName.get(appInterestName(n))
    if (id == null) throw new Error(`관심사 목록에 없는 관심사: ${n}`)
    return id
  })
}

/**
 * 서버 대분류 id → 앱 대분류 코드. 받은 목록(이름으로 이은 표)이 먼저이고,
 * 목록을 아직 못 받았으면 처음 값의 순서(명세 dev 9ea6698: id 순 = 00 공통 5 표 순서)로 찾아 봄
 */
export function categoryCodeOfId(id: Id | null, catalog?: InterestCatalog | null): string | null {
  if (id == null) return null
  return catalog?.categoryCodeOfId.get(toAppId(id)) ?? categoryCodeOfSeed(id)
}
