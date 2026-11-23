/**
 * 04 내 땅굴 — TanStack Query 훅과 캐시 키
 * 저장 응답으로 화면을 바로 바꾼다 (명세: 내 정보 저장 → 바뀐 내 땅굴 전체, 두더지 저장 → 저장한 두더지. 다시 조회하지 않음)
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toDtoId } from '../common/ids'
import { onboardingKeys, toMoleDto, wornOfMole } from '../onboarding'
import { authKeys } from '../auth'
import { exploreKeys } from '../explore'
import { burrowApi } from './api'
import { toGuestbookPage, toMyBurrow, type MyBurrowVM } from './mappers'
import { GUESTBOOK_PAGE_SIZE } from './real'
import type { ProfileUpdateRequest } from './types'

export const burrowKeys = {
  all: ['burrow'] as const,
  mine: ['burrow', 'me'] as const,
  /** 그 땅굴의 방명록 (모든 페이지) */
  guestbook: (burrowId: string) => ['burrow', 'guestbook', burrowId] as const,
  guestbookPage: (burrowId: string, page: number) => ['burrow', 'guestbook', burrowId, page] as const,
}

/** 내 땅굴 (GET /me/burrow) */
export function useMyBurrow() {
  return useQuery({ queryKey: burrowKeys.mine, queryFn: async ({ signal }) => toMyBurrow(await burrowApi.myBurrow(signal)) })
}

/** 내 모습이 바뀌면 다른 화면의 "나"도 새로 받게 (프로필 팝업 · 남이 보는 내 땅굴 · 들판의 내 두더지 · 내 계정) */
function useRefreshMe() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: onboardingKeys.profiles })
    void qc.invalidateQueries({ queryKey: exploreKeys.all })
    void qc.invalidateQueries({ queryKey: authKeys.me })
  }
}

/** 두더지 저장 (꾸미기 모드 "저장하기"). worn = 입은 아이템 id */
export function useUpdateMole() {
  const qc = useQueryClient()
  const refresh = useRefreshMe()
  return useMutation({
    mutationFn: (worn: string[]) => burrowApi.updateMole(toMoleDto(worn)),
    onSuccess: (mole) => {
      const worn = wornOfMole(mole)
      qc.setQueryData<MyBurrowVM>(burrowKeys.mine, (old) => (old ? { ...old, worn, owner: { ...old.owner, worn } } : old))
      refresh()
    },
  })
}

/** 내 정보 저장 (내 정보 수정 "저장하기"). 본문은 mappers toProfileUpdate 로 만듦 */
export function useUpdateProfile() {
  const qc = useQueryClient()
  const refresh = useRefreshMe()
  return useMutation({
    mutationFn: async (body: ProfileUpdateRequest) => toMyBurrow(await burrowApi.updateProfile(body)),
    onSuccess: (vm) => { qc.setQueryData(burrowKeys.mine, vm); refresh() },
  })
}

/** 방명록 한 페이지 (주인 · 방문자 같이 씀). burrowId 는 앱 id, 비어 있으면 부르지 않음 */
export function useGuestbookEntries(burrowId: string | null | undefined, page: number, opts: { enabled?: boolean; size?: number } = {}) {
  const size = opts.size ?? GUESTBOOK_PAGE_SIZE
  return useQuery({
    queryKey: burrowKeys.guestbookPage(burrowId ?? '', page),
    queryFn: async ({ signal }) => toGuestbookPage(await burrowApi.guestbookEntries(toDtoId(burrowId!), { page, size }, signal)),
    enabled: !!burrowId && opts.enabled !== false,
    placeholderData: keepPreviousData,
  })
}

/** 방명록 글 지우기. 끝나면 목록 · 글 수(내 땅굴)를 새로 받음 (명세: 지운 뒤 목록을 다시 불러 글 수와 페이지를 맞춤) */
export function useDeleteGuestbookEntry(burrowId: string | null | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (entryId: string) => burrowApi.deleteGuestbookEntry(toDtoId(entryId)),
    onSettled: () => {
      if (burrowId) void qc.invalidateQueries({ queryKey: burrowKeys.guestbook(burrowId) })
      void qc.invalidateQueries({ queryKey: burrowKeys.mine })
    },
  })
}

/**
 * 목 모드: 이 영역 저장소가 바뀌면 캐시를 새로 받는 훅 (api/mockSync.tsx 가 부름).
 * 내 땅굴 저장소는 이 영역 API 로만 바뀌고 쓰기 훅이 캐시를 맞추므로 지켜볼 것이 없다.
 * (방명록 쓰기는 05 탐색 · 방문 영역 → 그쪽 쓰기 훅이 burrowKeys.guestbook(burrowId) 를 새로 받으면 됨)
 */
export function useBurrowMockSync() { /* 지켜볼 저장소 없음 */ }

export type { ProfileUpdateRequest }
