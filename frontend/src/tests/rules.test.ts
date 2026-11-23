/**
 * 입력 검증 · 화면 규칙 (순수 함수)
 * - 00 공통 9 비밀번호 규칙 (F2 회원가입 2 · F10 비밀번호 변경) — data/auth.ts 와 data/account.ts 두 곳에 있어 서로 같은지도 봄
 * - F2 이메일 형식 · 재설정 링크(30분, 한 번만, 다시 보내면 이전 링크 무효)
 * - F3 1-2 닉네임 12자 · 겹침, 3-3 질문 답변 10~50자, 추천 질문 3개
 * - 두더지 꾸미기 (3D 핸드오프 v2 accessories.md v1.2): 부위마다 하나 · 최대 4개 · 같이 못 끼는 조합 · 관심사 연결 없음 · 손 소품 숨김(인사·채팅방 4명 이상)
 * - F9 알림 4·8: 최근 30일, 안 읽은 것 먼저 → 최신순, 종류별로 끄기
 * - F8 커뮤니티 10 인기 글(최근 7일 · 좋아요+댓글+저장 · 같으면 최신) · 신고 4(서로 다른 3명이면 가려짐, 같은 사람은 한 번)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { checkPassword, confirmMismatch, consumeResetToken, emailHasBadChar, emailValid, lastResetToken, requestReset, resetTokenValid, RESET_TTL_MS } from '../data/auth'
import { passwordChecks, passwordOk } from '../data/account'
import { checkMattermostId, normalizeMattermostId, PW_MISMATCH } from '../lib/authRules'
import { ANSWER_MAX, ANSWER_MIN, QUESTIONS, answerOk, recommendedQuestions } from '../data/questions'
import { NICK_MAX, nickTaken } from '../data/myBurrow'
import { INTEREST_SUBS } from '../data/interests'
import { BLOCKED_PAIRS, MAX_WORN, MOLE_ITEMS, MOLE_PARTS, blockedBy, handVisible, itemOf, NONE_ICON, wornByPart } from '../data/moleItems'
import { handHiddenInChat } from '../three/moleDress'
import { NOTICE_TTL_DAYS, liveNotices, unreadOf, type NoticeKind, type NoticeRecord } from '../data/notifications'
import { HIDE_AT, getPost, hotPosts, reportPost, scoreOf, updatePost, usePosts, type BoardPost } from '../data/boardStore'
import { USERS } from '../data/mock'

describe('비밀번호 (00 공통 9: 8~20자, 영문·숫자·특수기호 !@#$% 각 1개 이상, 그 밖의 문자는 못 씀)', () => {
  const cases: [string, boolean][] = [
    ['digul123!', true], ['Abcdef1@', true], ['abc12!', false] /* 6자 */, ['abcdefgh', false], ['12345678!', false],
    ['abcdefghij1234567!@#', true] /* 20자 */, ['abcdefghij1234567!@#$', false] /* 21자 */,
    ['abcdefg1', false], ['abcdefg!', false], ['abcd 123!', false] /* 공백 */, ['비밀번호123!a', false], ['abcd123^', false], ['', false],
  ]
  it.each(cases)('%s → %s', (pw, ok) => {
    expect(checkPassword(pw).ok).toBe(ok)
    expect(passwordOk(pw)).toBe(ok)
  })
  it('auth.ts 와 account.ts 의 "쓸 수 없는 문자" 판단이 같음', () => {
    for (const [pw] of cases) expect(checkPassword(pw).allowed, pw).toBe(passwordChecks(pw).allowed)
  })
  it('비밀번호 확인 문구는 명세 그대로 (02 회원가입 2 · 4, 새 비밀번호 설정 2)', () => {
    expect(PW_MISMATCH).toBe('비밀번호가 달라요')
  })
  it('비밀번호 확인: 덜 친 동안은 기다리고, 갈라지거나 길이가 같은데 다르면 바로 오류', () => {
    expect(confirmMismatch('digul123!', '')).toBe(false)
    expect(confirmMismatch('digul123!', 'digul')).toBe(false)
    expect(confirmMismatch('digul123!', 'digux')).toBe(true)
    expect(confirmMismatch('digul123!', 'digul123?')).toBe(true)
    expect(confirmMismatch('digul123!', 'digul123!')).toBe(false)
    expect(confirmMismatch('digul123!', 'digul123!!')).toBe(true)
  })
})

describe('Mattermost ID (API 02 POST /ssafy-verifications: 공백 · 앞의 @ 떼고 소문자, 영문 소문자·숫자·.-_ 3~22자)', () => {
  it.each([
    ['  @Yejin.Kim ', 'yejin.kim', true], ['mole_01-a', 'mole_01-a', true], ['ab', 'ab', false], ['a'.repeat(22), 'a'.repeat(22), true],
    ['a'.repeat(23), 'a'.repeat(23), false], ['예진', '예진', false], ['mole kim', 'mole kim', false], ['@@mole', 'mole', true],
  ])('%s → %s (%s)', (raw, value, ok) => {
    const c = checkMattermostId(raw)
    expect(c.value).toBe(value)
    expect(normalizeMattermostId(raw)).toBe(value)
    expect(c.ok).toBe(ok)
  })
  it('짧은 동안은 오류를 띄우지 않고, 쓸 수 없는 문자 · 22자 넘음은 바로 오류', () => {
    expect(checkMattermostId('ab').bad).toBe(false)
    expect(checkMattermostId('mo le').bad).toBe(true)
    expect(checkMattermostId('a'.repeat(23)).bad).toBe(true)
  })
})

describe('이메일 (F2 회원가입 1 · 로그인)', () => {
  it.each([
    ['mole@ssafy.com', true], ['a.b+c@mail.co.kr', true], ['mole@ssafy', false], ['mole.ssafy.com', false], ['mole@@ssafy.com', false], ['@ssafy.com', false],
  ])('형식 %s → %s', (v, ok) => expect(emailValid(v)).toBe(ok))
  it('공백·한글·@ 두 개는 치는 즉시 오류', () => {
    expect(emailHasBadChar('mole @ssafy.com')).toBe(true)
    expect(emailHasBadChar('두더지@ssafy.com')).toBe(true)
    expect(emailHasBadChar('a@b@c.com')).toBe(true)
    expect(emailHasBadChar('mole@ssafy.com')).toBe(false)
  })
})

describe('비밀번호 재설정 링크 (F2 비밀번호 찾기: 30분 · 한 번만 · 다시 보내면 이전 링크 무효)', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 10, 16, 10, 0)) })
  afterEach(() => { vi.useRealTimers() })
  it('30분 동안만 쓸 수 있음', () => {
    const t = requestReset('a@ssafy.com')
    expect(resetTokenValid(t)).toBe(true)
    vi.setSystemTime(Date.now() + RESET_TTL_MS + 1)
    expect(resetTokenValid(t)).toBe(false)
  })
  it('다시 보내면 이전 링크는 무효', () => {
    const t1 = requestReset('b@ssafy.com')
    const t2 = requestReset('b@ssafy.com')
    expect(resetTokenValid(t1)).toBe(false)
    expect(resetTokenValid(t2)).toBe(true)
    expect(lastResetToken('b@ssafy.com')).toBe(t2)
  })
  it('한 번 쓰면 끝', () => {
    const t = requestReset('c@ssafy.com')
    consumeResetToken(t, 'newpass1!')
    expect(resetTokenValid(t)).toBe(false)
    expect(resetTokenValid(null)).toBe(false)
  })
})

describe('온보딩 입력 (F3)', () => {
  it('1-2 닉네임 최대 12자, 겹침은 대소문자·앞뒤 공백 무시, 지금 내 닉네임은 겹침 아님', () => {
    expect(NICK_MAX).toBe(12)
    const other = USERS.kim.nickname // '김OO'
    expect(nickTaken(` ${other} `)).toBe(true)
    expect(nickTaken(other.toLowerCase())).toBe(true)
    expect(nickTaken('디굴디굴')).toBe(true) // 예약어
    expect(nickTaken(other, other)).toBe(false)
    expect(nickTaken('   ')).toBe(false)
    expect(nickTaken('아무도안쓰는이름')).toBe(false)
  })
  it('3-3 답변은 앞뒤 공백 빼고 10자 이상, 50자 이하', () => {
    expect([ANSWER_MIN, ANSWER_MAX]).toEqual([10, 50])
    expect(answerOk('가'.repeat(10))).toBe(true)
    expect(answerOk(`  ${'가'.repeat(9)}  `)).toBe(false)
    expect(answerOk('가'.repeat(50))).toBe(true)
    expect(answerOk('가'.repeat(51))).toBe(false)
  })
  it('추천 질문 3개 = 서로 다른 대분류의 관심사 질문 2개 + TMI 1개', () => {
    const music = INTEREST_SUBS.find((s) => s.category === 'music_dance')!, photo = INTEREST_SUBS.find((s) => s.category === 'photo_video')!
    const q = recommendedQuestions([music.id, photo.id])
    expect(q).toHaveLength(3)
    expect(q.slice(0, 2).map((x) => x.category)).toEqual(['music_dance', 'photo_video'])
    expect(q[2].kind).toBe('tmi')
  })
  it('대분류가 하나뿐이면 그 대분류 질문 2개 + TMI, 질문 id 는 하나씩', () => {
    const music = INTEREST_SUBS.filter((s) => s.category === 'music_dance').slice(0, 3).map((s) => s.id)
    const q = recommendedQuestions(music)
    expect(q).toHaveLength(3)
    expect(new Set(q.map((x) => x.id)).size).toBe(3)
    expect(new Set(QUESTIONS.map((x) => x.id)).size).toBe(QUESTIONS.length)
  })
})

describe('두더지 꾸미기 (3D 핸드오프 v2 accessories.md v1.2)', () => {
  it('액세서리 43개(머리 19 · 얼굴 6 · 목 5 · 손 13), id 하나씩, 부위 4곳 모두 1개 이상, 최대 4개 = 부위 수', () => {
    expect(MOLE_ITEMS).toHaveLength(43)
    expect(new Set(MOLE_ITEMS.map((x) => x.id)).size).toBe(43)
    const n = (part: string) => MOLE_ITEMS.filter((x) => x.part === part).length
    expect([n('머리'), n('얼굴'), n('목'), n('손')]).toEqual([19, 6, 5, 13])
    for (const id of ['hat_mortarboard', 'prop_lightstick']) expect(itemOf(id), id).toBeTruthy()
    expect(itemOf('hat_mortarboard')!.part).toBe('머리')
    expect(itemOf('prop_lightstick')!.part).toBe('손')
    for (const p of MOLE_PARTS) expect(MOLE_ITEMS.some((x) => x.part === p.part), p.part).toBe(true)
    expect(MAX_WORN).toBe(MOLE_PARTS.length)
  })
  it('부위마다 하나: 같은 부위를 두 번 끼면 나중 것', () => {
    const heads = MOLE_ITEMS.filter((x) => x.part === '머리')
    expect(wornByPart([heads[0].id, heads[1].id]).머리).toBe(heads[1].id)
  })
  it('등 리본 + 작은 캐리어는 같이 못 낌 (양쪽 모두)', () => {
    const [[a, b]] = BLOCKED_PAIRS
    expect(itemOf(a) && itemOf(b)).toBeTruthy()
    expect(blockedBy(a, [b])).toBe(b)
    expect(blockedBy(b, [a])).toBe(a)
    expect(blockedBy(a, [])).toBeNull()
  })
  it('관심사 연결 없음 (v1.2): 아이템에 관심사 전용 표시가 없음', () => {
    for (const x of MOLE_ITEMS) expect(Object.keys(x).sort(), x.id).toEqual(['icon', 'id', 'name', 'part'])
  })
  it('채팅방 4명 이상이면 손 소품 숨김 (2·3명은 보임)', () => {
    expect([1, 2, 3, 4, 5, 6].map(handHiddenInChat)).toEqual([false, false, false, true, true, true])
  })
  it('accessories.glb 의 루트 노드 43개 이름이 아이템 id 와 같음, 노드마다 socket 이 부위와 맞음', async () => {
    const FS = 'node:fs' // 브라우저 타입에 node 가 없어서 문자열로 불러옴 (data-json.test 와 같은 방식)
    const fs = (await import(/* @vite-ignore */ FS)) as { readFileSync(p: string): Uint8Array }
    const raw = fs.readFileSync('src/assets/models/accessories.glb')
    const jsonLen = new DataView(raw.buffer, raw.byteOffset, raw.byteLength).getUint32(12, true) // glb 머리 12바이트 뒤 첫 청크(JSON) 길이
    const json = JSON.parse(new TextDecoder().decode(raw.subarray(20, 20 + jsonLen)))
    const roots: number[] = json.scenes[json.scene ?? 0].nodes
    const names = roots.map((i) => json.nodes[i].name as string)
    expect([...names].sort()).toEqual(MOLE_ITEMS.map((x) => x.id).sort())
    const sock = Object.fromEntries(MOLE_PARTS.map((p) => [p.part, p.socket]))
    for (const i of roots) {
      const n = json.nodes[i], it = itemOf(n.name)!
      expect(n.extras?.socket, n.name).toBe(sock[it.part])
      expect(n.extras?.interest, `${n.name} extras.interest 는 앱이 안 씀(있어도 무시)`).toBeUndefined()
    }
  })
  it('아이템 아이콘이 43개 모두 있음 (없음 아이콘으로 떨어지지 않음)', () => {
    for (const x of MOLE_ITEMS) expect(x.icon, x.id).not.toBe(NONE_ICON)
  })
  it('손 소품: 인사·커피 동작은 늘 숨김, 엉덩이 씰룩은 막대 사탕 + 니트 목도리일 때만 숨김', () => {
    expect(handVisible('mole_idle', ['prop_palette'])).toBe(true)
    expect(handVisible('mole_greet', ['prop_palette'])).toBe(false)
    expect(handVisible('mole_drink', ['prop_palette'])).toBe(false)
    expect(handVisible('mole_idle', [])).toBe(false)
    const candy = MOLE_ITEMS.find((x) => x.id.startsWith('prop_candy'))?.id
    if (candy) {
      expect(handVisible('mole_butt_wiggle', [candy, 'scarf_knit'])).toBe(false)
      expect(handVisible('mole_butt_wiggle', [candy])).toBe(true)
    }
  })
})

describe('알림 목록 (F9 알림 4·8, API 09 "주는 방식")', () => {
  const DAY = 86_400_000, NOW = new Date(2026, 10, 16, 12, 0).getTime()
  const on: Record<NoticeKind, boolean> = { 모임: true, 채팅: true, 게시판: true, 땅굴: true, 공지: true }
  const n = (id: string, ago: number, unread = false, type: NoticeRecord['type'] = 'MEETUP_UPDATED'): NoticeRecord =>
    ({ id, type, actorId: null, targetId: 'm1', at: NOW - ago, readAt: unread ? null : NOW - ago + 1 })
  it(`최근 ${NOTICE_TTL_DAYS}일만, 안 읽은 것 맨 위 → 최신순`, () => {
    const list = [n('old', 31 * DAY), n('b', 2 * DAY), n('a', 1 * DAY), n('u', 5 * DAY, true)]
    expect(liveNotices(list, NOW).map((x) => x.id)).toEqual(['u', 'a', 'b'])
  })
  it('알림 설정에서 끈 갈래도 목록 · 안 읽은 수에는 남고, 빨간 점에만 빠짐 (F10 알림 설정)', () => {
    const list = [n('c', DAY, true, 'CHAT_MESSAGE_RECEIVED')]
    expect(liveNotices(list, NOW).map((x) => x.id)).toEqual(['c'])
    expect(unreadOf(list, { ...on, 채팅: false }, NOW)).toEqual({ unreadCount: 1, hasUnread: false })
  })
})

describe('커뮤니티 (F8 10 인기 글 · 신고 4)', () => {
  it('인기 글: 공개 글만, 최근 7일, 점수 높은 순, 같으면 최신, 최대 5개', () => {
    const all = usePostsSnapshot()
    const hot = hotPosts(all)
    expect(hot.length).toBeLessThanOrEqual(5)
    for (const p of hot) {
      expect(p.status).toBe('public')
      expect(Date.now() - p.at).toBeLessThanOrEqual(7 * 86_400_000)
    }
    for (let i = 1; i < hot.length; i++) {
      const a = hot[i - 1], b = hot[i]
      expect(scoreOf(a) > scoreOf(b) || (scoreOf(a) === scoreOf(b) && a.at >= b.at)).toBe(true)
    }
  })
  it('인기 점수는 좋아요 수 하나: 댓글 · 저장이 많아도 점수가 안 오름 (11-20 명세)', () => {
    const p = usePostsSnapshot().find((x) => x.status === 'public')!
    const base = scoreOf(p)
    expect(base).toBe(p.likes + (p.liked ? 1 : 0))
    expect(scoreOf({ ...p, saves: p.saves + 50 })).toBe(base)
    expect(scoreOf({ ...p, commentTotal: 999, comments: [] })).toBe(base)
    expect(scoreOf({ ...p, likes: p.likes + 3 })).toBe(base + 3)
  })
  it('"수정됨"은 제목이나 본문을 고쳤을 때만 붙음 (카테고리 · 태그 · 사진 · 모임 연결만 바꾸면 안 붙음)', () => {
    const p = usePostsSnapshot().find((x) => x.status === 'public' && !x.editedAt && x.authorId === 'me')
      ?? usePostsSnapshot().find((x) => x.status === 'public' && !x.editedAt)!
    const draft = () => ({ category: p.category, title: p.title, body: p.body, interests: p.interests, photos: p.photos, meetupId: p.meetupId })
    updatePost(p.id, { ...draft(), interests: [...p.interests, '게임'] })
    expect(getPost(p.id)!.editedAt, '태그만 바꿈').toBeUndefined()
    updatePost(p.id, { ...draft(), category: p.category === '자유' ? '모임 후기' : '자유' })
    expect(getPost(p.id)!.editedAt, '카테고리만 바꿈').toBeUndefined()
    updatePost(p.id, { ...draft(), title: p.title + '!' })
    const t = getPost(p.id)!.editedAt
    expect(t, '제목을 고침').toBeGreaterThan(0)
    updatePost(p.id, { ...draft(), title: p.title + '!', interests: [] })
    expect(getPost(p.id)!.editedAt, '이미 붙은 것은 태그만 바꿔도 그대로').toBe(t)
  })
  it(`신고: 같은 사람은 한 번, 신고 수가 ${HIDE_AT}이 되면 가려짐`, () => {
    const p = usePostsSnapshot().find((x) => x.status === 'public' && !x.reportedByMe)!
    const before = p.reports
    expect(reportPost(p.id)).toBe(true)
    expect(reportPost(p.id)).toBe(false)
    const after = getPost(p.id)!
    expect(after.reports).toBe(before + 1)
    expect(after.status).toBe(before + 1 >= HIDE_AT ? 'hidden' : 'public')
  })
})
/** 글 저장소는 React 훅(usePosts)으로만 전체를 줌 → renderHook 으로 읽음 */
function usePostsSnapshot(): BoardPost[] {
  return renderHook(usePosts).result.current
}
