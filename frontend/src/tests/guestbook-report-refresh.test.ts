/**
 * 내 땅굴에서 방명록 글을 신고하면 방명록 목록 · 내 땅굴(글 수)을 다시 받는지 (PR #37 Codex 리뷰 P1, 명세 04: 가려진 글은 목록 · 글 수에서 빠짐).
 * 목 서버: 서로 다른 3명이 신고하면 목록 · 글 수에서 빠지는 것까지
 */
import { describe, expect, it } from 'vitest'

describe('방명록 신고 뒤 다시 받기', () => {
  it('내 땅굴 · 방문자 뷰 모두 신고가 끝나면 방명록 · 땅굴 캐시를 만료시킴', async () => {
    const FS = 'node:fs'
    const fs = (await import(/* @vite-ignore */ FS)) as { readFileSync(p: string, e: string): string }
    const mine = fs.readFileSync('src/screens/burrow/MyBurrow.tsx', 'utf8')
    expect(mine).toMatch(/call: \(\) => reportGuestbookEntry\(id, reason\)[^\n]*invalidate: \[burrowKeys\.guestbook\(b\.burrowId\), burrowKeys\.mine\]/)
    const visit = fs.readFileSync('src/screens/burrow/VisitBurrow.tsx', 'utf8')
    expect(visit).toMatch(/createReport\(reportBody\('GUESTBOOK'[^\n]*invalidate: \[burrowKeys\.guestbook\(b\.burrowId\)/)
  })
})
