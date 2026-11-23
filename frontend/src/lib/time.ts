/**
 * 날짜·시각 한 곳 (위험 B2, docs/backend/frontend-data-layer.md "날짜", 백엔드 명세 v1 "JSON 필드").
 *
 * 앱 안의 날짜 값은 세 가지만 쓴다. "2시간 전" 같은 표시 문자열은 데이터에 넣지 않고, 화면에서 아래 함수로만 만든다.
 *  1) 순간(instant): 서버와 주고받을 때는 **UTC ISO 8601 "2026-11-18T08:01:05Z"** (명세 v1, 필드 이름 …At), 앱 안 계산은 ms 숫자
 *     받을 때는 오프셋이 붙은 값("+09:00")도 읽는다 (옛 목 데이터 · 다른 서버)
 *  2) 달력 날짜: "YYYY-MM-DD" (Asia/Seoul 기준의 하루). 명세의 "날짜만 있는 값"과 같은 모양
 *  3) 입력 칸 값(벽시계): "YYYY-MM-DDTHH:mm" (<input type="datetime-local"> 값). Asia/Seoul 로 해석한다
 *
 * 서버는 UTC 로 주고, 화면은 늘 서울 시각으로 보여 준다. 브라우저 시간대와 관계없이 Asia/Seoul 로 계산한다
 * (한국은 서머타임이 없어 +09:00 고정). 그래서 Intl 없이 UTC 계산 + 9시간으로 충분하고, 결과가 실행 환경(헤드리스·해외 PC)에 따라 바뀌지 않는다.
 */
import { ENV } from './env'

export const TZ = 'Asia/Seoul'
const KST = 9 * 3_600_000
const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR
export const WEEK_KO = ['일', '월', '화', '수', '목', '금', '토'] as const

export type IsoDateTime = string
export type Ymd = string

const pad = (n: number, w = 2) => String(n).padStart(w, '0')

/* ===== 변환 ===== */
/** ms → UTC "2026-11-16T08:40:05Z" (명세 v1 시각. 서버로 보낼 때·목 서버가 응답할 때). 초 아래는 버림 */
export function toIso(ms: number): IsoDateTime {
  const t = new Date(Math.floor(ms / 1000) * 1000)
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}T${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}:${pad(t.getUTCSeconds())}Z`
}
/** toIso 와 같음 (이름으로 UTC 임을 드러낼 때) */
export const toUtcIso = toIso
/** 명세 v1 의 시각 모양인지 ("…Z", 초까지) */
export const isUtcInstant = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(s)
/** 명세 v1 의 날짜 모양인지 ("YYYY-MM-DD") */
export const isDateString = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)

const HAS_OFFSET = /(Z|[+-]\d{2}:?\d{2})$/i
let warned = false
/**
 * ISO 8601 → ms. 오프셋(Z, +09:00)이 있어야 한다 (규약: 서버는 Z). 없으면 Asia/Seoul 벽시계로 보고 개발 중 한 번 경고.
 * 날짜만("2026-11-16")이면 그날 서울 0시 (달력 값 그대로 쓰려면 parseIso 말고 문자열 그대로 둘 것). 못 읽으면 NaN.
 */
export function parseIso(iso: string | null | undefined): number {
  if (!iso) return NaN
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return ymdMs(iso)
  if (HAS_OFFSET.test(iso)) return Date.parse(iso)
  if (ENV.dev && !warned) { warned = true; console.warn(`[time] 오프셋 없는 날짜·시각을 받았어요: ${iso} → Asia/Seoul 로 읽음 (규약: ISO 8601 + 오프셋)`) }
  return wallToMs(iso)
}

/** ms → 서울 기준 달력 값 */
export function seoulParts(ms: number) {
  const t = new Date(ms + KST)
  const w = t.getUTCDay()
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), h: t.getUTCHours(), mi: t.getUTCMinutes(), s: t.getUTCSeconds(), w, wk: WEEK_KO[w] }
}
/** 서울 벽시계 → ms */
export const seoulMs = (y: number, m: number, d: number, h = 0, mi = 0) => Date.UTC(y, m - 1, d, h, mi) - KST
/** "2026-11-16" (+ 시·분) → ms (서울) */
export function ymdMs(ymd: Ymd, h = 0, mi = 0) {
  const [y, m, d] = ymd.split('-').map(Number)
  return seoulMs(y, m, d, h, mi)
}
/** ms → "2026-11-16" (서울) */
export function seoulYmd(ms: number): Ymd {
  const p = seoulParts(ms)
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`
}
/** "2026-11-16T14:30" (입력 칸, 서울) → ms. 오프셋이 붙어 있으면 그대로 읽음 */
export function wallToMs(wall: string) {
  if (HAS_OFFSET.test(wall)) return Date.parse(wall)
  const [d, t = '00:00'] = wall.split('T')
  const [h, mi] = t.split(':').map(Number)
  return ymdMs(d, h || 0, mi || 0)
}
/** ms → "2026-11-16T14:30" (입력 칸 값) */
export function msToWall(ms: number) {
  const p = seoulParts(ms)
  return `${p.y}-${pad(p.m)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}`
}
/** "2026-11-16" → '월' (달력 날짜라 시간대와 무관) */
export const weekdayOf = (ymd: Ymd) => { const [y, m, d] = ymd.split('-').map(Number); return WEEK_KO[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] }
/** 두 달력 날짜 사이 날 수 (b - a) */
export function ymdDiff(a: Ymd, b: Ymd) {
  const u = (s: Ymd) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d) }
  return Math.round((u(b) - u(a)) / DAY)
}
/** 서울 달력으로 몇 날 전인지 (오늘 0, 어제 1) */
export const daysAgo = (ms: number, now = Date.now()) => ymdDiff(seoulYmd(ms), seoulYmd(now))

/* ===== 표시 (화면 문구는 여기서만 만든다) ===== */
/** "오후 2:05" */
export function clock(ms: number) {
  const { h, mi } = seoulParts(ms)
  return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${pad(mi)}`
}
/** "11월 3일" (올해가 아니면 "2025년 11월 3일") */
export function monthDay(ms: number, now = Date.now()) {
  const p = seoulParts(ms)
  return p.y === seoulParts(now).y ? `${p.m}월 ${p.d}일` : `${p.y}년 ${p.m}월 ${p.d}일`
}
/** "11월 8일 (일)" — 달력 날짜 */
export function ymdLabel(ymd: Ymd) {
  const [, m, d] = ymd.split('-').map(Number)
  return `${m}월 ${d}일 (${weekdayOf(ymd)})`
}
/** 방명록: "방금", "3분 전", "2시간 전", "3일 전" */
export function agoShort(ms: number, now = Date.now()) {
  const diff = Math.max(0, now - ms)
  if (diff < MIN) return '방금'
  if (diff < HOUR) return `${Math.floor(diff / MIN)}분 전`
  if (diff < DAY) return `${Math.floor(diff / HOUR)}시간 전`
  return `${Math.floor(diff / DAY)}일 전`
}
/** 00 공통 8 알림: 방금 전 · N분 전 · N시간 전 · 어제 · N일 전, 일주일이 넘으면 날짜 */
export function agoNotice(ms: number, now = Date.now()) {
  const diff = now - ms
  if (diff < MIN) return '방금 전'
  if (diff < HOUR) return `${Math.floor(diff / MIN)}분 전`
  if (diff < DAY) return `${Math.floor(diff / HOUR)}시간 전`
  if (diff < 2 * DAY) return '어제'
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}일 전`
  const p = seoulParts(ms)
  return `${p.m}월 ${p.d}일`
}
/** 커뮤니티(F0 공통 8): 1시간 안 "방금" · 오늘 "N시간 전" · 어제 · N일 전 · 날짜 (서울 달력 기준) */
export function agoBoard(ms: number, now = Date.now()) {
  if (now - ms < HOUR) return '방금'
  const days = daysAgo(ms, now)
  if (days <= 0) return `${Math.floor((now - ms) / HOUR)}시간 전`
  if (days === 1) return '어제'
  if (days < 7) return `${days}일 전`
  return monthDay(ms, now)
}
/** 채팅 요청 카드: 방금 · N분 전 · N시간 전 · 어제 · N일 전 */
export function agoChat(ms: number, now = Date.now()) {
  const diff = now - ms
  if (diff < MIN) return '방금'
  if (diff < HOUR) return `${Math.floor(diff / MIN)}분 전`
  if (diff < DAY) return `${Math.floor(diff / HOUR)}시간 전`
  if (diff < 2 * DAY) return '어제'
  return `${Math.floor(diff / DAY)}일 전`
}
/** 채팅 목록: 방금 · 오늘은 시각 · 어제 · N일 전 · 날짜 */
export function chatListTime(ms: number, now = Date.now()) {
  if (now - ms < MIN) return '방금'
  const days = daysAgo(ms, now)
  if (days <= 0) return clock(ms)
  if (days === 1) return '어제'
  if (days < 7) return `${days}일 전`
  const p = seoulParts(ms)
  return `${p.m}월 ${p.d}일`
}
/** 날짜 구분선: 오늘 · 어제 · 11월 3일 (화) */
export function dayDivider(ms: number, now = Date.now()) {
  const days = daysAgo(ms, now)
  if (days === 0) return '오늘'
  if (days === 1) return '어제'
  const p = seoulParts(ms)
  return `${p.m}월 ${p.d}일 (${p.wk})`
}
/** "2026.11.16" (설정·관리자 표 날짜) */
export function dotDate(ms: number) {
  const p = seoulParts(ms)
  return `${p.y}.${pad(p.m)}.${pad(p.d)}`
}
