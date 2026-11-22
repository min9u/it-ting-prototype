/** 06 채팅 — TanStack Query 훅과 캐시 키 (대화 목록 · 요청) */
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useMockStoreSync } from '../storeSync'
import { useChat } from '../../data/chat'
import { chatApi } from './api'
import { toChatReq, toChatRoomItem } from './mappers'
import type { ChatRoomQuery } from './real'

/** 캐시 키 (첫 칸 'chat') */
export const chatKeys = {
  all: ['chat'] as const,
  rooms: (q: ChatRoomQuery = {}) => ['chat', 'rooms', q] as const,
  requests: ['chat', 'requests'] as const,
}

export function useChatRooms(q: ChatRoomQuery = {}) {
  return useQuery({
    queryKey: chatKeys.rooms(q),
    queryFn: async ({ signal }) => (await chatApi.rooms(q, signal)).map(toChatRoomItem),
    placeholderData: keepPreviousData,
  })
}
export function useChatRequests() {
  return useQuery({ queryKey: chatKeys.requests, queryFn: async ({ signal }) => (await chatApi.requests(signal)).map(toChatReq) })
}

/** 목 모드: 채팅 저장소가 바뀌면 채팅 캐시를 새로 받음 (api/mockSync.tsx 가 부름) */
export function useChatMockSync() { useMockStoreSync('chat', useChat(), chatKeys.all) }
