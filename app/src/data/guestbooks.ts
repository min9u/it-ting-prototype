/**
 * 방명록 목 저장소 (목 서버의 guestbook_entry 테이블). 땅굴 주인별로 나눔 (위험 B9).
 *
 * - 05 방명록 쓰기(POST /burrows/{burrowId}/guestbook-entries, api/explore)와 04 방명록 목록 · 지우기(api/burrow)가
 *   같은 글을 보도록 저장소를 한 곳에 둠. 그래서 방문자가 남긴 글이 주인의 목록에 그대로 나온다
 * - 내 땅굴은 data/mock.ts 의 GUESTBOOK 배열 그 자체 (예전 화면이 그 배열을 바로 읽으므로 같은 배열을 고침)
 * - 남의 땅굴은 목 데이터가 원래 하나뿐이라 주인마다 다른 몇 개를 골라 씀 (주인이 쓴 글은 뺌)
 * - 신고로 가려진 글(서로 다른 3명)은 목록에서 빠짐 (lib/format visibleGuestbook)
 */
import { GUESTBOOK, ME_ID } from './mock'
import type { GuestbookEntry } from './types'
import { visibleGuestbook } from '../lib/format'
import { toIso } from '../lib/time'

function hash(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }

const books = new Map<string, GuestbookEntry[]>()

/** 그 주인 땅굴의 방명록 (가려진 글 포함, 저장 순서 그대로). 처음 부를 때 만듦 */
function bookOf(ownerId: string): GuestbookEntry[] {
  let b = books.get(ownerId)
  if (!b) {
    if (ownerId === ME_ID) b = GUESTBOOK
    else {
      const pool = GUESTBOOK.filter((g) => g.authorId !== ownerId)
      const h = hash(ownerId)
      const n = 2 + (h % 5)
      b = Array.from({ length: Math.min(n, pool.length) }, (_, i) => ({ ...pool[(h + i * 3) % pool.length], reporters: undefined, id: `${ownerId}-gb${i}` }))
    }
    books.set(ownerId, b)
  }
  return b
}

/** 보이는 글만 최신순 (신고로 가려진 글 빠짐) */
export const guestbookOf = (ownerId: string): GuestbookEntry[] => visibleGuestbook(bookOf(ownerId))
/** 보이는 글 수 (우체통 깃발 · 방명록 제목 옆 숫자) */
export const guestbookCountOf = (ownerId: string): number => guestbookOf(ownerId).length

/** 글 쓰기 → 만든 글 */
export function addGuestbookEntry(ownerId: string, authorId: string, text: string): GuestbookEntry {
  const g: GuestbookEntry = { id: `gb${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`, authorId, text, createdAt: toIso(Date.now()) }
  bookOf(ownerId).unshift(g)
  return g
}

/** 글 찾기 (가려진 글은 없는 글로 봄) → 글과 땅굴 주인 */
export function findGuestbookEntry(entryId: string): { entry: GuestbookEntry; ownerId: string } | null {
  for (const [ownerId, b] of books) {
    const entry = b.find((g) => g.id === entryId)
    if (entry) return visibleGuestbook([entry]).length ? { entry, ownerId } : null
  }
  // 아직 한 번도 열지 않은 내 방명록의 글
  const mine = GUESTBOOK.find((g) => g.id === entryId)
  return mine && visibleGuestbook([mine]).length ? { entry: mine, ownerId: ME_ID } : null
}

/** 글 지우기. 지웠으면 true */
export function removeGuestbookEntry(entryId: string): boolean {
  const hit = findGuestbookEntry(entryId)
  if (!hit) return false
  const b = bookOf(hit.ownerId)
  b.splice(b.indexOf(hit.entry), 1)
  return true
}

/** 신고 한 번 (같은 사람이 또 눌러도 1명). 서로 다른 3명이면 visibleGuestbook 이 뺌 */
export function reportGuestbookEntry(entryId: string, reporterId: string): boolean {
  const hit = findGuestbookEntry(entryId)
  if (!hit) return false
  const g = hit.entry
  if (!(g.reporters ?? []).includes(reporterId)) g.reporters = [...(g.reporters ?? []), reporterId]
  return true
}
