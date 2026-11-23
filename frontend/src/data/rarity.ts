/**
 * 드문 관심사 기준 (한 곳). docs/interest-effects.md "2차 다듬기 · 드문 기준 맞추기"
 *
 * 인원수 = data/mock.ts TAG_COUNTS (전국 규모 목 숫자 30~3,400명). 서버가 생기면 실제 인원으로 이 숫자만 다시 정함.
 * 예전에는 화면마다 달랐음: 관심사 이펙트 100/250/700명, 탐색 시안 B~D(match.ts) 400명, 온보딩 "통하는 취향" SSAFY 규모 5명 이하(= 550명 미만)
 * → 이펙트·탐색 시안·미니맵은 아래 세 단계를 같이 씀. 온보딩만 02 F3 명세 문구("5명 이하")가 따로 있어서 그 값을 여기 같이 두고 이유를 적음.
 *
 * - LEGEND (100명 미만, 2026-11-18 확정본 90개 중 4개 · 예전 65개 중 9개): "아주 드문 취미" · 무지개
 * - RARE (250명 미만, 90개 중 14개 · 예전 65개 중 18개): "드문 취미" · 금색 ✦. 탐색 시안 B~D 의 "✦ 드문 취미" 칩도 이 값
 *   (예전 65개 기준: 400명이면 25개, 온보딩 기준 550명이면 31개로 절반 가까이가 "드문"이 됨. 확정본 목 숫자는 docs/interest-tags-2026-11-18.md)
 * - UNCOMMON (700명 미만): 땅굴 안 "이 방에서 가장 드문 취미" 를 띄울지만 정함 (드물다고 말하지 않음, 방 안에서 상대적으로)
 * - ONBOARDING_MAX_PEOPLE (SSAFY 규모 5명 이하 = 전국 목 숫자 550명 미만): 온보딩 분야 팝업 "아는 사람끼리 통하는 취향" (02 F3 3번 제안 문구)
 *   명세가 "몇 명 이하"로 말해서 사람 수(1/100)로 셈. 이펙트의 RARE 와 맞추면 명세 문구와 달라지므로 따로 둠
 */
export const RARITY = { legend: 100, rare: 250, uncommon: 700 } as const

export type Rarity = 'legend' | 'rare' | 'uncommon'

/** 인원수 → 드문 정도 */
export function rarityOf(count: number | null | undefined): Rarity | null {
  if (count == null) return null
  return count < RARITY.legend ? 'legend' : count < RARITY.rare ? 'rare' : count < RARITY.uncommon ? 'uncommon' : null
}

/** "드문 취미"(✦)라고 말해도 되는지: 아주 드묾 · 드묾 */
export const isRareCount = (count: number | null | undefined) => count != null && count < RARITY.rare

/** 온보딩 "통하는 취향": 전국 목 숫자 → SSAFY 규모(1/100, 최소 1명) */
export const ONBOARDING_MAX_PEOPLE = 5
export const ssafyCount = (count: number) => Math.max(1, Math.round(count / 100))
export const isOnboardingRare = (count: number) => ssafyCount(count) <= ONBOARDING_MAX_PEOPLE
