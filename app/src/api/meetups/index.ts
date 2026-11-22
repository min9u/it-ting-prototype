/**
 * 07 모임 영역 입구. 화면은 여기서 가져온다: import { useMeetupDetail, meetupCalls, meetupKeys, MEETUP_ERRORS } from '../../api/meetups'
 * 쓰기는 meetupCalls(앱 문자열 id 를 받아 DTO 숫자 id 로 부름). 채팅의 "모임 나가기"는 meetupCalls.cancelParticipation. 결과 정리: docs/backend/api-v1/07-meetup.md
 * 이 폴더(api/meetups/)는 모임 작업자만 고친다. 규칙: docs/backend/api-v1-foundation.md
 */
export * from './types'
export { ENDPOINTS, type MeetupsApi } from './real'
export { meetupsApi } from './api'
export * from './mappers'
export * from './queries'
export * from './errors'
