/** 11 운영 · 관리자 (명세 보류) — 실제/목 고르기 */
import { selectArea } from '../config'
import { mock } from './mock'
import { real } from './real'

export const adminApi = selectArea('admin', real, mock)
