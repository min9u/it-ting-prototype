/** 10 설정 · 계정 — 실제/목 고르기 (NEXT_PUBLIC_API_REAL_AREAS=settings) */
import { areaMode, selectArea } from '../config'
import { mock } from './mock'
import { real } from './real'

export const settingsApi = selectArea('settings', real, mock)
/** 목 서버로 도는지 (목에서만 보이는 체험용 안내 · 손잡이) */
export const SETTINGS_IS_MOCK = areaMode('settings') === 'mock'
