import { useEffect, useMemo, useRef, useState } from 'react'
import { useBlocked } from '../../data/account'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Avatar from '../../components/Avatar'
import Modal from '../../components/Modal'
import ProfilePopup from '../../components/ProfilePopup'
import { ConfirmDialog, EmptyMole, Toast } from '../../components/Feedback'
import { CalendarIcon, ChatIcon, CompassIcon, HomeIcon, PenIcon, PinIcon, PlusIcon, SearchIcon, SendIcon } from '../../components/Icons'
import { ME_ID, USERS, toneOf } from '../../data/mock'
import { findMeetup as meetupOf, useMeetups } from '../../data/meetupStore'
import { getMyWorn } from '../../data/moleItems'
import { getMyInterests } from '../../data/interests'
import { shortAffOf } from '../../data/field'
import { dateLabel } from '../../lib/format'
import type { User } from '../../data/types'
import {
  GONE_ID, quitGroup, syncGroupRooms, canQuitMeetup, clock, dayLabel, fakeReply, leaveRoom, markRead,
  membersOf, myMeetups, personOf, roomOf, roomTitle, send, setNotice, useChat, type ChatMsg, type Req, type Room,
} from '../../data/chat'
import TeaRoom, { type TeaGuest } from './TeaRoom'
import s from './Chat.module.css'
import { api } from '../../api'
import type { ChatReqVM, ChatRoomItem } from '../../api/mappers'
import { patch, useChatRequests, useChatRooms, useOptimistic } from '../../api/queries'
import { qk } from '../../api/queryClient'
import type { AcceptChatRequestResponse } from '../../api/types'
import { ErrorState, SkeletonRows } from '../../components/AsyncState'
import { agoChat, chatListTime } from '../../lib/time'

/** 검색어는 치는 동안 바로 보내지 않고 잠깐 기다렸다가 (서버 검색) */
function useDebounced<T>(v: T, ms = 250) {
  const [d, setD] = useState(v)
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t) }, [v, ms])
  return d
}

/**
 * 채팅 (Figma 02 F6 · 00 공통 14, 디자인은 03 Screens 채팅 묶음 참고). 2026-11-16 새로 만듦
 * 세 칸: 왼쪽 대화 목록 · 가운데 찻방(두더지들이 찻상에 둘러앉음) · 오른쪽 대화 창. 요청 탭은 찻방·대화 창 대신 요청 목록 + 보낸/받은 사람 프로필
 * /chat               대화 선택 전 1016:9039
 * /chat/:roomId       1:1 대화 1014:8920 · 모임 대화 1017:9267 (+ 모임 정보 팝업 1017:9902)
 * /chat/requests      요청 · 받은 요청 1018:9513 · 보낸 요청 1018:10007 (?dir=sent)
 * - 필터: 전체 / 1:1 / 모임 / 요청 N (N = 받은 대화 요청 수만). 모임 참여 신청은 모임(F7)에서 처리
 * - "접속 중" 표시·읽음 표시·메시지 지우기는 없음 (명세)
 * 상태는 data/chat.ts (이 탭 안에서만 기억)
 */
type Filter = 'all' | 'dm' | 'group'

export default function Chat({ requests }: { requests?: boolean }) {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const st = useChat()
  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')
  const [profile, setProfile] = useState<User | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  // 모임 저장소가 바뀌면(새 모임·참여 확정·모임 끝남) 대화방 맞추기
  const meetups = useMeetups()
  useEffect(() => { syncGroupRooms() }, [meetups])
  const room = roomId ? roomOf(roomId, st) : undefined
  // 대화 목록 · 요청 수는 서버에서 (api/chat.ts). 메시지 주고받기는 아직 data/chat.ts (실시간 작업에서 바꿈)
  const word = useDebounced(q.trim())
  const rooms = useChatRooms({ type: filter === 'all' ? undefined : filter === 'dm' ? 'DIRECT' : 'MEETUP', q: word || undefined })
  const reqs = useChatRequests()
  const blocked = useBlocked()
  const reqN = (reqs.data ?? []).filter((r) => r.direction === 'received' && !blocked.some((b) => b.id === r.userId)).length
  // 차단한 사람과의 1:1 은 서버도 빼지만, 방금 차단한 경우를 위해 한 번 더
  const list = (rooms.data ?? []).filter((r) => !(r.kind === 'dm' && blocked.some((b) => b.id === r.partnerId)))

  const pickFilter = (f: Filter) => { setFilter(f); if (requests) navigate('/chat') }
  const openProfile = (id: string) => { if (id !== GONE_ID) setProfile(personOf(id)) }

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
            <Link to="/chat/requests" role="tab" aria-selected={!!requests} className={requests ? s.filterOn : s.filter}>요청 {reqs.data ? reqN : ''}</Link>
          </div>
          {rooms.isPending ? (
            <SkeletonRows count={5} label="대화 목록을 불러오는 중" compact />
          ) : rooms.isError && !rooms.data ? (
            <ErrorState compact error={rooms.error} onRetry={() => void rooms.refetch()} retrying={rooms.isFetching} title="대화 목록을 불러오지 못했어요" />
          ) : (
            <ul className={s.convs} aria-busy={rooms.isFetching}>
              {list.map((r) => <ListItem key={r.id} room={r} active={!requests && r.id === room?.id} />)}
              {list.length === 0 && <li className={s.listEmpty}>{q ? '찾는 대화가 없어요' : '아직 대화가 없어요'}</li>}
            </ul>
          )}
        </section>

        {requests ? (
          <Requests onProfile={openProfile} onToast={setToast} />
        ) : room ? (
          <RoomPane key={room.id} room={room} onProfile={openProfile} onToast={setToast} />
        ) : roomId ? (
          <>
            <TeaRoom mode="empty" guests={[meGuest()]} />
            <section className={`${s.panel} ${s.emptyPanel}`}>
              <EmptyMole message="없는 대화예요">
                <p className={s.emptyText}>나간 대화이거나 주소가 잘못됐어요.</p>
                <Link to="/chat" className="btn btn-line">대화 목록으로</Link>
              </EmptyMole>
            </section>
          </>
        ) : (
          <>
            <TeaRoom mode="empty" guests={[meGuest()]} />
            <section className={`${s.panel} ${s.emptyPanel}`}>
              <EmptyMole message="아직 고른 대화가 없어요">
                <p className={s.emptyText}>왼쪽 목록에서 대화를 골라주세요. 아직 대화가 없다면 땅굴을 둘러보다가 마음에 드는 두더지에게 대화를 요청해 보세요.</p>
                <div className={s.emptyActions}>
                  <Link to="/burrow/explore" className="btn btn-cta"><CompassIcon size={16} /> 땅굴 둘러보기</Link>
                  <Link to="/chat/requests" className="btn btn-line">받은 요청 보기 <span className="count-badge">{reqN}</span></Link>
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

const meGuest = (): TeaGuest => ({ id: ME_ID, name: USERS[ME_ID].nickname, worn: getMyWorn(), me: true })
const guestOf = (id: string): TeaGuest => (id === ME_ID ? meGuest() : { id, name: personOf(id).nickname, worn: personOf(id).worn ?? [], gone: id === GONE_ID })

/** 이름 첫 글자 타일 (03 Chat List Item) */
function Initial({ text, tone, size = 44 }: { text: string; tone: string; size?: number }) {
  return <span className={s.initial} style={{ width: size, height: size, background: `var(--tone-${tone}-bg)`, color: `var(--tone-${tone}-fg)` }} aria-hidden>{text.slice(0, 1)}</span>
}
/** 대화 목록 한 줄 (서버 응답 ChatRoomSummary → api/mappers ChatRoomItem) */
function ListItem({ room, active }: { room: ChatRoomItem; active: boolean }) {
  return (
    <li>
      <Link to={`/chat/${room.id}`} className={active ? s.convOn : s.conv} aria-current={active ? 'page' : undefined}>
        <Initial text={room.title} tone={toneOf(room.topic)} />
        <span className={s.convBody}>
          <span className={s.convTop}>
            <strong>{room.title}</strong>
            {room.kind === 'group' && <em>{room.memberCount}명</em>}
            <time>{room.lastAt ? chatListTime(room.lastAt) : ''}</time>
          </span>
          <span className={s.convSub}>
            <span>{room.closed ? (room.closed === 'gone' ? '상대방이 탈퇴했어요' : '상대방이 대화방을 나갔어요') : room.preview}</span>
            {room.unread > 0 && <b className={s.unread}>{room.unread}</b>}
          </span>
        </span>
      </Link>
    </li>
  )
}

/* ===================== 대화 (1:1 · 모임) ===================== */
const REPLIES = ['오 좋아요! 😊', '헉 저도 그 생각 했어요 ㅋㅋ', '좋아요, 그럼 그때 봬요!', '앗 그거 완전 궁금했어요']
const replied = new Set<string>()
const EMOJIS = ['😊', '😂', '🥹', '👍', '🙏', '🎉', '☕', '🍵', '🐾', '🌱', '🏕️', '📚']

function RoomPane({ room, onProfile, onToast }: { room: Room; onProfile: (id: string) => void; onToast: (t: string) => void }) {
  const navigate = useNavigate()
  const me = USERS[ME_ID]
  const myInt = getMyInterests(me.interests)
  const meetup = room.meetupId ? meetupOf(room.meetupId) : undefined
  const partner = room.partnerId ? personOf(room.partnerId) : undefined
  const isHost = meetup?.hostId === ME_ID
  const [draft, setDraft] = useState('')
  const [typing, setTyping] = useState(false)
  const [greet, setGreet] = useState<{ id: string; n: number }>({ id: ME_ID, n: 0 })
  const [menu, setMenu] = useState<null | 'plus' | 'emoji'>(null)
  const [leave, setLeave] = useState(false)
  const [params] = useSearchParams()
  const [info, setInfo] = useState(params.get('info') === '1')
  const [quit, setQuit] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { markRead(room.id) }, [room.id, room.messages.length])
  // 새 메시지가 오면 맨 아래로
  useEffect(() => { const el = scroller.current; if (el) el.scrollTop = el.scrollHeight }, [room.messages.length, typing])

  const guests = useMemo<TeaGuest[]>(() => (room.kind === 'group' ? membersOf(room).sort((a, b) => (a === ME_ID ? -1 : b === ME_ID ? 1 : 0)).map(guestOf) : [meGuest(), guestOf(room.partnerId!)]), [room])

  const submit = (text = draft, meetupId?: string) => {
    if (!text.trim() && !meetupId) return // 빈 메시지는 보낼 수 없음
    send(room.id, text.trim(), meetupId)
    setDraft(''); setMenu(null)
    setGreet((g) => ({ id: ME_ID, n: g.n + 1 }))
    // 목 데이터: 1:1 에서 처음 보내면 상대가 한 번 답함
    if (room.kind === 'dm' && !room.closed && !replied.has(room.id)) {
      replied.add(room.id)
      const pid = room.partnerId!
      window.setTimeout(() => setTyping(true), 900)
      window.setTimeout(() => { setTyping(false); fakeReply(room.id, REPLIES[Math.floor(Math.random() * REPLIES.length)]); setGreet((g) => ({ id: pid, n: g.n + 1 })) }, 2600)
    }
    input.current?.focus()
  }

  // 날짜가 바뀌는 곳에 구분선
  let lastDay = ''
  const rows = room.messages.map((m) => {
    const d = dayLabel(m.at)
    const div = d !== lastDay ? <p key={`d-${m.id}`} className={s.day}><span>{d}</span></p> : null
    lastDay = d
    return [div, <Message key={m.id} m={m} room={room} topics={room.topics} onProfile={onProfile} />]
  })

  const quitRule = canQuitMeetup(room)
  const placeholder = room.kind === 'group' ? '모임에 메시지 보내기' : '메시지를 입력하세요'

  return (
    <>
      <TeaRoom mode={room.kind === 'group' ? 'group' : 'dm'} guests={guests} greet={greet} onPick={onProfile} />

      <section className={s.panel} aria-label={`${roomTitle(room)} 대화`}>
        <header className={s.head}>
          {meetup ? (
            <>
              <Initial text={meetup.title} tone={toneOf(meetup.interest)} size={42} />
              <div className={s.headText}>
                <h2 className="display">{meetup.title} <em>{membersOf(room).length}명</em></h2>
                <p>{dateLabel(meetup.date)} {meetup.start} · {meetup.place}</p>
              </div>
              <button className={s.headBtn} onClick={() => setInfo(true)}>모임 정보</button>
            </>
          ) : (
            <>
              <button className={s.who} onClick={() => onProfile(partner!.id)} disabled={room.closed === 'gone'} aria-label={room.closed === 'gone' ? undefined : `${partner!.nickname} 프로필 보기`}>
                <Avatar size={42} />
                <span className={s.headText}>
                  <h2 className="display">{partner!.nickname}</h2>
                  {room.closed !== 'gone' && <p>{shortAffOf(partner!)} · 겹치는 관심사 {partner!.interests.filter((i) => myInt.includes(i)).length}개</p>}
                </span>
              </button>
              <button className={s.headBtn} onClick={() => setLeave(true)}>대화 나가기</button>
            </>
          )}
        </header>

        {meetup && <NoticeBar room={room} isHost={isHost} />}

        <div className={s.messages} ref={scroller} aria-live="polite">
          {rows}
          {room.closed && <p className={s.system}>{room.closed === 'gone' ? '상대방이 탈퇴했습니다' : '상대방이 대화방을 나갔습니다'}</p>}
          {typing && partner && <p className={s.typing}><Avatar size={22} /> {partner.nickname}님이 입력 중…</p>}
        </div>

        {room.closed ? (
          <p className={s.readonly}>{room.closed === 'gone' ? '탈퇴한 사용자와는 더 이야기할 수 없어요. 대화는 읽기만 할 수 있어요.' : `${partner!.nickname}님이 대화방을 나갔어요. 다시 이야기하려면 땅굴에서 대화를 요청해 주세요.`}</p>
        ) : (
          <form className={s.composer} onSubmit={(e) => { e.preventDefault(); submit() }}>
            <div className={s.pop}>
              <button type="button" className={s.plus} onClick={() => setMenu(menu === 'plus' ? null : 'plus')} aria-label="첨부" aria-expanded={menu === 'plus'}><PlusIcon size={18} /></button>
              {menu === 'plus' && (
                <div className={s.menu} role="menu">
                  <p className={s.menuHead}>모임 공유하기</p>
                  {myMeetups().map((m) => (
                    <button key={m.id} type="button" role="menuitem" onClick={() => submit('', m.id)}>
                      <CalendarIcon size={14} /> <span>{m.title}</span><small>{dateLabel(m.date)}</small>
                    </button>
                  ))}
                  <p className={s.menuNote}>모임 상세에서 복사한 링크를 붙여 넣어도 모임 카드로 보여요</p>
                </div>
              )}
            </div>
            <label className={s.inputWrap}>
              <textarea ref={input} rows={1} value={draft} maxLength={500} placeholder={placeholder} aria-label={placeholder}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit() } }} />
              <span className={s.pop}>
                <button type="button" className={s.emojiBtn} onClick={() => setMenu(menu === 'emoji' ? null : 'emoji')} aria-label="이모지" aria-expanded={menu === 'emoji'}>☺</button>
                {menu === 'emoji' && (
                  <span className={s.emojis} role="menu">
                    {EMOJIS.map((e) => <button key={e} type="button" role="menuitem" onClick={() => { setDraft((d) => d + e); setMenu(null); input.current?.focus() }}>{e}</button>)}
                  </span>
                )}
              </span>
            </label>
            <button className={s.send} disabled={!draft.trim()} aria-label="보내기"><SendIcon size={18} /></button>
          </form>
        )}
      </section>

      {/* 1:1 대화 나가기 */}
      <ConfirmDialog open={leave} onClose={() => setLeave(false)} title="대화방을 나갈까요?" confirmLabel="나가기"
        desc={`나가면 이 대화가 내 목록에서 사라져요. ${partner?.nickname ?? ''}님 쪽에는 읽기 전용으로 남고, 다시 이야기하려면 대화 요청부터 다시 해야 해요.`}
        onConfirm={() => { leaveRoom(room.id); navigate('/chat'); onToast('대화방을 나갔어요') }} />

      {/* 모임 정보 팝업 */}
      {meetup && (
        <Modal open={info} onClose={() => setInfo(false)} width={400} labelledBy="meet-info-title">
          <div className={s.info}>
            <h2 id="meet-info-title" className="display">모임 정보</h2>
            <span className={s.infoTag} style={{ background: `var(--tone-${toneOf(meetup.interest)}-bg)`, color: `var(--tone-${toneOf(meetup.interest)}-fg)` }}>{meetup.interest}</span>
            <ul className={s.infoList}>
              <li><CalendarIcon size={15} /> {dateLabel(meetup.date)} {meetup.start} – {meetup.end}</li>
              <li><PinIcon size={15} /> {meetup.place}</li>
              <li><span aria-hidden>👥</span> {meetup.capacity}명 중 {membersOf(room).length}명 확정</li>
            </ul>
            <p className={s.infoSub}>참여자 <span>{membersOf(room).length}</span></p>
            <ul className={s.members}>
              {membersOf(room).map((id) => (
                <li key={id}>
                  <button onClick={() => { setInfo(false); onProfile(id) }} disabled={id === ME_ID}>
                    <Avatar size={30} /> {personOf(id).nickname}
                    {id === meetup.hostId && <em className={s.hostTag}>주최</em>}
                    {id === ME_ID && <em className={s.meTag}>나</em>}
                  </button>
                </li>
              ))}
            </ul>
            <Link to={`/meetups/${meetup.id}`} className="btn btn-line btn-block">모임 상세 보기</Link>
            {quitRule.ok ? (
              <button className={s.quit} onClick={() => { setInfo(false); setQuit(true) }}>{room.ended ? '대화방 나가기' : '모임 나가기'}</button>
            ) : quitRule.why && !isHost ? <p className={s.quitNote}>{quitRule.why}</p> : null}
          </div>
        </Modal>
      )}
      <ConfirmDialog open={quit} onClose={() => setQuit(false)} confirmLabel="예"
        title={room.ended ? '대화방을 나갈까요?' : '정말 나가시겠습니까?'}
        desc={room.ended ? '끝난 모임이라 참여 기록은 그대로예요. 이 대화만 목록에서 사라져요.' : '참여가 취소되고 이 대화가 목록에서 사라져요.'}
        onConfirm={() => { quitGroup(room.id); navigate('/chat'); onToast(room.ended ? '대화방을 나갔어요' : '모임을 나갔어요') }} />
    </>
  )
}

/** 공지: 맨 위 고정, 하나만. 주최자에게만 쓰기·고치기·지우기. 공지가 없으면 참여자에게는 줄이 안 보임 */
function NoticeBar({ room, isHost }: { room: Room; isHost: boolean }) {
  const [edit, setEdit] = useState(false)
  const [text, setText] = useState(room.notice ?? '')
  if (!room.notice && !isHost) return null
  if (edit) {
    return (
      <form className={s.noticeEdit} onSubmit={(e) => { e.preventDefault(); setNotice(room.id, text); setEdit(false) }}>
        <textarea value={text} maxLength={100} rows={2} onChange={(e) => setText(e.target.value)} placeholder="참여자 모두에게 보일 공지를 적어 주세요" autoFocus aria-label="공지" />
        <div><span>{text.length} / 100</span><button type="button" className="btn btn-line btn-sm" onClick={() => { setText(room.notice ?? ''); setEdit(false) }}>취소</button><button className="btn btn-cta btn-sm" disabled={!text.trim()}>저장</button></div>
      </form>
    )
  }
  if (!room.notice) return <button className={s.noticeAdd} onClick={() => setEdit(true)}><PenIcon size={14} /> 공지 쓰기</button>
  return (
    <div className={s.notice}>
      <strong><PinIcon size={14} /> 공지</strong>
      <p>{room.notice}</p>
      {isHost && (
        <span className={s.noticeTools}>
          <button onClick={() => { setText(room.notice ?? ''); setEdit(true) }}>고치기</button>
          <button onClick={() => setNotice(room.id, null)}>지우기</button>
        </span>
      )}
    </div>
  )
}

function Message({ m, room, topics, onProfile }: { m: ChatMsg; room: Room; topics?: string[]; onProfile: (id: string) => void }) {
  if (m.system) {
    const start = room.kind === 'dm' && /대화 요청을 수락/.test(m.text)
    return (
      <div className={s.sysWrap}>
        <p className={s.system}>{start && '✓ '}{m.text}</p>
        {start && topics && topics.length > 0 && (
          <p className={s.topics}>함께 이야기할 관심사 {topics.map((t) => <CheckChip key={t} label={t} />)}</p>
        )}
      </div>
    )
  }
  const mine = m.authorId === ME_ID
  const meetup = m.meetupId ? meetupOf(m.meetupId) : undefined
  const who = personOf(m.authorId)
  const host = room.meetupId && meetupOf(room.meetupId)?.hostId === m.authorId
  return (
    <div className={mine ? s.msgMine : s.msg}>
      {!mine && (
        <button className={s.msgAvatar} onClick={() => onProfile(m.authorId)} disabled={m.authorId === GONE_ID} aria-label={`${who.nickname} 프로필 보기`}><Avatar size={32} /></button>
      )}
      <div className={s.msgCol}>
        {!mine && room.kind === 'group' && <span className={s.author}>{who.nickname}{host && ' · 주최'}</span>}
        {m.text && (
          <div className={s.msgRow}>
            <p className={s.bubble}>{m.text}</p>
            <time>{clock(m.at)}</time>
          </div>
        )}
        {meetup && (
          <div className={s.msgRow}>
            <div className={s.meetCard}>
              <div className={s.meetTop} style={{ background: `var(--tone-${toneOf(meetup.interest)}-fg)` }}><span>{meetup.sign ?? meetup.interest}</span></div>
              <div className={s.meetBody}>
                <strong>{meetup.title}</strong>
                <small>{dateLabel(meetup.date)} {meetup.start} · {meetup.memberIds.length} / {meetup.capacity}명</small>
                <Link to={`/meetups/${meetup.id}`} className="btn btn-line btn-block btn-sm">모임 보기</Link>
              </div>
            </div>
            {!m.text && <time>{clock(m.at)}</time>}
          </div>
        )}
      </div>
    </div>
  )
}

function CheckChip({ label }: { label: string }) {
  const t = toneOf(label)
  return <span className={s.checkChip} style={{ background: `var(--tone-${t}-bg)`, color: `var(--tone-${t}-fg)` }}>✓ {label}</span>
}

/* ===================== 요청 ===================== */
function Requests({ onProfile, onToast }: { onProfile: (id: string) => void; onToast: (t: string) => void }) {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  // 요청 목록은 서버에서 (5일 지난 요청은 서버가 뺌). 수락 · 거절 · 취소는 목록에서 먼저 빼고 실패하면 되돌림
  const rq = useChatRequests()
  const run = useOptimistic()
  const [dir, setDir] = useState<'received' | 'sent'>(params.get('dir') === 'sent' ? 'sent' : 'received')
  const [picked, setPicked] = useState<string | null>(null)
  const [decline, setDecline] = useState<ChatReqVM | null>(null)
  const blocked = useBlocked()
  const all = (rq.data ?? []).filter((r) => !blocked.some((b) => b.id === r.userId))
  const list = all.filter((r) => r.direction === dir)
  const count = (d: Req['direction']) => all.filter((r) => r.direction === d).length
  const focus = list.find((r) => r.id === picked) ?? list[0]
  const who = focus?.person
  const drop = (r: ChatReqVM, call: () => Promise<unknown>, done: string, fail: string) => run.mutate({
    call, errorTitle: fail, invalidate: [qk.chat],
    patches: [patch<ChatReqVM[]>(qk.chatRequests, (l) => l.filter((x) => x.id !== r.id))],
  }, { onSuccess: () => onToast(done) })
  const accept = (r: ChatReqVM) => run.mutate({
    call: () => api.chat.acceptRequest(r.id), errorTitle: '요청을 수락하지 못했어요', invalidate: [qk.chat],
    patches: [patch<ChatReqVM[]>(qk.chatRequests, (l) => l.filter((x) => x.id !== r.id))],
  }, { onSuccess: (res) => navigate(`/chat/${(res as AcceptChatRequestResponse).chatRoomId}`) })
  const myInt = getMyInterests(USERS[ME_ID].interests)

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
                {d === 'received' ? '받은 요청' : '보낸 요청'} {rq.data && <span>{count(d)}</span>}
              </button>
            ))}
          </div>
          <p>{dir === 'received' ? '수락하면 바로 대화방이 열려요. 거절해도 상대에게 따로 알림이 가지 않아요.' : '상대가 답하기 전까지는 언제든 취소할 수 있어요.'}</p>
        </div>
        <div className={s.reqList} aria-busy={rq.isFetching}>
          {rq.isPending && <SkeletonRows count={3} label="요청을 불러오는 중" />}
          {rq.isError && !rq.data && <ErrorState compact error={rq.error} onRetry={() => void rq.refetch()} retrying={rq.isFetching} title="요청을 불러오지 못했어요" />}
          {rq.data && list.length === 0 && <EmptyMole message={dir === 'received' ? '받은 대화 요청이 없어요' : '보낸 대화 요청이 없어요'} />}
          {list.map((r) => {
            const u = r.person
            const shared = u.interests.filter((i) => myInt.includes(i))
            return (
              <article key={r.id} className={focus?.id === r.id ? s.reqCardOn : s.reqCard} onClick={() => setPicked(r.id)}>
                <div className={s.reqTop}>
                  <Initial text={u.nickname} tone={toneOf(u.interests[0] ?? u.id)} size={42} />
                  <div className={s.reqWho}>
                    <p><strong>{u.nickname}</strong><em>대화 요청</em></p>
                    <small>{shortAffOf(u)} · {r.context}</small>
                  </div>
                  <time>◷ {agoChat(r.at)}</time>
                </div>
                {shared.length > 0 && <div className={s.reqShared}>겹치는 관심사 {shared.slice(0, 3).map((i) => <CheckChip key={i} label={i} />)}</div>}
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
                      <button className="btn btn-line btn-sm" onClick={(e) => { e.stopPropagation(); drop(r, () => api.chat.cancelRequest(r.id), '요청을 취소했어요', '요청을 취소하지 못했어요') }}>요청 취소</button>
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
            <button className={s.sideWho} onClick={() => onProfile(who.id)} aria-label={`${who.nickname} 프로필 보기`}>
              <span className={s.sideMole}><Avatar size={76} /></span>
              <strong className="display">{who.nickname}</strong>
              <span>{shortAffOf(who)}</span>
            </button>
            <div className={s.sideIntro}><strong>자기소개</strong><p>{who.intro || '아직 작성한 자기소개가 없어요.'}</p></div>
            <hr className={s.rule} />
            <p className={s.sideSub}>관심사 <span>{who.interests.length}</span></p>
            <div className={s.chips}>{who.interests.map((i) => (myInt.includes(i) ? <CheckChip key={i} label={i} /> : <span key={i} className={s.plainChip} style={{ background: `var(--tone-${toneOf(i)}-bg)`, color: `var(--tone-${toneOf(i)}-fg)` }}>{i}</span>))}</div>
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

      <ConfirmDialog open={!!decline} onClose={() => setDecline(null)} title="요청을 거절하시겠습니까?" confirmLabel="예"
        desc="거절해도 상대에게 따로 알림이 가지 않아요." onConfirm={() => { if (decline) drop(decline, () => api.chat.declineRequest(decline.id), '요청을 거절했어요', '요청을 거절하지 못했어요') }} />
    </>
  )
}
