import { describe, expect, it } from 'vitest'
import { LABELS, roomItemNames } from '../screens/start/Landing'
import { planRoom } from '../data/roomPlan'
import { toSubIds } from '../data/interests'

// 랜딩 03 가구 이름표 = 랜딩 방에 실제로 놓이는 v3.8 소품 (예전 배낭·오락기·책장·스피커·카메라·이젤은 옛 방)
describe('랜딩 가구 이름표', () => {
  it('이름표 6개가 v3.8 소품 이름', () => {
    const n = roomItemNames()
    expect(LABELS.map((l) => n[l.tag])).toEqual(['게임기', '소설책', '물감 상자', '카세트 워크맨', '필름 카메라', '캠핑 의자'])
  })
  it('이름표마다 방에 놓인 소품이 있고, 같은 이름표가 둘이 아님', () => {
    const plan = planRoom(LABELS.map((l) => l.tag))
    for (const l of LABELS) expect(plan.items.some((i) => i.sub === toSubIds([l.tag])[0]), l.tag).toBe(true)
    expect(new Set(LABELS.map((l) => l.tag)).size).toBe(LABELS.length)
  })
})
