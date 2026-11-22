/**
 * 새 학기 안내 (명세 05 "땅굴 메인 – 새 학기 안내" · 00 공통 19 · 04 내 정보 수정)
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as Field from '../data/field'
import type * as NT from '../data/newTerm'
import type * as MB from '../data/myBurrow'

const FS = 'node:fs' // @types/node 가 없어서 문자열로 불러 타입 검사를 피함 (vitest 는 app/ 에서 실행)
const fs = (await import(/* @vite-ignore */ FS)) as { readFileSync(p: string, enc: string): string }

let F: typeof Field, N: typeof NT, M: typeof MB
beforeEach(async () => {
  try { localStorage.clear(); sessionStorage.clear() } catch { /* 저장소 없는 환경 */ }
  vi.resetModules()
  F = await import('../data/field'); M = await import('../data/myBurrow'); N = await import('../data/newTerm')
})

describe('새 학기 안내 뜨는 조건', () => {
  it('새 학기가 안 열렸으면 안내 없음, 열렸는데 안 골랐으면 뜸, 고르면 사라짐', () => {
    expect(N.isNewTermPending()).toBe(false)
    N.openNewTerm()
    expect(N.isNewTermPending()).toBe(true)
    N.chooseNewTermFloor('서울', 3)
    expect(N.isNewTermPending()).toBe(false)
  })
  it('고른 뒤에는 다시 안 뜸 (여러 번 열어도)', () => {
    N.openNewTerm(); N.chooseNewTermFloor('대전', 2)
    N.openNewTerm()
    expect(N.isNewTermPending()).toBe(true) // 시연 손잡이는 처음부터 다시 켜는 것
    N.chooseNewTermFloor('대전', 2)
    expect(N.isNewTermPending()).toBe(false)
  })
  it('지난 학기에 땅굴이 있던 자리를 기억함 (안내에서 처음 선택해 둠)', () => {
    N.openNewTerm()
    expect(N.newTermStore.get()).toMatchObject({ lastCampus: '서울', lastFloor: 2 })
  })
})

describe('이 층으로 정하기 → 내 땅굴 이사', () => {
  it('내 땅굴 · 프로필의 캠퍼스 · 층이 고른 값으로 바뀜', () => {
    N.openNewTerm()
    N.chooseNewTermFloor('대전', 2)
    expect(F.MY_FLOOR).toMatchObject({ campus: '대전', floor: 2, id: F.floorId(F.CURRENT_TERM, '대전', 2) })
    expect(M.getMyProfile()).toMatchObject({ campus: '대전', floor: 2 })
    expect(F.ME_HOME).toMatchObject({ campus: '대전', floor: 2 })
  })
  it('새 들판에 내 땅굴이 놓이고, 지난 들판의 자리는 비어 입구가 남지 않음', () => {
    const old = { ...F.MY_FLOOR }
    N.openNewTerm()
    N.chooseNewTermFloor('광주', 1)
    expect(F.fieldOf(F.MY_FLOOR).residents.some((r) => r.mine)).toBe(true)
    expect(F.fieldOf(F.MY_FLOOR).mySeat).toBe(F.MY_SEAT)
    expect(F.fieldOf(old).residents.some((r) => r.mine)).toBe(false)
    expect(F.fieldOf(old).mySeat).toBeNull()
    expect(F.locateUser('me')?.floor.id).toBe(F.MY_FLOOR.id)
  })
  it('방명록 · 단골 · 방의 모습은 그대로 (단골 목록이 안 바뀜)', () => {
    const regulars = [...F.getRegulars()]
    N.openNewTerm(); N.chooseNewTermFloor('구미', 2)
    expect(F.getRegulars()).toEqual(regulars)
  })
  it('시연 되돌림(?newterm=0): 지난 학기 자리로 돌아가고 안내가 꺼짐', () => {
    N.openNewTerm(); N.chooseNewTermFloor('광주', 1)
    N.resetNewTerm()
    expect(F.MY_FLOOR).toMatchObject({ campus: '서울', floor: 2 })
    expect(N.isNewTermPending()).toBe(false)
  })
})

describe('내 정보 수정에서 캠퍼스 · 층을 바꾸면 땅굴도 이사 (명세 04)', () => {
  it('프로필 저장 → 내 땅굴 위치(MY_FLOOR)가 따라감', () => {
    M.setMyProfile({ campus: '부울경', floor: 1 })
    expect(F.MY_FLOOR).toMatchObject({ campus: '부울경', floor: 1 })
    expect(F.fieldOf(F.MY_FLOOR).mySeat).toBe(F.MY_SEAT)
  })
})

describe('닫을 수 없음 (명세 05 새 학기 안내 4)', () => {
  const src = fs.readFileSync('src/screens/burrow/NewTermNotice.tsx', 'utf8')
  it('× · 나중에 하기가 없고, 닫기 동작이 비어 있어 Esc · 바깥 클릭으로 안 닫힘', () => {
    const view = src.slice(src.indexOf('export function NewTermNotice'))
    expect(view).not.toContain('나중에')
    expect(view).not.toContain('CloseIcon')
    expect(view).toContain('hideClose')
    expect(view).toMatch(/onClose=\{\(\) => undefined\}/)
  })
})
