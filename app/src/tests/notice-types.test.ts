/**
 * F9 알림 종류 (팀 명세 11-20): 가려진 댓글 · 방명록 글도 쓴 사람에게 알림
 * 알림 목 데이터의 모든 세부 종류가 서버 type 으로 바뀔 수 있어야 함 (api/notifications/mock.ts NOTICE_TYPE)
 */
import { describe, expect, it } from 'vitest'
import { noticeStore } from '../data/notifications'
import { NOTICE_TYPE } from '../api/notifications/mock'

describe('F9 알림 종류', () => {
  const list = noticeStore.get().list
  it('내 댓글이 신고로 가려짐(커뮤니티) · 내가 쓴 방명록 글이 신고로 가려짐(땅굴) 알림이 있음', () => {
    const c = list.find((n) => n.type === '내 댓글 신고로 가려짐')!
    expect(c.kind).toBe('커뮤니티')
    expect(c.to).toMatch(/^\/board\//)
    const g = list.find((n) => n.type === '방명록 글 신고로 가려짐')!
    expect(g.kind).toBe('땅굴')
    expect(g.to).toMatch(/^\/burrow\/[a-z]+$/) // 그 글을 썼던 땅굴(방문자 뷰)
  })
  it('목 알림의 모든 세부 종류에 서버 type 이 있음', () => {
    for (const n of list) expect(NOTICE_TYPE[n.type], n.type).toBeTruthy()
  })
})
