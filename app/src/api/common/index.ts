/**
 * 공통 계층 입구: 모든 영역이 쓰는 DTO 타입 · id 바꾸기 · 에러 문구 · 사람 매퍼, 그리고 00 공통 영역(캠퍼스 · 기수) 자체.
 * 영역 코드는 '../common' 에서 가져온다 (목 서버 쪽 사람 직렬화는 '../common/mockPeople').
 */
export * from './types'
export * from './ids'
export * from './errors'
export * from './mappers'
export { ENDPOINTS, type CommonApi } from './real'
export { commonApi } from './api'
export * from './queries'
