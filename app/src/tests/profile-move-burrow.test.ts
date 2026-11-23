/**
 * 내 정보 수정에서 캠퍼스-층을 바꾸면 내 땅굴이 그 들판으로 이사 (명세 04 "캠퍼스-층을 저장할 때", api 04)
 * - 프로필과 다름: 입구를 이번 학기의 새 층으로 + 자리는 새 들판의 다음 번호 (이전 자리는 비어 탐색 들판에서도 사라짐)
 * - 프로필과 같음: 아무것도 안 바꿈 (닉네임만 저장해도 자리 그대로, 새 학기 안내 시연도 안 풀림)
 * - 새로고침: 저장해 둔 프로필의 캠퍼스-층에 입구도 맞춰짐
 * 장면마다 모듈을 새로 불러와 (vi.resetModules) 앞 시험의 이사가 이어지지 않게 함
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => { vi.resetModules(); sessionStorage.clear() }) // 프로필은 sessionStorage 에 저장됨 (data/myBurrow)

async function load() {
  const F = await import('../data/field')
  const M = await import('../data/myBurrow')
  return { F, M }
}

describe('내 정보 수정 → 땅굴 이사', () => {
  it('캠퍼스-층을 바꿔 저장하면 입구가 이번 학기 그 들판으로 옮겨지고, 들판에 내가 거기 있음', async () => {
    const { F, M } = await load()
    expect(F.MY_FLOOR).toMatchObject({ campus: '서울', floor: 2 })
    M.setMyProfile({ campus: '대전', floor: 1 })
    expect(F.MY_FLOOR).toMatchObject({ campus: '대전', floor: 1, term: F.CURRENT_TERM })
    expect(F.ME_HOME).toMatchObject({ campus: '대전', floor: 1 })
    const e = F.myEntrance()
    expect(e.floor.id).toBe(F.floorId(F.CURRENT_TERM, '대전', 1))
    expect(e.seat).not.toBe(F.MY_SEAT)
    const mine = F.fieldOf(F.MY_FLOOR).residents.find((r) => r.mine)
    expect(mine?.seat).toBe(e.seat)
    // 있던 들판(서울-2층)에서는 빠짐
    const seoul2 = { id: F.floorId(F.CURRENT_TERM, '서울', 2), term: F.CURRENT_TERM, campus: '서울', floor: 2 }
    expect(F.fieldOf(seoul2).residents.some((r) => r.mine)).toBe(false)
  })

  it('원래 층(서울-2층)으로 되돌리면 처음 자리(13번)로 돌아옴', async () => {
    const { F, M } = await load()
    M.setMyProfile({ campus: '대전', floor: 1 })
    M.setMyProfile({ campus: '서울', floor: 2 })
    expect(F.myEntrance().seat).toBe(F.MY_SEAT)
    expect(F.fieldOf(F.MY_FLOOR).residents.find((r) => r.mine)?.seat).toBe(F.MY_SEAT)
  })

  it('같은 캠퍼스-층으로 저장하면(닉네임만 바꿈) 자리가 그대로', async () => {
    const { F, M } = await load()
    M.setMyProfile({ campus: '대전', floor: 1 })
    const seat = F.myEntrance().seat
    M.setMyProfile({ nickname: '새로운두더지' })
    expect(F.myEntrance().seat).toBe(seat)
    expect(F.MY_FLOOR).toMatchObject({ campus: '대전', floor: 1 })
  })

  it('새 학기 안내 시연 중에 같은 층으로 저장해도 시연이 안 풀림 (입구는 지난 학기 들판)', async () => {
    const { F, M } = await load()
    F.startNewTermDemo()
    expect(F.isNewTermPending()).toBe(true)
    M.setMyProfile({ nickname: '새로운두더지' })
    expect(F.isNewTermPending()).toBe(true)
    expect(F.myEntrance().floor.term).not.toBe(F.CURRENT_TERM)
  })

  it('저장해 둔 프로필이 다른 층이면, 새로 열었을 때(새로고침) 입구도 그 층 (프로필과 탐색이 어긋나지 않음)', async () => {
    sessionStorage.setItem('digul.myProfile', JSON.stringify({ campus: '대전', floor: 1 }))
    const { F, M } = await load()
    expect(F.MY_FLOOR).toMatchObject({ campus: '서울', floor: 2 }) // 아직 안 읽음
    M.getMyProfile()
    expect(F.MY_FLOOR).toMatchObject({ campus: '대전', floor: 1 })
    expect(F.myEntrance().floor.id).toBe(F.floorId(F.CURRENT_TERM, '대전', 1))
  })
})
