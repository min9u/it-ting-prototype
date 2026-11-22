/**
 * 03 온보딩 (+ 00 관심사 · 질문 · 프로필 팝업) 영역 입구. import { useInterestCatalog, onboardingKeys } from '../../api/onboarding'
 * 이 폴더(api/onboarding/)는 온보딩 · 내 땅굴 작업자만 고친다. 규칙: docs/backend/api-v1-foundation.md
 * 관심사 id ↔ 앱 코드 잇기: ./interestMap.ts · 두더지 코드(대문자) ↔ 앱 아이템 id: ../common/moleCodes.ts
 */
export * from './types'
export { ENDPOINTS, type OnboardingApi } from './real'
export { onboardingApi } from './api'
export * from './mappers'
export * from './queries'
export * from './errors'
