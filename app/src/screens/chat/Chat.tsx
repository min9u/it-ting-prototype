import { useState } from 'react'
import { Link, NavLink, useParams, useSearchParams } from 'react-router-dom'
import Avatar from '../../components/Avatar'
import { ChipList } from '../../components/InterestChip'
import { ChatIcon, HomeIcon, SearchIcon, SendIcon } from '../../components/Icons'
import { CHAT_REQUESTS, CHAT_ROOMS, ME_ID, USERS, meetupOf, overlapCount, toneOf, userOf } from '../../data/mock'
import type { ChatRequest, ChatRoom, Message } from '../../data/types'
import { dateLabel } from '../../lib/format'
import s from './Chat.module.css'

/**
 * 채팅 (408:15918 묶음) — 메타데이터 기반, 스크린샷 대조 필요
 * /chat            대화 선택 전 408:16219
 * /chat/requests   요청 · 대화 · 받은 요청 408:17145 (+ 보낸 요청 588:8061, 모임 · 받은/보낸 589:8150 · 589:8292)
 *                  2026-11-11 스크린샷 대조: 왼쪽 탭이 전체 / 1:1 / 모임 / 요청 n 으로 바뀜,
 *                  가운데는 대화·모임 책갈피 탭 + 받은/보낸 요청 토글, 오른쪽은 "요청 보낸 사람"
 *                  데모용 쿼리: ?tab=meetup, ?dir=sent
 * /chat/:roomId    1대1 408:16412 · 모임 대화 408:16752 · 요청 대기 중 408:15921
 */
export default function Chat({ requests }: { requests?: boolean }) {
  const { roomId } = useParams()
  const [tab, setTab] = useState<'all' | 'dm' | 'group'>('all')
  const [q, setQ] = useState('')
  const room = CHAT_ROOMS.find((r) => r.id === roomId)
  const receivedCount = CHAT_REQUESTS.filter((r) => r.direction === 'received').length
  const tabOf = (k: typeof tab) => (requests ? s.tab : tab === k ? s.tabOn : s.tab)

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
            <button key={k} role="tab" aria-selected={!requests && tab === k} className={tabOf(k)} onClick={() => setTab(k)}>{l}</button>
          ))}
          <NavLink to="/chat/requests" className={({ isActive }) => (isActive ? s.tabOn : s.tab)}>요청 {receivedCount}</NavLink>
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
  const [params] = useSearchParams()
  const [items, setItems] = useState(CHAT_REQUESTS)
  const [kind, setKind] = useState<'dm' | 'meetup'>(params.get('tab') === 'meetup' ? 'meetup' : 'dm')
  const [dir, setDir] = useState<'received' | 'sent'>(params.get('dir') === 'sent' ? 'sent' : 'received')
  const [picked, setPicked] = useState<string | null>(null)
  const drop = (id: string) => setItems((l) => l.filter((x) => x.id !== id))
  const me = USERS[ME_ID]
  const count = (k: 'dm' | 'meetup', d: 'received' | 'sent') => items.filter((r) => r.kind === k && r.direction === d).length
  const list = items.filter((r) => r.kind === kind && r.direction === dir)
  const focus = list.find((r) => r.id === picked) ?? list[0]
  const who = focus ? userOf(focus.userId) : undefined
  const shared = who ? who.interests.filter((i) => me.interests.includes(i)) : []

  return (
    <>
      <section className={`${s.room} ${s.reqRoom}`} aria-label="요청">
        <header className={s.reqHead}>
          <h2 className="display">요청</h2>
          <p>대화 요청과 모임 신청을 한곳에서 확인해요.</p>
        </header>
        <div className={s.folderTabs} role="tablist">
          {(['dm', 'meetup'] as const).map((k) => (
            <button key={k} role="tab" aria-selected={kind === k} className={kind === k ? s.folderOn : s.folder} onClick={() => { setKind(k); setPicked(null) }}>
              {k === 'dm' ? '대화' : '모임'} <span>{count(k, 'received')}</span>
            </button>
          ))}
        </div>
        <div className={s.reqBody}>
          <div className={s.dirBar}>
            <div className={s.dirToggle} role="tablist" aria-label="받은 요청 / 보낸 요청">
              {(['received', 'sent'] as const).map((d) => (
                <button key={d} role="tab" aria-selected={dir === d} className={dir === d ? s.dirOn : s.dir} onClick={() => { setDir(d); setPicked(null) }}>
                  {d === 'received' ? '받은 요청' : '보낸 요청'} <span>{count(kind, d)}</span>
                </button>
              ))}
            </div>
            <p>{dir === 'received'
              ? (kind === 'dm' ? '수락하면 바로 대화방이 열려요. 거절해도 상대에게 따로 알림이 가지 않아요.' : '승인하면 모임 채팅방에 초대돼요. 거절해도 따로 알림이 가지 않아요.')
              : '상대가 답하기 전까지는 언제든 취소할 수 있어요.'}</p>
          </div>
          {list.length === 0 && <p className={s.reqEmpty}>{dir === 'received' ? '새 요청이 없어요.' : '보낸 요청이 없어요.'}</p>}
          {list.map((r) => (
            <RequestCard key={r.id} r={r} me={me.interests} active={focus?.id === r.id} onFocus={() => setPicked(r.id)} onDone={() => drop(r.id)} />
          ))}
        </div>
      </section>

      <aside className={s.side}>
        <h3 className="display">{dir === 'received' ? '요청 보낸 사람' : '요청 받은 사람'}</h3>
        {who ? (
          <>
            <div className={s.partner}>
              <Avatar size={80} />
              <strong className="display">{who.nickname}</strong>
              <span>{who.affiliation}</span>
            </div>
            <hr className={s.sideRule} />
            <h3 className={`display ${s.sideSub}`}>겹치는 관심사 <span>{shared.length}</span></h3>
            <div className={s.checkChips}>{shared.map((i) => <CheckChip key={i} label={i} />)}</div>
            <Link to={`/burrow/${who.id}`} className={`btn btn-line btn-block ${s.visit}`}><HomeIcon size={16} /> {who.nickname}님의 땅굴 놀러 가기</Link>
          </>
        ) : <p className={s.reqEmpty}>고른 요청이 없어요.</p>}
      </aside>
    </>
  )
}

/** 체크 표시 관심사 칩 (겹치는 관심사) */
function CheckChip({ label }: { label: string }) {
  const t = toneOf(label)
  return <span className={s.checkChip} style={{ background: `var(--tone-${t}-bg)`, color: `var(--tone-${t}-fg)` }}>✓ {label}</span>
}

/** 요청 카드 (430×241): 이름 + 종류 태그, 소속 · 맥락, 시간, 겹치는 관심사, 인사말, 거절 / 수락 */
function RequestCard({ r, me, active, onFocus, onDone }: { r: ChatRequest; me: string[]; active: boolean; onFocus: () => void; onDone: () => void }) {
  const u = userOf(r.userId)
  const mt = r.meetupId ? meetupOf(r.meetupId) : undefined
  const shared = u.interests.filter((i) => me.includes(i))
  const tone = toneOf(u.interests[0] ?? '')
  return (
    <article className={active ? `${s.reqCard} ${s.reqCardOn}` : s.reqCard} onClick={onFocus}>
      <div className={s.reqTop}>
        <span className={s.initial} style={{ background: `var(--tone-${tone}-bg)`, color: `var(--tone-${tone}-fg)` }}>{u.nickname.slice(0, 1)}</span>
        <div className={s.reqWho}>
          <p><strong>{u.nickname}</strong><em className={mt ? s.tagMeet : s.tagDm}>{mt ? '모임 신청' : '대화 요청'}</em></p>
          <small>{mt ? `${mt.title} · ${r.context}` : `${u.affiliation} · ${r.context}`}</small>
        </div>
        {r.ago && <time>◷ {r.ago}</time>}
      </div>
      {r.direction === 'received' && shared.length > 0 && (
        <div className={s.reqShared}>겹치는 관심사 {shared.slice(0, 3).map((i) => <CheckChip key={i} label={i} />)}</div>
      )}
      {r.message && <blockquote className={s.reqMsg}>“{r.message}”</blockquote>}
      <div className={s.reqActions}>
        {r.direction === 'received' ? (
          <>
            <button className="btn btn-line btn-sm" onClick={(e) => { e.stopPropagation(); onDone() }}>거절</button>
            <button className="btn btn-cta btn-sm" onClick={(e) => { e.stopPropagation(); onDone() }}><ChatIcon size={15} /> {mt ? '참여 승인' : '수락하고 대화하기'}</button>
          </>
        ) : (
          <>
            <span className={s.waiting}>{mt ? '주최자 확인 중' : '수락 대기'}</span>
            <button className="btn btn-line btn-sm" onClick={(e) => { e.stopPropagation(); onDone() }}>요청 취소</button>
          </>
        )}
      </div>
    </article>
  )
}
