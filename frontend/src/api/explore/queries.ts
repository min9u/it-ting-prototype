/**
 * 05 탐색 · 방문 (+ 00 학기) — TanStack Query 훅과 캐시 키. 화면은 이 훅과 exploreApi 만 쓴다
 */
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSessionMutation } from '../sessionMutation'
import { isApiError } from '../client'
import { patch, useOptimistic } from '../optimistic'
import { useMockStoreSync } from '../storeSync'
import { toDtoId } from '../common'
import { useMe } from '../auth'
import { getRegulars, subscribeRegulars } from '../../data/field'
import { chatKeys } from '../chat'
import { exploreApi } from './api'
import { EXPLORE_ERRORS } from './errors'
import {
  toBurrow, toChatRequestResult, toDailyRecommendation, toField, toFieldStatuses, toMoved, toRegulars, toTerms,
  placeId, type BurrowVM, type FieldPlace, type RegularVM,
} from './mappers'
// 방명록 목록 캐시는 04 내 땅굴 영역 것 (모듈을 바로 가져옴: 영역 입구끼리 서로 부르는 순환을 피함, 키는 함수 안에서만 씀)
import { burrowKeys } from '../burrow/queries'

/** 캐시 키 (첫 칸 'explore') */
export const exploreKeys = {
  all: ['explore'] as const,
  terms: ['explore', 'terms'] as const,
  fieldStatuses: (termId: string) => ['explore', 'field-statuses', termId] as const,
  field: (place: FieldPlace) => ['explore', 'field', placeId(place)] as const,
  regulars: ['explore', 'regulars'] as const,
  daily: ['explore', 'daily-recommendation'] as const,
  burrow: (userId: string) => ['explore', 'burrow', userId] as const,
}

/* ===== 읽기 ===== */
/** 열린 학기 (최근 것부터). 운영자가 여는 값이라 자주 안 바뀜 */
export function useTerms() {
  return useQuery({ queryKey: exploreKeys.terms, queryFn: async ({ signal }) => toTerms(await exploreApi.terms(signal)), staleTime: 5 * 60_000 })
}
/** 이번 학기 (GET /terms 의 isCurrent) */
export function useCurrentTerm() {
  const q = useTerms()
  return { ...q, term: q.data?.find((t) => t.isCurrent) ?? q.data?.[0] ?? null }
}
/** 그 학기 들판마다 비어 있는지 (캠퍼스-층 id → 비었으면 true) */
export function useFieldStatuses(termId: string | null) {
  return useQuery({
    queryKey: exploreKeys.fieldStatuses(termId ?? ''), enabled: !!termId,
    queryFn: async ({ signal }) => toFieldStatuses(await exploreApi.fieldStatuses(toDtoId(termId!), signal)),
  })
}
/** 들판 하나 (입구 · 주인 카드 값 전부). 다른 들판으로 옮기는 동안은 보던 들판을 그대로 둠 (3D 를 다시 만들지 않게) */
export function useField(place: FieldPlace | null) {
  return useQuery({
    queryKey: exploreKeys.field(place ?? { termId: '', campusFloorId: '' }), enabled: !!place, placeholderData: keepPreviousData,
    queryFn: async ({ signal }) => toField(await exploreApi.field(toDtoId(place!.termId), toDtoId(place!.campusFloorId), signal)),
  })
}
/**
 * 내 땅굴의 들판 (탐색에 주소 없이 들어올 때). 명세는 GET /me/burrow 의 entrance 를 쓰라고 하지만 (04 영역),
 * 새 학기를 고른 계정의 입구는 늘 "이번 학기 + 프로필의 캠퍼스-층"이라 GET /terms 의 이번 학기 + GET /me 의 campusFloorId 로 정한다
 */
export function useHomePlace(): { place: FieldPlace | null; isPending: boolean; error: unknown } {
  const t = useCurrentTerm()
  const me = useMe()
  const place = t.term && me.data ? { termId: t.term.id, campusFloorId: me.data.campusFloorId } : null
  return useMemo(() => ({ place, isPending: !place && (t.isPending || me.isPending), error: t.error ?? me.error }), [place?.termId, place?.campusFloorId, t.isPending, me.isPending, t.error, me.error]) // eslint-disable-line react-hooks/exhaustive-deps
}

/** 내 단골 (최근에 담은 것부터) */
export function useRegularBurrows() {
  return useQuery({ queryKey: exploreKeys.regulars, queryFn: async ({ signal }) => toRegulars(await exploreApi.regularBurrows(signal)) })
}
/** 단골 주인 id 목록 (미니맵 별 표시) */
export function useRegularOwnerIds(): string[] {
  const q = useRegularBurrows()
  return useMemo(() => (q.data ?? []).map((r) => r.owner.id), [q.data])
}

/** 오늘의 추천 (받았는지 · 받은 결과). 탐색에 들어올 때 한 번 → 빨간 점 · 팝업이 같이 씀 */
export function useDailyRecommendation() {
  return useQuery({ queryKey: exploreKeys.daily, queryFn: async ({ signal }) => toDailyRecommendation(await exploreApi.dailyRecommendation(signal)) })
}

/** 남의 땅굴 (방문자 뷰 · 방노트) */
export function useVisitBurrow(userId: string, enabled = true) {
  return useQuery({ queryKey: exploreKeys.burrow(userId), queryFn: async ({ signal }) => toBurrow(await exploreApi.userBurrow(toDtoId(userId), signal)), enabled: enabled && !!userId })
}

/* ===== 쓰기 ===== */
/**
 * 방문자 뷰의 쓰기 (낙관적 업데이트: 캐시를 먼저 바꾸고 실패하면 되돌림 + 토스트)
 * - 단골 담기 · 빼기 (PUT · DELETE), 방명록 남기기. 방명록 목록 · 지우기는 04 api/burrow 의 useGuestbookEntries · useDeleteGuestbookEntry
 */
export function useVisitActions(b: Pick<BurrowVM, 'burrowId' | 'owner'>) {
  const run = useOptimistic()
  const userId = b.owner.id
  const burrowKey = exploreKeys.burrow(userId)
  return {
    pending: run.isPending,
    /** 단골: 상대 수락 없이 바로, 알리지 않음 */
    setRegular: (on: boolean, cb?: { onError?: () => void }) => run.mutate({
      call: () => (on ? exploreApi.addRegular(toDtoId(b.burrowId)) : exploreApi.removeRegular(toDtoId(b.burrowId))),
      errorTitle: '단골을 바꾸지 못했어요', errors: EXPLORE_ERRORS,
      patches: [patch<BurrowVM>(burrowKey, (o) => ({ ...o, isRegular: on }))],
      invalidate: [burrowKey, exploreKeys.regulars],
    }, { onError: cb?.onError }),
    /** 방명록 남기기: 글 수를 먼저 + 1, 끝나면 방명록 목록(04 캐시)과 땅굴을 다시 받음 (새 글이 첫 페이지 맨 위에) */
    writeGuestbook: (text: string, cb?: { onError?: () => void; onSuccess?: () => void }) => run.mutate({
      call: () => exploreApi.writeGuestbook(toDtoId(b.burrowId), text),
      errorTitle: '방명록을 남기지 못했어요', errors: EXPLORE_ERRORS,
      patches: [patch<BurrowVM>(burrowKey, (o) => ({ ...o, guestbookCount: o.guestbookCount + 1 }))],
      invalidate: [burrowKeys.guestbook(b.burrowId), burrowKey],
    }, { onError: cb?.onError, onSuccess: cb?.onSuccess }),
  }
}

/** 대화 요청 보내기. 결과: 요청을 만들었으면 chatRequestId, 바로 대화방이 열렸으면 chatRoomId */
export function useSendChatRequest(userId: string) {
  const qc = useQueryClient()
  return useSessionMutation({
    mutationFn: async (message: string) => toChatRequestResult(await exploreApi.sendChatRequest({ receiverId: toDtoId(userId), message: message.trim() ? message : null })),
    onSuccess: (r) => {
      // "요청 보냄"으로 바로 바꾸고(대화방이 열렸으면 "대화하기"), 서버 값으로 다시 맞춤
      qc.setQueryData<BurrowVM>(exploreKeys.burrow(userId), (o) => o && { ...o, chat: r.chatRoomId ? { status: 'CHATTING', chatRoomId: r.chatRoomId } : { status: 'REQUEST_SENT', chatRoomId: null } })
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: exploreKeys.burrow(userId) })
      void qc.invalidateQueries({ queryKey: chatKeys.all }) // 채팅 영역 캐시 (보낸 요청 · 대화 목록)
    },
  })
}

/** 단골 목록에서 "해제" (목록에서 먼저 뺌) */
export function useRemoveRegular() {
  const run = useOptimistic()
  return (r: RegularVM, cb?: { onSuccess?: () => void }) => run.mutate({
    call: () => exploreApi.removeRegular(toDtoId(r.burrowId)),
    errorTitle: '단골을 해제하지 못했어요', errors: EXPLORE_ERRORS,
    patches: [patch<RegularVM[]>(exploreKeys.regulars, (l) => l.filter((x) => x.burrowId !== r.burrowId))],
    invalidate: [exploreKeys.regulars, exploreKeys.burrow(r.owner.id)],
  }, { onSuccess: cb?.onSuccess })
}

/** 오늘의 추천 받기 → 받은 결과를 캐시에 (탐색의 빨간 점도 꺼짐) */
export function useDrawRecommendation() {
  const qc = useQueryClient()
  return useSessionMutation({
    mutationFn: async (sel: { campusFloorId: string; generation: number }) =>
      toDailyRecommendation(await exploreApi.drawRecommendation({ campusFloorId: toDtoId(sel.campusFloorId), generation: sel.generation })),
    onSuccess: (vm) => { qc.setQueryData(exploreKeys.daily, vm) },
  })
}

/* ===== 새 학기 ===== */
/**
 * 새 학기 안내를 띄워야 하는지: GET /me 의 nextStep 이 NEW_TERM 이거나, 어느 API 든 403 NEW_TERM_INCOMPLETE 로 막혔을 때
 * (02 "새 학기를 고르지 않은 계정"). 이사하면 clear() 로 내림
 */
export function useNewTermRequired() {
  const me = useMe()
  const qc = useQueryClient()
  const [blocked, setBlocked] = useState(false)
  useEffect(() => {
    const hit = (e: unknown) => isApiError(e) && e.code === 'NEW_TERM_INCOMPLETE'
    const offQ = qc.getQueryCache().subscribe((ev) => { if (ev.type === 'updated' && hit(ev.query.state.error)) setBlocked(true) })
    const offM = qc.getMutationCache().subscribe((ev) => { if (ev.type === 'updated' && hit(ev.mutation?.state.error)) setBlocked(true) })
    return () => { offQ(); offM() }
  }, [qc])
  return { required: blocked || me.data?.nextStep === 'NEW_TERM', clear: () => setBlocked(false) }
}

/** 이 층으로 정하기 (POST /me/burrow/move) → 막혀 있던 화면을 모두 다시 받음 */
export function useMoveBurrow() {
  const qc = useQueryClient()
  return useSessionMutation({
    mutationFn: async (campusFloorId: string) => toMoved(await exploreApi.moveBurrow({ campusFloorId: toDtoId(campusFloorId) })),
    onSuccess: () => { void qc.invalidateQueries() },
  })
}

/** 목 모드: 단골 목록이 바뀌면 탐색 캐시를 새로 받음 (api/mockSync.tsx 가 부름) */
export function useExploreMockSync() { useMockStoreSync('explore', useSyncExternalStore(subscribeRegulars, getRegulars), exploreKeys.all) }
