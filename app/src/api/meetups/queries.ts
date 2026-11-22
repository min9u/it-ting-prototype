/**
 * 07 모임 — TanStack Query 훅 · 캐시 키 · 쓰기 호출. 응답은 mappers 로 앱 모양으로 바꿔 돌려줌.
 * 화면은 앱 문자열 id 로 부르고, 여기서 toDtoId 로 바꿔 명세 API 를 부른다.
 * 화면은 { isPending, isError, error, data } 로 로딩 · 오류 · 진짜 없음(404)을 나눠 그림 (components/AsyncState.tsx)
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { toDtoId } from '../common/ids'
import { useMockStoreSync } from '../storeSync'
import { useMeetups } from '../../data/meetupStore'
import { meetupsApi } from './api'
import { toApplications, toCalendar, toCreateRequest, toMeetupCard, toMeetupDetail, toMyMeetup, toMySummary, toUpdateRequest } from './mappers'
import type { MeetupCalendarQuery, MeetupSearchQuery, MyMeetupTab } from './types'
import type { Draft } from '../../data/meetupStore'

/** 캐시 키 (첫 칸 'meetups' — 쓰기 뒤에는 meetupKeys.all 로 모임 캐시를 한꺼번에 새로 받음) */
export const meetupKeys = {
  all: ['meetups'] as const,
  lists: ['meetups', 'list'] as const,
  list: (q: MeetupSearchQuery) => ['meetups', 'list', q] as const,
  detail: (id: string) => ['meetups', 'detail', id] as const,
  mine: (tab: MyMeetupTab) => ['meetups', 'mine', tab] as const,
  summary: ['meetups', 'summary'] as const,
  calendar: (q: MeetupCalendarQuery) => ['meetups', 'calendar', q] as const,
  applications: (id: string) => ['meetups', 'applications', id] as const,
}

/** GET /meetups — 모임 리스트 */
export function useMeetupList(q: MeetupSearchQuery) {
  return useQuery({
    queryKey: meetupKeys.list(q),
    queryFn: async ({ signal }) => { const p = await meetupsApi.list(q, signal); return { ...p, items: p.items.map(toMeetupCard) } },
    // 거르기를 바꿔도 이전 목록을 보여 주다가 바꿔 끼움 (스켈레톤이 깜빡이지 않게)
    placeholderData: keepPreviousData,
  })
}
/** GET /meetups/{meetupId} — 상세 (모임 수정 화면도) */
export function useMeetupDetail(id: string, enabled = true) {
  return useQuery({ queryKey: meetupKeys.detail(id), enabled: enabled && !!id, queryFn: async ({ signal }) => toMeetupDetail(await meetupsApi.get(toDtoId(id), signal)) })
}
/** GET /me/meetups?tab= — 내 모임 탭 하나 */
export function useMyMeetups(tab: MyMeetupTab) {
  return useQuery({ queryKey: meetupKeys.mine(tab), queryFn: async ({ signal }) => (await meetupsApi.mine(tab, signal)).items.map(toMyMeetup) })
}
/** GET /me/meetups/summary — 탭 숫자 · 내 모임 위젯 · 다가오는 일정 · 다음 모임 */
export function useMyMeetupSummary() {
  return useQuery({ queryKey: meetupKeys.summary, queryFn: async ({ signal }) => toMySummary(await meetupsApi.summary(signal)) })
}
/** GET /meetup-calendar — 한 달 (캘린더 팝업 · 내 모임 미니 캘린더) */
export function useMeetupCalendar(q: MeetupCalendarQuery, enabled = true) {
  return useQuery({ queryKey: meetupKeys.calendar(q), enabled, queryFn: async ({ signal }) => toCalendar(await meetupsApi.calendar(q, signal)), placeholderData: keepPreviousData })
}
/** GET /meetups/{meetupId}/applications — 신청 관리 (주최자) */
export function useMeetupApplications(id: string | null) {
  return useQuery({ queryKey: meetupKeys.applications(id ?? ''), enabled: !!id, queryFn: async ({ signal }) => toApplications(await meetupsApi.applications(toDtoId(id!), signal)) })
}

/**
 * 쓰기 호출 (앱 id → DTO id). 화면은 useOptimistic({ call: () => meetupCalls.like(id), … , errors: MEETUP_ERRORS }) 로 부른다
 */
export const meetupCalls = {
  create: (form: Draft) => meetupsApi.create(toCreateRequest(form)),
  update: (id: string, form: Draft) => meetupsApi.update(toDtoId(id), toUpdateRequest(form)),
  cancel: (id: string) => meetupsApi.cancel(toDtoId(id)),
  remove: (id: string) => meetupsApi.remove(toDtoId(id)),
  like: (id: string) => meetupsApi.like(toDtoId(id)),
  unlike: (id: string) => meetupsApi.unlike(toDtoId(id)),
  setLike: (id: string, on: boolean) => (on ? meetupsApi.like(toDtoId(id)) : meetupsApi.unlike(toDtoId(id))),
  setVacancyAlert: (id: string, on: boolean) => (on ? meetupsApi.enableVacancyAlert(toDtoId(id)) : meetupsApi.disableVacancyAlert(toDtoId(id))),
  /**
   * 찜 "되돌리기": 다시 찜하고, 풀기 전에 빈자리 알림이 켜져 있었으면 알림도 다시 켬 (명세: 찜을 풀면 알림이 사라지므로 프론트가 기억)
   */
  relike: async (id: string, hadAlert: boolean) => {
    await meetupsApi.like(toDtoId(id))
    if (hadAlert) await meetupsApi.enableVacancyAlert(toDtoId(id))
    return null
  },
  apply: (id: string, message: string | null) => meetupsApi.apply(toDtoId(id), { message: message?.trim() || null }),
  withdrawApplication: (id: string) => meetupsApi.withdrawApplication(toDtoId(id)),
  cancelParticipation: (id: string) => meetupsApi.cancelParticipation(toDtoId(id)),
  accept: (applicationId: string) => meetupsApi.accept(toDtoId(applicationId)),
  reject: (applicationId: string) => meetupsApi.reject(toDtoId(applicationId)),
  kick: (applicationId: string) => meetupsApi.kick(toDtoId(applicationId)),
}

/** 목 모드: 모임 저장소가 바뀌면 모임 캐시를 새로 받음 (api/mockSync.tsx 가 부름) */
export function useMeetupsMockSync() { useMockStoreSync('meetups', useMeetups(), meetupKeys.all) }
