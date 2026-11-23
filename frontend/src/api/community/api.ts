/** 08 커뮤니티 — 실제/목 고르기 (NEXT_PUBLIC_API_REAL_AREAS=community) */
import { selectArea } from '../config'
import { mock } from './mock'
import { real } from './real'

export const communityApi = selectArea('community', real, mock)
