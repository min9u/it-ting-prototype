/**
 * 보내는 중 · 보내지 못한 내 메시지 (이 탭 안에서만). 대화방을 오가도 남아서 "다시 보내기"를 할 수 있다.
 *
 * - 보내기를 누르면 여기 "보내는 중"으로 넣고 화면 맨 아래에 그림 → POST /chat-rooms/{id}/messages
 * - 성공하면 응답 메시지를 메시지 캐시에 넣고 여기서 뺌. 실패하면 "실패" + 까닭 → 다시 보내기 · 지우기
 * - 명세에는 보낸 쪽이 만든 id(clientMessageId)가 없다. 같은 메시지가 실시간 소식으로 먼저 올 수 있어서,
 *   소식으로 온 "내 메시지"는 본문 · 사진 수가 같은 가장 오래된 "보내는 중"을 대신한다 (takeMatching)
 */
import { useSyncExternalStore } from 'react'

export interface PendingMessage {
  clientId: string
  roomId: string
  /** 보낼 본문 (사진만이면 null) */
  content: string | null
  /** 올려 둔 사진 (앱 id · 주소) */
  images: { id: string; url: string }[]
  /** ms (보낸 순서) */
  at: number
  status: 'sending' | 'failed'
  error?: string
}

let all: PendingMessage[] = []
/** 계정이 바뀔 때(clear)마다 늘어남. 이전 계정에서 보내던 결과가 늦게 와도 새 세션에 넣지 않으려고 */
let generation = 0
const subs = new Set<() => void>()
const set = (next: PendingMessage[]) => { all = next; byRoomCache.clear(); subs.forEach((f) => f()) }
const byRoomCache = new Map<string, PendingMessage[]>()
const EMPTY: PendingMessage[] = []

export const outbox = {
  get: (roomId: string): PendingMessage[] => {
    let v = byRoomCache.get(roomId)
    if (!v) { v = all.filter((p) => p.roomId === roomId); byRoomCache.set(roomId, v.length ? v : EMPTY) }
    return v.length ? v : EMPTY
  },
  find: (clientId: string) => all.find((p) => p.clientId === clientId),
  add: (p: PendingMessage) => set([...all, p]),
  /** 다시 보내기: 상태를 바꾸고 맨 아래로 */
  resend: (clientId: string) => {
    const p = all.find((x) => x.clientId === clientId)
    if (p) set([...all.filter((x) => x !== p), { ...p, status: 'sending', error: undefined, at: Date.now() }])
  },
  fail: (clientId: string, error: string) => set(all.map((p) => (p.clientId === clientId ? { ...p, status: 'failed' as const, error } : p))),
  remove: (clientId: string) => { if (all.some((p) => p.clientId === clientId)) set(all.filter((p) => p.clientId !== clientId)) },
  /** 소식으로 먼저 온 내 메시지와 짝인 "보내는 중"을 뺌 (있으면 그 clientId) */
  takeMatching: (roomId: string, content: string | null, imageCount: number): string | null => {
    const p = all.find((x) => x.roomId === roomId && x.status === 'sending' && (x.content ?? null) === (content ?? null) && x.images.length === imageCount)
    if (!p) return null
    set(all.filter((x) => x !== p))
    return p.clientId
  },
  /** 로그아웃 · 401 · 로그인 성공 때 (lib/authFlow dropUserData, lib/signOut afterSignOut). 다른 계정에 이전 사람의 미전송 글이 보이지 않게 */
  clear: () => { generation++; set([]) },
  generation: () => generation,
  subscribe: (f: () => void) => { subs.add(f); return () => { subs.delete(f) } },
}

export function useOutbox(roomId: string): PendingMessage[] {
  return useSyncExternalStore(outbox.subscribe, () => outbox.get(roomId), () => EMPTY)
}

/** 보낸 쪽 id (화면에서 "보내는 중" 메시지를 가리킬 때만. 서버에는 보내지 않음) */
export function newClientId(): string {
  try { if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID() } catch { /* 무시 */ }
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
