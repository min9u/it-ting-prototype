import { useEffect, useRef, useState } from 'react'
import Avatar from '../../components/Avatar'
import Modal from '../../components/Modal'
import { ChevronLeft, CloseIcon, PlusIcon } from '../../components/Icons'
import { toneOf } from '../../data/mock'
import { MAX_PICK } from '../../data/interests'
import { ANSWER_MAX, ANSWER_MIN, answerOk, questionOf, questionTag, type Question } from '../../data/questions'
import { MIN_PICK, NICK_MAX } from '../../data/myBurrow'
import { errorText, isApiError, toastApiError } from '../../api'
import { useCampuses } from '../../api/common'
import { useCheckNickname, useInterestCatalog, useIntroQuestions } from '../../api/onboarding'
import { BURROW_ERRORS, campusFloorIdOf, toProfileUpdate, useUpdateProfile, type MyBurrowVM, type ProfileDraft } from '../../api/burrow'
import QuestionList from '../onboarding/QuestionList'
import InterestPickPage from './InterestPickPage'
import UnsavedDialog from './UnsavedDialog'
import s from './Burrow.module.css'
import m from './MyBurrow.module.css'

// 자기소개 최대 150자 (lib/validation.ts)
export { INTRO_MAX } from '../../lib/validation'
import { INTRO_MAX, clampText, lengthOf, nicknameCharsMessage } from '../../lib/validation'

/** 내 땅굴 값 → 수정 화면 값 */
const draftOf = (b: MyBurrowVM): ProfileDraft => ({
  nickname: b.nickname, intro: b.intro, campus: b.campus, floor: b.floor, interests: [...b.interests],
  qna: b.answers.map((a) => ({ qid: a.questionId, a: a.answer })),
})

/** 닉네임 칸 상태: 확인 안 함 · 확인 중 · 쓸 수 있음 · 오류 문구 */
type NickState = { kind: 'idle' } | { kind: 'checking' } | { kind: 'ok' } | { kind: 'bad'; text: string }

/**
 * 땅굴 – 내 정보 수정 (명세 04, 2026-11-22 API v1 맞춤). 오른쪽 내 정보 카드가 이 패널로 바뀜 (팝업 아님)
 * 1 닉네임: 온보딩 1과 같은 규칙(필수, 최대 12자). 바꾸면 잠깐 뒤 POST /nicknames/check → 겹치면 오류 문구, 저장 못 함
 * 2 기수 · 캠퍼스 · 층: 캠퍼스 · 층은 GET /campuses 목록에서. 캠퍼스를 바꾸면 층을 다시 고름. 기수는 SSAFY 인증 값이라 보여주기만. 반은 받지 않음
 * 5 자기소개: 최대 150자, 선택. 화면 순서는 Figma 1230:13568 에 맞춰 기수 · 캠퍼스 · 층 바로 아래, 관심사 위
 * 3 관심사: 3개 이상 최대 10개. ×로 빼고, "관심사 고르기"(GET /interest-categories)로 전체 분야에서 다시 고름
 * 4 질문 · 답변: 질문 옆 ↻ → 온보딩 3과 같은 질문 목록(GET /intro-questions)에서 다시 고름(그 자리 답변은 비워짐). 답변 10~50자
 * 6 취소 / 저장하기: PATCH /me/profile 에 다섯 값 모두 → 응답(바뀐 내 땅굴)으로 카드를 바로 바꿈. 바꾼 게 있는데 취소 · 뒤로 → 00 공통 18
 * 7 패널 · 스크롤: 가운데만 스크롤, 제목줄과 취소/저장하기는 고정
 * (두더지는 꾸미기 모드 · 두더지 탭에서 바꿈 — 명세 04 "서로 맞지 않아 보인 곳" 첫째 줄)
 */
export default function MyInfoEdit({ initial, focusIntro, onCancel, onSaved, onDirtyChange }: {
  initial: MyBurrowVM
  /** 바꾼 것이 있는지 (내 땅굴이 꾸미기로 넘어가기 전에 저장 전 확인을 띄우려고, 00 공통 18) */
  onDirtyChange?: (dirty: boolean) => void
  focusIntro?: boolean
  onCancel: () => void
  /** 저장 끝 (moved = 캠퍼스-층이 바뀌어 입구가 옮겨짐) */
  onSaved: (b: MyBurrowVM, moved: boolean) => void
}) {
  const [start] = useState(() => draftOf(initial))
  const [d, setD] = useState<ProfileDraft>(start)
  const [picking, setPicking] = useState(false)
  const [qSlot, setQSlot] = useState<number | null>(null)
  const [focusQ, setFocusQ] = useState<number | null>(null)
  const [ask, setAsk] = useState(false)
  const [nickState, setNickState] = useState<NickState>({ kind: 'idle' })
  const introRef = useRef<HTMLTextAreaElement>(null)
  const set = (p: Partial<ProfileDraft>) => setD((x) => ({ ...x, ...p }))

  const campuses = useCampuses()
  const catalog = useInterestCatalog()
  const questions = useIntroQuestions()
  const save = useUpdateProfile()
  const check = useCheckNickname()

  const nick = d.nickname.trim()
  const nickChanged = nick !== start.nickname.trim()
  // 닉네임을 바꾸면 잠깐 기다렸다가 확인 (명세 04 "닉네임을 바꿨을 때 POST /nicknames/check")
  const checkMut = check.mutate
  useEffect(() => {
    if (!nick || !nickChanged || nicknameCharsMessage(nick)) { setNickState({ kind: 'idle' }); return }
    setNickState({ kind: 'checking' })
    let alive = true
    const t = setTimeout(() => checkMut(nick, {
      onSuccess: () => { if (alive) setNickState({ kind: 'ok' }) },
      onError: (e) => { if (alive) setNickState(isApiError(e) && (e.code === 'NICKNAME_DUPLICATED' || e.code === 'INVALID_INPUT') ? { kind: 'bad', text: errorText(e, BURROW_ERRORS) } : { kind: 'idle' }) },
    }), 450)
    return () => { alive = false; clearTimeout(t) }
  }, [nick, nickChanged, checkMut])

  const charMsg = nicknameCharsMessage(nick)
  const nickMsg = !nick ? { bad: true, text: '닉네임을 입력해 주세요' }
    : charMsg ? { bad: true, text: charMsg }
    : nickState.kind === 'bad' ? { bad: true, text: nickState.text }
      : nickState.kind === 'checking' ? { bad: false, text: '확인하는 중…' }
        : nickState.kind === 'ok' ? { bad: false, text: '✓ 사용할 수 있는 닉네임이에요' } : null
  const campusList = campuses.data ?? []
  const floors = campusList.find((c) => c.name === d.campus)?.floors.map((f) => f.floor) ?? (d.campus === start.campus ? [start.floor] : [])
  const moved = d.campus !== start.campus || d.floor !== start.floor
  const qOk = d.qna.length === 3 && d.qna.every((x) => answerOk(x.a))
  const valid = !!nick && !charMsg && nickState.kind !== 'bad' && nickState.kind !== 'checking' && floors.includes(d.floor)
    && d.interests.length >= MIN_PICK && d.interests.length <= MAX_PICK && qOk && lengthOf(d.intro) <= INTRO_MAX
  const ready = !!catalog.data && !!campuses.data
  const dirty = JSON.stringify(d) !== JSON.stringify(start)
  const leave = () => (dirty ? setAsk(true) : onCancel())
  useEffect(() => { onDirtyChange?.(dirty) }, [dirty, onDirtyChange])
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange])

  // 질문: 받은 목록에서 찾고, 아직 못 받았으면 내 땅굴 응답의 문구로
  const qList = questions.data ?? []
  const qOf = (qid: string, i: number): Question | undefined =>
    questionOf(qid, qList) ?? (qid === initial.answers[i]?.questionId ? { id: qid, text: initial.answers[i].question, kind: 'tmi', ex: '' } : undefined)

  const submit = () => {
    if (!catalog.data) return
    const cf = campusFloorIdOf(campuses.data, d.campus, d.floor)
    if (!cf) { toastApiError(null, '캠퍼스 · 층을 다시 골라 주세요'); return }
    let body
    try { body = toProfileUpdate({ ...d, nickname: nick }, catalog.data, cf) } catch { toastApiError(null, '관심사를 다시 골라 주세요'); return }
    save.mutate(body, {
      onSuccess: (b) => onSaved(b, moved),
      onError: (e) => {
        if (isApiError(e) && e.code === 'NICKNAME_DUPLICATED') { setNickState({ kind: 'bad', text: errorText(e, BURROW_ERRORS) }); return }
        toastApiError(e, '저장하지 못했어요', BURROW_ERRORS)
      },
    })
  }

  return (
    <>
      <aside className={`${s.panel} ${m.editPanel}`} aria-label="내 정보 수정">
        <div className={m.editHead}>
          <h2 className="display"><button className={s.backBtn} onClick={leave} aria-label="뒤로"><ChevronLeft size={20} /></button>내 정보 수정</h2>
        </div>
        <div className={m.editScroll}>
          <div className={s.profile}>
            <Avatar size={64} empty />
            <p className={s.aff}>SSAFY {initial.gen ?? ''}기 · {d.campus} · {d.floor ? `${d.floor}층` : '층 선택'}</p>
          </div>

          <div className={m.field}>
            <label htmlFor="edit-nick">닉네임 <span>{d.nickname.length} / {NICK_MAX}</span></label>
            <input id="edit-nick" value={d.nickname} maxLength={NICK_MAX} aria-invalid={nickMsg?.bad} onChange={(e) => set({ nickname: e.target.value })} autoComplete="off" />
            {nickMsg && <small className={nickMsg.bad ? m.msgBad : m.msgOk} role={nickMsg.bad ? 'alert' : undefined}>{nickMsg.text}</small>}
          </div>

          <div className={m.field}>
            <div className={m.affRow}>
              <label>기수<input value={`${initial.gen ?? ''}기`} readOnly aria-readonly title="기수는 SSAFY 인증 값이라 바꿀 수 없어요" /></label>
              <label>캠퍼스
                <select value={d.campus} disabled={!campuses.data} onChange={(e) => set({ campus: e.target.value, floor: 0 })}>
                  {!campusList.some((c) => c.name === d.campus) && <option value={d.campus}>{d.campus}</option>}
                  {campusList.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </label>
              <label>층
                <select value={d.floor || ''} disabled={!campuses.data} onChange={(e) => set({ floor: Number(e.target.value) })} aria-invalid={!floors.includes(d.floor)}>
                  {!floors.includes(d.floor) && <option value="">층 선택</option>}
                  {floors.map((f) => <option key={f} value={f}>{f}층</option>)}
                </select>
              </label>
            </div>
            {!floors.includes(d.floor) && <small className={m.msgBad}>캠퍼스를 바꿨어요. 층을 다시 골라 주세요</small>}
            {moved && floors.includes(d.floor) && (
              <small className={m.msgInfo}>저장하면 이번 학기 들판에서 내 땅굴 입구가 {d.campus}-{d.floor}층으로 옮겨져요. 단골 · 방명록 · 대화는 그대로예요.</small>
            )}
          </div>

          <div className={m.field}>
            <label htmlFor="edit-intro">자기소개 <span>{lengthOf(d.intro)} / {INTRO_MAX}</span></label>
            <textarea id="edit-intro" ref={introRef} autoFocus={focusIntro} className={m.introArea} value={d.intro} onChange={(e) => set({ intro: clampText(e.target.value, INTRO_MAX) })} placeholder="나를 소개하는 말을 적어 주세요. (선택)" />
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
            <button className={s.dashedBtn} onClick={() => setPicking(true)} disabled={!catalog.data}><PlusIcon size={14} /> 관심사 고르기</button>
            {d.interests.length < MIN_PICK && <small className={m.msgBad}>관심사는 {MIN_PICK}개 이상 골라 주세요</small>}
            <small className={m.note}>관심사를 바꾸면 땅굴 가구도 함께 바뀌어요. 맨 앞 관심사가 땅굴 무드를 정해요.</small>
          </div>

          <div className={m.field}>
            <span className={m.label}>질문 · 답변 <span>질문은 몇 번이든 바꿀 수 있어요</span></span>
            {d.qna.map((x, i) => {
              const q = qOf(x.qid, i)
              const short = x.a.trim().length > 0 && lengthOf(x.a.trim()) < ANSWER_MIN
              return (
                <div key={i} className={m.qaItem}>
                  <div className={m.qaQ}>
                    <Avatar size={24} empty />
                    <p><small>{q && q.ex ? questionTag(q) : ''}</small>{q?.text}</p>
                    <button onClick={() => setQSlot(i)} disabled={!questions.data} aria-label={`Q${i + 1} 질문 바꾸기`} title="질문 바꾸기">↻</button>
                  </div>
                  <textarea className={m.qaA} value={x.a} placeholder={q?.ex ? `예) ${q.ex}` : ''} aria-label={`Q${i + 1} 답변`}
                    onFocus={() => setFocusQ(i)} onBlur={() => setFocusQ(null)}
                    onChange={(e) => set({ qna: d.qna.map((y, j) => (j === i ? { ...y, a: clampText(e.target.value, ANSWER_MAX) } : y)) })} />
                  {focusQ === i && <span className={m.qaCount}>{lengthOf(x.a)} / {ANSWER_MAX}</span>}
                  {(short || !x.a.trim()) && focusQ !== i && <small className={m.msgBad}>{ANSWER_MIN}자 이상 답해 주세요</small>}
                </div>
              )
            })}
          </div>
        </div>

        <div className={m.editActions}>
          <button className="btn btn-line" onClick={leave}>취소</button>
          <button className="btn btn-cta" disabled={!valid || !ready || save.isPending} aria-busy={save.isPending} onClick={submit}>{save.isPending ? '저장하는 중…' : '저장하기'}</button>
        </div>
      </aside>

      {picking && catalog.data && (
        <InterestPickPage categories={catalog.data.categories} initial={d.interests} onCancel={() => setPicking(false)} onDone={(list) => { set({ interests: list }); setPicking(false) }} />
      )}

      <Modal open={qSlot !== null} onClose={() => setQSlot(null)} width={560} labelledBy="q-swap-title">
        <div className={m.qModal}>
          <h2 id="q-swap-title" className="display">Q{(qSlot ?? 0) + 1} 질문 바꾸기</h2>
          <p>새 질문을 고르면 내 정보 수정으로 돌아가고, 그 자리 답변은 비워져요.</p>
          {qSlot !== null && (
            <QuestionList questions={qList} compact picks={d.interests} max={1} selected={d.qna.map((y) => y.qid)}
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
