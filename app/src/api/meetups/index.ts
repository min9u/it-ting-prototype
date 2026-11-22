/**
 * 07 모임 영역 입구. 화면은 여기서 가져온다: import { meetupsApi, useMeetupDetail, meetupKeys, MEETUP_ERRORS } from '../../api/meetups'
 * 이 폴더(api/meetups/)는 모임 작업자만 고친다. 규칙: docs/backend/api-v1-foundation.md
 */
export * from './types'
export { ENDPOINTS, type MeetupsApi } from './real'
export { meetupsApi } from './api'
export * from './mappers'
export * from './queries'
export * from './errors'
