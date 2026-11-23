import { useEffect, useMemo, useState } from 'react'
import { roomLookOf } from '../../data/roomLook'
import { Link, useNavigate, useSearchParams } from '@/lib/nav'
import FieldView from '../../components/FieldView'
import RoomView from '../../components/RoomView'
import InterestChip from '../../components/InterestChip'
import MoleAvatar from '../../components/MoleAvatar'
import { GUEST_FREE, GUEST_ROOMS, getGuestSeen, setGuestSeen, type GuestRoom } from '../../data/guestRooms'
import StartHeader, { GuestCounter, PeekMole } from './StartHeader'
import s from './Start.module.css'

/**
 * 밭 위 견본 방 입구 3개. 좌표는 FieldView 장면(1440×897, cover)을 1440×900 으로 그렸을 때의 px.
 *  - hot: 누를 수 있는 흙더미 타원 (cx, cy, rx, ry)
 *  - card: 방 카드 왼쪽 위 · sign: 방 이름 팻말(3D 나무 팻말) 판 가운데 · size: 팻말 글씨 크기(판 크기에 맞춤, 2026-11-20 들판 v3.10 기준으로 다시 잼)
 */
const SPOTS: Record<string, { hot: [number, number, number, number]; card: [number, number]; sign: [number, number]; size: number }> = {
  // 가운데 굴 + 앞 오른쪽 팻말 (명세 그림: 내굴 카드가 팻말 아래에 뜸)
  'sample-a': { hot: [715, 598, 250, 95], card: [1050, 545], sign: [1083, 487], size: 36 },
  'sample-b': { hot: [1164, 411, 140, 50], card: [1190, 250], sign: [919, 352], size: 28 },
  'sample-c': { hot: [300, 374, 115, 40], card: [150, 205], sign: [526, 308], size: 26 },
}

/**
 * 1440×897 장면을 node 크기에 cover 로 맞췄을 때 좌표 변환 (FieldView 와 같은 계산).
 * node 는 콜백 ref 로 받음: 견본 방에서 돌아오면 들판 div 가 새로 생기는데, 예전처럼 ref 객체만 보면 떨어져 나간 옛 div 를 계속 재서
 * 크기가 0 → 팻말 글씨·방 카드가 왼쪽 위 (0, 0) 에 몰리던 문제 (2026-11-20)
 */
function useCover(node: HTMLElement | null) {
  const [vp, setVp] = useState({ w: 1440, h: 900 })
  useEffect(() => {
    if (!node) return
    const measure = () => { if (node.clientWidth && node.clientHeight) setVp({ w: node.clientWidth, h: node.clientHeight }) }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(node)
    return () => ro.disconnect()
  }, [node])
  const k = Math.max(vp.w / 1440, vp.h / 897)
  const ox = (vp.w - 1440 * k) / 2, oy = (vp.h - 897 * k) / 2
  return (x: number, y: number) => ({ left: ox + x * k, top: oy + y * k, k })
}

/** 자물쇠 (로그인해야 풀리는 기능. 자물쇠 말고 안내 문구는 따로 두지 않음) */
function Lock() {
  return (
    <span className={s.lock} aria-hidden>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </svg>
    </span>
  )
}

/**
 * 시작 v2 – 둘러보기 · 견본 방 (02 F1)
 * 1 견본 방: 방·가구·견본 주인 두더지 (가구를 누르면 이름표, 겹치는 관심사 표시는 없음)
 * 2 상단: 로고 · 구경한 방 · 로그인 (GNB 없음) · 3 방노트: 방 이름 · 자기소개 · 관심사 · 질문 3개와 답변 (소속 · 신고 · "나와 같은 관심사" 없음), 펼쳐진 채로 시작, 접기
 * 4 잠긴 기능: 대화 요청하기 · 단골 추가 · 우체통(방명록) → 로그인 · 5 땅 위로 돌아가기 (구경한 방 수는 그대로)
 */
function SampleRoom({ room, seen, onBack }: { room: GuestRoom; seen: number; onBack: () => void }) {
  const nav = useNavigate()
  const [noteOpen, setNoteOpen] = useState(true)
  const toLogin = () => nav('/login')
  // 견본 방도 실제 땅굴과 같은 방 모습 (data/roomLook.ts: 대표 관심사 대분류의 색 묶음 + 집주인 씨앗)
  const look = useMemo(() => roomLookOf(room.id, room.interests), [room.id, room.interests])
  return (
    <div className={s.sampleRoom}>
      <div className={s.sampleBar} aria-hidden />
      <StartHeader right={<><GuestCounter seen={seen} max={GUEST_FREE} /><Link to="/login" className={s.headerLink}>로그인</Link></>} />
      <div className={s.sampleScene}>
        <RoomView ownerId={room.id} interests={room.interests} wallpaper={look.wallpaper} style={look.style} hostName={room.owner} hostWorn={room.worn} focusX={noteOpen ? 0.4 : 0.5}
          label={`${room.name} (견본 방)`} onMailbox={toLogin}
          hostBubble={<button className={s.lockedBubble} onClick={toLogin}><span aria-hidden>💬</span> 대화 요청하기<Lock /></button>}>
          <button className={s.lockedBtn} style={{ left: 24, top: 24 }} onClick={toLogin}>단골 추가<Lock /></button>
          <button className={s.backUp} style={{ left: `${(noteOpen ? 0.4 : 0.5) * 100}%` }} onClick={onBack}>땅 위로 돌아가기</button>
        </RoomView>
      </div>
      {noteOpen ? (
        <aside className={s.note} aria-label="방노트">
          <div className={s.noteHead}>
            <h2>{room.name}</h2>
            <button className={s.noteFold} onClick={() => setNoteOpen(false)}>접기 ›</button>
          </div>
          <div className={s.noteOwner}>
            <MoleAvatar size={56} radius={28} label={room.owner} />
            <p><strong>{room.owner}</strong><small>둘러보기용 견본 방</small></p>
          </div>
          <div className={s.noteBox}>
            <strong>자기소개</strong>
            <p>{room.intro}</p>
          </div>
          <p className={s.noteLabel}>관심사 <span>{room.interests.length}</span></p>
          <div className={s.noteChips}>{room.interests.map((i) => <InterestChip key={i} label={i} />)}</div>
          <h3 className={s.noteQna}>Q&amp;A</h3>
          <dl className={s.noteBox}>
            {room.qna.map((x, i) => (
              <div key={i}><dt>Q{i + 1}. {x.q}</dt><dd>{x.a}</dd></div>
            ))}
          </dl>
        </aside>
      ) : (
        <button className={s.noteReopen} onClick={() => setNoteOpen(true)}>방노트 펼치기</button>
      )}
    </div>
  )
}

/**
 * 시작 v2 – 둘러보기 · 땅 (비로그인) · 4번째 방 · 로그인 필요 (02 F1)
 * 1 밝은 땅 위 장면에 방 입구와 팻말, 견본 방으로 채운 들판 하나 · 2 구경한 방 점 3개 · 3 로그인
 * 4 방 입구를 누르면 방 카드 · 5 방 카드(이름 · 관심사) · 6 들어가기 (비로그인은 3개까지) · 7 하단 안내
 * 4번째 들어가기 → 로그인 필요 팝업(흐린 배경): 로그인 · 회원가입 · 땅 위로 돌아가기
 * 구경한 방 수는 들어갈 때마다 하나씩 (같은 방을 다시 들어가도 셈. 문서 "판단한 것")
 * 시연: ?gate=1 (3개 다 본 상태로 로그인 안내부터) · ?room=sample-a (견본 방 바로) · ?reset=1 (구경한 방 0으로)
 */
export default function LookAround() {
  const nav = useNavigate()
  const [pageEl, setPageEl] = useState<HTMLDivElement | null>(null)
  const at = useCover(pageEl)
  const [params] = useSearchParams()
  // 시연 쿼리는 처음 한 번만 읽음
  const [init] = useState(() => {
    if (params.get('reset') === '1') setGuestSeen(0)
    if (params.get('gate') === '1') setGuestSeen(GUEST_FREE)
    const r = params.get('room')
    const room = r && GUEST_ROOMS.some((x) => x.id === r) ? r : null
    if (room && getGuestSeen() < 1) setGuestSeen(1)
    return { seen: getGuestSeen(), room, gate: params.get('gate') === '1' }
  })
  const [seen, setSeenState] = useState(init.seen)
  const setSeen = (n: number) => { setGuestSeen(n); setSeenState(n) }
  // 들판에 오면 다음에 볼 방의 카드를 펼쳐 둠 (Figma 둘러보기 · 땅: 내굴 카드가 펼쳐진 채. 방에서 돌아오면 다음 방 카드, 2026-11-20)
  const nextRoom = (after: string | null) => {
    const i = GUEST_ROOMS.findIndex((x) => x.id === after)
    return GUEST_ROOMS[(i + 1) % GUEST_ROOMS.length].id
  }
  const [picked, setPicked] = useState<string | null>(() => GUEST_ROOMS[0].id)
  const [inside, setInside] = useState<string | null>(init.room)
  const [gate, setGate] = useState(init.gate)

  const enter = (id: string) => {
    if (seen >= GUEST_FREE) { setGate(true); return }
    setSeen(seen + 1)
    setInside(id)
    setPicked(null)
  }
  const room = GUEST_ROOMS.find((x) => x.id === inside)
  const card = GUEST_ROOMS.find((x) => x.id === picked)

  if (room) return <SampleRoom room={room} seen={seen} onBack={() => { setPicked(nextRoom(room.id)); setInside(null) }} />

  const cardPos = card ? at(SPOTS[card.id].card[0], SPOTS[card.id].card[1]) : null
  return (
    <div className={s.page} ref={setPageEl}>
      <div className={`${s.lookField} ${gate ? s.lookBlur : ''}`}>
        <FieldView label="견본 땅굴이 모여 있는 들판" options={{ zoom: false }}>
          {!gate && GUEST_ROOMS.map((x) => {
            const [cx, cy, rx, ry] = SPOTS[x.id].hot
            const p = at(cx - rx, cy - ry)
            const sg = at(SPOTS[x.id].sign[0], SPOTS[x.id].sign[1])
            return (
              <div key={x.id}>
                <button
                  className={`${s.hot} ${picked === x.id ? s.hotOn : ''}`}
                  style={{ left: p.left, top: p.top, width: rx * 2 * p.k, height: ry * 2 * p.k }}
                  onClick={() => setPicked(x.id)}
                  aria-label={`${x.name} 방 카드 보기 (${x.tags})`}
                  aria-expanded={picked === x.id}
                />
                <button className={s.signName} style={{ left: sg.left, top: sg.top, fontSize: SPOTS[x.id].size * sg.k }} onClick={() => setPicked(x.id)} tabIndex={-1} aria-hidden>
                  {x.name}
                </button>
              </div>
            )
          })}
        </FieldView>
        <div className={s.lookShade} aria-hidden />
      </div>

      {!gate && card && cardPos && (
        <div className={s.burrowTag} style={{ left: cardPos.left, top: cardPos.top }} role="dialog" aria-label={`${card.name} 방 카드`}>
          <strong>{card.name}</strong>
          <span>{card.tags}</span>
          <button onClick={() => enter(card.id)} autoFocus>들어가기</button>
        </div>
      )}
      {!gate && <p className={s.lookHint}>땅굴을 눌러 들어가 보세요 · 로그인 없이 방 {GUEST_FREE}개까지</p>}

      <StartHeader
        tone={gate ? 'light' : 'dark'}
        right={gate
          ? <GuestCounter seen={seen} max={GUEST_FREE} />
          : <><GuestCounter seen={seen} max={GUEST_FREE} pill /><Link to="/login" className={s.headerLink}>로그인</Link></>}
      />

      {gate && (
        <div className={s.center} role="dialog" aria-modal="true" aria-labelledby="gate-title"
          onKeyDown={(e) => { if (e.key === 'Escape') setGate(false) }}>
          <div className={`${s.panelWrap} ${s.gateWrap}`}>
            <PeekMole />
            <section className={`${s.panel} ${s.gate}`}>
              <h2 id="gate-title" className={s.gateTitle}>방 {GUEST_FREE}개를 다 구경했어요</h2>
              <p className={s.gateText}>로그인하면 계속 둘러보고<br />방명록도 남길 수 있어요.</p>
              <div className={s.gateActions}>
                <button className={s.primary} onClick={() => nav('/login')} autoFocus>로그인</button>
                <button className={s.secondary} onClick={() => nav('/signup')}>회원가입</button>
                <button className={s.textBtn} onClick={() => { setGate(false); setPicked(null) }}>땅 위로 돌아가기</button>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  )
}
