/**
 * 04 내 땅굴 — 실제 서버 호출. 명세: docs/backend/team-spec/api/04-my-burrow.md
 * (남의 땅굴 방문 · 방명록 쓰기는 05 탐색 · 방문 = api/explore)
 *
 * ENDPOINTS: 명세대로 구현한 API 만. 아직 안 한 것은 ./PENDING
 * 아래 real 의 주소는 옛 초안(api-draft.md) 주소다 (화면에서 아직 안 씀. 내 땅굴 화면은 data/* 를 바로 씀)
 */
import { http } from '../client'
import type { MemberProfileDto, MoleLookDto } from '../common/legacy'
import type { ProfilePatch } from './types'

export const ENDPOINTS: readonly string[] = []

export const real = {
  /** PATCH /me/profile — 닉네임·자기소개·질문·캠퍼스-층 (409 NICKNAME_TAKEN) */
  updateProfile: (p: ProfilePatch) => http.patch<MemberProfileDto>('/me/profile', p),
  /** 두더지 꾸미기 (초안 PUT /me/mole → 명세 PATCH /me/mole) */
  updateMole: (look: MoleLookDto) => http.put<MoleLookDto>('/me/mole', look),
}
export type BurrowApi = typeof real
