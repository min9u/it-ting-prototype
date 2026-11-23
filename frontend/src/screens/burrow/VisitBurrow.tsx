import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import NotFound from '../../components/NotFound'
import { roomLookOf } from '../../data/roomLook'
import { Navigate, useNavigate, useParams, useSearchParams } from '@/lib/nav'
import RoomView from '../../components/RoomView'
import { getMyWorn } from '../../data/moleItems'
import RoomModeToggle from '../../components/RoomModeToggle'
import Modal from '../../components/Modal'
import { ReportDialog, TOAST, Toast } from '../../components/Feedback'
import { ChatIcon, SendIcon } from '../../components/Icons'
import MoundMole from '../../components/MoundMole'
import { ME_ID, USERS } from '../../data/mock'
import GuestbookModal from './GuestbookModal'
import { NotePanel, RoomNoteBody, useNotePanel } from './RoomNote'
import SceneButton from '../../components/SceneButton'
import { Link } from '@/lib/nav'
import { api, errorText, isApiError, toastApiError, useOptimistic } from '../../api'
import { reportBody } from '../../api/community'
import {
  ALREADY_RECEIVED_TEXT, EXPLORE_ERRORS, exploreHrefOf, exploreKeys, useSendChatRequest, useVisitActions, useVisitBurrow, type BurrowVM,
} from '../../api/explore'
import { BURROW_ERRORS, burrowKeys, useDeleteGuestbookEntry, useGuestbookEntries } from '../../api/burrow'
import { ErrorState, QueryGate, Skeleton, SkeletonLines } from '../../components/AsyncState'
import s from './Burrow.module.css'
import { CHAT_REQUEST_MAX, GUESTBOOK_MAX } from '../../lib/validation'
import FxPanel from '../../components/FxPanel'
import { getMyInterests } from '../../data/interests'
import { talkMoodOf } from '../../data/interestFx'

// 방명록 50자 · 대화 요청 인사 50자 (lib/validation.ts, 05 명세)
const GB_MAX = GUESTBOOK_MAX
const QUICK = ['땅굴 구경 잘했어요!', '같이 게임 한 판 해요', '그림 이야기 나눠요']

/**
 * 땅굴 – 방문자 뷰 (예린이의 땅굴) 510:13663 외 3변형 · 대화 요청 팝업 495:13898
 * 2026-11-21: 495:13840(방노트 접힘) · 510:13152(방노트 펼침) · 510:13663(방명록)에 맞춤 — 접힌 채 시작, 제목 칩 없음, 사이드바는 탐색과 같은 방노트, 방명록은 우체통 창 안
 * 대화 요청 완료 토스트 612:7718 (2026-11-11 추가, 스크린샷 대조): 보내면 팝업을 닫고 아래쪽에 토스트
 * 2026-11-22 API v1 (docs/backend/api-v1/05-explore-visit.md): GET /users/{userId}/burrow 하나로 그림
 * - 대화 버튼은 chat.status 4가지 (CHATTING 대화하기 · REQUEST_SENT 요청 보냄 · REQUEST_RECEIVED 누르면 안내 토스트 · NONE 팝업)
 * - 우체통 깃발 = 방명록 글이 하나라도 있으면 (guestbookCount), 단골 = PUT/DELETE, 방 모습 = 관심사로 계산 (서버는 가구 · 무드를 주지 않음)
 * - 내가 거절했던 요청이 남은 사람에게 보내면 서버가 바로 대화방을 열어 줌 → 그 대화방으로
 * 데모용 쿼리: ?modal=request · ?modal=guestbook(우체통) · ?toast=request · ?panel=open
 */
export default function VisitBurrow() {
  const { userId = 'yerin' } = useParams()
  // 서버에서 받기. 없는 사람 · 탈퇴 · 땅굴 없음 → 404 BURROW_NOT_FOUND → "없는 땅굴이에요" (00 공통 21)
  const q = useVisitBurrow(userId, userId !== ME_ID)
  if (userId === ME_ID || q.data?.isMine) return <Navigate to="/burrow" replace />
  return (
    <QueryGate q={q} skeleton={<BurrowSkeleton />} notFound={<NotFound what="burrow" />}
      error={(retry, e) => <main className={s.page} style={{ display: 'grid', placeItems: 'center' }}><ErrorState error={e} onRetry={retry} retrying={q.isFetching} title="땅굴을 불러오지 못했어요" /></main>}>
      {(b) => <VisitBurrowView key={userId} b={b} />}
    </QueryGate>
  )
}

/** 땅굴을 불러오는 동안: 흙빛 장면 자리 + 오른쪽 방 정보 패널 모양 */
function BurrowSkeleton() {
  return (
    <main className={s.page} style={{ background: 'var(--bg-scene)' }} role="status" aria-busy="true" aria-label="땅굴을 불러오는 중">
      <aside className={s.roomInfo} aria-hidden>
        <Skeleton w="55%" h={24} />
        <div className={s.profile}><Skeleton w={64} h={64} r={32} /><div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}><Skeleton w="50%" h={18} /><Skeleton w="70%" h={12} /></div></div>
        <Skeleton h={120} r={8} style={{ marginTop: 16 }} />
        <div style={{ marginTop: 18 }}><SkeletonLines lines={3} /></div>
      </aside>
    </main>
  )
}

function VisitBurrowView({ b }: { b: BurrowVM }) {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const owner = b.owner
  const regular = b.isRegular
  const [regToast, setRegToast] = useState<string | null>(null)
  const me = USERS[ME_ID]
  const run = useOptimistic()
  const qc = useQueryClient()
  const act = useVisitActions(b)
  const send = useSendChatRequest(owner.id)
  const [allOpen, setAllOpen] = useState(params.get('modal') === 'guestbook')
  // 방명록 목록 · 지우기는 04 API (주인 · 방문자가 같이 씀): 서버가 나눈 5개씩 페이지, 우체통 창을 열 때만 받음
  const [gbPage, setGbPage] = useState(1)
  const gb = useGuestbookEntries(b.burrowId, gbPage, { enabled: allOpen })
  const delGb = useDeleteGuestbookEntry(b.burrowId)
  const entries = gb.data?.items ?? []
  // 지운 뒤 마지막 페이지가 비면 한 페이지 앞으로, 창을 열면 첫 페이지
  useEffect(() => { if (gb.data && gb.data.totalPages > 0 && gbPage > gb.data.totalPages) setGbPage(gb.data.totalPages) }, [gb.data, gbPage])
  useEffect(() => { if (allOpen) setGbPage(1) }, [allOpen])
  // 방노트: 들어오면 접혀 있음 (?panel=open 이면 펼친 채로)
  const note = useNotePanel(params.get('panel') === 'open')
  const panelOpen = note.open
  const [draft, setDraft] = useState('')
  const [reqOpen, setReqOpen] = useState(params.get('modal') === 'request')
  const [reqMsg, setReqMsg] = useState('')
  const [sent, setSent] = useState(params.get('toast') === 'request')
  // 방노트 깃발 → 신고 팝업 (프로필 팝업과 같은 ReportDialog) → 접수 토스트
  const [reportOpen, setReportOpen] = useState(false)
  const [reported, setReported] = useState(false)

  // 나와 겹치는 관심사 (서버의 isShared)
  const shared = b.shared
  // 관심사 이펙트: 나와 같은 관심사 가구가 빛남 · 집주인 대화 의향(목 데이터) 반딧불 (docs/interest-effects.md)
  const [fx] = useState(() => ({ viewer: getMyInterests(me.interests), talk: talkMoodOf(owner.id) }))
  // 방 모습: 관심사로 계산 (명세: 가구는 세부 관심사마다 하나로 정해져 있고 고르지 않음, 무드는 대표 관심사). 내 땅굴과 같은 함수 (data/roomLook.ts)
  const look = useMemo(() => roomLookOf(owner.id, owner.interests), [owner.id, owner.interests])

  /** 방명록 남기기: 글 수를 먼저 올리고, 끝나면 첫 페이지를 다시 받음 (새 글이 맨 위). 실패하면 입력값을 되돌림 */
  const submitGb = () => {
    const text = draft.trim()
    if (!text) return
    setDraft('')
    act.writeGuestbook(text, { onError: () => setDraft(text), onSuccess: () => setGbPage(1) })
  }
  /** 내가 쓴 방명록 지우기 (DELETE /guestbook-entries/{id}, 04): 확인 없이 바로. 끝나면 목록 · 글 수를 다시 받음 */
  const deleteOwn = (id: string) => delGb.mutate(id, {
    onSuccess: () => { void qc.invalidateQueries({ queryKey: exploreKeys.burrow(owner.id) }) }, // 우체통 깃발 · 글 수
    onError: (e) => toastApiError(e, '방명록을 지우지 못했어요', BURROW_ERRORS),
  })
  /** 방명록 글 신고 (POST /reports, targetType GUESTBOOK): 서로 다른 3명이면 서버가 가림 → 다시 받아서 목록·글 수에서 뺌 */
  const reportEntry = (id: string, picked: string) => {
    run.mutate({ call: () => api.community.createReport(reportBody('GUESTBOOK', id, picked)), errorTitle: '신고를 접수하지 못했어요', invalidate: [burrowKeys.guestbook(b.burrowId), exploreKeys.burrow(owner.id)] })
  }
  /** 방노트의 신고 아이콘 (POST /reports, targetType MEMBER) */
  const reportOwner = (picked: string) => {
    setReportOpen(false)
    run.mutate({ call: () => api.community.createReport(reportBody('MEMBER', owner.id, picked)), errorTitle: '신고를 접수하지 못했어요' }, { onSuccess: () => setReported(true) })
  }
  /** 단골: 상대 수락 없이 바로 (PUT), 다시 누르면 해제 (DELETE). 실패하면 되돌림 */
  const toggleRegular = () => {
    const on = !regular
    setRegToast(on ? '단골 땅굴에 추가했어요' : `${owner.nickname}님을 단골에서 뺐어요`)
    act.setRegular(on, { onError: () => setRegToast(null) })
  }
  /** 대화 요청하기 말풍선: 상대가 먼저 보낸 요청에 아직 답하지 않았으면 팝업 대신 안내 (방문자 뷰 4) */
  const openRequest = () => {
    if (b.chat.status === 'REQUEST_RECEIVED') setRegToast(ALREADY_RECEIVED_TEXT)
    else setReqOpen(true)
  }
  /** 대화 요청 보내기 → "요청 보냄". 내가 거절했던 요청이 남은 사람이면 서버가 바로 대화방을 열어 줌 → 그 방으로 */
  const sendReq = () => {
    const msg = reqMsg.trim()
    setReqOpen(false)
    send.mutate(msg, {
      onSuccess: (r) => {
        setReqMsg('')
        if (r.chatRoomId) navigate(`/chat/${r.chatRoomId}`)
        else setSent(true)
      },
      onError: (e) => {
        // 이미 대화 중 · 이미 보냄 · 상대가 먼저 보냄: 오류가 아니라 안내 (버튼은 서버 값으로 다시 맞춰짐)
        if (isApiError(e) && (e.code === 'CHAT_REQUEST_ALREADY_RECEIVED' || e.code === 'CHAT_ROOM_ALREADY_EXISTS' || e.code === 'CHAT_REQUEST_ALREADY_SENT')) {
          setReqMsg(''); setRegToast(errorText(e, EXPLORE_ERRORS)); return
        }
        toastApiError(e, '대화 요청을 보내지 못했어요', EXPLORE_ERRORS)
        setReqOpen(true)
      },
    })
  }

  return (
    <main className={s.page}>
      <RoomView ownerId={owner.id} interests={owner.interests} wallpaper={look.wallpaper} furniture={look.furniture} style={look.style}
        hostName={owner.nickname} hostWorn={owner.worn} worn={getMyWorn()} focusX={panelOpen ? 0.403 : 0.5} label={`${owner.nickname}의 땅굴`}
        mailbox={b.guestbookCount > 0} onMailbox={() => setAllOpen(true)} fx={fx}
        hostBubble={b.chat.status === 'CHATTING' && b.chat.chatRoomId
          ? <Link className={s.speech} to={`/chat/${b.chat.chatRoomId}`}><ChatIcon size={16} /> 대화하기</Link>
          : b.chat.status === 'REQUEST_SENT'
            ? <span className={`${s.speech} ${s.speechSent}`} role="status">요청 보냄</span>
            : <button className={s.speech} onClick={openRequest} disabled={send.isPending}><ChatIcon size={16} /> 대화 요청하기</button>}>
        {/* 단골 추가 (02 F5 방문자 뷰 2번): 상대 수락 없이 내 단골 목록에 들어감. 다시 누르면 해제(알리지 않음) */}
        <div className={s.sceneTools}>
          <SceneButton tone={regular ? 'mint' : 'paper'} aria-pressed={regular} onClick={toggleRegular}>
            {regular ? '✓ 단골' : '+ 단골 추가'}
          </SceneButton>
        </div>
        {/* Figma 1246:13381: 방문 중엔 "○○님 땅굴 | 탐색" (지금 보는 땅굴이 켜진 칸) */}
        <RoomModeToggle style={{ left: `${(panelOpen ? 0.408 : 0.515) * 100}%` }} homeLabel={`${owner.nickname}님 땅굴`} homeTo={`/burrow/${owner.id}`} exploreTo={exploreHrefOf(b.entrance.place, b.entrance.seat)} />
        <FxPanel area="room" style={{ right: panelOpen ? 388 : 33 }} />
      </RoomView>

      {/* 방노트 (탐색과 같은 부품: RoomNote). 땅굴 놀러가기 버튼은 없음(이미 이 땅굴 안), 방명록은 우체통 창 안으로 */}
      <NotePanel panel={note} title={`${owner.nickname}님 땅굴`}>
        <RoomNoteBody owner={owner} shared={shared} onReport={() => setReportOpen(true)} />
      </NotePanel>

      {/* 우체통: 쓰기와 읽기를 한 창에서. 남기면 목록 맨 위에 바로 들어가고 우체통 깃발이 올라감 */}
      <GuestbookModal open={allOpen} onClose={() => setAllOpen(false)} entries={entries} onDeleteOwn={deleteOwn} onReport={reportEntry}
        server={{ page: gb.data?.page ?? gbPage, totalPages: gb.data?.totalPages ?? 0, totalItems: gb.data?.totalItems ?? b.guestbookCount, onPage: setGbPage, fetching: gb.isFetching }}
        load={{ loading: gb.isPending, error: gb.isError && !gb.data ? gb.error : undefined, onRetry: () => void gb.refetch(), retrying: gb.isFetching }}
        compose={{ value: draft, onChange: setDraft, onSubmit: submitGb, max: GB_MAX, placeholder: `${owner.nickname}님의 땅굴에 다녀간 흔적을 남겨주세요` }} />

      {/* 대화 요청 팝업 (Figma 495:13898): 두더지 · 제목 · 50자 입력칸(글자 수) · 빠른 멘트 3개 · 주황 "요청 보내기" */}
      <Modal open={reqOpen} onClose={() => setReqOpen(false)} width={460} labelledBy="req-title">
        <div className={s.requestModal}>
          <MoundMole className={s.reqMole} width={84} height={67} />
          <h2 id="req-title" className="display">대화 요청하기</h2>
          <div className={s.reqField}>
            <textarea value={reqMsg} maxLength={CHAT_REQUEST_MAX} onChange={(e) => setReqMsg(e.target.value)} aria-label="첫 인사" aria-describedby="req-count"
              placeholder={`${owner.nickname}님에게 보낼 첫 인사를 적어주세요. 땅굴에서 본 가구 이야기로 시작하면 쉬워요.`} />
            <div className={s.reqFieldFoot}>
              <span id="req-count">{reqMsg.length} / {CHAT_REQUEST_MAX}</span>
              <span>겹치는 관심사 {shared.length}개</span>
            </div>
          </div>
          <p className={s.quickLabel}>빠른 멘트</p>
          <div className={s.phrases}>
            {QUICK.map((q) => <button key={q} className={s.phrase} onClick={() => setReqMsg(q)}>{q}</button>)}
          </div>
          {/* 인사는 비워도 보낼 수 있음 (명세: message 선택) */}
          <button className={`btn btn-cta btn-block ${s.reqSend}`} disabled={send.isPending} onClick={sendReq}><SendIcon size={16} /> 요청 보내기</button>
        </div>
      </Modal>
      <ReportDialog open={reportOpen} target="사용자" onClose={() => setReportOpen(false)} onConfirm={reportOwner} />

      <Toast open={!!regToast} onClose={() => setRegToast(null)} title={regToast ?? ''} />
      <Toast open={sent} onClose={() => setSent(false)} duration={6000} {...TOAST.chatRequest(owner.nickname)} />
      <Toast open={reported} onClose={() => setReported(false)} {...TOAST.reported} />
    </main>
  )
}
