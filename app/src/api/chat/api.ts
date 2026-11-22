/** 06 채팅 — 실제/목 고르기 (VITE_API_REAL_AREAS=chat) */
import { selectArea } from '../config'
import { mock } from './mock'
import { real } from './real'

export const chatApi = selectArea('chat', real, mock)
