/**
 * 차단 기능 잔여 코드 제거 (팀 명세 spec/README "이번 범위에 없는 것: 차단 기능", 2026-11-22)
 * - 계정 저장소에 차단 목록 · 함수가 없다
 * - 예전 브라우저에 `digul.account.v1` 의 blocked 값이 남아 있어도 채팅 목록이 그 사람을 숨기지 않는다 (목 서버가 더는 거르지 않음)
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => {
  sessionStorage.setItem('digul.api.knobs', 'fast') // 목 서버 지연 없이
  window.history.replaceState(null, '', '/?api=fast&rt=quiet')
  localStorage.clear()
  vi.resetModules()
})

describe('차단 잔여 코드 없음', () => {
  it('data/account 에 차단 값 · 함수가 없음', async () => {
    const A = await import('../data/account')
    for (const name of ['blockUser', 'unblockUser', 'isBlocked', 'useBlocked']) expect(name in A, name).toBe(false)
    expect('blocked' in A.accountStore.get()).toBe(false)
  })

  it('예전 저장값에 blocked 가 있어도 그 사람의 1:1 대화방이 목록에 그대로 나옴', async () => {
    localStorage.setItem('digul.account.v1', JSON.stringify({ blocked: [{ id: 'yerin', nickname: '예린', blockedAt: '2026.11.05' }] }))
    const M = await import('../api/chat/mock')
    const I = await import('../api/common/ids')
    const rooms = await M.mock.rooms()
    expect(rooms.items.some((r) => I.toAppId(r.id) === 'r-yerin')).toBe(true)
  })
})
