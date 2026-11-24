/**
 * 브라우저 푸시 서비스 워커(public/push-sw.js)가 앱의 알림 목록과 같은 글 · 주소를 만드는지 (명세 09 · 10 KAN-59:
 * 푸시 내용은 알림 한 줄과 같은 JSON, 문구와 갈 곳은 프론트엔드가 정함). 알림 종류마다 제목 있음 · 없음 · 탈퇴한 사람을 비교
 */
import { describe, expect, it } from 'vitest'
import { runInNewContext } from 'node:vm'
import { NOTICE_LABEL, noticeLink, noticeText } from '../api/notifications/mappers'
import type { NotificationDto, NotificationType } from '../api/notifications/types'

const FS = 'node:fs'
const fs = (await import(/* @vite-ignore */ FS)) as { readFileSync(p: string, e: string): string }
const sandbox: { self: { addEventListener: () => void; pushView?: (d: unknown) => { title: string; body: string; url: string; tag?: string } } } = { self: { addEventListener: () => {} } }
runInNewContext(fs.readFileSync('public/push-sw.js', 'utf8'), sandbox)
const pushView = sandbox.self.pushView!

const TARGET: Record<string, NotificationDto['target']['type']> = {
  MEETUP: 'MEETUP', CHAT_MESSAGE: 'CHAT_ROOM', CHAT_REQUEST: 'CHAT_REQUEST', POST: 'POST', COMMENT: 'POST', GUESTBOOK: 'GUESTBOOK', NOTICE: 'NOTICE',
}
const targetOf = (type: string): NotificationDto['target']['type'] => {
  if (type === 'GUESTBOOK_ENTRY_HIDDEN') return 'BURROW'
  const key = Object.keys(TARGET).find((k) => type.startsWith(k)) ?? 'NOTICE'
  return TARGET[key]
}
const row = (type: NotificationType, o: { title?: string | null; actor?: NotificationDto['actor']; startsAt?: string | null; createdAt?: string } = {}) => ({
  id: 41, type, category: 'MEETUP', isRead: false, createdAt: o.createdAt ?? '2026-12-01T05:00:00Z',
  actor: o.actor === undefined ? { id: 7, nickname: '새벽산책', isWithdrawn: false } : o.actor,
  target: { type: targetOf(type), id: 900, title: o.title === undefined ? '보드게임 번개' : o.title, startsAt: o.startsAt ?? null },
}) as unknown as NotificationDto

describe('push-sw.js = 앱 알림 목록', () => {
  const types = Object.keys(NOTICE_LABEL) as NotificationType[]
  it('알림 종류 22개 모두', () => { expect(types.length).toBe(22) })
  for (const type of types) {
    it(type, () => {
      const cases = [row(type), row(type, { title: null }), row(type, { actor: { id: 7, nickname: null, isWithdrawn: true } as never }), row(type, { actor: null })]
      if (type === 'MEETUP_START_REMINDER') {
        cases.push(row(type, { startsAt: '2026-12-01T06:00:00Z' }), row(type, { startsAt: '2026-12-02T05:30:00Z' }), row(type, { startsAt: '2026-12-09T10:00:00Z' }), row(type, { startsAt: '2026-11-30T10:00:00Z' }))
      }
      for (const d of cases) {
        const app = noticeText(d)
        const v = pushView(JSON.parse(JSON.stringify(d)))
        expect({ title: v.title, body: v.body, url: v.url }).toEqual({ title: app.title, body: app.sub, url: noticeLink(d.type, d.target) })
        expect(v.tag).toBe('notice-41')
      }
    })
  }
  it('모르는 모양이면 기본 알림 · 알림 목록으로', () => {
    expect(pushView(null).url).toBe('/notifications')
    expect(pushView({ hello: 1 }).title).toBe('디굴디굴')
  })
})
