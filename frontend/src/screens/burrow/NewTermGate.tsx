import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from '@/lib/nav'
import { useQueryClient } from '@tanstack/react-query'
import Modal from '../../components/Modal'
import { Toast } from '../../components/Feedback'
import { ErrorState } from '../../components/AsyncState'
import { toastApiError } from '../../api'
import { useCampuses } from '../../api/common'
import { useMe } from '../../api/auth'
import { EXPLORE_ERRORS, startNewTermDemo, useCurrentTerm, useMoveBurrow, useNewTermRequired } from '../../api/explore'
import { CampusFloorPicker } from './ExploreModals'
import x from './Explore.module.css'

/**
 * 땅굴 메인 – 새 학기 안내 (05, Figma 1465:15925) — 로그인 영역 어디서든 (App.tsx AppLayout 에 하나)
 * - 뜨는 때: GET /me 의 nextStep 이 NEW_TERM 이거나, 어느 API 든 403 NEW_TERM_INCOMPLETE 로 막혔을 때 (02 "새 학기를 고르지 않은 계정")
 * - 새 학기 이름(GET /terms 의 이번 학기) · 캠퍼스와 층(GET /campuses)을 고르게 함. 지난 학기에 고른 캠퍼스(GET /me 의 campusFloorId)가 처음에 골라져 있음
 * - "이 층으로 정하기" = POST /me/burrow/move → 안내를 닫고 막혀 있던 화면을 모두 다시 받음 + 완료 토스트
 * - 닫기 없음: × · "나중에 하기" 없음, 바깥을 누르거나 Esc 를 눌러도 닫히지 않음 (명세 4. Figma 시안의 "나중에 하기"는 따르지 않음)
 * 시연: 주소에 ?newterm=demo (목 서버만) → 내 땅굴이 지난 학기 들판에 있는 계정이 됨
 */
export default function NewTermGate() {
  const [params, setParams] = useSearchParams()
  const qc = useQueryClient()
  const gate = useNewTermRequired()
  const [done, setDone] = useState(false)

  // 시연 손잡이: 목 서버를 "새 학기 안 고름"으로 바꾸고 화면을 다시 받음 (그러면 403 NEW_TERM_INCOMPLETE 로 안내가 뜸)
  useEffect(() => {
    if (params.get('newterm') !== 'demo') return
    if (startNewTermDemo()) void qc.invalidateQueries()
    setParams((p) => { const n = new URLSearchParams(p); n.delete('newterm'); return n }, { replace: true })
  }, [params, qc, setParams])

  return (
    <>
      {gate.required && <NewTermGuide onDone={() => { gate.clear(); setDone(true) }} />}
      <Toast open={done} onClose={() => setDone(false)} title="이번 학기 땅굴 자리를 정했어요" desc="새 들판에서 이웃을 만나 보세요" />
    </>
  )
}

function NewTermGuide({ onDone }: { onDone: () => void }) {
  const term = useCurrentTerm()
  const campusesQ = useCampuses()
  const me = useMe()
  const move = useMoveBurrow()
  const campuses = useMemo(() => campusesQ.data ?? [], [campusesQ.data])
  const [campusId, setCampusId] = useState<string | null>(null)
  const [sel, setSel] = useState<string | null>(null)
  // 지난 학기에 고른 캠퍼스를 처음에 골라 둠 (층은 새로 고름)
  useEffect(() => {
    if (campusId || !campuses.length) return
    const mine = campuses.find((c) => c.floors.some((f) => f.id === me.data?.campusFloorId))
    if (mine || !me.isPending) setCampusId((mine ?? campuses[0]).id)
  }, [campusId, campuses, me.data, me.isPending])
  const campus = campuses.find((c) => c.id === campusId)
  const floor = campus?.floors.find((f) => f.id === sel)
  const decide = () => sel && move.mutate(sel, {
    onSuccess: onDone,
    onError: (e) => toastApiError(e, '땅굴 자리를 정하지 못했어요', EXPLORE_ERRORS),
  })
  return (
    // 닫을 수 없음: onClose 는 아무것도 하지 않고 × 도 숨김
    <Modal open onClose={() => {}} width={520} labelledBy="newterm-title" hideClose>
      <div className={x.floorModal}>
        <div className={x.popHead}>
          <h2 id="newterm-title" className={`display ${x.floorTitle}`}>{term.term ? `${term.term.label} 들판이 열렸어요` : '새 학기 들판이 열렸어요'}</h2>
        </div>
        <p className={x.lead}>이번 학기의 캠퍼스와 층을 골라 주세요. 내 땅굴이 그 들판으로 이사해요. 방명록 · 단골 · 방의 모습은 그대로예요.</p>
        {campusesQ.isError && !campuses.length ? <ErrorState error={campusesQ.error} onRetry={() => void campusesQ.refetch()} compact /> : (
          <CampusFloorPicker campuses={campuses} campusId={campusId} onCampus={(id) => { setCampusId(id); setSel(null) }} selected={sel} onSelect={setSel} />
        )}
        <div className={x.pfFoot}>
          <span className={floor ? undefined : x.pfFootNone} aria-live="polite">{floor && campus ? `${campus.name} · ${floor.floor}층` : '층을 골라 주세요'}</span>
          <button type="button" className={x.pfGo} disabled={!sel || move.isPending} onClick={decide}>이 층으로 정하기</button>
        </div>
      </div>
    </Modal>
  )
}
