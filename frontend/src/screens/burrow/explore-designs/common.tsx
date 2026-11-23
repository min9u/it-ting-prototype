/**
 * 탐색 디자인 B·C·D 공통 (02 F5 명세 기능). 디자인 A(ExploreBurrow.tsx)와 같은 동작을 새 파일에 따로 둠
 * (ExploreBurrow.tsx 는 다른 작업과 겹쳐서 손대지 않으려고). 2026-11-16
 * - 들판·자리: 주소 ?floor=&seat= (뒤로 가기 하면 보던 자리). 들판이 바뀌면 화면을 새로 만듦(ExploreDesigns 의 key)
 * - 왼쪽 위 버튼 3개 · 오른쪽 주인 카드 · 안내판 · 팝업 3개(ExploreModals 그대로) · 토스트 · 들어갈 때 어두워짐 · 빈 들판
 * - 2026-11-22 API v1: 시안 B·C·D 의 들판은 목 데이터(data/field fieldOf)를 그대로 씀 (팀 비교용 시안이라 API 로 옮기지 않음, 목 모드 전용).
 *   팝업 3개 · 추천 빨간 점은 시안 A 와 같은 API 훅. "접속 중"은 명세에서 빠져서 들판 값에서 지움
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from '@/lib/nav'
import Avatar from '../../../components/Avatar'
import InterestChip from '../../../components/InterestChip'
import SceneButton from '../../../components/SceneButton'
import { EmptyMole, Toast } from '../../../components/Feedback'
import { HomeIcon } from '../../../components/Icons'
import { MY_FLOOR, affOf, fieldOf, floorLabel, me, parseFloor, type FieldData, type Floor, type Resident } from '../../../data/field'
import { exploreKeys, parsePlace, placeId, resetDailyRecommendationDemo, useDailyRecommendation } from '../../../api/explore'
import { useQueryClient } from '@tanstack/react-query'
import { FloorPickerModal, RecommendModal, RegularsModal } from '../ExploreModals'
import { sharedWith } from './match'
import { isActivatable, shortcutAllowed } from '../../../lib/a11y'
import s from '../Burrow.module.css'
import x from '../Explore.module.css'

/** 땅굴로 들어갈 때 화면이 어두워지는 시간 (ms, 디자인 A 와 같음) */
export const ENTER_FADE = 450
/** 오른쪽 카드가 가리는 폭 (카드 340 + 오른쪽 여백 32) */
export const PANEL_COVER = 372

export type ModalKind = null | 'regulars' | 'recommend' | 'floor'

export function useExploreBase() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const floor: Floor = parseFloor(params.get('floor') ?? '') ?? MY_FLOOR
  const field = useMemo(() => withoutOnline(fieldOf(floor)), [floor.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const bySeat = useMemo(() => new Map(field.residents.map((r) => [r.seat, r])), [field])
  const others = field.residents.filter((r) => !r.mine).length
  const seatParam = Number(params.get('seat'))
  const urlSeat = bySeat.has(seatParam) ? seatParam : null
  const startSeat = urlSeat ?? field.mySeat ?? field.residents[0]?.seat ?? 0
  const mine = useMemo(() => me(), [])

  const [modal, setModal] = useState<ModalKind>(() => {
    const m = params.get('modal'); return m === 'regulars' || m === 'recommend' || m === 'floor' ? m : null
  })
  const [toast, setToast] = useState<string | null>(null)
  const [leaving, setLeaving] = useState(false)
  // 처음 그릴 때는 어두운 화면 → 곧 밝아짐 (땅굴에서 나올 때 디자인 A 와 같은 느낌)
  const [shown, setShown] = useState(false)
  useEffect(() => { const t = window.setTimeout(() => setShown(true), 60); return () => window.clearTimeout(t) }, [])
  const qc = useQueryClient()
  const recDone = useDailyRecommendation().data?.hasReceived ?? true
  useEffect(() => { if (params.get('recommend') === 'reset' && resetDailyRecommendationDemo()) void qc.invalidateQueries({ queryKey: exploreKeys.daily }) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /** 지금 자리를 주소에 (땅굴에 들어갔다가 뒤로 오면 같은 자리) */
  const rememberSeat = useCallback((n: number) => {
    setParams((p) => {
      if (p.get('seat') === String(n)) return p
      const q = new URLSearchParams(p); q.set('seat', String(n)); if (!q.get('floor')) q.set('floor', floor.id); return q
    }, { replace: true })
  }, [floor.id, setParams])

  const enter = useCallback((r: Resident | undefined) => {
    if (!r || leaving) return
    setLeaving(true)
    window.setTimeout(() => navigate(r.mine ? '/burrow' : `/burrow/${r.user.id}`, { state: { from: 'explore' } }), ENTER_FADE)
  }, [leaving, navigate])

  const goFloor = (f: Floor, seatNo?: number) => {
    setModal(null)
    const next = new URLSearchParams(params)
    next.set('floor', f.id)
    if (seatNo) next.set('seat', String(seatNo)); else next.delete('seat')
    next.delete('modal')
    setParams(next)
  }

  return {
    params, setParams, floor, field, bySeat, others, startSeat, mine,
    modal, setModal, toast, setToast, leaving, shown, enter, goFloor, rememberSeat,
    recDone, bumpRec: () => {},
    shared: (r: Resident | undefined) => (r && !r.mine ? sharedWith(r.user, mine.interests) : []),
  }
}
export type ExploreBase = ReturnType<typeof useExploreBase>

/** "접속 중"은 명세 범위 밖 (README "이번 범위에 없는 것") → 목 들판 값에서 지움 */
const withoutOnline = (f: FieldData): FieldData => ({ ...f, residents: f.residents.map((r) => ({ ...r, user: { ...r.user, online: false } })) })

/** 포인터 잡기·놓기 (이미 놓인 포인터 등으로 실패해도 끌기는 계속) */
export function capture(el: Element | null | undefined, id: number, on: boolean) {
  try { if (on) el?.setPointerCapture(id); else if (el?.hasPointerCapture(id)) el.releasePointerCapture(id) } catch { /* 무시 */ }
}

/** 방향키 · WASD · Enter · 그 밖의 키 (팝업이 열려 있거나 글을 쓰는 중이면 무시) */
export function useExploreKeys(on: boolean, h: { dir?: (d: 'up' | 'down' | 'left' | 'right') => void; enter?: () => void; key?: (e: KeyboardEvent) => boolean }) {
  useEffect(() => {
    if (!on) return
    const onKey = (e: KeyboardEvent) => {
      // 글 쓰는 중 · 한글 조합 중 · 조합키 · 팝업이면 쉼 (lib/a11y.ts). 모달이 아닌 떠 있는 창(알림 팝오버 등 role=dialog)도 예전처럼 쉼
      if (!shortcutAllowed(e) || document.querySelector('[role="dialog"]')) return
      const dir = ({ ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right' } as const)[e.code as 'ArrowUp']
      if (dir && h.dir) { e.preventDefault(); h.dir(dir); return }
      if (e.key === 'Enter' && h.enter && !isActivatable(e.target)) { e.preventDefault(); h.enter(); return }
      if (h.key?.(e)) e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
}

/** 왼쪽 위: 단골 땅굴 · 추천 친구(빨간 점) · 캠퍼스-층 */
export function ExploreTools({ base, children }: { base: ExploreBase; children?: ReactNode }) {
  return (
    <div className={x.leftTools}>
      <SceneButton tone="paper" onClick={() => base.setModal('regulars')}>단골 땅굴</SceneButton>
      <SceneButton tone="paper" onClick={() => base.setModal('recommend')}>
        추천 친구 {!base.recDone && <><i className={x.redDot} aria-hidden /><span className="sr-only">(오늘 아직 안 받음)</span></>}
      </SceneButton>
      <SceneButton tone="paper" onClick={() => base.setModal('floor')} aria-label={`지금 들판 ${floorLabel(base.floor)}. 캠퍼스-층 고르기`}>
        {floorLabel(base.floor)} <span aria-hidden className={x.caret}>▾</span>
      </SceneButton>
      {children}
    </div>
  )
}

/** 안내판 카드 (디자인 A 와 같은 모양): 닉네임 · 같은 관심사 수 · 태그 · 땅굴 놀러가기 */
export function SignCard({ base, r, onEnter, extra }: { base: ExploreBase; r: Resident; onEnter: () => void; extra?: ReactNode }) {
  const shared = base.shared(r)
  return (
    <div className={x.signCard} role="group" aria-label={r.mine ? '내 땅굴 안내판' : `${r.user.nickname}님의 땅굴 안내판`}>
      <div className={x.signOwner}>
        <Avatar size={40} />
        <div>
          <strong>{r.mine ? '내 땅굴' : `${r.user.nickname}님의 땅굴`}</strong>
          <small>{r.mine ? `${floorLabel(base.floor)} · ${r.seat}번 자리` : `같은 관심사 ${shared.length}개`}</small>
        </div>
      </div>
      {!r.mine && shared.length > 0 && <div className={x.signTags}>{shared.slice(0, 3).map((t) => <InterestChip key={t} label={t} />)}</div>}
      {extra}
      <button className={`btn btn-cta ${x.signBtn}`} onClick={onEnter}>
        {r.mine ? '내 땅굴 들어가기' : '땅굴 놀러가기'} <kbd className={x.kbd}>Enter</kbd>
      </button>
    </div>
  )
}

/** 오른쪽: 고른(서 있는) 땅굴 주인 정보 — 디자인 A 와 같은 카드. 접기 가능 */
export function OwnerPanel({ base, r, open, setOpen, title }: { base: ExploreBase; r: Resident | undefined; open: boolean; setOpen: (v: boolean) => void; title?: string }) {
  const owner = r?.user
  const shared = base.shared(r)
  if (!open) return <button className={s.reopen} onClick={() => setOpen(true)}><span className="display">땅굴 정보</span><Avatar size={22} /></button>
  return (
    <aside className={s.roomInfo} aria-label="땅굴 주인 정보">
      <div className={s.panelHead}>
        <h2 className="display">{title ?? (!owner ? '빈 들판' : r?.mine ? '내 땅굴' : `${owner.nickname}님의 땅굴`)}</h2>
        <button className="link-accent" onClick={() => setOpen(false)}>접기 ›</button>
      </div>
      {owner ? (
        <>
          <div className={s.profile}>
            <Avatar size={64} />
            <div>
              <p className={`display ${s.nick}`}>{owner.nickname} {owner.online && !r?.mine && <small className={s.online}>● 접속 중</small>}</p>
              <p className={s.aff}>{affOf(owner)}</p>
            </div>
          </div>
          <div className={`${s.introBox} ${s.introRead}`}>
            <span className={s.introHead}><strong>자기소개</strong></span>
            <p className={s.introP}>{owner.intro || '아직 작성한 자기소개가 없어요.'}</p>
          </div>
          <dl className={s.details}>
            <div><dt>관심 분야</dt><dd>{owner.interests.slice(0, 3).join(', ')}{owner.interests.length > 3 && ` 외 ${owner.interests.length - 3}개`}</dd></div>
            {!r?.mine && <div><dt>겹치는 관심사</dt><dd className={x.shared}>{shared.length ? shared.join(', ') : '아직 없어요'}</dd></div>}
          </dl>
          {owner.qna?.length ? (
            <>
              <h3 className={`display ${s.qnaTitle}`}>Q&amp;A</h3>
              <dl className={s.qna}>{owner.qna.slice(0, 3).map((q) => <div key={q.q}><dt>{q.q}</dt><dd>{q.a}</dd></div>)}</dl>
            </>
          ) : null}
        </>
      ) : (
        <p className={x.panelEmpty}>이 들판엔 아직 땅굴이 없어요. 사다리를 누르거나 왼쪽 위 캠퍼스-층 버튼으로 다른 들판에 가 보세요.</p>
      )}
    </aside>
  )
}

/** 왼쪽 아래 "내 땅굴로 돌아가기" (다른 들판이면 내 들판의 내 자리로) */
export function HomeButton({ base, atHome, onHome, disabled }: { base: ExploreBase; atHome: boolean; onHome: () => void; disabled?: boolean }) {
  if (base.floor.id === MY_FLOOR.id && atHome) return null
  const click = () => { if (base.floor.id !== MY_FLOOR.id) base.goFloor(MY_FLOOR, base.field.mySeat ?? undefined); else onHome() }
  return (
    <SceneButton tone="cream" className={x.homeBtn} onClick={click} disabled={disabled}>
      <HomeIcon size={16} /> 내 땅굴로 돌아가기
    </SceneButton>
  )
}

export function EmptyField({ base, left = 0.5, top }: { base: ExploreBase; left?: number; top?: string }) {
  if (base.others > 0) return null
  return (
    <div className={x.emptyField} style={{ left: `${left * 100}%`, top }}>
      <EmptyMole message="이 들판에는 아직 다른 땅굴이 없어요">
        <button className="btn btn-cta" onClick={() => base.setModal('floor')}>다른 캠퍼스-층 가보기</button>
      </EmptyMole>
    </div>
  )
}

/** 팝업 3개 + 토스트 + 어두워짐 (디자인 A 와 같은 팝업을 그대로 씀) */
export function ExploreOverlays({ base }: { base: ExploreBase }) {
  const { floor, field } = base
  return (
    <>
      <RegularsModal open={base.modal === 'regulars'} onClose={() => base.setModal(null)} onRemoved={(n) => base.setToast(`${n}님을 단골에서 뺐어요`)} />
      <RecommendModal open={base.modal === 'recommend'} onClose={() => { base.setModal(null); base.bumpRec() }} />
      {/* 목 모드에서는 API 의 들판 위치(학기 id|캠퍼스-층 id)가 목 들판 id 와 같은 글자 */}
      <FloorPickerModal open={base.modal === 'floor'} current={parsePlace(floor.id)!} onClose={() => base.setModal(null)}
        onPick={(p) => { const f = parseFloor(placeId(p)); if (f) base.goFloor(f, f.id === MY_FLOOR.id ? field.mySeat ?? undefined : undefined) }} />
      <Toast open={!!base.toast} onClose={() => base.setToast(null)} title={base.toast ?? ''} />
      <div className={`${x.fade} ${base.leaving ? x.fadeIn : base.shown ? x.fadeOut : x.fadeHold}`} aria-hidden />
    </>
  )
}
