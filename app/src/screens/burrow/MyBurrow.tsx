import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import RoomView from '../../components/RoomView'
import RoomModeToggle from '../../components/RoomModeToggle'
import SceneButton, { VisitorBadge } from '../../components/SceneButton'
import { ChipList } from '../../components/InterestChip'
import GuestbookItem from '../../components/GuestbookItem'
import Avatar from '../../components/Avatar'
import Modal from '../../components/Modal'
import { GUESTBOOK, ME_ID, USERS } from '../../data/mock'
import { liveGuestbook } from '../../lib/format'
import GuestbookModal from './GuestbookModal'
import s from './Burrow.module.css'

const INTRO_MAX = 150

/**
 * 땅굴 메인 – 내 땅굴 (Full-bleed) 454:6900
 * - 사이드바 접힘 454:7053, 방명록 0개 506:7960, 방명록 전체보기 모달 454:7748
 * 데모용 쿼리: ?guestbook=0 (방명록 없음), ?panel=closed (사이드바 접힘), ?modal=guestbook (전체보기)
 */
export default function MyBurrow() {
  const [params] = useSearchParams()
  const me = USERS[ME_ID]
  const [panelOpen, setPanelOpen] = useState(params.get('panel') !== 'closed')
  const [intro, setIntro] = useState(me.intro)
  const [entries, setEntries] = useState(() => (params.get('guestbook') === '0' ? [] : liveGuestbook(GUESTBOOK)))
  const [allOpen, setAllOpen] = useState(params.get('modal') === 'guestbook')
  const [decorOpen, setDecorOpen] = useState(false)
  const [visitorsOpen, setVisitorsOpen] = useState(false)

  const recent = useMemo(() => entries.slice(0, 3), [entries])
  const focusX = panelOpen ? 0.403 : 0.5

  return (
    <main className={s.page}>
      <RoomView ownerId={me.id} interests={me.interests} focusX={focusX} label="내 땅굴">
        <div className={s.sceneTools}>
          <SceneButton tone="cream" onClick={() => setDecorOpen(true)}>땅굴 꾸미기</SceneButton>
          <SceneButton tone="mint" onClick={() => setVisitorsOpen(true)} aria-label={`지금 방문자 ${me.visitorsNow}명`}>
            <VisitorBadge count={me.visitorsNow ?? 0} />
          </SceneButton>
        </div>
        <RoomModeToggle style={{ left: `${(panelOpen ? 0.408 : 0.515) * 100}%` }} />
      </RoomView>

      {panelOpen ? (
        <aside className={s.panel} aria-label="내 정보">
          <div className={s.panelHead}>
            <h2 className="display">내 정보</h2>
            <button className="link-accent" onClick={() => setPanelOpen(false)} aria-expanded="true">접기 ›</button>
          </div>

          <div className={s.profile}>
            <Avatar size={64} empty />
            <div>
              <p className={`display ${s.nick}`}>{me.nickname}</p>
              <p className={s.aff}>{me.affiliation}</p>
            </div>
          </div>

          <label className={s.introBox}>
            <span className={s.introHead}>
              <strong>자기소개</strong>
              <span>{intro.length} / {INTRO_MAX}</span>
            </span>
            <textarea
              className={s.introText}
              value={intro}
              maxLength={INTRO_MAX}
              placeholder="아직 작성한 자기소개가 없어요."
              onChange={(e) => setIntro(e.target.value)}
            />
          </label>

          <section className={s.interests}>
            <p className={s.sectionLabel}>관심사 <span>{me.interests.length}</span></p>
            <ChipList items={me.interests} />
          </section>

          <section className={s.guestbook}>
            <h3 className={`display ${s.gbTitle}`}>방명록 <span className="count-badge">{entries.length}</span></h3>
            {entries.length === 0 ? (
              <p className={s.gbEmpty}>
                작성된 방명록이 없어요.<br />돌아다니며 먼저 방명록을 남겨보세요.<br />다른 두더지가 찾아올지도 몰라요.
              </p>
            ) : (
              <>
                <ul className={s.gbList}>
                  {recent.map((g) => <GuestbookItem key={g.id} entry={g} />)}
                </ul>
                <button className={`link-accent ${s.more}`} onClick={() => setAllOpen(true)}>전체 보기</button>
              </>
            )}
          </section>
        </aside>
      ) : (
        <button className={s.reopen} onClick={() => setPanelOpen(true)} aria-expanded="false">
          <span className="display">내 정보</span>
          <Avatar size={22} />
        </button>
      )}

      <GuestbookModal
        open={allOpen}
        onClose={() => setAllOpen(false)}
        entries={entries}
        onDelete={(id) => setEntries((list) => list.filter((g) => g.id !== id))}
      />

      <Modal open={decorOpen} onClose={() => setDecorOpen(false)} width={420} labelledBy="decor-title">
        <div className={s.simpleModal}>
          <h2 id="decor-title" className="display">땅굴 꾸미기</h2>
          <p>가구 옮기기·벽지 바꾸기 화면은 아직 디자인이 없어요. 3D 땅굴이 붙으면 여기서 꾸밀 수 있어요.</p>
          <button className="btn btn-primary btn-block" onClick={() => setDecorOpen(false)}>알겠어요</button>
        </div>
      </Modal>

      <Modal open={visitorsOpen} onClose={() => setVisitorsOpen(false)} width={360} labelledBy="visitors-title">
        <div className={s.simpleModal}>
          <h2 id="visitors-title" className="display">지금 놀러 온 두더지</h2>
          <ul className={s.visitorList}>
            {['yerin', 'ha'].map((id) => (
              <li key={id}><Avatar size={36} /><span><strong>{USERS[id].nickname}</strong><small>{USERS[id].affiliation}</small></span></li>
            ))}
          </ul>
        </div>
      </Modal>
    </main>
  )
}
