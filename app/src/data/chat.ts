/**
 * 채팅 상태 (Figma 02 F6 · 00 공통 14). 서버가 없어서 이 탭 안에서만 기억하는 작은 저장소.
 * 채팅 화면·방문자 뷰(대화 요청하기)·알림 등 여러 화면이 같은 상태를 봄 → useSyncExternalStore 로 구독
 *
 * 규칙 (명세 그대로)
 * - 대화방은 대화 요청이 수락돼야 생김. 수락 전에는 대화방이 없음 (요청 탭에서만 봄)
 * - 요청은 보낸 지 5일이 지나면 만료 → 양쪽에서 사라짐
 * - 거절·취소는 상대에게 알리지 않음
 * - 1:1 대화 나가기: 내 목록에서 사라짐. 상대 쪽 대화는 남되 읽기 전용("상대방이 대화방을 나갔습니다")
 * - 상대가 탈퇴: 내 목록에 남고 읽기 전용("상대방이 탈퇴했습니다"), 상대는 "탈퇴한 사용자"
 * - 모임 대화: 참여 확정된 사람끼리. 공지는 하나, 주최자만 쓰기·고치기·지우기
 * - 모임 나가기 = 모임 상세의 "참여 취소" (시작 24시간 전까지, 주최자는 없음). 끝나거나 취소된 모임은 참여 취소 없이 대화방만 나감
 */
import { useSyncExternalStore } from 'react'
import { ME_ID, USERS } from './mock'
import { canQuit, findMeetup, getMeetupState, isPast, membersOf as meetupMembers, myOf, quit as quitMeetup } from './meetupStore'
import type { User } from './types'

export interface ChatMsg {
  id: string
  /** 'system' = 가운데 안내 */
  authorId: string
  text: string
  /** ms */
  at: number
  system?: boolean
  /** 모임 링크를 보낸 메시지 → 모임 카드 */
  meetupId?: string
}
export interface Room {
  id: string
  kind: 'dm' | 'group'
  partnerId?: string
  meetupId?: string
  messages: ChatMsg[]
  unread: number
  /** 상대가 나감 / 탈퇴 → 읽기 전용 */
  closed?: 'left' | 'gone'
  /** 모임 공지 (주최자만 씀) */
  notice?: string
  /** 모임이 끝났거나 취소됨 → 참여 취소 없이 대화방만 나감 */
  ended?: boolean
  /** 1:1 대화 시작 때 함께 이야기할 관심사 */
  topics?: string[]
}
export interface Req {
  id: string
  direction: 'received' | 'sent'
  userId: string
  message: string
  at: number
  /** "땅굴에 다녀갔어요" 같은 맥락 */
  context: string
}

export const REQUEST_TTL_DAYS = 5
export const GONE_ID = 'gone'
export const GONE_USER: User = { id: GONE_ID, nickname: '탈퇴한 사용자', affiliation: '', intro: '', interests: [] }

const now = Date.now()
const min = 60_000, hour = 60 * min, day = 24 * hour
/** N분 전 */
const rel = (minutes: number) => now - minutes * min
let seq = 0
const mid = () => `c${Date.now().toString(36)}${(seq++).toString(36)}`

/** 그룹 대화방 id: 모임 id 로 정해짐 (모임 상세·목록의 "모임 채팅" 링크가 씀) */
export const groupRoomId = (meetupId: string) => `g-${meetupId}`
/** 예전 링크(알림 목 데이터의 /chat/r-book) */
const ALIAS: Record<string, string> = { 'r-book': 'g-m1' }

function seed(): { rooms: Room[]; requests: Req[]; leftGroups: string[] } {
  const rooms: Room[] = [
    {
      id: 'r-yerin', kind: 'dm', partnerId: 'yerin', unread: 0, topics: ['캠핑', '레트로게임', '수채화'],
      messages: [
        { id: 'y0', authorId: 'system', system: true, text: '예린님이 대화 요청을 수락했어요', at: rel(40) },
        { id: 'y1', authorId: 'me', text: '안녕하세요! 땅굴에 캠핑 가구 있는 거 보고 반가웠어요 ㅎㅎ', at: rel(39) },
        { id: 'y2', authorId: 'yerin', text: '안녕하세요! 저도 캠핑 좋아해요. 다음에 같이 캠핑 모임 가실래요?', at: rel(27) },
        { id: 'y3', authorId: 'me', text: '좋아요! 저 텐트는 있는데 침낭이 없어서… 초보도 괜찮은 모임이면 좋겠어요', at: rel(27) },
        { id: 'y4', authorId: 'yerin', text: '마침 가평 1박 캠핑 모임이 초보 환영이래요. 같이 신청해볼까요?', at: rel(24) },
        { id: 'y5', authorId: 'yerin', text: '', at: rel(24), meetupId: 'm4' },
      ],
    },
    {
      id: 'r-mingu', kind: 'dm', partnerId: 'mingu', unread: 2, topics: ['SF소설', '레트로게임'],
      messages: [
        { id: 'k0', authorId: 'system', system: true, text: '민구님의 대화 요청을 수락했어요', at: now - 2 * day },
        { id: 'k1', authorId: 'mingu', text: '레트로게임 좋아하신다길래 반가워서 요청했어요!', at: now - 2 * day + 5 * min },
        { id: 'k2', authorId: 'me', text: '반가워요! 요즘은 오락실 게임 위주로 해요', at: now - 2 * day + 20 * min },
        { id: 'k3', authorId: 'mingu', text: '오 저도요. 혹시 이번 주말 캠핑 모임 갈래요?', at: rel(50) },
        { id: 'k4', authorId: 'mingu', text: '보드게임도 챙겨 간대요 ㅋㅋ', at: rel(48) },
      ],
    },
    {
      id: 'g-m1', kind: 'group', meetupId: 'm1', unread: 5,
      notice: '읽고 있는 책 한 권 챙겨오세요. 3층 세미나실 입구에서 만나요!',
      messages: [
        { id: 'g0', authorId: 'system', system: true, text: '닉네임님이 모임에 참여했어요', at: rel(75) },
        { id: 'g1', authorId: 'kim', text: '다들 이번 주에 뭐 읽고 계세요?', at: rel(65) },
        { id: 'g2', authorId: 'lee', text: '저는 이번 주에 SF 단편집 가져갈게요', at: rel(48) },
        { id: 'g3', authorId: 'park', text: '저는 에세이요! 다 못 읽어도 괜찮다고 해서 마음이 편해요 ㅎㅎ', at: rel(50) },
        { id: 'g4', authorId: 'me', text: '저도 반쯤 읽은 소설 들고 갈게요. 일요일에 봬요!', at: rel(43) },
      ],
    },
    {
      id: 'g-m3', kind: 'group', meetupId: 'm3', unread: 0,
      messages: [
        { id: 'd0', authorId: 'system', system: true, text: '서벅이님이 모임에 참여했어요', at: now - day - 3 * hour },
        { id: 'd1', authorId: 'seobeok', text: '연필 4B 하나면 될까요?', at: now - day - 2 * hour },
        { id: 'd2', authorId: 'park', text: '저는 색연필도 챙겨 갈게요 🎨', at: now - day - hour },
      ],
    },
    {
      id: 'g-m9', kind: 'group', meetupId: 'm9', unread: 0, ended: true,
      notice: '이번 주는 하울의 움직이는 성!',
      messages: [
        { id: 'h1', authorId: 'seobeok', text: '다들 즐거웠어요! 다음에 또 봐요', at: now - 3 * day },
        { id: 'h2', authorId: 'system', system: true, text: '모임이 끝났어요. 대화는 계속 남아 있어요', at: now - 3 * day + hour },
      ],
    },
    {
      id: 'r-seoyeon', kind: 'dm', partnerId: 'seoyeon', unread: 0, closed: 'left', topics: ['필름카메라'],
      messages: [
        { id: 'z0', authorId: 'system', system: true, text: '서연님이 대화 요청을 수락했어요', at: now - 6 * day },
        { id: 'z1', authorId: 'seoyeon', text: '필름카메라 어떤 거 쓰세요?', at: now - 6 * day + 10 * min },
        { id: 'z2', authorId: 'me', text: '올림푸스 뮤2요! 사진 스터디 자료 공유해 드릴게요', at: now - 6 * day + 30 * min },
      ],
    },
    {
      id: 'r-gone', kind: 'dm', partnerId: GONE_ID, unread: 0, closed: 'gone',
      messages: [
        { id: 'w1', authorId: GONE_ID, text: '주말에 같이 산책해요!', at: now - 9 * day },
        { id: 'w2', authorId: 'me', text: '좋아요 :)', at: now - 9 * day + hour },
      ],
    },
  ]
  const requests: Req[] = [
    { id: 'q1', direction: 'received', userId: 'seobeok', context: '땅굴에 다녀갔어요', at: now - 12 * min, message: '땅굴에 이젤 있는 거 보고 반가워서요! 주말에 같이 드로잉해요' },
    { id: 'q2', direction: 'received', userId: 'ha', context: '같은 모임 참여 예정', at: now - hour, message: '가평 캠핑 모임 같이 가시는 거 맞죠? 장비 얘기 나눠요' },
    // 6일 전 요청 → 5일이 지나 만료 (목록에 안 보임)
    { id: 'q0', direction: 'received', userId: 'choi', context: '땅굴에 다녀갔어요', at: now - 6 * day, message: '테라리움 같이 만들어요' },
    { id: 'q3', direction: 'sent', userId: 'yejin', context: '내가 먼저 대화를 요청했어요', at: now - 5 * min, message: '땅굴에 찻병 선반 있는 거 보고 반가워서요! 핸드드립 이야기 같이 나눠요' },
  ]
  return { rooms, requests, leftGroups: [] as string[] }
}

/* ---------- 저장소 ---------- */
/** 모임 정보는 모임 저장소(data/meetupStore.ts)에서 읽음 (새로 만든 모임 포함) */
const meetupOf = (id: string) => findMeetup(id)
let state = seed()
const subs = new Set<() => void>()
const emit = () => { state = { ...state }; subs.forEach((f) => f()) }
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
export function useChat() { return useSyncExternalStore(subscribe, () => state) }
/** 훅 바깥에서 지금 상태 (목 서버 api/chat.ts 가 방·요청 목록을 만들 때) */
export const getChatState = () => state

const live = (r: Req) => Date.now() - r.at < REQUEST_TTL_DAYS * day
export const liveRequests = (s = state) => s.requests.filter(live).sort((a, b) => b.at - a.at)
export const receivedCount = (s = state) => liveRequests(s).filter((r) => r.direction === 'received').length
export const roomOf = (id: string, s = state) => s.rooms.find((r) => r.id === (ALIAS[id] ?? id))
export const dmRoomWith = (userId: string, s = state) => s.rooms.find((r) => r.kind === 'dm' && r.partnerId === userId)
export const sentRequestTo = (userId: string, s = state) => liveRequests(s).find((r) => r.direction === 'sent' && r.userId === userId)

export const personOf = (id: string): User => (id === GONE_ID ? GONE_USER : USERS[id] ?? GONE_USER)

/** 모임 대화 참여자 (주최자 + 참여 확정자 + 나). 주최자가 맨 앞. 확정자는 모임 저장소 기준 */
export function membersOf(room: Room): string[] {
  const m = room.meetupId ? meetupOf(room.meetupId) : undefined
  if (!m) return [ME_ID]
  return [...new Set([m.hostId, ...meetupMembers(m.id), ME_ID])]
}

/**
 * 모임 저장소와 맞추기: 참여 확정·내가 주최인 모임은 모두 대화방이 있음 (새로 만든 모임·새로 확정된 모임 포함).
 * 내가 나간 모임 대화방은 다시 만들지 않음. 채팅 화면이 모임 상태가 바뀔 때마다 부름
 */
export function syncGroupRooms() {
  const ms = getMeetupState()
  const add: Room[] = []
  for (const m of ms.list) {
    const st = myOf(m.id, ms)?.st
    if (st !== 'joined' && st !== 'host') continue
    const id = groupRoomId(m.id)
    if (state.rooms.some((r) => r.id === id) || state.leftGroups.includes(id)) continue
    const ended = isPast(m) || !!m.cancelled
    add.push({ id, kind: 'group', meetupId: m.id, unread: 0, ended, messages: [{ id: `j-${m.id}`, authorId: 'system', system: true, text: st === 'host' ? '모임을 만들었어요. 참여가 확정된 사람이 이 대화방에 들어와요' : '닉네임님이 모임에 참여했어요', at: Date.now() - 4 * day }] })
  }
  // 모임이 끝났거나 취소되면 끝난 대화방으로
  let changed = false
  const rooms = state.rooms.map((r) => {
    if (r.kind !== 'group' || r.ended) return r
    const m = meetupOf(r.meetupId!)
    if (m && (isPast(m) || m.cancelled)) { changed = true; return { ...r, ended: true } }
    return r
  })
  if (add.length || changed) { state.rooms = [...rooms, ...add]; emit() }
}

export function roomTitle(r: Room) {
  if (r.kind === 'group') return meetupOf(r.meetupId!)?.title ?? '모임'
  return personOf(r.partnerId!).nickname
}
export const lastMsg = (r: Room) => r.messages[r.messages.length - 1]

/* ---------- 동작 ---------- */
export function markRead(id: string) {
  const r = roomOf(id)
  if (r && r.unread) { state.rooms = state.rooms.map((x) => (x === r ? { ...x, unread: 0 } : x)); emit() }
}

/** 보내기. 모임 링크(…/meetups/m4)가 들어 있으면 모임 카드도 붙음 */
export function send(roomId: string, text: string, meetupId?: string) {
  const r = roomOf(roomId)
  if (!r || r.closed) return
  const link = /\/meetups\/(m\d+)/.exec(text)?.[1]
  const card = meetupId ?? (link && meetupOf(link) ? link : undefined)
  const msg: ChatMsg = { id: mid(), authorId: ME_ID, text: card && !meetupId ? text.replace(/\S*\/meetups\/m\d+\S*/, '').trim() : text, at: Date.now(), meetupId: card }
  state.rooms = state.rooms.map((x) => (x === r ? { ...x, messages: [...x.messages, msg] } : x))
  emit()
}
/** 목 데이터: 상대가 답장 (1:1 에서 처음 보낼 때 한 번, 화면을 살아 있게 보이려고) */
export function fakeReply(roomId: string, text: string) {
  const r = roomOf(roomId)
  if (!r || r.closed || !r.partnerId) return
  state.rooms = state.rooms.map((x) => (x === r ? { ...x, messages: [...x.messages, { id: mid(), authorId: r.partnerId!, text, at: Date.now() }] } : x))
  emit()
}

/** 대화 나가기 → 내 목록에서 사라짐. 모임 대화방은 다시 생기지 않게 기억 */
export function leaveRoom(id: string) {
  const r = roomOf(id)
  state.rooms = state.rooms.filter((x) => x !== r)
  if (r?.kind === 'group') state.leftGroups = [...state.leftGroups, r.id]
  emit()
}
/** 모임 나가기: 끝나지 않은 모임이면 참여 취소(모임 저장소) + 대화방 나가기, 끝난 모임은 대화방만 */
export function quitGroup(id: string) {
  const r = roomOf(id)
  if (r?.meetupId && !r.ended) quitMeetup(r.meetupId)
  leaveRoom(id)
}

/** 모임 나가기(참여 취소) 가능 여부: 주최자 아님 · 끝나지 않음 · 시작 24시간 전 */
export function canQuitMeetup(room: Room): { ok: boolean; why?: string } {
  const m = room.meetupId ? meetupOf(room.meetupId) : undefined
  if (!m) return { ok: false }
  if (room.ended || m.cancelled || isPast(m)) return { ok: true } // 대화방만 나감
  if (m.hostId === ME_ID) return { ok: false, why: '주최자는 모임을 나갈 수 없어요' }
  // 모임 상세의 "참여 취소"와 같은 규칙 (data/meetupStore.ts canQuit, 시간 기준은 목 데이터의 오늘)
  if (!canQuit(m)) return { ok: false, why: '시작 24시간 전부터는 나갈 수 없어요' }
  return { ok: true }
}

export function setNotice(id: string, text: string | null) {
  const r = roomOf(id)
  if (!r) return
  state.rooms = state.rooms.map((x) => (x === r ? { ...x, notice: text?.trim() || undefined } : x))
  emit()
}

/** 받은 요청 수락 → 1:1 대화방이 생기고 그 방 id 를 돌려줌 */
export function acceptRequest(reqId: string): string | null {
  const q = state.requests.find((r) => r.id === reqId)
  if (!q) return null
  const u = personOf(q.userId)
  const me = USERS[ME_ID]
  const id = `r-${q.userId}`
  const t = Date.now()
  const room: Room = {
    id, kind: 'dm', partnerId: q.userId, unread: 0,
    topics: u.interests.filter((i) => me.interests.includes(i)),
    messages: [
      { id: mid(), authorId: 'system', system: true, text: `${u.nickname}님의 대화 요청을 수락했어요`, at: t },
      ...(q.message ? [{ id: mid(), authorId: q.userId, text: q.message, at: q.at }] : []),
    ],
  }
  state.requests = state.requests.filter((r) => r !== q)
  state.rooms = [room, ...state.rooms.filter((r) => r.id !== id)]
  emit()
  return id
}
/** 거절(받은 요청) · 취소(보낸 요청): 상대에게 알리지 않음 */
export function dropRequest(reqId: string) {
  state.requests = state.requests.filter((r) => r.id !== reqId)
  emit()
}
/** 방문자 뷰 "대화 요청하기" → 보낸 요청 */
export function sendRequest(userId: string, message: string, context = '내가 먼저 대화를 요청했어요') {
  if (sentRequestTo(userId) || dmRoomWith(userId)) return
  state.requests = [{ id: mid(), direction: 'sent', userId, message, at: Date.now(), context }, ...state.requests]
  emit()
}

/** 모임 공유(+ 버튼)에 보일 내 모임: 참여 확정·내가 주최, 끝나지 않은 것 */
export const myMeetups = () => getMeetupState().list.filter((m) => ['joined', 'host'].includes(myOf(m.id)?.st ?? '') && !isPast(m) && !m.cancelled)

/* ---------- 시간 표기 (00 공통 8) ---------- */
export function clock(ms: number) {
  const d = new Date(ms), h = d.getHours(), m = d.getMinutes()
  return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(m).padStart(2, '0')}`
}
/** 목록: 방금 · N분/N시간 전(오늘은 시각) · 어제 · N일 전 · 날짜 */
export function listTime(ms: number) {
  const diff = Date.now() - ms
  if (diff < min) return '방금'
  const d = new Date(ms), t = new Date()
  const days = Math.round((new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / day)
  if (days === 0) return clock(ms)
  if (days === 1) return '어제'
  if (days < 7) return `${days}일 전`
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}
/** 요청 카드: 방금 · N분 전 · N시간 전 · 어제 · N일 전 */
export function ago(ms: number) {
  const diff = Date.now() - ms
  if (diff < min) return '방금'
  if (diff < hour) return `${Math.floor(diff / min)}분 전`
  if (diff < day) return `${Math.floor(diff / hour)}시간 전`
  if (diff < 2 * day) return '어제'
  return `${Math.floor(diff / day)}일 전`
}
/** 날짜 구분선: 오늘 · 어제 · 11월 3일 (화) */
export function dayLabel(ms: number) {
  const d = new Date(ms), t = new Date()
  const days = Math.round((new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / day)
  if (days === 0) return '오늘'
  if (days === 1) return '어제'
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${'일월화수목금토'[d.getDay()]})`
}
