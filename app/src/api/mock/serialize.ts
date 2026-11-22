/**
 * 목 서버의 "직렬화": 지금 저장소(data/*)의 값 → 서버 응답 모양(api/types.ts).
 * 실제 서버가 DB 행을 DTO 로 바꾸는 자리와 같다. 반대 방향(DTO → 앱)은 api/mappers.ts.
 * 날짜는 모두 오프셋이 붙은 ISO 8601 (lib/time.ts toIso).
 */
import { ME_ID, USERS, categoryOf } from '../../data/mock'
import { getMyInterests, subOf } from '../../data/interests'
import { meetupCategoryOf } from '../../data/meetupCategory'
import { getMyWorn, wornByPart } from '../../data/moleItems'
import { ME_HOME, affOf, fieldUserOf, locateUser } from '../../data/field'
import {
  type MeetupState, type MeetupX, confirmedOf, findMeetup, getMeetupState, isoMs, membersOf, myOf, parseHour, recruitOf, startMs,
} from '../../data/meetupStore'
import { commentCount, likesOf, savesOf, type BoardComment, type BoardPhoto, type BoardPost } from '../../data/boardStore'
import { lastMsg, membersOf as roomMembersOf, personOf, roomTitle, type Req, type Room } from '../../data/chat'
import type { AppNotice, NoticeKind } from '../../data/notifications'
import type { GuestbookEntry, PostCategory, User } from '../../data/types'
import { toIso } from '../../lib/time'
import type {
  ApplicationStatus, BurrowEntranceDto, ChatRequestDto, ChatRoomSummaryDto, CommentDto, ContentStatus, GuestbookEntryDto,
  MeetupCardDto, MeetupDetailDto, MemberProfileDto, MemberSummaryDto, MoleLookDto, NotificationCategory, NotificationDto,
  NotificationTargetType, NotificationType, PostCategoryCode, PostDetailDto, PostListItemDto, RecruitStatus,
} from '../types'

const HOUR = 3_600_000
const DAY = 24 * HOUR

/* ===== 사람 ===== */
const GONE = 'gone'
export function rawPerson(id: string): User | undefined {
  if (!id || id === GONE) return undefined
  return USERS[id] ?? fieldUserOf(id)
}
/** "SSAFY 16기 · 서울 · 2층" → 숫자들 (목 데이터의 소속 문자열을 칼럼으로 나눔) */
function affParts(id: string, u: User) {
  if (id === ME_ID) return { gen: ME_HOME.gen, campus: ME_HOME.campus, floor: ME_HOME.floor }
  const m = /(\d+)기\s*·\s*([^·]+?)\s*·\s*(\d+)층/.exec(affOf(u))
  return m ? { gen: +m[1], campus: m[2].trim(), floor: +m[3] } : { gen: null, campus: null, floor: null }
}
export function moleOf(worn: string[]): MoleLookDto {
  const by = wornByPart(worn)
  return { head: by.머리, face: by.얼굴, neck: by.목, hand: by.손 }
}
export function memberSummary(id: string): MemberSummaryDto {
  const u = rawPerson(id)
  if (!u) return { id: GONE, nickname: null, status: 'WITHDRAWN', generation: null, campus: null, floor: null, mole: { head: null, face: null, neck: null, hand: null } }
  const a = affParts(id, u)
  return { id: u.id, nickname: u.nickname, status: 'ACTIVE', generation: a.gen, campus: a.campus, floor: a.floor, mole: moleOf(id === ME_ID ? getMyWorn() : u.worn ?? []) }
}
export function memberProfile(id: string): MemberProfileDto {
  const base = memberSummary(id)
  const u = rawPerson(id)
  if (!u) return { ...base, intro: null, interests: [], answers: [], online: false }
  const names = id === ME_ID ? getMyInterests(u.interests) : u.interests
  return {
    ...base,
    intro: u.intro || null,
    interests: names.map((name, i) => ({ interestId: subOf(name)?.id ?? name, name, categoryId: categoryOf(name)?.id ?? '', sortOrder: i, furniture: null })),
    answers: (u.qna ?? []).map((x, i) => ({ slot: i + 1, questionId: `q-${i + 1}`, question: x.q, answer: x.a })),
    online: !!u.online,
  }
}

/* ===== 모임 ===== */
const RECRUIT: Record<string, RecruitStatus> = { open: 'OPEN', closed: 'CLOSED', past: 'ENDED', cancelled: 'CANCELED' }
/** '다음 날 오전 11:00' 이나 시작보다 이른 끝 시각은 다음 날 */
function endMs(m: MeetupX): number | null {
  if (!m.end) return null
  const h = parseHour(m.end)
  const next = /다음\s*날/.test(m.end) || h < parseHour(m.start)
  return startMs({ ...m, start: m.end }) + (next ? DAY : 0)
}
export function meetupCard(m: MeetupX, s: MeetupState = getMeetupState()): MeetupCardDto {
  return {
    id: m.id, title: m.title, category: meetupCategoryOf(m.category)?.code ?? m.category,
    startsAt: toIso(startMs(m)), endsAt: endMs(m) == null ? null : toIso(endMs(m)!),
    recruitDeadlineAt: m.deadline ? toIso(isoMs(m.deadline)) : null,
    mode: m.mode === '온라인' ? 'ONLINE' : 'OFFLINE', place: m.place || null,
    capacity: m.capacity, confirmedCount: confirmedOf(m, s), likeCount: m.likes, liked: s.wish.includes(m.id),
    recruitStatus: RECRUIT[recruitOf(m, s)], host: memberSummary(m.hostId),
    // 등록 순서(seq)를 등록 시각으로 (최신등록순)
    createdAt: toIso(Date.UTC(2026, 9, 1) + m.seq * HOUR),
    // ERD 에 없는 화면 값 (erd-gaps "모임 카드")
    area: m.area || null, sign: m.sign ?? null,
  }
}
const APP: Record<string, ApplicationStatus> = { pending: 'PENDING', withdrawn: 'CANCELED', joined: 'APPROVED', quit: 'LEFT', kicked: 'KICKED', cancelClosed: 'MEETUP_CANCELED' }
export function meetupDetail(id: string, s: MeetupState = getMeetupState()): MeetupDetailDto {
  const m = findMeetup(id, s)!
  const mine = myOf(id, s)
  const isHost = m.hostId === ME_ID
  const member = isHost || mine?.st === 'joined'
  return {
    ...meetupCard(m, s),
    description: m.intro || null, supplies: m.prep ?? null, acceptsMessage: m.askMsg, placeDetail: m.placeDetail ?? null,
    joinUrl: member ? m.link ?? null : null,
    members: membersOf(id, s).map(memberSummary),
    myApplication: !mine || mine.st === 'host' ? null : {
      id: `app-${id}`, status: mine.st === 'rejected' ? (mine.auto ? 'EXPIRED' : 'REJECTED') : APP[mine.st],
      message: mine.note ?? null, createdAt: toIso(mine.at ?? Date.now()), statusChangedAt: toIso(mine.at ?? Date.now()),
    },
    isHost, vacancyAlert: s.alerts.includes(id), reportedByMe: s.reported.includes(id),
  }
}

/* ===== 커뮤니티 ===== */
export const POST_CAT_CODE: Record<PostCategory, PostCategoryCode> = { '모임 홍보': 'MEETUP_PROMO', '모임 후기': 'MEETUP_REVIEW', 자유: 'FREE' }
const STATUS: Record<string, ContentStatus> = { public: 'PUBLIC', hidden: 'HIDDEN', deleted: 'DELETED' }
/** 목 사진은 색 칸뿐이라 "tone:<색>" 주소로 (실제 서버는 이미지 URL) */
export const photoUrl = (ph: BoardPhoto) => ph.url ?? `tone:${ph.tone}`
export function postListItem(p: BoardPost): PostListItemDto {
  return {
    id: p.id, category: POST_CAT_CODE[p.category], title: p.title, excerpt: p.body.replace(/\n+/g, ' ').slice(0, 160),
    author: memberSummary(p.authorId), interests: p.interests,
    thumbnailUrl: p.photos[0] ? photoUrl(p.photos[0]) : null, imageCount: p.photos.length,
    viewCount: p.views, likeCount: likesOf(p), commentCount: commentCount(p), bookmarkCount: savesOf(p),
    liked: !!p.liked, bookmarkedAt: p.savedAt ? toIso(p.savedAt) : null, status: STATUS[p.status], reportedByMe: !!p.reportedByMe,
    createdAt: toIso(p.at), editedAt: p.editedAt ? toIso(p.editedAt) : null,
  }
}
export function postDetail(p: BoardPost, prevId: string | null, nextId: string | null): PostDetailDto {
  const mt = p.meetupId ? findMeetup(p.meetupId) : undefined
  return {
    ...postListItem(p), content: p.body,
    images: p.photos.map((ph, i) => ({ id: `${p.id}-img${i + 1}`, sortOrder: i, url: photoUrl(ph) })),
    meetup: mt ? meetupCard(mt) : null, prevId, nextId,
  }
}
const nickToId = (nick: string) => Object.values(USERS).find((u) => u.nickname === nick)?.id ?? ''
export function commentDto(c: BoardComment, postId: string, parentId: string | null): CommentDto {
  return {
    id: c.id, postId, parentId, author: memberSummary(c.authorId),
    mention: c.mention ? { memberId: nickToId(c.mention), nickname: c.mention } : null,
    // 가려진 댓글은 본문을 보내지 않음 (신고 3명)
    content: c.status === 'hidden' ? '' : c.text, status: STATUS[c.status],
    likeCount: c.likes + (c.liked ? 1 : 0), liked: !!c.liked, reportedByMe: !!c.reportedByMe,
    createdAt: toIso(c.at), editedAt: c.editedAt ? toIso(c.editedAt) : null,
    replies: c.replies.map((r) => commentDto(r, postId, c.id)),
  }
}

/* ===== 알림 ===== */
const KIND_CAT: Record<NoticeKind, NotificationCategory> = { 모임: 'MEETUP', 채팅: 'CHAT', 커뮤니티: 'COMMUNITY', 땅굴: 'BURROW', 공지: 'NOTICE' }
/** 명세 "알림 종류" 세부 이름 → type (erd-gaps "알림 type 후보") */
export const NOTICE_TYPE: Record<string, NotificationType> = {
  '참여 신청 받음': 'MEETUP_APPLICATION_RECEIVED', '신청 수락': 'MEETUP_APPLICATION_APPROVED', '신청 미승인': 'MEETUP_APPLICATION_REJECTED',
  '참여 취소': 'MEETUP_MEMBER_LEFT', '모임에서 내보내짐': 'MEETUP_KICKED', '모임 정보 수정': 'MEETUP_UPDATED', '모임 취소': 'MEETUP_CANCELED',
  '모임 일정 임박': 'MEETUP_STARTING_SOON', '빈자리 생김': 'MEETUP_VACANCY',
  '새 메시지': 'CHAT_MESSAGE', '대화 요청': 'CHAT_REQUEST_RECEIVED', '대화 요청 수락': 'CHAT_REQUEST_ACCEPTED',
  '내 글에 댓글': 'POST_COMMENTED', '내 댓글의 답글': 'COMMENT_REPLIED', '내 글 좋아요': 'POST_LIKED', '댓글 좋아요': 'COMMENT_LIKED',
  '답글 좋아요': 'REPLY_LIKED', '신고로 가려짐': 'POST_HIDDEN',
  // 11-20 명세의 두 종류 (api/types.ts NotificationType 에 있음)
  '내 댓글 신고로 가려짐': 'COMMENT_HIDDEN', '방명록 글 신고로 가려짐': 'GUESTBOOK_HIDDEN',
  '방명록 새 글': 'GUESTBOOK_WRITTEN', '서비스 공지': 'SERVICE_NOTICE',
}
const GONE_TARGET: Record<string, NotificationTargetType> = { meetup: 'MEETUP', post: 'POST', burrow: 'BURROW', chat: 'CHAT_ROOM', notice: 'NOTICE' }
/** 저장소의 이동 주소 → (대상 종류, id). 실제 서버는 notification.target_type · target_id 를 그대로 줌 */
function targetOf(n: AppNotice): { targetType: NotificationTargetType; targetId: string | null } {
  if (n.gone) return { targetType: GONE_TARGET[n.gone], targetId: null }
  const to = n.to
  let m: RegExpExecArray | null
  if ((m = /manage=([^&]+)/.exec(to))) return { targetType: 'MEETUP', targetId: m[1] }
  if ((m = /^\/meetups\/([^/?]+)/.exec(to)) && m[1] !== 'me') return { targetType: 'MEETUP', targetId: m[1] }
  if (to.startsWith('/chat/requests')) return { targetType: 'CHAT_REQUEST', targetId: null }
  if ((m = /^\/chat\/([^/?]+)/.exec(to))) return { targetType: 'CHAT_ROOM', targetId: m[1] }
  if ((m = /^\/board\/([^/?#]+)/.exec(to))) return { targetType: 'POST', targetId: m[1] }
  if ((m = /^\/settings\/notices\/([^/?]+)/.exec(to))) return { targetType: 'NOTICE', targetId: m[1] }
  if (to.startsWith('/burrow')) return { targetType: 'BURROW', targetId: ME_ID }
  return { targetType: 'NOTICE', targetId: null }
}
export function notificationDto(n: AppNotice): NotificationDto {
  const t = targetOf(n)
  return {
    id: n.id, type: NOTICE_TYPE[n.type] ?? 'SERVICE_NOTICE', category: KIND_CAT[n.kind], ...t, targetExists: !n.gone,
    actor: null, title: n.title, body: n.sub, readAt: n.unread ? null : toIso(n.at + HOUR), createdAt: toIso(n.at),
  }
}

/* ===== 채팅 (방 목록 · 요청) ===== */
export function chatRoomSummary(r: Room): ChatRoomSummaryDto {
  const last = lastMsg(r)
  const mt = r.meetupId ? findMeetup(r.meetupId) : undefined
  const partner = r.partnerId ? personOf(r.partnerId) : undefined
  return {
    id: r.id, type: r.kind === 'dm' ? 'DIRECT' : 'MEETUP', meetupId: r.meetupId ?? null, title: roomTitle(r),
    partner: r.partnerId ? memberSummary(r.partnerId) : null,
    topic: r.kind === 'group' ? mt?.category ?? null : partner?.interests[0] ?? null,
    memberCount: r.kind === 'group' ? roomMembersOf(r).length : 2,
    lastMessage: last ? {
      id: last.id, type: last.system ? 'SYSTEM' : last.meetupId ? 'MEETUP_SHARE' : 'TEXT',
      senderId: last.system ? null : last.authorId, senderNickname: last.system ? null : last.authorId === ME_ID ? USERS[ME_ID].nickname : personOf(last.authorId).nickname,
      content: last.text || null, meetupId: last.meetupId ?? null, meetupTitle: last.meetupId ? findMeetup(last.meetupId)?.title ?? null : null,
      createdAt: toIso(last.at),
    } : null,
    unreadCount: r.unread,
    closedReason: r.closed === 'left' ? 'PARTNER_LEFT' : r.closed === 'gone' ? 'PARTNER_WITHDRAWN' : null,
    ended: !!r.ended,
  }
}
const CONTEXT: Record<string, ChatRequestDto['context']> = { '땅굴에 다녀갔어요': 'BURROW_VISIT', '같은 모임 참여 예정': 'SAME_MEETUP' }
export function chatRequestDto(r: Req): ChatRequestDto {
  return {
    id: r.id, direction: r.direction === 'received' ? 'RECEIVED' : 'SENT', counterpart: memberProfile(r.userId),
    message: r.message || null, status: 'PENDING', context: CONTEXT[r.context] ?? 'OTHER',
    createdAt: toIso(r.at), expiresAt: toIso(r.at + 5 * DAY), chatRoomId: null,
  }
}

/* ===== 땅굴 ===== */
export function entranceOf(userId: string): BurrowEntranceDto | null {
  const spot = locateUser(userId)
  if (!spot) return null
  const [year, half] = spot.floor.term.split(' ')
  return {
    termId: spot.floor.term, year: Number(year), half: half === '상반기' ? 'FIRST' : 'SECOND',
    campusFloorId: `${spot.floor.campus}|${spot.floor.floor}`, campus: spot.floor.campus, floor: spot.floor.floor, slot: spot.seat,
  }
}
export function guestbookEntryDto(g: GuestbookEntry, ownerId: string): GuestbookEntryDto {
  return { id: g.id, burrowId: `b-${ownerId}`, author: memberSummary(g.authorId), content: g.text, createdAt: g.createdAt }
}
