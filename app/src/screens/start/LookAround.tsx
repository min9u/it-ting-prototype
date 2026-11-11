import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import FieldView from '../../components/FieldView'
import RoomView from '../../components/RoomView'
import StartHeader, { GuestCounter, PeekMole } from './StartHeader'
import s from './Start.module.css'

/**
 * 밭 위 땅굴 3개. 좌표는 FieldView 장면(1440×897, cover)을 1440×900 으로 그렸을 때의 px.
 * FieldView 는 탐색하기 화면 구도라 시안(408:19989)보다 멀리서 봄 → 흙더미 자리는 실제 3D 렌더에서 잼.
 *  - hot: 누를 수 있는 흙더미 타원 (cx, cy, rx, ry)
 *  - tag: Burrow Tag 왼쪽 위 (오른쪽 굴은 시안 그대로 (1120, 430))
 */
const BURROWS = [
  { id: 'mingu', name: '민구굴', tags: '독서 · 게임 · 캠핑', interests: ['독서', '게임', '캠핑'], hot: [1177, 395, 220, 65], tag: [1120, 430] },
  { id: 'seoyeon', name: '서연굴', tags: '독서 · 에세이 · 홈카페', interests: ['독서', '에세이', '홈카페'], hot: [678, 515, 295, 105], tag: [235, 470] },
  { id: 'yerin', name: '예린굴', tags: '요리 · 캠핑 · 그림', interests: ['요리', '캠핑', '그림'], hot: [292, 360, 210, 55], tag: [150, 205] },
] as const
const FREE = 3

/** 1440×897 장면을 el 크기에 cover 로 맞췄을 때 좌표 변환 (FieldView 와 같은 계산) */
function useCover(el: React.RefObject<HTMLElement | null>) {
  const [vp, setVp] = useState({ w: 1440, h: 900 })
  useEffect(() => {
    const node = el.current
    if (!node) return
    const ro = new ResizeObserver(() => setVp({ w: node.clientWidth, h: node.clientHeight }))
    ro.observe(node)
    return () => ro.disconnect()
  }, [el])
  const k = Math.max(vp.w / 1440, vp.h / 897)
  const ox = (vp.w - 1440 * k) / 2, oy = (vp.h - 897 * k) / 2
  return (x: number, y: number) => ({ left: ox + x * k, top: oy + y * k, k })
}

/**
 * 시작 v2 – 둘러보기 · 땅 (비로그인) 408:19989 · 4번째 방 · 로그인 필요 408:20104
 * 흙더미에 마우스를 올리면 Burrow Tag, 누르면 그 땅굴로 들어감. 비로그인은 방 3번까지 구경 → 4번째에 로그인 안내.
 * 데모용 쿼리: ?gate=1
 */
export default function LookAround() {
  const nav = useNavigate()
  const pageRef = useRef<HTMLDivElement>(null)
  const at = useCover(pageRef)
  // 데모용: ?gate=1 이면 3개를 다 본 상태로 로그인 안내부터
  const [params] = useSearchParams()
  const demoGate = params.get('gate') === '1'
  const [seen, setSeen] = useState(demoGate ? FREE : 0)
  const [hover, setHover] = useState<string>(BURROWS[0].id)
  const [inside, setInside] = useState<string | null>(null)
  const [gate, setGate] = useState(demoGate)

  const enter = (id: string) => {
    if (seen >= FREE) { setGate(true); return }
    setSeen((n) => n + 1)
    setInside(id)
  }
  const b = BURROWS.find((x) => x.id === inside)
  const h = BURROWS.find((x) => x.id === hover)!
  const tagPos = at(h.tag[0], h.tag[1])

  return (
    <div className={s.page} ref={pageRef}>
      {b && (
        <div className={s.lookRoom}>
          <RoomView ownerId={b.id} interests={[...b.interests]} label={`${b.name} 안`}>
            <span className={s.lookTag}>{b.name} · {b.tags}</span>
            <button className={s.lookUp} onClick={() => setInside(null)}>땅 위로 돌아가기</button>
          </RoomView>
        </div>
      )}
      {!b && <div className={`${s.lookField} ${gate ? s.lookBlur : ''}`}>
        <FieldView label="땅굴이 모여 있는 밭">
          {!gate && BURROWS.map((x) => {
            const p = at(x.hot[0] - x.hot[2], x.hot[1] - x.hot[3])
            return (
              <button
                key={x.id}
                className={s.hot}
                style={{ left: p.left, top: p.top, width: x.hot[2] * 2 * p.k, height: x.hot[3] * 2 * p.k }}
                onMouseEnter={() => setHover(x.id)}
                onFocus={() => setHover(x.id)}
                onClick={() => enter(x.id)}
                aria-label={`${x.name} 들어가기 (${x.tags})`}
              />
            )
          })}
        </FieldView>
        <div className={s.lookShade} aria-hidden />
      </div>}

      {!gate && !b && (
        <div className={s.burrowTag} style={{ left: tagPos.left, top: tagPos.top }}>
          <strong>{h.name}</strong>
          <span>{h.tags}</span>
          <button onClick={() => enter(h.id)}>들어가기</button>
        </div>
      )}
      {!gate && !b && <p className={s.lookHint}>땅굴을 눌러 들어가 보세요 · 로그인 없이 방 {FREE}개까지</p>}

      <StartHeader
        tone={gate ? 'light' : 'dark'}
        right={gate
          ? <GuestCounter seen={seen} max={FREE} />
          : <><GuestCounter seen={seen} max={FREE} pill /><Link to="/login" className={s.headerLink}>로그인</Link></>}
      />

      {gate && (
        <div className={s.center} role="dialog" aria-modal="true" aria-labelledby="gate-title">
          <div className={`${s.panelWrap} ${s.gateWrap}`}>
            <PeekMole />
            <section className={`${s.panel} ${s.gate}`}>
              <h2 id="gate-title" className={s.gateTitle}>방 {FREE}개를 다 구경했어요</h2>
              <p className={s.gateText}>로그인하면 계속 둘러보고<br />방명록도 남길 수 있어요.</p>
              <div className={s.gateActions}>
                <button className={s.primary} onClick={() => nav('/login')}>로그인</button>
                <button className={s.secondary} onClick={() => nav('/signup')}>회원가입</button>
                <button className={s.textBtn} onClick={() => setGate(false)}>땅 위로 돌아가기</button>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  )
}
