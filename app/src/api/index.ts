/**
 * API 계층 입구. 화면·훅은 여기(또는 api/queries.ts 훅)만 import 한다.
 *   import { api } from '../api'
 *   api.meetups.get(id)
 * 모드: VITE_API_MODE=mock(기본)|real (api/config.ts). 구조와 붙이는 순서는 docs/backend/frontend-data-layer.md
 */
import { auth } from './auth'
import { board } from './board'
import { burrows } from './burrows'
import { chat } from './chat'
import { meetups } from './meetups'
import { members } from './members'
import { notifications } from './notifications'
import { reports } from './reports'

export const api = { auth, members, burrows, chat, meetups, board, notifications, reports }
export type Api = typeof api

export { API_MODE, API_BASE } from './config'
export { ApiError, isApiError, isNotFound, isUnauthorized } from './client'
