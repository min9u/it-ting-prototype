/**
 * 방명록 목 "DB" (목 서버의 guestbook_entry 테이블, 땅굴 주인별). 방명록 API 의 목 서버가 모두 이 저장소 한 곳을 쓴다:
 * - 04 내 땅굴 (api/burrow/mock.ts): GET /burrows/{burrowId}/guestbook-entries · DELETE /guestbook-entries/{id} · 신고 대상 확인(POST /reports GUESTBOOK)
 * - 05 탐색 · 방문 (api/explore/mock.ts): POST /burrows/{burrowId}/guestbook-entries (쓰기) · 남의 땅굴의 글 수
 * 그래서 방문자가 남긴 글이 주인의 목록에도 그대로 나온다 (2026-11-22 두 영역의 저장소를 하나로 합침)
 *
 * - 땅굴 id 는 주인의 사용자 id 와 같다 (탐색 목의 'b-<주인>' 도 받아 줌 → ownerOfBurrow)
 * - 내 땅굴은 data/mock GUESTBOOK 을 복사해 씨앗으로, 남의 땅굴은 주인이 쓰지 않은 글 몇 개를 골라 씨앗으로
 * - 신고로 가려진 글(서로 다른 3명)도 배열에 남는다 → 보일 것만은 visibleGuestbookOf (lib/format visibleGuestbook)
 */
import { GUESTBOOK, ME_ID } from './mock'
import type { GuestbookEntry } from './types'
import { isGuestbookHidden, visibleGuestbook } from '../lib/format'
import { toIso } from '../lib/time'

function hash(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }

const books = new Map<string, GuestbookEntry[]>()

/** 땅굴 id(앱 id) → 주인 id */
export const ownerOfBurrow = (burrowAppId: string) => burrowAppId.replace(/^b-/, '')

/** 주인의 방명록 (고칠 수 있는 배열 그대로, 최신순. 신고로 가려진 글도 들어 있음). 처음 부를 때 만듦 */
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
/** 보이는 글만 (신고로 가려진 글 빠짐) */
export const visibleGuestbookOf = (ownerId: string): GuestbookEntry[] => visibleGuestbook(guestbookOf(ownerId))
/** 보이는 글 수 (우체통 깃발 · 방명록 제목 옆 숫자) */
export const guestbookCountOf = (ownerId: string): number => visibleGuestbookOf(ownerId).length

/** 글 쓰기 (맨 위에) → 만든 글 */
export function addGuestbookEntry(ownerId: string, authorId: string, text: string): GuestbookEntry {
  const g: GuestbookEntry = { id: `gb${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`, authorId, text, createdAt: toIso(Date.now()) }
  guestbookOf(ownerId).unshift(g)
  return g
}

/** 글 하나 찾기 (주인 · 담긴 배열과 함께, 가려진 글도). 남의 땅굴 글 id 는 '<주인>-gb<n>' 이라 아직 안 연 방명록도 찾음 */
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

/** 글 지우기. 지웠으면 true */
export function removeGuestbookEntry(entryId: string): boolean {
  const hit = findGuestbookEntry(entryId)
  if (!hit) return false
  hit.list.splice(hit.list.indexOf(hit.entry), 1)
  return true
}

/**
 * 신고 한 번 (POST /reports GUESTBOOK 의 목). 서로 다른 3명이면 가려짐(visibleGuestbook 이 뺌).
 * 없거나 이미 가려진 글 'missing', 내가 쓴 글 'own', 같은 사람이 또 'already'
 */
export function reportGuestbookEntry(entryId: string, reporterId: string): 'ok' | 'missing' | 'own' | 'already' {
  const hit = findGuestbookEntry(entryId)
  if (!hit || isGuestbookHidden(hit.entry)) return 'missing'
  const g = hit.entry
  if (g.authorId === reporterId) return 'own'
  if ((g.reporters ?? []).includes(reporterId)) return 'already'
  g.reporters = [...(g.reporters ?? []), reporterId]
  return 'ok'
}
