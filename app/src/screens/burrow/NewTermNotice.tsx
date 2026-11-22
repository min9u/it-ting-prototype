import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import Modal from '../../components/Modal'
import { PinIcon, SearchIcon } from '../../components/Icons'
import { Toast } from '../../components/Feedback'
import { CURRENT_TERM, fieldOf, floorId, type Floor } from '../../data/field'
import { campusesInOrder, floorsOf } from '../../data/campusFloors'
import { NEW_TERM_NAME, chooseNewTermFloor, openNewTerm, resetNewTerm, useNewTerm } from '../../data/newTerm'
import x from './Explore.module.css'

/**
 * 땅굴 메인 – 새 학기 안내 (명세 05 · Figma 1465:15925에서 닫기(×)와 "나중에 하기"를 뺀 모양)
 * - 새 학기 들판이 열렸는데 이번 학기의 캠퍼스 · 층을 아직 안 고른 계정이 접속하면 내 땅굴 위에 뜸
 * - 닫을 수 없음: × · 나중에 하기 · Esc · 바깥 클릭 모두 없음(Modal onClose 를 비워 둠). 고르기 전에는 다른 화면도 못 씀(내 땅굴으로 되돌림 + 팝업이 뒤를 막음)
 * - 지난 학기에 고른 캠퍼스가 처음에 선택돼 있고 그 층에 "지난 학기" 표시. 층을 골라야 [이 층으로 정하기]가 켜짐
 * - 누르면 내 땅굴이 그 층으로 이사(방명록 · 단골 · 방 모습은 그대로, 프로필 캠퍼스 · 층도 바뀜) → 완료 토스트
 * 시연 손잡이: ?newterm=1 (안내 켜기) · ?newterm=0 (되돌리기)
 */
export function NewTermGate() {
  const [params] = useSearchParams()
  const nav = useNavigate()
  const { pathname } = useLocation()
  const t = useNewTerm()
  const pending = t.open && !t.chosen
  const [done, setDone] = useState<string | null>(null)
  const knob = params.get('newterm')

  useEffect(() => {
    if (knob === '1') openNewTerm()
    else if (knob === '0') resetNewTerm()
  }, [knob])
  // 고르기 전에는 내 땅굴(안내 뒤 화면)만
  useEffect(() => { if (pending && pathname !== '/burrow') nav('/burrow', { replace: true }) }, [pending, pathname, nav])

  return (
    <>
      {pending && <NewTermNotice lastCampus={t.lastCampus} lastFloor={t.lastFloor} onPick={(c, f) => { chooseNewTermFloor(c, f); setDone(`${c} · ${f}층`) }} />}
      <Toast open={!!done} onClose={() => setDone(null)} title="이번 학기 땅굴 자리를 정했어요" desc={done ? `내 땅굴이 ${done}으로 이사했어요` : undefined} />
    </>
  )
}

export function NewTermNotice({ lastCampus, lastFloor, onPick }: { lastCampus: string; lastFloor: number; onPick: (campus: string, floor: number) => void }) {
  const [campus, setCampus] = useState(lastCampus)
  const [sel, setSel] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const q = query.replace(/\D/g, '')
  const floors = floorsOf(campus).filter((fl) => !q || String(fl).includes(q))
  const campuses = campusesInOrder()
  return (
    // onClose 가 비어 있어 Esc · 바깥 클릭으로 닫히지 않음. hideClose 로 × 도 없음
    <Modal open onClose={() => undefined} width={520} labelledBy="newterm-title" hideClose>
      <div className={x.floorModal}>
        <div className={x.popHead}>
          <h2 id="newterm-title" className={`display ${x.floorTitle}`}>새 학기 들판이 열렸어요</h2>
        </div>
        <p className={x.newTermLead}>{NEW_TERM_NAME}가 시작됐어요. 이번 학기에 지낼 캠퍼스와 층을 골라 주세요.</p>
        <div className={x.curBar}>
          <span className={x.curWhere}><PinIcon size={18} /><small>지난 학기</small><strong>{lastCampus} · {lastFloor}층</strong></span>
        </div>
        <div className={x.pfBlock}>
          <p className={x.pfLabel}>캠퍼스</p>
          <div className={x.campusRow} role="group" aria-label="캠퍼스">
            {campuses.map((c) => (
              <button key={c.campus} type="button" aria-pressed={c.campus === campus} className={c.campus === campus ? x.campusOn : x.campusBtn}
                onClick={() => { setCampus(c.campus); setSel(null) }}>{c.campus}</button>
            ))}
          </div>
        </div>
        <div className={x.pfBlock}>
          <label className={x.floorSearch}>
            <SearchIcon size={18} />
            <input type="search" inputMode="numeric" placeholder="층 번호 검색" aria-label="층 번호 검색" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <ul className={x.floorScroll} aria-label={`${campus} 층 목록`}>
            {floors.map((fl) => {
              const f: Floor = { id: floorId(CURRENT_TERM, campus, fl), term: CURRENT_TERM, campus, floor: fl }
              const n = fieldOf(f).residents.length
              const last = campus === lastCampus && fl === lastFloor
              const picked = sel === fl
              return (
                <li key={fl}>
                  <button type="button" aria-pressed={picked} className={picked ? x.floorRowOn : x.floorRow} onClick={() => setSel(fl)}>
                    <span className={x.floorName}>{fl}층{last && <em className={x.floorBadge}>지난 학기</em>}</span>
                    <span className={x.floorCount}>
                      땅굴 {n}개
                      <svg className={x.floorCheck} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ visibility: picked ? 'visible' : 'hidden' }}><path d="M3 8.5l3.2 3.2L13 4.8" /></svg>
                    </span>
                  </button>
                </li>
              )
            })}
            {!floors.length && <li className={x.floorNone}>{q ? '찾는 층이 없어요' : '아직 층이 없어요'}</li>}
          </ul>
        </div>
        <div className={x.pfFoot}>
          <span className={sel ? undefined : x.pfFootNone} aria-live="polite">{sel ? `${campus} · ${sel}층` : '층을 골라 주세요'}</span>
          <button type="button" className={x.pfGoWide} disabled={sel === null} onClick={() => sel !== null && onPick(campus, sel)}>이 층으로 정하기</button>
        </div>
      </div>
    </Modal>
  )
}
