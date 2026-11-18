import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import RoomView from '../../components/RoomView'
import RoomModeToggle from '../../components/RoomModeToggle'
import SceneButton from '../../components/SceneButton'
import { ChipList } from '../../components/InterestChip'
import Avatar from '../../components/Avatar'
import { TOAST, Toast, type ToastSpec } from '../../components/Feedback'
import { PenIcon } from '../../components/Icons'
import { GUESTBOOK } from '../../data/mock'
import { getMyWorn, setMyWorn } from '../../data/moleItems'
import { getMyInterests, setMyInterests, toSubIds } from '../../data/interests'
import {
  MY_REGULARS_COUNT, defaultFurniture, getMyFurnChoice, getMyProfile, getMyRoomPick, myAffiliation, pruneChoice, qnaOf, setMyFurnChoice, setMyProfile,
  type FurnChoice,
} from '../../data/myBurrow'
import { roomLookOf } from '../../data/roomLook'
import { USERS, ME_ID } from '../../data/mock'
import { liveGuestbook } from '../../lib/format'
import GuestbookModal from './GuestbookModal'
import MyInfoEdit, { INTRO_MAX, type EditDraft } from './MyInfoEdit'
import DecorPanel, { type DecorTab } from './DecorPanel'
import FxPanel from '../../components/FxPanel'
import s from './Burrow.module.css'
import m from './MyBurrow.module.css'

type Mode = 'info' | 'edit' | 'decor'
/** 관심사 이펙트: 내 땅굴 (나와 같은 관심사는 없음). 같은 객체를 써서 장면을 다시 만들지 않게 */
const MY_FX = {}

/**
 * 땅굴 메인 – 내 땅굴 (02 F4 "스켈레톤 기능 명세" 기준으로 다시 맞춤, 2026-11-16. docs/spec-f3-f4.md)
 * 1 "땅굴 꾸미기" → 꾸미기 모드. 마우스를 올리면 아래에 안내 말풍선(닫기 버튼 없음, 벗어나면 사라짐)
 * 2 상태 배지 "단골 N명" (숫자만, 누구인지는 안 보여줌)
 * 3 땅굴을 화면 전체에. 가구를 누르면 그 관심사 이름 말풍선 (three/roomScene)
 * 4 내 정보 카드: 닉네임, 캠퍼스 · 기수 · 층, 자기소개, 관심사 태그 / 7 관심사 아래 질문 3개와 답변(펼친 채로)
 * 5 연필 → 내 정보 수정 (카드가 수정 패널로 바뀜) / 6 자기소개가 없으면 안내 + "자기소개 쓰기" → 내 정보 수정
 * 8 우체통(방명록): 방 안 3D 우체통. 새 글이 있으면 깃발·편지·빛, 누르면 방명록 전체 보기 (내 땅굴에선 글을 못 씀)
 * 9 "접기 ›" → 카드가 접혀 땅굴이 넓게, 접힌 동안 "방노트" 버튼으로 다시 펼침
 * 데모용 쿼리: ?guestbook=0, ?panel=closed, ?modal=guestbook, ?mode=edit, ?mode=decor(&tab=mole), ?intro=0(자기소개 빈 상태), ?mailbox=1
 */
export default function MyBurrow() {
  const [params] = useSearchParams()
  const [panelOpen, setPanelOpen] = useState(params.get('panel') !== 'closed')
  const [mode, setMode] = useState<Mode>(() => (params.get('mode') === 'edit' ? 'edit' : params.get('mode') === 'decor' ? 'decor' : 'info'))
  const [profile, setProfile] = useState(() => { const p = getMyProfile(); return params.get('intro') === '0' ? { ...p, intro: '' } : p })
  const [interests, setInterests] = useState(() => getMyInterests(USERS[ME_ID].interests))
  // 내가 직접 고른 방 값 (벽지 등. 가구 선택은 furn). 계산 값은 저장하지 않음 (data/myBurrow getMyRoomPick)
  const [roomPick] = useState(getMyRoomPick)
  const [worn, setWorn] = useState<string[]>(getMyWorn)
  const [wornDraft, setWornDraft] = useState<string[]>(worn)
  const [furn, setFurn] = useState<FurnChoice>(() => pruneChoice(getMyFurnChoice(), interests))
  const [furnDraft, setFurnDraft] = useState<FurnChoice>(furn)
  const [tab, setTab] = useState<DecorTab>(params.get('tab') === 'mole' ? 'mole' : 'furniture')
  const [focusSub, setFocusSub] = useState<string | null>(null)
  const [hintOn, setHintOn] = useState(params.get('hint') === '1')
  const [focusIntro, setFocusIntro] = useState(false)
  const [entries, setEntries] = useState(() => (params.get('guestbook') === '0' ? [] : liveGuestbook(GUESTBOOK)))
  const [allOpen, setAllOpen] = useState(params.get('modal') === 'guestbook')
  const [toast, setToast] = useState<ToastSpec | null>(null)
  /*
   * 방명록 우체통 (3D 핸드오프 v3.6): 읽지 않은 방명록이 있으면 깃발이 올라가고 빛남. 방명록 전체 보기를 열면 읽음 → 내려감.
   * 목 데이터: 읽음은 이 탭 안에서만 기억(sessionStorage). ?mailbox=1 이면 다시 새 방명록 있음으로 시작
   */
  const [gbRead, setGbRead] = useState(() => params.get('mailbox') !== '1' && gbSeen())
  useEffect(() => { if (allOpen && !gbRead) { setGbRead(true); markGbSeen() } }, [allOpen, gbRead])
  const hasNewGb = entries.length > 0 && !gbRead

  const startDecor = (t: DecorTab = 'furniture') => { setWornDraft(worn); setFurnDraft(furn); setTab(t); setMode('decor'); setHintOn(false) }
  const decorDirty = wornDraft.join(',') !== worn.join(',') || JSON.stringify(furnDraft) !== JSON.stringify(furn)
  const firstSub = useMemo(() => toSubIds(interests).find((id) => defaultFurniture(id)) ?? null, [interests])
  const highlight = mode === 'decor' && tab === 'furniture' ? focusSub ?? firstSub : null
  const showPanel = panelOpen || mode !== 'info'
  const focusX = showPanel ? 0.403 : 0.5
  const qna = qnaOf(profile.qna)
  // 방 모습: 남이 내 땅굴을 볼 때(VisitBurrow)와 같은 함수 (data/roomLook.ts). 꾸미는 중이면 고르는 중인 가구로
  const shownFurn = mode === 'decor' ? furnDraft : furn
  const look = useMemo(() => roomLookOf(ME_ID, interests, { ...roomPick, furniture: shownFurn }), [interests, roomPick, shownFurn])

  const saveEdit = (d: EditDraft) => {
    const moved = d.campus !== profile.campus || d.floor !== profile.floor
    const { interests: nextInt, ...p } = d
    setMyProfile(p); setProfile(p)
    if (nextInt.join('|') !== interests.join('|')) {
      setMyInterests(nextInt); setInterests(nextInt)
      // 뺀 관심사의 가구는 사라지고 그대로 둔 관심사는 유지, 새 관심사는 기본 가구 (F4 가구 탭 3번)
      const c = pruneChoice(furn, nextInt); setFurn(c); setFurnDraft(c); setMyFurnChoice(c)
      // 땅굴 무드(벽)는 대표 관심사(맨 앞)의 대분류가 달라질 때만 바뀜 → roomLookOf 가 관심사로 계산하므로 따로 저장하지 않음
      setFocusSub(null)
    }
    setMode('info'); setFocusIntro(false)
    setToast(moved ? { title: TOAST.edited.title, desc: `이번 학기 들판의 내 땅굴 입구가 ${d.campus}-${d.floor}층으로 옮겨졌어요` } : TOAST.edited)
  }
  const saveDecor = () => {
    setWorn(wornDraft); setMyWorn(wornDraft)
    setFurn(furnDraft); setMyFurnChoice(furnDraft)
    setMode('info'); setToast(TOAST.edited)
  }

  return (
    <main className={s.page}>
      <RoomView ownerId={ME_ID} interests={interests} wallpaper={look.wallpaper} worn={mode === 'decor' ? wornDraft : worn} focusX={focusX} label="내 땅굴"
        furniture={look.furniture} highlight={highlight}
        mailbox={hasNewGb} onMailbox={() => setAllOpen(true)} fx={MY_FX}>
        {mode === 'decor' ? (
          <span className={s.decorPill}><i aria-hidden /> 꾸미는 중 · 바뀐 모습이 바로 보여요</span>
        ) : (
          <div className={s.sceneTools}>
            <span className={m.decorWrap} onMouseEnter={() => setHintOn(true)} onMouseLeave={() => setHintOn(false)}>
              <SceneButton tone="cream" onClick={() => startDecor()} onFocus={() => setHintOn(true)} onBlur={() => setHintOn(false)} aria-describedby={hintOn ? 'decor-hint' : undefined}>땅굴 꾸미기</SceneButton>
              {hintOn && (
                <p id="decor-hint" className={`${s.decorHint} ${m.decorHint}`} role="tooltip">
                  내가 직접 방을 꾸밀 수 있어요.<br />다양한 가구들을 사용해 보세요!
                </p>
              )}
            </span>
            <span className={m.regulars} aria-label={`단골 ${MY_REGULARS_COUNT}명`}><i aria-hidden />단골 <b>{MY_REGULARS_COUNT}명</b></span>
          </div>
        )}
        {mode !== 'decor' && <RoomModeToggle style={{ left: `${(showPanel ? 0.408 : 0.515) * 100}%` }} />}
        {/* 관심사 이펙트 켜고 끄기 (docs/interest-effects.md). 정보 패널 왼쪽 아래 */}
        <FxPanel area="room" style={{ right: showPanel ? 388 : 33 }} />
      </RoomView>

      {mode === 'edit' && (
        <MyInfoEdit
          initial={{ ...profile, interests }}
          focusIntro={focusIntro}
          onCancel={() => { setMode('info'); setFocusIntro(false) }}
          onSave={saveEdit}
        />
      )}

      {mode === 'decor' && (
        <DecorPanel tab={tab} setTab={setTab} picks={interests}
          worn={wornDraft} setWorn={setWornDraft} furn={furnDraft} setFurn={setFurnDraft}
          focusSub={focusSub} setFocusSub={setFocusSub} dirty={decorDirty}
          onCancel={() => { setWornDraft(worn); setFurnDraft(furn); setMode('info') }}
          onSave={saveDecor} />
      )}

      {mode === 'info' && (panelOpen ? (
        <aside className={`${s.panel} ${m.infoPanel}`} aria-label="내 정보">
          <div className={s.panelHead}>
            <h2 className="display">내 정보</h2>
            <button className="link-accent" onClick={() => setPanelOpen(false)} aria-expanded="true">접기 ›</button>
          </div>

          <div className={s.profile}>
            <Avatar size={64} empty />
            <div>
              <p className={`display ${s.nick}`}>{profile.nickname}</p>
              <p className={s.aff}>{myAffiliation(profile)}</p>
            </div>
            <button className={s.penBtn} onClick={() => setMode('edit')} aria-label="내 정보 수정" title="내 정보 수정"><PenIcon size={16} /></button>
          </div>

          <div className={m.introCard}>
            <span className={s.introHead}><strong>자기소개</strong><span>{profile.intro.length} / {INTRO_MAX}</span></span>
            {profile.intro ? <p className={s.introP}>{profile.intro}</p> : (
              <>
                <p className={m.introEmpty}>아직 작성한 자기소개가 없어요.</p>
                <button className={m.introWrite} onClick={() => { setFocusIntro(true); setMode('edit') }}><PenIcon size={12} /> 자기소개 쓰기</button>
              </>
            )}
          </div>

          <section className={s.interests}>
            <p className={s.sectionLabel}>관심사 <span>{interests.length}</span></p>
            <ChipList items={interests} />
          </section>

          <section className={m.qnaSec} aria-labelledby="my-qna">
            <h3 id="my-qna" className="display">Q&amp;A</h3>
            <dl className={s.qna}>
              {qna.map((x, i) => <div key={i}><dt>Q{i + 1}. {x.q.text}</dt><dd>{x.a}</dd></div>)}
            </dl>
          </section>
        </aside>
      ) : (
        <button className={s.reopen} onClick={() => setPanelOpen(true)} aria-expanded="false">
          <span className="display">방노트</span>
          <Avatar size={22} />
        </button>
      ))}

      <GuestbookModal
        open={allOpen}
        onClose={() => setAllOpen(false)}
        entries={entries}
        onDelete={(id) => setEntries((list) => list.filter((g) => g.id !== id))}
      />

      <Toast open={!!toast} title={toast?.title ?? ''} desc={toast?.desc} onClose={() => setToast(null)} />
    </main>
  )
}

const GB_READ_KEY = 'digul.guestbookRead'
const gbSeen = () => { try { return sessionStorage.getItem(GB_READ_KEY) === '1' } catch { return false } }
const markGbSeen = () => { try { sessionStorage.setItem(GB_READ_KEY, '1') } catch { /* 무시 */ } }
