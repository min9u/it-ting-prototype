/**
 * 채팅 목 저장소 = 목 서버의 "DB" (명세 06 채팅: docs/backend/team-spec/api/06-chat.md · db/chat.md).
 * 화면은 이 파일을 직접 부르지 않고 api/chat 의 훅 · 함수만 쓴다. 이 파일은 api/chat/mock.ts(목 서버)가 읽고 쓴다.
 * 다른 영역의 목 서버도 같은 "DB" 로 읽고 쓴다 (서버 안에서 테이블을 같이 쓰는 것과 같음): 모임 목(groupRoomId · roomOf · leaveRoom),
 * 알림 목(liveRequests · roomOf), 탐색 목(dmRoomWith · sentRequestTo · receivedFrom · sendRequest). 화면은 직접 부르지 않는다
 *
 * 규칙 (명세 그대로)
 * - 대화방은 대화 요청이 수락돼야 생김. 수락 전에는 대화방이 없음 (요청 탭에서만 봄)
 * - 요청 상태: PENDING · REJECTED · ACCEPTED · CANCELED. 만료는 저장하지 않고 보낸 지 5일이 지났는지로 셈
 *   받은 쪽에는 PENDING 만, 보낸 쪽에는 PENDING · REJECTED 가 똑같이 "답변 기다리는 중"으로 보임 (거절을 드러내지 않음)
 * - 내가 거절한 요청이 살아 있는 사람에게 내가 요청하면: 새 요청 대신 그 요청을 수락한 것으로 처리 → 대화방
 * - 메시지 종류: TEXT · ACCEPTED(대화 시작) · JOINED(모임 참여) · LEFT(나감) · WITHDRAWN(탈퇴). TEXT 가 아닌 것은 안내 메시지
 * - 안 읽은 수 = 마지막으로 읽은 메시지(lastReadId) 뒤의, 남이 보낸 TEXT 수. 읽음은 읽음 API 로만 옮김
 * - 1:1 에서 상대가 나가거나 탈퇴하면 읽기 전용. 모임 대화방은 읽기 전용이 되지 않음
 * - 메시지 지우기 · 읽음 표시 · 입력 중 · 접속 중은 없음 (명세 README "이번 범위에 없는 것")
 */
import { ME_ID, USERS } from './mock'
import { canQuit, findMeetup, getMeetupState, isPast, membersOf as meetupMembers, myOf } from './meetupStore'
import type { User } from './types'

export type MsgType = 'TEXT' | 'ACCEPTED' | 'JOINED' | 'LEFT' | 'WITHDRAWN'
export interface ChatImage { id: string; url: string }
export interface ChatMsg {
  /** 메시지 id. 숫자 글자 ("1004"). 같은 방 안에서 클수록 나중 (명세) */
  id: string
  type: MsgType
  /** 보낸 사람, 또는 안내를 일으킨 사람 */
  authorId: string
  /** 본문. 안내 메시지와 사진만 보낸 메시지는 '' */
  text: string
  images: ChatImage[]
  /** ms */
  at: number
  /** 안내 메시지 (type 이 TEXT 가 아님). 모임 상세의 대화 미리보기가 씀 */
  system?: boolean
}
export interface Room {
  id: string
  kind: 'dm' | 'group'
  partnerId?: string
  meetupId?: string
  messages: ChatMsg[]
  /** 내가 마지막으로 읽은 메시지 id (0 = 없음) */
  lastReadId: number
  /** 안 읽은 수 (저장소가 바꿀 때마다 다시 셈. 모임 목록 화면이 읽음) */
  unread: number
  /** 상대가 나감 / 탈퇴 → 읽기 전용 (1:1 만) */
  closed?: 'left' | 'gone'
  /** 모임 공지 (주최자만 씀) */
  notice?: string
  /** 만든 시각 (메시지가 없는 방의 정렬) */
  createdAt: number
}
export type ReqStatus = 'PENDING' | 'REJECTED' | 'ACCEPTED' | 'CANCELED'
export interface Req {
  id: string
  direction: 'received' | 'sent'
  userId: string
  /** 요청에 붙인 인사 (없으면 '') */
  message: string
  at: number
  status: ReqStatus
  /** 수락돼 만들어진 대화방 */
  chatRoomId?: string
}

export const REQUEST_TTL_DAYS = 5
export const GONE_ID = 'gone'
export const GONE_USER: User = { id: GONE_ID, nickname: '탈퇴한 사용자', affiliation: '', intro: '', interests: [] }
/** 목 메시지 본문에 넣는 모임 링크의 앞부분 (모임 상세의 "링크 복사"와 같은 모양: …/meetups/<id>) */
export const MOCK_LINK_BASE = 'https://it-ting.example'

const min = 60_000, hour = 60 * min, day = 24 * hour
let msgSeq = 1000
const nextMsgId = () => String(++msgSeq)
let reqSeq = 0
const nextReqId = () => `q${Date.now().toString(36)}${(reqSeq++).toString(36)}`

/** 그룹 대화방 id: 모임 id 로 정해짐 (모임 상세·목록의 "모임 채팅" 링크가 씀) */
export const groupRoomId = (meetupId: string) => `g-${meetupId}`
/** 예전 링크(알림 목 데이터의 /chat/r-book) */
const ALIAS: Record<string, string> = { 'r-book': 'g-m1' }

type Seed = Omit<ChatMsg, 'id' | 'images' | 'system'> & { images?: ChatImage[] }
const msgOf = (m: Seed): ChatMsg => ({ ...m, id: nextMsgId(), images: m.images ?? [], ...(m.type !== 'TEXT' ? { system: true } : {}) })

function seed() {
  const now = Date.now()
  const rel = (minutes: number) => now - minutes * min
  const T = (authorId: string, text: string, at: number, images?: ChatImage[]): Seed => ({ type: 'TEXT', authorId, text, at, images })
  const N = (type: Exclude<MsgType, 'TEXT'>, authorId: string, at: number): Seed => ({ type, authorId, text: '', at })
  const room = (r: Omit<Room, 'messages' | 'lastReadId' | 'unread' | 'createdAt'> & { messages: Seed[]; unreadFrom?: number }): Room => {
    const messages = r.messages.map(msgOf)
    // unreadFrom: 몇 번째 메시지부터 안 읽었는지 (없으면 다 읽음)
    const lastReadId = r.unreadFrom == null ? +(messages[messages.length - 1]?.id ?? 0) : +(messages[r.unreadFrom - 1]?.id ?? 0)
    const { unreadFrom: _u, ...rest } = r
    void _u
    return withUnread({ ...rest, messages, lastReadId, unread: 0, createdAt: messages[0]?.at ?? now })
  }
  const rooms: Room[] = [
    room({
      id: 'r-yerin', kind: 'dm', partnerId: 'yerin',
      messages: [
        N('ACCEPTED', 'yerin', rel(40)),
        T(ME_ID, '안녕하세요! 땅굴에 캠핑 가구 있는 거 보고 반가웠어요 ㅎㅎ', rel(39)),
        T('yerin', '안녕하세요! 저도 캠핑 좋아해요. 다음에 같이 캠핑 모임 가실래요?', rel(27)),
        T(ME_ID, '좋아요! 저 텐트는 있는데 침낭이 없어서… 초보도 괜찮은 모임이면 좋겠어요', rel(27)),
        T('yerin', `마침 가평 1박 캠핑 모임이 초보 환영이래요. 같이 신청해볼까요? ${MOCK_LINK_BASE}/meetups/m4`, rel(24)),
      ],
    }),
    room({
      id: 'r-mingu', kind: 'dm', partnerId: 'mingu', unreadFrom: 3,
      messages: [
        N('ACCEPTED', ME_ID, now - 2 * day),
        T('mingu', '레트로게임 좋아하신다길래 반가워서 요청했어요!', now - 2 * day + 5 * min),
        T(ME_ID, '반가워요! 요즘은 오락실 게임 위주로 해요', now - 2 * day + 20 * min),
        T('mingu', '오 저도요. 혹시 이번 주말 캠핑 모임 갈래요?', rel(50)),
        T('mingu', '보드게임도 챙겨 간대요 ㅋㅋ', rel(48)),
      ],
    }),
    room({
      id: 'g-m1', kind: 'group', meetupId: 'm1', unreadFrom: 1,
      notice: '읽고 있는 책 한 권 챙겨오세요. 3층 세미나실 입구에서 만나요!',
      messages: [
        N('JOINED', ME_ID, rel(75)),
        T('kim', '다들 이번 주에 뭐 읽고 계세요?', rel(65)),
        T('park', '저는 에세이요! 다 못 읽어도 괜찮다고 해서 마음이 편해요 ㅎㅎ', rel(50)),
        T('lee', '저는 이번 주에 SF 단편집 가져갈게요', rel(48)),
        T(ME_ID, '저도 반쯤 읽은 소설 들고 갈게요. 일요일에 봬요!', rel(43)),
      ],
    }),
    room({
      id: 'g-m3', kind: 'group', meetupId: 'm3',
      messages: [
        N('JOINED', 'seobeok', now - day - 3 * hour),
        T('seobeok', '연필 4B 하나면 될까요?', now - day - 2 * hour),
        T('park', '저는 색연필도 챙겨 갈게요 🎨', now - day - hour),
      ],
    }),
    // 끝난 모임(10월 독서 모임)의 대화방: 계속 남고, 나가기는 대화방에서만 (참여 취소 없이)
    room({
      id: 'g-p1', kind: 'group', meetupId: 'p1',
      notice: '다음 달 책은 투표로 정해요!',
      messages: [
        N('JOINED', ME_ID, now - 30 * day),
        T('kim', '다들 즐거웠어요! 다음에 또 봐요', now - 3 * day),
      ],
    }),
    room({
      id: 'r-seoyeon', kind: 'dm', partnerId: 'seoyeon', closed: 'left',
      messages: [
        N('ACCEPTED', 'seoyeon', now - 6 * day),
        T('seoyeon', '필름카메라 어떤 거 쓰세요?', now - 6 * day + 10 * min),
        T(ME_ID, '올림푸스 뮤2요! 사진 스터디 자료 공유해 드릴게요', now - 6 * day + 30 * min),
        N('LEFT', 'seoyeon', now - 5 * day),
      ],
    }),
    room({
      id: 'r-gone', kind: 'dm', partnerId: GONE_ID, closed: 'gone',
      messages: [
        T(GONE_ID, '주말에 같이 산책해요!', now - 9 * day),
        T(ME_ID, '좋아요 :)', now - 9 * day + hour),
        N('WITHDRAWN', GONE_ID, now - 8 * day),
      ],
    }),
  ]
  const requests: Req[] = [
    { id: 'q1', direction: 'received', userId: 'seobeok', status: 'PENDING', at: now - 12 * min, message: '땅굴에 이젤 있는 거 보고 반가워서요! 주말에 같이 드로잉해요' },
    { id: 'q2', direction: 'received', userId: 'ha', status: 'PENDING', at: now - hour, message: '가평 캠핑 모임 같이 가시는 거 맞죠? 장비 얘기 나눠요' },
    // 6일 전 요청 → 5일이 지나 만료 (목록에 안 보임)
    { id: 'q0', direction: 'received', userId: 'choi', status: 'PENDING', at: now - 6 * day, message: '테라리움 같이 만들어요' },
    { id: 'q3', direction: 'sent', userId: 'yejin', status: 'PENDING', at: now - 5 * min, message: '땅굴에 찻병 선반 있는 거 보고 반가워서요! 핸드드립 이야기 같이 나눠요' },
    // 상대가 거절한 보낸 요청: 나에게는 그대로 "답변 기다리는 중" (거절을 드러내지 않음)
    { id: 'q4', direction: 'sent', userId: 'lee', status: 'REJECTED', at: now - 2 * day, message: '' },
  ]
  return { rooms, requests, leftGroups: [] as string[] }
}

/* ---------- 저장소 ---------- */
const meetupOf = (id: string) => findMeetup(id)
let state = seed()
// 화면이 이 저장소를 직접 지켜보지 않는다 (채팅 캐시는 목 서버의 실시간 소식 · 조회로 맞춤). 바뀔 때마다 새 객체로만 바꿔 둠
const emit = () => { state = { ...state } }
/** 저장소 구독 (목 모드에서 바뀌면 채팅 캐시를 새로 받는 데 씀: api/chat/queries useChatMockSync) */
/** 훅 바깥에서 지금 상태 */
export const getChatState = () => state

/** 안 읽은 수: lastReadId 뒤의, 남이 보낸 TEXT */
export function unreadOf(r: Pick<Room, 'messages' | 'lastReadId'>) { return r.messages.filter((m) => +m.id > r.lastReadId && m.type === 'TEXT' && m.authorId !== ME_ID).length }
function withUnread(r: Room): Room { const unread = unreadOf(r); return r.unread === unread ? r : { ...r, unread } }

const isLive = (r: Req) => Date.now() - r.at < REQUEST_TTL_DAYS * day
/** 나에게 보이는 요청 (받은 PENDING, 보낸 PENDING · REJECTED, 5일 안), 최신순 */
export const liveRequests = (s = state) => s.requests
  .filter((r) => isLive(r) && (r.status === 'PENDING' || (r.direction === 'sent' && r.status === 'REJECTED')))
  .sort((a, b) => b.at - a.at)
export const receivedCount = (s = state) => liveRequests(s).filter((r) => r.direction === 'received').length
export const sentCount = (s = state) => liveRequests(s).filter((r) => r.direction === 'sent').length
export const roomOf = (id: string, s = state) => s.rooms.find((r) => r.id === (ALIAS[id] ?? id))
/** 그 사람과의 1:1 (읽기 전용이 아닌 것 먼저) */
export const dmRoomWith = (userId: string, s = state) =>
  s.rooms.find((r) => r.kind === 'dm' && r.partnerId === userId && !r.closed) ?? s.rooms.find((r) => r.kind === 'dm' && r.partnerId === userId)
/** 내가 그 사람에게 보낸 살아 있는 요청 */
export const sentRequestTo = (userId: string, s = state) => liveRequests(s).find((r) => r.direction === 'sent' && r.userId === userId)
/** 그 사람이 나에게 보냈고 내가 아직 답하지 않은 요청 */
export const receivedFrom = (userId: string, s = state) => liveRequests(s).find((r) => r.direction === 'received' && r.userId === userId)
/** 그 사람이 보냈고 내가 거절한, 아직 만료되지 않은 요청 */
export const rejectedFrom = (userId: string, s = state) => s.requests.find((r) => r.direction === 'received' && r.userId === userId && r.status === 'REJECTED' && isLive(r))
export const requestById = (id: string, s = state) => s.requests.find((r) => r.id === id)

export const personOf = (id: string): User => (id === GONE_ID ? GONE_USER : USERS[id] ?? GONE_USER)

/** 모임 대화 참여자 (주최자 + 참여 확정자 + 나). 주최자가 맨 앞. 확정자는 모임 저장소 기준 */
export function membersOf(room: Room): string[] {
  const m = room.meetupId ? meetupOf(room.meetupId) : undefined
  if (!m) return [ME_ID]
  return [...new Set([m.hostId, ...meetupMembers(m.id), ME_ID])]
}
/** 모임이 끝났거나 취소됨 (모임 저장소 기준) */
export function meetupEnded(room: Room): boolean {
  const m = room.meetupId ? meetupOf(room.meetupId) : undefined
  return !!m && (isPast(m) || !!m.cancelled)
}

/**
 * 모임 저장소와 맞추기: 참여 확정·내가 주최인 모임은 모두 대화방이 있음 (새로 만든 모임·새로 확정된 모임 포함).
 * 내가 나간 모임 대화방은 다시 만들지 않음 (한 번 나간 대화방에는 다시 들어갈 수 없음, 명세). 목 서버가 목록을 줄 때마다 부름
 */
export function syncGroupRooms() {
  const ms = getMeetupState()
  const add: Room[] = []
  for (const m of ms.list) {
    const st = myOf(m.id, ms)?.st
    if (st !== 'joined' && st !== 'host') continue
    const id = groupRoomId(m.id)
    if (state.rooms.some((r) => r.id === id) || state.leftGroups.includes(id)) continue
    const at = Date.now() - 4 * day
    const messages = st === 'joined' ? [msgOf({ type: 'JOINED', authorId: ME_ID, text: '', at })] : []
    add.push({ id, kind: 'group', meetupId: m.id, lastReadId: +(messages[0]?.id ?? 0), unread: 0, createdAt: at, messages })
  }
  if (add.length) { state.rooms = [...state.rooms, ...add]; emit() }
}


/* ---------- 동작 (목 서버가 부름) ---------- */
function patchRoom(roomId: string, f: (r: Room) => Room) {
  const r = roomOf(roomId)
  if (!r) return
  const next = withUnread(f(r))
  if (next === r) return
  state.rooms = state.rooms.map((x) => (x === r ? next : x))
  emit()
}

/** 메시지 한 건 넣기 (보내기 · 안내 · 목 상대 답장). 내가 보낸 것이면 내 읽은 자리도 그 메시지로 (명세) */
export function appendMessage(roomId: string, m: { type?: MsgType; authorId: string; text?: string; images?: ChatImage[] }): ChatMsg | null {
  const r = roomOf(roomId)
  if (!r) return null
  const msg = msgOf({ type: m.type ?? 'TEXT', authorId: m.authorId, text: m.text ?? '', images: m.images, at: Date.now() })
  patchRoom(r.id, (x) => ({ ...x, messages: [...x.messages, msg], lastReadId: m.authorId === ME_ID ? +msg.id : x.lastReadId }))
  return msg
}

/** 읽음: 내 읽은 자리를 messageId 로 (이미 더 뒤까지 읽었으면 그대로) */
export function markReadUpTo(roomId: string, messageId: number) {
  patchRoom(roomId, (x) => (messageId > x.lastReadId ? { ...x, lastReadId: messageId } : x))
}

/** 1:1 상대가 나감 · 탈퇴 (목 손잡이 · 시험용) → 읽기 전용 + 안내 메시지 */
export function closeByPartner(roomId: string, why: 'left' | 'gone') {
  const r = roomOf(roomId)
  if (!r || r.kind !== 'dm' || r.closed) return null
  const msg = appendMessage(r.id, { type: why === 'gone' ? 'WITHDRAWN' : 'LEFT', authorId: r.partnerId! })
  patchRoom(r.id, (x) => ({ ...x, closed: why }))
  return msg
}

/** 대화방에서 나가기 → 내 목록에서 사라짐. 모임 대화방은 다시 생기지 않게 기억 */
export function leaveRoom(id: string) {
  const r = roomOf(id)
  if (!r) return
  state.rooms = state.rooms.filter((x) => x !== r)
  if (r.kind === 'group') state.leftGroups = [...state.leftGroups, r.id]
  emit()
}

/** 모임 나가기(참여 취소) 가능 여부: 주최자 아님 · 끝나지 않음 · 시작 24시간 전 (모임 상세의 "참여 취소"와 같은 규칙) */
export function canQuitMeetup(room: Room): { ok: boolean; why?: string } {
  const m = room.meetupId ? meetupOf(room.meetupId) : undefined
  if (!m) return { ok: false }
  if (m.cancelled || isPast(m)) return { ok: true } // 대화방만 나감
  if (m.hostId === ME_ID) return { ok: false, why: '주최자는 모임을 나갈 수 없어요' }
  if (!canQuit(m)) return { ok: false, why: '시작 24시간 전부터는 나갈 수 없어요' }
  return { ok: true }
}

export function setNotice(id: string, text: string | null) {
  patchRoom(id, (x) => ({ ...x, notice: text?.trim() || undefined }))
}

/** 1:1 대화방 만들기 (수락). ACCEPTED 안내는 수락한 사람 이름으로. 요청의 인사는 옮기지 않음 (명세) */
function openDm(userId: string, acceptedBy: string): string {
  const id = `r-${userId}-${Date.now().toString(36)}`
  const at = Date.now()
  const first = msgOf({ type: 'ACCEPTED', authorId: acceptedBy, text: '', at })
  state.rooms = [{ id, kind: 'dm', partnerId: userId, lastReadId: +first.id, unread: 0, createdAt: at, messages: [first] }, ...state.rooms]
  return id
}

/** 받은 요청 수락 → 1:1 대화방 id. 이미 수락한 요청은 그때 만든 방. 없거나 만료 · 거절 · 취소면 null */
export function acceptRequest(reqId: string): string | null {
  const q = requestById(reqId)
  if (!q || q.direction !== 'received') return null
  if (q.status === 'ACCEPTED') return q.chatRoomId ?? null
  if (q.status !== 'PENDING' || !isLive(q)) return null
  const id = openDm(q.userId, ME_ID)
  state.requests = state.requests.map((r) => (r === q ? { ...r, status: 'ACCEPTED' as const, chatRoomId: id } : r))
  emit()
  return id
}
/** 받은 요청 거절 (상대에게 알리지 않음). 이미 거절했으면 그대로 성공. 없거나 만료 · 수락 · 취소면 false */
export function rejectRequest(reqId: string): boolean {
  const q = requestById(reqId)
  if (!q || q.direction !== 'received' || !isLive(q)) return false
  if (q.status === 'REJECTED') return true
  if (q.status !== 'PENDING') return false
  state.requests = state.requests.map((r) => (r === q ? { ...r, status: 'REJECTED' as const } : r))
  emit()
  return true
}
/** 보낸 요청 취소. 상대가 거절했어도 똑같이 성공. 이미 수락됐으면 { accepted: 방 id } */
export function cancelRequest(reqId: string): { ok: true; wasPending: boolean } | { ok: false; accepted?: string } {
  const q = requestById(reqId)
  if (!q || q.direction !== 'sent') return { ok: false }
  if (q.status === 'ACCEPTED') return { ok: false, accepted: q.chatRoomId }
  if (q.status === 'CANCELED' || !isLive(q)) return { ok: false }
  state.requests = state.requests.map((r) => (r === q ? { ...r, status: 'CANCELED' as const } : r))
  emit()
  return { ok: true, wasPending: q.status === 'PENDING' }
}
/** 상대가 나에게 요청을 보냄 (목 손잡이 · 시험용) */
export function receiveRequest(userId: string, message: string): Req {
  const q: Req = { id: nextReqId(), direction: 'received', userId, message, at: Date.now(), status: 'PENDING' }
  state.requests = [q, ...state.requests]
  emit()
  return q
}

/**
 * 대화 요청 보내기 (05 탐색 · 방문의 POST /chat-requests 가 하는 일. 탐색 목 서버가 부름). 못 만든 까닭은 명세 409 code 그대로
 * - 열린 1:1 이 있으면 / 내가 보낸 살아 있는 요청이 있으면 / 상대가 먼저 보낸 요청에 답하지 않았으면 → 만들지 않음 (null, 까닭)
 * - 내가 거절한 그 사람의 요청이 살아 있으면 → 새 요청 대신 그것을 수락한 것으로 처리. 내 인사는 대화방의 첫 메시지로
 */
export type SendRequestResult =
  | { ok: true; chatRequestId: string | null; chatRoomId: string | null }
  | { ok: false; why: 'CHAT_ROOM_ALREADY_EXISTS' | 'CHAT_REQUEST_ALREADY_SENT' | 'CHAT_REQUEST_ALREADY_RECEIVED' }
export function sendRequest(userId: string, message: string): SendRequestResult {
  const open = dmRoomWith(userId)
  if (open && !open.closed) return { ok: false, why: 'CHAT_ROOM_ALREADY_EXISTS' }
  if (sentRequestTo(userId)) return { ok: false, why: 'CHAT_REQUEST_ALREADY_SENT' }
  if (receivedFrom(userId)) return { ok: false, why: 'CHAT_REQUEST_ALREADY_RECEIVED' }
  const rej = rejectedFrom(userId)
  if (rej) {
    const id = openDm(userId, ME_ID)
    state.requests = state.requests.map((r) => (r === rej ? { ...r, status: 'ACCEPTED' as const, chatRoomId: id } : r))
    emit()
    if (message.trim()) appendMessage(id, { authorId: ME_ID, text: message.trim() })
    return { ok: true, chatRequestId: null, chatRoomId: id }
  }
  const q: Req = { id: nextReqId(), direction: 'sent', userId, message, at: Date.now(), status: 'PENDING' }
  state.requests = [q, ...state.requests]
  emit()
  return { ok: true, chatRequestId: q.id, chatRoomId: null }
}

