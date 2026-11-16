import { useState } from 'react'
import MoleDresser from '../../components/MoleDresser'
import { CloseIcon } from '../../components/Icons'
import { subOf, toSubIds } from '../../data/interests'
import { BLOCK_COLORS } from '../../data/roomPlan'
import { defaultFurniture, furnitureCandidates, type FurnChoice } from '../../data/myBurrow'
import UnsavedDialog from './UnsavedDialog'
import s from './Burrow.module.css'
import m from './MyBurrow.module.css'

export type DecorTab = 'furniture' | 'mole'

/**
 * 땅굴 – 꾸미기 모드 (02 F4 가구 탭 · 두더지 탭, 2026-11-16)
 * 가구 탭
 *  3 안내: 세부 관심사마다 가구를 하나씩 고름. 기본 가구 = 온보딩 3a 추천 가구
 *  4 내 세부 관심사 칩(분야 아님). 누르면 그 관심사의 가구 후보
 *  5 후보 중 하나를 고르면 땅굴의 그 자리 가구가 바로 바뀜 (자리는 고정, 옮기거나 뺄 수 없음)
 *  6 지금 고르는 가구를 땅굴 위에 점선 + "관심사 · 가구 이름" (RoomView highlight → three/roomScene)
 * 두더지 탭: 지금 착용 중 / 부위 탭 / 부위마다 하나("없음"이면 벗기). 아이템·관심사 아이템 규칙은 온보딩 1과 같음(관심사 아이템도 고를 수 있음)
 * 취소 · ×: 들어오기 전 모습으로 되돌림 (바꾼 게 있으면 00 공통 18). 저장하기: 반영하고 내 땅굴로 + 완료 토스트
 */
export default function DecorPanel({ tab, setTab, picks, worn, setWorn, furn, setFurn, focusSub, setFocusSub, dirty, onCancel, onSave }: {
  tab: DecorTab; setTab: (t: DecorTab) => void
  picks: string[]
  worn: string[]; setWorn: (w: string[]) => void
  furn: FurnChoice; setFurn: (f: FurnChoice) => void
  focusSub: string | null; setFocusSub: (id: string | null) => void
  dirty: boolean
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
      <div className={s.segment} role="tablist">
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
        <button className="btn btn-cta" onClick={onSave}>저장하기</button>
      </div>
      <UnsavedDialog open={ask} onStay={() => setAsk(false)} onLeave={() => { setAsk(false); onCancel() }} />
    </aside>
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
