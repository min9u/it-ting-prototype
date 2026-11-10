import type { GuestbookEntry } from '../data/types'

const DAY = 24 * 60 * 60 * 1000

/** "방금", "3분 전", "2시간 전", "3일 전" */
export function timeAgo(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime())
  const min = Math.floor(diff / 60000)
  if (min < 1) return '방금'
  if (min < 60) return `${min}분 전`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}시간 전`
  return `${Math.floor(h / 24)}일 전`
}

/** 방명록은 7일이 지나면 자동 삭제된다 (주석 454:7052). 최신순 정렬 */
export const GUESTBOOK_TTL_DAYS = 7
export function liveGuestbook(list: GuestbookEntry[], now = Date.now()): GuestbookEntry[] {
  return list
    .filter((g) => now - new Date(g.createdAt).getTime() < GUESTBOOK_TTL_DAYS * DAY)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function cx(...names: (string | false | null | undefined)[]) {
  return names.filter(Boolean).join(' ')
}

const WEEK = ['일', '월', '화', '수', '목', '금', '토']
/** 2026-11-08 → { m: 11, d: 8, w: '일' } */
export function dateParts(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number)
  const w = WEEK[new Date(y, m - 1, d).getDay()]
  return { y, m, d, w }
}
export function dateLabel(ymd: string) {
  const { m, d, w } = dateParts(ymd)
  return `${m}월 ${d}일 (${w})`
}
