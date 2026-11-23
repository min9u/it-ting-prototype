/** 07 모임 — 실제/목 고르기 (NEXT_PUBLIC_API_REAL_AREAS=meetups) */
import { selectArea } from '../config'
import { mock } from './mock'
import { real } from './real'

export const meetupsApi = selectArea('meetups', real, mock)
