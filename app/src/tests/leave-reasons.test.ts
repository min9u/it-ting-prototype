/** F10 회원 탈퇴 2 (팀 명세 11-20): 탈퇴 사유 여섯 가지, 기타에도 글 칸 없음 */
import { describe, expect, it } from 'vitest'
import { LEAVE_REASONS, leaveLog } from '../data/account'

describe('F10 탈퇴 사유', () => {
  it('명세의 여섯 가지 그대로, 순서도 같음', () => {
    expect([...LEAVE_REASONS]).toEqual(['자주 쓰지 않아요', 'SSAFY 과정이 끝났어요', '맞는 사람이나 모임을 찾지 못했어요', '쓰기 불편해요', '불쾌한 일을 겪었어요', '기타'])
  })
  it('관리자 화면에 모아 보는 예시 사유도 이 목록 안의 것', () => {
    for (const r of leaveLog.get().reasons) expect(LEAVE_REASONS as readonly string[]).toContain(r.reason)
  })
})
