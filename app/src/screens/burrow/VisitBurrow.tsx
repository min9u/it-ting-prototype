import { useMemo, useState } from 'react'
import NotFound from '../../components/NotFound'
import { roomLookOf } from '../../data/roomLook'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import RoomView from '../../components/RoomView'
import { getMyWorn } from '../../data/moleItems'
import RoomModeToggle from '../../components/RoomModeToggle'
import Modal from '../../components/Modal'
import { ReportDialog, TOAST, Toast } from '../../components/Feedback'
import { ChatIcon, SendIcon } from '../../components/Icons'
import MoundMole from '../../components/MoundMole'
import { ME_ID, USERS, overlapCount } from '../../data/mock'
import type { GuestbookEntry } from '../../data/types'
import GuestbookModal from './GuestbookModal'
import { NotePanel, RoomNoteBody, useNotePanel } from './RoomNote'
import SceneButton from '../../components/SceneButton'
import { Link } from 'react-router-dom'
import type { SendChatRequestResponse } from '../../api/types'
import { exploreHref } from '../../data/field'
import { toIso } from '../../lib/time'
import { api } from '../../api'
import { isApiError } from '../../api/client'
import { reportBody } from '../../api/reports'
import type { BurrowVM } from '../../api/mappers'
import { patch, useBurrow, useGuestbook, useOptimistic } from '../../api/queries'
import { qk } from '../../api/queryClient'
import { ErrorState, QueryGate, Skeleton, SkeletonLines } from '../../components/AsyncState'
import s from './Burrow.module.css'
import { CHAT_REQUEST_MAX, GUESTBOOK_MAX } from '../../lib/validation'
import FxPanel from '../../components/FxPanel'
import { getMyInterests } from '../../data/interests'
import { talkMoodOf } from '../../data/interestFx'

// 방명록 50자 · 대화 요청 인사 50자 (lib/validation.ts. 방명록은 예전 100자 → 02 명세 최신 · ERD guestbook_entry.content VARCHAR(50) 에 맞춤)
const GB_MAX = GUESTBOOK_MAX
const QUICK = ['땅굴 구경 잘했어요!', '같이 게임 한 판 해요', '그림 이야기 나눠요']

/**
 * 땅굴 – 방문자 뷰 (예린이의 땅굴) 510:13663 외 3변형 · 대화 요청 팝업 495:13898
 * 2026-11-21: 495:13840(방노트 접힘) · 510:13152(방노트 펼침) · 510:13663(방명록)에 맞춤 — 접힌 채 시작, 제목 칩 없음, 사이드바는 탐색과 같은 방노트, 방명록은 우체통 창 안
 * 대화 요청 완료 토스트 612:7718 (2026-11-11 추가, 스크린샷 대조): 보내면 팝업을 닫고 아래쪽에 토스트
 * 메타데이터 기반 — 스크린샷 대조 필요
 * 데모용 쿼리: ?modal=request
 */
export default function VisitBurrow() {
  const { userId = 'yerin' } = useParams()
  // 서버에서 받기 (api/queries). 없는 사람을 다른 사람(예린)으로 바꿔 보여 주던 것을 404 → "없는 땅굴이에요" 로 (위험 B1)
  const q = useBurrow(userId, userId !== ME_ID)
  if (userId === ME_ID) return <Navigate to="/burrow" replace />
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
  const owner = b.owner
  const regular = b.regular
  const [regToast, setRegToast] = useState<string | null>(null)
  const spot = b.spot
  // 대화 관계 (서버가 땅굴 응답에 같이 줌): 대화방이 있으면 "대화하기", 보낸 요청이 있으면 "요청 보냄"(누를 수 없음)
  const dmRoomId = b.chatRoomId
  const pendingReq = b.pendingRequestId
  const me = USERS[ME_ID]
  const run = useOptimistic()
  const navigate = useNavigate()
  const gb = useGuestbook(owner.id)
  const entries: GuestbookEntry[] = gb.data ?? []
  // 방노트: 들어오면 접혀 있음 (?panel=open 이면 펼친 채로)
  const note = useNotePanel(params.get('panel') === 'open')
  const panelOpen = note.open
  const [draft, setDraft] = useState('')
  const [allOpen, setAllOpen] = useState(false)
  const [reqOpen, setReqOpen] = useState(params.get('modal') === 'request')
  const [reqMsg, setReqMsg] = useState('')
  const [sent, setSent] = useState(params.get('toast') === 'request')
  // 방노트 깃발 → 신고 팝업 (프로필 팝업과 같은 ReportDialog) → 접수 토스트
  const [reportOpen, setReportOpen] = useState(false)
  const [reported, setReported] = useState(false)
  // 우체통 (v3.6): 남의 땅굴에서는 내가 방명록을 남기면 깃발이 올라감 (집주인의 "읽지 않음" 상태는 방문자에게 보이지 않음)
  const [posted, setPosted] = useState(params.get('mailbox') === '1')

  const shared = owner.interests.filter((i) => me.interests.includes(i))
  // 관심사 이펙트: 나와 같은 관심사 가구가 빛남 · 집주인 대화 의향(목 데이터) 반딧불 (docs/interest-effects.md)
  const [fx] = useState(() => ({ viewer: getMyInterests(me.interests), talk: talkMoodOf(owner.id) }))
  // 방 모습: 집주인이 저장한 방(b.room)이 먼저, 없으면 관심사로 계산. 내 땅굴과 같은 함수 (data/roomLook.ts)
  const look = useMemo(() => roomLookOf(owner.id, owner.interests, b.room), [owner.id, owner.interests, b.room])

  /** 방명록 남기기: 목록 맨 위에 먼저 넣고 실패하면 빼고 입력값을 되돌림 */
  const submitGb = () => {
    const text = draft.trim()
    if (!text) return
    setDraft('')
    setPosted(true)
    run.mutate({
      call: () => api.burrows.writeGuestbook(owner.id, text), errorTitle: '방명록을 남기지 못했어요',
      patches: [patch<GuestbookEntry[]>(qk.guestbook(owner.id), (l) => [{ id: `tmp-${Date.now()}`, authorId: ME_ID, text, createdAt: toIso(Date.now()) }, ...l])],
    }, { onError: () => { setDraft(text); setPosted(params.get('mailbox') === '1') } })
  }
  /** 내가 쓴 방명록 지우기: 확인 없이 바로 (목록에서 먼저 빼고 실패하면 되돌림) */
  const deleteOwn = (id: string) => {
    run.mutate({
      call: () => api.burrows.deleteGuestbook(id), errorTitle: '방명록을 지우지 못했어요',
      patches: [patch<GuestbookEntry[]>(qk.guestbook(owner.id), (l) => l.filter((g) => g.id !== id))],
    })
  }
  /** 방명록 글 신고: 서로 다른 3명이면 서버가 가림 → 다시 받아서 목록·글 수에서 뺌 */
  const reportEntry = (id: string, picked: string) => {
    const r = reportBody('GUESTBOOK', id, picked)
    run.mutate({ call: () => api.burrows.reportGuestbook(id, r.reason, r.detail ?? null), errorTitle: '신고를 접수하지 못했어요', invalidate: [qk.guestbook(owner.id)] })
  }
  /** 단골: 상대 수락 없이 바로. 실패하면 되돌림 */
  const toggleRegular = () => {
    const on = !regular
    setRegToast(on ? '단골 땅굴에 추가했어요' : `${owner.nickname}님을 단골에서 뺐어요`)
    run.mutate({ call: () => api.burrows.setRegular(owner.id, on), errorTitle: '단골을 바꾸지 못했어요', patches: [patch<BurrowVM>(qk.burrow(owner.id), (o) => ({ ...o, regular: on }), true)] }, { onError: () => setRegToast(null) })
  }
  /** 대화 요청 보내기 → 땅굴 응답의 pendingRequestId 가 생김 */
  const sendReq = () => {
    const msg = reqMsg.trim()
    setReqOpen(false)
    run.mutate({
      call: () => api.chat.sendRequest(owner.id, msg, 'BURROW_VISIT'), errorTitle: '대화 요청을 보내지 못했어요', invalidate: [qk.burrow(owner.id), qk.chat],
      quietCodes: ['REQUEST_FROM_PEER'], // 오류가 아니라 안내: 상대가 먼저 보낸 요청이 있음 (F6-B3·B4)
      patches: [patch<BurrowVM>(qk.burrow(owner.id), (o) => ({ ...o, pendingRequestId: o.pendingRequestId ?? 'tmp' }), true)],
    }, {
      onSuccess: (data) => {
        const r = data as SendChatRequestResponse
        setReqMsg('')
        // 내가 거절한 요청이 남아 있던 사람 → 요청이 아니라 대화방이 바로 열림: 팝업을 닫은 채 그 대화방으로 (명세 05 대화 요청 팝업 3)
        if (r.chatRoomId) navigate(`/chat/${r.chatRoomId}`)
        else setSent(true)
      },
      onError: (e) => {
        if (isApiError(e) && e.code === 'REQUEST_FROM_PEER') { setReqMsg(''); setRegToast('이미 나에게 요청한 사람입니다. 알림창에 가서 확인하세요.') } // 팝업은 닫은 채로, 안내만
        else setReqOpen(true)
      },
    })
  }

  return (
    <main className={s.page}>
      <RoomView ownerId={owner.id} interests={owner.interests} wallpaper={look.wallpaper} furniture={look.furniture} style={look.style}
        hostName={owner.nickname} hostWorn={owner.worn} worn={getMyWorn()} focusX={panelOpen ? 0.403 : 0.5} label={`${owner.nickname}의 땅굴`}
        mailbox={posted} onMailbox={() => setAllOpen(true)} fx={fx}
        hostBubble={dmRoomId
          ? <Link className={s.speech} to={`/chat/${dmRoomId}`}><ChatIcon size={16} /> 대화하기</Link>
          : pendingReq
            ? <span className={`${s.speech} ${s.speechSent}`} role="status">요청 보냄</span>
            : <button className={s.speech} onClick={() => setReqOpen(true)}><ChatIcon size={16} /> 대화 요청하기</button>}>
        {/* 단골 추가 (02 F5 방문자 뷰 2번): 상대 수락 없이 내 단골 목록에 들어감. 다시 누르면 해제(알리지 않음) */}
        <div className={s.sceneTools}>
          <SceneButton tone={regular ? 'mint' : 'paper'} aria-pressed={regular} onClick={toggleRegular}>
            {regular ? '✓ 단골' : '+ 단골 추가'}
          </SceneButton>
        </div>
        {/* Figma 1246:13381: 방문 중엔 "○○님 땅굴 | 탐색" (지금 보는 땅굴이 켜진 칸) */}
        <RoomModeToggle style={{ left: `${(panelOpen ? 0.408 : 0.515) * 100}%` }} homeLabel={`${owner.nickname}님 땅굴`} homeTo={`/burrow/${owner.id}`} exploreTo={spot ? exploreHref(spot.floor, spot.seat) : undefined} />
        <FxPanel area="room" style={{ right: panelOpen ? 388 : 33 }} />
      </RoomView>

      {/* 방노트 (탐색과 같은 부품: RoomNote). 땅굴 놀러가기 버튼은 없음(이미 이 땅굴 안), 방명록은 우체통 창 안으로 */}
      <NotePanel panel={note} title={`${owner.nickname}님 땅굴`}>
        <RoomNoteBody owner={owner} shared={shared} onReport={() => setReportOpen(true)} />
      </NotePanel>

      {/* 우체통: 쓰기와 읽기를 한 창에서. 남기면 목록 맨 위에 바로 들어가고 우체통 깃발이 올라감 */}
      <GuestbookModal open={allOpen} onClose={() => setAllOpen(false)} entries={entries} onDeleteOwn={deleteOwn} onReport={reportEntry}
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
              <span>겹치는 관심사 {overlapCount(owner.interests, me.interests)}개</span>
            </div>
          </div>
          <p className={s.quickLabel}>빠른 멘트</p>
          <div className={s.phrases}>
            {QUICK.map((q) => <button key={q} className={s.phrase} onClick={() => setReqMsg(q)}>{q}</button>)}
          </div>
          <button className={`btn btn-cta btn-block ${s.reqSend}`} disabled={!reqMsg.trim() || run.isPending} onClick={sendReq}><SendIcon size={16} /> 요청 보내기</button>
        </div>
      </Modal>
      <ReportDialog open={reportOpen} target="사용자" onClose={() => setReportOpen(false)} onConfirm={() => { setReportOpen(false); setReported(true) }} />

      <Toast open={!!regToast} onClose={() => setRegToast(null)} title={regToast ?? ''} />
      <Toast open={sent} onClose={() => setSent(false)} duration={6000} {...TOAST.chatRequest(owner.nickname)} />
      <Toast open={reported} onClose={() => setReported(false)} {...TOAST.reported} />
    </main>
  )
}
