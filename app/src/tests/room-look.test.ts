/**
 * 땅굴 방 모습 한 곳 (data/roomLook.ts) — 2026-11-18 1단계 "벽지 문제" (docs/room-diversity-2-2026-11-18.md)
 * 근거
 * - 00 공통 5 · F3 3a-3: 땅굴 무드 = 대표 관심사(맨 앞)의 대분류. 온보딩 문구 "맨 앞 관심사가 땅굴 분위기를 정해요"
 * - spec-design-gaps G-31: 내가 보는 내 방과 남이 보는 내 방이 달랐음 (남이 볼 때만 예전 가중치 규칙)
 * - API v1 (2026-11-22): GET /users/{userId}/burrow 는 가구 · 무드를 주지 않음 (04 "가구와 땅굴 무드는 저장하지도 주지도 않는다").
 *   방문자 뷰는 관심사로만 계산 → 예전 "저장한 방(room)이 방문자 뷰에 그대로" 시험은 뺐고, 저장한 값 검사는 roomLookOf 에 바로 줌
 * 목 저장소(sessionStorage · 메모리)를 시험마다 새로 쓰려고 모듈을 다시 불러옴
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as LookMod from '../data/roomLook'
import type * as MyMod from '../data/myBurrow'
import type * as MapMod from '../api/explore/mappers'
import type * as BurrowsMod from '../api/explore/mock'
import type * as InterestsMod from '../data/interests'
import type * as IdsMod from '../api/common/ids'
import { INTEREST_SUBS } from '../data/interests'
import { wallpaperForCategory } from '../data/wallpapers'
import { ME_ID, USERS } from '../data/mock'

let L: typeof LookMod, M: typeof MyMod, P: typeof MapMod, B: typeof BurrowsMod, I: typeof InterestsMod, D: typeof IdsMod

beforeEach(async () => {
  sessionStorage.clear()
  vi.resetModules()
  I = await import('../data/interests')
  L = await import('../data/roomLook')
  M = await import('../data/myBurrow')
  P = await import('../api/explore/mappers')
  B = await import('../api/explore/mock')
  D = await import('../api/common/ids')
})

const subsOf = (cat: string) => INTEREST_SUBS.filter((s) => s.category === cat)
/** 방문자 뷰가 하는 일 그대로: 남의 땅굴 API(목 서버) → toBurrow → roomLookOf (관심사로만) */
async function visitLook(id: string) {
  const b = P.toBurrow(await B.mock.userBurrow(D.toDtoId(id)))
  return L.roomLookOf(b.owner.id, b.owner.interests)
}
/** 내 땅굴이 하는 일 그대로 (screens/burrow/MyBurrow.tsx) */
const myLook = () => L.roomLookOf(ME_ID, I.getMyInterests(USERS[ME_ID].interests), L.NO_SAVED_ROOM)

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
  it('다른 사람 땅굴은 관심사(대표 관심사의 대분류)로만 계산 (서버가 방 꾸미기 값을 주지 않음)', async () => {
    const v = await visitLook('yerin')
    expect(v.from.wallpaper).toBe('auto')
    expect(v.wallpaper).toBe(wallpaperForCategory(L.leadCategoryOf(USERS.yerin.interests) ?? undefined))
  })
  it('관심사를 바꾸면 계산 값이 따라가고(저장 안 함), 가구는 고르지 않아 늘 빈 값(= 맨 앞 단어)', async () => {
    const book = subsOf('book').slice(0, 3).map((s) => s.name_ko)
    I.setMyInterests(book)
    const v = await visitLook(ME_ID)
    expect(v.lead).toBe('book')
    expect(v.wallpaper).toBe(wallpaperForCategory('book'))
    expect(v.furniture).toEqual({})
    expect(v).toEqual(myLook())
  })
})

describe('저장한 방 값 검사 (roomLookOf 에 저장한 값을 줄 때)', () => {
  const names = ['카페/커피', '영화', '축구'] // 카페/커피 = 단어 고르기(카페 · 커피)

  it('저장한 게 없으면 계산', () => {
    expect(L.roomLookOf('u1', names, null).from.wallpaper).toBe('auto')
  })
  it('모르는 벽지 id 는 버리고 계산 값', () => {
    expect(L.roomLookOf('u1', names, { wallpaperId: 'wallpaper_99_none', furniture: {}, themeId: null }).wallpaper).toBe(wallpaperForCategory('food'))
  })
  it('관심사에 없는 선택 · 고를 수 없는 단어는 버림, 고를 수 있는 단어는 남김 (v3.8)', () => {
    const first = INTEREST_SUBS.find((s) => s.name_ko === names[0])!
    const cand = M.wordChoices(first.id)
    // 영화는 한 단어(고정)라 고를 게 없음, 모르는 단어 · 관심사에 없는 소분류도 버림
    const look = L.roomLookOf('u1', names, { wallpaperId: null, themeId: null, furniture: { [first.id]: cand.at(-1)!, [INTEREST_SUBS.find((s) => s.name_ko === names[1])!.id]: '영화', baseball: '야구' } })
    expect(look.furniture).toEqual({ [first.id]: cand.at(-1)! })
  })
})
