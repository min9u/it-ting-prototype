/**
 * 10 설정 · 계정 — 목 서버. data/notifications.ts(알림 설정) · data/serviceNotices.ts(공지) · data/account.ts(차단 · 탈퇴)
 */
import { mockRead, mockWrite, notFound } from '../mock/server'
import { memberProfile, rawPerson } from '../common/mockPeople'
import { noticePrefs, setBrowserPush, setNoticeKind, type NoticeKind } from '../../data/notifications'
import { serviceNoticeOf, serviceNoticeStore } from '../../data/serviceNotices'
import { accountStore, blockUser, unblockUser, withdraw as withdrawAccount } from '../../data/account'
import { toIso, ymdMs } from '../../lib/time'
import type { SettingsApi } from './real'
import type { NoticeCategory, NoticeDto, NotificationSettingDto } from './types'

const NOTICE_CAT: Record<string, NoticeCategory> = { 공지: 'NOTICE', 업데이트: 'UPDATE', 이벤트: 'EVENT' }
const settingsOf = (): NotificationSettingDto => {
  const p = noticePrefs.get()
  return { meetupOn: p.kinds.모임, chatOn: p.kinds.채팅, communityOn: p.kinds.커뮤니티, burrowOn: p.kinds.땅굴, noticeOn: p.kinds.공지, browserPushOn: p.browserPush }
}
const noticeDto = (n: { id: string; cat: string; title: string; date: string; body: string[] }): NoticeDto =>
  ({ id: n.id, category: NOTICE_CAT[n.cat] ?? 'NOTICE', title: n.title, content: n.body.join('\n'), createdAt: toIso(ymdMs(n.date.replace(/\./g, '-'))) })

export const mock: SettingsApi = {
  getSettings: (signal) => mockRead(settingsOf, { signal }),
  updateSettings: (patch) => mockWrite(() => {
    const map: [keyof NotificationSettingDto, NoticeKind][] = [['meetupOn', '모임'], ['chatOn', '채팅'], ['communityOn', '커뮤니티'], ['burrowOn', '땅굴'], ['noticeOn', '공지']]
    for (const [k, kind] of map) if (patch[k] != null) setNoticeKind(kind, !!patch[k])
    if (patch.browserPushOn != null) setBrowserPush(patch.browserPushOn)
    return settingsOf()
  }),
  notices: (signal) => mockRead(() => serviceNoticeStore.get().list.map(noticeDto), { signal, empty: () => [] }),
  notice: (id, signal) => mockRead(() => { const n = serviceNoticeOf(id); if (!n) throw notFound('NOTICE', '공지를 찾을 수 없습니다.'); return noticeDto(n) }, { signal, detail: 'NOTICE' }),
  blocked: (signal) => mockRead(() => accountStore.get().blocked.map((b) => ({ ...memberProfile(b.id), id: b.id, nickname: b.nickname, status: 'ACTIVE' as const, blockedAt: b.blockedAt })), { signal, empty: () => [] }),
  block: (memberId) => mockWrite(() => { const u = rawPerson(memberId); blockUser({ id: memberId, nickname: u?.nickname ?? '두더지' }) }),
  unblock: (memberId) => mockWrite(() => unblockUser(memberId)),
  withdraw: (reason) => mockWrite(() => withdrawAccount(reason)),
}
