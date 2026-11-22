/**
 * 04 내 땅굴 DTO. 명세: docs/backend/team-spec/api/04-my-burrow.md
 * 온보딩 · 내 땅굴 작업자가 명세 모양(숫자 id = Id, 시각 = UtcInstant, 사람 = UserDisplayDto …)으로 채운다. 공통 타입은 '../common'
 * 아래는 옛 초안(api-draft.md)의 요청 모양
 */
import type { LegacyId } from '../common/legacy'

/** 초안의 PATCH /me/profile 본문 */
export interface ProfilePatch {
  nickname?: string
  intro?: string | null
  /** 질문 3개와 답 (slot 1~3) */
  answers?: { slot: number; questionId: LegacyId; answer: string }[]
  campusFloorId?: LegacyId
}
