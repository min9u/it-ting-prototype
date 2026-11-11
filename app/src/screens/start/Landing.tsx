import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import FieldView from '../../components/FieldView'
import RoomView from '../../components/RoomView'
import StartHeader from './StartHeader'
import s from './Start.module.css'

/**
 * 랜딩 03 가구 라벨 (Figma Furniture Label, 1440×900 기준 px).
 * x, y = 가구 위 점, bx, by = 이름표 상자 왼쪽 위 (점 기준), w = 상자 폭.
 * 점 위치는 RoomView(three.js 방)의 가구 자리에 맞춤. 상자 오프셋은 시안 그대로.
 */
const LABELS = [
  { cat: '게임', item: '오락기', x: 430, y: 600, bx: -121, by: -111, w: 54 },
  { cat: '독서', item: '책장', x: 520, y: 560, bx: 40, by: -141, w: 43 },
  { cat: '음악', item: '스피커', x: 1010, y: 650, bx: 30, by: -191, w: 54 },
  { cat: '그림', item: '이젤', x: 1120, y: 590, bx: 60, by: -161, w: 43 },
  { cat: '사진', item: '카메라', x: 1080, y: 482, bx: 40, by: -131, w: 54 },
  { cat: '캠핑', item: '배낭', x: 318, y: 575, bx: -121, by: -81, w: 43 },
]
const ROOM_INTERESTS = ['게임', '독서', '음악', '그림', '사진', '캠핑']

/** 랜딩 04 이웃 태그 (Neighbour Tag, 1440×900 기준 왼쪽 위) */
const NEIGHBORS = [
  { tags: '독서 · 게임', sub: '옆 땅굴', x: 560, y: 150, tone: 'bark' },
  { tags: '캠핑 · 사진', sub: '나랑 관심사 2개 같아요', x: 150, y: 330, tone: 'leaf' },
  { tags: '그림', sub: '방금 방명록이 달렸어요', x: 1120, y: 520, tone: 'leaf' },
] as const

const SECTIONS = ['땅 위', '구멍 속으로', '내 방', '이웃']

/**
 * 1440×900 시안 좌표 → 방 상자(pinBox) 안 %. pinBox 는 RoomView 의 방 자리(.stage: 위 -3.7%, 높이 104.5%, 4:3, 가운데)와 같아서
 * 화면 비율이 달라도 이름표가 가구를 따라감. 1440×900 에서 상자 = (93, -33.3) 1254×940.5
 */
const inRoom = (x: number, y: number) => ({ left: `${(x - 93) / 12.54}%`, top: `${(y + 33.3) / 9.405}%` })
/** 1440×900 시안 좌표 → 화면 % (가로는 화면 폭, 세로는 화면 높이 기준) */
const px = (x: number, y: number) => ({ left: `${x / 14.4}%`, top: `${y / 9}%` })

/**
 * 시작 v2 – 랜딩 01–04 (스크롤 0 / 30 / 60 / 85–100%) + 모션 타임라인 408:19694
 * "한 화면에 고정(sticky)된 3D 씬을 스크롤 진행도로 움직여요. 텍스트만 위에서 바뀌어요."
 *  01 땅 위: 밭(FieldView) 그대로 · 02 구멍 속으로: 가운데 굴로 확대 + 어두워짐
 *  03 내 방: 땅굴 방(RoomView) + 가구 이름표 · 04 이웃: 밭을 두더지 앞으로 당겨 보여 줌 + CTA
 * 시안은 03·04만 있음. 01·02는 타임라인 썸네일 문구로 만듦.
 */
export default function Landing() {
  const track = useRef<HTMLDivElement>(null)
  const [p, setP] = useState(0)
  const [roomOn, setRoomOn] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      const el = track.current
      if (!el) return
      const max = el.offsetHeight - window.innerHeight
      setP(Math.min(1, Math.max(0, -el.getBoundingClientRect().top / max)))
    }
    // 데모·스크린샷용: #s1 ~ #s4 (해시 라우터에서는 ?s=1~4) 면 스크롤하기 전까지 그 구간을 보여 준다
    const m = window.location.href.match(/[#?&]s=?([1-4])\b/)
    if (m) setP([0, 0.32, 0.6, 0.9][Number(m[1]) - 1])
    else onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll) }
  }, [])

  const sec = p < 0.2 ? 0 : p < 0.45 ? 1 : p < 0.75 ? 2 : 3
  // 방은 무거우니 구멍 속으로 들어갈 즈음 처음 만든다 (한 번 만들면 유지)
  useEffect(() => { if (p > 0.22 && !roomOn) setRoomOn(true) }, [p, roomOn])

  // 01→02: 가운데 굴(화면 50%, 47%)로 확대, 04: 두더지 쪽으로 1.46배 (시안 04 두더지 크기·위치에 맞춤)
  const dive = Math.min(1, Math.max(0, (p - 0.12) / 0.3))
  const fieldTf = sec === 3
    ? { transform: 'scale(1.46)', transformOrigin: '23.3% 96.7%' }
    : { transform: `scale(${1 + dive * dive * 2.8})`, transformOrigin: '50% 47%' }
  const dark = sec === 1 ? Math.min(1, Math.max(0, (p - 0.24) / 0.18)) : 0
  const tone = sec === 1 || sec === 2 ? 'light' : 'dark'

  return (
    <div ref={track} className={s.track}>
      <div className={s.stage} data-sec={sec}>
        {/* 01 · 02 · 04 밭 */}
        <div className={s.layer} style={{ opacity: sec === 2 ? 0 : 1 }}>
          <div className={s.fieldZoom} style={fieldTf}>
            <FieldView label="두더지가 사는 밭" />
          </div>
          <div className={s.shadeTopLeft} style={{ opacity: sec === 0 ? 1 : 0 }} />
          <div className={s.darken} style={{ opacity: dark }} />
          <div className={s.shadeBottom} style={{ opacity: sec === 3 ? 1 : 0 }} />
        </div>

        {/* 03 방 */}
        <div className={`${s.layer} ${s.roomLayer}`} style={{ opacity: sec === 2 ? 1 : 0, pointerEvents: sec === 2 ? 'auto' : 'none' }}>
          {roomOn && <RoomView ownerId="landing" interests={ROOM_INTERESTS} label="관심사로 꾸민 땅굴 방" />}
          <div className={s.shadeLeft} />
          <div className={s.pinBox}>
          {LABELS.map((l, i) => {
            const bx = l.bx < 0 ? l.bx + l.w : l.bx, by = l.by + 44
            return (
              <div key={l.item} className={s.pin} style={{ ...inRoom(l.x, l.y), transitionDelay: sec === 2 ? `${0.3 + i * 0.08}s` : '0s', opacity: sec === 2 ? 1 : 0 }}>
                <svg className={s.pinLine} aria-hidden><line x1={0} y1={0} x2={bx} y2={by} /></svg>
                <span className={s.pinDot} />
                <span className={s.pinLabel} style={{ left: l.bx, top: l.by }}><small>{l.cat}</small>{l.item}</span>
              </div>
            )
          })}
          </div>
        </div>

        {/* 04 이웃 태그 */}
        {NEIGHBORS.map((n, i) => (
          <div key={n.tags} className={`${s.nbTag} ${n.tone === 'bark' ? s.nbBark : ''}`} style={{ ...px(n.x, n.y), opacity: sec === 3 ? 1 : 0, transitionDelay: sec === 3 ? `${0.2 + i * 0.1}s` : '0s' }}>
            <strong>{n.tags}</strong><span>{n.sub}</span>
          </div>
        ))}

        <StartHeader tone={tone} look={sec === 0} />

        {/* 카피 (구간 진입 때 아래→위 16px + 페이드) */}
        <div className={`${s.copy} ${sec === 3 ? s.copyBottom : ''}`} key={sec} data-tone={sec === 0 ? 'dark' : 'light'}>
          {sec === 0 && (
            <>
              <h1>관심사로 꾸민 땅굴에서<br />이웃을 만나요</h1>
              <p>SSAFY 사람들이 좋아하는 것들로 방을 꾸미고,<br />서로의 땅굴에 놀러 가요.</p>
              <span className={s.scrollHint}>스크롤해서 땅굴 안으로 ↓</span>
            </>
          )}
          {sec === 1 && <h1>쏙, 땅 아래로</h1>}
          {sec === 2 && (
            <>
              <h1>고른 관심사가<br />가구가 돼요</h1>
              <p>책을 좋아하면 책장이, 게임을 좋아하면<br />오락기가 방에 놓여요.</p>
            </>
          )}
          {sec === 3 && (
            <>
              <h1>같은 걸 좋아하는 이웃이<br />생각보다 가까이 살아요</h1>
              <p>땅 위를 걸으며 땅굴을 구경하고, 마음이 맞으면 같이 모여요.</p>
            </>
          )}
        </div>
        {sec === 3 && (
          <div className={s.ctaRow}>
            <Link to="/signup" className={s.ctaMain}>내 땅굴 만들기 <span aria-hidden>→</span></Link>
            <Link to="/look" className={s.ctaSub}>먼저 둘러보기</Link>
          </div>
        )}

        <ol className={s.progress} data-tone={tone} aria-label={`${SECTIONS.length}구간 중 ${sec + 1}번째: ${SECTIONS[sec]}`}>
          {SECTIONS.map((t, i) => <li key={t} className={i === sec ? s.progOn : ''}><span /></li>)}
          <li className={s.progLabel} aria-hidden>{SECTIONS[sec]}</li>
        </ol>
      </div>
    </div>
  )
}
