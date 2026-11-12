import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import RoomView from '../../components/RoomView'
import { getMyWallpaper, wallpaperForPicks } from '../../data/wallpapers'
import RoomModeToggle from '../../components/RoomModeToggle'
import SceneButton, { VisitorBadge } from '../../components/SceneButton'
import { ChipList } from '../../components/InterestChip'
import GuestbookItem from '../../components/GuestbookItem'
import Avatar from '../../components/Avatar'
import Modal from '../../components/Modal'
import MoleDresser from '../../components/MoleDresser'
import { EmptyMole, Toast } from '../../components/Feedback'
import { ChevronLeft, CloseIcon, PenIcon, PlusIcon } from '../../components/Icons'
import { GUESTBOOK, ME_ID, USERS } from '../../data/mock'
import { getMyWorn, setMyWorn } from '../../data/moleItems'
import { INTEREST_CATS, categoriesOf, getMyFurniture, getMyInterests, setMyFurniture, setMyInterests } from '../../data/interests'
import { BLOCK_COLORS, FURNITURE_CATALOG } from '../../data/roomPlan'
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
 * - 2026-11-12: 꾸미기 모드 · 가구 탭 711:7994 (카테고리마다 가구 하나 고르기 → 방에 바로 보임),
 *   꾸미기 안내 말풍선 711:8541 (처음 한 번, ×로 닫음, ?hint=1 로 다시 보기), 닉네임 옆 연필 아이콘 = 내 정보 수정 (Figma 메모 691:17077)
 * 데모용 쿼리: ?guestbook=0, ?panel=closed, ?modal=guestbook, ?mode=edit, ?mode=decor
 */
export default function MyBurrow() {
  const [params] = useSearchParams()
  const me = USERS[ME_ID]
  const [panelOpen, setPanelOpen] = useState(params.get('panel') !== 'closed')
  const [mode, setMode] = useState<Mode>(() => (params.get('mode') === 'edit' ? 'edit' : params.get('mode') === 'decor' ? 'decor' : 'info'))
  const [profile, setProfile] = useState(() => ({ nickname: me.nickname, intro: me.intro, interests: getMyInterests(me.interests) }))
  const [worn, setWorn] = useState<string[]>(getMyWorn)
  const [draft, setDraft] = useState<string[]>(worn)   // 꾸미는 중인 모습 (방 두더지에 바로 보임)
  const [furn, setFurn] = useState<Record<string, string>>(getMyFurniture)
  const [furnDraft, setFurnDraft] = useState<Record<string, string>>(furn)
  const [hint, setHint] = useState(() => params.get('hint') === '1' || !seen(HINT_KEY))
  const startDecor = () => { setDraft(worn); setFurnDraft(furn); setMode('decor'); setHint(false); markSeen(HINT_KEY) }
  const [entries, setEntries] = useState(() => (params.get('guestbook') === '0' ? [] : liveGuestbook(GUESTBOOK)))
  const [allOpen, setAllOpen] = useState(params.get('modal') === 'guestbook')
  const [visitorsOpen, setVisitorsOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const recent = useMemo(() => entries.slice(0, 3), [entries])
  const showPanel = panelOpen || mode !== 'info'
  const focusX = showPanel ? 0.403 : 0.5

  return (
    <main className={s.page}>
      <RoomView ownerId={me.id} interests={profile.interests} wallpaper={getMyWallpaper(wallpaperForPicks(profile.interests))} worn={mode === 'decor' ? draft : worn} focusX={focusX} label="내 땅굴">
        {mode === 'decor' ? (
          <span className={s.decorPill}><i aria-hidden /> 꾸미는 중 <span>바뀐 모습이 바로 보여요</span></span>
        ) : (
          <div className={s.sceneTools}>
            <SceneButton tone="cream" onClick={startDecor}>땅굴 꾸미기</SceneButton>
            <SceneButton tone="mint" onClick={() => setVisitorsOpen(true)} aria-label={`지금 방문자 ${me.visitorsNow}명`}>
              <VisitorBadge count={me.visitorsNow ?? 0} />
            </SceneButton>
            {hint && (
              <p className={s.decorHint} role="note">
                내가 직접 방을 꾸밀 수 있어요.<br />다양한 가구들을 사용해 보세요!
                <button onClick={() => { setHint(false); markSeen(HINT_KEY) }} aria-label="안내 닫기"><CloseIcon size={12} /></button>
              </p>
            )}
          </div>
        )}
        {mode !== 'decor' && <RoomModeToggle style={{ left: `${(showPanel ? 0.408 : 0.515) * 100}%` }} />}
      </RoomView>

      {mode === 'edit' && (
        <EditPanel
          profile={profile}
          affiliation={me.affiliation}
          onCancel={() => setMode('info')}
          onDecorate={startDecor}
          onSave={(p) => { setProfile(p); setMyInterests(p.interests); setMode('info'); setToast('내 정보를 저장했어요') }}
        />
      )}

      {mode === 'decor' && (
        <DecorPanel
          draft={draft}
          setDraft={setDraft}
          furn={furnDraft}
          setFurn={setFurnDraft}
          picks={profile.interests}
          onCancel={() => setMode('info')}
          onSave={() => { setWorn(draft); setMyWorn(draft); setFurn(furnDraft); setMyFurniture(furnDraft); setMode('info'); setToast('꾸민 모습을 저장했어요') }}
        />
      )}

      {mode === 'info' && (panelOpen ? (
        <aside className={s.panel} aria-label="내 정보">
          <div className={s.panelHead}>
            <h2 className="display">내 정보</h2>
            <span className={s.headLinks}>
              <button className="link-accent" onClick={() => setPanelOpen(false)} aria-expanded="true">접기 ›</button>
            </span>
          </div>

          <div className={s.profile}>
            <Avatar size={64} empty />
            <div>
              <p className={`display ${s.nick}`}>{profile.nickname}</p>
              <p className={s.aff}>{me.affiliation}</p>
            </div>
            <button className={s.penBtn} onClick={() => setMode('edit')} aria-label="내 정보 수정" title="내 정보 수정"><PenIcon size={16} /></button>
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

const HINT_KEY = 'digul.decorHintSeen'
const seen = (k: string) => { try { return localStorage.getItem(k) === '1' } catch { return false } }
const markSeen = (k: string) => { try { localStorage.setItem(k, '1') } catch { /* 무시 */ } }

/** 꾸미기 모드 · 사이드바 변신 682:7764 — 가구 / 두더지 탭 (가구 탭 711:7994, 2026-11-12) */
function DecorPanel({ draft, setDraft, furn, setFurn, picks, onCancel, onSave }: { draft: string[]; setDraft: (w: string[]) => void; furn: Record<string, string>; setFurn: (f: Record<string, string>) => void; picks: string[]; onCancel: () => void; onSave: () => void }) {
  const [tab, setTab] = useState<'furniture' | 'mole'>('furniture')
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
          <FurniturePicker picks={picks} furn={furn} setFurn={setFurn} />
        )}
      </div>
      <div className={s.panelActions}>
        <button className="btn btn-line" onClick={onCancel}>취소</button>
        <button className="btn btn-cta" onClick={onSave}>저장하기</button>
      </div>
    </aside>
  )
}

/**
 * 꾸미기 모드 · 가구 탭 (2026-11-12 Figma 711:7994)
 * 관심사 카테고리 칩 → 그 카테고리 가구 카드 중 하나 고르기 ("3개 중 1개"). 고른 표시만 하고 방 배치는 그대로 (2026-11-12 사용자 확인)
 * 카드 그림은 Figma "Furniture PNG"(815:10748)를 아직 못 받아서 카테고리 색 상자 + 이름으로 대신함
 * 내 관심사가 아닌 카테고리는 볼 수만 있고 고를 수 없음 (가구는 관심사를 고르면 생김)
 */
function FurniturePicker({ picks, furn, setFurn }: { picks: string[]; furn: Record<string, string>; setFurn: (f: Record<string, string>) => void }) {
  const mine = categoriesOf(picks)
  const [cat, setCat] = useState(() => mine[0] ?? INTEREST_CATS[0].id)
  const cd = INTEREST_CATS.find((c) => c.id === cat) ?? INTEREST_CATS[0]
  const rows = cd.furniture.map((id) => FURNITURE_CATALOG.find((r) => r.id === id)).filter((r): r is NonNullable<typeof r> => !!r)
  const owned = mine.includes(cd.id)
  const chosen = furn[cd.id]
  return (
    <div className={s.furnTab}>
      <p className={s.furnInfo}>ⓘ 관심사마다 가구를 하나씩 골라요.<br />관심사를 바꾸면 가구도 자동으로 바뀌어요.</p>
      <div className={s.furnCats} role="tablist" aria-label="관심사 카테고리">
        {INTEREST_CATS.map((c) => (
          <button key={c.id} role="tab" aria-selected={c.id === cd.id} className={c.id === cd.id ? s.furnCatOn : mine.includes(c.id) ? s.furnCat : `${s.furnCat} ${s.furnCatOff}`} onClick={() => setCat(c.id)}>{c.name_ko}</button>
        ))}
      </div>
      <p className={s.furnHead}><strong>{cd.name_ko} 가구 고르기</strong><span>{rows.length ? `${rows.length}개 중 ${chosen ? 1 : rows.length}개` : ''}</span></p>
      {rows.length === 0 ? (
        <p className={s.formNote}>반려동물은 고른 관심사마다 동물과 용품이 짝으로 놓여요. 고를 가구가 없어요.</p>
      ) : (
        <ul className={s.furnGrid}>
          {rows.map((r) => {
            const on = chosen === r.id
            return (
              <li key={r.id}>
                <button className={on ? s.furnCardOn : s.furnCard} disabled={!owned} aria-pressed={on}
                  onClick={() => { const next = { ...furn }; if (on) delete next[cd.id]; else next[cd.id] = r.id; setFurn(next) }}>
                  <span className={s.furnThumb} style={{ background: BLOCK_COLORS[cd.id] ?? '#F7E6C8' }} aria-hidden />
                  {r.name_ko}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {!owned && rows.length > 0 && <p className={s.formNote}>{cd.name_ko} 관심사를 고르면 이 가구들을 놓을 수 있어요. (내 정보 수정에서 관심사 바꾸기)</p>}
      {owned && rows.length > 0 && !chosen && <p className={s.formNote}>지금은 {cd.name_ko} 가구가 모두 놓여 있어요. 하나를 고르면 그 가구만 남아요.</p>}
    </div>
  )
}
