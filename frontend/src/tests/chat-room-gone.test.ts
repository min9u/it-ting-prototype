/**
 * 나간 대화방에 뒤로 가기로 돌아와 다시 불러온 결과가 404 면, 받아 둔 대화보다 없음 안내가 먼저 (PR #37 Codex 리뷰 P1, 명세 06)
 */
import { describe, expect, it } from 'vitest'
import { ApiError } from '../api/client'
import { roomPaneView } from '../screens/chat/Chat'

describe('roomPaneView', () => {
  it('받아 둔 대화가 있어도 404 CHAT_ROOM_NOT_FOUND 면 없음 안내', () => {
    expect(roomPaneView({ data: { id: '1' }, error: new ApiError(404, 'CHAT_ROOM_NOT_FOUND', '없음'), isPending: false })).toBe('notFound')
  })
  it('일시적인 실패면 받아 둔 대화를 계속', () => {
    expect(roomPaneView({ data: { id: '1' }, error: new ApiError(0, 'NETWORK', '끊김'), isPending: false })).toBe('room')
  })
  it('처음 불러오는 중 · 처음부터 실패', () => {
    expect(roomPaneView({ error: null, isPending: true })).toBe('loading')
    expect(roomPaneView({ error: new ApiError(500, 'INTERNAL_ERROR', '서버'), isPending: false })).toBe('error')
  })
})
