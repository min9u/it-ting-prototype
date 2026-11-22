/**
 * 모임 카테고리 (명세 07 "모임 – 리스트" 3 · "카테고리")
 * - 모임 전용 6개: 취미/문화, 식사/카페, 스터디/프로젝트, 기타, 게임, 운동 (순서 그대로)
 * - 관심사와 관계없음: 관심사 이름은 카테고리가 아니고, 모임 하나는 카테고리 하나
 * - 목록은 카테고리 코드로 거름 (여러 개 OR, 다른 필터와 AND)
 */
import { describe, expect, it } from 'vitest'
import { MEETUP_CATEGORIES, isMeetupCategory, meetupCategoryOf, meetupToneOf } from '../data/meetupCategory'
import { MEETUPS } from '../data/mock'
import { getMeetupState } from '../data/meetupStore'
import { subOf } from '../data/interests'
import { toMeetup } from '../api/meetups/mappers'
import { meetupsApi } from '../api/meetups'

describe('모임 카테고리 6개', () => {
  it('명세 순서·이름 그대로, id · 코드 · 이름이 겹치지 않음', () => {
    expect(MEETUP_CATEGORIES.map((c) => c.name)).toEqual(['취미/문화', '식사/카페', '스터디/프로젝트', '기타', '게임', '운동'])
    for (const k of ['id', 'name', 'code'] as const) expect(new Set(MEETUP_CATEGORIES.map((c) => c[k])).size).toBe(6)
  })
  it('코드는 백엔드 확정 enum 6개 (api/07 "카테고리")', () => {
    expect(MEETUP_CATEGORIES.map((c) => c.code)).toEqual(['HOBBY', 'FOOD', 'STUDY', 'ETC', 'GAME', 'EXERCISE'])
  })
  it('이름 · id · 코드로 찾고, 관심사 이름은 카테고리가 아님', () => {
    expect(meetupCategoryOf('GAME')?.name).toBe('게임')
    expect(meetupCategoryOf('sports')?.name).toBe('운동')
    expect(isMeetupCategory('소설')).toBe(false)
    expect(isMeetupCategory('보드게임')).toBe(false)
    expect(meetupToneOf('모름')).toBe('sand')
  })
  it('모임 목 데이터는 모두 카테고리 하나를 가지고 6개가 모두 쓰임', () => {
    const all = [...MEETUPS, ...getMeetupState().list]
    for (const m of all) expect(isMeetupCategory(m.category), `${m.id}: ${m.category}`).toBe(true)
    expect(new Set(all.map((m) => m.category)).size).toBe(6)
  })
  it('카테고리 이름은 소분류 관심사 이름과 겹치지 않음 (관심사와 관계없는 분류)', () => {
    for (const c of MEETUP_CATEGORIES) expect(subOf(c.name), c.name).toBeUndefined()
  })
})

describe('API: 코드 ↔ 이름', () => {
  it('DTO 코드를 화면 이름으로 바꿔 읽음 (모르는 값은 그대로)', () => {
    const base = { id: 1, title: 't', startsAt: '2026-11-08T05:00:00Z', endsAt: null, mode: 'OFFLINE', place: 'p', capacity: 4, confirmedCount: 1, recruitStatus: 'OPEN' }
    expect(toMeetup({ ...base, category: 'STUDY' } as never).category).toBe('스터디/프로젝트')
    expect(toMeetup({ ...base, category: 'EXERCISE' } as never).category).toBe('운동')
    expect(toMeetup({ ...base, category: '새 분류' } as never).category).toBe('새 분류')
  })
  it('목록 거르기: 카테고리 코드 여러 개는 OR', async () => {
    const r = await meetupsApi.list({ categories: ['GAME', 'EXERCISE'], size: 24 })
    expect(r.items.length).toBeGreaterThan(0)
    for (const m of r.items) expect(['게임', '운동']).toContain(meetupCategoryOf(m.category)?.name)
  })
})
