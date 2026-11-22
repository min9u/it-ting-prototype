import { useState } from 'react'
import { interestQuestions, questionTag, recommendedQuestions, tmiQuestions, type Question } from '../../data/questions'
import s from './QuestionList.module.css'

/**
 * 질문 목록 (02 F3 온보딩 3 · 2번, F4 내 정보 수정 "질문 바꾸기"가 같은 목록을 씀)
 * - 필터 추천 · 관심사 · TMI. 추천 = 내 관심사 대분류 질문 2개 + TMI 1개 (모자라면 TMI)
 * - 고른 질문은 "골랐어요", 아니면 "+ 고르기". max 개를 고르면 나머지는 못 고름(먼저 빼야 함)
 * - questions: GET /intro-questions 로 받은 목록 (api/onboarding useIntroQuestions). 추천은 서버가 주지 않고 이 목록에서 고름 (명세 03 "추천 질문")
 */
type Filter = 'rec' | 'interest' | 'tmi'
const FILTERS: [Filter, string][] = [['rec', '추천'], ['interest', '관심사'], ['tmi', 'TMI']]

export default function QuestionList({ questions, picks, selected, max, onToggle, note, compact }: {
  questions: Question[]
  picks: string[]
  selected: string[]
  max: number
  onToggle: (q: Question) => void
  /** 목록 아래 한 줄 */
  note?: string
  compact?: boolean
}) {
  const [filter, setFilter] = useState<Filter>('rec')
  const list = filter === 'rec' ? recommendedQuestions(picks, questions) : filter === 'interest' ? interestQuestions(picks, questions) : tmiQuestions(questions)
  const full = selected.length >= max
  return (
    <div className={compact ? `${s.wrap} ${s.compact}` : s.wrap}>
      <div className={s.head}>
        <strong>질문 목록</strong>
        <div className={s.filters} role="tablist" aria-label="질문 종류">
          {FILTERS.map(([k, label]) => (
            <button key={k} role="tab" aria-selected={filter === k} className={filter === k ? s.filterOn : s.filter} onClick={() => setFilter(k)}>{label}</button>
          ))}
        </div>
      </div>
      <ul className={s.list}>
        {list.length === 0 && <li className={s.empty}>고른 관심사에 딸린 질문이 없어요. TMI 질문을 골라 보세요.</li>}
        {list.map((q) => {
          const on = selected.includes(q.id)
          const off = !on && full && max > 1
          return (
            <li key={q.id}>
              <button className={on ? s.rowOn : off ? `${s.row} ${s.rowOff}` : s.row} aria-pressed={on} onClick={() => onToggle(q)} disabled={off}>
                <span className={q.kind === 'tmi' ? s.tagTmi : s.tag}>{questionTag(q)}</span>
                <span className={s.text}>{q.text}</span>
                <span className={on ? s.stateOn : s.state}>{on ? '✓ 골랐어요' : '+ 고르기'}</span>
              </button>
            </li>
          )
        })}
      </ul>
      {note && <p className={s.note}>{note}</p>}
    </div>
  )
}
