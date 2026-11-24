/**
 * 쓰기: 낙관적 업데이트 (모든 영역이 같이 씀. 영역 작업자는 고치지 않음)
 * 캐시를 먼저 바꾸고 → 서버 호출 → 실패하면 되돌리고 오류 토스트 → 끝나면 관련 키를 새로 받음
 * (invalidate: [] 로 성공 뒤 새로 받기를 끈 쓰기도, 실패하면 바꿨던 캐시는 새로 받음: 되돌리기가 그 사이 다른 변경을 덮지 않게)
 *
 *   const run = useOptimistic()
 *   run.mutate({ call: () => meetupsApi.like(id), patches: [patch(meetupKeys.detail(id), (d) => …)], errors: MEETUP_ERRORS })
 */
import { useQueryClient, type QueryKey } from '@tanstack/react-query'
import { useSessionMutation } from './sessionMutation'
import { isAbort, isApiError, isUnauthorized } from './client'
import { errorText, type ErrorTable } from './common/errors'
import { showErrorToast } from './queryClient'

export interface CachePatch { key: QueryKey; update: (old: unknown) => unknown; exact?: boolean }
/**
 * 캐시 한 곳을 어떻게 바꿀지 (key 가 앞부분이면 맞는 캐시 모두).
 * exact: 키가 똑같은 캐시만 — 땅굴(['explore','burrow', id])을 바꿀 때 같은 앞부분을 쓰는 방명록까지 땅굴 모양으로 덮어써 깨지던 것을 막음
 */
export const patch = <T,>(key: QueryKey, update: (old: T) => T, exact = false): CachePatch => ({ key, update: update as (old: unknown) => unknown, exact })

export interface OptimisticOp<T = unknown> {
  call: () => Promise<T>
  patches?: CachePatch[]
  /** 끝나면 새로 받을 키 (기본: patches 의 키) */
  invalidate?: QueryKey[]
  /** 실패 토스트 제목 (기본 "저장하지 못했어요") */
  errorTitle?: string
  /** 실패 토스트 문구를 고를 영역 표 (api/<영역>/errors.ts). 없으면 공통 표 → 서버 message */
  errors?: ErrorTable
  /** 이 오류 코드는 오류 토스트를 띄우지 않음 (화면이 직접 안내 문구를 보여 줄 때) */
  quietCodes?: string[]
}

/** 쓰기 오류 → 토스트 (401 · 취소는 띄우지 않음) */
export function toastApiError(e: unknown, title = '저장하지 못했어요', table?: ErrorTable) {
  if (isAbort(e) || isUnauthorized(e)) return
  showErrorToast(title, errorText(e, table))
}

export function useOptimistic() {
  const qc = useQueryClient()
  return useSessionMutation({
    mutationFn: (op: OptimisticOp) => op.call(),
    onMutate: async (op) => {
      const snapshots: [QueryKey, unknown][] = []
      for (const p of op.patches ?? []) {
        await qc.cancelQueries({ queryKey: p.key })
        for (const [k, v] of qc.getQueriesData({ queryKey: p.key, exact: p.exact })) {
          snapshots.push([k, v])
          if (v !== undefined) qc.setQueryData(k, p.update(v))
        }
      }
      return { snapshots }
    },
    onError: (e, op, ctx) => {
      for (const [k, v] of ctx?.snapshots ?? []) qc.setQueryData(k, v)
      // 되돌린 값은 요청 전 전체 모습이라, 그 사이 끝난 다른 쓰기(예: 좋아요 대기 중 댓글 삭제)까지 덮을 수 있음 →
      // invalidate 를 비워 둔 쓰기라도 실패하면 바꿨던 캐시를 서버에서 다시 받아 맞춤 (PR #37 Codex 리뷰)
      for (const p of op.patches ?? []) void qc.invalidateQueries({ queryKey: p.key, exact: p.exact })
      if (isApiError(e) && op.quietCodes?.includes(e.code)) return
      toastApiError(e, op.errorTitle, op.errors)
    },
    onSettled: (_d, _e, op) => {
      for (const k of op.invalidate ?? op.patches?.map((p) => p.key) ?? []) void qc.invalidateQueries({ queryKey: k })
    },
  })
}
