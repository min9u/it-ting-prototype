/** 05 탐색 · 방문 — 실제/목 고르기 (NEXT_PUBLIC_API_REAL_AREAS=explore) */
import { selectArea } from '../config'
import { mock } from './mock'
import { real } from './real'

export const exploreApi = selectArea('explore', real, mock)
