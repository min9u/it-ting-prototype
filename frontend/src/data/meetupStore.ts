/**
 * 모임 목 저장소 = 목 서버의 "DB" (api/meetups/mock.ts 가 이 값으로 명세 응답을 만든다).
 * 화면은 이 파일을 직접 부르지 않고 api/meetups 의 훅 · 함수만 쓴다 (2026-11-22 API v1).
 * 채팅 · 알림 목 저장소(data/chat.ts · data/notifications.ts)가 아직 여기 값을 읽는다 → 함수 이름을 바꾸지 말 것
 *
 * 규칙 (백엔드 명세 07 모임 = 기준, docs/backend/team-spec/spec/07-meetup.md)
 * - 정원에는 주최자가 포함된다 (정원 6 = 주최자 1 + 참여자 5). 확정 인원 = 1 + 참여 확정자
 * - 신청 기록 7가지: 신청 대기 / 신청 취소(다시 신청 가능) / 미승인(거절·자동) / 참여 확정 / 참여 취소 / 내보내짐 / 모임 취소로 마감
 *   → 기록이 없거나 스스로 신청을 취소한 경우만 다시 신청할 수 있다
 * - 처리 안 된 신청은 모집 마감 시각에 자동 미승인 (마감 일시가 없으면 모임이 시작될 때). 정원이 차도 기다리던 신청은 남는다
 * - 시작 시각이 지나면 바로 지난 모임 (M14). 모집 완료 = 정원이 찼거나 모집 마감 시각이 지남
 * - 참여 취소는 시작 24시간 전까지 (data/chat.ts canQuitMeetup 과 같은 규칙), 수정은 12시간 전까지, 취소는 시작 전까지 (M5)
 * - 참여 확정자(주최자 제외)가 0명이면 삭제, 1명 이상이면 취소(기록 남음)
 * - 시간 기준: 목 모드는 목 데이터의 오늘(mock TODAY) 정오 (채팅과 같음), 실제 모드(meetups 영역 real)는 페이지를 연 때의 서울 날짜 · 시각
 */
import { useSyncExternalStore } from 'react'
import { ME_ID, MEETUPS, TODAY as MOCK_TODAY } from './mock'
import { areaMode } from '../api/config'
import { meetupCategoryOf, meetupToneOf } from './meetupCategory'
import type { Meetup, Tone } from './types'
import { seoulParts, seoulYmd, wallToMs, ymdDiff, ymdMs } from '../lib/time'

/* ===== 타입 ===== */
export interface MeetupX extends Meetup {
  placeDetail?: string
  /** 끝나는 날짜(서울, 시작 날짜와 다를 때만). end 는 '다음 날 오전 8:00' · '12월 3일 오전 3:00' 처럼 표시용이라, 수정해 보낼 때 이 날짜를 씀 */
  endYmd?: string
  /** 접속 링크(선택) — 참여 확정자에게만 보임. 모임에는 플랫폼 이름을 두지 않음 (명세 07, M16 은 명세로 뒤집힘) */
  link?: string
  prep?: string
  /** 신청할 때 메시지 받기 (안 받으면 상세의 "주최자에게 남길 말"을 숨김) */
  askMsg: boolean
  /** 모집 마감 일시 'YYYY-MM-DDTHH:mm' (선택) */
  deadline?: string
  /** 찜한 사람 수 (인기순) */
  likes: number
  /** 등록 순서 (최신등록순) */
  seq: number
}

/** 내 신청 기록 (명세 meetup_application.status 를 나 기준으로). mcancel = 신청 대기 중 모임이 취소됨(MEETUP_CANCELED) */
export type MyState = 'pending' | 'withdrawn' | 'rejected' | 'joined' | 'quit' | 'kicked' | 'host' | 'mcancel'
export interface Mine { st: MyState; note?: string; at?: number; auto?: boolean }
export interface Applicant { userId: string; msg: string; at: number }

export interface Draft {
  cap: number; prep: string; askMsg: boolean
  ymd: string; start: string; end: string; deadline: string
  /** 서버에서 받은 모임이 다른 날 끝날 때의 끝나는 날짜 (MeetupX.endYmd) */
  endYmd?: string
  mode: '오프라인' | '온라인'; place: string; placeDetail: string; link: string
  title: string; intro: string; category: string
}

interface State {
  list: MeetupX[]
  my: Record<string, Mine>
  wish: string[]
  /** 빈자리 알림 받기 */
  alerts: string[]
  /** 참여 확정자 (주최자 제외, 나 포함) */
  members: Record<string, string[]>
  /** 내가 연 모임의 신청 대기 */
  applicants: Record<string, Applicant[]>
  /** 남의 신청을 주최자가 처리한 기록 ('모임id:사람id' → 거절 · 내보내기). 같은 버튼을 두 번 눌러도 성공으로 답하려고 */
  appLog: Record<string, 'REJECTED' | 'KICKED'>
}

/* ===== 시간 (Asia/Seoul 기준, lib/time.ts) ===== */
const HOUR = 3_600_000
const REAL = areaMode('meetups') === 'real'
/** 모임 화면의 "오늘" (YYYY-MM-DD, 서울). 실제 모드는 진짜 오늘 (명세 07 API: 오늘 · 이번 주 · D-day 는 프론트가 계산), 목 모드는 목 데이터의 오늘 */
export const TODAY = REAL ? seoulYmd(Date.now()) : MOCK_TODAY
/** 모임 화면의 지금. 실제 모드는 페이지를 연 시각, 목 모드는 목 데이터의 오늘 정오 (서울) */
export const NOW = REAL ? Date.now() : ymdMs(TODAY, 12)
/** '오후 2:00' → 14 (모임 시각은 만들기 양식의 값 그대로 들고 있음. 서버와는 ISO 로 주고받음 → api/mappers) */
export function parseHour(t: string) {
  const m = /(오전|오후)\s*(\d+):(\d+)/.exec(t)
  if (!m) return 0
  return (+m[2] % 12) + (m[1] === '오후' ? 12 : 0) + +m[3] / 60
}
/**
 * 끝나는 시간이 시작 시간보다 앞이거나 같은지 (양식 검사). '다음 날 오전 8:00' 처럼 다음 날 끝나는 값(서버에서 받은 모임, api/meetups/mappers toMeetup)은
 * 시작보다 뒤로 본다 — 명세 07: 종료 시각은 startsAt 보다 뒤면 됨. 만들기 화면의 선택지는 같은 날 시간만이라 새로 만들 때는 그대로
 */
/** 끝나는 시간 앞의 날짜 표시 ('다음 날 ' · '12월 3일 ') — 시작과 다른 날 끝나는 모임 */
export const END_DAY_PREFIX = /^(다음\s*날|\d+월\s*\d+일)\s*/
export function endNotAfterStart(start: string, end: string) {
  if (!start || !end || END_DAY_PREFIX.test(end)) return false
  return parseHour(end) <= parseHour(start)
}
/** 모집 마감('YYYY-MM-DDTHH:mm', 서울)이 시작 시각보다 뒤인지 (양식 검사). 같은 시각은 됨 — 명세 07: 마감은 startsAt 보다 늦을 수 없다 */
export function deadlineAfterStart(deadline: string, ymd: string, start: string) {
  if (!deadline || !ymd || !start) return false
  return wallToMs(deadline) > ymdMs(ymd) + parseHour(start) * HOUR
}
export function startMs(m: Meetup) {
  return ymdMs(m.date) + parseHour(m.start) * HOUR
}
/** 모집 마감 'YYYY-MM-DDTHH:mm'(입력 칸, 서울) 또는 ISO(오프셋) → ms */
export const isoMs = (iso: string) => wallToMs(iso)
/** '오후 2:00' → '오후 2시', '오후 12:10' → '오후 12시 10분' */
export function hourLabel(t: string) {
  return t.replace(/(\d+):00/, '$1시').replace(/(\d+):(\d\d)/, '$1시 $2분')
}
/** '2026-11-08T10:00' → '11월 8일 오전 10시' */
export function deadlineLabel(iso: string) {
  const p = seoulParts(wallToMs(iso))
  const ap = p.h < 12 ? '오전' : '오후'
  const hh = p.h % 12 === 0 ? 12 : p.h % 12
  return `${p.m}월 ${p.d}일 ${ap} ${hh}시${p.mi ? ` ${p.mi}분` : ''}`
}
export const daysLeft = (ymd: string) => ymdDiff(TODAY, ymd)
export function ddayOf(ymd: string) {
  const n = daysLeft(ymd)
  return n === 0 ? 'D-DAY' : n > 0 ? `D-${n}` : `D+${-n}`
}

/* ===== 처음 데이터 ===== */
// 기본 목 데이터(mock.ts MEETUPS)에 없는 필드: 캠퍼스·마감 일시·준비물 등
const EXTRA: Record<string, Partial<MeetupX>> = {
  m1: { prep: '읽고 있는 책 한 권', deadline: '2026-11-08T10:00', likes: 12 },
  m2: { prep: '없어요. 몸만 오세요', deadline: '2026-11-06T15:00', likes: 8 },
  m3: { prep: '연필, 스케치북', deadline: '2026-11-21T18:00', likes: 5 },
  m4: { prep: '침낭 (없으면 빌려드려요)', deadline: '2026-11-13T23:59', likes: 21 },
  m5: { link: 'https://discord.gg/lp-night', likes: 9, deadline: '2026-11-19T18:00' },
  m6: { prep: '재료비 1만 원', likes: 4 },
  m7: { prep: '러닝화', deadline: '2026-11-12T09:00', likes: 15 },
  m8: { prep: '남는 원두', likes: 7 },
  m9: { link: 'https://watcha.com/party/ghibli', likes: 11 },
  m10: { prep: '편한 운동복', likes: 18 },
}

const base: Meetup[] = [
  ...MEETUPS,
  // 이 저장소에만 있는 모임: 지난 모임 · 취소된 모임 · 찜한 모임 예시 (채팅 목 데이터에는 없음)
  { id: 'x1', title: '망원 필름 산책', category: '취미/문화', date: '2026-11-14', start: '오후 3:00', end: '오후 5:00', area: '망원', place: '망원역 2번 출구', mode: '오프라인', capacity: 5, memberIds: ['seoyeon', 'ha', 'park', 'lee'], hostId: 'seoyeon', sign: '필름 산책', intro: '필름 한 롤씩 들고 망원동 골목을 걸어요. 현상은 각자!' },
  { id: 'x2', title: '온라인 협동 게임하는 밤', category: '게임', date: '2026-11-12', start: '오후 9:00', end: '오후 11:00', area: '온라인', place: '', mode: '온라인', capacity: 4, memberIds: ['mingu', 'lee'], hostId: 'mingu', sign: '협동 게임', intro: '오버쿡드 같이 해요. 음성 채팅만 켜면 돼요.' },
  { id: 'x3', title: '한강 야간 러닝', category: '운동', date: '2026-11-07', start: '오후 8:00', end: '오후 9:00', area: '반포', place: '반포 한강공원 달빛광장', mode: '오프라인', capacity: 4, memberIds: ['ha', 'mingu', 'lee', 'park'], hostId: 'ha', sign: '한강 러닝', intro: '5km 천천히. 끝나고 편의점 라면!' },
  { id: 'x4', title: '레트로 게임 같이 해요', category: '게임', date: '2026-11-27', start: '오후 7:00', end: '오후 9:00', area: '역삼', place: '역삼 멀티캠퍼스 근처 오락실', mode: '오프라인', capacity: 6, memberIds: ['me'], hostId: 'me', sign: '오락실', intro: '동전 넣고 한 판씩. 잘 못해도 괜찮아요.' },
  { id: 'x5', title: '알고리즘 스터디 (온라인)', category: '스터디/프로젝트', date: '2026-11-25', start: '오후 8:00', end: '오후 10:00', area: '온라인', place: '', mode: '온라인', capacity: 6, memberIds: ['lee', 'park'], hostId: 'lee', sign: '알고리즘', intro: '백준 한 문제씩 풀고 풀이를 나눠요. 골드 이상은 따로 안 봐도 돼요.' },
  { id: 'p1', title: '10월 독서 모임', category: '취미/문화', date: '2026-10-25', start: '오후 2:00', end: '오후 4:00', area: '성수동', place: '성수동 어반플레이스 3층', mode: '오프라인', capacity: 6, memberIds: ['kim', 'lee', 'park'], hostId: 'kim', sign: '독서 모임', intro: '10월의 책을 이야기했어요.' },
  { id: 'p2', title: '가을 사진 산책', category: '취미/문화', date: '2026-10-18', start: '오전 10:00', end: '오후 12:00', area: '서울숲', place: '서울숲 정문', mode: '오프라인', capacity: 8, memberIds: ['ha', 'seoyeon', 'yerin'], hostId: 'ha', sign: '사진 산책', intro: '단풍 찍으러 가요.' },
  { id: 'p3', title: '수채화 첫걸음', category: '취미/문화', date: '2026-10-11', start: '오후 3:00', end: '오후 5:00', area: '역삼', place: '역삼 공방', mode: '오프라인', capacity: 5, memberIds: ['me', 'seobeok', 'park'], hostId: 'me', sign: '수채화', intro: '물감 번지는 것만 봐도 즐거워요.' },
  { id: 'p4', title: '보드게임 번개', category: '게임', date: '2026-11-10', start: '오후 7:00', end: '오후 9:00', area: '역삼', place: '역삼역 보드게임 카페', mode: '오프라인', capacity: 6, memberIds: ['mingu', 'yejin'], hostId: 'mingu', sign: '보드게임', intro: '퇴근하고 한 판!', cancelled: true },
]
const EXTRA2: Record<string, Partial<MeetupX>> = {
  x1: { likes: 14, deadline: '2026-11-13T21:00' },
  x2: { link: 'https://discord.gg/coop-night', likes: 6 },
  x3: { likes: 19 },
  x4: { likes: 2, deadline: '2026-11-26T18:00' },
  p1: { likes: 9 }, p2: { likes: 7 }, p3: { likes: 3 }, p4: { likes: 2 },
}

function init(): State {
  const list: MeetupX[] = base.map((m, i) => ({
    ...m, askMsg: true, likes: 0, seq: i + 1,
    ...EXTRA[m.id], ...EXTRA2[m.id],
    // 예전 데이터의 past 표시는 쓰지 않고 시작 시각으로 판단 (M14)
    past: undefined,
  }))
  const my: Record<string, Mine> = {}
  const members: Record<string, string[]> = {}
  for (const m of list) {
    members[m.id] = [...new Set(m.memberIds)].filter((u) => u !== m.hostId && u !== ME_ID)
    if (m.hostId === ME_ID) my[m.id] = { st: 'host' }
    else if (m.myStatus === '참여 확정') my[m.id] = { st: 'joined' }
    else if (m.myStatus === '신청 대기') my[m.id] = { st: 'pending', note: m.myNote, at: NOW - 2 * HOUR }
  }
  // 지난 모임 기록
  my.p1 = { st: 'joined' }; my.p2 = { st: 'joined' }; my.p4 = { st: 'joined' }
  for (const id of Object.keys(my)) if (my[id].st === 'joined') members[id] = [...members[id], ME_ID]
  return {
    list, my, members,
    wish: ['x1', 'x2', 'x3', ...MEETUPS.filter((m) => m.myStatus === '찜').map((m) => m.id)],
    alerts: [],
    applicants: {
      m3: [
        { userId: 'yerin', msg: '저도 요즘 소설 위주로 읽고 있어요. 같이 이야기 나눠요!', at: NOW - HOUR },
        { userId: 'yejin', msg: '처음이라 떨리지만 참여해 보고 싶어요.', at: NOW - 20 * HOUR },
        { userId: 'mingu', msg: '', at: NOW - 22 * HOUR },
      ],
      x4: [{ userId: 'seoyeon', msg: '오락실 너무 좋아요. 펌프 같이 해요!', at: NOW - 3 * HOUR }],
    },
    appLog: {},
  }
}

/* ===== 저장소 ===== */
let state: State = init()
const subs = new Set<() => void>()
function emit() { state = { ...state }; subs.forEach((f) => f()) }
function subscribe(f: () => void) { subs.add(f); return () => { subs.delete(f) } }
export function useMeetups() { return useSyncExternalStore(subscribe, () => state) }
export const getMeetupState = () => state
/** 서버 응답 하나(모임 상세)로 같은 모양을 만들어 아래 계산 함수(recruitOf·myOf…)에 넘길 때 (api/mappers) */
export type MeetupState = State

/* ===== 계산 ===== */
export const findMeetup = (id: string, s = state) => s.list.find((m) => m.id === id)
export const membersOf = (id: string, s = state) => s.members[id] ?? []
/** 확정 인원 (주최자 포함) */
export const confirmedOf = (m: MeetupX, s = state) => 1 + membersOf(m.id, s).length
export const leftOf = (m: MeetupX, s = state) => Math.max(0, m.capacity - confirmedOf(m, s))
export const isPast = (m: MeetupX) => startMs(m) <= NOW
export const deadlinePassed = (m: MeetupX) => !!m.deadline && isoMs(m.deadline) <= NOW
export type Recruit = 'open' | 'closed' | 'past' | 'cancelled'
export function recruitOf(m: MeetupX, s = state): Recruit {
  if (m.cancelled) return 'cancelled'
  if (isPast(m)) return 'past'
  if (leftOf(m, s) <= 0 || deadlinePassed(m)) return 'closed'
  return 'open'
}
/** 내 신청 기록. 신청 대기인데 모집 마감 시각(없으면 시작 시각)이 지났으면 자동 미승인 (명세 07 "모집 마감이 지난 신청") */
export function myOf(id: string, s = state): Mine | undefined {
  const r = s.my[id]
  if (r?.st !== 'pending') return r
  const m = findMeetup(id, s)
  if (!m) return r
  return recruitClosedByTime(m) ? { ...r, st: 'rejected', auto: true } : r
}
/** 모집 마감 시각(없으면 시작 시각)이 지났는지 — 처리 안 된 신청이 자동 미승인되는 때 */
export const recruitClosedByTime = (m: MeetupX) => (m.deadline ? deadlinePassed(m) : isPast(m))
export const canReapply = (r?: Mine) => !r || r.st === 'withdrawn'
/** 참여 취소(모임 나가기) — data/chat.ts canQuitMeetup 과 같은 규칙: 주최자 아님 · 시작 24시간 전까지 */
export function canQuit(m: MeetupX) { return m.hostId !== ME_ID && startMs(m) - NOW >= 24 * HOUR }
/** 수정은 시작 12시간 전까지 */
export const canEdit = (m: MeetupX) => startMs(m) - NOW >= 12 * HOUR
/** 취소·삭제는 시작 전까지 */
export const canCancel = (m: MeetupX) => !isPast(m) && !m.cancelled

/** 모임 카테고리 이름과 색 (관심사와 관계없음 — 명세 07) */
export const catNameOf = (category: string) => meetupCategoryOf(category)?.name ?? category
export const toneOfMeetup = (m: Meetup): Tone => meetupToneOf(m.category)
/** 카드 · 일정의 장소 줄: 온라인은 "온라인", 오프라인은 "지역 · 오프라인". 캠퍼스는 붙이지 않음(모임에 캠퍼스 없음, 팀 명세 07) */
export const placeLine = (m: MeetupX) => (m.mode === '온라인' ? '온라인' : `${m.area} · 오프라인`)

/** 내 모임 분류 */
export function mineGroups(s = state) {
  const live = s.list
  const r = (m: MeetupX) => myOf(m.id, s)
  const byDate = (a: MeetupX, b: MeetupX) => startMs(a) - startMs(b)
  const upcoming = live.filter((m) => !isPast(m) && !m.cancelled && (r(m)?.st === 'joined' || r(m)?.st === 'host')).sort(byDate)
  const pending = live.filter((m) => !isPast(m) && !m.cancelled && (r(m)?.st === 'pending' || (r(m)?.st === 'rejected'))).sort(byDate)
  const hosting = live.filter((m) => !isPast(m) && !m.cancelled && r(m)?.st === 'host').sort(byDate)
  const wished = live.filter((m) => s.wish.includes(m.id) && !isPast(m) && !m.cancelled)
    .sort((a, b) => Number(recruitOf(a, s) === 'closed') - Number(recruitOf(b, s) === 'closed') || byDate(a, b))
  const past = live.filter((m) => (isPast(m) || m.cancelled) && (r(m)?.st === 'joined' || r(m)?.st === 'host')).sort((a, b) => byDate(b, a))
  /** 리스트의 내 모임 위젯·다가오는 일정: 참여 확정 · 신청 대기 · 내가 주최 */
  const active = live.filter((m) => !isPast(m) && !m.cancelled && ['joined', 'host', 'pending'].includes(r(m)?.st ?? '')).sort(byDate)
  return { upcoming, pending, hosting, wished, past, active }
}

/* ===== 동작 ===== */
function setMy(id: string, v: Mine | undefined) {
  const my = { ...state.my }
  if (v) my[id] = v
  else delete my[id]
  state.my = my
}
function setMembers(id: string, l: string[]) { state.members = { ...state.members, [id]: l } }

/** 참여 신청 → 신청 대기 */
export function apply(id: string, note: string) {
  if (!canReapply(myOf(id))) return
  setMy(id, { st: 'pending', note: note.trim() || undefined, at: Date.now() })
  emit()
}
/** 신청 취소 → 미신청 (다시 신청 가능) */
export function withdraw(id: string) { setMy(id, { st: 'withdrawn' }); emit() }
/** 참여 취소 (확정 후) → 다시 신청 불가 */
export function quit(id: string) {
  setMy(id, { st: 'quit' })
  setMembers(id, membersOf(id).filter((u) => u !== ME_ID))
  emit()
}
/** 찜 켜기 · 끄기 (같은 값이면 그대로). 찜을 풀면 빈자리 알림도 함께 꺼짐 (명세: meetup_like 줄을 지움) */
export function setWish(id: string, on: boolean) {
  if (state.wish.includes(id) === on) return
  state.wish = on ? [...state.wish, id] : state.wish.filter((x) => x !== id)
  if (!on) state.alerts = state.alerts.filter((x) => x !== id)
  state.list = state.list.map((m) => (m.id === id ? { ...m, likes: Math.max(0, m.likes + (on ? 1 : -1)) } : m))
  emit()
}
export const toggleWish = (id: string) => setWish(id, !state.wish.includes(id))
/** 빈자리 알림 켜기 · 끄기 (찜한 모임에만 켤 수 있음 — 확인은 목 서버) */
export function setAlert(id: string, on: boolean) {
  if (state.alerts.includes(id) === on) return
  state.alerts = on ? [...state.alerts, id] : state.alerts.filter((x) => x !== id)
  emit()
}

/* 신청 관리 (주최자) */
export const applicantsOf = (id: string, s = state) => s.applicants[id] ?? []
export function accept(id: string, userId: string) {
  const m = findMeetup(id)
  if (!m || leftOf(m) <= 0) return
  state.applicants = { ...state.applicants, [id]: applicantsOf(id).filter((a) => a.userId !== userId) }
  setMembers(id, [...membersOf(id), userId])
  emit()
}
export function reject(id: string, userId: string) {
  state.applicants = { ...state.applicants, [id]: applicantsOf(id).filter((a) => a.userId !== userId) }
  state.appLog = { ...state.appLog, [`${id}:${userId}`]: 'REJECTED' }
  emit()
}
export function kick(id: string, userId: string) {
  setMembers(id, membersOf(id).filter((u) => u !== userId))
  state.appLog = { ...state.appLog, [`${id}:${userId}`]: 'KICKED' }
  emit()
}

/* 만들기 · 수정 · 취소 · 삭제 */
let seq = 100
export function createMeetup(d: Draft): string {
  const id = `n${++seq}`
  const m: MeetupX = {
    id, title: d.title.trim(), category: d.category, intro: d.intro.trim(),
    date: d.ymd, start: d.start, end: d.end, mode: d.mode,
    area: d.mode === '온라인' ? '온라인' : (d.place.trim().split(/\s+/).slice(0, 2).join(' ')),
    place: d.mode === '온라인' ? '' : d.place.trim(),
    placeDetail: d.mode === '오프라인' ? d.placeDetail.trim() || undefined : undefined,
    link: d.mode === '온라인' ? d.link.trim() || undefined : undefined,
    capacity: d.cap, memberIds: [ME_ID], hostId: ME_ID, sign: d.title.trim().slice(0, 8),
    prep: d.prep.trim() || undefined, askMsg: d.askMsg, deadline: d.deadline || undefined, likes: 0,
    seq: Math.max(...state.list.map((x) => x.seq)) + 1,
  }
  state.list = [...state.list, m]
  setMy(id, { st: 'host' })
  setMembers(id, [])
  emit()
  return id
}
export function updateMeetup(id: string, d: Draft) {
  state.list = state.list.map((m) => (m.id !== id ? m : {
    ...m, title: d.title.trim(), category: d.category, intro: d.intro.trim(),
    date: d.ymd, start: d.start, end: d.end, mode: d.mode,
    area: d.mode === '온라인' ? '온라인' : m.mode === '오프라인' && m.place === d.place.trim() ? m.area : (d.place.trim().split(/\s+/).slice(0, 2).join(' ')),
    place: d.mode === '온라인' ? '' : d.place.trim(),
    placeDetail: d.mode === '오프라인' ? d.placeDetail.trim() || undefined : undefined,
    link: d.mode === '온라인' ? d.link.trim() || undefined : undefined,
    capacity: d.cap, prep: d.prep.trim() || undefined, askMsg: d.askMsg,
  }))
  emit()
}
/** 취소: 기록은 남고(취소됨), 신청 대기는 "모임 취소로 마감"으로. 참여 확정은 그대로 (명세 POST …/cancel) */
export function cancelMeetup(id: string) {
  state.list = state.list.map((m) => (m.id === id ? { ...m, cancelled: true } : m))
  state.applicants = { ...state.applicants, [id]: [] }
  if (state.my[id]?.st === 'pending') setMy(id, { ...state.my[id], st: 'mcancel' })
  emit()
}
/** 삭제: 어느 목록에도 남지 않음 (명세 DELETE /meetups/{meetupId}) */
export function deleteMeetup(id: string) {
  state.list = state.list.filter((m) => m.id !== id)
  setMy(id, undefined)
  state.wish = state.wish.filter((x) => x !== id)
  state.alerts = state.alerts.filter((x) => x !== id)
  emit()
}

/** 모임 → 만들기·수정 양식 값 */
export function draftOf(m: MeetupX): Draft {
  return {
    cap: m.capacity, prep: m.prep ?? '', askMsg: m.askMsg, ymd: m.date, start: m.start, end: m.end, endYmd: m.endYmd, deadline: m.deadline ?? '',
    mode: m.mode, place: m.mode === '오프라인' ? m.place : '', placeDetail: m.placeDetail ?? '',
    link: m.link ?? '',
    title: m.title, intro: m.intro, category: m.category,
  }
}

/* ===== 다른 사람이 하는 일 (목 서버의 "다른 계정" 흉내. api/meetups/mock.ts mockMeetupActors 가 부름) ===== */
/** 다른 사람이 모임에 참여 신청 (주최자가 신청 관리에서 봄). 이미 신청했으면 그대로 */
export function receiveApplication(id: string, userId: string, msg = '') {
  if (applicantsOf(id).some((a) => a.userId === userId) || membersOf(id).includes(userId)) return false
  state.applicants = { ...state.applicants, [id]: [{ userId, msg, at: Date.now() }, ...applicantsOf(id)] }
  emit()
  return true
}
/** 주최자가 내 신청을 수락 · 거절. 신청 대기가 아니거나(수락은) 자리가 없으면 false */
export function hostDecidesMine(id: string, accept: boolean) {
  const m = findMeetup(id)
  if (!m || myOf(id)?.st !== 'pending') return false
  if (accept) {
    if (leftOf(m) <= 0) return false
    setMy(id, { st: 'joined' })
    setMembers(id, [...membersOf(id), ME_ID])
  } else {
    setMy(id, { ...state.my[id], st: 'rejected' })
  }
  emit()
  return true
}
