/** 02 로그인 · 회원가입 — 실제/목 고르기 (NEXT_PUBLIC_API_REAL_AREAS=auth) */
import { areaMode, selectArea } from '../config'
import { mock } from './mock'
import { real } from './real'

export const authApi = selectArea('auth', real, mock)
/** 목 서버로 도는지 (화면의 "체험용 · 메일 속 링크 열기"처럼 목에서만 보이는 것) */
export const AUTH_IS_MOCK = areaMode('auth') === 'mock'
