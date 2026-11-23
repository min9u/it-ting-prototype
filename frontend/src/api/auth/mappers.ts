/** 02 로그인 · 회원가입 DTO → 앱 모양 */
import { toAppId } from '../common/ids'
import { dotDate, parseIso } from '../../lib/time'
import type { MeDto, NextStep, SuspendedDetail } from './types'

/** 내 계정 (앱 모양). id 는 문자열 */
export interface MeVM {
  userId: string
  nextStep: NextStep
  campus: string
  gen: number
  floor: number
  campusFloorId: string
}
export const toMe = (d: MeDto): MeVM => ({
  userId: toAppId(d.userId), nextStep: d.nextStep, campus: d.campusName, gen: d.generation, floor: d.floor, campusFloorId: toAppId(d.campusFloorId),
})

/**
 * 로그인 · 가입 뒤 갈 곳 (02 "다음에 갈 화면"): ONBOARDING → 온보딩 1, 그 밖(NEW_TERM · HOME) → 내 땅굴.
 * NEW_TERM 의 새 학기 안내는 내 땅굴 위에 뜬다 (05 탐색 영역). 로그인 화면으로 보내지기 전에 가려던 주소가 있으면 그쪽 (HOME 만)
 */
export function pathAfterLogin(next: NextStep, returnTo?: string | null): string {
  if (next === 'ONBOARDING') return '/onboarding/name'
  if (next === 'HOME' && returnTo) return returnTo
  return '/burrow'
}

/** 정지 팝업 (02 로그인 4): "신고로 인해 7일 동안 로그인할 수 없어요" — 남은 기간은 프론트가 endsAt 으로 계산 */
export interface SuspensionVM { reason: string; days: number; until: string }
export function toSuspension(d: Partial<SuspendedDetail> | null | undefined, now = Date.now()): SuspensionVM {
  const end = d?.endsAt ? parseIso(d.endsAt) : NaN
  const ok = Number.isFinite(end) && end > 0
  return {
    reason: d?.reason || '운영 정책 위반',
    days: ok ? Math.max(1, Math.ceil((end - now) / 86_400_000)) : 0,
    until: ok ? dotDate(end) : '',
  }
}

/** 코드 만료 시각 → 지금부터 남은 초 (0 아래로 안 내려감) */
export const secondsLeft = (expiresAt: string, now = Date.now()) => Math.max(0, Math.ceil((parseIso(expiresAt) - now) / 1000))
