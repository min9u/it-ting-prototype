import { useEffect, useMemo, useState } from 'react'
import { Link } from '@/lib/nav'
import Modal from '../../components/Modal'
import Avatar from '../../components/Avatar'
import { CloseIcon, PinIcon, SearchIcon } from '../../components/Icons'
import { EmptyMole } from '../../components/Feedback'
import { ErrorState, SkeletonLines } from '../../components/AsyncState'
import { toneOf } from '../../data/mock'
import { shortAffOf } from '../../data/field'
import { toastApiError } from '../../api'
import { useCampuses, useGenerations, type CampusOption } from '../../api/common'
import { useMe } from '../../api/auth'
import {
  EXPLORE_ERRORS, samePlace, useDailyRecommendation, useDrawRecommendation, useFieldStatuses, useRegularBurrows, useRemoveRegular, useTerms,
  type FieldPlace, type FriendCardVM, type TermVM,
} from '../../api/explore'
import x from './Explore.module.css'

/*
 * 탐색 팝업들 (05 탐색 · 방문). 모두 api/explore 훅으로 읽고 씀 (2026-11-22 API v1, docs/backend/api-v1/05-explore-visit.md)
 * - 단골 땅굴 목록: GET /me/regular-burrows · DELETE /burrows/{burrowId}/regular
 * - 오늘의 추천 친구: GET · POST /me/daily-recommendation (+ 00 캠퍼스 · 기수)
 * - 캠퍼스-층 고르기: GET /terms · GET /terms/{termId}/fields (+ 00 캠퍼스)
 * - 새 학기 안내는 NewTermGate.tsx (같은 층 목록 부품 CampusFloorPicker 를 씀)
 */

/* ===================== 단골 땅굴 목록 (958:8917 → 2026-11-21 Figma 1127:13203 "친구 카드형") ===================== */
/** 카드 아바타 원 배경 (Figma 1294:12212~: 예린 · 서벅이 · 도토리 순서의 #E6CE9D · #DDE3BE · #ECD0B6) */
const REG_BG = ['#E6CE9D', '#DDE3BE', '#ECD0B6']
/**
 * 내가 단골로 추가한 땅굴을 카드 3열로 (최근에 담은 것부터). 놀러가기 = 방문자 뷰로 바로, 해제 = 목록에서 뺌 (상대에게 알리지 않음). 새 소식 표시는 없음.
 * 안내 문장은 Figma 에 없어서 뺌. 4명 이상이면 줄이 늘어나고 세로로 스크롤
 */
export function RegularsModal({ open, onClose, onRemoved }: { open: boolean; onClose: () => void; onRemoved: (nick: string) => void }) {
  const q = useRegularBurrows()
  const remove = useRemoveRegular()
  const list = q.data ?? []
  return (
    <Modal open={open} onClose={onClose} width={680} labelledBy="regulars-title" hideClose>
      <div className={x.regModal}>
        <div className={x.popHead}>
          <h2 id="regulars-title" className="display">단골 땅굴</h2>
          <button type="button" className={x.popClose} onClick={onClose} aria-label="닫기"><CloseIcon size={18} /></button>
        </div>
        {q.isPending ? <SkeletonLines lines={3} />
          : q.isError && !q.data ? <ErrorState error={q.error} onRetry={() => void q.refetch()} retrying={q.isFetching} compact title="단골 땅굴을 불러오지 못했어요" />
          : list.length ? (
            <ul className={x.regGrid}>
              {list.map((r, n) => (
                <li key={r.burrowId} className={x.regCard}>
                  <Avatar circle size={64} bg={REG_BG[n % REG_BG.length]} />
                  <span className={x.regWho}><strong>{r.owner.nickname}</strong><small>{shortAffOf(r.owner)}</small></span>
                  <Link to={`/burrow/${r.owner.id}`} className={x.regGo} onClick={onClose}>놀러가기</Link>
                  <button type="button" className={x.regOff} onClick={() => remove(r, { onSuccess: () => onRemoved(r.owner.nickname) })}>해제</button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyMole message="아직 단골 땅굴이 없어요. 땅굴에 놀러 가서 '단골 추가'를 눌러 보세요." />
          )}
      </div>
    </Modal>
  )
}

/* ===================== 오늘의 추천 친구 (설정 863:133 · 결과 761:3795 · 카드 뒤집기 765:3619) ===================== */
/**
 * 오늘 아직 안 받았으면(hasReceived false) 추천 설정(캠퍼스 · 층 · 기수) → 추천 받기 → 결과. 이미 받았으면 오늘 받은 사람들 (다시 눌러도 같은 사람).
 * 탐색에 들어올 때 자동으로 띄우지 않음 (05 탐색 5). 결과 화면에는 설정을 두지 않음.
 * 설정은 캠퍼스 · 층과 기수만, 고른 값은 저장하지 않음 (열 때마다 내 캠퍼스 · 층 · 기수로 시작)
 */
export function RecommendModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const q = useDailyRecommendation()
  const draw = useDrawRecommendation()
  const d = q.data
  return (
    <Modal open={open} onClose={onClose} width={d?.hasReceived ? 720 : 560} labelledBy="rec-title">
      {q.isPending ? <div className={x.modal}><h2 id="rec-title" className="display">오늘의 추천 친구</h2><SkeletonLines lines={4} /></div>
        : !d ? <div className={x.modal}><h2 id="rec-title" className="display">오늘의 추천 친구</h2><ErrorState error={q.error} onRetry={() => void q.refetch()} retrying={q.isFetching} compact /></div>
        : d.hasReceived ? <RecommendResult friends={d.friends} onGo={onClose} />
        : <RecommendSettingsView pending={draw.isPending}
            onDraw={(sel) => draw.mutate(sel, { onError: (e) => toastApiError(e, '추천을 받지 못했어요', EXPLORE_ERRORS) })} />}
    </Modal>
  )
}

/** 선택 칩 (Figma 863:133 "같은 캠퍼스" 칩: 고르면 갈색 + ✓, 안 고르면 흰 바탕 테두리). 한 줄에서 하나만 고름 */
function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" className={on ? x.chipOn : x.chip} aria-pressed={on} onClick={onClick}>{on && '✓ '}{children}</button>
}

/** 캠퍼스-층 id → 그 캠퍼스 (목록에서 찾음) */
const campusOfFloor = (campuses: CampusOption[], campusFloorId: string | undefined) => campuses.find((c) => c.floors.some((f) => f.id === campusFloorId))

/**
 * 추천 친구 설정 (05 "추천 받기 전" 2 · 4): 캠퍼스 · 층과 기수만 고름. 캠퍼스를 고르면 그 캠퍼스의 층 목록이 나옴
 * (캠퍼스를 바꾸면 층을 다시 고름). 목록은 00 공통 GET /campuses · GET /generations, 처음 값은 내 계정(GET /me)의 캠퍼스-층 · 기수
 */
function RecommendSettingsView({ onDraw, pending }: { onDraw: (sel: { campusFloorId: string; generation: number }) => void; pending: boolean }) {
  const campusesQ = useCampuses()
  const gensQ = useGenerations()
  const me = useMe()
  const campuses = useMemo(() => campusesQ.data ?? [], [campusesQ.data])
  const [campusId, setCampusId] = useState<string | null>(null)
  const [floorId, setFloorId] = useState<string | null>(null)
  const [gen, setGen] = useState<number | null>(null)
  // 처음 한 번: 내 캠퍼스 · 층 · 기수로
  const [seeded, setSeeded] = useState(false)
  useEffect(() => {
    if (seeded || !campuses.length || !me.data) return
    const c = campusOfFloor(campuses, me.data.campusFloorId) ?? campuses[0]
    setCampusId(c.id); setFloorId(c.floors.some((f) => f.id === me.data!.campusFloorId) ? me.data.campusFloorId : null); setGen(me.data.gen); setSeeded(true)
  }, [seeded, campuses, me.data])
  const campus = campuses.find((c) => c.id === campusId)
  const ready = !!floorId && gen != null && !pending
  return (
    <div className={x.modal}>
      <h2 id="rec-title" className="display">오늘의 추천 친구</h2>
      <p className={x.lead}>캠퍼스 · 층과 기수를 고르고 오늘의 추천 친구 3명을 받아 보세요.</p>
      {campusesQ.isError || gensQ.isError ? <ErrorState error={campusesQ.error ?? gensQ.error} onRetry={() => { void campusesQ.refetch(); void gensQ.refetch() }} compact /> : (
        <>
          <section className={x.recSec} aria-labelledby="rec-campus">
            <h3 id="rec-campus">캠퍼스</h3>
            <div className={x.chips} role="group" aria-labelledby="rec-campus">
              {campuses.map((c) => <Chip key={c.id} on={campusId === c.id} onClick={() => { if (c.id !== campusId) { setCampusId(c.id); setFloorId(null) } }}>{c.name}</Chip>)}
            </div>
          </section>
          <section className={x.recSec} aria-labelledby="rec-floor">
            <h3 id="rec-floor">층</h3>
            <div className={x.chips} role="group" aria-labelledby="rec-floor">
              {(campus?.floors ?? []).map((f) => <Chip key={f.id} on={floorId === f.id} onClick={() => setFloorId(f.id)}>{f.floor}층</Chip>)}
            </div>
          </section>
          <section className={x.recSec} aria-labelledby="rec-gen">
            <h3 id="rec-gen">기수</h3>
            <div className={x.chips} role="group" aria-labelledby="rec-gen">
              {(gensQ.data ?? []).map((g) => <Chip key={g} on={gen === g} onClick={() => setGen(g)}>{g}기</Chip>)}
            </div>
          </section>
        </>
      )}
      <p className={x.recNotice}>추천은 하루 한 번 받을 수 있어요. 오늘 받은 추천은 내일까지 바뀌지 않아요.</p>
      <button className={`btn btn-cta btn-block ${x.recDraw}`} disabled={!ready} onClick={() => ready && onDraw({ campusFloorId: floorId!, generation: gen! })}>추천 받기</button>
    </div>
  )
}

/** 카드 아바타 배경 (파스텔: 라일락 · 하늘 · 버터) */
const CARD_BG = ['#e6ddeb', '#d9e6ec', '#f3e6be']
/** "Q1. 문장" → "Q. 문장" */
const dotQ = (q: string) => q.replace(/^Q\d+\./, 'Q.')

/**
 * 추천 결과 (05 추천 결과 · 답변 보기): 카드 앞면 = 사용자 표시 + 서버가 고른 관심사 3개(겹치는 것 ✓, 받은 순서 그대로),
 * 누르면 뒷면 = 질문 3개와 답변. 겹치는 관심사 개수 문구는 두지 않음. 0명이면 빈 상태
 */
function RecommendResult({ friends, onGo }: { friends: FriendCardVM[]; onGo: () => void }) {
  const [flipped, setFlipped] = useState<string | null>(null)
  /** 지금 고른(올려 둔 · 누른) 카드. 처음엔 첫 번째. 주황 테두리 + 주황 버튼 */
  const [active, setActive] = useState<string | null>(friends[0]?.burrowId ?? null)
  return (
    <div className={x.modal}>
      <h2 id="rec-title" className="display">오늘의 추천 친구가 도착했어요</h2>
      {friends.length > 0 && <p className={x.lead}>오늘 만나 볼 SSAFY 친구 {friends.length}명이에요</p>}
      {friends.length > 0 && <p className={x.cardHint}>카드를 누르면 친구의 답변을 볼 수 있어요</p>}
      {friends.length ? (
        <ul className={x.recCards}>
          {friends.map((f, n) => {
            const u = f.owner
            const back = flipped === f.burrowId
            const bg = CARD_BG[n % CARD_BG.length]
            return (
              <li key={f.burrowId} className={`${back ? x.cardBack : x.card} ${active === f.burrowId ? x.cardActive : ''}`}
                onMouseEnter={() => setActive(f.burrowId)} onFocus={() => setActive(f.burrowId)}>
                {back ? (
                  <button className={x.backFace} onClick={() => setFlipped(null)} aria-label={`${u.nickname} 프로필로 돌아가기`}>
                    <span className={x.fold} aria-hidden />
                    <span className={x.backHead}><Avatar circle size={40} bg={bg} /><strong>{u.nickname}</strong></span>
                    <dl className={x.backQna}>{f.qna.slice(0, 3).map((q) => <div key={q.q}><dt>{dotQ(q.q)}</dt><dd>{q.a}</dd></div>)}</dl>
                  </button>
                ) : (
                  <button className={x.cardFront} onClick={() => { setActive(f.burrowId); setFlipped(f.burrowId) }} aria-label={`${u.nickname} 답변 보기`}>
                    <span className={x.fold} aria-hidden />
                    <Avatar circle size={72} bg={bg} />
                    <strong>{u.nickname}</strong>
                    <small>{u.affiliation}</small>
                    <span className={x.cardChips}>
                      {f.tags.map((t) => (
                        <span key={t.name} style={{ background: `var(--tone-${toneOf(t.name)}-bg)`, color: `var(--tone-${toneOf(t.name)}-fg)` }}>{t.shared && '✓ '}{t.name}</span>
                      ))}
                    </span>
                  </button>
                )}
                <Link to={`/burrow/${u.id}`} className={`btn ${active === f.burrowId || back ? 'btn-cta' : 'btn-line'} btn-block ${x.cardGo}`} onClick={onGo}>땅굴 방문하기</Link>
              </li>
            )
          })}
        </ul>
      ) : (
        <EmptyMole message="조건에 맞는 친구를 찾지 못했어요." />
      )}
      <p className={x.recNext}>오늘은 다시 받을 수 없어요. 내일 새로운 추천 친구를 받을 수 있어요</p>
    </div>
  )
}

/* ===================== 캠퍼스-층 목록 (캠퍼스-층 고르기 2 ~ 4 · 새 학기 안내 2 가 같이 씀) ===================== */
/** 그 학기 · 캠퍼스-층의 이름: "서울 · 3층" (지난 학기면 앞에 학기) */
export function placeLabelOf(place: FieldPlace | null, campuses: CampusOption[], terms: TermVM[]): string {
  if (!place) return ''
  const c = campusOfFloor(campuses, place.campusFloorId)
  const fl = c?.floors.find((f) => f.id === place.campusFloorId)
  const t = terms.find((x) => x.id === place.termId)
  const name = c && fl ? `${c.name} · ${fl.floor}층` : ''
  return t && !t.isCurrent ? `${t.label} ${name}` : name
}

/**
 * 캠퍼스 5칸 + 층 번호 검색 + 세로 스크롤 층 목록 (00 공통 19, 05 캠퍼스-층 고르기 2 ~ 4).
 * - 캠퍼스를 바꾸면 검색어와 층 선택을 비움 (부르는 쪽 onCampus 에서 층 선택을 비움)
 * - 층 번호는 서버 목록에서만 고름 (직접 입력 없음). 결과가 없으면 "검색 결과가 없어요"
 * - 땅굴 개수는 보여 주지 않고, 땅굴이 하나도 없는 층에만 "비어 있음" (empty 를 줄 때만)
 */
export function CampusFloorPicker({ campuses, campusId, onCampus, selected, onSelect, currentFloorId, empty, label }: {
  campuses: CampusOption[]
  campusId: string | null
  onCampus: (id: string) => void
  /** 고른 캠퍼스-층 id */
  selected: string | null
  onSelect: (campusFloorId: string) => void
  /** "현재 위치" 배지를 붙일 캠퍼스-층 id */
  currentFloorId?: string | null
  /** 캠퍼스-층 id → 비었으면 true (캠퍼스-층 고르기). 없으면 "비어 있음"을 안 그림 */
  empty?: Map<string, boolean>
  label?: string
}) {
  const [query, setQuery] = useState('')
  const campus = campuses.find((c) => c.id === campusId)
  const q = query.replace(/\D/g, '')
  const floors = (campus?.floors ?? []).filter((f) => !q || String(f.floor).includes(q))
  return (
    <>
      <div className={x.pfBlock}>
        <p className={x.pfLabel}>{label ?? '캠퍼스'}</p>
        <div className={x.campusRow} role="group" aria-label="캠퍼스">
          {campuses.map((c) => (
            <button key={c.id} type="button" aria-pressed={c.id === campusId} className={c.id === campusId ? x.campusOn : x.campusBtn}
              onClick={() => { if (c.id !== campusId) { setQuery(''); onCampus(c.id) } }}>{c.name}</button>
          ))}
        </div>
      </div>
      <div className={x.pfBlock}>
        <label className={x.floorSearch}>
          <SearchIcon size={18} />
          <input type="search" inputMode="numeric" placeholder="층 번호 검색" aria-label="층 번호 검색" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <ul className={x.floorScroll} aria-label={`${campus?.name ?? ''} 층 목록`}>
          {floors.map((f) => {
            const picked = selected === f.id
            return (
              <li key={f.id}>
                <button type="button" aria-pressed={picked} className={picked ? x.floorRowOn : x.floorRow} onClick={() => onSelect(f.id)}>
                  <span className={x.floorName}>
                    {f.floor}층
                    {currentFloorId === f.id && <em className={x.floorBadge}>현재 위치</em>}
                  </span>
                  <span className={x.floorCount}>
                    {empty?.get(f.id) && '비어 있음'}
                    <svg className={x.floorCheck} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ visibility: picked ? 'visible' : 'hidden' }}><path d="M3.5 8.5l3 3 6-7" /></svg>
                  </span>
                </button>
              </li>
            )
          })}
          {!floors.length && <li className={x.floorNone}>{q ? '검색 결과가 없어요' : '아직 층이 없어요'}</li>}
        </ul>
      </div>
    </>
  )
}

/* ===================== 캠퍼스-층 고르기 (00 공통 19 → 2026-11-21 Figma 1265:35323 "검색·스크롤 비교안") ===================== */
/**
 * 맨 위 "현재 위치" 줄 → (학기가 둘 이상이면 학기 줄) → 캠퍼스 → 층 번호 검색 + 목록 → 아래 "서울 · 3층"과 [들어가기].
 * 층을 누르면 고르기만 하고(✓), [들어가기]를 눌러야 이동. 지금 있는 층을 고르거나 층을 안 골랐으면 [들어가기]는 꺼짐. [현재 층으로]는 선택만 되돌림.
 * 학기를 바꾸면 그 학기의 목록으로 바꾸고 층 선택을 비움 (05 캠퍼스-층 고르기 6). 다른 소속의 캠퍼스-층에도 들어갈 수 있음.
 * "비어 있음" = GET /terms/{termId}/fields. 사다리를 눌러도 열림
 */
export function FloorPickerModal({ open, current, onClose, onPick }: { open: boolean; current: FieldPlace; onClose: () => void; onPick: (p: FieldPlace) => void }) {
  const termsQ = useTerms()
  const campusesQ = useCampuses()
  const terms = useMemo(() => termsQ.data ?? [], [termsQ.data])
  const campuses = useMemo(() => campusesQ.data ?? [], [campusesQ.data])
  const [termId, setTermId] = useState(current.termId)
  const [campusId, setCampusId] = useState<string | null>(null)
  /** 고른 층 (아직 이동 전) */
  const [sel, setSel] = useState<string | null>(current.campusFloorId)
  const [resetKey, setResetKey] = useState(0)
  const statuses = useFieldStatuses(open ? termId : null)
  const reset = () => { setTermId(current.termId); setCampusId(campusOfFloor(campuses, current.campusFloorId)?.id ?? campuses[0]?.id ?? null); setSel(current.campusFloorId); setResetKey((n) => n + 1) }
  // 열 때(또는 지금 들판이 바뀔 때 · 캠퍼스 목록이 처음 올 때)만 처음 상태로
  useEffect(() => { if (open) reset() }, [open, current.termId, current.campusFloorId, campuses.length]) // eslint-disable-line react-hooks/exhaustive-deps
  const picked: FieldPlace | null = sel ? { termId, campusFloorId: sel } : null
  const canGo = !!picked && !samePlace(picked, current)
  const loadErr = termsQ.error ?? campusesQ.error
  return (
    <Modal open={open} onClose={onClose} width={520} labelledBy="floor-title" hideClose>
      <div className={x.floorModal}>
        <div className={x.popHead}>
          <h2 id="floor-title" className={`display ${x.floorTitle}`}>캠퍼스-층 고르기</h2>
          <button type="button" className={x.popClose} onClick={onClose} aria-label="닫기"><CloseIcon size={18} /></button>
        </div>
        <div className={x.curBar}>
          <span className={x.curWhere}><PinIcon size={18} /><small>현재 위치</small><strong>{placeLabelOf(current, campuses, terms)}</strong></span>
          <button type="button" className={x.curBack} onClick={reset}>현재 층으로</button>
        </div>
        {loadErr && !campuses.length ? <ErrorState error={loadErr} onRetry={() => { void termsQ.refetch(); void campusesQ.refetch() }} compact /> : (
          <>
            {/* 학기 줄: 학기가 둘 이상 열려 있을 때만 (05 캠퍼스-층 고르기 6) */}
            {terms.length > 1 && (
              <div className={x.seg} role="tablist" aria-label="학기">
                {terms.map((t) => <button key={t.id} role="tab" aria-selected={t.id === termId} className={t.id === termId ? x.segOn : x.segBtn} onClick={() => { if (t.id !== termId) { setTermId(t.id); setSel(null) } }}>{t.label}{t.isCurrent && ' (이번 학기)'}</button>)}
              </div>
            )}
            <CampusFloorPicker key={resetKey} campuses={campuses} campusId={campusId} onCampus={(id) => { setCampusId(id); setSel(null) }}
              selected={sel} onSelect={setSel} currentFloorId={termId === current.termId ? current.campusFloorId : null} empty={statuses.data} />
          </>
        )}
        <div className={x.pfFoot}>
          <span className={picked ? undefined : x.pfFootNone} aria-live="polite">{picked ? placeLabelOf(picked, campuses, terms) : '층을 골라 주세요'}</span>
          <button type="button" className={x.pfGo} disabled={!canGo} onClick={() => picked && onPick(picked)}>들어가기</button>
        </div>
      </div>
    </Modal>
  )
}
