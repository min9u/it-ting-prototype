/**
 * 모임 카테고리 (명세 07 "모임 – 리스트" 3 · "카테고리", 2026-11-22)
 * 모임 전용 분류로 관심사와 관계없다. 모임 하나는 카테고리 하나를 가진다.
 * 목록 칩 필터 · 만들기 폼 · 카드·상세 칩 · 카드 색(표지판) · 캘린더 라벨 색을 정한다.
 * 순서·이름은 명세 그대로 (Figma 시안은 스터디·프로젝트를 나눠 7칸이지만 명세가 6개로 합쳤고, 명세를 따름).
 * code 는 백엔드 확정 enum (api/07-meetup.md "카테고리": HOBBY · FOOD · STUDY · ETC · GAME · EXERCISE, 2026-11-22).
 */
import type { Tone } from './types'

export interface MeetupCategory {
  id: string
  /** 화면에 보이는 이름 (= Meetup.category 값) */
  name: string
  tone: Tone
  /** 서버 enum (MeetupCategoryCode) */
  code: 'HOBBY' | 'FOOD' | 'STUDY' | 'ETC' | 'GAME' | 'EXERCISE'
}

export const MEETUP_CATEGORIES: readonly MeetupCategory[] = [
  { id: 'hobby_culture', name: '취미/문화', tone: 'butter', code: 'HOBBY' },
  { id: 'meal_cafe', name: '식사/카페', tone: 'mint', code: 'FOOD' },
  { id: 'study_project', name: '스터디/프로젝트', tone: 'clay', code: 'STUDY' },
  { id: 'etc', name: '기타', tone: 'sand', code: 'ETC' },
  { id: 'game', name: '게임', tone: 'lilac', code: 'GAME' },
  { id: 'sports', name: '운동', tone: 'sage', code: 'EXERCISE' },
]

const BY = new Map<string, MeetupCategory>(MEETUP_CATEGORIES.flatMap((c) => [[c.name, c], [c.id, c], [c.code, c]] as const))

/** 이름 · id · 코드 어느 것으로든 찾음 (모르면 undefined) */
export const meetupCategoryOf = (v: string | null | undefined): MeetupCategory | undefined => (v ? BY.get(v) : undefined)
/** 카드·칩 색. 모르는 값은 모래색 */
export const meetupToneOf = (v: string | null | undefined): Tone => meetupCategoryOf(v)?.tone ?? 'sand'
export const isMeetupCategory = (v: string): boolean => BY.has(v)
