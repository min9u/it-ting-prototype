/** 09 알림 — 실제/목 고르기 (NEXT_PUBLIC_API_REAL_AREAS=notifications) */
import { selectArea } from '../config'
import { mock } from './mock'
import { real } from './real'

export const notificationsApi = selectArea('notifications', real, mock)
