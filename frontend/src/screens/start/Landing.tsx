import { useEffect, useRef, useState } from 'react'
import { Link } from '@/lib/nav'
import FieldView from '../../components/FieldView'
import RoomView from '../../components/RoomView'
import { planRoom } from '../../data/roomPlan'
import { toSubIds } from '../../data/interests'
import { ROOM_FRAME } from '../../three/roomFrame'
import StartHeader from './StartHeader'
import s from './Start.module.css'

// 랜딩 방에 놓는 관심사 (2026-11-18 확정본 이름)
const ROOM_INTERESTS = ['콘솔게임', '소설', 'JPOP/OST', '드로잉/회화', '필름/컴팩트', '캠핑/글램핑']

/**
 * 랜딩 03 가구 라벨 (Figma Furniture Label, 1440×900 기준 px).
 * 이름은 하드코딩하지 않고 **랜딩 방에 실제로 놓이는 v3.8 소품**(data/roomPlan planRoom(ROOM_INTERESTS))의 모델 이름을 씀 (2026-11-22):
 * 콘솔게임 → 게임기 · 소설 → 소설책 · 드로잉/회화 → 물감 상자 (선반 3칸), JPOP/OST → 카세트 워크맨 · 필름/컴팩트 → 필름 카메라 (바닥 소품), 캠핑/글램핑 → 캠핑 의자.
 * 예전(침대·빈백·오락기 방): 오락기 · 책장 · 스피커 · 이젤 · 카메라 · 배낭.
 * x, y = 소품 위 점(시안 좌표. 화면 px 로는 0.7774x + 160.3, 0.7773y - 9.9 @1440×900, 아래 inRoom), bx, by = 이름표 상자 왼쪽 위 (점 기준 px).
 * 점 위치는 3D 방의 소품 자리(slots.json)에 맞춤 → 자리·이름이 바뀌면 tests/landing-pins.test.ts 가 알려 줌
 */
export const LABELS: { tag: string; cat: string; x: number; y: number; bx: number; by: number }[] = [
  { tag: '콘솔게임', cat: '게임', x: 665, y: 568, bx: -150, by: -40 },
  { tag: '소설', cat: '독서', x: 705, y: 550, bx: 4, by: -80 },
  { tag: '드로잉/회화', cat: '그림', x: 740, y: 575, bx: 70, by: -40 },
  { tag: 'JPOP/OST', cat: '음악', x: 488, y: 907, bx: -125, by: -60 },
  { tag: '필름/컴팩트', cat: '사진', x: 919, y: 898, bx: 40, by: -70 },
  { tag: '캠핑/글램핑', cat: '캠핑', x: 514, y: 746, bx: -150, by: -110 },
]
/** 랜딩 방에 놓이는 소품 이름 (관심사 이름 → 모델 이름) */
export const roomItemNames = (): Record<string, string> => {
  const plan = planRoom(ROOM_INTERESTS)
  return Object.fromEntries(ROOM_INTERESTS.map((tag) => {
    const sub = toSubIds([tag])[0]
    return [tag, plan.items.find((i) => i.sub === sub && i.row.type !== 'pet')?.row.name_ko ?? '']
  }))
}
const ITEM_NAME = roomItemNames()

/** 랜딩 04 이웃 태그 (Neighbour Tag, 1440×900 기준 왼쪽 위) */
const NEIGHBORS = [
  { tags: '독서 · 게임', sub: '옆 땅굴', x: 560, y: 150, tone: 'bark' },
  { tags: '캠핑 · 사진', sub: '나랑 관심사 2개 같아요', x: 150, y: 330, tone: 'leaf' },
  { tags: '그림', sub: '방금 방명록이 달렸어요', x: 1120, y: 520, tone: 'leaf' },
] as const

/** 데모 구간(#s1 · #s2, ?s=1 · 2)의 진행도 */
const DEMO_P = [0.2, 0.8]

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
 * 시작 v2 – 랜딩 (Figma F1 랜딩 03 방 408:19384 · 랜딩 04 이웃 408:19542, 2026-11-20 확정 디자인으로 바꿈)
 * 한 화면에 고정(sticky)된 장면을 스크롤 진행도로 바꿈: 0–50% 방 → 50–100% 이웃(가운데 굴의 두더지를 가까이). 텍스트는 구간 진입 때 아래→위 16px + 페이드
 * 예전 4구간(땅 위 → 구멍 속으로 → 방 → 이웃)은 확정 디자인에 없어서 뺌. 명세도 dev 9ea6698 에서 방 → 이웃 두 구간으로 맞춤(01 스크롤 모션 타임라인)
 * 방은 다 차려질 때까지 로딩 애니메이션, 그 뒤 연출 없이 한 번에 (docs/landing-loading.md). 상단 메뉴는 랜딩 전체에서 로그인 · 시작하기
 * 모션 줄이기: 두 장면이 0.3초 크로스페이드
 * 확정 디자인(Figma 408:19542, 2026-11-20): "내 땅굴 만들기 →"가 왼쪽, "먼저 둘러보기"가 오른쪽 (예전 메모 707:11198은 반대였음)
 */
export default function Landing() {
  const track = useRef<HTMLDivElement>(null)
  // 데모·스크린샷용: #s1 · #s2 (해시 라우터에서는 ?s=1 · 2) 면 사용자가 직접 스크롤하기 전까지 그 구간을 보여 준다
  const demo = useRef(window.location.href.match(/[#?&]s=?([1-2])(?!\d)/)?.[1] ?? null)
  const [p, setP] = useState(() => (demo.current ? DEMO_P[Number(demo.current) - 1] : 0))
  // 방 3D 가 다 차려졌는지: 그 전에는 로딩 애니메이션, 가구 이름표도 그 뒤에
  const [roomOn, setRoomOn] = useState(false)
  const [reduce] = useState(() => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)
  // 새로고침하면 브라우저가 스크롤 위치를 나중에 되돌려 놓음 → 그 사이 밭이 0.5초 보였다가 방으로 넘어가던 문제 (2026-11-20).
  // 사용자가 직접 스크롤(휠·터치·키)하기 전, 또는 처음 1.5초 동안은 구간을 페이드 없이 바로 바꿈
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    const on = () => setSettled(true)
    const id = setTimeout(on, 1500)
    const evs = ['wheel', 'touchstart', 'keydown'] as const
    for (const ev of evs) window.addEventListener(ev, on, { passive: true, once: true })
    return () => { clearTimeout(id); for (const ev of evs) window.removeEventListener(ev, on) }
  }, [])

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

  // 확정 디자인(Figma F1, 2026-11-20): 랜딩은 2구간. 첫 화면 = 랜딩 03 방, 스크롤하면 랜딩 04 이웃 (예전 땅 위 · 구멍 속 구간은 뺌)
  // sec 값은 예전 번호(2 = 방, 3 = 이웃)를 그대로 씀
  const sec = p < 0.5 ? 2 : 3
  // 투명하게 숨긴 층의 3D 는 그리기 멈춤 (방 구간엔 밭, 이웃 구간엔 방). 그래픽 가속이 꺼진 PC 에서 CPU 를 아낌. 시험용 ?lpause=0
  const pauseHidden = !/[?&]lpause=0/.test(window.location.href)
  // 랜딩 04: 가운데 굴의 두더지 쪽으로 조금만 다가감 (Figma 408:19542 보다 먼 시점, 2026-11-20 디자이너 요청)
  const fieldTf = { transform: 'translate(6%, -4%) scale(1.25)', transformOrigin: '49% 72%' }
  const tone = sec === 3 ? 'dark' : 'light'
  const fade = !settled ? { transition: 'none' } : reduce ? { transition: 'opacity .3s ease' } : undefined

  return (
    <div ref={track} className={s.track} data-reduce={reduce || undefined}>
      <div className={s.stage} data-sec={sec}>
        {/* 04 밭 */}
        <div className={s.layer} style={{ opacity: sec === 3 ? 1 : 0, ...fade }}>
          <div className={s.fieldZoom} style={fieldTf}>
            <FieldView label="두더지가 사는 밭" paused={pauseHidden && sec === 2} />
          </div>
          <div className={s.shadeBottom} />
        </div>

        {/* 03 방 */}
        {/* 방은 보여 주기만 함: 마우스를 받으면 3D 방의 휠 확대가 스크롤을 막아 다음 구간으로 못 넘어감 (2026-11-20).
            미리 찍은 방 그림(loadingStill)은 지금 3D 방과 크기·벽지가 달라 바뀌는 순간 방이 움직여 보여서 쓰지 않음 */}
        <div className={`${s.layer} ${s.roomLayer}`} style={{ opacity: sec === 2 ? 1 : 0, pointerEvents: 'none', ...fade }}>
          <RoomView ownerId="landing" interests={ROOM_INTERESTS} label="관심사로 꾸민 땅굴 방" still paused={pauseHidden && sec !== 2} onLoaded={() => setRoomOn(true)} />
          <div className={s.shadeLeft} />
          <div className={s.pinBox} style={{ top: `${PIN_BOX.top * 100}%`, height: `${PIN_BOX.h * 100}%` }}>
          {LABELS.map((l, i) => {
            const item = ITEM_NAME[l.tag]
            const w = item.length * 15 + 10 // 이름표 상자 폭 (선이 상자 가장자리에 닿게)
            const bx = l.bx < 0 ? l.bx + w : l.bx, by = l.by + 44
            const on = sec === 2 && roomOn
            return (
              <div key={l.tag} className={s.pin} style={{ ...inRoom(l.x, l.y), transitionDelay: on ? `${0.3 + i * 0.08}s` : '0s', opacity: on ? 1 : 0 }}>
                <svg className={s.pinLine} aria-hidden><line x1={0} y1={0} x2={bx} y2={by} /></svg>
                <span className={s.pinDot} />
                <span className={s.pinLabel} style={{ left: l.bx, top: l.by }}><small>{l.cat}</small>{item}</span>
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
        <div className={`${s.copy} ${sec === 3 ? s.copyBottom : ''}`} key={sec}>
          {sec === 2 && (
            <>
              {/* 문구는 명세 01 랜딩 그대로 (KAN-40, 2026-11-22): 제목 "나의 관심사가 내 땅굴의 가구가 돼요" · 부제 "책을 좋아하면 소설책이, 음악을 좋아하면 카세트 워크맨이 놓여요" */}
              <h1>나의 관심사가<br />내 땅굴의 가구가 돼요</h1>
              <p>책을 좋아하면 소설책이,<br />음악을 좋아하면 카세트 워크맨이 놓여요</p>
              <span className={s.scrollHint}>스크롤해서 이웃 땅굴 보기 ↓</span>
            </>
          )}
          {sec === 3 && (
            <>
              {/* 명세 01 랜딩 04 · 5 */}
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

        {/* 오른쪽 구간 표시(땅 위 · 구멍 속으로 · 방 · 이웃)는 확정 디자인에 없어서 뺌 (2026-11-20) */}
      </div>
    </div>
  )
}
