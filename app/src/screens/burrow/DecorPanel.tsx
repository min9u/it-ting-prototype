import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { lookDiverse, subscribeLook } from '../../lib/roomLookLab'
import MoleDresser from '../../components/MoleDresser'
import { CloseIcon } from '../../components/Icons'
import { interestCatOf, subOf, toSubIds } from '../../data/interests'
import { BLOCK_COLORS } from '../../data/roomPlan'
import { placeWords } from '../../data/roomPlanV38'
import { wordsOfSub, type WordDef } from '../../data/interestWords'
import { leadCategory, wordChoices, type FurnChoice } from '../../data/myBurrow'
import { CATEGORY_THEMES, categoryTheme } from '../../data/roomStyle'
import UnsavedDialog from './UnsavedDialog'
import s from './Burrow.module.css'
import m from './MyBurrow.module.css'

export type DecorTab = 'furniture' | 'mole' | 'color'

/**
 * 땅굴 – 꾸미기 모드 (02 F4 · 가구 탭 / 두더지 탭, 2026-11-21 v3.8 5단계. 2026-11-22 용어를 "가구"로 통일: 화면 글자는 모두 "가구", 코드 이름 PropTab·prop 은 그대로)
 * 가구 탭 (탭 값은 'furniture')
 *  3 안내: "/"로 묶인 관심사마다 가구(단어)을 하나씩 고름. 처음 값 = 첫 단어. 한 단어짜리 관심사는 가구이 고정이라 칩에 안 나옴
 *  4 내 관심사 칩 중 고를 수 있는 것만(90개 중 57개). 누르면 그 관심사의 단어 후보
 *  5 후보(단어마다 모델 1개: 썸네일 + 모델 이름)를 고르면 땅굴의 그 가구이 바로 바뀜 (방이 새 선택으로 배치를 다시 계산)
 *  6 지금 고르는 가구을 땅굴 위에 점선 + "관심사 · 가구 이름" (RoomView highlight → three/roomScene)
 * 두더지 탭: 지금 착용 중 / 부위 탭 / 부위마다 하나("없음"이면 벗기). 아이템 규칙은 온보딩 1과 같음(43개 모두 바로 고를 수 있음, 관심사 연결 없음)
 * 색 탭 (2026-11-18 실험, docs/room-diversity-2-2026-11-18.md): 땅굴 색 묶음(벽 · 바닥 · 러그 · 가구 색)을 고름. "자동" = 대표 관심사 대분류의 묶음.
 *   이불·러그 무늬와 가구 모양은 그대로(내 id 씨앗), 색만 바뀜. 고른 값은 저장한 방의 themeId (남이 볼 때도 같음). 명세에 없는 탭이라 확인받을 것
 * 취소 · ×: 들어오기 전 모습으로 되돌림 (바꾼 게 있으면 00 공통 18). 저장하기: 반영하고 내 땅굴로 + 완료 토스트
 */
export default function DecorPanel({ tab, setTab, picks, worn, setWorn, furn, setFurn, focusSub, setFocusSub, dirty, onCancel, onSave, theme, setTheme }: {
  tab: DecorTab; setTab: (t: DecorTab) => void
  picks: string[]
  worn: string[]; setWorn: (w: string[]) => void
  furn: FurnChoice; setFurn: (f: FurnChoice) => void
  focusSub: string | null; setFocusSub: (id: string | null) => void
  dirty: boolean
  onCancel: () => void; onSave: () => void
  /** 고른 색 테마 (null = 자동: 대표 관심사 대분류의 묶음) */
  theme: string | null; setTheme: (id: string | null) => void
}) {
  const [ask, setAsk] = useState(false)
  const leave = () => (dirty ? setAsk(true) : onCancel())
  return (
    <aside className={`${s.panel} ${s.formPanel}`} aria-label="땅굴 꾸미기">
      <div className={s.panelHead}>
        <h2 className="display">땅굴 꾸미기</h2>
        <button className={s.closeBtn} onClick={leave} aria-label="꾸미기 닫기"><CloseIcon size={18} /></button>
      </div>
      <div className={s.segment} role="tablist" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <button role="tab" aria-selected={tab === 'furniture'} className={tab === 'furniture' ? s.segOn : s.seg} onClick={() => setTab('furniture')}>가구</button>
        <button role="tab" aria-selected={tab === 'color'} className={tab === 'color' ? s.segOn : s.seg} onClick={() => setTab('color')}>색</button>
        <button role="tab" aria-selected={tab === 'mole'} className={tab === 'mole' ? s.segOn : s.seg} onClick={() => setTab('mole')}>두더지</button>
      </div>
      <div className={s.decorBody}>
        {tab === 'mole' ? (
          <MoleDresser worn={worn} onChange={setWorn} compact />
        ) : tab === 'color' ? (
          <ColorTab picks={picks} theme={theme} setTheme={setTheme} />
        ) : (
          <PropTab picks={picks} furn={furn} setFurn={setFurn} focusSub={focusSub} setFocusSub={setFocusSub} />
        )}
      </div>
      <div className={s.panelActions}>
        <button className="btn btn-line" onClick={leave}>취소</button>
        <button className="btn btn-cta" onClick={onSave}>저장하기</button>
      </div>
      <UnsavedDialog open={ask} onStay={() => setAsk(false)} onLeave={() => { setAsk(false); onCancel() }} />
    </aside>
  )
}

/** 색 묶음 견본: 위 = 벽, 아래 = 바닥, 가운데 동그라미 = 러그 (CSS 그라데이션, 그림 파일 없음) */
function Swatch({ wall, floor, rug }: { wall: string; floor: string; rug: string }) {
  return (
    <span className={s.furnThumb} aria-hidden style={{ position: 'relative', background: `linear-gradient(${wall} 0 58%, ${floor} 58% 100%)` }}>
      <i style={{ position: 'absolute', left: '22%', right: '22%', bottom: '12%', height: '22%', borderRadius: '50%', background: rug }} />
    </span>
  )
}

function ColorTab({ picks, theme, setTheme }: { picks: string[]; theme: string | null; setTheme: (id: string | null) => void }) {
  const diverse = useSyncExternalStore(subscribeLook, lookDiverse)
  const lead = leadCategory(picks)
  const auto = categoryTheme(lead)
  const D = { wall: '#E4B995', floor: '#D49E78', rug: '#ECCC9E' } // 디자이너 원래 색 (화면에 보이는 색)
  const cards: { id: string | null; name: string; note: string; wall: string; floor: string; rug: string }[] = [
    ...(auto?.shell ? [{ id: null, name: '자동', note: auto.name, wall: auto.shell.wall, floor: auto.shell.floor, rug: auto.rug ?? auto.colors.green }] : []),
    ...Object.values(CATEGORY_THEMES).map((t) => ({ id: t.id, name: t.name.replace(/ 무드$/, ''), note: t.note, wall: t.shell!.wall, floor: t.shell!.floor, rug: t.rug ?? t.colors.green })),
    { id: 'base', name: '디자이너 기본', note: '처음 디자인 그대로', ...D },
  ]
  return (
    <div className={s.furnTab}>
      <p className={s.furnInfo}>ⓘ 땅굴의 벽 · 바닥 · 러그 · 가구 색을 한꺼번에 바꿔요.<br />"자동"은 대표 관심사({lead ? interestCatOf(lead)?.name_ko : '없음'})에 맞춘 색이에요.</p>
      <ul className={s.furnGrid}>
        {cards.map((c) => {
          const on = (theme ?? null) === c.id
          return (
            <li key={c.id ?? 'auto'}>
              <button className={on ? s.furnCardOn : s.furnCard} aria-pressed={on} title={c.note} onClick={() => setTheme(c.id)}>
                {c.id === null && <em className={m.furnBase}>추천</em>}
                <Swatch wall={c.wall} floor={c.floor} rug={c.rug} />
                {c.name}
              </button>
            </li>
          )
        })}
      </ul>
      <p className={s.formNote}>이불 · 러그 무늬와 가구 모양은 땅굴마다 정해져 있고, 색만 바뀌어요. 다른 사람이 볼 때도 같은 색이에요.</p>
      {!diverse && <p className={s.formNote}>지금은 "✨ 이펙트 → 🎨 땅굴 색 다양하게"가 꺼져 있어서 땅굴이 디자이너 원래 색으로 보여요.</p>}
    </div>
  )
}

/** 소품 썸네일: assets/prop-thumbs/<모델 노드>.webp 가 있으면 그 그림, 없으면 대분류 색 바탕에 단어 (임시, 필요한 목록은 docs/room-interest-v3-8-step4-5.md) */
const THUMBS = import.meta.glob('../../assets/prop-thumbs/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const thumbOf = (node: string) => THUMBS[`../../assets/prop-thumbs/${node}.webp`]

function PropTab({ picks, furn, setFurn, focusSub, setFocusSub }: { picks: string[]; furn: FurnChoice; setFurn: (f: FurnChoice) => void; focusSub: string | null; setFocusSub: (id: string | null) => void }) {
  const subs = useMemo(() => toSubIds(picks).filter((id) => wordChoices(id).length > 0), [picks])
  const cur = focusSub && subs.includes(focusSub) ? focusSub : subs[0] ?? null
  // 꾸미기를 열면 첫 칩의 소품을 방에서 가리키게 (highlight 는 focusSub 로 정해짐)
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
  // 고른 단어가 자리가 없어 못 놓이면(다른 단어로 넘어감) 안내
  const placed = useMemo(() => (cur ? placeWords(toSubIds(picks), furn).placed.find((p) => p.sub === cur)?.word.word : undefined), [cur, picks, furn])
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
          {placed && chosen && placed !== chosen && <p className={s.formNote}>자리가 없어서 "{placed}" 가구가 대신 놓여요.</p>}
          <p className={s.formNote}>가구 자리는 정해져 있어서 옮기거나 뺄 수 없어요.</p>
        </>
      )}
    </div>
  )
}
