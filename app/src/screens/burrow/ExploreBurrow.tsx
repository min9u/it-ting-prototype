import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
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
 */
export default function ExploreBurrow() {
  const [idx, setIdx] = useState(0)
  const [params] = useSearchParams()
  const [panelOpen, setPanelOpen] = useState(params.get('panel') !== 'closed')
  const owner = USERS[NEIGHBORS[idx]]
  const me = USERS[ME_ID]
  const shared = owner.interests.filter((i) => me.interests.includes(i))
  const [signOpen, setSignOpen] = useState(params.get('sign') !== 'closed')
  const [todayOpen, setTodayOpen] = useState(() => params.get('recommend') === '1' || (params.get('recommend') !== '0' && shouldShowToday()))
  useEffect(() => { if (todayOpen) markShown() }, [todayOpen])
  const go = useCallback((d: number) => { setIdx((i) => (i + d + NEIGHBORS.length) % NEIGHBORS.length); setSignOpen(true) }, [])

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
      <FieldView focusX={cx} label="두더지가 사는 밭">
        <p className={s.exploreHint} style={{ left: `${cx * 100}%` }}>땅을 누르거나 WASD로 두더지를 움직여요 · ← → 키로 이웃 땅굴 보기 {idx + 1} / {NEIGHBORS.length}</p>
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
            <Link to={`/burrow/${owner.id}`} className={`btn btn-cta ${s.signBtn}`}>방문 하기</Link>
          </div>
        )}
        <RoomModeToggle style={{ left: `${(panelOpen ? 0.408 : 0.5) * 100}%` }} />
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
          <Link to={`/burrow/${owner.id}`} className={`btn btn-primary btn-block ${s.enter}`}>땅굴 들어가기</Link>
        </aside>
      ) : (
        <button className={s.reopen} onClick={() => setPanelOpen(true)}><span className="display">방 정보</span><Avatar size={22} /></button>
      )}
      <TodayNeighbors open={todayOpen} onClose={() => setTodayOpen(false)} />
    </main>
  )
}
