/** 02 로그인 · 회원가입 — 실제/목 고르기 (VITE_API_REAL_AREAS=auth) */
import { selectArea } from '../config'
import { mock } from './mock'
import { real } from './real'

export const authApi = selectArea('auth', real, mock)
