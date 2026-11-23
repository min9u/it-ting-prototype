import { useSyncExternalStore, type CSSProperties, type ReactNode } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import { isApiError, isNotFound } from '../api/client'
import { errorToastStore } from '../api/queryClient'
import { EmptyMole, Toast } from './Feedback'
import mound from '../assets/mole-mound.png'
import s from './AsyncState.module.css'

/**
 * 비동기 화면의 세 상태 (위험 B1 · B3): 불러오는 중(스켈레톤) · 오류(다시 시도) · 진짜 없음(404 → NotFound)
 * 그리고 빈 목록(EmptyState). 화면은 QueryGate 하나로 감싸면 됨:
 *   <QueryGate q={useMeetupDetail(id)} skeleton={<DetailSkeleton />} notFound={<NotFound what="meetup" />}>
 *     {(d) => <MeetupDetailView d={d} />}
 *   </QueryGate>
 */

/* ===== 스켈레톤 ===== */
export function Skeleton({ w = '100%', h = 14, r = 6, className, style }: { w?: number | string; h?: number | string; r?: number; className?: string; style?: CSSProperties }) {
  return <span className={`${s.bone} ${className ?? ''}`} style={{ width: w, height: h, borderRadius: r, ...style }} aria-hidden />
}
export function SkeletonLines({ lines = 3, last = '60%' }: { lines?: number; last?: string }) {
  return (
    <span className={s.lines} aria-hidden>
      {Array.from({ length: lines }, (_, i) => <Skeleton key={i} w={i === lines - 1 ? last : '100%'} />)}
    </span>
  )
}
/** 읽어 주기용: 스켈레톤 묶음 바깥에 한 번 */
function Busy({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return <div className={className} role="status" aria-busy="true" aria-label={label}>{children}</div>
}

/** 카드 격자 (모임 목록) */
export function SkeletonCards({ count = 6, label = '모임을 불러오는 중' }: { count?: number; label?: string }) {
  return (
    <Busy label={label} className={s.cards}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={s.card}>
          <Skeleton h={128} r={12} />
          <div className={s.cardBody}><Skeleton w={64} h={22} r={11} /><Skeleton w="80%" h={18} /><SkeletonLines lines={2} last="50%" /></div>
        </div>
      ))}
    </Busy>
  )
}
/** 한 줄 목록 (게시판 · 알림 · 채팅) */
export function SkeletonRows({ count = 5, label = '목록을 불러오는 중', avatar = true, compact }: { count?: number; label?: string; avatar?: boolean; compact?: boolean }) {
  return (
    <Busy label={label} className={compact ? `${s.rows} ${s.rowsCompact}` : s.rows}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={s.row}>
          {avatar && <Skeleton w={compact ? 40 : 44} h={compact ? 40 : 44} r={compact ? 12 : 22} />}
          <div className={s.rowBody}><Skeleton w={i % 2 ? '45%' : '62%'} h={16} /><Skeleton w={i % 3 ? '85%' : '70%'} h={12} /></div>
        </div>
      ))}
    </Busy>
  )
}
/** 상세 (본문 + 오른쪽 카드) */
export function DetailSkeleton({ label = '불러오는 중' }: { label?: string }) {
  return (
    <Busy label={label} className={s.detail}>
      <Skeleton w={180} h={14} />
      <Skeleton w="55%" h={34} r={8} style={{ marginTop: 14 }} />
      <div className={s.detailCols}>
        <div className={s.detailMain}><Skeleton h={220} r={14} /><Skeleton w={120} h={22} /><SkeletonLines lines={4} /></div>
        <div className={s.detailSide}><Skeleton h={260} r={14} /><Skeleton h={120} r={14} /></div>
      </div>
    </Busy>
  )
}

/* ===== 오류 · 빈 상태 ===== */
/** 오류 + 다시 시도. compact 는 목록 안에 끼우는 작은 모양 */
export function ErrorState({ error, onRetry, retrying, compact, title = '불러오지 못했어요' }: {
  error?: unknown; onRetry?: () => void; retrying?: boolean; compact?: boolean; title?: string
}) {
  const msg = isApiError(error) ? error.message : '연결이 고르지 않거나 서버가 잠깐 쉬고 있어요. 조금 뒤에 다시 시도해 주세요.'
  return (
    <div className={compact ? `${s.error} ${s.errorCompact}` : s.error} role="alert">
      <img src={mound} alt="" width={compact ? 48 : 72} height={compact ? 48 : 72} />
      <strong className="display">{title}</strong>
      <p>{msg}</p>
      {onRetry && <button type="button" className="btn btn-line btn-sm" onClick={onRetry} disabled={retrying}>{retrying ? '다시 불러오는 중…' : '다시 시도'}</button>}
    </div>
  )
}
/** 빈 목록 (EmptyMole 과 같은 그림) */
export function EmptyState({ message, children }: { message: string; children?: ReactNode }) {
  return <EmptyMole message={message}>{children}</EmptyMole>
}

/**
 * 쿼리 하나의 세 상태를 나눠 그림
 * - 처음 불러오는 중 → skeleton
 * - 404·410 → notFound (없으면 오류로)
 * - 그 밖의 오류 → error 또는 ErrorState(다시 시도)
 * - 값이 있으면 → children (다시 불러오다 실패해도 이전 값을 계속 보여 줌)
 */
export function QueryGate<T>({ q, skeleton, notFound, error, children }: {
  q: UseQueryResult<T>
  skeleton: ReactNode
  notFound?: ReactNode | ((e: unknown) => ReactNode)
  error?: (retry: () => void, e: unknown) => ReactNode
  children: (data: T) => ReactNode
}) {
  if (q.data !== undefined) return <>{children(q.data)}</>
  if (q.isPending && !q.isError) return <>{skeleton}</>
  if (notFound && isNotFound(q.error)) return <>{typeof notFound === 'function' ? notFound(q.error) : notFound}</>
  const retry = () => { void q.refetch() }
  return <>{error ? error(retry, q.error) : <ErrorState error={q.error} onRetry={retry} retrying={q.isFetching} />}</>
}

/* ===== 전역: 쓰기 실패 토스트 · 목 서버 손잡이 배지 ===== */
/** api/queryClient showErrorToast 로 띄운 오류 토스트 (AppLayout 에 하나) */
export function ApiToaster() {
  const { toast } = useSyncExternalStore(errorToastStore.subscribe, errorToastStore.get)
  // 화면의 완료 토스트(아래)와 겹치지 않게 위쪽에
  return <Toast key={toast?.id} open={!!toast} tone="error" placement="top" title={toast?.title ?? ''} desc={toast?.desc} duration={5000} onClose={() => errorToastStore.set({ toast: null })} />
}

