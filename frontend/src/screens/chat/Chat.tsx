import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from '@/lib/nav'
import Avatar from '../../components/Avatar'
import Modal from '../../components/Modal'
import ProfilePopup from '../../components/ProfilePopup'
import { ConfirmDialog, EmptyMole, Toast } from '../../components/Feedback'
import ConnectionStrip from '../../components/ConnectionStrip'
import { CalendarIcon, ChatIcon, CloseIcon, CompassIcon, HomeIcon, PenIcon, PinIcon, PlusIcon, SearchIcon, SendIcon } from '../../components/Icons'
import { ErrorState, SkeletonRows } from '../../components/AsyncState'
import { ME_ID, USERS, toneOf } from '../../data/mock'
import { catNameOf } from '../../data/meetupStore'
import { meetupToneOf } from '../../data/meetupCategory'
import { getMyWorn } from '../../data/moleItems'
import { shortAffOf } from '../../data/field'
import type { User } from '../../data/types'
import { agoChat, chatListTime, clock, dayDivider, monthDay } from '../../lib/time'
import { errorText, isNotFound, patch, useOptimistic } from '../../api'
import { GONE_ID, type Person } from '../../api/common'
import { useVisitBurrow } from '../../api/explore'
import { MEETUP_ERRORS, meetupCalls, meetupKeys } from '../../api/meetups'
import { uploadImage } from '../../api/community'
import {
  CHAT_ERRORS, CHAT_IMAGES_MAX, CHAT_MESSAGE_MAX, CHAT_NOTICE_MAX, chatCalls, chatKeys, chatMessagesAsc, isNoticeMessage, noticeText, roomPreview,
  useActiveChatRoom, useChatMessages, useChatRequestCount, useChatRequests, useChatRoom, useChatRooms, useMyId, useOutbox, useReadReceipt, useSendMessage,
  type ChatMessage, type ChatRequestCount, type ChatRequestVM, type ChatRoomItem, type ChatRoomVM, type PendingMessage,
} from '../../api/chat'
import TeaRoom, { type TeaGuest } from './TeaRoom'
import s from './Chat.module.css'

/**
 * 채팅 (명세 06 채팅 · 00 공통 14, API docs/backend/team-spec/api/06-chat.md). 2026-11-22 API v1 에 맞춤 (docs/backend/api-v1/06-chat.md)
 * 세 칸: 왼쪽 대화 목록 · 가운데 찻방(두더지들이 찻상에 둘러앉음) · 오른쪽 대화 창. 요청 탭은 찻방·대화 창 대신 요청 목록 + 보낸/받은 사람 프로필
 * /chat               대화 선택 전
 * /chat/:roomId       1:1 대화 · 모임 대화 (+ 모임 정보 팝업, ?info=1 이면 열린 채로)
 * /chat/requests      요청 · 받은 요청 · 보낸 요청 (?dir=sent)
 * - 필터: 전체 / 1:1 / 모임 / 요청 N (N = 받은 대화 요청 수만). 필터 · 검색은 받은 목록에서 (상대 닉네임 · 모임 이름, 메시지 내용은 안 찾음)
 * - "접속 중" · 읽음 표시 · 메시지 지우기 · 입력 중은 없음 (명세)
 * - 모든 읽기 · 쓰기는 api/chat 의 훅 · 함수. 새 메시지 · 요청 수는 실시간 소식(SSE)으로 (App.tsx 의 useChatEvents)
 */
type Filter = 'all' | 'dm' | 'group'

export default function Chat({ requests }: { requests?: boolean }) {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const myId = useMyId()
  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')
  const [profile, setProfile] = useState<User | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const rooms = useChatRooms()
  const count = useChatRequestCount()
  const reqN = count.data?.received
  const word = q.trim()
  const list = (rooms.data ?? [])
    .filter((r) => filter === 'all' || r.kind === filter)
    .filter((r) => !word || r.title.includes(word))

  const pickFilter = (f: Filter) => { setFilter(f); if (requests) navigate('/chat') }
  const openProfile = (p: Person) => { if (p.id !== GONE_ID && p.id !== myId) setProfile(p) }

  return (
    <main className={s.page}>
      <h1 className={`display ${s.sign}`}>채팅</h1>
      <div className={requests ? s.gridReq : s.grid}>
        <section className={s.list} aria-label="대화 목록">
          <label className={s.search}>
            <SearchIcon size={17} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="대화 검색" aria-label="대화 검색" />
          </label>
          <div className={s.filters} role="tablist" aria-label="대화 종류">
            {([['all', '전체'], ['dm', '1:1'], ['group', '모임']] as const).map(([k, l]) => (
              <button key={k} role="tab" aria-selected={!requests && filter === k} className={!requests && filter === k ? s.filterOn : s.filter} onClick={() => pickFilter(k)}>{l}</button>
            ))}
            <Link to="/chat/requests" role="tab" aria-selected={!!requests} className={requests ? s.filterOn : s.filter}>요청 {reqN ?? ''}</Link>
          </div>
          {rooms.isPending ? (
            <SkeletonRows count={5} label="대화 목록을 불러오는 중" compact />
          ) : rooms.isError && !rooms.data ? (
            <ErrorState compact error={rooms.error} onRetry={() => void rooms.refetch()} retrying={rooms.isFetching} title="대화 목록을 불러오지 못했어요" />
          ) : (
            <ul className={s.convs} aria-busy={rooms.isFetching}>
              {list.map((r) => <ListItem key={r.id} room={r} myId={myId} active={!requests && r.id === roomId} />)}
              {list.length === 0 && <li className={s.listEmpty}>{word ? '찾는 대화가 없어요' : '아직 대화가 없어요'}</li>}
            </ul>
          )}
        </section>

        {requests ? (
          <Requests onProfile={openProfile} onToast={setToast} count={count.data} />
        ) : roomId ? (
          <RoomPane key={roomId} roomId={roomId} onProfile={openProfile} onToast={setToast} />
        ) : (
          <>
            <TeaRoom mode="empty" guests={[meGuest()]} />
            <section className={`${s.panel} ${s.emptyPanel}`}>
              <EmptyMole message="아직 고른 대화가 없어요">
                <p className={s.emptyText}>왼쪽 목록에서 대화를 골라주세요. 아직 대화가 없다면 땅굴을 둘러보다가 마음에 드는 두더지에게 대화를 요청해 보세요.</p>
                <div className={s.emptyActions}>
                  <Link to="/burrow/explore" className="btn btn-cta"><CompassIcon size={16} /> 땅굴 둘러보기</Link>
                  <Link to="/chat/requests" className="btn btn-line">받은 요청 보기 <span className="count-badge">{reqN ?? 0}</span></Link>
                </div>
              </EmptyMole>
            </section>
          </>
        )}
      </div>
      <ProfilePopup user={profile} onClose={() => setProfile(null)} />
      <Toast open={!!toast} onClose={() => setToast(null)} title={toast ?? ''} />
    </main>
  )
}

/** 내 두더지 (찻방). 내 프로필 · 두더지는 내 땅굴 영역의 값 (명세: GET /users/{내 id}/profile) */
const meGuest = (): TeaGuest => ({ id: ME_ID, name: USERS[ME_ID]?.nickname ?? '나', worn: getMyWorn(), me: true })
const guestOf = (p: Person, myId: string): TeaGuest => (p.id === myId ? meGuest() : { id: p.id, name: p.nickname, worn: p.worn ?? [], gone: p.id === GONE_ID })

/** 이름 첫 글자 타일 (03 Chat List Item) */
function Initial({ text, tone, size = 44 }: { text: string; tone: string; size?: number }) {
  return <span className={s.initial} style={{ width: size, height: size, background: `var(--tone-${tone}-bg)`, color: `var(--tone-${tone}-fg)` }} aria-hidden>{text.slice(0, 1)}</span>
}
/** 대화 목록 한 줄 (GET /me/chat-rooms → mappers ChatRoomItem) */
function ListItem({ room, active, myId }: { room: ChatRoomItem; active: boolean; myId: string }) {
  return (
    <li>
      <Link to={`/chat/${room.id}`} className={active ? s.convOn : s.conv} aria-current={active ? 'page' : undefined}>
        <Initial text={room.title} tone={toneOf(room.title)} />
        <span className={s.convBody}>
          <span className={s.convTop}>
            <strong>{room.title}</strong>
            <time>{room.lastAt ? chatListTime(room.lastAt) : ''}</time>
          </span>
          <span className={s.convSub}>
            <span>{roomPreview(room, myId)}</span>
            {room.unread > 0 && <b className={s.unread} aria-label={`안 읽은 메시지 ${room.unread}개`}>{room.unread}</b>}
          </span>
        </span>
      </Link>
    </li>
  )
}

/* ===================== 대화 (1:1 · 모임) ===================== */
const EMOJIS = ['😊', '😂', '🥹', '👍', '🙏', '🎉', '☕', '🍵', '🐾', '🌱', '🏕️', '📚']

/** 대화방 불러오기 · 없음 · 오류 */
function RoomPane({ roomId, onProfile, onToast }: { roomId: string; onProfile: (p: Person) => void; onToast: (t: string) => void }) {
  const room = useChatRoom(roomId)
  if (room.data) return <RoomView room={room.data} onProfile={onProfile} onToast={onToast} />
  return (
    <>
      <TeaRoom mode="empty" guests={[meGuest()]} />
      <section className={`${s.panel} ${room.isPending ? '' : s.emptyPanel}`}>
        {room.isPending ? <SkeletonRows count={4} label="대화를 불러오는 중" /> : isNotFound(room.error) ? (
          <EmptyMole message="없는 대화예요">
            <p className={s.emptyText}>나간 대화이거나 주소가 잘못됐어요.</p>
            <Link to="/chat" className="btn btn-line">대화 목록으로</Link>
          </EmptyMole>
        ) : <ErrorState error={room.error} onRetry={() => void room.refetch()} retrying={room.isFetching} title="대화를 불러오지 못했어요" />}
      </section>
    </>
  )
}

const toPendingMessage = (p: PendingMessage, me: Person): ChatMessage => ({
  id: p.clientId, num: 0, type: 'TEXT', authorId: me.id, author: me, text: p.content ?? '', card: null, images: p.images, at: p.at,
  clientId: p.clientId, status: p.status, error: p.error,
})

function RoomView({ room, onProfile, onToast }: { room: ChatRoomVM; onProfile: (p: Person) => void; onToast: (t: string) => void }) {
  const navigate = useNavigate()
  const myId = useMyId()
  const me: Person = USERS[myId] ?? USERS[ME_ID]
  const run = useOptimistic()
  const msgsQ = useChatMessages(room.id)
  const pending = useOutbox(room.id)
  const sender = useSendMessage(room.id)
  const msgs = useMemo(() => chatMessagesAsc(msgsQ.data), [msgsQ.data])
  const all = useMemo(() => [...msgs, ...pending.map((p) => toPendingMessage(p, me))], [msgs, pending, me])
  const lastNum = msgs.length ? msgs[msgs.length - 1].num : 0
  useActiveChatRoom(room.id)
  useReadReceipt(room.id, lastNum)

  const meetup = room.meetup
  const partner = room.counterpart
  const [greet, setGreet] = useState<{ id: string; n: number }>({ id: myId, n: 0 })
  const [leave, setLeave] = useState(false)
  const [params] = useSearchParams()
  const [info, setInfo] = useState(params.get('info') === '1')
  const [quit, setQuit] = useState(false)
  const quitting = useRef(false)
  const scroller = useRef<HTMLDivElement>(null)

  // 새 메시지(맨 아래)가 바뀌면 맨 아래로. 위로 이전 메시지를 붙일 때는 보던 자리 그대로
  const newestId = all.length ? all[all.length - 1].id : ''
  const keep = useRef<number | null>(null)
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    if (keep.current != null) { el.scrollTop = el.scrollHeight - keep.current; keep.current = null }
    else el.scrollTop = el.scrollHeight
  }, [newestId, msgs.length])
  const loadOlder = () => {
    const el = scroller.current
    if (!el || !msgsQ.hasNextPage || msgsQ.isFetchingNextPage) return
    keep.current = el.scrollHeight - el.scrollTop
    void msgsQ.fetchNextPage()
  }
  // 다른 사람 메시지가 새로 오면 그 두더지가 손 인사
  const lastServer = msgs[msgs.length - 1]
  const seenLast = useRef(lastServer?.id)
  useEffect(() => {
    if (!lastServer || lastServer.id === seenLast.current) return
    seenLast.current = lastServer.id
    if (!isNoticeMessage(lastServer) && lastServer.authorId !== myId) setGreet((g) => ({ id: lastServer.authorId, n: g.n + 1 }))
  }, [lastServer, myId])

  // 사용자별 마지막으로 말한 시각 (찻방 3D: 6명 초과일 때 누가 앉을지)
  const spoke = useMemo(() => { const r: Record<string, number> = {}; for (const m of msgs) if (!isNoticeMessage(m)) r[m.authorId] = Math.max(r[m.authorId] ?? 0, m.at); return r }, [msgs])
  const guests = useMemo<TeaGuest[]>(() => (room.kind === 'group'
    ? [...room.members].sort((a, b) => Number(b.isMe) - Number(a.isMe)).map((x) => (x.isMe ? meGuest() : guestOf(x.person, myId)))
    : [meGuest(), ...(partner ? [guestOf(partner, myId)] : [])]), [room, partner, myId])
  const pickGuest = (id: string) => {
    const p = room.kind === 'group' ? room.members.find((x) => x.person.id === id)?.person : partner?.id === id ? partner : undefined
    if (p) onProfile(p)
  }

  // 날짜가 바뀌는 곳에 구분선
  let lastDay = ''
  const rows = all.map((m) => {
    const d = dayDivider(m.at)
    const div = d !== lastDay ? <p key={`d-${m.id}`} className={s.day}><span>{d}</span></p> : null
    lastDay = d
    return [div, <Message key={m.id} m={m} room={room} myId={myId} onProfile={onProfile} onRetry={sender.retry} onDiscard={sender.discard} />]
  })

  const leaveRoom = () => run.mutate({
    call: () => chatCalls.leave(room.id), errorTitle: '나가지 못했어요', errors: CHAT_ERRORS,
    patches: [patch<ChatRoomItem[]>(chatKeys.rooms, (l) => l.filter((r) => r.id !== room.id))],
    invalidate: [chatKeys.rooms, chatKeys.room(room.id)],
  }, { onSuccess: () => { navigate('/chat'); onToast(room.kind === 'group' ? '모임을 나갔어요' : '대화방을 나갔어요') } })
  /** 모임 나가기: 끝나지 않은 모임은 모임의 참여 취소, 끝났거나 취소된 모임은 대화방에서만 (leaveType) */
  const quitMeetup = () => {
    if (room.leaveType === 'LEAVE_ROOM') { leaveRoom(); return }
    if (room.leaveType !== 'CANCEL_PARTICIPATION' || !meetup) return
    run.mutate({
      call: () => meetupCalls.cancelParticipation(meetup.id), errorTitle: '모임에서 나가지 못했어요', errors: { ...MEETUP_ERRORS, ...CHAT_ERRORS },
      patches: [patch<ChatRoomItem[]>(chatKeys.rooms, (l) => l.filter((r) => r.id !== room.id))],
      // 그 사이 모임이 끝나거나 취소되면 leaveType 이 바뀜 → 대화방을 다시 받아 버튼을 맞춤 (명세)
      invalidate: [chatKeys.rooms, chatKeys.room(room.id), meetupKeys.all],
    }, { onSuccess: () => { navigate('/chat'); onToast('모임을 나갔어요') } })
  }

  const placeholder = room.kind === 'group' ? '모임에 메시지 보내기' : '메시지를 입력하세요'
  const memberN = room.members.length

  return (
    <>
      <TeaRoom mode={room.kind === 'group' ? 'group' : 'dm'} guests={guests} greet={greet} spoke={spoke} roomKey={room.id} onPick={pickGuest} onMore={() => setInfo(true)} />

      <section className={s.panel} aria-label={`${meetup?.title ?? partner?.nickname ?? ''} 대화`}>
        <header className={s.head}>
          {meetup ? (
            <>
              <Initial text={meetup.title} tone={meetupToneOf(meetup.category)} size={42} />
              <div className={s.headText}>
                <h2 className="display">{meetup.title} <em>{memberN}명</em></h2>
                <p>{monthDay(meetup.startsAt)} {clock(meetup.startsAt)} · {meetup.online ? '온라인' : meetup.place ?? ''}</p>
              </div>
              <button className={s.headBtn} onClick={() => setInfo(true)}>모임 정보</button>
            </>
          ) : partner ? (
            <>
              <button className={s.who} onClick={() => onProfile(partner)} disabled={partner.id === GONE_ID} aria-label={partner.id === GONE_ID ? undefined : `${partner.nickname} 프로필 보기`}>
                <Avatar size={42} />
                <span className={s.headText}>
                  <h2 className="display">{partner.nickname}</h2>
                  {partner.id !== GONE_ID && <p>{shortAffOf(partner)} · 겹치는 관심사 {room.sharedInterests.length}개</p>}
                </span>
              </button>
              <button className={s.headBtn} onClick={() => setLeave(true)}>대화 나가기</button>
            </>
          ) : null}
        </header>

        {meetup && <NoticeBar room={room} />}
        {!room.readOnly && <ConnectionStrip />}

        <div className={s.messages} ref={scroller} aria-live="polite" aria-relevant="additions" onScroll={(e) => { if (e.currentTarget.scrollTop < 40) loadOlder() }}>
          {msgsQ.hasNextPage && (
            <button type="button" className={s.older} onClick={loadOlder} disabled={msgsQ.isFetchingNextPage}>{msgsQ.isFetchingNextPage ? '이전 메시지를 불러오는 중…' : '이전 메시지 더 보기'}</button>
          )}
          {msgsQ.isPending && <SkeletonRows count={4} label="메시지를 불러오는 중" />}
          {msgsQ.isError && !msgsQ.data && <ErrorState compact error={msgsQ.error} onRetry={() => void msgsQ.refetch()} retrying={msgsQ.isFetching} title="메시지를 불러오지 못했어요" />}
          {rows}
        </div>

        {room.readOnly ? (
          <p className={s.readonly}>{room.readOnlyReason === 'gone' ? '탈퇴한 사용자와는 더 이야기할 수 없어요. 대화는 읽기만 할 수 있어요.' : `${partner?.nickname ?? '상대'}님이 대화방을 나갔어요. 다시 이야기하려면 땅굴에서 대화를 요청해 주세요.`}</p>
        ) : (
          <Composer placeholder={placeholder} onSend={sender.send} onToast={onToast} />
        )}
      </section>

      {/* 1:1 대화 나가기 (확인 팝업 문구는 명세 보류 → 그대로) */}
      <ConfirmDialog open={leave} onClose={() => setLeave(false)} title="대화방을 나갈까요?" confirmLabel="나가기"
        desc={`나가면 이 대화가 내 목록에서 사라져요. ${partner?.nickname ?? ''}님 쪽에는 읽기 전용으로 남고, 다시 이야기하려면 대화 요청부터 다시 해야 해요.`}
        onConfirm={leaveRoom} />

      {/* 모임 정보 팝업 */}
      {meetup && (
        <Modal open={info} onClose={() => setInfo(false)} width={400} labelledBy="meet-info-title">
          <div className={s.info}>
            <h2 id="meet-info-title" className="display">모임 정보</h2>
            <p className={s.infoCat}><span>카테고리</span>
              <span className={s.infoTag} style={{ background: `var(--tone-${meetupToneOf(meetup.category)}-bg)`, color: `var(--tone-${meetupToneOf(meetup.category)}-fg)` }}>{catNameOf(meetup.category)}</span></p>
            <ul className={s.infoList}>
              <li><CalendarIcon size={15} /> {monthDay(meetup.startsAt)} {clock(meetup.startsAt)}{meetup.endsAt ? ` – ${clock(meetup.endsAt)}` : ''}{meetup.canceled ? ' (취소된 모임)' : ''}</li>
              <li><PinIcon size={15} /> {meetup.online ? '온라인' : [meetup.place, meetup.placeDetail].filter(Boolean).join(' ')}
                {meetup.online && meetup.joinUrl && <> · <a href={meetup.joinUrl} target="_blank" rel="noreferrer">접속 링크</a></>}</li>
              <li><span aria-hidden>👥</span> {meetup.capacity}명 중 {meetup.confirmedCount}명 확정</li>
            </ul>
            <p className={s.infoSub}>참여자 <span>{memberN}</span></p>
            <ul className={s.members}>
              {room.members.map((x) => (
                <li key={x.person.id}>
                  <button onClick={() => { setInfo(false); onProfile(x.person) }} disabled={x.isMe || x.person.id === GONE_ID}>
                    <Avatar size={30} /> {x.person.nickname}
                    {x.isHost && <em className={s.hostTag}>주최</em>}
                    {x.isMe && <em className={s.meTag}>나</em>}
                  </button>
                </li>
              ))}
            </ul>
            <Link to={`/meetups/${meetup.id}`} className="btn btn-line btn-block">모임 상세 보기</Link>
            {room.leaveType === 'NOT_ALLOWED' ? (
              // 주최자에게는 보여 주지 않고, 시작 24시간 전이 지난 참여자에게는 꺼 둠 (명세)
              meetup.hostId === myId ? null : <><button className={s.quit} disabled>모임 나가기</button><p className={s.quitNote}>시작 24시간 전부터는 나갈 수 없어요</p></>
            ) : (
              <button className={s.quit} onClick={() => { setInfo(false); setQuit(true) }}>모임 나가기</button>
            )}
          </div>
        </Modal>
      )}
      {/* 모임 나가기 확인: [아니오] → 모임 정보 팝업으로, [예] → 나가고 대화 선택 전으로 */}
      <ConfirmDialog open={quit} onClose={() => { setQuit(false); if (!quitting.current) setInfo(true); quitting.current = false }} confirmLabel="예" cancelLabel="아니오"
        title="정말 나가시겠습니까?"
        desc={room.leaveType === 'LEAVE_ROOM' ? '끝난 모임이라 참여 기록은 그대로예요. 이 대화만 목록에서 사라져요.' : '참여가 취소되고 이 대화가 목록에서 사라져요. 같은 모임에 다시 신청할 수 없어요.'}
        onConfirm={() => { quitting.current = true; quitMeetup() }} />
    </>
  )
}

/** 입력창: 사진 첨부(3장까지, 고를 때 바로 올림) · 입력 · 이모지 · 보내기. 글도 사진도 없으면 못 보냄 */
function Composer({ placeholder, onSend, onToast }: { placeholder: string; onSend: (text: string, images: { id: string; url: string }[]) => void; onToast: (t: string) => void }) {
  const [draft, setDraft] = useState('')
  const [pics, setPics] = useState<{ key: string; id?: string; url: string; preview: string }[]>([])
  const [emoji, setEmoji] = useState(false)
  const input = useRef<HTMLTextAreaElement>(null)
  const file = useRef<HTMLInputElement>(null)
  const uploading = pics.some((p) => !p.id)
  const canSend = !uploading && (!!draft.trim() || pics.length > 0)

  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])].slice(0, CHAT_IMAGES_MAX - pics.length)
    e.target.value = ''
    if (!files.length) { onToast(`사진은 ${CHAT_IMAGES_MAX}장까지 붙일 수 있어요`); return }
    for (const f of files) {
      const key = `${f.name}-${Math.random().toString(36).slice(2)}`
      let preview = ''
      try { preview = URL.createObjectURL(f) } catch { /* 무시 */ }
      setPics((l) => [...l, { key, url: '', preview }])
      uploadImage(f).then(
        (r) => setPics((l) => l.map((p) => (p.key === key ? { ...p, id: r.id, url: r.url } : p))),
        (err: unknown) => { setPics((l) => l.filter((p) => p.key !== key)); onToast(`사진을 올리지 못했어요. ${errorText(err)}`) },
      )
    }
  }
  const submit = () => {
    if (!canSend) return
    onSend(draft, pics.map((p) => ({ id: p.id!, url: p.url || p.preview })))
    setDraft(''); setPics([]); setEmoji(false)
    input.current?.focus()
  }

  return (
    <form className={s.composerWrap} onSubmit={(e) => { e.preventDefault(); submit() }}>
      {pics.length > 0 && (
        <ul className={s.attach} aria-label="붙인 사진">
          {pics.map((p) => (
            <li key={p.key} data-busy={!p.id || undefined}>
              {p.preview || p.url ? <img src={p.preview || p.url} alt="" /> : null}
              <button type="button" onClick={() => setPics((l) => l.filter((x) => x.key !== p.key))} aria-label="사진 빼기"><CloseIcon size={12} /></button>
            </li>
          ))}
        </ul>
      )}
      <div className={s.composer}>
        <button type="button" className={s.plus} onClick={() => file.current?.click()} disabled={pics.length >= CHAT_IMAGES_MAX} aria-label={`사진 첨부 (${CHAT_IMAGES_MAX}장까지)`}><PlusIcon size={18} /></button>
        <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={pick} />
        <label className={s.inputWrap}>
          <textarea ref={input} rows={1} value={draft} maxLength={CHAT_MESSAGE_MAX} placeholder={placeholder} aria-label={placeholder}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit() } }} />
          <span className={s.pop}>
            <button type="button" className={s.emojiBtn} onClick={() => setEmoji(!emoji)} aria-label="이모지" aria-expanded={emoji}>☺</button>
            {emoji && (
              <span className={s.emojis} role="menu">
                {EMOJIS.map((x) => <button key={x} type="button" role="menuitem" aria-label={`${x} 넣기`} onClick={() => { setDraft((d) => (d + x).slice(0, CHAT_MESSAGE_MAX)); setEmoji(false); input.current?.focus() }}>{x}</button>)}
              </span>
            )}
          </span>
        </label>
        <button className={s.send} disabled={!canSend} aria-label="보내기"><SendIcon size={18} /></button>
      </div>
    </form>
  )
}

/** 공지: 맨 위 고정, 하나만. 쓸 수 있는 사람(canEditNotice = 주최자)에게만 쓰기·고치기·지우기. 공지가 없으면 참여자에게는 줄이 안 보임 */
function NoticeBar({ room }: { room: ChatRoomVM }) {
  const run = useOptimistic()
  const [edit, setEdit] = useState(false)
  const [text, setText] = useState(room.notice ?? '')
  if (!room.notice && !room.canEditNotice) return null
  const save = (next: string | null) => run.mutate({
    call: () => (next ? chatCalls.setNotice(room.id, next) : chatCalls.deleteNotice(room.id)),
    errorTitle: next ? '공지를 저장하지 못했어요' : '공지를 지우지 못했어요', errors: CHAT_ERRORS,
    patches: [patch<ChatRoomVM>(chatKeys.room(room.id), (d) => ({ ...d, notice: next?.trim() || null }))],
  })
  if (edit) {
    return (
      <form className={s.noticeEdit} onSubmit={(e) => { e.preventDefault(); save(text); setEdit(false) }}>
        <textarea value={text} maxLength={CHAT_NOTICE_MAX} rows={2} onChange={(e) => setText(e.target.value)} placeholder="참여자 모두에게 보일 공지를 적어 주세요" autoFocus aria-label="공지" />
        <div><span>{text.length} / {CHAT_NOTICE_MAX}</span><button type="button" className="btn btn-line btn-sm" onClick={() => { setText(room.notice ?? ''); setEdit(false) }}>취소</button><button className="btn btn-cta btn-sm" disabled={!text.trim()}>저장</button></div>
      </form>
    )
  }
  if (!room.notice) return <button className={s.noticeAdd} onClick={() => setEdit(true)}><PenIcon size={14} /> 공지 쓰기</button>
  return (
    <div className={s.notice}>
      <strong><PinIcon size={14} /> 공지</strong>
      <p>{room.notice}</p>
      {room.canEditNotice && (
        <span className={s.noticeTools}>
          <button onClick={() => { setText(room.notice ?? ''); setEdit(true) }}>고치기</button>
          <button onClick={() => save(null)}>지우기</button>
        </span>
      )}
    </div>
  )
}

function Message({ m, room, myId, onProfile, onRetry, onDiscard }: {
  m: ChatMessage; room: ChatRoomVM; myId: string; onProfile: (p: Person) => void; onRetry: (clientId: string) => void; onDiscard: (clientId: string) => void
}) {
  if (isNoticeMessage(m)) {
    const start = room.kind === 'dm' && m.type === 'ACCEPTED'
    return (
      <div className={s.sysWrap}>
        <p className={s.system}>{start && '✓ '}{noticeText(m, room.kind, myId, room.counterpart?.nickname)}</p>
        {start && room.sharedInterests.length > 0 && (
          <p className={s.topics}>함께 이야기할 관심사 {room.sharedInterests.map((t) => <CheckChip key={t} label={t} />)}</p>
        )}
      </div>
    )
  }
  const mine = m.authorId === myId
  const host = !!room.meetup && room.meetup.hostId === m.authorId
  const time = m.status ? <SendState m={m} onRetry={onRetry} onDiscard={onDiscard} /> : <time>{clock(m.at)}</time>
  return (
    <div className={mine ? s.msgMine : s.msg}>
      {!mine && (
        <button className={s.msgAvatar} onClick={() => onProfile(m.author)} disabled={m.authorId === GONE_ID} aria-label={`${m.author.nickname} 프로필 보기`}><Avatar size={32} /></button>
      )}
      <div className={s.msgCol}>
        {!mine && room.kind === 'group' && <span className={s.author}>{m.author.nickname}{host && ' · 주최'}</span>}
        {m.images.length > 0 && (
          <div className={s.msgRow}>
            <div className={s.pics} data-status={m.status}>
              {m.images.map((i) => <a key={i.id} href={i.url} target="_blank" rel="noreferrer"><img src={i.url} alt="보낸 사진" /></a>)}
            </div>
            {!m.text && !m.card && time}
          </div>
        )}
        {m.text && (
          <div className={s.msgRow}>
            <p className={s.bubble} data-status={m.status}>{m.text}</p>
            {!m.card && time}
          </div>
        )}
        {m.card && (
          <div className={s.msgRow}>
            <div className={s.meetCard}>
              <div className={s.meetTop} style={{ background: `var(--tone-${toneOf(m.card.title)}-fg)` }}><span>모임</span></div>
              <div className={s.meetBody}>
                <strong>{m.card.title}</strong>
                <small>{monthDay(m.card.startsAt)} {clock(m.card.startsAt)} · {m.card.confirmedCount} / {m.card.capacity}명</small>
                <Link to={`/meetups/${m.card.meetupId}`} className="btn btn-line btn-block btn-sm">모임 보기</Link>
              </div>
            </div>
            {time}
          </div>
        )}
      </div>
    </div>
  )
}

/** 내 메시지 전송 상태: 보내는 중 · 실패(다시 보내기 · 지우기) */
function SendState({ m, onRetry, onDiscard }: { m: ChatMessage; onRetry: (clientId: string) => void; onDiscard: (clientId: string) => void }) {
  if (m.status === 'sending') return <span className={s.sending}>보내는 중</span>
  return (
    <span className={s.failed} role="alert">
      <span>{m.error ?? '보내지 못했어요'}</span>
      <span className={s.failedTools}>
        <button type="button" onClick={() => onRetry(m.clientId!)}>다시 보내기</button>
        <button type="button" onClick={() => onDiscard(m.clientId!)} aria-label="보내지 못한 메시지 지우기">지우기</button>
      </span>
    </span>
  )
}

function CheckChip({ label }: { label: string }) {
  const t = toneOf(label)
  return <span className={s.checkChip} style={{ background: `var(--tone-${t}-bg)`, color: `var(--tone-${t}-fg)` }}>✓ {label}</span>
}

/* ===================== 요청 ===================== */
function Requests({ onProfile, onToast, count }: { onProfile: (p: Person) => void; onToast: (t: string) => void; count?: ChatRequestCount }) {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [dir, setDir] = useState<'received' | 'sent'>(params.get('dir') === 'sent' ? 'sent' : 'received')
  const DIR = dir === 'received' ? 'RECEIVED' : 'SENT'
  // 요청 목록은 서버에서 (5일 지난 요청 · 거절을 숨기는 것은 서버가 함). 수락 · 거절 · 취소는 목록에서 먼저 빼고 실패하면 되돌림
  const rq = useChatRequests(DIR)
  const run = useOptimistic()
  const [picked, setPicked] = useState<string | null>(null)
  const [decline, setDecline] = useState<ChatRequestVM | null>(null)
  const list = rq.data ?? []
  const focus = list.find((r) => r.id === picked) ?? list[0]
  // 고른 요청의 사람 정보는 남의 땅굴 조회 (05 GET /users/{userId}/burrow, 방노트와 같은 값)
  const burrow = useVisitBurrow(focus?.person.id ?? '', !!focus && focus.person.id !== GONE_ID)
  const who: Person | undefined = focus ? { ...focus.person, ...(burrow.data?.owner ?? {}) } : undefined
  const shared = new Set(focus?.shared ?? [])

  const drop = (r: ChatRequestVM, call: () => Promise<unknown>, done: string, fail: string, next?: string) => run.mutate({
    call, errorTitle: fail, errors: CHAT_ERRORS,
    patches: [
      patch<ChatRequestVM[]>(chatKeys.requests(DIR), (l) => l.filter((x) => x.id !== r.id)),
      patch<ChatRequestCount>(chatKeys.requestCount, (c) => (dir === 'received' ? { ...c, received: Math.max(0, c.received - 1) } : { ...c, sent: Math.max(0, c.sent - 1) })),
    ],
    // 이미 처리된 요청(CHAT_REQUEST_NOT_FOUND) · 이미 수락됨(CHAT_REQUEST_ALREADY_ACCEPTED)이면 목록 · 대화 목록을 다시 받음 (명세)
    invalidate: [chatKeys.requestsAll, chatKeys.requestCount, chatKeys.rooms],
  }, { onSuccess: () => { onToast(done); if (next !== undefined) setPicked(next) } })
  const accept = (r: ChatRequestVM) => run.mutate({
    call: () => chatCalls.accept(r.id), errorTitle: '요청을 수락하지 못했어요', errors: CHAT_ERRORS,
    patches: [patch<ChatRequestVM[]>(chatKeys.requests('RECEIVED'), (l) => l.filter((x) => x.id !== r.id))],
    invalidate: [chatKeys.requestsAll, chatKeys.requestCount, chatKeys.rooms],
  }, { onSuccess: (roomId) => navigate(`/chat/${roomId as string}`) })
  /** 거절한 다음 고를 요청 (거절 완료 토스트 2: 다음 요청이 자동으로 선택됨) */
  const nextAfter = (r: ChatRequestVM) => { const i = list.findIndex((x) => x.id === r.id); return (list[i + 1] ?? list[i - 1])?.id ?? '' }

  return (
    <>
      <section className={`${s.panel} ${s.reqPanel}`} aria-label="요청">
        <header className={s.reqHead}>
          <h2 className="display">요청</h2>
          <p>받은 대화 요청과 보낸 대화 요청을 확인해요. 모임 참여 신청은 모임에서 확인해요.</p>
        </header>
        <div className={s.dirBar}>
          <div className={s.dirToggle} role="tablist" aria-label="받은 요청 / 보낸 요청">
            {(['received', 'sent'] as const).map((d) => (
              <button key={d} role="tab" aria-selected={dir === d} className={dir === d ? s.dirOn : s.dir} onClick={() => { setDir(d); setPicked(null) }}>
                {d === 'received' ? '받은 요청' : '보낸 요청'} {count && <span>{d === 'received' ? count.received : count.sent}</span>}
              </button>
            ))}
          </div>
          <p>{dir === 'received' ? '수락하면 바로 대화방이 열려요. 거절해도 상대에게 따로 알림이 가지 않아요.' : '보낸 지 5일이 지나면 사라져요. 그 전에는 언제든 취소할 수 있어요.'}</p>
        </div>
        <div className={s.reqList} aria-busy={rq.isFetching}>
          {rq.isPending && <SkeletonRows count={3} label="요청을 불러오는 중" />}
          {rq.isError && !rq.data && <ErrorState compact error={rq.error} onRetry={() => void rq.refetch()} retrying={rq.isFetching} title="요청을 불러오지 못했어요" />}
          {rq.data && list.length === 0 && <EmptyMole message={dir === 'received' ? '받은 대화 요청이 없어요' : '보낸 대화 요청이 없어요'} />}
          {list.map((r) => {
            const u = r.person
            return (
              <article key={r.id} className={focus?.id === r.id ? s.reqCardOn : s.reqCard} onClick={() => setPicked(r.id)}
                tabIndex={0} aria-current={focus?.id === r.id ? 'true' : undefined} aria-label={`${u.nickname}님 ${r.direction === 'received' ? '받은' : '보낸'} 요청 · ${agoChat(r.at)}`}
                onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setPicked(r.id) } }}>
                <div className={s.reqTop}>
                  <Initial text={u.nickname} tone={toneOf(r.shared[0] ?? u.id)} size={42} />
                  <div className={s.reqWho}>
                    <p><strong>{u.nickname}</strong><em>대화 요청</em></p>
                    <small>{shortAffOf(u)}</small>
                  </div>
                  <time>◷ {agoChat(r.at)}</time>
                </div>
                {r.shared.length > 0 && <div className={s.reqShared}>겹치는 관심사 {r.shared.slice(0, 3).map((i) => <CheckChip key={i} label={i} />)}</div>}
                {r.message && <blockquote className={s.reqMsg}>“{r.message}”</blockquote>}
                <div className={s.reqActions}>
                  {r.direction === 'received' ? (
                    <>
                      <button className="btn btn-line btn-sm" onClick={(e) => { e.stopPropagation(); setDecline(r) }}>거절</button>
                      <button className="btn btn-cta btn-sm" disabled={run.isPending} onClick={(e) => { e.stopPropagation(); accept(r) }}><ChatIcon size={15} /> 수락하고 대화하기</button>
                    </>
                  ) : (
                    <>
                      <span className={s.waiting}>● 답변 기다리는 중</span>
                      <button className="btn btn-line btn-sm" onClick={(e) => { e.stopPropagation(); drop(r, () => chatCalls.cancel(r.id), '요청을 취소했어요', '요청을 취소하지 못했어요') }}>요청 취소</button>
                    </>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <aside className={`${s.panel} ${s.side}`} aria-label={dir === 'received' ? '요청 보낸 사람' : '요청 받은 사람'}>
        <h3 className="display">{dir === 'received' ? '요청 보낸 사람' : '요청 받은 사람'}</h3>
        {who ? (
          <>
            <button className={s.sideWho} onClick={() => onProfile(who)} aria-label={`${who.nickname} 프로필 보기`}>
              <span className={s.sideMole}><Avatar size={76} /></span>
              <strong className="display">{who.nickname}</strong>
              <span>{shortAffOf(who)}</span>
            </button>
            <div className={s.sideIntro}><strong>자기소개</strong><p>{who.intro || '아직 작성한 자기소개가 없어요.'}</p></div>
            <hr className={s.rule} />
            <p className={s.sideSub}>관심사 <span>{who.interests.length}</span></p>
            <div className={s.chips}>{who.interests.map((i) => (shared.has(i) ? <CheckChip key={i} label={i} /> : <span key={i} className={s.plainChip} style={{ background: `var(--tone-${toneOf(i)}-bg)`, color: `var(--tone-${toneOf(i)}-fg)` }}>{i}</span>))}</div>
            {who.qna?.length ? (
              <>
                <p className={s.sideSub}>질문과 답변</p>
                <dl className={s.sideQna}>{who.qna.slice(0, 3).map((x) => <div key={x.q}><dt>{x.q.replace(/^Q\d\.\s*/, 'Q. ')}</dt><dd>{x.a}</dd></div>)}</dl>
              </>
            ) : null}
            <Link to={`/burrow/${who.id}`} className={`btn btn-line btn-block ${s.sideGo}`}><HomeIcon size={16} /> {who.nickname}님의 땅굴 놀러 가기</Link>
          </>
        ) : <p className={s.sideEmpty}>고른 요청이 없어요.</p>}
      </aside>

      <ConfirmDialog open={!!decline} onClose={() => setDecline(null)} title="요청을 거절하시겠습니까?" confirmLabel="예" cancelLabel="아니오"
        desc="거절해도 상대에게 따로 알림이 가지 않아요."
        onConfirm={() => { if (decline) drop(decline, () => chatCalls.reject(decline.id), '요청을 거절했어요', '요청을 거절하지 못했어요', nextAfter(decline)) }} />
    </>
  )
}
