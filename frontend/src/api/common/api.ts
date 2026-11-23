/** 00 공통 — 실제/목 고르기 (VITE_API_MODE · VITE_API_REAL_AREAS=common, api/config.ts) */
import { selectArea } from '../config'
import { mock } from './mock'
import { real } from './real'

export const commonApi = selectArea('common', real, mock)
