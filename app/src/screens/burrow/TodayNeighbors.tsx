import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Avatar from '../../components/Avatar'
import Modal from '../../components/Modal'
import { ME_ID, USERS, toneOf } from '../../data/mock'
import type { User } from '../../data/types'
import s from './Burrow.module.css'

/**
 * 언제 뜨나: 이 탭에서 탐색에 처음 들어올 때(sessionStorage) 한 번. "오늘 하루 보지 않기"를 켜고 닫으면 오늘은 다시 안 뜸(localStorage)
 * 저장소가 막힌 곳(공유 링크)에서는 메모리 값으로 이 페이지 안에서만 기억
 */
const KEY = 'digul.todayNeighbors'
const today = () => new Date().toISOString().slice(0, 10)
let shownHere = false
export function shouldShowToday(): boolean {
  if (shownHere) return false
  try { if (sessionStorage.getItem(KEY) || localStorage.getItem(KEY) === today()) return false } catch { /* 저장소 없음 */ }
  return true
}
export function markShown() { shownHere = true; try { sessionStorage.setItem(KEY, '1') } catch { /* 무시 */ } }
const markToday = () => { try { localStorage.setItem(KEY, today()) } catch { /* 무시 */ } }

/** 답변이 없는 목 사용자용 예시 답 (Figma 765:3619 의 질문 2개) */
const FALLBACK = [
  { q: '요즘 가장 빠져 있는 건?', a: '주말마다 한강에 캠핑 의자 펴고 스케치해요' },
  { q: '같이 해보고 싶은 건?', a: '별 보러 가는 캠핑 같이 갈 사람 구해요!' },
]

/**
 * 탐색 – 친구 추천 C · 첫 진입 추천 모달 761:3795 + C-2 카드 눌렀을 때 답변 보기 765:3619 (2026-11-12)
 * "탐색에 처음 들어오거나 하루 한 번, 오늘의 이웃 3명을 모달로. 고르면 그 땅굴로 바로 이동"
 * 카드를 누르면 같은 자리에서 뒤집혀 질문 답변(질문 2개, 답변 2줄까지)이 보임. 카드 높이는 그대로
 */
export default function TodayNeighbors({ open, onClose }: { open: boolean; onClose: () => void }) {
  const me = USERS[ME_ID]
  const ranked = useMemo(() => Object.values(USERS)
    .filter((u) => u.id !== ME_ID)
    .map((u) => ({ u, shared: u.interests.filter((i) => me.interests.includes(i)) }))
    .sort((a, b) => b.shared.length - a.shared.length || b.u.interests.length - a.u.interests.length), [me.interests])
  const [page, setPage] = useState(0)
  const [flipped, setFlipped] = useState<string | null>(null)
  const [skip, setSkip] = useState(false)
  const pick = [0, 1, 2].map((i) => ranked[(page * 3 + i) % ranked.length])
  const close = () => { if (skip) markToday(); onClose() }

  return (
    <Modal open={open} onClose={close} width={720} labelledBy="today-title">
      <div className={s.today}>
        <h2 id="today-title" className="display">오늘의 이웃이 도착했어요</h2>
        <p className={s.todayLead}>관심사가 비슷한 SSAFY 친구 3명을 골라왔어요</p>
        <span className={s.todayTip}>카드를 누르면 이웃의 답변을 볼 수 있어요</span>
        <ul className={s.todayCards}>
          {pick.map(({ u, shared }) => (
            <li key={u.id}>
              <NeighborCard u={u} shared={shared} flipped={flipped === u.id} onFlip={(v) => setFlipped(v ? u.id : null)} onGo={() => { if (skip) markToday(); onClose() }} />
            </li>
          ))}
        </ul>
        <div className={s.todayFoot}>
          <label className={s.todaySkip}><input type="checkbox" checked={skip} onChange={(e) => setSkip(e.target.checked)} /> 오늘 하루 보지 않기</label>
          <button className={s.todayMore} onClick={() => { setPage((p) => p + 1); setFlipped(null) }}>↻ 다른 이웃 보기</button>
        </div>
      </div>
    </Modal>
  )
}

function NeighborCard({ u, shared, flipped, onFlip, onGo }: { u: User; shared: string[]; flipped: boolean; onFlip: (v: boolean) => void; onGo: () => void }) {
  const qna = (u.qna?.length ? u.qna : FALLBACK).slice(0, 2)
  const chips = [...shared, ...u.interests.filter((i) => !shared.includes(i))].slice(0, 3)
  return (
    <div className={flipped ? s.nCardBack : s.nCard} onClick={() => !flipped && onFlip(true)} role={flipped ? undefined : 'button'} tabIndex={flipped ? -1 : 0}
      onKeyDown={(e) => { if (!flipped && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onFlip(true) } }} aria-label={flipped ? undefined : `${u.nickname} 답변 보기`}>
      {flipped ? (
        <>
          <div className={s.nBackHead}><Avatar size={36} /><div><strong>{u.nickname}</strong><em>겹치는 관심사 {shared.length}개</em></div></div>
          <dl className={s.nQna}>
            {qna.map((x) => <div key={x.q}><dt>Q. {x.q}</dt><dd>{x.a}</dd></div>)}
          </dl>
          <button className={s.nBack} onClick={(e) => { e.stopPropagation(); onFlip(false) }}>← 프로필로 돌아가기</button>
        </>
      ) : (
        <>
          <Avatar size={72} />
          <strong className={s.nName}>{u.nickname}</strong>
          <span className={s.nAff}>{u.affiliation}</span>
          <em className={s.nOverlap}>겹치는 관심사 {shared.length}개</em>
          <span className={s.nChips}>
            {chips.map((t) => <span key={t} style={{ background: `var(--tone-${toneOf(t)}-bg)`, color: `var(--tone-${toneOf(t)}-fg)` }}>{shared.includes(t) && '✓ '}{t}</span>)}
          </span>
        </>
      )}
      <Link to={`/burrow/${u.id}`} className={`btn ${flipped ? 'btn-cta' : 'btn-line'} btn-block ${s.nGo}`} onClick={(e) => { e.stopPropagation(); onGo() }}>땅굴 방문하기</Link>
    </div>
  )
}
