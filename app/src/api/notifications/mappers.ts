/**
 * 09 알림 DTO → 앱 모양.
 * 서버는 문구를 만들지 않는다 (명세 "알림의 모양"): 제목 · 보조 설명은 여기서 type · actor.nickname · target.title · target.startsAt 로 만든다.
 * 종류 아이콘 · 색은 category 로 (data/notifications KIND_META), 갈 곳 주소는 type · target 으로 (noticeLink)
 */
import { toAppId } from '../common/ids'
import type { CursorPageDto, UserDisplayDto } from '../common/types'
import { KIND_OF_CATEGORY, type NoticeKind } from '../../data/notifications'
import { parseIso, seoulParts, seoulYmd, ymdDiff, ymdLabel } from '../../lib/time'
import { REQUEST_TYPES, type NotificationDto, type NotificationPopupDto, type NotificationTargetDto, type NotificationType, type NotificationUnreadDto } from './types'

/** 알림 한 줄 (화면이 쓰는 모양) */
export interface AppNotice {
  id: string
  type: NotificationType
  /** 갈래 이름 (아이콘 · 탭) */
  kind: NoticeKind
  /** 명세 "알림 종류"의 세부 이름 (예: 참여 신청 받음) */
  label: string
  title: string
  sub: string
  /** 생긴 시각 (ms) */
  at: number
  unread: boolean
  /** 누르면 가는 곳. 원본이 사라졌어도 그 화면으로 가고, 그 화면의 조회 API 가 404 면 안내 화면이 나온다 */
  to: string
  /** 요청 알림(참여 신청 받음 · 대화 요청) */
  request: boolean
}

/** 알림 팝업 (앱 모양) */
export interface AppNoticePopup {
  meetupRequestCount: number
  chatRequestCount: number
  /** "모카님 외 2명" (요청이 없으면 '') */
  chatRequestSub: string
  recent: AppNotice[]
  unreadCount: number
}

/** 명세 spec/09 알림 7 의 세부 이름 */
export const NOTICE_LABEL: Record<NotificationType, string> = {
  MEETUP_APPLICATION_RECEIVED: '참여 신청 받음', MEETUP_APPLICATION_ACCEPTED: '신청 수락', MEETUP_APPLICATION_REJECTED: '신청 미승인',
  MEETUP_PARTICIPATION_CANCELED: '참여 취소', MEETUP_KICKED: '모임에서 내보내짐', MEETUP_UPDATED: '모임 정보 수정', MEETUP_CANCELED: '모임 취소',
  MEETUP_DELETED: '모임 삭제', MEETUP_VACANCY_OPENED: '빈자리 생김', MEETUP_START_REMINDER: '모임 일정 임박',
  CHAT_MESSAGE_RECEIVED: '새 메시지', CHAT_REQUEST_RECEIVED: '대화 요청', CHAT_REQUEST_ACCEPTED: '대화 요청 수락',
  POST_COMMENTED: '내 글에 댓글', POST_LIKED: '내 글 좋아요', COMMENT_REPLIED: '내 댓글의 답글', COMMENT_LIKED: '댓글 · 답글 좋아요',
  POST_HIDDEN: '내 글이 신고로 가려짐', COMMENT_HIDDEN: '내 댓글이 신고로 가려짐',
  GUESTBOOK_ENTRY_CREATED: '방명록 새 글', GUESTBOOK_ENTRY_HIDDEN: '내가 쓴 방명록 글이 신고로 가려짐',
  NOTICE_PUBLISHED: '서비스 공지',
}

/* ===== 문구 도우미 ===== */
const HOUR = 3_600_000
/** 받침이 있으면 a, 없으면 b (이/가 · 을/를 · 은/는). 한글이 아니면 a */
function josa(word: string, a: string, b: string) {
  const ch = word.replace(/[’'")\s]+$/, '').slice(-1)
  const code = ch.charCodeAt(0) - 0xac00
  if (code < 0 || code > 11171) return a
  return code % 28 ? a : b
}
/** ‘제목’ (없으면 대신할 말) */
const quote = (title: string | null, fallback: string) => (title ? `‘${title}’` : fallback)
/** 일으킨 사람: "새벽산책님" / 탈퇴했으면 "탈퇴한 사용자" */
const who = (a: UserDisplayDto | null) => (!a ? '누군가' : a.isWithdrawn || !a.nickname ? '탈퇴한 사용자' : `${a.nickname}님`)
/** "오후 2시" · "오전 10시 30분" (서울) */
function hourText(ms: number) {
  const { h, mi } = seoulParts(ms)
  return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}시${mi ? ` ${mi}분` : ''}`
}
/** 일정 임박: "1시간 뒤에 시작해요" · "내일 오후 2시에 시작해요" (알림이 생긴 때 기준) */
export function startsText(startsAt: number, at: number) {
  const left = startsAt - at
  if (left <= 0) return '모임이 시작됐어요'
  if (left <= 2 * HOUR) return `${Math.max(1, Math.round(left / HOUR))}시간 뒤에 시작해요`
  const days = ymdDiff(seoulYmd(at), seoulYmd(startsAt))
  const day = days === 0 ? '오늘' : days === 1 ? '내일' : days === 2 ? '모레' : ymdLabel(seoulYmd(startsAt))
  return `${day} ${hourText(startsAt)}에 시작해요`
}

/** 제목 · 보조 설명 (원본이 사라져 target.title 이 null 이어도 문장이 되게) */
export function noticeText(d: Pick<NotificationDto, 'type' | 'actor' | 'target' | 'createdAt'>): { title: string; sub: string } {
  const t = d.target.title
  const by = who(d.actor)
  const subj = `${by}${josa(by, '이', '가')}`
  switch (d.type) {
    case 'MEETUP_APPLICATION_RECEIVED': return { title: `${quote(t, '내 모임')}에 새 참여 신청이 왔어요`, sub: `${subj} 참여를 신청했어요` }
    case 'MEETUP_APPLICATION_ACCEPTED': return { title: '참여 신청이 수락됐어요', sub: t ? `‘${t}’에 함께해요` : '삭제된 모임이에요' }
    case 'MEETUP_APPLICATION_REJECTED': return { title: '참여가 승인되지 않았어요', sub: quote(t, '삭제된 모임이에요') }
    case 'MEETUP_PARTICIPATION_CANCELED': return { title: `${quote(t, '내 모임')} 참여자가 참여를 취소했어요`, sub: `${subj} 참여를 취소했어요` }
    case 'MEETUP_KICKED': return { title: `${quote(t, '모임')} 참여가 취소됐어요`, sub: '모임에서 내보내졌어요' }
    case 'MEETUP_UPDATED': return { title: `${quote(t, '신청한 모임')} 정보가 바뀌었어요`, sub: t ? '바뀐 내용을 확인해 보세요' : '삭제된 모임이에요' }
    case 'MEETUP_CANCELED': return { title: `${quote(t, '신청한 모임')}${t ? ' 모임' : ''}이 취소됐어요`, sub: '모임이 열리지 않아요' }
    case 'MEETUP_DELETED': return { title: '신청한 모임이 삭제됐어요', sub: quote(t, '신청이 함께 정리됐어요') }
    case 'MEETUP_VACANCY_OPENED': return { title: `${quote(t, '빈자리 알림을 켠 모임')}에 빈자리가 생겼어요`, sub: t ? '빈자리 알림을 켠 모임이에요' : '삭제된 모임이에요' }
    case 'MEETUP_START_REMINDER': {
      const name = quote(t, '참여하는 모임')
      const starts = d.target.startsAt ? startsText(parseIso(d.target.startsAt), parseIso(d.createdAt)) : '삭제된 모임이에요'
      return { title: `${name}${josa(name, '이', '가')} 곧 시작돼요`, sub: starts }
    }
    case 'CHAT_MESSAGE_RECEIVED': return { title: '새 메시지가 도착했어요', sub: t ? `‘${t}’ 대화방 · ${by}` : `${subj} 메시지를 보냈어요` }
    case 'CHAT_REQUEST_RECEIVED': return { title: '대화 요청이 왔어요', sub: `${subj} 대화를 요청했어요` }
    case 'CHAT_REQUEST_ACCEPTED': return { title: `${subj} 대화 요청을 수락했어요`, sub: '1:1 대화방이 열렸어요' }
    case 'POST_COMMENTED': return { title: '내 글에 댓글이 달렸어요', sub: `${quote(t, '삭제된 글')} · ${by}` }
    case 'POST_LIKED': return { title: '내 글에 좋아요가 눌렸어요', sub: `${quote(t, '삭제된 글')} · ${by}` }
    case 'COMMENT_REPLIED': return { title: '내 댓글에 답글이 달렸어요', sub: `${quote(t, '삭제된 글')} · ${by}` }
    case 'COMMENT_LIKED': return { title: '내 댓글에 좋아요가 눌렸어요', sub: `${quote(t, '삭제된 글')} · ${by}` }
    case 'POST_HIDDEN': return { title: '내 글이 신고로 가려졌어요', sub: quote(t, '삭제된 글') }
    case 'COMMENT_HIDDEN': return { title: '내 댓글이 신고로 가려졌어요', sub: quote(t, '삭제된 글') }
    case 'GUESTBOOK_ENTRY_CREATED': return { title: '내 땅굴 방명록에 새 글이 남겨졌어요', sub: `${subj} 글을 남겼어요` }
    case 'GUESTBOOK_ENTRY_HIDDEN': return { title: '내가 쓴 방명록 글이 신고로 가려졌어요', sub: '글을 남겼던 땅굴에서 확인해 보세요' }
    case 'NOTICE_PUBLISHED': return { title: '새 공지가 올라왔어요', sub: t ?? '내려간 공지예요' }
    default: return { title: '새 알림이 있어요', sub: '' } // 명세에 새 종류가 생겼는데 프론트가 아직 모를 때
  }
}

/**
 * 알림을 누르면 갈 곳 (명세 "눌렀을 때 갈 곳"). 서버는 (type, target) 만 주고 주소는 프론트가 정한다.
 * 원본이 사라졌어도 그 화면으로 보낸다 → 그 화면의 조회 API 가 404 → 안내 화면(00 공통 21)
 */
export function noticeLink(type: NotificationType, target: Pick<NotificationTargetDto, 'type' | 'id'>): string {
  const id = toAppId(target.id)
  if (target.type === 'GUESTBOOK') return '/burrow?modal=guestbook'
  if (target.type === 'CHAT_REQUEST') return '/chat/requests'
  if (!id) return '/notifications'
  switch (target.type) {
    case 'MEETUP': return type === 'MEETUP_APPLICATION_RECEIVED' ? `/meetups/me?tab=hosting&manage=${encodeURIComponent(id)}` : `/meetups/${encodeURIComponent(id)}`
    case 'CHAT_ROOM': return `/chat/${encodeURIComponent(id)}`
    case 'POST': return `/board/${encodeURIComponent(id)}`
    case 'BURROW': return `/burrow/${encodeURIComponent(id)}`
    case 'NOTICE': return `/settings/notices/${encodeURIComponent(id)}`
    default: return '/notifications'
  }
}

export function toAppNotice(d: NotificationDto): AppNotice {
  return {
    id: toAppId(d.id), type: d.type, kind: KIND_OF_CATEGORY[d.category] ?? '공지', label: NOTICE_LABEL[d.type] ?? d.type,
    ...noticeText(d), at: parseIso(d.createdAt), unread: !d.isRead, to: noticeLink(d.type, d.target),
    request: REQUEST_TYPES.includes(d.type),
  }
}

/** 커서 쪽 묶음 → 한 목록. 이어 받는 사이 순서가 바뀌어 같은 알림이 또 오면 앞의 것만 */
export function toAppNoticeList(pages: CursorPageDto<NotificationDto>[]): AppNotice[] {
  const seen = new Set<number>()
  const out: AppNotice[] = []
  for (const p of pages) for (const d of p.items) if (!seen.has(d.id)) { seen.add(d.id); out.push(toAppNotice(d)) }
  return out
}

export function toAppNoticePopup(d: NotificationPopupDto): AppNoticePopup {
  const r = d.latestChatRequester
  const name = r ? (r.isWithdrawn || !r.nickname ? '탈퇴한 사용자' : `${r.nickname}님`) : ''
  return {
    meetupRequestCount: d.meetupRequestCount,
    chatRequestCount: d.chatRequestCount,
    chatRequestSub: d.chatRequestCount > 0 && name ? `${name}${d.chatRequestCount > 1 ? ` 외 ${d.chatRequestCount - 1}명` : ''}` : '',
    recent: d.recentItems.map(toAppNotice),
    unreadCount: d.unreadCount,
  }
}

export const NO_UNREAD: NotificationUnreadDto = { unreadCount: 0, hasUnread: false }
