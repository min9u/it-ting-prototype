/** 02 로그인 · 회원가입 DTO → 앱 모양 */
import { toAppId } from '../common/ids'
import type { MeDto, NextStep } from './types'

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
