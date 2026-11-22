/**
 * 방명록 목 "DB" (땅굴 주인별). 목 서버의 방명록 API 가 같이 쓰는 저장소 한 곳:
 * - 04 내 땅굴 (api/burrow/mock.ts): GET /burrows/{burrowId}/guestbook-entries · DELETE /guestbook-entries/{id}
 * - 05 탐색 · 방문 (api/explore): POST /burrows/{burrowId}/guestbook-entries (쓰기) → 여기 guestbookOf(owner).unshift(…) 로 넣으면
 *   주인 쪽 목록에도 보인다
 *
 * 목에서 땅굴 id 는 주인의 사용자 id 와 같다 (burrowId 앱 id = 주인 앱 id, 예전 초안의 'b-<주인>' 도 받아 줌 → ownerOfBurrow)
 * 내 땅굴은 data/mock GUESTBOOK 전체, 남의 땅굴은 주인이 쓰지 않은 글 몇 개를 씨앗으로 골라 씀 (api/explore 예전 목과 같은 규칙)
 */
import { GUESTBOOK, ME_ID } from './mock'
import type { GuestbookEntry } from './types'

function hash(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }

const books = new Map<string, GuestbookEntry[]>()

/** 땅굴 id(앱 id) → 주인 id */
export const ownerOfBurrow = (burrowAppId: string) => burrowAppId.replace(/^b-/, '')

/** 주인의 방명록 (고칠 수 있는 배열 그대로. 신고로 가려진 글도 들어 있음 → 보일 것만은 lib/format visibleGuestbook) */
export function guestbookOf(ownerId: string): GuestbookEntry[] {
  let b = books.get(ownerId)
  if (!b) {
    if (ownerId === ME_ID) b = GUESTBOOK.map((g) => ({ ...g, reporters: g.reporters ? [...g.reporters] : undefined }))
    else {
      const pool = GUESTBOOK.filter((g) => g.authorId !== ownerId)
      const h = hash(ownerId)
      const n = 2 + (h % 5)
      b = Array.from({ length: Math.min(n, pool.length) }, (_, i) => ({ ...pool[(h + i * 3) % pool.length], id: `${ownerId}-gb${i}`, reporters: undefined }))
    }
    books.set(ownerId, b)
  }
  return b
}

/** 글 하나 찾기 (주인과 함께). 남의 땅굴 글 id 는 '<주인>-gb<n>' 이라 아직 안 연 방명록도 찾음 */
export function findGuestbookEntry(entryId: string): { ownerId: string; entry: GuestbookEntry; list: GuestbookEntry[] } | null {
  for (const [ownerId, list] of books) {
    const entry = list.find((g) => g.id === entryId)
    if (entry) return { ownerId, entry, list }
  }
  const m = /^(.+)-gb\d+$/.exec(entryId)
  const guess = m ? m[1] : ME_ID
  const list = guestbookOf(guess)
  const entry = list.find((g) => g.id === entryId)
  return entry ? { ownerId: guess, entry, list } : null
}

/** 시험용: 저장소 비우기 */
export const resetGuestbooks = () => books.clear()
