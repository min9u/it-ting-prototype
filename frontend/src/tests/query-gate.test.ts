/**
 * QueryGate: 다시 불러와 404 를 받으면 이전 값보다 없음 안내가 먼저 (PR #37 Codex 리뷰 P1, 명세 08 글 상세 17).
 * 일시적인 실패(네트워크 · 500)면 이전 값을 계속 보여 줌
 */
import { describe, expect, it } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { UseQueryResult } from '@tanstack/react-query'
import { QueryGate } from '../components/AsyncState'
import { ApiError } from '../api/client'

const q = (o: Partial<UseQueryResult<string>>) => ({ data: undefined, error: null, isPending: false, isError: false, isFetching: false, refetch: () => {}, ...o }) as unknown as UseQueryResult<string>
const gate = (x: UseQueryResult<string>) => renderToStaticMarkup(h(QueryGate<string>, {
  q: x, skeleton: h('p', null, '불러오는 중'), notFound: h('p', null, '없는 글'), error: () => h('p', null, '오류'), children: (d: string) => h('p', null, d),
}))

describe('QueryGate', () => {
  it('받아 둔 글을 다시 불러와 404 POST_NOT_FOUND 면 이전 본문 대신 없음 안내', () => {
    expect(gate(q({ data: '예전 본문', isError: true, error: new ApiError(404, 'POST_NOT_FOUND', '없음') }))).toBe('<p>없는 글</p>')
  })
  it('다시 불러오다 500 · 네트워크 실패면 이전 본문을 계속', () => {
    expect(gate(q({ data: '예전 본문', isError: true, error: new ApiError(500, 'INTERNAL_ERROR', '서버') }))).toBe('<p>예전 본문</p>')
    expect(gate(q({ data: '예전 본문', isError: true, error: new ApiError(0, 'NETWORK', '끊김') }))).toBe('<p>예전 본문</p>')
  })
  it('처음 불러오는 중 · 처음부터 404', () => {
    expect(gate(q({ isPending: true }))).toBe('<p>불러오는 중</p>')
    expect(gate(q({ isError: true, error: new ApiError(404, 'POST_NOT_FOUND', '없음') }))).toBe('<p>없는 글</p>')
  })
})
