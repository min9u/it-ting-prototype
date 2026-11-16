import type { GuestbookEntry } from '../data/types'
import { agoShort, parseIso, weekdayOf, ymdLabel } from './time'

const DAY = 24 * 60 * 60 * 1000

/** "방금", "3분 전", "2시간 전", "3일 전" (날짜 계산·문구는 lib/time.ts 한 곳) */
export function timeAgo(iso: string, now = Date.now()): string {
  return agoShort(parseIso(iso), now)
}

/** 방명록은 7일이 지나면 자동 삭제된다 (주석 454:7052). 최신순 정렬. 서버도 같은 조건으로 거른다 (api/burrows) */
export const GUESTBOOK_TTL_DAYS = 7
export function liveGuestbook(list: GuestbookEntry[], now = Date.now()): GuestbookEntry[] {
  // 문자열 비교(localeCompare)는 Z 와 +09:00 이 섞이면 순서가 틀려서 ms 로 비교 (위험 B2)
  return list
    .filter((g) => now - parseIso(g.createdAt) < GUESTBOOK_TTL_DAYS * DAY)
    .sort((a, b) => parseIso(b.createdAt) - parseIso(a.createdAt))
}

export function cx(...names: (string | false | null | undefined)[]) {
  return names.filter(Boolean).join(' ')
}

/** 2026-11-08 → { m: 11, d: 8, w: '일' } (달력 날짜라 시간대와 무관) */
export function dateParts(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number)
  return { y, m, d, w: weekdayOf(ymd) }
}
/** "11월 8일 (일)" */
export const dateLabel = (ymd: string) => ymdLabel(ymd)
