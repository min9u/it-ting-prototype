/**
 * 관심사 id ↔ 앱 코드 잇기 (api/onboarding/interestMap.ts, docs/backend/api-v1/00-01-03-04-onboarding-burrow.md "관심사 · 질문 잇기")
 *
 * 명세 00 공통 5 의 표(대분류 12 · 세부 관심사 90)를 읽어, 이름마다 앱 코드(data/interestTags.ts TAG_TREE)가 있는지 본다.
 * 서버는 이 표의 이름을 interest_category.name · interest.name 으로 주므로, 여기서 다 이어지면 실제 서버 목록도 이어진다.
 * 실패하면 메시지에 못 이은 이름이 나온다 → 앱 표(TAG_TREE)나 명세 중 하나를 고치고 백엔드와 맞출 것
 */
import { describe, expect, it } from 'vitest'
import { TAG_TREE } from '../data/interestTags'
import { categoryCodeOfName, interestCodeOfName, interestIdsOf, toInterestCatalog } from '../api/onboarding/interestMap'
import { toAppId } from '../api/common/ids'
import { categoryCodeOfSeed, categorySeedId, interestCodeOfSeed, interestSeedId } from '../api/mock/seedIds'
import { TEAM_DOCS } from './teamDocs'

const FS = 'node:fs'
const fs = (await import(/* @vite-ignore */ FS)) as { readFileSync(p: string, enc: string): string }
const SPEC = `${TEAM_DOCS}/spec/00-common.md`

/** "| 🍽️ 음식·음료 (7) | 맛집탐방, 카페/커피, … |" → { cat, count, subs } */
function specTable() {
  const text = fs.readFileSync(SPEC, 'utf8')
  const sec = text.slice(text.indexOf('## 5. 관심사 태그'), text.indexOf('## 6.'))
  return sec.split('\n').flatMap((line) => {
    const m = /^\|\s*(.+?)\s*\((\d+)\)\s*\|\s*(.+?)\s*\|\s*$/.exec(line)
    if (!m) return []
    const cat = m[1].replace(/^[^\p{L}\p{N}]+/u, '').trim() // 앞의 이모지 떼기
    return [{ cat, count: Number(m[2]), subs: m[3].split(',').map((x) => x.trim()) }]
  })
}

describe('명세 00 공통 5 관심사 표 → 앱 코드', () => {
  const rows = specTable()
  it('표를 읽음: 대분류 12 · 세부 90, 괄호 개수와 같음', () => {
    expect(rows).toHaveLength(12)
    for (const r of rows) expect(r.subs, r.cat).toHaveLength(r.count)
    expect(rows.reduce((n, r) => n + r.subs.length, 0)).toBe(90)
  })
  it('모든 대분류 · 세부 관심사가 앱 코드로 이어짐 (못 이은 것 없음)', () => {
    const missing: string[] = []
    for (const r of rows) {
      const cat = categoryCodeOfName(r.cat)
      if (!cat) missing.push(`대분류 ${r.cat}`)
      for (const sub of r.subs) {
        const code = interestCodeOfName(sub)
        const def = TAG_TREE.find((c) => c.id === cat)
        if (!code) missing.push(`${r.cat} / ${sub}`)
        else if (!def?.subs.some(([id]) => id === code)) missing.push(`${r.cat} / ${sub} (다른 대분류의 코드 ${code})`)
      }
    }
    expect(missing, `앱 코드로 못 이은 관심사:\n${missing.join('\n')}`).toEqual([])
  })
  it('반대로 앱 표에만 있는 관심사도 없음 (앱 90 = 명세 90)', () => {
    const specNames = new Set(rows.flatMap((r) => r.subs))
    const extra = TAG_TREE.flatMap((c) => c.subs.map(([, n]) => n)).filter((n) => !specNames.has(n))
    expect(extra).toEqual([])
  })
  it('앱 표(TAG_TREE)의 순서가 명세 표 순서와 같음 (백엔드 처음 값의 id 순, 명세 dev 9ea6698)', () => {
    expect(TAG_TREE.map((c) => c.id)).toEqual(rows.map((r) => categoryCodeOfName(r.cat)))
    expect(TAG_TREE.flatMap((c) => c.subs.map(([code]) => code))).toEqual(rows.flatMap((r) => r.subs.map((n) => interestCodeOfName(n))))
  })
  it('목 서버 id = 처음 값: 대분류 1 ~ 12 · 세부 1 ~ 90 이 표 순서, 되돌리기도 됨', () => {
    expect(categorySeedId('food')).toBe(1)
    expect(categorySeedId('sports')).toBe(2)
    expect(interestSeedId('restaurant_tour')).toBe(1)
    expect(interestSeedId('fitness_yoga')).toBe(8)
    expect(interestSeedId('running')).toBe(9)
    const subs = rows.flatMap((r) => r.subs)
    expect(interestCodeOfName(subs[89])).toBe(interestCodeOfSeed(90))
    expect(categoryCodeOfSeed(12)).toBe(categoryCodeOfName(rows[11].cat))
    expect(interestCodeOfSeed(91)).toBeNull()
  })
  it('이름 비교는 공백을 무시함 ("음식 · 음료" = "음식·음료")', () => {
    expect(categoryCodeOfName('음식 · 음료')).toBe('food')
    expect(interestCodeOfName(' 카페/커피 ')).toBe('cafe_coffee')
    expect(interestCodeOfName('없는 관심사')).toBeNull()
  })
})

describe('받은 목록 → 앱 모양 · 요청 id', () => {
  // 실제 서버처럼 DB 숫자 id. 잇기는 이름으로 하므로 id 가 처음 값 순서와 달라도 됨 (일부러 다르게)
  const dto = { items: [
    { id: 1, name: '음악·댄스', interests: [{ id: 46, name: 'K-POP', userCount: 128 }, { id: 48, name: '작곡/미디/DJ', userCount: 4 }] },
    { id: 3, name: '스포츠', interests: [{ id: 12, name: '러닝/마라톤', userCount: 57 }, { id: 99, name: '새로 생긴 관심사', userCount: 0 }] },
  ] }
  const cat = toInterestCatalog(dto)
  it('대분류 · 관심사가 앱 코드 · 이모지 · 색으로, 칩 숫자는 userCount', () => {
    expect(cat.categories.map((c) => c.id)).toEqual(['music_dance', 'sports'])
    expect(cat.categories[0].emoji).toBe('🎵')
    expect(cat.categories[0].tags[0]).toEqual({ id: 'kpop', name: 'K-POP', count: 128 })
  })
  it('표에 없는 관심사는 코드 없이 보이고 unmapped 에 남음', () => {
    expect(cat.categories[1].tags[1].id).toBe('interest-99')
    expect(cat.unmapped).toEqual(['스포츠 / 새로 생긴 관심사'])
  })
  it('앱 이름 목록 → 서버 id (고른 순서 그대로), 대분류 id → 코드', () => {
    expect(interestIdsOf(['러닝/마라톤', 'K-POP'], cat)).toEqual([12, 46])
    expect(() => interestIdsOf(['없는 관심사'], cat)).toThrow()
    expect(cat.categoryCodeOfId.get(toAppId(3))).toBe('sports')
  })
})
