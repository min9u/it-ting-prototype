import { useState } from 'react'
import { Link, NavLink, useParams } from 'react-router-dom'
import Avatar from '../../components/Avatar'
import { ChipList } from '../../components/InterestChip'
import { SearchIcon, SendIcon } from '../../components/Icons'
import { CHAT_REQUESTS, CHAT_ROOMS, ME_ID, USERS, meetupOf, overlapCount, userOf } from '../../data/mock'
import type { ChatRoom, Message } from '../../data/types'
import { dateLabel } from '../../lib/format'
import s from './Chat.module.css'

/**
 * 채팅 (408:15918 묶음) — 메타데이터 기반, 스크린샷 대조 필요
 * /chat            대화 선택 전 408:16219
 * /chat/requests   받은 요청 · 보낸 요청 408:17145
 * /chat/:roomId    1대1 408:16412 · 모임 대화 408:16752 · 요청 대기 중 408:15921
 */
export default function Chat({ requests }: { requests?: boolean }) {
  const { roomId } = useParams()
  const [tab, setTab] = useState<'all' | 'dm' | 'group'>('all')
  const [q, setQ] = useState('')
  const room = CHAT_ROOMS.find((r) => r.id === roomId)
  const receivedCount = CHAT_REQUESTS.filter((r) => r.direction === 'received').length

  const list = CHAT_ROOMS.filter((r) => (tab === 'all' ? true : r.kind === tab)).filter((r) => roomTitle(r).includes(q))

  return (
    <main className={s.page}>
      <section className={s.list} aria-label="대화 목록">
        <div className={s.listHead}>
          <h1 className="display">채팅</h1>
        </div>
        <label className={s.search}>
          <SearchIcon size={18} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="친구, 대화 검색" />
        </label>
        <div className={s.tabs} role="tablist">
          {([['all', '전체'], ['dm', '1:1'], ['group', '모임']] as const).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? s.tabOn : s.tab} onClick={() => setTab(k)}>{l}</button>
          ))}
          <NavLink to="/chat/requests" className={({ isActive }) => (isActive ? s.reqTabOn : s.reqTab)}>받은 요청 {receivedCount}</NavLink>
        </div>
        <ul className={s.convs}>
          {list.map((r) => <ChatListItem key={r.id} room={r} active={r.id === roomId} />)}
        </ul>
      </section>

      {requests ? <Requests /> : room ? <Room room={room} /> : <Empty count={receivedCount} />}
    </main>
  )
}

function roomTitle(r: ChatRoom) {
  if (r.kind === 'group') return meetupOf(r.meetupId!)?.title ?? '모임'
  return userOf(r.partnerId!).nickname
}

/** Figma: Chat List Item (288×72) */
function ChatListItem({ room, active }: { room: ChatRoom; active: boolean }) {
  const last = room.messages[room.messages.length - 1]
  const sub = room.state === 'pending' ? '요청 대기 중' : last?.text ?? ''
  return (
    <li>
      <Link to={`/chat/${room.id}`} className={active ? `${s.conv} ${s.convOn}` : s.conv}>
        {room.kind === 'group' ? <span className={s.groupIcon} aria-hidden>📚</span> : <Avatar size={44} />}
        <span className={s.convBody}>
          <span className={s.convTop}><strong>{roomTitle(room)}</strong>{room.kind === 'group' && <em>{meetupOf(room.meetupId!)?.memberIds.length}명</em>}<time>{room.lastAt}</time></span>
          <span className={s.convSub}>{sub}</span>
        </span>
        {room.unread > 0 && <span className={s.unread}>{room.unread}</span>}
      </Link>
    </li>
  )
}

function Empty({ count }: { count: number }) {
  return (
    <section className={`${s.room} ${s.emptyRoom}`}>
      <div className={s.emptyIcon} aria-hidden>💬</div>
      <h2 className="display">아직 고른 대화가 없어요</h2>
      <p>왼쪽 목록에서 대화를 골라주세요. 아직 친구가 없다면 땅굴을 둘러보다가 마음에 드는 두더지에게 말을 걸어보세요.</p>
      <div className={s.emptyActions}>
        <Link to="/burrow/explore" className="btn btn-primary">땅굴 둘러보기</Link>
        <Link to="/chat/requests" className="btn btn-ghost">받은 요청 보기 <span className="count-badge">{count}</span></Link>
      </div>
    </section>
  )
}

function Room({ room }: { room: ChatRoom }) {
  const [msgs, setMsgs] = useState<Message[]>(room.messages)
  const [draft, setDraft] = useState('')
  const me = USERS[ME_ID]
  const partner = room.partnerId ? userOf(room.partnerId) : undefined
  const meetup = room.meetupId ? meetupOf(room.meetupId) : undefined
  const pending = room.state === 'pending'

  const send = () => {
    if (!draft.trim()) return
    setMsgs((m) => [...m, { id: `m${Date.now()}`, authorId: ME_ID, text: draft.trim(), time: '방금' }])
    setDraft('')
  }

  return (
    <>
      <section className={s.room} aria-label="대화">
        <header className={s.roomHead}>
          {meetup ? <span className={s.groupIcon}>📚</span> : <Avatar size={44} />}
          <div>
            <h2 className="display">{meetup ? meetup.title : partner!.nickname} {meetup && <small>{meetup.memberIds.length}명</small>}</h2>
            <p>{meetup ? `${dateLabel(meetup.date)} ${meetup.start} · ${meetup.place}` : `${pending ? '요청 대기 중' : partner!.online ? '접속 중' : '오프라인'} · ${partner!.affiliation} · 겹치는 관심사 ${overlapCount(partner!.interests, me.interests)}개`}</p>
          </div>
        </header>
        {meetup && (
          <div className={s.notice}><strong>공지</strong> 읽고 있는 책 한 권 챙겨오세요. 3층 세미나실 입구에서 만나요!</div>
        )}
        <div className={s.messages}>
          {pending ? (
            <div className={s.pending}>
              <Avatar size={56} />
              <h3 className="display">{partner!.nickname}님의 답을 기다리는 중이에요</h3>
              <p>{partner!.nickname}님이 수락하면 메시지를 보낼 수 있어요</p>
              <button className="btn btn-ghost btn-sm">요청 취소</button>
            </div>
          ) : (
            <>
              <p className={s.day}>오늘</p>
              {msgs.map((m) => <Bubble key={m.id} m={m} group={!!meetup} />)}
              {partner && <p className={s.typing}>{partner.nickname}님이 입력 중…</p>}
            </>
          )}
        </div>
        <form className={s.composer} onSubmit={(e) => { e.preventDefault(); send() }}>
          <input disabled={pending} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={pending ? `${partner?.nickname}님이 수락하면 메시지를 보낼 수 있어요` : meetup ? '모임에 메시지 보내기' : '메시지를 입력하세요'} />
          <button className={s.send} disabled={pending || !draft.trim()} aria-label="보내기"><SendIcon size={18} /></button>
        </form>
      </section>

      <aside className={s.side}>
        {meetup ? (
          <>
            <h3 className="display">모임 정보</h3>
            <dl className={s.info}>
              <div><dt>📅</dt><dd>{dateLabel(meetup.date)} {meetup.start} – {meetup.end}</dd></div>
              <div><dt>📍</dt><dd>{meetup.place}</dd></div>
              <div><dt>👥</dt><dd>{meetup.capacity}명 중 {meetup.memberIds.length}명 확정</dd></div>
            </dl>
            <h3 className={`display ${s.sideSub}`}>참여자 <span>{meetup.memberIds.length}</span></h3>
            <ul className={s.members}>
              {meetup.memberIds.map((id) => (
                <li key={id}><Avatar size={32} /> {userOf(id).nickname}{id === meetup.hostId && <em>주최</em>}</li>
              ))}
              <li><Avatar size={32} /> {me.nickname} <em className={s.meTag}>나</em></li>
            </ul>
            <Link to={`/meetups/${meetup.id}`} className="btn btn-primary btn-block">모임 상세 보기</Link>
            <button className={s.leave}>모임 나가기</button>
          </>
        ) : (
          <>
            <h3 className="display">대화 상대</h3>
            <div className={s.partner}>
              <Avatar size={72} />
              <strong className="display">{partner!.nickname}</strong>
              <span>{partner!.affiliation}</span>
            </div>
            {partner!.intro && <p className={s.partnerIntro}>{partner!.intro}</p>}
            <h3 className={`display ${s.sideSub}`}>겹치는 관심사 <span>{overlapCount(partner!.interests, me.interests)}</span></h3>
            <ChipList items={partner!.interests.filter((i) => me.interests.includes(i))} />
            <Link to={`/burrow/${partner!.id}`} className={`btn btn-primary btn-block ${s.visit}`}>{partner!.nickname}님의 땅굴 놀러 가기</Link>
          </>
        )}
      </aside>
    </>
  )
}

function Bubble({ m, group }: { m: Message; group: boolean }) {
  if (m.system) return <p className={s.system}>{m.text}</p>
  const mine = m.authorId === ME_ID
  const meetup = m.meetupId ? meetupOf(m.meetupId) : undefined
  return (
    <div className={mine ? `${s.msg} ${s.mine}` : s.msg}>
      {!mine && <Avatar size={34} />}
      <div className={s.msgCol}>
        {!mine && group && <span className={s.author}>{userOf(m.authorId).nickname}</span>}
        <div className={s.msgRow}>
          <p className={s.bubble}>{m.text}</p>
          <time>{m.time}</time>
        </div>
        {meetup && (
          <Link to={`/meetups/${meetup.id}`} className={s.meetCard}>
            <span className={s.meetTag}>{meetup.interest}</span>
            <strong>{meetup.title}</strong>
            <span>{dateLabel(meetup.date)} {meetup.start} · {meetup.memberIds.length} / {meetup.capacity}명</span>
            <em>모임 보기 ›</em>
          </Link>
        )}
      </div>
    </div>
  )
}

function Requests() {
  const [items, setItems] = useState(CHAT_REQUESTS)
  const drop = (id: string) => setItems((l) => l.filter((x) => x.id !== id))
  const received = items.filter((r) => r.direction === 'received')
  const sent = items.filter((r) => r.direction === 'sent')
  const me = USERS[ME_ID]
  return (
    <section className={`${s.room} ${s.requests}`} aria-label="요청">
      <h2 className="display">받은 요청</h2>
      <p className={s.reqLead}>수락하면 바로 대화방이 열려요. 거절해도 상대에게 따로 알림이 가지 않아요.</p>
      {(['dm', 'meetup'] as const).map((kind) => {
        const list = received.filter((r) => r.kind === kind)
        return (
          <div key={kind} className={s.reqGroup}>
            <h3>{kind === 'dm' ? '대화 요청' : '내 모임에 온 신청'} <span className="count-badge">{list.length}</span></h3>
            {list.length === 0 && <p className={s.reqEmpty}>새 요청이 없어요.</p>}
            {list.map((r) => {
              const u = userOf(r.userId)
              const mt = r.meetupId ? meetupOf(r.meetupId) : undefined
              return (
                <article key={r.id} className={s.reqCard}>
                  <Avatar size={44} />
                  <div className={s.reqBody}>
                    <p className={s.reqTop}>
                      <strong>{mt ? mt.title : u.nickname}</strong>
                      {mt && <span className={s.reqKind}>모임 신청</span>}
                      <time>{r.ago}</time>
                    </p>
                    <p className={s.reqCtx}>{mt ? `${u.nickname}님이 ${r.context}` : `${u.affiliation} · ${r.context}`}</p>
                    {!mt && <p className={s.reqShared}>겹치는 관심사 <ChipList items={u.interests.filter((i) => me.interests.includes(i))} /></p>}
                    <blockquote>“{r.message}”</blockquote>
                  </div>
                  <div className={s.reqActions}>
                    <button className="btn btn-ghost btn-sm" onClick={() => drop(r.id)}>거절</button>
                    <button className="btn btn-primary btn-sm" onClick={() => drop(r.id)}>{mt ? '참여 승인' : '수락하고 대화하기'}</button>
                  </div>
                </article>
              )
            })}
          </div>
        )
      })}
      <h2 className={`display ${s.sentTitle}`}>보낸 요청</h2>
      <p className={s.reqLead}>상대가 답하기 전까지는 언제든 취소할 수 있어요.</p>
      {sent.map((r) => {
        const u = userOf(r.userId)
        const mt = r.meetupId ? meetupOf(r.meetupId) : undefined
        return (
          <article key={r.id} className={`${s.reqCard} ${s.reqSent}`}>
            <Avatar size={40} />
            <div className={s.reqBody}>
              <p className={s.reqTop}><strong>{mt ? mt.title : u.nickname}</strong></p>
              <p className={s.reqCtx}>{r.context}</p>
            </div>
            <span className={s.waiting}>{mt ? '주최자 확인 중' : '수락 대기'}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => drop(r.id)}>요청 취소</button>
          </article>
        )
      })}
    </section>
  )
}
