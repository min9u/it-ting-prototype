/** 10 설정 · 계정 — 실제/목 고르기 (VITE_API_REAL_AREAS=settings) */
import { selectArea } from '../config'
import { mock } from './mock'
import { real } from './real'

export const settingsApi = selectArea('settings', real, mock)
