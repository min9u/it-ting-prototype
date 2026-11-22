import { useState } from 'react'
import MoleDresser from '../../components/MoleDresser'
import { CloseIcon } from '../../components/Icons'
import UnsavedDialog from './UnsavedDialog'
import s from './Burrow.module.css'

/**
 * 땅굴 – 꾸미기 모드 · 두더지 탭 (명세 04, 2026-11-22 API v1 맞춤)
 * 꾸미기 모드에는 **두더지 탭만** 있다. 가구는 관심사마다 하나로 정해져 있어 고르지 않는다 (명세 00 공통 5 · 04 "가구와 땅굴 무드").
 * 그래서 예전의 소품 탭(관심사마다 단어 고르기)과 색 탭(색 묶음 고르기, 실험)은 뺐다. 방을 꾸미는 값을 저장하는 API 도 없다.
 * (데이터 쪽 함수 data/myBurrow wordChoices · data/roomStyle 은 실험실 · 시험이 쓰므로 그대로 둠)
 * 1 지금 착용 중 / 2 부위 탭 / 3 부위마다 하나("없음"이면 벗기), 고르면 땅굴 안 두더지에 바로 보임
 * 4 취소 · ×: 들어오기 전 모습으로 (바꾼 게 있으면 00 공통 18) / 저장하기: PATCH /me/mole → 내 땅굴로 + 완료 토스트
 */
export default function DecorPanel({ worn, setWorn, dirty, saving, onCancel, onSave }: {
  worn: string[]; setWorn: (w: string[]) => void
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
      <div className={s.segment} role="tablist" style={{ gridTemplateColumns: '1fr' }}>
        <button role="tab" aria-selected className={s.segOn}>두더지</button>
      </div>
      <div className={s.decorBody}>
        <MoleDresser worn={worn} onChange={setWorn} compact />
      </div>
      <div className={s.panelActions}>
        <button className="btn btn-line" onClick={leave}>취소</button>
        <button className="btn btn-cta" onClick={onSave} disabled={saving} aria-busy={saving}>{saving ? '저장하는 중…' : '저장하기'}</button>
      </div>
      <UnsavedDialog open={ask} onStay={() => setAsk(false)} onLeave={() => { setAsk(false); onCancel() }} />
    </aside>
  )
}
