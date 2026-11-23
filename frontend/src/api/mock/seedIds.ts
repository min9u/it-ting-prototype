/**
 * 목 서버의 관심사 대분류 · 세부 관심사 id = 백엔드 처음 값(KAN-43 마이그레이션)과 같은 번호.
 *
 * 명세 dev 9ea6698 (db/account.md "처음 값", api/00-common.md "구현하며 정한 것"): 대분류 12개와 세부 관심사 90개는
 * 00 공통 5 표의 순서대로 넣어 **id 순 = 표 순서**다 (대분류 1 음식·음료 … 12 반려동물·식물, 세부 1 맛집탐방 … 90 식물/테라리움).
 * 앱 표(data/interestTags.ts TAG_TREE)도 같은 표 순서라 그 순서로 번호를 매긴다 (tests/interest-map.test.ts 가 순서를 봄).
 *
 * 앱은 여전히 이름으로 잇는다(api/onboarding/interestMap.ts). 이 표는 목 서버가 실제 서버와 같은 id 를 주고받게 할 뿐이다.
 * 자기소개 질문은 이 표에 없다: 백엔드 초안 40개의 문구가 사본에 없고, 앱(목)은 질문 id(food-1 …)를 저장해 쓰므로 목 번호 그대로.
 */
import { TAG_TREE } from '../../data/interestTags'
import { toAppId, toDtoId } from '../common/ids'
import type { Id } from '../common/types'

const CAT_CODES: readonly string[] = TAG_TREE.map((c) => c.id)
const SUB_CODES: readonly string[] = TAG_TREE.flatMap((c) => c.subs.map(([code]) => code))

/** 대분류 코드 → 처음 값 id (1 ~ 12). 표에 없는 코드는 목 번호 */
export const categorySeedId = (code: string): Id => {
  const i = CAT_CODES.indexOf(code)
  return i >= 0 ? i + 1 : toDtoId(code)
}
/** 세부 관심사 코드 → 처음 값 id (1 ~ 90). 표에 없는 코드는 목 번호 */
export const interestSeedId = (code: string): Id => {
  const i = SUB_CODES.indexOf(code)
  return i >= 0 ? i + 1 : toDtoId(code)
}
/** 처음 값 id → 대분류 코드 (목 번호면 되돌림, 없으면 null) */
export const categoryCodeOfSeed = (id: Id): string | null => {
  const byIndex = Number.isInteger(id) ? CAT_CODES[id - 1] : undefined
  if (byIndex) return byIndex
  const app = toAppId(id)
  return CAT_CODES.includes(app) ? app : null
}
/** 처음 값 id → 세부 관심사 코드 (목 번호면 되돌림, 없으면 null) */
export const interestCodeOfSeed = (id: Id): string | null => {
  const byIndex = Number.isInteger(id) ? SUB_CODES[id - 1] : undefined
  if (byIndex) return byIndex
  const app = toAppId(id)
  return SUB_CODES.includes(app) ? app : null
}
