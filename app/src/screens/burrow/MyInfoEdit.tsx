import { useRef, useState } from 'react'
import Avatar from '../../components/Avatar'
import Modal from '../../components/Modal'
import { ChevronLeft, CloseIcon, PlusIcon } from '../../components/Icons'
import { toneOf } from '../../data/mock'
import { MAX_PICK } from '../../data/interests'
import { CAMPUS_FLOORS, ME_HOME } from '../../data/field'
import { ANSWER_MAX, ANSWER_MIN, answerOk, questionOf, questionTag } from '../../data/questions'
import { MIN_PICK, NICK_MAX, myAffiliation, nickTaken, type MyProfile } from '../../data/myBurrow'
import QuestionList from '../onboarding/QuestionList'
import InterestPickPage from './InterestPickPage'
import UnsavedDialog from './UnsavedDialog'
import s from './Burrow.module.css'
import m from './MyBurrow.module.css'

// 자기소개 최대 150자 (lib/validation.ts, ERD member_profile.intro VARCHAR(150))
export { INTRO_MAX } from '../../lib/validation'
import { INTRO_MAX } from '../../lib/validation'
export interface EditDraft extends MyProfile { interests: string[] }

/**
 * 땅굴 – 내 정보 수정 (02 F4, 2026-11-16 명세 기준). 오른쪽 내 정보 카드가 이 패널로 바뀜 (팝업 아님)
 * 1 닉네임: 온보딩 1과 같은 규칙(필수, 최대 12자). 다른 사람과 겹치면 오류 문구, 저장 못 함
 * 2 기수 · 캠퍼스 · 층: 캠퍼스·층은 정해진 목록에서(00 공통 19). 캠퍼스를 바꾸면 층을 다시 고름. 기수는 SSAFY 인증 값이라 보여주기만. 반은 받지 않음
 * 3 관심사: 3개 이상 최대 10개. ×로 빼고, "관심사 고르기"로 전체 분야에서 다시 고름(관심사 고르기 화면)
 * 4 질문 · 답변: 질문 옆 ↻ → 온보딩 3과 같은 질문 목록에서 다시 고름(그 자리 답변은 비워짐). 횟수 제한 없음. 답변 10~50자, 글자 수는 입력 중인 답변에만
 * 5 자기소개: 최대 150자, 선택
 * 6 취소 / 저장하기: 필수 조건을 못 채우면 저장 못 함. 바꾼 게 있는데 취소·뒤로 → 00 공통 18
 * 7 패널 · 스크롤: 항목이 패널 높이를 넘으면 가운데만 스크롤, 제목줄과 취소/저장하기는 고정
 */
export default function MyInfoEdit({ initial, focusIntro, onCancel, onSave }: {
  initial: EditDraft
  focusIntro?: boolean
  onCancel: () => void
  onSave: (d: EditDraft) => void
}) {
  const [d, setD] = useState<EditDraft>(initial)
  const [picking, setPicking] = useState(false)
  const [qSlot, setQSlot] = useState<number | null>(null)
  const [focusQ, setFocusQ] = useState<number | null>(null)
  const [ask, setAsk] = useState(false)
  const introRef = useRef<HTMLTextAreaElement>(null)
  const set = (p: Partial<EditDraft>) => setD((x) => ({ ...x, ...p }))

  const nick = d.nickname.trim()
  const taken = nickTaken(nick, initial.nickname)
  const nickMsg = !nick ? { bad: true, text: '닉네임을 입력해 주세요' } : taken ? { bad: true, text: '이미 쓰고 있는 닉네임이에요. 다른 닉네임을 적어 주세요' } : nick !== initial.nickname.trim() ? { bad: false, text: '✓ 사용할 수 있는 닉네임이에요' } : null
  const floors = CAMPUS_FLOORS.find((c) => c.campus === d.campus)?.floors ?? []
  const moved = d.campus !== initial.campus || d.floor !== initial.floor
  const qOk = d.qna.length === 3 && d.qna.every((x) => answerOk(x.a))
  const valid = !!nick && !taken && floors.includes(d.floor) && d.interests.length >= MIN_PICK && d.interests.length <= MAX_PICK && qOk && d.intro.length <= INTRO_MAX
  const dirty = JSON.stringify(d) !== JSON.stringify(initial)
  const leave = () => (dirty ? setAsk(true) : onCancel())

  return (
    <>
      <aside className={`${s.panel} ${m.editPanel}`} aria-label="내 정보 수정">
        <div className={m.editHead}>
          <h2 className="display"><button className={s.backBtn} onClick={leave} aria-label="뒤로"><ChevronLeft size={20} /></button>내 정보 수정</h2>
        </div>
        <div className={m.editScroll}>
          <div className={s.profile}>
            <Avatar size={64} empty />
            <p className={s.aff}>{myAffiliation(d)}</p>
          </div>

          <div className={m.field}>
            <label htmlFor="edit-nick">닉네임 <span>{d.nickname.length} / {NICK_MAX}</span></label>
            <input id="edit-nick" value={d.nickname} maxLength={NICK_MAX} aria-invalid={nickMsg?.bad} onChange={(e) => set({ nickname: e.target.value })} autoComplete="off" />
            {nickMsg && <small className={nickMsg.bad ? m.msgBad : m.msgOk}>{nickMsg.text}</small>}
          </div>

          <div className={m.field}>
            <div className={m.affRow}>
              <label>기수<input value={`${ME_HOME.gen}기`} readOnly aria-readonly title="기수는 SSAFY 인증 값이라 바꿀 수 없어요" /></label>
              <label>캠퍼스
                <select value={d.campus} onChange={(e) => set({ campus: e.target.value, floor: 0 })}>
                  {CAMPUS_FLOORS.map((c) => <option key={c.campus} value={c.campus}>{c.campus}</option>)}
                </select>
              </label>
              <label>층
                <select value={d.floor || ''} onChange={(e) => set({ floor: Number(e.target.value) })} aria-invalid={!floors.includes(d.floor)}>
                  {!floors.includes(d.floor) && <option value="">층 선택</option>}
                  {floors.map((f) => <option key={f} value={f}>{f}층</option>)}
                </select>
              </label>
            </div>
            {!floors.includes(d.floor) && <small className={m.msgBad}>캠퍼스를 바꿨어요. 층을 다시 골라 주세요</small>}
            {moved && floors.includes(d.floor) && (
              <small className={m.msgInfo}>저장하면 이번 학기 들판에서 내 땅굴 입구가 {d.campus}-{d.floor}층으로 옮겨져요. 지난 학기 들판의 입구, 단골·방명록·대화는 그대로예요.</small>
            )}
          </div>

          <div className={m.field}>
            <span className={m.label}>관심사 <span className={d.interests.length >= MAX_PICK ? m.limitOn : undefined}>{d.interests.length} / {MAX_PICK} · 최대 {MAX_PICK}개</span></span>
            <div className={m.editChips}>
              {d.interests.map((t) => (
                <button key={t} style={{ background: `var(--tone-${toneOf(t)}-bg)`, color: `var(--tone-${toneOf(t)}-fg)` }} onClick={() => set({ interests: d.interests.filter((x) => x !== t) })} aria-label={`${t} 빼기`}>
                  {t} <CloseIcon size={11} />
                </button>
              ))}
            </div>
            <button className={s.dashedBtn} onClick={() => setPicking(true)}><PlusIcon size={14} /> 관심사 고르기</button>
            {d.interests.length < MIN_PICK && <small className={m.msgBad}>관심사는 {MIN_PICK}개 이상 골라 주세요</small>}
            <small className={m.note}>관심사를 바꾸면 땅굴 가구도 함께 바뀌어요.</small>
          </div>

          <div className={m.field}>
            <span className={m.label}>질문 · 답변 <span>질문은 몇 번이든 바꿀 수 있어요</span></span>
            {d.qna.map((x, i) => {
              const q = questionOf(x.qid)
              const short = x.a.trim().length > 0 && x.a.trim().length < ANSWER_MIN
              return (
                <div key={i} className={m.qaItem}>
                  <div className={m.qaQ}>
                    <Avatar size={24} empty />
                    <p><small>{q ? questionTag(q) : ''}</small>{q?.text}</p>
                    <button onClick={() => setQSlot(i)} aria-label={`Q${i + 1} 질문 바꾸기`} title="질문 바꾸기">↻</button>
                  </div>
                  <textarea className={m.qaA} value={x.a} maxLength={ANSWER_MAX} placeholder={q ? `예) ${q.ex}` : ''} aria-label={`Q${i + 1} 답변`}
                    onFocus={() => setFocusQ(i)} onBlur={() => setFocusQ(null)}
                    onChange={(e) => set({ qna: d.qna.map((y, j) => (j === i ? { ...y, a: e.target.value } : y)) })} />
                  {focusQ === i && <span className={m.qaCount}>{x.a.length} / {ANSWER_MAX}</span>}
                  {(short || !x.a.trim()) && focusQ !== i && <small className={m.msgBad}>{ANSWER_MIN}자 이상 답해 주세요</small>}
                </div>
              )
            })}
          </div>

          <div className={m.field}>
            <label htmlFor="edit-intro">자기소개 <span>{d.intro.length} / {INTRO_MAX}</span></label>
            <textarea id="edit-intro" ref={introRef} autoFocus={focusIntro} className={m.introArea} value={d.intro} maxLength={INTRO_MAX} onChange={(e) => set({ intro: e.target.value })} placeholder="나를 소개하는 말을 적어 주세요. (선택)" />
          </div>
        </div>

        <div className={m.editActions}>
          <button className="btn btn-line" onClick={leave}>취소</button>
          <button className="btn btn-cta" disabled={!valid} onClick={() => onSave({ ...d, nickname: nick })}>저장하기</button>
        </div>
      </aside>

      {picking && (
        <InterestPickPage initial={d.interests} onCancel={() => setPicking(false)} onDone={(list) => { set({ interests: list }); setPicking(false) }} />
      )}

      <Modal open={qSlot !== null} onClose={() => setQSlot(null)} width={560} labelledBy="q-swap-title">
        <div className={m.qModal}>
          <h2 id="q-swap-title" className="display">Q{(qSlot ?? 0) + 1} 질문 바꾸기</h2>
          <p>새 질문을 고르면 내 정보 수정으로 돌아가고, 그 자리 답변은 비워져요.</p>
          {qSlot !== null && (
            <QuestionList compact picks={d.interests} max={1} selected={d.qna.map((y) => y.qid)}
              onToggle={(q) => {
                if (q.id !== d.qna[qSlot].qid && !d.qna.some((y) => y.qid === q.id)) set({ qna: d.qna.map((y, j) => (j === qSlot ? { qid: q.id, a: '' } : y)) })
                setQSlot(null)
              }}
              note="다른 칸에서 이미 고른 질문은 고를 수 없어요." />
          )}
        </div>
      </Modal>

      <UnsavedDialog open={ask} onStay={() => setAsk(false)} onLeave={() => { setAsk(false); onCancel() }} />
    </>
  )
}
