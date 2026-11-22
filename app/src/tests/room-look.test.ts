/**
 * 땅굴 방 모습 한 곳 (data/roomLook.ts) — 2026-11-18 1단계 "벽지 문제" (docs/room-diversity-2-2026-11-18.md)
 * 근거
 * - 00 공통 5 · F3 3a-3: 땅굴 무드 = 대표 관심사(맨 앞)의 대분류. 온보딩 문구 "맨 앞 관심사가 땅굴 분위기를 정해요"
 * - spec-design-gaps G-31: 내가 보는 내 방과 남이 보는 내 방이 달랐음 (남이 볼 때만 예전 가중치 규칙)
 * - api-draft 2.3: GET /burrows/{memberId} 의 room (집주인이 저장한 방) → 방문자 뷰가 그대로 씀
 * 목 저장소(sessionStorage · 메모리)를 시험마다 새로 쓰려고 모듈을 다시 불러옴
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as LookMod from '../data/roomLook'
import type * as MyMod from '../data/myBurrow'
import type * as MapMod from '../api/explore/mappers'
import type * as BurrowsMod from '../api/explore/mock'
import type * as InterestsMod from '../data/interests'
import type { BurrowDto, RoomLayoutDto } from '../api/explore/types'
import { INTEREST_SUBS } from '../data/interests'
import { wallpaperForCategory } from '../data/wallpapers'
import { ME_ID, USERS } from '../data/mock'

let L: typeof LookMod, M: typeof MyMod, P: typeof MapMod, B: typeof BurrowsMod, I: typeof InterestsMod

beforeEach(async () => {
  sessionStorage.clear()
  vi.resetModules()
  I = await import('../data/interests')
  L = await import('../data/roomLook')
  M = await import('../data/myBurrow')
  P = await import('../api/explore/mappers')
  B = await import('../api/explore/mock')
})

const subsOf = (cat: string) => INTEREST_SUBS.filter((s) => s.category === cat)
/** 방문자 뷰가 하는 일 그대로: 땅굴 API(목 서버) → toBurrow → roomLookOf */
async function visitLook(id: string) {
  const b = P.toBurrow(await B.mock.get(id))
  return L.roomLookOf(b.owner.id, b.owner.interests, b.room)
}
/** 내 땅굴이 하는 일 그대로 (screens/burrow/MyBurrow.tsx) */
const myLook = () => L.roomLookOf(ME_ID, I.getMyInterests(USERS[ME_ID].interests), { ...M.getMyRoomPick(), furniture: M.getMyFurnChoice() })

describe('계산 규칙: 대표 관심사(맨 앞)의 대분류', () => {
  it('맨 앞 관심사의 대분류로 벽지를 정함 (뒤에 드문 관심사가 있어도)', () => {
    const music = subsOf('music_dance')[0], art = subsOf('art_craft')[0]
    const look = L.roomLookOf('x', [music.name_ko, art.name_ko, art.id])
    expect(look.lead).toBe('music_dance')
    expect(look.wallpaper).toBe(wallpaperForCategory('music_dance'))
    expect(look.from.wallpaper).toBe('auto')
  })
  it('모르는 이름(예전 관심사)은 건너뛰고 그다음을 대표로', () => {
    const book = subsOf('book')[0]
    expect(L.roomLookOf('x', ['없는관심사', book.name_ko]).lead).toBe('book')
  })
  it('관심사가 없으면 기본 벽지', () => {
    expect(L.roomLookOf('x', []).wallpaper).toBe(wallpaperForCategory(undefined))
  })
  it('내 목 관심사(맨 앞 캠핑/글램핑)면 아웃도어 → 예전 남의 땅굴 규칙(08 줄무늬)이 아니라 같은 값', () => {
    const look = L.roomLookOf(ME_ID, USERS[ME_ID].interests)
    expect(look.lead).toBe('outdoor')
    expect(look.wallpaper).toBe(wallpaperForCategory('outdoor'))
  })
})

describe('같은 사람은 내 땅굴과 방문자 뷰가 같은 방', () => {
  it('꾸민 게 없을 때', async () => {
    expect(await visitLook(ME_ID)).toEqual(myLook())
  })
  it('꾸미기에서 고른 가구 · 직접 고른 벽지 · 색 테마가 방문자 뷰에 그대로', async () => {
    // v3.8: "/"로 묶인 소분류는 단어 중 하나를 고름. 그 소분류 하나를 두 번째 단어로 바꿈
    I.setMyInterests(['카페/커피', '주류/와인/위스키', '영화'])
    const sub = INTEREST_SUBS.find((s) => s.name_ko === '카페/커피')!
    const alt = M.wordChoices(sub.id)[1]
    M.setMyFurnChoice({ [sub.id]: alt })
    M.setMyRoomPick({ wallpaperId: 'wallpaper_02_stars', themeId: 'cat_game' })
    const v = await visitLook(ME_ID)
    expect(v.wallpaper).toBe('wallpaper_02_stars')
    expect(v.from.wallpaper).toBe('saved')
    expect(v.furniture).toEqual({ [sub.id]: alt })
    expect(v.style?.theme).toBe('cat_game') // 꾸미기 색 탭에서 고른 색 테마 (2단계)
    expect(v).toEqual(myLook())
  })
  it('다른 사람이 저장한 방(서버 room)도 그대로', async () => {
    B.mockRooms.set('yerin', { schemaVersion: 1, wallpaperId: 'wallpaper_07_forest', furniture: {} })
    const v = await visitLook('yerin')
    expect(v.wallpaper).toBe('wallpaper_07_forest')
    B.mockRooms.clear()
    const auto = await visitLook('yerin')
    expect(auto.from.wallpaper).toBe('auto')
    expect(auto.wallpaper).toBe(wallpaperForCategory(L.leadCategoryOf(USERS.yerin.interests) ?? undefined))
  })
  it('관심사를 바꾸면 계산 값이 따라가고(저장 안 함), 뺀 관심사의 가구는 사라짐', async () => {
    const book = subsOf('book').slice(0, 3).map((s) => s.name_ko)
    M.setMyFurnChoice({ [INTEREST_SUBS.find((s) => s.name_ko === I.getMyInterests(USERS[ME_ID].interests)[1])!.id]: 'whatever' })
    I.setMyInterests(book)
    const v = await visitLook(ME_ID)
    expect(v.lead).toBe('book')
    expect(v.wallpaper).toBe(wallpaperForCategory('book'))
    expect(v.furniture).toEqual({})
    expect(v).toEqual(myLook())
  })
})

describe('저장한 방 값 검사 (api/mappers toSavedRoom → roomLookOf)', () => {
  const owner = (names: string[]) => ({
    id: 'u1', nickname: 'u', status: 'ACTIVE', mole: { head: null, face: null, neck: null, hand: null },
    intro: null, online: false, answers: [],
    interests: names.map((name, i) => ({ interestId: String(100 + i), name, categoryId: '', sortOrder: i, furniture: null as string | null })),
  })
  const dto = (room: RoomLayoutDto | null, names: string[]) => ({
    id: 'b-u1', owner: owner(names), entrance: null, regular: false, regularCount: 0, visitorsNow: 0, chatRoomId: null, pendingRequestId: null, room,
  }) as unknown as BurrowDto
  const names = ['카페/커피', '영화', '축구'] // 카페/커피 = 단어 고르기(카페 · 커피)

  it('저장한 게 없으면 null → 계산', () => {
    expect(P.toBurrow(dto(null, names)).room).toBeNull()
  })
  it('모르는 벽지 id 는 버리고 계산 값', () => {
    const b = P.toBurrow(dto({ schemaVersion: 1, wallpaperId: 'wallpaper_99_none', furniture: {} }, names))
    expect(L.roomLookOf(b.owner.id, b.owner.interests, b.room).wallpaper).toBe(wallpaperForCategory('food'))
  })
  it('관심사에 없는 선택 · 고를 수 없는 단어는 버림, 고를 수 있는 단어는 남김 (v3.8)', () => {
    const first = INTEREST_SUBS.find((s) => s.name_ko === names[0])!
    const cand = M.wordChoices(first.id)
    // 영화는 한 단어(고정)라 고를 게 없음, 모르는 단어 · 관심사에 없는 소분류도 버림
    const b = P.toBurrow(dto({ schemaVersion: 1, wallpaperId: null, furniture: { [first.id]: cand.at(-1)!, [INTEREST_SUBS.find((s) => s.name_ko === names[1])!.id]: '영화', baseball: '야구' } }, names))
    const look = L.roomLookOf(b.owner.id, b.owner.interests, b.room)
    expect(look.furniture).toEqual({ [first.id]: cand.at(-1)! })
  })
  it('관심사마다 온 member_interest.furniture 도 받음 (interestId 가 숫자여도 이름으로 찾음)', () => {
    const first = INTEREST_SUBS.find((s) => s.name_ko === names[0])!
    const cand = M.wordChoices(first.id)
    const d = dto(null, names)
    d.owner.interests[0].furniture = cand.at(-1)!
    const b = P.toBurrow(d)
    expect(b.room?.furniture).toEqual({ [first.id]: cand.at(-1)! })
  })
})
