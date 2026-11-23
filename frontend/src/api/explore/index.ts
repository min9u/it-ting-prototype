/**
 * 05 탐색 · 방문 (+ 00 학기) 영역 입구. 화면은 여기서: import { useField, useVisitBurrow, exploreKeys, EXPLORE_ERRORS } from '../../api/explore'
 * 이 폴더(api/explore/)는 탐색 · 방문 작업자만 고친다. 규칙: docs/backend/api-v1-foundation.md, 이 영역 정리: docs/backend/api-v1/05-explore-visit.md
 */
import { areaMode } from '../config'
import { resetMockDaily, startMockNewTerm } from './mock'

export * from './types'
export { ENDPOINTS, GUESTBOOK_MAX, type ExploreApi } from './real'
export { exploreApi } from './api'
export * from './mappers'
export * from './queries'
export * from './errors'

/** 시연: 새 학기 안내 (?newterm=demo). 목 모드에서만 "새 학기를 아직 고르지 않은 계정"으로 바꿈, 실제 서버면 아무것도 안 함 */
export function startNewTermDemo(): boolean {
  if (areaMode('explore') !== 'mock') return false
  startMockNewTerm()
  return true
}

/** 시연: 오늘 받은 추천 지우기 (?recommend=reset). 목 모드에서만, 추천 횟수는 그대로 */
export function resetDailyRecommendationDemo(): boolean {
  if (areaMode('explore') !== 'mock') return false
  resetMockDaily()
  return true
}
