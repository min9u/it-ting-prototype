/**
 * 07 모임 — TanStack Query 훅과 캐시 키. 응답은 mappers 로 앱 모양으로 바꿔 돌려줌.
 * 화면은 { isPending, isError, error, data } 로 로딩 · 오류 · 진짜 없음(404)을 나눠 그림 (components/AsyncState.tsx)
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useMockStoreSync } from '../storeSync'
import { useMeetups } from '../../data/meetupStore'
import { meetupsApi } from './api'
import { toMeetupCard, toMeetupDetail } from './mappers'
import type { MeetupListQuery } from './types'

/** 캐시 키 (첫 칸 'meetups' — 앞부분이 같으면 한꺼번에 invalidate) */
export const meetupKeys = {
  all: ['meetups'] as const,
  list: (q: MeetupListQuery) => ['meetups', 'list', q] as const,
  detail: (id: string) => ['meetups', 'detail', id] as const,
}

export function useMeetupList(q: MeetupListQuery) {
  return useQuery({
    queryKey: meetupKeys.list(q),
    queryFn: async ({ signal }) => { const p = await meetupsApi.list(q, signal); return { ...p, items: p.items.map(toMeetupCard) } },
    // 거르기를 바꿔도 이전 목록을 보여 주다가 바꿔 끼움 (스켈레톤이 깜빡이지 않게)
    placeholderData: keepPreviousData,
  })
}
export function useMeetupDetail(id: string) {
  return useQuery({ queryKey: meetupKeys.detail(id), queryFn: async ({ signal }) => toMeetupDetail(await meetupsApi.get(id, signal)) })
}

/** 목 모드: 모임 저장소가 바뀌면 모임 캐시를 새로 받음 (api/mockSync.tsx 가 부름) */
export function useMeetupsMockSync() { useMockStoreSync('meetups', useMeetups(), meetupKeys.all) }
