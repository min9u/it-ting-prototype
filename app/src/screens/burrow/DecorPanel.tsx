import { useEffect, useMemo, useState } from 'react'
import MoleDresser from '../../components/MoleDresser'
import { CloseIcon } from '../../components/Icons'
import { subOf, toSubIds } from '../../data/interests'
import { BLOCK_COLORS } from '../../data/roomPlan'
import { wordsOfSub, type WordDef } from '../../data/interestWords'
import { wordChoices, type FurnChoice } from '../../data/myBurrow'
import UnsavedDialog from './UnsavedDialog'
import s from './Burrow.module.css'
import m from './MyBurrow.module.css'

export type DecorTab = 'furniture' | 'mole'

/**
 * 땅굴 – 꾸미기 모드 · 가구 탭 / 두더지 탭 (명세 04, KAN-40 2026-11-22)
 * 가구 탭: 세부 관심사마다 방에 놓일 가구를 고른다 ("/"로 묶인 관심사 = 단어 가운데 하나, 처음 값 = 맨 앞 단어. 90개 중 57개)
 *  1 세부 관심사 칩: 고를 수 있는 내 관심사만(한 단어뿐인 33개는 가구 고정이라 안 나옴). 누르면 그 관심사의 단어 후보
 *  2 "○○ 가구 고르기 · n개 중 1개": 단어마다 가구 카드(썸네일 + 이름) 하나, 고르면 선택 표시 + 땅굴 안에 바로 놓임
 *     지금 고르는 가구는 땅굴 위에 점선 + "관심사 · 가구 이름"으로 가리킴 (RoomView highlight)
 * 두더지 탭: 지금 착용 중 / 부위 탭 / 부위마다 하나("없음"이면 벗기), 고르면 땅굴 안 두더지에 바로 보임
 * 취소 · ×: 들어오기 전 모습으로 (바꾼 게 있으면 00 공통 18) / 저장하기: 바뀐 것만 저장 → 내 땅굴로 + 완료 토스트
 * (옛 "색" 탭은 명세에 없어 되살리지 않음. 가구 단어는 서버 명세에 저장 API 가 없어 목 서버에만 저장됨 — api/burrow/PENDING)
 */
export default function DecorPanel({ tab, setTab, picks, worn, setWorn, furn, setFurn, focusSub, setFocusSub, dirty, saving, onCancel, onSave }: {
  tab: DecorTab; setTab: (t: DecorTab) => void
  /** 내 관심사 (고른 순서, 이름) */
  picks: string[]
  worn: string[]; setWorn: (w: string[]) => void
  furn: FurnChoice; setFurn: (f: FurnChoice) => void
  focusSub: string | null; setFocusSub: (id: string | null) => void
  dirty: boolean
  saving?: boolean
  onCancel: () => void; onSave: () => void
}) {
  const [ask, setAsk] = useState(false)
  const leave = () => (dirty ? setAsk(true) : onCancel())
  return (
    <aside className={`${s.panel} ${s.formPanel}`} aria-label="땅굴 꾸미기">
      <div className={s.panelHead}>
        <h2 className="display">땅굴 꾸미기</h2>
        <button className={s.closeBtn} onClick={leave} aria-label="꾸미기 닫기"><CloseIcon size={18} /></button>
      </div>
      <div className={s.segment} role="tablist" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        <button role="tab" aria-selected={tab === 'furniture'} className={tab === 'furniture' ? s.segOn : s.seg} onClick={() => setTab('furniture')}>가구</button>
        <button role="tab" aria-selected={tab === 'mole'} className={tab === 'mole' ? s.segOn : s.seg} onClick={() => setTab('mole')}>두더지</button>
      </div>
      <div className={s.decorBody}>
        {tab === 'mole' ? (
          <MoleDresser worn={worn} onChange={setWorn} compact />
        ) : (
          <FurnitureTab picks={picks} furn={furn} setFurn={setFurn} focusSub={focusSub} setFocusSub={setFocusSub} />
        )}
      </div>
      <div className={s.panelActions}>
        <button className="btn btn-line" onClick={leave}>취소</button>
        <button className="btn btn-cta" onClick={onSave} disabled={saving} aria-busy={saving}>{saving ? '저장하는 중…' : '저장하기'}</button>
      </div>
      <UnsavedDialog open={ask} onStay={() => setAsk(false)} onLeave={() => { setAsk(false); onCancel() }} />
    </aside>
  )
}

/** 가구 카드 썸네일 (assets/prop-thumbs/<모델 노드>.webp, 없으면 단어 글자 카드) */
const THUMBS = import.meta.glob('../../assets/prop-thumbs/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const thumbOf = (node: string) => THUMBS[`../../assets/prop-thumbs/${node}.webp`]

function FurnitureTab({ picks, furn, setFurn, focusSub, setFocusSub }: { picks: string[]; furn: FurnChoice; setFurn: (f: FurnChoice) => void; focusSub: string | null; setFocusSub: (id: string | null) => void }) {
  const subs = useMemo(() => toSubIds(picks).filter((id) => wordChoices(id).length > 0), [picks])
  const cur = focusSub && subs.includes(focusSub) ? focusSub : subs[0] ?? null
  // 꾸미기를 열면 첫 칩의 가구를 방에서 가리키게 (highlight 는 focusSub 로 정해짐)
  useEffect(() => { if (cur && focusSub !== cur) setFocusSub(cur) }, [cur, focusSub, setFocusSub])
  const sub = cur ? subOf(cur) : undefined
  const words: WordDef[] = (cur ? wordsOfSub(cur)?.words : undefined) ?? []
  const chosen = cur ? words.find((w) => w.word === furn[cur])?.word ?? words[0]?.word : undefined
  const pickWord = (word: string) => {
    if (!cur) return
    const next = { ...furn }
    if (word === words[0]?.word) delete next[cur]; else next[cur] = word
    setFurn(next)
  }
  return (
    <div className={s.furnTab}>
      <p className={s.furnInfo}>ⓘ "/"로 묶인 관심사마다 가구를 하나씩 골라요.<br />관심사를 바꾸면 가구도 자동으로 바뀌어요.</p>
      {subs.length === 0 ? <p className={s.formNote}>고를 수 있는 가구가 없어요. "/"로 묶인 관심사(예: 카페/커피)를 고르면 가구를 고를 수 있어요.</p> : (
        <>
          <div className={s.furnCats} role="tablist" aria-label="가구를 고를 수 있는 내 관심사">
            {subs.map((id) => (
              <button key={id} role="tab" aria-selected={id === cur} className={id === cur ? s.furnCatOn : s.furnCat} onClick={() => setFocusSub(id)}>{subOf(id)?.name_ko}</button>
            ))}
          </div>
          <p className={s.furnHead}><strong>{sub?.name_ko} 가구 고르기</strong><span>{words.length}개 중 1개</span></p>
          <ul className={s.furnGrid}>
            {words.map((w, i) => {
              const on = chosen === w.word
              const src = thumbOf(w.node)
              return (
                <li key={w.word}>
                  <button className={on ? s.furnCardOn : s.furnCard} aria-pressed={on} onClick={() => pickWord(w.word)}>
                    {i === 0 && <em className={m.furnBase}>기본</em>}
                    {src
                      ? <img className={s.furnThumb} src={src} alt="" aria-hidden style={{ objectFit: 'contain', borderRadius: 0, boxShadow: 'none' }} />
                      : <span className={s.furnThumb} style={{ background: BLOCK_COLORS[sub?.category ?? ''] ?? '#F7E6C8', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-display)', fontSize: 13, lineHeight: 1.1, textAlign: 'center', wordBreak: 'keep-all', color: 'rgba(62,42,31,.55)' }} aria-hidden>{w.word}</span>}
                    {w.name}
                  </button>
                </li>
              )
            })}
          </ul>
          <p className={s.formNote}>가구 자리는 정해져 있어서 옮기거나 뺄 수 없어요.</p>
        </>
      )}
    </div>
  )
}
