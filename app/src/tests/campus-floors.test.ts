import { describe, expect, it } from 'vitest'
import { CAMPUSES, CAMPUS_FLOORS, CAMPUS_SHOW_ORDER, campusesInOrder, floorsOf } from '../data/campusFloors'
import { CAMPUS_FLOORS as FIELD_FLOORS } from '../data/field'

// 02 F2 회원가입 3 · 00 공통 19 · 05 탐색 · 방문: 캠퍼스·층 목록은 한 곳, 보이는 순서는 서울·대전·부울경·구미·광주
describe('캠퍼스 · 층 목록 한 곳', () => {
  it('탐색 들판이 같은 데이터를 씀', () => {
    expect(FIELD_FLOORS).toBe(CAMPUS_FLOORS)
  })
  it('화면 순서는 05 명세대로', () => {
    expect(CAMPUSES).toEqual(['서울', '대전', '부울경', '구미', '광주'])
    expect(campusesInOrder().map((c) => c.campus)).toEqual(CAMPUS_SHOW_ORDER)
  })
  it('화면 순서를 바꿔도 데이터 순서(작물 돌려 쓰기 기준)는 그대로', () => {
    expect(CAMPUS_FLOORS.map((c) => c.campus)).toEqual(['서울', '대전', '광주', '구미', '부울경'])
  })
  it('회원가입 3 층 목록 = 탐색 들판의 층', () => {
    expect(floorsOf('서울')).toEqual([2, 3, 12])
    expect(floorsOf('없는곳')).toEqual([])
  })
})
