import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import FieldView from '../../components/FieldView'
import RoomModeToggle from '../../components/RoomModeToggle'
import Avatar from '../../components/Avatar'
import { ChipList } from '../../components/InterestChip'
import { ChevronLeft, ChevronRight } from '../../components/Icons'
import { ME_ID, USERS } from '../../data/mock'
import s from './Burrow.module.css'

const NEIGHBORS = ['yerin', 'ha', 'seoyeon', 'mingu', 'yejin']

/**
 * 땅굴 메인 – 탐색하기 (돌아다니는 화면) 477:12524 · 사이드바 접힘 493:12616
 * 데모용 쿼리: ?panel=closed (사이드바 접힘)
 * 메타데이터 기반 — 스크린샷 대조 필요.
 * 3D 밭(FieldView)을 걸어 다니고, ← / → 로 오른쪽 패널의 이웃 땅굴을 넘겨 본다.
 */
export default function ExploreBurrow() {
  const [idx, setIdx] = useState(0)
  const [params] = useSearchParams()
  const [panelOpen, setPanelOpen] = useState(params.get('panel') !== 'closed')
  const owner = USERS[NEIGHBORS[idx]]
  const me = USERS[ME_ID]
  const shared = owner.interests.filter((i) => me.interests.includes(i))
  const go = useCallback((d: number) => setIdx((i) => (i + d + NEIGHBORS.length) % NEIGHBORS.length), [])

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
        <RoomModeToggle style={{ left: `${(panelOpen ? 0.408 : 0.5) * 100}%` }} />
      </FieldView>

      {panelOpen ? (
        <aside className={s.roomInfo} aria-label="방 정보">
          <div className={s.panelHead}>
            <h2 className="display">{owner.nickname}이의 땅굴</h2>
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
            <div><dt>관심 분야</dt><dd><ChipList items={owner.interests.slice(0, 4)} /></dd></div>
            <div><dt>겹치는 관심사</dt><dd>{shared.length ? `${shared.join(', ')} (${shared.length}개)` : '아직 없어요'}</dd></div>
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
    </main>
  )
}
