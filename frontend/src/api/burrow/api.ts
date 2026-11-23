/** 04 내 땅굴 — 실제/목 고르기 (NEXT_PUBLIC_API_REAL_AREAS=burrow) */
import { selectArea } from '../config'
import { mock } from './mock'
import { real } from './real'

export const burrowApi = selectArea('burrow', real, mock)
