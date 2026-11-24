import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from '@/lib/nav'
import RoomView from '../../components/RoomView'
import RoomModeToggle from '../../components/RoomModeToggle'
import SceneButton from '../../components/SceneButton'
import { ChipList } from '../../components/InterestChip'
import Avatar from '../../components/Avatar'
import { TOAST, Toast, type ToastSpec } from '../../components/Feedback'
import { QueryGate, SkeletonLines } from '../../components/AsyncState'
import { PenIcon } from '../../components/Icons'
import { ME_ID } from '../../data/mock'
import { NO_SAVED_ROOM, roomLookOf } from '../../data/roomLook'
import { toastApiError, useOptimistic } from '../../api'
import {
  BURROW_ERRORS, burrowKeys, reportGuestbookEntry, useDeleteGuestbookEntry, useGuestbookEntries, useMyBurrow, useUpdateMole, type MyBurrowVM,
} from '../../api/burrow'
import GuestbookModal from './GuestbookModal'
import MyInfoEdit, { INTRO_MAX } from './MyInfoEdit'
import { lengthOf } from '../../lib/validation'
import DecorPanel from './DecorPanel'
import FxPanel from '../../components/FxPanel'
import s from './Burrow.module.css'
import m from './MyBurrow.module.css'

type Mode = 'info' | 'edit' | 'decor'
/** 관심사 이펙트: 내 땅굴 (나와 같은 관심사는 없음). 같은 객체를 써서 장면을 다시 만들지 않게 */
const MY_FX = {}

/**
 * 땅굴 메인 – 내 땅굴 (명세 04, 2026-11-22 API v1 맞춤). 값은 모두 GET /me/burrow (api/burrow useMyBurrow)
 * 1 "땅굴 꾸미기" → 꾸미기 모드(두더지 탭만, 명세 dev 9ea6698. 가구 탭은 2026-11-23 다시 뺌). 마우스를 올리면 아래에 안내 말풍선(닫기 버튼 없음, 벗어나면 사라짐)
 * 2 상태 배지 "단골 N명" (regularCount, 숫자만)
 * 3 땅굴을 화면 전체에. 가구 · 무드는 API 없이 관심사로 정함 (가구는 세부 관심사마다 정해진 하나 = 맨 앞 단어, 무드는 대표 관심사의 대분류). 가구를 누르면 관심사 이름 말풍선
 * 4 내 정보 카드: 닉네임, 캠퍼스 · 기수 · 층, 자기소개, 관심사 태그 / 7 관심사 아래 질문 3개와 답변(펼친 채로)
 * 5 연필 → 내 정보 수정 (카드가 수정 패널로, PATCH /me/profile) / 6 자기소개가 없으면 안내 + "자기소개 쓰기" → 내 정보 수정
 * 8 우체통(방명록): 글이 하나라도 있으면(guestbookCount ≥ 1) 깃발 · 편지 · 빛, 없으면 꺼짐. 누르면 방명록 전체 보기
 *   (GET /burrows/{burrowId}/guestbook-entries 5개씩 페이지, DELETE /guestbook-entries/{id}, 신고 POST /reports GUESTBOOK). 내 땅굴에선 글을 못 씀
 * 9 "접기 ›" → 카드가 접혀 땅굴이 넓게, 접힌 동안 "방노트" 버튼으로 다시 펼침
 * 데모용 쿼리: ?panel=closed, ?modal=guestbook, ?mode=edit, ?mode=decor, ?intro=0(자기소개 빈 상태). 빈 방명록 · 실패는 ?api=empty · ?api=fail
 */
export default function MyBurrow() {
  const q = useMyBurrow()
  return (
    <QueryGate q={q} skeleton={
      <main className={s.page}><div role="status" aria-busy="true" aria-label="내 땅굴을 불러오는 중" style={{ padding: 32, maxWidth: 420 }}><SkeletonLines lines={5} /></div></main>
    }>
      {(b) => <MyBurrowView b={b} />}
    </QueryGate>
  )
}

function MyBurrowView({ b }: { b: MyBurrowVM }) {
  const [params, setParams] = useSearchParams()
  const [panelOpen, setPanelOpen] = useState(params.get('panel') !== 'closed')
  const [mode, setMode] = useState<Mode>(() => (params.get('mode') === 'edit' ? 'edit' : params.get('mode') === 'decor' ? 'decor' : 'info'))
  const intro = params.get('intro') === '0' ? '' : b.intro
  const [wornDraft, setWornDraft] = useState<string[]>(b.worn)
  const [hintOn, setHintOn] = useState(params.get('hint') === '1')
  const [focusIntro, setFocusIntro] = useState(false)
  const [allOpen, setAllOpen] = useState(params.get('modal') === 'guestbook')
  const [gbPage, setGbPage] = useState(1)
  const [toast, setToast] = useState<ToastSpec | null>(null)

  const mole = useUpdateMole()
  const gb = useGuestbookEntries(b.burrowId, gbPage, { enabled: allOpen })
  const delGb = useDeleteGuestbookEntry(b.burrowId)
  // 지운 뒤 마지막 페이지가 비면 한 페이지 앞으로
  useEffect(() => { if (gb.data && gb.data.totalPages > 0 && gbPage > gb.data.totalPages) setGbPage(gb.data.totalPages) }, [gb.data, gbPage])
  useEffect(() => { if (allOpen) setGbPage(1) }, [allOpen])
  // 이미 내 땅굴에 있을 때 방명록 알림을 누르면(→ ?modal=guestbook, 명세 09 GUESTBOOK) 화면이 그대로라 여기서 열어 줌
  // (effect 대신 렌더 중에 주소가 바뀐 것을 보고 맞춤: React 권장 "이전 값과 비교해 상태 맞추기")
  const modalParam = params.get('modal')
  const [seenModal, setSeenModal] = useState(modalParam)
  if (modalParam !== seenModal) { setSeenModal(modalParam); if (modalParam === 'guestbook') setAllOpen(true) }
  // 닫을 때 주소의 modal 도 지움 (다음 알림이 다시 주소를 바꿔 열 수 있게)
  const closeGuestbook = () => {
    setAllOpen(false)
    if (params.has('modal')) setParams((p) => { p.delete('modal'); return p }, { replace: true })
  }

  const startDecor = () => { setWornDraft(b.worn); setMode('decor'); setHintOn(false) }
  const decorDirty = wornDraft.join(',') !== b.worn.join(',')
  const showPanel = panelOpen || mode !== 'info'
  const focusX = showPanel ? 0.403 : 0.5
  // 방 모습: 관심사로만 정함 (명세: 가구는 세부 관심사마다 하나로 정해져 있고 방을 꾸미는 값을 저장하는 API 는 없음). 남이 내 땅굴을 볼 때와 같은 함수 (data/roomLook.ts)
  const look = useMemo(() => roomLookOf(ME_ID, b.interests, NO_SAVED_ROOM), [b.interests])

  const saveDecor = () => mole.mutate(wornDraft, {
    onSuccess: () => { setMode('info'); setToast(TOAST.edited) },
    onError: (e) => toastApiError(e, '두더지를 저장하지 못했어요', BURROW_ERRORS),
  })
  const onSaved = (next: MyBurrowVM, moved: boolean) => {
    setMode('info'); setFocusIntro(false)
    setToast(moved ? { title: TOAST.edited.title, desc: `이번 학기 들판의 내 땅굴 입구가 ${next.campus}-${next.floor}층으로 옮겨졌어요` } : TOAST.edited)
  }
  const deleteEntry = (id: string) => new Promise<boolean>((resolve) => delGb.mutate(id, {
    onSuccess: () => resolve(true),
    onError: (e) => { toastApiError(e, '방명록을 지우지 못했어요', BURROW_ERRORS); resolve(false) },
  }))
  // 신고가 쌓여 가려지면 목록 · 글 수에서 빠지므로(명세 04) 끝나면 방명록과 내 땅굴을 다시 받음 (방문자 뷰 VisitBurrow 와 같음)
  const run = useOptimistic()
  const report = (id: string, reason: string) => run.mutate({ call: () => reportGuestbookEntry(id, reason), errorTitle: '신고하지 못했어요', errors: BURROW_ERRORS, invalidate: [burrowKeys.guestbook(b.burrowId), burrowKeys.mine] })

  return (
    <main className={s.page}>
      <RoomView ownerId={ME_ID} interests={b.interests} wallpaper={look.wallpaper} style={look.style} worn={mode === 'decor' ? wornDraft : b.worn} focusX={focusX} label="내 땅굴"
        furniture={look.furniture}
        mailbox={b.guestbookCount > 0} onMailbox={() => setAllOpen(true)} fx={MY_FX}>
        {mode === 'decor' ? (
          <span className={s.decorPill}><i aria-hidden /> 꾸미는 중 · 바뀐 모습이 바로 보여요</span>
        ) : (
          <div className={s.sceneTools}>
            <span className={m.decorWrap} onMouseEnter={() => setHintOn(true)} onMouseLeave={() => setHintOn(false)}>
              <SceneButton tone="cream" onClick={startDecor} onFocus={() => setHintOn(true)} onBlur={() => setHintOn(false)} aria-describedby={hintOn ? 'decor-hint' : undefined}>땅굴 꾸미기</SceneButton>
              {hintOn && (
                <p id="decor-hint" className={`${s.decorHint} ${m.decorHint}`} role="tooltip">
                  내 두더지를 꾸밀 수 있어요.<br />가구는 고른 관심사로 정해져요!
                </p>
              )}
            </span>
            <span className={m.regulars} aria-label={`단골 ${b.regularCount}명`}><i aria-hidden />단골 <b>{b.regularCount}명</b></span>
          </div>
        )}
        {mode !== 'decor' && <RoomModeToggle style={{ left: `${(showPanel ? 0.408 : 0.515) * 100}%` }} />}
        {/* 관심사 이펙트 켜고 끄기 (docs/interest-effects.md). 정보 패널 왼쪽 아래 */}
        <FxPanel area="room" style={{ right: showPanel ? 388 : 33 }} />
      </RoomView>

      {mode === 'edit' && (
        <MyInfoEdit initial={{ ...b, intro }} focusIntro={focusIntro} onCancel={() => { setMode('info'); setFocusIntro(false) }} onSaved={onSaved} />
      )}

      {mode === 'decor' && (
        <DecorPanel worn={wornDraft} setWorn={setWornDraft} dirty={decorDirty} saving={mole.isPending}
          onCancel={() => { setWornDraft(b.worn); setMode('info') }}
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
              <p className={`display ${s.nick}`}>{b.nickname}</p>
              <p className={s.aff}>SSAFY {b.gen ?? ''}기 · {b.campus} · {b.floor}층</p>
            </div>
            <button className={s.penBtn} onClick={() => setMode('edit')} aria-label="내 정보 수정" title="내 정보 수정"><PenIcon size={16} /></button>
          </div>

          <div className={m.introCard}>
            <span className={s.introHead}><strong>자기소개</strong><span>{lengthOf(intro)} / {INTRO_MAX}</span></span>
            {intro ? <p className={s.introP}>{intro}</p> : (
              <>
                <p className={m.introEmpty}>아직 작성한 자기소개가 없어요.</p>
                <button className={m.introWrite} onClick={() => { setFocusIntro(true); setMode('edit') }}><PenIcon size={12} /> 자기소개 쓰기</button>
              </>
            )}
          </div>

          <section className={s.interests}>
            <p className={s.sectionLabel}>관심사 <span>{b.interests.length}</span></p>
            <ChipList items={b.interests} />
          </section>

          <section className={m.qnaSec} aria-labelledby="my-qna">
            <h3 id="my-qna" className="display">Q&amp;A</h3>
            <dl className={s.qna}>
              {b.answers.map((x) => <div key={x.slot}><dt>Q{x.slot}. {x.question}</dt><dd>{x.answer}</dd></div>)}
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
        onClose={closeGuestbook}
        entries={gb.data?.items ?? []}
        server={{ page: gb.data?.page ?? gbPage, totalPages: gb.data?.totalPages ?? 0, totalItems: gb.data?.totalItems ?? b.guestbookCount, onPage: setGbPage, fetching: gb.isFetching }}
        load={{ loading: gb.isPending, error: gb.error, onRetry: () => void gb.refetch(), retrying: gb.isFetching }}
        onDelete={deleteEntry}
        // 서로 다른 3명이 신고하면 서버가 가려 목록 · 글 수에서 뺌 (한 사람의 신고로는 그대로 보임)
        onReport={report}
      />

      <Toast open={!!toast} title={toast?.title ?? ''} desc={toast?.desc} onClose={() => setToast(null)} />
    </main>
  )
}
