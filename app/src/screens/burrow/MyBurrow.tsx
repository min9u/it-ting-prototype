import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import RoomView from '../../components/RoomView'
import RoomModeToggle from '../../components/RoomModeToggle'
import SceneButton, { VisitorBadge } from '../../components/SceneButton'
import { ChipList } from '../../components/InterestChip'
import GuestbookItem from '../../components/GuestbookItem'
import Avatar from '../../components/Avatar'
import Modal from '../../components/Modal'
import MoleDresser from '../../components/MoleDresser'
import { EmptyMole, Toast } from '../../components/Feedback'
import { ChevronLeft, CloseIcon, PlusIcon } from '../../components/Icons'
import { GUESTBOOK, ME_ID, USERS } from '../../data/mock'
import { DEFAULT_WORN } from '../../data/moleItems'
import { liveGuestbook } from '../../lib/format'
import GuestbookModal from './GuestbookModal'
import s from './Burrow.module.css'

const INTRO_MAX = 150
const NICK_MAX = 12

type Mode = 'info' | 'edit' | 'decor'

/**
 * 땅굴 메인 – 내 땅굴 (Full-bleed) 454:6900 (헤더에 "수정" 링크 추가됨)
 * - 사이드바 접힘 454:7053, 방명록 0개 506:7960 (흙더미 두더지 빈 상태), 방명록 전체보기 모달 454:7748
 * - 내 정보 수정 · 사이드바 교체 683:8058 (2026-11-11 추가)
 * - 꾸미기 모드 · 사이드바 변신 682:7764 (2026-11-11 추가, "두더지" 탭만 디자인 있음)
 * 데모용 쿼리: ?guestbook=0, ?panel=closed, ?modal=guestbook, ?mode=edit, ?mode=decor
 */
export default function MyBurrow() {
  const [params] = useSearchParams()
  const me = USERS[ME_ID]
  const [panelOpen, setPanelOpen] = useState(params.get('panel') !== 'closed')
  const [mode, setMode] = useState<Mode>(() => (params.get('mode') === 'edit' ? 'edit' : params.get('mode') === 'decor' ? 'decor' : 'info'))
  const [profile, setProfile] = useState({ nickname: me.nickname, intro: me.intro, interests: me.interests })
  const [worn, setWorn] = useState<string[]>(DEFAULT_WORN)
  const [draft, setDraft] = useState<string[]>(worn)   // 꾸미는 중인 모습 (방 두더지에 바로 보임)
  const [entries, setEntries] = useState(() => (params.get('guestbook') === '0' ? [] : liveGuestbook(GUESTBOOK)))
  const [allOpen, setAllOpen] = useState(params.get('modal') === 'guestbook')
  const [visitorsOpen, setVisitorsOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const recent = useMemo(() => entries.slice(0, 3), [entries])
  const showPanel = panelOpen || mode !== 'info'
  const focusX = showPanel ? 0.403 : 0.5

  return (
    <main className={s.page}>
      <RoomView ownerId={me.id} interests={profile.interests} worn={mode === 'decor' ? draft : worn} focusX={focusX} label="내 땅굴">
        {mode === 'decor' ? (
          <span className={s.decorPill}><i aria-hidden /> 꾸미는 중 <span>바뀐 모습이 바로 보여요</span></span>
        ) : (
          <div className={s.sceneTools}>
            <SceneButton tone="cream" onClick={() => { setDraft(worn); setMode('decor') }}>땅굴 꾸미기</SceneButton>
            <SceneButton tone="mint" onClick={() => setVisitorsOpen(true)} aria-label={`지금 방문자 ${me.visitorsNow}명`}>
              <VisitorBadge count={me.visitorsNow ?? 0} />
            </SceneButton>
          </div>
        )}
        {mode !== 'decor' && <RoomModeToggle style={{ left: `${(showPanel ? 0.408 : 0.515) * 100}%` }} />}
      </RoomView>

      {mode === 'edit' && (
        <EditPanel
          profile={profile}
          affiliation={me.affiliation}
          onCancel={() => setMode('info')}
          onDecorate={() => { setDraft(worn); setMode('decor') }}
          onSave={(p) => { setProfile(p); setMode('info'); setToast('내 정보를 저장했어요') }}
        />
      )}

      {mode === 'decor' && (
        <DecorPanel
          draft={draft}
          setDraft={setDraft}
          picks={profile.interests}
          onCancel={() => setMode('info')}
          onSave={() => { setWorn(draft); setMode('info'); setToast('꾸민 모습을 저장했어요') }}
        />
      )}

      {mode === 'info' && (panelOpen ? (
        <aside className={s.panel} aria-label="내 정보">
          <div className={s.panelHead}>
            <h2 className="display">내 정보</h2>
            <span className={s.headLinks}>
              <button className="link-accent" onClick={() => setMode('edit')}>수정</button>
              <button className="link-accent" onClick={() => setPanelOpen(false)} aria-expanded="true">접기 ›</button>
            </span>
          </div>

          <div className={s.profile}>
            <Avatar size={64} empty />
            <div>
              <p className={`display ${s.nick}`}>{profile.nickname}</p>
              <p className={s.aff}>{me.affiliation}</p>
            </div>
          </div>

          <div className={`${s.introBox} ${s.introStatic}`}>
            <span className={s.introHead}>
              <strong>자기소개</strong>
              <span>{profile.intro.length} / {INTRO_MAX}</span>
            </span>
            <p className={s.introP}>{profile.intro || '아직 작성한 자기소개가 없어요.'}</p>
          </div>

          <section className={s.interests}>
            <p className={s.sectionLabel}>관심사 <span>{profile.interests.length}</span></p>
            <ChipList items={profile.interests} />
          </section>

          <section className={s.guestbook}>
            <h3 className={`display ${s.gbTitle}`}>방명록 <span className="count-badge">{entries.length}</span></h3>
            {entries.length === 0 ? (
              <div className={s.gbEmptyBox}><EmptyMole message="아직 아무도 방명록을 남기지 않았어요" /></div>
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
      ))}

      <GuestbookModal
        open={allOpen}
        onClose={() => setAllOpen(false)}
        entries={entries}
        onDelete={(id) => setEntries((list) => list.filter((g) => g.id !== id))}
      />

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

      <Toast open={!!toast} title={toast ?? ''} onClose={() => setToast(null)} />
    </main>
  )
}

/** 내 정보 수정 · 사이드바 교체 683:8058 */
function EditPanel({ profile, affiliation, onCancel, onSave, onDecorate }: {
  profile: { nickname: string; intro: string; interests: string[] }
  affiliation: string
  onCancel: () => void
  onSave: (p: { nickname: string; intro: string; interests: string[] }) => void
  onDecorate: () => void
}) {
  const [nickname, setNickname] = useState(profile.nickname === '닉네임' ? '새벽산책' : profile.nickname)
  const [intro, setIntro] = useState(profile.intro || '주말엔 캠핑 가고, 평일엔 보드게임 하는 두더지예요.')
  const [interests, setInterests] = useState(profile.interests)
  const [pickOpen, setPickOpen] = useState(false)

  return (
    <aside className={`${s.panel} ${s.formPanel}`} aria-label="내 정보 수정">
      <div className={s.panelHead}>
        <h2 className="display"><button className={s.backBtn} onClick={onCancel} aria-label="뒤로"><ChevronLeft size={20} /></button>내 정보 수정</h2>
      </div>
      <div className={s.profile}>
        <Avatar size={64} empty />
        <div>
          <p className={s.aff}>{affiliation}</p>
          <button className={s.outlineChip} onClick={onDecorate}>두더지 꾸미기</button>
        </div>
      </div>

      <div className={s.formField}>
        <label htmlFor="edit-nick">닉네임 <span>{nickname.length} / {NICK_MAX}</span></label>
        <input id="edit-nick" value={nickname} maxLength={NICK_MAX} onChange={(e) => setNickname(e.target.value)} />
      </div>
      <div className={s.formField}>
        <label htmlFor="edit-intro">자기소개 <span>{intro.length} / {INTRO_MAX}</span></label>
        <textarea id="edit-intro" value={intro} maxLength={INTRO_MAX} onChange={(e) => setIntro(e.target.value)} placeholder="아직 작성한 자기소개가 없어요." />
      </div>
      <div className={s.formField}>
        <span className={s.formLabel}>관심사 <span>{interests.length}개</span></span>
        <ChipList items={interests} />
        <button className={s.dashedBtn} onClick={() => setPickOpen(true)}><PlusIcon size={14} /> 관심사 다시 고르기</button>
        <p className={s.formNote}>관심사를 바꾸면 땅굴 가구도 함께 바뀌어요.</p>
      </div>

      <div className={s.panelActions}>
        <button className="btn btn-line" onClick={onCancel}>취소</button>
        <button className="btn btn-cta" disabled={!nickname.trim()} onClick={() => onSave({ nickname: nickname.trim(), intro, interests })}>저장하기</button>
      </div>

      <Modal open={pickOpen} onClose={() => setPickOpen(false)} width={420} labelledBy="repick-title">
        <div className={s.simpleModal}>
          <h2 id="repick-title" className="display">관심사 다시 고르기</h2>
          <p>관심사 고르기 화면(온보딩 2)으로 이어지는 흐름은 Figma에 아직 없어요. 지금은 빼기만 해 볼 수 있어요.</p>
          <div className={s.chipWrap}>
            {interests.map((i) => (
              <button key={i} className={s.removeChip} onClick={() => setInterests((l) => l.filter((x) => x !== i))}>{i} <CloseIcon size={12} /></button>
            ))}
          </div>
          <button className="btn btn-primary btn-block" onClick={() => setPickOpen(false)}>다 골랐어요</button>
        </div>
      </Modal>
    </aside>
  )
}

/** 꾸미기 모드 · 사이드바 변신 682:7764 — 가구 / 두더지 탭 */
function DecorPanel({ draft, setDraft, picks, onCancel, onSave }: { draft: string[]; setDraft: (w: string[]) => void; picks: string[]; onCancel: () => void; onSave: () => void }) {
  const [tab, setTab] = useState<'furniture' | 'mole'>('mole')
  return (
    <aside className={`${s.panel} ${s.formPanel}`} aria-label="땅굴 꾸미기">
      <div className={s.panelHead}>
        <h2 className="display">땅굴 꾸미기</h2>
        <button className={s.closeBtn} onClick={onCancel} aria-label="꾸미기 닫기"><CloseIcon size={18} /></button>
      </div>
      <div className={s.segment} role="tablist">
        <button role="tab" aria-selected={tab === 'furniture'} className={tab === 'furniture' ? s.segOn : s.seg} onClick={() => setTab('furniture')}>가구</button>
        <button role="tab" aria-selected={tab === 'mole'} className={tab === 'mole' ? s.segOn : s.seg} onClick={() => setTab('mole')}>두더지</button>
      </div>
      <div className={s.decorBody}>
        {tab === 'mole' ? (
          <MoleDresser worn={draft} onChange={setDraft} picks={picks} compact />
        ) : (
          <p className={s.formNote}>가구 탭은 Figma에 아직 화면이 없어요. 지금은 관심사에 맞춰 가구가 자동으로 놓여요.</p>
        )}
      </div>
      <div className={s.panelActions}>
        <button className="btn btn-line" onClick={onCancel}>취소</button>
        <button className="btn btn-cta" onClick={onSave}>저장하기</button>
      </div>
    </aside>
  )
}
