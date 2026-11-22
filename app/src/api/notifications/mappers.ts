/** 09 알림 DTO → 앱 모양 (data/notifications 의 AppNotice) */
import { toAppId } from '../common/ids'
import type { AppNotice, GoneKind, NoticeKind } from '../../data/notifications'
import { parseIso } from '../../lib/time'
import type { NotificationCategory, NotificationDto } from './types'

const CAT_KIND: Record<NotificationCategory, NoticeKind> = { MEETUP: '모임', CHAT: '채팅', COMMUNITY: '커뮤니티', BURROW: '땅굴', NOTICE: '공지' }
export const KIND_CATEGORY = Object.fromEntries(Object.entries(CAT_KIND).map(([k, v]) => [v, k])) as Record<NoticeKind, NotificationCategory>
const TYPE_LABEL: Record<string, string> = {
  MEETUP_APPLICATION_RECEIVED: '참여 신청 받음', MEETUP_APPLICATION_APPROVED: '신청 수락', MEETUP_APPLICATION_REJECTED: '신청 미승인',
  MEETUP_MEMBER_LEFT: '참여 취소', MEETUP_KICKED: '모임에서 내보내짐', MEETUP_UPDATED: '모임 정보 수정', MEETUP_CANCELED: '모임 취소',
  MEETUP_STARTING_SOON: '모임 일정 임박', MEETUP_VACANCY: '빈자리 생김', CHAT_MESSAGE: '새 메시지', CHAT_REQUEST_RECEIVED: '대화 요청',
  CHAT_REQUEST_ACCEPTED: '대화 요청 수락', POST_COMMENTED: '내 글에 댓글', COMMENT_REPLIED: '내 댓글의 답글', POST_LIKED: '내 글 좋아요',
  COMMENT_LIKED: '댓글 좋아요', REPLY_LIKED: '답글 좋아요', POST_HIDDEN: '신고로 가려짐', COMMENT_HIDDEN: '내 댓글 신고로 가려짐', GUESTBOOK_WRITTEN: '방명록 새 글', GUESTBOOK_HIDDEN: '방명록 글 신고로 가려짐', SERVICE_NOTICE: '서비스 공지',
}
const GONE_OF: Record<string, GoneKind> = { MEETUP: 'meetup', POST: 'post', COMMENT: 'post', BURROW: 'burrow', CHAT_ROOM: 'chat', CHAT_REQUEST: 'chat', NOTICE: 'notice' }
/** 알림을 누르면 갈 곳: 서버는 (type, target) 만 주고 주소는 프론트가 정함 (주소 구조가 바뀌어도 서버는 그대로) */
export function noticeLink(d: Pick<NotificationDto, 'type' | 'targetType' | 'targetId'>): string {
  const id = toAppId(d.targetId)
  if (d.type === 'MEETUP_APPLICATION_RECEIVED') return `/meetups/me?tab=hosting&manage=${id}`
  switch (d.targetType) {
    case 'MEETUP': return `/meetups/${id}`
    case 'CHAT_ROOM': return `/chat/${id}`
    case 'CHAT_REQUEST': return '/chat/requests'
    case 'POST': case 'COMMENT': return `/board/${id}`
    case 'BURROW': return '/burrow?modal=guestbook'
    case 'NOTICE': return id ? `/settings/notices/${id}` : '/notifications'
  }
}
export function toAppNotice(d: NotificationDto): AppNotice {
  const request = d.type === 'MEETUP_APPLICATION_RECEIVED' || d.type === 'CHAT_REQUEST_RECEIVED'
  return {
    id: toAppId(d.id), kind: CAT_KIND[d.category], type: TYPE_LABEL[d.type] ?? d.type, title: d.title, sub: d.body,
    at: parseIso(d.createdAt), unread: !d.readAt, to: d.targetExists ? noticeLink(d) : '',
    ...(d.targetExists ? {} : { gone: GONE_OF[d.targetType] ?? 'notice' }), ...(request ? { request } : {}),
  }
}
