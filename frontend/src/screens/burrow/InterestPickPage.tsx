import { useEffect, useRef, useState } from 'react'
import { toneOf } from '../../data/mock'
import type { Category } from '../../data/types'
import { MAX_PICK } from '../../data/interests'
import { MIN_PICK } from '../../data/myBurrow'
import { ChevronLeft, ChevronRight, CloseIcon } from '../../components/Icons'
import UnsavedDialog from './UnsavedDialog'
import m from './MyBurrow.module.css'

/**
 * 땅굴 – 내 정보 수정 · 관심사 고르기 (02 F4, 2026-11-16)
 * - 왼쪽 분야 12개(2026-11-18 확정본), 고르면 오른쪽에 그 분야 관심사 태그. 눌러서 고르거나 뺌. 3개 이상, 최대 10개
 * - 내 정보 수정의 관심사(아직 저장 전 값)가 선택된 채로 열림. 아래 "선택한 관심사"에 모이고 ×로 바로 뺌
 * - 10개를 채운 상태에서 더 고르면 안내 3초 (온보딩 2와 같음)
 * - 고르기 완료: 3개 이상일 때, 내 정보 수정으로 돌아가 칩에 반영 (실제 저장은 내 정보 수정의 "저장하기")
 * - 취소 · "‹ 내 정보 수정으로": 바꾼 게 있으면 00 공통 18 저장 전 취소를 먼저
 * - categories: GET /interest-categories 로 받은 목록 (api/onboarding useInterestCatalog). 칩 옆 숫자 = 고른 사람 수(userCount)
 */
export default function InterestPickPage({ categories: CATEGORIES, initial, onDone, onCancel }: { categories: Category[]; initial: string[]; onDone: (list: string[]) => void; onCancel: () => void }) {
  const [picks, setPicks] = useState(initial)
  const [catId, setCatId] = useState(() => CATEGORIES.find((c) => c.tags.some((t) => initial.includes(t.name)))?.id ?? CATEGORIES[0].id)
  const [overMsg, setOverMsg] = useState(false)
  const [ask, setAsk] = useState(false)
  const timer = useRef(0)
  useEffect(() => () => clearTimeout(timer.current), [])
  const cat = CATEGORIES.find((c) => c.id === catId) ?? CATEGORIES[0]
  const full = picks.length >= MAX_PICK
  const dirty = picks.join('|') !== initial.join('|')
  const toggle = (t: string) => {
    if (picks.includes(t)) { setPicks(picks.filter((x) => x !== t)); setOverMsg(false); return }
    if (full) { setOverMsg(true); clearTimeout(timer.current); timer.current = window.setTimeout(() => setOverMsg(false), 3000); return }
    setPicks([...picks, t])
  }
  const leave = () => (dirty ? setAsk(true) : onCancel())

  return (
    <section className={m.pickPage} aria-labelledby="pick-title">
      <div className={m.pickInner}>
        <button className={m.pickBack} onClick={leave}><ChevronLeft size={16} /> 내 정보 수정으로</button>
        <h1 id="pick-title" className={`display ${m.pickTitle}`}>관심사 고르기</h1>
        <p className={m.pickCount}>{picks.length}개 선택 · <span className={full ? m.limitOn : undefined}>최대 {MAX_PICK}개</span></p>

        <div className={m.pickBox}>
          <nav className={m.pickCats} aria-label="관심 분야">
            {CATEGORIES.map((c) => {
              const n = c.tags.filter((t) => picks.includes(t.name)).length
              return (
                <button key={c.id} className={c.id === catId ? m.pickCatOn : m.pickCat} aria-current={c.id === catId ? 'true' : undefined} onClick={() => setCatId(c.id)}>
                  {c.name.replace(/\s·\s/g, '·')}
                  {n > 0 ? <em>{n}개</em> : <ChevronRight size={14} />}
                </button>
              )
            })}
          </nav>
          <div className={m.pickPanel}>
            <h2 className="display">{cat.name.replace(/\s·\s/g, '·')}</h2>
            <div className={m.pickTags}>
              {cat.tags.map((t) => {
                const on = picks.includes(t.name)
                return (
                  <button key={t.name} className={on ? m.pickTagOn : full ? `${m.pickTag} ${m.pickTagDim}` : m.pickTag} aria-pressed={on} onClick={() => toggle(t.name)}>
                    {on && '✓ '}{t.name}<small>{t.count.toLocaleString()}</small>
                  </button>
                )
              })}
            </div>
            <div className={m.pickTray}>
              <p>선택한 관심사 <b>{picks.length}</b> · <span className={full ? m.limitOn : undefined}>최대 {MAX_PICK}개</span>
                {picks.length < MIN_PICK && <span className={m.warn}> · {MIN_PICK}개 이상 골라 주세요</span>}</p>
              <div className={m.trayChips}>
                {picks.map((t) => (
                  <button key={t} style={{ background: `var(--tone-${toneOf(t)}-bg)`, color: `var(--tone-${toneOf(t)}-fg)` }} onClick={() => toggle(t)} aria-label={`${t} 빼기`}>
                    {t} <CloseIcon size={11} />
                  </button>
                ))}
              </div>
              {overMsg && <p className={m.overToast} role="status">관심사는 최대 {MAX_PICK}개까지 고를 수 있어요. 다른 관심사를 빼고 골라 주세요.</p>}
            </div>
          </div>
        </div>

        <div className={m.pickFoot}>
          <p>고르기 완료를 누르면 내 정보 수정으로 돌아가요. 저장을 눌러야 반영돼요.</p>
          <div>
            <button className="btn btn-line" onClick={leave}>취소</button>
            <button className="btn btn-cta" disabled={picks.length < MIN_PICK} onClick={() => onDone(picks)}>고르기 완료</button>
          </div>
        </div>
      </div>
      <UnsavedDialog open={ask} onStay={() => setAsk(false)} onLeave={() => { setAsk(false); onCancel() }} />
    </section>
  )
}
