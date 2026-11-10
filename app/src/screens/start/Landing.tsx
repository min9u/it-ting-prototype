import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import roomCutout from '../../assets/room-cutout.png'
import StartHeader from './StartHeader'
import s from './Start.module.css'

/** 랜딩 03 가구 라벨. 좌표는 landing-03-room.png 에서 잰 값 (방 그림 상자 기준 %) */
const LABELS = [
  { cat: '게임', item: '오락기', x: 20.8, y: 68.0, dx: -95, dy: -82 },
  { cat: '독서', item: '책장', x: 29.0, y: 64.8, dx: 59, dy: -114 },
  { cat: '음악', item: '스피커', x: 59.6, y: 77.9, dx: 56, dy: -164 },
  { cat: '그림', item: '이젤', x: 75.2, y: 71.9, dx: 81, dy: -133 },
  { cat: '사진', item: '카메라', x: 87.4, y: 65.8, dx: 67, dy: -103 },
  { cat: '캠핑', item: '배낭', x: 7.5, y: 92.0, dx: 91, dy: -54 },
]

const NEIGHBORS = [
  { tags: '독서 · 게임', sub: '옆 땅굴', x: 22, y: 58 },
  { tags: '캠핑 · 사진', sub: '나랑 관심사 2개 같아요', x: 70, y: 50 },
  { tags: '그림', sub: '방금 방명록이 달렸어요', x: 48, y: 72 },
]

const SECTIONS = ['땅 위', '구멍 속으로', '내 방', '이웃']

/**
 * 시작 v2 – 랜딩 01–04 (스크롤 0 / 30 / 60 / 85–100%) + 모션 타임라인 408:19694
 * 화면은 sticky로 고정하고 스크롤 진행도로 장면만 바꾼다. 카피는 구간 진입 때 아래→위 16px + 페이드.
 * 모션 줄이기면 4장 정지 화면 크로스페이드 0.3s (전역 reduce-motion 규칙).
 * 랜딩 03만 스크린샷 있음. 나머지는 메타데이터 기반 — 스크린샷 대조 필요
 */
export default function Landing() {
  const track = useRef<HTMLDivElement>(null)
  const [p, setP] = useState(0)

  useEffect(() => {
    const onScroll = () => {
      const el = track.current
      if (!el) return
      const max = el.offsetHeight - window.innerHeight
      setP(Math.min(1, Math.max(0, -el.getBoundingClientRect().top / max)))
    }
    // 데모·스크린샷용: #s1 ~ #s4 면 스크롤하기 전까지 그 구간을 보여 준다
    const jump = window.location.hash.match(/^#s([1-4])$/)
    if (jump) setP([0, 0.32, 0.6, 0.9][Number(jump[1]) - 1])
    else onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll) }
  }, [])

  const sec = p < 0.2 ? 0 : p < 0.45 ? 1 : p < 0.75 ? 2 : 3
  // 01→02: 구멍으로 푸시인, 02: 어두워짐, 03: 방, 04: 풀아웃
  const groundScale = 1 + Math.min(1, p / 0.45) * 2.6
  const dark = sec === 1 ? Math.min(1, (p - 0.2) / 0.2) : 0

  return (
    <div ref={track} className={s.track}>
      <div className={s.stage} data-sec={sec}>
        <StartHeader dark />

        {/* 01 · 02 땅 위 → 구멍 */}
        <div className={`${s.layer} ${s.ground}`} style={{ opacity: sec <= 1 ? 1 : 0 }}>
          <div className={s.groundInner} style={{ transform: `scale(${groundScale})` }}>
            <div className={s.grass} />
            <div className={s.hole}><span className={s.mole} aria-hidden /></div>
          </div>
          <div className={s.darken} style={{ opacity: dark }} />
        </div>

        {/* 03 방 */}
        <div className={`${s.layer} ${s.roomLayer}`} style={{ opacity: sec === 2 ? 1 : 0 }}>
          <div className={s.roomBox}>
            <img src={roomCutout} alt="관심사로 꾸민 땅굴 방" />
            {LABELS.map((l, i) => (
              <div key={l.item} className={s.pin} style={{ left: `${l.x}%`, top: `${l.y}%`, transitionDelay: sec === 2 ? `${0.3 + i * 0.08}s` : '0s', opacity: sec === 2 ? 1 : 0 }}>
                <span className={s.pinDot} />
                <svg className={s.pinLine} width={Math.abs(l.dx) + 2} height={Math.abs(l.dy)} style={{ left: l.dx < 0 ? l.dx : 0, top: l.dy }} aria-hidden>
                  <line x1={l.dx < 0 ? 1 : Math.abs(l.dx)} y1={0} x2={l.dx < 0 ? Math.abs(l.dx) : 1} y2={Math.abs(l.dy)} />
                </svg>
                <span className={s.pinLabel} style={{ left: l.dx, top: l.dy - 22 }}><small>{l.cat}</small>{l.item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 04 이웃 */}
        <div className={`${s.layer} ${s.neighborLayer}`} style={{ opacity: sec === 3 ? 1 : 0 }}>
          {NEIGHBORS.map((n) => (
            <div key={n.tags} className={s.nb} style={{ left: `${n.x}%`, top: `${n.y}%` }}>
              <div className={s.nbCard}><strong>{n.tags}</strong><span>{n.sub}</span></div>
              <span className={s.nbMound} />
            </div>
          ))}
        </div>

        {/* 카피 */}
        <div className={s.copy} key={sec}>
          {sec === 0 && (
            <>
              <h1 className="display">관심사로 꾸민 땅굴에서<br />이웃을 만나요</h1>
              <p>SSAFY 사람들이 좋아하는 것들로 방을 꾸미고, 서로의 땅굴에 놀러 가요.</p>
              <span className={s.scrollHint}>스크롤해서 땅굴 안으로 ↓</span>
            </>
          )}
          {sec === 1 && <h1 className="display">쏙, 땅 아래로</h1>}
          {sec === 2 && (
            <>
              <h1 className="display">고른 관심사가<br />가구가 돼요</h1>
              <p>책을 좋아하면 책장이, 게임을 좋아하면<br />오락기가 방에 놓여요.</p>
            </>
          )}
          {sec === 3 && (
            <>
              <h1 className="display">같은 걸 좋아하는 이웃이<br />생각보다 가까이 살아요</h1>
              <p>땅 위를 걸으며 땅굴을 구경하고, 마음이 맞으면 같이 모여요.</p>
              <div className={s.ctaRow}>
                <Link to="/signup" className={s.ctaMain}>내 땅굴 만들기</Link>
                <Link to="/look" className={s.ctaSub}>먼저 둘러보기</Link>
              </div>
            </>
          )}
        </div>

        <ol className={s.progress} aria-label="진행">
          {SECTIONS.map((t, i) => <li key={t} className={i === sec ? s.progOn : ''}><span />{i === sec && <em>{t}</em>}</li>)}
        </ol>
      </div>
    </div>
  )
}
