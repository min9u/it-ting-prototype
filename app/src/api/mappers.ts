/**
 * 서버 응답(DTO, api/types.ts) → 앱 안 모양(data/types.ts, data/*Store.ts).
 * 화면은 이 결과만 쓴다. 서버 모양이 바뀌면 여기만 고친다.
 *
 * - ID: 숫자로 와도 문자열로 (toId). 비교는 항상 문자열끼리 (위험 B7)
 * - 날짜: ISO 8601(오프셋) → ms 또는 달력 값 (lib/time.ts)
 * - 사람: 탈퇴(WITHDRAWN)는 'gone' 으로. 응답에 온 사람은 rememberPerson 으로 USERS 에 넣어 둠
 *   (화면 여러 곳이 아직 USERS[id] 로 닉네임을 찾기 때문. 화면을 usePerson 류로 바꾸면 없앨 다리)
 */
import { ME_ID, USERS } from '../data/mock'
import { floorId, type Floor } from '../data/field'
import type { MeetupState, MeetupX, Mine, Recruit } from '../data/meetupStore'
import type { BoardComment, BoardPhoto, BoardPost, Visibility } from '../data/boardStore'
import type { Req } from '../data/chat'
import type { AppNotice, GoneKind, NoticeKind } from '../data/notifications'
import type { GuestbookEntry, PostCategory, Tone, User } from '../data/types'
import type { SavedRoom } from '../data/roomLook'
import { subOf } from '../data/interests'
import { meetupCategoryOf } from '../data/meetupCategory'
import { msToWall, parseIso, seoulParts, seoulYmd } from '../lib/time'
import type {
  ApplicationStatus, BurrowDto, ChatRequestDto, ChatRoomSummaryDto, CommentDto, ContentStatus, GuestbookEntryDto, MeetupCardDto,
  MeetupDetailDto, MemberProfileDto, MemberSummaryDto, NotificationCategory, NotificationDto, PostCategoryCode, PostDetailDto,
  PostListItemDto, RecruitStatus, RoomLayoutDto,
} from './types'

export const GONE_ID = 'gone'
/** BIGINT 가 숫자로 와도 문자열로 */
export const toId = (v: string | number | null | undefined) => (v == null ? '' : String(v))
const ms = (iso: string | null | undefined) => (iso ? parseIso(iso) : undefined)

/* ===== 사람 ===== */
export type Person = User & { campus?: string; gen?: number; floor?: number }

/** 응답에 온 사람을 USERS 에 채워 둠 (없으면 넣고, 관심사가 비어 있던 기록은 더 자세한 값으로) */
export function rememberPerson(u: Person, full: boolean) {
  if (u.id === GONE_ID) return
  const old = USERS[u.id]
  if (!old) USERS[u.id] = u
  else if (full && !old.interests.length) USERS[u.id] = { ...old, ...u }
}

export function toPerson(d: MemberSummaryDto | MemberProfileDto): Person {
  if (d.status === 'WITHDRAWN' || !d.nickname) return { id: GONE_ID, nickname: '탈퇴한 사용자', affiliation: '', intro: '', interests: [] }
  const p = 'interests' in d ? d : null
  const id = toId(d.id)
  const u: Person = {
    id, nickname: d.nickname,
    affiliation: d.campus ? `SSAFY ${d.generation ?? ''}기 · ${d.campus} · ${d.floor ?? ''}층` : '',
    intro: p?.intro ?? '',
    interests: p ? [...p.interests].sort((a, b) => a.sortOrder - b.sortOrder).map((i) => i.name) : USERS[id]?.interests ?? [],
    qna: p?.answers.map((a) => ({ q: a.question, a: a.answer })),
    online: p?.online,
    worn: [d.mole.head, d.mole.face, d.mole.neck, d.mole.hand].filter((x): x is string => !!x),
    ...(d.campus ? { campus: d.campus, gen: d.generation ?? undefined, floor: d.floor ?? undefined } : {}),
  }
  rememberPerson(u, !!p)
  return u
}

/* ===== 모임 ===== */
const MODE = { OFFLINE: '오프라인', ONLINE: '온라인' } as const
const RECRUIT: Record<RecruitStatus, Recruit> = { OPEN: 'open', CLOSED: 'closed', ENDED: 'past', CANCELED: 'cancelled' }
/** ms → '오후 2:00' (모임 양식 값과 같은 모양) */
function hm(t: number) {
  const { h, mi } = seoulParts(t)
  return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(mi).padStart(2, '0')}`
}

/** 카드에 필요한 것 = 모임 + 서버가 계산한 값 (확정 인원·모집 상태·찜) */
export interface MeetupCardVM {
  meetup: MeetupX
  /** 주최자 포함 확정 인원 */
  confirmed: number
  recruit: Recruit
  liked: boolean
}
export function toMeetup(d: MeetupCardDto): MeetupX {
  const start = parseIso(d.startsAt)
  const end = ms(d.endsAt)
  const date = seoulYmd(start)
  const place = d.place ?? ''
  return {
    id: toId(d.id), title: d.title, category: meetupCategoryOf(d.category)?.name ?? d.category, date, start: hm(start),
    end: end == null ? '' : `${seoulYmd(end) !== date ? '다음 날 ' : ''}${hm(end)}`,
    area: d.mode === 'ONLINE' ? '온라인' : d.area ?? (place.split(/\s+/).slice(0, 2).join(' ')),
    place, mode: MODE[d.mode], capacity: d.capacity,
    // 카드 응답에는 참여자 목록이 없음 → 인원은 MeetupCardVM.confirmed 를 씀
    memberIds: [], hostId: toPerson(d.host).id, intro: '',
    sign: d.sign ?? d.title.slice(0, 8), cancelled: d.recruitStatus === 'CANCELED' || undefined,
    askMsg: true, deadline: d.recruitDeadlineAt ? msToWall(parseIso(d.recruitDeadlineAt)) : undefined,
    likes: d.likeCount, seq: Math.round(parseIso(d.createdAt) / 1000),
  }
}
export const toMeetupCard = (d: MeetupCardDto): MeetupCardVM => ({ meetup: toMeetup(d), confirmed: d.confirmedCount, recruit: RECRUIT[d.recruitStatus], liked: d.liked })

/** 상세 = 모임 + 내 신청 + 확정자 + 찜·알림·신고 */
export interface MeetupDetailVM {
  meetup: MeetupX
  my?: Mine
  /** 확정자 id (주최자 제외, 확정됐으면 나 포함) */
  members: string[]
  liked: boolean
  alert: boolean
  reported: boolean
}
const MY: Record<ApplicationStatus, Mine['st']> = { PENDING: 'pending', CANCELED: 'withdrawn', REJECTED: 'rejected', EXPIRED: 'rejected', MEETUP_CANCELED: 'cancelClosed', APPROVED: 'joined', LEFT: 'quit', KICKED: 'kicked' }
export function toMeetupDetail(d: MeetupDetailDto): MeetupDetailVM {
  const meetup: MeetupX = {
    ...toMeetup(d), intro: d.description ?? '', prep: d.supplies ?? undefined, askMsg: d.acceptsMessage,
    placeDetail: d.placeDetail ?? undefined, link: d.joinUrl ?? undefined,
  }
  const a = d.myApplication
  const my: Mine | undefined = d.isHost ? { st: 'host' } : a ? { st: MY[a.status], note: a.message ?? undefined, at: parseIso(a.createdAt), auto: a.status === 'EXPIRED' || undefined } : undefined
  const members = d.members.map((x) => toPerson(x).id)
  meetup.memberIds = [meetup.hostId, ...members]
  return { meetup, my, members, liked: d.liked, alert: d.vacancyAlert, reported: d.reportedByMe }
}
/**
 * 상세 하나로 모임 저장소와 같은 모양을 만듦 → data/meetupStore 의 계산 함수(recruitOf·myOf·leftOf…)를 그대로 씀.
 * (서버가 준 값으로만 계산하므로 실제 모드에서도 같은 화면)
 */
export function toMeetupState(vm: MeetupDetailVM): MeetupState {
  const id = vm.meetup.id
  return {
    list: [vm.meetup], my: vm.my ? { [id]: vm.my } : {}, members: { [id]: vm.members }, wish: vm.liked ? [id] : [],
    alerts: vm.alert ? [id] : [], applicants: {}, reported: vm.reported ? [id] : [], draft: null,
  }
}

/* ===== 커뮤니티 ===== */
export const POST_CATEGORY: Record<PostCategoryCode, PostCategory> = { MEETUP_PROMO: '모임 홍보', MEETUP_REVIEW: '모임 후기', FREE: '자유' }
export const POST_CATEGORY_CODE = Object.fromEntries(Object.entries(POST_CATEGORY).map(([k, v]) => [v, k])) as Record<PostCategory, PostCategoryCode>
const VIS: Record<ContentStatus, Visibility> = { PUBLIC: 'public', HIDDEN: 'hidden', DELETED: 'deleted' }
const TONES: Tone[] = ['sage', 'clay', 'butter', 'sky', 'lilac', 'rose', 'mint', 'sand']
/** 이미지 주소 → 사진 칸. 목 서버의 "tone:<색>" 은 색 칸으로 */
export function toPhoto(url: string): BoardPhoto {
  const m = /^tone:(\w+)$/.exec(url)
  if (m && (TONES as string[]).includes(m[1])) return { tone: m[1] as Tone }
  return { tone: 'sand', url }
}

export interface BoardPostVM extends BoardPost {
  /** 상세에만: 글에 나온 모임 */
  meetupCard?: MeetupCardVM
  prevId?: string | null
  nextId?: string | null
}
export function toBoardPost(d: PostListItemDto | PostDetailDto, comments: CommentDto[] = []): BoardPostVM {
  const detail = 'content' in d ? d : null
  const author = toPerson(d.author)
  const photos = detail ? detail.images.sort((a, b) => a.sortOrder - b.sortOrder).map((i) => toPhoto(i.url)) : d.thumbnailUrl ? [toPhoto(d.thumbnailUrl), ...Array(Math.max(0, d.imageCount - 1)).fill({ tone: 'sand' })] : []
  return {
    id: toId(d.id), category: POST_CATEGORY[d.category], interests: d.interests, title: d.title,
    body: detail ? detail.content : d.excerpt, authorId: author.id, at: parseIso(d.createdAt), editedAt: ms(d.editedAt),
    // 앱 저장소는 "나 빼고 센 수 + 내 것" 으로 셈 (likesOf · savesOf)
    views: d.viewCount, likes: d.likeCount - (d.liked ? 1 : 0), liked: d.liked,
    saves: d.bookmarkCount - (d.bookmarkedAt ? 1 : 0), savedAt: ms(d.bookmarkedAt),
    photos, meetupId: detail?.meetup ? toId(detail.meetup.id) : undefined,
    status: VIS[d.status], reports: d.status === 'HIDDEN' ? 3 : 0, reportedByMe: d.reportedByMe,
    comments: comments.map(toBoardComment), commentTotal: d.commentCount,
    ...(detail ? { meetupCard: detail.meetup ? toMeetupCard(detail.meetup) : undefined, prevId: detail.prevId, nextId: detail.nextId } : {}),
  }
}
export function toBoardComment(c: CommentDto): BoardComment {
  return {
    id: toId(c.id), authorId: toPerson(c.author).id, text: c.content, mention: c.mention?.nickname ?? undefined,
    at: parseIso(c.createdAt), editedAt: ms(c.editedAt), likes: c.likeCount - (c.liked ? 1 : 0), liked: c.liked,
    status: VIS[c.status], reports: c.status === 'HIDDEN' ? 3 : 0, reportedByMe: c.reportedByMe,
    replies: c.replies.map(toBoardComment),
  }
}

/* ===== 알림 ===== */
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
  const id = toId(d.targetId)
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
    id: toId(d.id), kind: CAT_KIND[d.category], type: TYPE_LABEL[d.type] ?? d.type, title: d.title, sub: d.body,
    at: parseIso(d.createdAt), unread: !d.readAt, to: d.targetExists ? noticeLink(d) : '',
    ...(d.targetExists ? {} : { gone: GONE_OF[d.targetType] ?? 'notice' }), ...(request ? { request } : {}),
  }
}

/* ===== 채팅 (목록 · 요청) ===== */
export interface ChatRoomItem {
  id: string
  kind: 'dm' | 'group'
  title: string
  /** 목록 타일 색을 정할 관심사 */
  topic: string
  memberCount: number
  partnerId?: string
  lastAt?: number
  preview: string
  unread: number
  closed?: 'left' | 'gone'
  ended: boolean
}
export function toChatRoomItem(d: ChatRoomSummaryDto): ChatRoomItem {
  const m = d.lastMessage
  const partner = d.partner ? toPerson(d.partner) : undefined
  let preview = ''
  if (m) {
    // 글 없이 사진만 보낸 메시지는 content 가 null → "사진"으로 보여 줌 (명세 api 06 메시지)
    const body = m.type === 'MEETUP_SHARE' && !m.content ? `[모임] ${m.meetupTitle ?? ''}` : m.content ?? (m.type === 'TEXT' ? '사진' : '')
    preview = d.type === 'MEETUP' && m.type !== 'SYSTEM' ? `${toId(m.senderId) === ME_ID ? '나' : m.senderNickname ?? '탈퇴한 사용자'}: ${body}` : body
  }
  return {
    id: toId(d.id), kind: d.type === 'DIRECT' ? 'dm' : 'group', title: d.title, topic: d.topic ?? partner?.id ?? d.title,
    memberCount: d.memberCount, partnerId: partner?.id, lastAt: ms(m?.createdAt), preview, unread: d.unreadCount,
    closed: d.closedReason === 'PARTNER_LEFT' ? 'left' : d.closedReason === 'PARTNER_WITHDRAWN' ? 'gone' : undefined, ended: d.ended,
  }
}
export interface ChatReqVM extends Req { person: Person }
const CONTEXT_TEXT = { BURROW_VISIT: '땅굴에 다녀갔어요', SAME_MEETUP: '같은 모임 참여 예정' } as const
export function toChatReq(d: ChatRequestDto): ChatReqVM {
  const person = toPerson(d.counterpart)
  return {
    id: toId(d.id), direction: d.direction === 'RECEIVED' ? 'received' : 'sent', userId: person.id, message: d.message ?? '',
    at: parseIso(d.createdAt), person,
    context: d.context === 'OTHER' ? (d.direction === 'SENT' ? '내가 먼저 대화를 요청했어요' : '대화를 요청했어요') : CONTEXT_TEXT[d.context],
  }
}

/* ===== 땅굴 ===== */
export interface BurrowVM {
  owner: Person
  regular: boolean
  regularCount: number
  visitorsNow: number
  chatRoomId: string | null
  pendingRequestId: string | null
  /** 탐색 화면의 그 들판 그 자리 */
  spot: { floor: Floor; seat: number } | null
  /**
   * 집주인이 저장한 방 (꾸미기에서 고른 벽지·가구). 저장한 게 없으면 null → 화면이 관심사로 계산 (data/roomLook.ts roomLookOf).
   * 내 땅굴과 같은 함수를 거쳐서, 내가 보는 내 방과 남이 보는 내 방이 같음 (2026-11-18 1단계)
   */
  room: SavedRoom | null
}
/**
 * 방 꾸미기 저장 값 → 앱 값. 가구는 room.furniture 가 먼저, 없으면 관심사마다 온 member_interest.furniture.
 * 모르는 벽지·가구 id 는 roomLookOf 가 버리고 계산 값을 씀
 */
export function toSavedRoom(room: RoomLayoutDto | null | undefined, owner?: MemberProfileDto): SavedRoom | null {
  const perInterest: Record<string, string> = {}
  // 앱의 가구 선택 키는 소분류 코드(cafe_coffee …). 서버 interestId 가 숫자여도 이름으로 찾음
  for (const i of owner?.interests ?? []) if (i.furniture) perInterest[subOf(i.name)?.id ?? toId(i.interestId)] = i.furniture
  const furniture = { ...perInterest, ...(room?.furniture ?? {}) }
  if (!room?.wallpaperId && !room?.themeId && !Object.keys(furniture).length) return null
  return { wallpaperId: room?.wallpaperId ?? null, furniture, themeId: room?.themeId ?? null }
}
export function toBurrow(d: BurrowDto): BurrowVM {
  const e = d.entrance
  const term = e ? `${e.year} ${e.half === 'FIRST' ? '상반기' : '하반기'}` : ''
  return {
    owner: { ...toPerson(d.owner), visitorsNow: d.visitorsNow }, regular: d.regular, regularCount: d.regularCount, visitorsNow: d.visitorsNow,
    chatRoomId: d.chatRoomId ? toId(d.chatRoomId) : null, pendingRequestId: d.pendingRequestId ? toId(d.pendingRequestId) : null,
    spot: e ? { floor: { id: floorId(term, e.campus, e.floor), term, campus: e.campus, floor: e.floor }, seat: e.slot } : null,
    room: toSavedRoom(d.room, d.owner),
  }
}
export function toGuestbookEntry(d: GuestbookEntryDto): GuestbookEntry {
  // 앱은 ISO 문자열 그대로 들고 있음 (표시·7일 계산은 lib/time)
  return { id: toId(d.id), authorId: toPerson(d.author).id, text: d.content, createdAt: d.createdAt }
}
