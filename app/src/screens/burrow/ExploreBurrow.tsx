import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import type { FieldHandle } from '../../three/fieldScene'
import FieldView from '../../components/FieldView'
import RoomModeToggle from '../../components/RoomModeToggle'
import Avatar from '../../components/Avatar'
import TodayNeighbors, { markShown, shouldShowToday } from './TodayNeighbors'
import InterestChip from '../../components/InterestChip'
import { ChevronLeft, ChevronRight, CloseIcon } from '../../components/Icons'
import { ME_ID, USERS } from '../../data/mock'
import s from './Burrow.module.css'

const NEIGHBORS = ['yerin', 'ha', 'seoyeon', 'mingu', 'yejin']

/**
 * 땅굴 메인 – 탐색하기 (돌아다니는 화면) 477:12524 · 사이드바 접힘 493:12616
 * 데모용 쿼리: ?panel=closed (사이드바 접힘)
 * 3D 밭(FieldView)을 걸어 다니고, ← / → 로 오른쪽 패널의 이웃 땅굴을 넘겨 본다.
 * 2026-11-11: 땅굴 입구 나무 안내판 679:17013 추가 (스크린샷 대조). 원래는 두더지가 입구에 다가가면 뜨지만
 * 3D 장면에서 거리 판정을 아직 안 받아서, 지금은 왼쪽 둔덕 위 고정 위치에 띄우고 ×로 닫을 수 있다.
 * 오른쪽 패널의 관심 분야·겹치는 관심사는 칩 대신 글자로 (스크린샷 기준).
 * 2026-11-12: 친구 추천 C · 첫 진입 추천 모달(오늘의 이웃 3명, 카드 뒤집어 답변 보기) → TodayNeighbors. ?recommend=1 로 다시 보기
 * 2026-11-12 굴 이동 (docs/field-move.md, 3D 핸드오프 ground_move_spec):
 *  - 들어올 때: 내 땅굴에서 오면 내 굴, 친구 땅굴에서 오면(RoomModeToggle 의 state.from) 그 친구 굴에서 mole_burrow_exit 로 나옴
 *  - ← / → · 흙더미 누르기: 지금 굴로 걸어가 들어가기 → 카메라가 이웃 굴로 → 거기서 나오기 (땅속 이동)
 *  - 방문 하기 · 땅굴 들어가기 · 내 땅굴: 굴 앞으로 걸어가 돌고 mole_burrow_enter → 다 들어가면 그 땅굴 화면으로
 *  - 휠·핀치(또는 - / = 키)로 멀리 보기
 */
export default function ExploreBurrow() {
  const location = useLocation()
  const navigate = useNavigate()
  // 어느 굴에서 나올지: 친구 땅굴(/burrow/:id)에서 왔으면 그 굴, 아니면 내 굴 ('me')
  const [startHole] = useState(() => {
    const from = (location.state as { from?: string } | null)?.from ?? ''
    const id = /^\/burrow\/([^/]+)$/.exec(from)?.[1]
    return id && NEIGHBORS.includes(id) ? id : 'me'
  })
  const [idx, setIdx] = useState(() => Math.max(0, NEIGHBORS.indexOf(startHole)))
  const idxRef = useRef(idx)
  idxRef.current = idx
  const field = useRef<FieldHandle | null>(null)
  const [entering, setEntering] = useState(false)
  const [fieldOpts] = useState(() => ({ holes: NEIGHBORS, startHole, zoom: true }))
  const [params] = useSearchParams()
  const [panelOpen, setPanelOpen] = useState(params.get('panel') !== 'closed')
  const owner = USERS[NEIGHBORS[idx]]
  const me = USERS[ME_ID]
  const shared = owner.interests.filter((i) => me.interests.includes(i))
  const [signOpen, setSignOpen] = useState(params.get('sign') !== 'closed')
  const [todayOpen, setTodayOpen] = useState(() => params.get('recommend') === '1' || (params.get('recommend') !== '0' && shouldShowToday()))
  useEffect(() => { if (todayOpen) markShown() }, [todayOpen])
  // 이웃 굴로 땅속 이동 (패널·안내판은 바로 바뀌고, 두더지는 굴로 들어갔다가 그 굴에서 나옴)
  const go = useCallback((d: number) => {
    if (entering) return
    const i = (idxRef.current + d + NEIGHBORS.length) % NEIGHBORS.length
    setIdx(i); setSignOpen(true)
    field.current?.travelTo(NEIGHBORS[i])
  }, [entering])
  const onFieldReady = useCallback((h: FieldHandle) => {
    field.current = h
    h.onHole((id) => { const i = NEIGHBORS.indexOf(id); if (i >= 0) { setIdx(i); setSignOpen(true) } })
  }, [])
  // 굴에 들어간 뒤 그 땅굴 화면으로 (3D 가 없거나 동작 줄이기면 바로)
  const enterTo = (id: string | null, to: string) => (e: React.MouseEvent) => {
    e.preventDefault()
    if (entering) return
    const h = field.current
    if (!h) { navigate(to); return }
    setEntering(true)
    h.enterHole(id, () => navigate(to))
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'TEXTAREA' || tag === 'INPUT') return
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go])

  const cx = panelOpen ? 0.403 : 0.5
  return (
    <main className={s.page}>
      <FieldView focusX={cx} label="두더지가 사는 밭" options={fieldOpts} onReady={onFieldReady}>
        <p className={s.exploreHint} style={{ left: `${cx * 100}%` }}>땅을 누르거나 WASD로 두더지를 움직여요 · ← → 키로 이웃 땅굴 보기 {idx + 1} / {NEIGHBORS.length} · 휠로 멀리 보기</p>
        <button className={`${s.walk} ${s.walkL}`} onClick={() => go(-1)} aria-label="이전 땅굴"><ChevronLeft size={26} /></button>
        <button className={`${s.walk} ${s.walkR}`} style={{ left: `calc(${cx * 200}% - 160px)` }} onClick={() => go(1)} aria-label="다음 땅굴"><ChevronRight size={26} /></button>
        {signOpen && (
          <div className={s.signboard} style={{ left: `${(panelOpen ? 0.367 : 0.44) * 100}%`, top: '57%' }} role="dialog" aria-label={`${owner.nickname}님의 땅굴 안내판`}>
            <button className={s.signClose} onClick={() => setSignOpen(false)} aria-label="안내판 닫기"><CloseIcon size={14} /></button>
            <div className={s.signOwner}>
              <Avatar size={45} />
              <div><strong>{owner.nickname}님의 땅굴</strong><small>같은 관심사 {shared.length}개</small></div>
            </div>
            {shared.length > 0 && <div className={s.signTags}>{shared.slice(0, 2).map((t) => <InterestChip key={t} label={t} />)}</div>}
            <Link to={`/burrow/${owner.id}`} onClick={enterTo(owner.id, `/burrow/${owner.id}`)} aria-disabled={entering} className={`btn btn-cta ${s.signBtn}`}>방문 하기</Link>
          </div>
        )}
        <RoomModeToggle style={{ left: `${(panelOpen ? 0.408 : 0.5) * 100}%` }} onPick={(to, e) => { if (to === '/burrow') enterTo(null, '/burrow')(e); else e.preventDefault() }} />
      </FieldView>

      {panelOpen ? (
        <aside className={s.roomInfo} aria-label="방 정보">
          <div className={s.panelHead}>
            <h2 className="display">{owner.nickname}님의 땅굴</h2>
            <button className="link-accent" onClick={() => setPanelOpen(false)}>접기 ›</button>
          </div>
          <div className={s.profile}>
            <Avatar size={64} />
            <div>
              <p className={`display ${s.nick}`}>{owner.nickname}</p>
              <p className={s.aff}>{owner.affiliation}</p>
            </div>
          </div>
          <div className={`${s.introBox} ${s.introRead}`}>
            <span className={s.introHead}><strong>자기소개</strong></span>
            <p className={s.introP}>{owner.intro || '아직 작성한 자기소개가 없어요.'}</p>
          </div>
          <dl className={s.details}>
            <div><dt>관심 분야</dt><dd>{owner.interests.slice(0, 3).join(', ')}{owner.interests.length > 3 && ` 외 ${owner.interests.length - 3}개`}</dd></div>
            <div><dt>겹치는 관심사</dt><dd className={s.sharedText}>{shared.length ? shared.join(', ') : '아직 없어요'}</dd></div>
          </dl>
          {owner.qna && (
            <>
              <h3 className={`display ${s.qnaTitle}`}>Q&amp;A</h3>
              <dl className={s.qna}>
                {owner.qna.map((x) => <div key={x.q}><dt>{x.q}</dt><dd>{x.a}</dd></div>)}
              </dl>
            </>
          )}
          <Link to={`/burrow/${owner.id}`} onClick={enterTo(owner.id, `/burrow/${owner.id}`)} aria-disabled={entering} className={`btn btn-primary btn-block ${s.enter}`}>땅굴 들어가기</Link>
        </aside>
      ) : (
        <button className={s.reopen} onClick={() => setPanelOpen(true)}><span className="display">방 정보</span><Avatar size={22} /></button>
      )}
      <TodayNeighbors open={todayOpen} onClose={() => setTodayOpen(false)} />
    </main>
  )
}
