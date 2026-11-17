/**
 * 메시지 목록 합치기: 중복 제거 + 순서 보장 (실시간·다시 받기·내가 보낸 것의 확인이 섞여 와도 같은 결과).
 *
 * 규칙
 * 1. 같은 clientId(내가 보낸 것의 확인)가 있으면 그 자리의 "보내는 중/실패" 메시지를 서버 것으로 바꿈
 * 2. 같은 id 가 이미 있으면 버림 (재연결 뒤 다시 받은 것, 두 번 온 방송)
 * 3. 정렬: 서버 순서(seq)가 있는 것은 seq 오름차순, 아직 seq 가 없는 것(보내는 중·실패)은 맨 아래에 보낸 순서대로.
 *    클라이언트 시계는 믿지 않음 (seq 가 같으면 원래 순서 유지)
 */
export interface Orderable {
  id: string
  seq?: number
  clientId?: string
}

export function mergeMessage<T extends Orderable>(list: readonly T[], incoming: T): T[] {
  let next: T[]
  const byClient = incoming.clientId ? list.findIndex((m) => m.clientId === incoming.clientId) : -1
  if (byClient >= 0) {
    next = list.slice()
    next[byClient] = incoming
  } else if (list.some((m) => m.id === incoming.id)) {
    return list as T[]
  } else {
    next = [...list, incoming]
  }
  return sortMessages(next)
}

export function mergeMessages<T extends Orderable>(list: readonly T[], incoming: readonly T[]): T[] {
  let out = list as T[]
  for (const m of incoming) out = mergeMessage(out, m)
  return out
}

/** seq 있는 것 오름차순 → seq 없는 것(보내는 중) 원래 순서. 안정 정렬 */
export function sortMessages<T extends Orderable>(list: readonly T[]): T[] {
  const indexed = list.map((m, i) => ({ m, i }))
  indexed.sort((a, b) => {
    const sa = a.m.seq, sb = b.m.seq
    if (sa != null && sb != null) return sa - sb || a.i - b.i
    if (sa != null) return -1
    if (sb != null) return 1
    return a.i - b.i
  })
  // 바뀐 게 없으면 같은 배열 (React 다시 그리기 줄이기)
  return indexed.every((x, i) => x.i === i) ? (list as T[]) : indexed.map((x) => x.m)
}

/** 이 목록에서 가장 큰 seq (다시 받기 기준) */
export function maxSeq(list: readonly Orderable[]): number | undefined {
  let s: number | undefined
  for (const m of list) if (m.seq != null && (s == null || m.seq > s)) s = m.seq
  return s
}

/** 보낼 때 쓰는 클라이언트 id (UUID). crypto.randomUUID 가 없는 곳(http 비보안 출처 등)은 대신 만듦 */
export function newClientId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  } catch { /* 비보안 출처 */ }
  const r = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0')
  return `${r()}${r()}-${r()}-4${r().slice(1)}-${r()}-${r()}${r()}${r()}`
}
