import { describe, expect, it } from 'vitest'
import { interestFurnitureCount } from '../data/myBurrow'
import { planRoom } from '../data/roomPlan'
import { placeWords } from '../data/roomPlanV38'
import { toSubIds } from '../data/interests'

// 03 온보딩 4: "관심사 가구 N개" = 방에 실제로 놓이는 관심사 소품 수 (v3.8: 소분류마다 모델 하나)
const PICKS = ['JPOP/OST', '필름/컴팩트', '식물/테라리움', '바둑/장기/체스', '자수/뜨개/패브릭', '클라이밍', '헬스/필라테스/요가', '애니메이션', '고양이', '강아지']

describe('온보딩 3a·4 관심사 가구 (v3.8)', () => {
  it('관심사 10개를 고르면 가구 10개 (예전 SUB_PROP 이 비어 0개로 나오던 것)', () => {
    expect(interestFurnitureCount(PICKS)).toBe(10)
  })
  it('3a 목록(placeWords)과 방 계획(planRoom)이 같은 소분류를 놓음 (동물은 용품 + 동물 2개 행)', () => {
    const subs = toSubIds(PICKS)
    const placed = placeWords(subs).placed.map((p) => p.sub)
    expect(placed).toEqual(subs)
    expect(new Set(planRoom(PICKS).items.map((i) => i.sub))).toEqual(new Set(subs))
  })
  it('관심사가 없으면 0개', () => { expect(interestFurnitureCount([])).toBe(0) })
})
