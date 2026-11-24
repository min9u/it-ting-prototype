/**
 * 댓글을 다 받기 전에 새 댓글을 써도 등록순이 깨지지 않는지 (명세 08 댓글 등록순, PR #37 Codex 리뷰 P1).
 * 20개 중 10개만 받은 상태에서 21번째를 쓰면 1 ~ 10, 21, 11 ~ 20 이 아니라 1 ~ 21
 */
import { describe, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import type { CommentThreadVM } from '../api/community/mappers'

const { communityApi } = await import('../api/community/api')
const { appendTopComment, communityKeys, flattenComments } = await import('../api/community/queries')

const c = (n: number) => ({ id: String(n), replies: [] }) as unknown as CommentThreadVM
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => c(a + i))

describe('새 댓글 넣기 (appendTopComment)', () => {
  it('안 받은 페이지가 있으면 남은 페이지를 받은 뒤라서 순서가 등록순', async () => {
    const qc = new QueryClient()
    const key = communityKeys.comments('p1')
    qc.setQueryData(key, { pages: [{ items: range(1, 10), nextCursor: 'c10', hasNext: true }], pageParams: [null] })
    // 서버의 다음 페이지에는 11 ~ 20 과 방금 쓴 21 이 있음
    const spy = vi.spyOn(communityApi, 'comments').mockResolvedValue({ items: [], nextCursor: null, hasNext: false })
    const mappers = await import('../api/community/mappers')
    const map = vi.spyOn(mappers, 'toCommentThread')
    spy.mockResolvedValueOnce({ items: range(11, 21), nextCursor: null, hasNext: false } as never)
    map.mockImplementation((x) => x as unknown as CommentThreadVM)
    await appendTopComment(qc, 'p1', c(21))
    const ids = flattenComments(qc.getQueryData(key)).map((x) => x.id)
    expect(ids).toEqual(range(1, 21).map((x) => x.id))
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore(); map.mockRestore()
  })

  it('다 받은 상태면 받은 목록 끝에 붙임 (서버를 다시 부르지 않음)', async () => {
    const qc = new QueryClient()
    const key = communityKeys.comments('p2')
    qc.setQueryData(key, { pages: [{ items: range(1, 3), nextCursor: null, hasNext: false }], pageParams: [null] })
    const spy = vi.spyOn(communityApi, 'comments')
    await appendTopComment(qc, 'p2', c(4))
    expect(flattenComments(qc.getQueryData(key)).map((x) => x.id)).toEqual(['1', '2', '3', '4'])
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})
