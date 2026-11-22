import { useEffect, useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import Modal from '../../components/Modal'
import Avatar from '../../components/Avatar'
import { CloseIcon, PinIcon, SearchIcon } from '../../components/Icons'
import { EmptyMole } from '../../components/Feedback'
import { toneOf } from '../../data/mock'
import { GENERATIONS } from '../../data/auth'
import {
  CURRENT_TERM, MY_FLOOR, MY_PAST_FLOORS, affOf, drawRecommendations, fieldOf, fieldUserOf, floorId,
  getRegulars, me, setRegular, shortAffOf, subscribeRegulars, todaysPicks, type Floor, type RecommendPick,
} from '../../data/field'
import { campusesInOrder, floorsOf } from '../../data/campusFloors'
import type { User } from '../../data/types'
import x from './Explore.module.css'

/* ===================== 단골 땅굴 목록 (958:8917 → 2026-11-21 Figma 1127:13203 "친구 카드형") ===================== */
/** 카드 아바타 원 배경 (Figma 1294:12212~: 예린 · 서벅이 · 도토리 순서의 #E6CE9D · #DDE3BE · #ECD0B6) */
const REG_BG = ['#E6CE9D', '#DDE3BE', '#ECD0B6']
/**
 * 내가 단골로 추가한 땅굴을 카드 3열로. 놀러가기 = 방문자 뷰로 바로, 해제 = 목록에서 뺌 (상대에게 알리지 않음). 새 소식 표시는 없음.
 * 안내 문장은 Figma 에 없어서 뺌. 4명 이상이면 줄이 늘어나고 세로로 스크롤
 */
export function RegularsModal({ open, onClose, onRemoved }: { open: boolean; onClose: () => void; onRemoved: (nick: string) => void }) {
  const ids = useSyncExternalStore(subscribeRegulars, getRegulars)
  const users = ids.map((id) => fieldUserOf(id)).filter((u): u is User => !!u)
  return (
    <Modal open={open} onClose={onClose} width={680} labelledBy="regulars-title" hideClose>
      <div className={x.regModal}>
        <div className={x.popHead}>
          <h2 id="regulars-title" className="display">단골 땅굴</h2>
          <button type="button" className={x.popClose} onClick={onClose} aria-label="닫기"><CloseIcon size={18} /></button>
        </div>
        {users.length ? (
          <ul className={x.regGrid}>
            {users.map((u, n) => (
              <li key={u.id} className={x.regCard}>
                <Avatar circle size={64} bg={REG_BG[n % REG_BG.length]} />
                <span className={x.regWho}><strong>{u.nickname}</strong><small>{shortAffOf(u)}</small></span>
                <Link to={`/burrow/${u.id}`} className={x.regGo} onClick={onClose}>놀러가기</Link>
                <button type="button" className={x.regOff} onClick={() => { setRegular(u.id, false); onRemoved(u.nickname) }}>해제</button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyMole message="아직 단골 땅굴이 없어요. 땅굴에 놀러 가서 '단골 추가'를 눌러 보세요." />
        )}
      </div>
    </Modal>
  )
}

/* ===================== 오늘의 추천 친구 (설정 863:133 · 결과 761:3795 · 카드 뒤집기 765:3619) ===================== */
/**
 * 오늘 아직 안 받았으면 추천 설정(캠퍼스 · 층 · 기수) → 추천 받기 → 결과. 이미 받았으면 오늘 받은 3명.
 * 탐색에 들어올 때 자동으로 띄우지 않음 (02 F5 5번). 결과 화면에는 설정을 두지 않음.
 * 2026-11-21 명세: 설정은 캠퍼스 · 층과 기수만 (관심사 칩 · 답이 궁금한 질문 · 질문 고르기 · 같은 질문 토글은 없어짐), 고른 값은 저장하지 않음.
 * 모양은 Figma 863:133 (칩 · 안내 상자 · 추천 받기 버튼)에서 남는 줄만 그대로
 */
type RecView = 'settings' | 'result'
export function RecommendModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [picks, setPicks] = useState<string[] | null>(null)
  const [view, setView] = useState<RecView>('settings')
  useEffect(() => { if (open) { const p = todaysPicks(); setPicks(p); setView(p ? 'result' : 'settings') } }, [open])
  return (
    <Modal open={open} onClose={onClose} width={view === 'result' ? 720 : 560} labelledBy="rec-title">
      {view === 'result' && picks
        ? <RecommendResult ids={picks} onGo={onClose} />
        : <RecommendSettingsView onDraw={(sel) => { setPicks(drawRecommendations(sel)); setView('result') }} />}
    </Modal>
  )
}

/** 선택 칩 (Figma 863:133 "같은 캠퍼스" 칩: 고르면 갈색 + ✓, 안 고르면 흰 바탕 테두리). 한 줄에서 하나만 고름 */
function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" className={on ? x.chipOn : x.chip} aria-pressed={on} onClick={onClick}>{on && '✓ '}{children}</button>
}

/** 기수 목록 (00 공통 19, 회원가입의 기수 목록과 같은 값: "16기" → 16) */
const GEN_NUMS = GENERATIONS.map((g) => parseInt(g, 10))

/**
 * 추천 친구 설정 (02 F5 "추천 받기 전" 2 · 4, 2026-11-21 명세): 캠퍼스 · 층과 기수만 고름. 캠퍼스를 고르면 그 캠퍼스의 층 목록이 나옴
 * (캠퍼스를 바꾸면 층을 다시 고름). 고른 값은 저장하지 않음 — 열 때마다 내 캠퍼스 · 층 · 기수로 시작
 */
function RecommendSettingsView({ onDraw }: { onDraw: (sel: RecommendPick) => void }) {
  const [campus, setCampus] = useState(MY_FLOOR.campus)
  const [floor, setFloor] = useState<number | null>(MY_FLOOR.floor)
  const [gen, setGen] = useState<number | null>(me().gen)
  const campuses = campusesInOrder()
  const floors = floorsOf(campus)
  const ready = floor != null && gen != null
  return (
    <div className={x.modal}>
      <h2 id="rec-title" className="display">오늘의 추천 친구</h2>
      <p className={x.lead}>캠퍼스 · 층과 기수를 고르고 오늘의 추천 친구 3명을 받아 보세요.</p>
      <section className={x.recSec} aria-labelledby="rec-campus">
        <h3 id="rec-campus">캠퍼스</h3>
        <div className={x.chips} role="group" aria-labelledby="rec-campus">
          {campuses.map((c) => <Chip key={c.campus} on={campus === c.campus} onClick={() => { if (c.campus !== campus) { setCampus(c.campus); setFloor(null) } }}>{c.campus}</Chip>)}
        </div>
      </section>
      <section className={x.recSec} aria-labelledby="rec-floor">
        <h3 id="rec-floor">층</h3>
        <div className={x.chips} role="group" aria-labelledby="rec-floor">
          {floors.map((fl) => <Chip key={fl} on={floor === fl} onClick={() => setFloor(fl)}>{fl}층</Chip>)}
        </div>
      </section>
      <section className={x.recSec} aria-labelledby="rec-gen">
        <h3 id="rec-gen">기수</h3>
        <div className={x.chips} role="group" aria-labelledby="rec-gen">
          {GEN_NUMS.map((g) => <Chip key={g} on={gen === g} onClick={() => setGen(g)}>{g}기</Chip>)}
        </div>
      </section>
      <p className={x.recNotice}>추천은 하루 한 번 받을 수 있어요. 오늘 받은 추천은 내일까지 바뀌지 않아요.</p>
      <button className={`btn btn-cta btn-block ${x.recDraw}`} disabled={!ready} onClick={() => ready && onDraw({ campus, floor, gen })}>추천 받기</button>
    </div>
  )
}

/** 카드 아바타 배경 (파스텔: 라일락 · 하늘 · 버터) */
const CARD_BG = ['#e6ddeb', '#d9e6ec', '#f3e6be']
/** "Q1. 문장" → "Q. 문장" */
const dotQ = (q: string) => q.replace(/^Q\d+\./, 'Q.')

function RecommendResult({ ids, onGo }: { ids: string[]; onGo: () => void }) {
  const users = ids.map((id) => fieldUserOf(id)).filter((u): u is User => !!u)
  const [flipped, setFlipped] = useState<string | null>(null)
  /** 지금 고른(올려 둔 · 누른) 카드. 처음엔 첫 번째. 주황 테두리 + 주황 버튼 */
  const [active, setActive] = useState<string | null>(users[0]?.id ?? null)
  const mine = me().interests
  return (
    <div className={x.modal}>
      <h2 id="rec-title" className="display">오늘의 추천 친구가 도착했어요</h2>
      <p className={x.lead}>관심사가 비슷한 SSAFY 친구 {users.length}명입니다</p>
      <p className={x.cardHint}>카드를 누르면 친구의 답변을 볼 수 있어요</p>
      {users.length ? (
        <ul className={x.recCards}>
          {users.map((u, n) => {
            const shared = u.interests.filter((i) => mine.includes(i))
            const chips = [...shared, ...u.interests.filter((i) => !shared.includes(i))].slice(0, 3)
            const back = flipped === u.id
            const bg = CARD_BG[n % CARD_BG.length]
            return (
              <li key={u.id} className={`${back ? x.cardBack : x.card} ${active === u.id ? x.cardActive : ''}`}
                onMouseEnter={() => setActive(u.id)} onFocus={() => setActive(u.id)}>
                {back ? (
                  <button className={x.backFace} onClick={() => setFlipped(null)} aria-label={`${u.nickname} 프로필로 돌아가기`}>
                    <span className={x.backHead}><Avatar circle size={40} bg={bg} /><strong>{u.nickname}</strong></span>
                    <dl className={x.backQna}>{(u.qna ?? []).slice(0, 2).map((q) => <div key={q.q}><dt>{dotQ(q.q)}</dt><dd>{q.a}</dd></div>)}</dl>
                  </button>
                ) : (
                  <button className={x.cardFront} onClick={() => { setActive(u.id); setFlipped(u.id) }} aria-label={`${u.nickname} 답변 보기`}>
                    <span className={x.fold} aria-hidden />
                    <Avatar circle size={72} bg={bg} />
                    <strong>{u.nickname}</strong>
                    <small>{affOf(u)}</small>
                    <span className={x.cardChips}>
                      {chips.map((t) => (
                        <span key={t} style={{ background: `var(--tone-${toneOf(t)}-bg)`, color: `var(--tone-${toneOf(t)}-fg)` }}>{shared.includes(t) && '✓ '}{t}</span>
                      ))}
                    </span>
                  </button>
                )}
                <Link to={`/burrow/${u.id}`} className={`btn ${active === u.id || back ? 'btn-cta' : 'btn-line'} btn-block ${x.cardGo}`} onClick={onGo}>땅굴 방문하기</Link>
              </li>
            )
          })}
        </ul>
      ) : (
        <EmptyMole message="조건에 맞는 친구를 찾지 못했어요." />
      )}
      <p className={x.recNext}>내일 새로운 추천 친구를 받을 수 있어요</p>
    </div>
  )
}

/* ===================== 캠퍼스-층 고르기 (00 공통 19 → 2026-11-21 Figma 1265:35323 "검색·스크롤 비교안") ===================== */
/** "서울 · 3층" (지난 학기면 앞에 학기) */
const placeLabel = (f: Pick<Floor, 'term' | 'campus' | 'floor'>) => `${f.term === CURRENT_TERM ? '' : `${f.term} `}${f.campus} · ${f.floor}층`

/**
 * 정해진 목록에서 고름 (직접 입력 없음, 캠퍼스마다 층 목록이 다름). 맨 위 "현재 위치" 줄 → 캠퍼스 5칸 → 층 번호 검색 + 세로 스크롤 목록 → 아래 "서울 · 3층"과 [들어가기].
 * 층을 누르면 고르기만 하고(✓), [들어가기]를 눌러야 이동. 지금 있는 층을 고르면 [들어가기]는 꺼짐. [현재 층으로]는 고른 것을 지금 층으로 되돌림.
 * 학기는 이번 학기 + 내가 땅굴이 있던 지난 학기 (Figma 비교안에는 없지만 00 공통 19 라 지난 학기가 있을 때만 위에 한 줄로 남김).
 * 다른 들판에도 누구나 들어갈 수 있음 (기수로는 나누지 않음). 사다리를 눌러도 열림
 */
export function FloorPickerModal({ open, current, onClose, onPick }: { open: boolean; current: Floor; onClose: () => void; onPick: (f: Floor) => void }) {
  const terms = [CURRENT_TERM, ...new Set(MY_PAST_FLOORS.map((f) => f.term))]
  const [term, setTerm] = useState(current.term)
  const [campus, setCampus] = useState(current.campus)
  /** 고른 층 (아직 이동 전). 캠퍼스·학기를 바꾸면 비움 */
  const [sel, setSel] = useState<Floor | null>(current)
  const [query, setQuery] = useState('')
  const reset = () => { setTerm(current.term); setCampus(current.campus); setSel(current); setQuery('') }
  // 열 때(또는 지금 층이 바뀔 때)만 처음 상태로. current 객체는 부모가 다시 그릴 때마다 새로 만들어질 수 있어서 id 로만 봄
  // (객체를 deps 에 넣으면 부모가 다시 그릴 때마다 고른 층이 지워짐)
  useEffect(() => { if (open) reset() }, [open, current.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const q = query.replace(/\D/g, '')
  const floors = floorsOf(campus).filter((fl) => !q || String(fl).includes(q))
  const campuses = campusesInOrder() // 05 명세 순서 (서울 · 대전 · 부울경 · 구미 · 광주)
  const canGo = !!sel && sel.id !== current.id
  return (
    <Modal open={open} onClose={onClose} width={520} labelledBy="floor-title" hideClose>
      <div className={x.floorModal}>
        <div className={x.popHead}>
          <h2 id="floor-title" className={`display ${x.floorTitle}`}>캠퍼스-층 고르기</h2>
          <button type="button" className={x.popClose} onClick={onClose} aria-label="닫기"><CloseIcon size={18} /></button>
        </div>
        <div className={x.curBar}>
          <span className={x.curWhere}><PinIcon size={18} /><small>현재 위치</small><strong>{placeLabel(current)}</strong></span>
          <button type="button" className={x.curBack} onClick={reset}>현재 층으로</button>
        </div>
        {terms.length > 1 && (
          <div className={x.seg} role="tablist" aria-label="학기">
            {terms.map((t) => <button key={t} role="tab" aria-selected={t === term} className={t === term ? x.segOn : x.segBtn} onClick={() => { setTerm(t); setSel(null) }}>{t}{t === CURRENT_TERM && ' (이번 학기)'}</button>)}
          </div>
        )}
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
              const f: Floor = { id: floorId(term, campus, fl), term, campus, floor: fl }
              const n = fieldOf(f).residents.length
              const isMine = f.id === MY_FLOOR.id || MY_PAST_FLOORS.some((p) => p.id === f.id)
              const here = f.id === current.id
              const picked = sel?.id === f.id
              return (
                <li key={fl}>
                  <button type="button" aria-pressed={picked} className={picked ? x.floorRowOn : x.floorRow} onClick={() => setSel(f)}>
                    <span className={x.floorName}>
                      {fl}층
                      {here && <em className={x.floorBadge}>현재 위치</em>}
                      {isMine && <em className={x.floorBadge}>내 땅굴</em>}
                    </span>
                    <span className={x.floorCount}>
                      땅굴 {n}개
                      <svg className={x.floorCheck} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ visibility: picked ? 'visible' : 'hidden' }}><path d="M3.5 8.5l3 3 6-7" /></svg>
                    </span>
                  </button>
                </li>
              )
            })}
            {!floors.length && <li className={x.floorNone}>{q ? '찾는 층이 없어요' : '아직 층이 없어요'}</li>}
          </ul>
        </div>
        <div className={x.pfFoot}>
          <span className={sel ? undefined : x.pfFootNone} aria-live="polite">{sel ? placeLabel(sel) : '층을 골라 주세요'}</span>
          <button type="button" className={x.pfGo} disabled={!canGo} onClick={() => sel && onPick(sel)}>들어가기</button>
        </div>
      </div>
    </Modal>
  )
}
