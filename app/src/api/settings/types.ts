/**
 * 10 설정 · 계정 DTO. 명세: docs/backend/team-spec/api/10-settings.md
 *
 * 아래는 옛 초안(docs/backend/api-draft.md, 2026-11-16)의 모양을 그대로 옮긴 것이다 (공통 계층 작업 때 동작을 바꾸지 않으려고).
 * 인증 · 설정 작업자가 명세 모양(숫자 id = Id, 시각 = UtcInstant, 사람 = UserDisplayDto …)으로 바꾼다. 공통 타입은 '../common'
 */
import type { LegacyId } from '../common/legacy'

/** 초안의 시각 (ISO 8601). 명세는 UtcInstant */
type IsoDateTime = string

/** notice.category */
export type NoticeCategory = 'NOTICE' | 'UPDATE' | 'EVENT'

export interface NotificationSettingDto {
  meetupOn: boolean
  chatOn: boolean
  communityOn: boolean
  burrowOn: boolean
  noticeOn: boolean
  browserPushOn: boolean
}
export interface NoticeDto { id: LegacyId; category: NoticeCategory; title: string; content: string; createdAt: IsoDateTime }
