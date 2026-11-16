import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import FieldView from '../../components/FieldView'
import RoomView from '../../components/RoomView'
import { ROOM_FRAME } from '../../three/roomFrame'
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
const ROOM_INTERESTS = ['레트로게임', 'SF소설', '시티팝', '수채화', '필름카메라', '캠핑']

/** 랜딩 04 이웃 태그 (Neighbour Tag, 1440×900 기준 왼쪽 위) */
const NEIGHBORS = [
  { tags: '독서 · 게임', sub: '옆 땅굴', x: 560, y: 150, tone: 'bark' },
  { tags: '캠핑 · 사진', sub: '나랑 관심사 2개 같아요', x: 150, y: 330, tone: 'leaf' },
  { tags: '그림', sub: '방금 방명록이 달렸어요', x: 1120, y: 520, tone: 'leaf' },
] as const

const SECTIONS = ['땅 위', '구멍 속으로', '방', '이웃']
/** 데모 구간(#s1~#s4, ?s=1~4)의 진행도 */
const DEMO_P = [0, 0.32, 0.6, 0.9]

/**
 * 1440×900 시안 좌표 → 방 상자(pinBox) 안 %. 이름표 좌표는 처음 구도(방 그림 높이 114.5%, 위 -5.4%)에서
 * pinBox(위 -3.7%, 높이 104.5%, 4:3, 가운데) 기준으로 맞춘 것. 1440×900 에서 상자 = (93, -33.3) 1254×940.5
 * 구도(three/roomFrame.ts)가 바뀌어도 방 그림 안에서 같은 자리가 되게 pinBox 를 같은 비율로 옮김 (PIN_BOX)
 */
const PIN_BOX = { top: ROOM_FRAME.top + (-0.037 + 0.054) / 1.145 * ROOM_FRAME.h, h: 1.045 / 1.145 * ROOM_FRAME.h }
const inRoom = (x: number, y: number) => ({ left: `${(x - 93) / 12.54}%`, top: `${(y + 33.3) / 9.405}%` })
/** 1440×900 시안 좌표 → 화면 % (가로는 화면 폭, 세로는 화면 높이 기준) */
const px = (x: number, y: number) => ({ left: `${x / 14.4}%`, top: `${y / 9}%` })

/**
 * 시작 v2 – 랜딩 (02 명세 F1 · 랜딩 03 방 · 랜딩 04 이웃 · 스크롤 모션 타임라인, 2026-11-16)
 * "한 화면에 고정(sticky)된 3D 씬을 스크롤 진행도로 움직여요. 텍스트만 위에서 바뀌어요."
 * 02 명세는 4구간: 0% 땅 위 · 30% 구멍 속으로 · 60% 방 · 85–100% 이웃 (03 디자인 2026-11-12 는 방 → 이웃 2구간이었지만 명세 우선)
 *  카메라: 땅 위 → 구멍으로 푸시인 · 다이브: 구멍 통과, 화면 어두워짐 → 방으로 컷 · 방 등장 · 라벨 0.08초 간격 · 풀아웃: 다시 땅 위로 이웃 땅굴
 *  카피: 각 구간 진입 때 아래→위 16px + 페이드
 * 푸시인은 왼쪽 굴로 (앞에 팻말이 없음. 가운데 굴은 두더지가 앞에 서 있어서 확대하면 두더지가 화면을 가림, 2026-11-12 사용자 제보)
 * 방은 다 차려질 때까지 로딩 애니메이션, 그 뒤 연출 없이 한 번에 (docs/landing-loading.md. 명세의 "가구가 하나씩 떨어져 놓임"은 이 결정으로 뺌)
 * 이웃 구간 밭은 확대하지 않음 (2026-11-12). 상단 메뉴는 랜딩 전체에서 로그인 · 시작하기 (Figma 메모: 둘러보기 링크 빼기)
 * 모션 줄이기: 스크롤 연동(확대·어두워짐) 없이 네 장면이 0.3초 크로스페이드
 * Figma 메모 707:11198: "먼저 둘러보기"가 왼쪽 (다른 사람 방을 먼저 구경하는 게 우선)
 */
export default function Landing() {
  const track = useRef<HTMLDivElement>(null)
  // 데모·스크린샷용: #s1 ~ #s4 (해시 라우터에서는 ?s=1~4) 면 사용자가 직접 스크롤하기 전까지 그 구간을 보여 준다
  const demo = useRef(window.location.href.match(/[#?&]s=?([1-4])(?!\d)/)?.[1] ?? null)
  const [p, setP] = useState(() => (demo.current ? DEMO_P[Number(demo.current) - 1] : 0))
  const [roomMade, setRoomMade] = useState(() => !!demo.current && Number(demo.current) >= 2)
  // 방 3D 가 다 차려졌는지: 그 전에는 로딩 애니메이션, 가구 이름표도 그 뒤에
  const [roomOn, setRoomOn] = useState(false)
  const [reduce] = useState(() => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)

  useEffect(() => {
    const release = () => { demo.current = null }
    const onScroll = () => {
      if (demo.current) return
      const el = track.current
      if (!el) return
      const max = el.offsetHeight - window.innerHeight
      setP(Math.min(1, Math.max(0, -el.getBoundingClientRect().top / max)))
    }
    onScroll()
    for (const ev of ['wheel', 'touchstart', 'keydown'] as const) window.addEventListener(ev, release, { passive: true, once: true })
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll) }
  }, [])

  const sec = p < 0.2 ? 0 : p < 0.45 ? 1 : p < 0.75 ? 2 : 3
  // 방은 무거우니 땅 위 구간을 조금 내려오면 미리 만든다 (한 번 만들면 유지)
  useEffect(() => { if (p > 0.08 && !roomMade) setRoomMade(true) }, [p, roomMade])

  // 00–02: 왼쪽 굴(화면 18%, 40%)로 푸시인 + 비네트, 다이브 끝에서 어두워짐 → 방으로 컷
  const push = reduce || sec > 1 ? 0 : Math.min(1, Math.max(0, (p - 0.05) / 0.38))
  // 굴을 기준점으로 키우면서 화면 가운데로 끌어옴
  const fieldTf = { transform: `translate(${32 * push}%, ${12 * push}%) scale(${1 + push * push * 3.2})`, transformOrigin: '18% 40%' }
  const dark = reduce || sec !== 1 ? 0 : Math.min(1, Math.max(0, (p - 0.3) / 0.15))
  const vignette = reduce ? (sec === 1 ? 0.6 : 0) : sec === 1 ? Math.min(1, push * 1.4) : 0
  const tone = sec === 0 ? 'light' : sec === 3 ? 'dark' : 'light'
  const fade = reduce ? { transition: 'opacity .3s ease' } : undefined

  return (
    <div ref={track} className={s.track} data-reduce={reduce || undefined}>
      <div className={s.stage} data-sec={sec}>
        {/* 01 · 02 · 04 밭 */}
        <div className={s.layer} style={{ opacity: sec === 2 ? 0 : 1, ...fade }}>
          <div className={s.fieldZoom} style={sec === 3 ? undefined : fieldTf}>
            <FieldView label="두더지가 사는 밭" />
          </div>
          <div className={s.vignette} style={{ opacity: vignette }} />
          <div className={s.darken} style={{ opacity: dark }} />
          <div className={s.shadeBottom} style={{ opacity: sec === 0 || sec === 3 ? 1 : 0 }} />
        </div>

        {/* 03 방 */}
        <div className={`${s.layer} ${s.roomLayer}`} style={{ opacity: sec === 2 ? 1 : 0, pointerEvents: sec === 2 ? 'auto' : 'none', ...fade }}>
          {roomMade && <RoomView ownerId="landing" interests={ROOM_INTERESTS} label="관심사로 꾸민 땅굴 방" still onLoaded={() => setRoomOn(true)} />}
          <div className={s.shadeLeft} />
          <div className={s.pinBox} style={{ top: `${PIN_BOX.top * 100}%`, height: `${PIN_BOX.h * 100}%` }}>
          {LABELS.map((l, i) => {
            const bx = l.bx < 0 ? l.bx + l.w : l.bx, by = l.by + 44
            const on = sec === 2 && roomOn
            return (
              <div key={l.item} className={s.pin} style={{ ...inRoom(l.x, l.y), transitionDelay: on ? `${0.3 + i * 0.08}s` : '0s', opacity: on ? 1 : 0 }}>
                <svg className={s.pinLine} aria-hidden><line x1={0} y1={0} x2={bx} y2={by} /></svg>
                <span className={s.pinDot} />
                <span className={s.pinLabel} style={{ left: l.bx, top: l.by }}><small>{l.cat}</small>{l.item}</span>
              </div>
            )
          })}
          </div>
        </div>

        {/* 04 이웃 팻말 태그 */}
        {NEIGHBORS.map((n, i) => (
          <div key={n.tags} className={`${s.nbTag} ${n.tone === 'bark' ? s.nbBark : ''}`} style={{ ...px(n.x, n.y), opacity: sec === 3 ? 1 : 0, transitionDelay: sec === 3 ? `${0.2 + i * 0.1}s` : '0s' }}>
            <strong>{n.tags}</strong><span>{n.sub}</span>
          </div>
        ))}

        <StartHeader tone={tone} />

        {/* 카피 (구간 진입 때 아래→위 16px + 페이드) */}
        <div className={`${s.copy} ${sec === 0 || sec === 3 ? s.copyBottom : ''} ${sec === 1 ? s.copyCenter : ''}`} key={sec}>
          {sec === 0 && (
            <>
              <h1>관심사로 꾸민 땅굴에서<br />이웃을 만나요</h1>
              <p>SSAFY 사람들이 좋아하는 것들로 방을 꾸미고, 서로의 땅굴에 놀러 가요.</p>
              <span className={s.scrollHint}>스크롤해서 땅굴 안으로 ↓</span>
            </>
          )}
          {sec === 1 && <h2 className={s.diveCopy}>구멍 너머에는<br />누군가의 방이 있어요</h2>}
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
            <Link to="/look" className={s.ctaSub}>먼저 둘러보기</Link>
            <Link to="/signup" className={s.ctaMain}>내 땅굴 만들기 <span aria-hidden>→</span></Link>
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
