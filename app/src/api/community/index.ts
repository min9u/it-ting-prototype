/**
 * 08 커뮤니티 영역 입구 (신고 · 사진 올리기 포함). 화면은 여기서: import { usePostDetail, usePostActions, communityKeys, reportBody } from '../../api/community'
 * 이 폴더(api/community/)는 커뮤니티 작업자만 고친다. 규칙: docs/backend/api-v1-foundation.md
 */
export * from './types'
export { ENDPOINTS, REPORT_REASON_CODE, reportBody, type CommunityApi } from './real'
export { communityApi } from './api'
export * from './mappers'
export * from './queries'
export * from './errors'
