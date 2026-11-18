import { useState, useSyncExternalStore } from 'react'
import { lookDiverse, subscribeLook } from '../../lib/roomLookLab'
import MoleDresser from '../../components/MoleDresser'
import { CloseIcon } from '../../components/Icons'
import { interestCatOf, subOf, toSubIds } from '../../data/interests'
import { BLOCK_COLORS } from '../../data/roomPlan'
import { defaultFurniture, furnitureCandidates, leadCategory, type FurnChoice } from '../../data/myBurrow'
import { CATEGORY_THEMES, categoryTheme } from '../../data/roomStyle'
import UnsavedDialog from './UnsavedDialog'
import s from './Burrow.module.css'
import m from './MyBurrow.module.css'

export type DecorTab = 'furniture' | 'mole' | 'color'

/**
 * 땅굴 – 꾸미기 모드 (02 F4 가구 탭 · 두더지 탭, 2026-11-16)
 * 가구 탭
 *  3 안내: 세부 관심사마다 가구를 하나씩 고름. 기본 가구 = 온보딩 3a 추천 가구
 *  4 내 세부 관심사 칩(분야 아님). 누르면 그 관심사의 가구 후보
 *  5 후보 중 하나를 고르면 땅굴의 그 자리 가구가 바로 바뀜 (자리는 고정, 옮기거나 뺄 수 없음)
 *  6 지금 고르는 가구를 땅굴 위에 점선 + "관심사 · 가구 이름" (RoomView highlight → three/roomScene)
 * 두더지 탭: 지금 착용 중 / 부위 탭 / 부위마다 하나("없음"이면 벗기). 아이템·관심사 아이템 규칙은 온보딩 1과 같음(관심사 아이템도 고를 수 있음)
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
          <FurnitureTab picks={picks} furn={furn} setFurn={setFurn} focusSub={focusSub} setFocusSub={setFocusSub} />
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

function FurnitureTab({ picks, furn, setFurn, focusSub, setFocusSub }: { picks: string[]; furn: FurnChoice; setFurn: (f: FurnChoice) => void; focusSub: string | null; setFocusSub: (id: string | null) => void }) {
  const subs = toSubIds(picks).filter((id) => defaultFurniture(id))
  const cur = focusSub && subs.includes(focusSub) ? focusSub : subs[0] ?? null
  const sub = cur ? subOf(cur) : undefined
  const rows = cur ? furnitureCandidates(cur, picks) : []
  const chosen = cur ? furn[cur] ?? defaultFurniture(cur)?.id : undefined
  const pickRow = (id: string) => {
    if (!cur) return
    const next = { ...furn }
    if (id === defaultFurniture(cur)?.id) delete next[cur]; else next[cur] = id
    setFurn(next)
  }
  return (
    <div className={s.furnTab}>
      <p className={s.furnInfo}>ⓘ 관심사마다 가구를 하나씩 골라요.<br />관심사를 바꾸면 가구도 자동으로 바뀌어요.</p>
      {subs.length === 0 ? <p className={s.formNote}>고른 관심사가 없어요. 내 정보 수정에서 관심사를 골라 주세요.</p> : (
        <>
          <div className={s.furnCats} role="tablist" aria-label="내 관심사">
            {subs.map((id) => (
              <button key={id} role="tab" aria-selected={id === cur} className={id === cur ? s.furnCatOn : s.furnCat} onClick={() => setFocusSub(id)}>{subOf(id)?.name_ko}</button>
            ))}
          </div>
          <p className={s.furnHead}><strong>{sub?.name_ko} 가구 고르기</strong><span>{rows.length}개 중 1개</span></p>
          <ul className={s.furnGrid}>
            {rows.map((r, i) => {
              const on = chosen === r.id
              return (
                <li key={r.id}>
                  <button className={on ? s.furnCardOn : s.furnCard} aria-pressed={on} onClick={() => pickRow(r.id)}>
                    {i === 0 && <em className={m.furnBase}>기본</em>}
                    <span className={s.furnThumb} style={{ background: BLOCK_COLORS[sub?.category ?? ''] ?? '#F7E6C8' }} aria-hidden />
                    {r.name_ko}
                  </button>
                </li>
              )
            })}
          </ul>
          {rows.length === 1 && <p className={s.formNote}>이 관심사 자리에 놓을 수 있는 가구는 하나예요.</p>}
          <p className={s.formNote}>가구 자리는 정해져 있어서 옮기거나 뺄 수 없어요.</p>
        </>
      )}
    </div>
  )
}
