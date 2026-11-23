import type { GuestbookEntry } from '../data/types'
import { agoShort, parseIso, weekdayOf, ymdLabel } from './time'

/** "방금", "3분 전", "2시간 전", "3일 전" (날짜 계산·문구는 lib/time.ts 한 곳) */
export function timeAgo(iso: string, now = Date.now()): string {
  return agoShort(parseIso(iso), now)
}

/**
 * 방명록 글은 시간이 지나도 자동으로 지워지지 않는다 (04 내 땅굴 방명록 전체 보기 2, 2026-11-21 명세. 예전의 "7일 지나면 자동 삭제"는 없어짐).
 * 없어지는 때: 주인·작성자가 지울 때, 탈퇴, 관리자가 지울 때. 서로 다른 3명이 신고하면 가려져 목록과 글 수에서 빠짐 (관리자가 복구하면 다시 보임).
 * 최신순 정렬. 서버도 같은 조건으로 거른다 (api/burrows)
 */
export const GUESTBOOK_HIDE_REPORTS = 3
export const isGuestbookHidden = (g: GuestbookEntry) => new Set(g.reporters ?? []).size >= GUESTBOOK_HIDE_REPORTS
export function visibleGuestbook(list: GuestbookEntry[]): GuestbookEntry[] {
  // 문자열 비교(localeCompare)는 Z 와 +09:00 이 섞이면 순서가 틀려서 ms 로 비교 (위험 B2)
  return list
    .filter((g) => !isGuestbookHidden(g))
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
