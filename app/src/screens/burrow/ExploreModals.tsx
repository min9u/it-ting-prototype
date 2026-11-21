import { useEffect, useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import Modal from '../../components/Modal'
import Avatar from '../../components/Avatar'
import { EmptyMole } from '../../components/Feedback'
import { toneOf } from '../../data/mock'
import { migrateInterests } from '../../data/interests'
import {
  CAMPUS_FLOORS, CURRENT_TERM, MY_FLOOR, MY_PAST_FLOORS, RECOMMEND_QUESTIONS, affOf, drawRecommendations, fieldOf, fieldUserOf, floorId, floorLabel,
  getRecommendSettings, getRegulars, me, setRecommendSettings, setRegular, shortAffOf, subscribeRegulars, todaysPicks, type Floor, type RecommendSettings,
} from '../../data/field'
import { campusesInOrder } from '../../data/campusFloors'
import type { User } from '../../data/types'
import x from './Explore.module.css'

/* ===================== 단골 땅굴 목록 (958:8917) ===================== */
/** 내가 단골로 추가한 땅굴. 놀러가기 = 방문자 뷰로 바로, 해제 = 목록에서 뺌 (상대에게 알리지 않음). 새 소식 표시는 없음 */
export function RegularsModal({ open, onClose, onRemoved }: { open: boolean; onClose: () => void; onRemoved: (nick: string) => void }) {
  const ids = useSyncExternalStore(subscribeRegulars, getRegulars)
  const users = ids.map((id) => fieldUserOf(id)).filter((u): u is User => !!u)
  return (
    <Modal open={open} onClose={onClose} width={480} labelledBy="regulars-title">
      <div className={x.modal}>
        <h2 id="regulars-title" className="display">단골 땅굴</h2>
        <p className={x.lead}>단골로 추가한 땅굴이에요. 놀러가기를 누르면 바로 이동해요.</p>
        {users.length ? (
          <ul className={x.regList}>
            {users.map((u) => (
              <li key={u.id}>
                <Avatar size={44} />
                <span className={x.regWho}><strong>{u.nickname}</strong><small>{shortAffOf(u)}</small></span>
                <Link to={`/burrow/${u.id}`} className={`btn btn-cta ${x.regGo}`} onClick={onClose}>놀러가기</Link>
                <button className={`btn btn-line ${x.regOff}`} onClick={() => { setRegular(u.id, false); onRemoved(u.nickname) }}>해제</button>
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

/* ===================== 오늘의 추천 친구 (787:3888 · 787:4348 · 787:4762) ===================== */
/**
 * 오늘 아직 안 받았으면 추천 친구 설정(조건 고르기) → 추천 받기 → 결과. 이미 받았으면 오늘 받은 3명.
 * 탐색에 들어올 때 자동으로 띄우지 않음 (02 F5 5번). 결과 화면에는 설정을 두지 않음
 */
export function RecommendModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [picks, setPicks] = useState<string[] | null>(null)
  useEffect(() => { if (open) setPicks(todaysPicks()) }, [open])
  return (
    <Modal open={open} onClose={onClose} width={720} labelledBy="rec-title">
      {picks ? <RecommendResult ids={picks} onGo={onClose} /> : <RecommendSettingsView onDraw={() => setPicks(drawRecommendations())} />}
    </Modal>
  )
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" className={on ? x.optOn : x.opt} aria-pressed={on} onClick={onClick}>{on && '✓ '}{children}</button>
}

function RecommendSettingsView({ onDraw }: { onDraw: () => void }) {
  // 2026-11-18 전에 저장된 설정은 예전 관심사 이름(시티팝 …)일 수 있어서 새 이름으로 옮겨서 보여 줌 (data/interests migrateInterests)
  const [st, setSt] = useState<RecommendSettings>(() => { const s = getRecommendSettings(); return { ...s, interests: migrateInterests(s.interests) } })
  const [qOpen, setQOpen] = useState(false)
  const set = (p: Partial<RecommendSettings>) => { const v = { ...st, ...p }; setSt(v); setRecommendSettings(v) }
  const myInt = me().interests
  return (
    <div className={x.modal}>
      <h2 id="rec-title" className="display">오늘의 추천 친구</h2>
      <p className={x.lead}>추천 조건을 정하고 오늘의 친구 3명을 받아 보세요</p>
      <section className={x.recBox} aria-label="추천 친구 설정">
        <h3 className="display">추천 친구 설정</h3>
        <div className={x.recRow}>
          <span>관심사</span>
          <div className={x.opts}>
            {myInt.map((i) => <Toggle key={i} on={st.interests.includes(i)} onClick={() => set({ interests: st.interests.includes(i) ? st.interests.filter((v) => v !== i) : [...st.interests, i] })}>{i}</Toggle>)}
          </div>
        </div>
        <div className={x.recRow}>
          <span>답이 궁금한 질문</span>
          <div className={x.opts}>
            {st.question && <Toggle on onClick={() => set({ question: null })}>Q. {st.question}</Toggle>}
            <button type="button" className={x.addQ} onClick={() => setQOpen((v) => !v)} aria-expanded={qOpen}>+ 질문 고르기</button>
            {qOpen && (
              <ul className={x.qList}>
                {RECOMMEND_QUESTIONS.map((q) => (
                  <li key={q}><button type="button" className={q === st.question ? x.qOn : undefined} onClick={() => { set({ question: q }); setQOpen(false) }}>Q. {q}</button></li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className={x.recRow}>
          <span>같은 질문에 답한 사람</span>
          <div className={x.opts}><Toggle on={st.sameQuestionFirst} onClick={() => set({ sameQuestionFirst: !st.sameQuestionFirst })}>우선 추천</Toggle></div>
        </div>
        <div className={x.recRow}>
          <span>캠퍼스·기수·층</span>
          <div className={x.opts}>
            <Toggle on={st.sameCampus} onClick={() => set({ sameCampus: !st.sameCampus })}>같은 캠퍼스</Toggle>
            <Toggle on={st.sameGen} onClick={() => set({ sameGen: !st.sameGen })}>같은 기수</Toggle>
            <Toggle on={st.sameFloor} onClick={() => set({ sameFloor: !st.sameFloor })}>같은 층</Toggle>
          </div>
        </div>
        <p className={x.recNote}>조건은 걸러 내는 게 아니라 우선순위예요. 많이 맞는 사람부터 고르고, 모자라면 덜 맞는 사람으로 채워요.</p>
      </section>
      <div className={x.recFoot}>
        <span>추천은 하루 한 번 받을 수 있어요</span>
        <button className="btn btn-cta" onClick={onDraw}>추천 받기</button>
      </div>
    </div>
  )
}

function RecommendResult({ ids, onGo }: { ids: string[]; onGo: () => void }) {
  const [flipped, setFlipped] = useState<string | null>(null)
  const users = ids.map((id) => fieldUserOf(id)).filter((u): u is User => !!u)
  const mine = me().interests
  return (
    <div className={x.modal}>
      <h2 id="rec-title" className="display">오늘의 추천 친구가 도착했어요</h2>
      <p className={x.lead}>추천 친구 설정에 맞는 SSAFY 친구 {users.length}명을 골라왔어요</p>
      {users.length ? (
        <ul className={x.recCards}>
          {users.map((u) => {
            const shared = u.interests.filter((i) => mine.includes(i))
            const chips = [...shared, ...u.interests.filter((i) => !shared.includes(i))].slice(0, 3)
            const back = flipped === u.id
            return (
              <li key={u.id} className={back ? x.cardBack : x.card}>
                {back ? (
                  <>
                    <div className={x.backHead}><Avatar size={36} /><div><strong>{u.nickname}</strong><em>겹치는 관심사 {shared.length}개</em></div></div>
                    <dl className={x.backQna}>{(u.qna ?? []).slice(0, 3).map((q) => <div key={q.q}><dt>{q.q}</dt><dd>{q.a}</dd></div>)}</dl>
                    <button className={x.backBtn} onClick={() => setFlipped(null)}>← 프로필로 돌아가기</button>
                  </>
                ) : (
                  <button className={x.cardFront} onClick={() => setFlipped(u.id)} aria-label={`${u.nickname} 답변 보기`}>
                    <span className={x.fold} aria-hidden />
                    <Avatar size={68} />
                    <strong>{u.nickname}</strong>
                    <small>{affOf(u)}</small>
                    <span className={x.cardChips}>
                      {chips.map((t) => (
                        <span key={t} style={{ background: `var(--tone-${toneOf(t)}-bg)`, color: `var(--tone-${toneOf(t)}-fg)` }}>{shared.includes(t) && '✓ '}{t}</span>
                      ))}
                    </span>
                  </button>
                )}
                <Link to={`/burrow/${u.id}`} className={`btn ${back ? 'btn-cta' : 'btn-line'} btn-block ${x.cardGo}`} onClick={onGo}>땅굴 방문하기</Link>
              </li>
            )
          })}
        </ul>
      ) : (
        <EmptyMole message="조건에 맞는 친구를 찾지 못했어요." />
      )}
      <p className={x.recNext}>내일 새로운 추천 친구를 받을 수 있어요</p>
    </div>
  )
}

/* ===================== 캠퍼스-층 고르기 (00 공통 19) ===================== */
/**
 * 정해진 목록에서 고름 (직접 입력 없음, 캠퍼스마다 층 목록이 다름). 학기는 이번 학기 + 내가 땅굴이 있던 지난 학기.
 * 다른 들판에도 누구나 들어갈 수 있음 (기수로는 나누지 않음). 사다리를 눌러도 열림
 */
export function FloorPickerModal({ open, current, onClose, onPick }: { open: boolean; current: Floor; onClose: () => void; onPick: (f: Floor) => void }) {
  const terms = [CURRENT_TERM, ...new Set(MY_PAST_FLOORS.map((f) => f.term))]
  const [term, setTerm] = useState(current.term)
  const [campus, setCampus] = useState(current.campus)
  useEffect(() => { if (open) { setTerm(current.term); setCampus(current.campus) } }, [open, current.term, current.campus])
  const floors = CAMPUS_FLOORS.find((c) => c.campus === campus)?.floors ?? []
  return (
    <Modal open={open} onClose={onClose} width={520} labelledBy="floor-title">
      <div className={x.modal}>
        <h2 id="floor-title" className="display">어느 들판으로 갈까요?</h2>
        <p className={x.lead}>캠퍼스와 층을 고르면 그 들판으로 이동해요. 다른 들판에도 누구나 놀러 갈 수 있어요.</p>
        <div className={x.seg} role="tablist" aria-label="학기">
          {terms.map((t) => <button key={t} role="tab" aria-selected={t === term} className={t === term ? x.segOn : x.segBtn} onClick={() => setTerm(t)}>{t}{t === CURRENT_TERM && ' (이번 학기)'}</button>)}
        </div>
        <p className={x.pickLabel}>캠퍼스</p>
        <div className={x.opts}>
          {campusesInOrder().map((c) => <button key={c.campus} type="button" className={c.campus === campus ? x.optOn : x.opt} onClick={() => setCampus(c.campus)}>{c.campus}</button>)}
        </div>
        <p className={x.pickLabel}>층</p>
        <ul className={x.floorList}>
          {floors.map((fl) => {
            const f: Floor = { id: floorId(term, campus, fl), term, campus, floor: fl }
            const n = fieldOf(f).residents.length
            const isMine = f.id === MY_FLOOR.id || MY_PAST_FLOORS.some((p) => p.id === f.id)
            const here = f.id === current.id
            return (
              <li key={fl}>
                <button className={here ? x.floorOn : x.floorBtn} onClick={() => onPick(f)} disabled={here}>
                  <strong>{floorLabel(f)}</strong>
                  <small>땅굴 {n}개{isMine && ' · 내 땅굴 있음'}{here && ' · 지금 여기'}</small>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </Modal>
  )
}
