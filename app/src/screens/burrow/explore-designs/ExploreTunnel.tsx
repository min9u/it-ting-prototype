import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { ME_ID } from '../../../data/mock'
import RoomModeToggle from '../../../components/RoomModeToggle'
import { HomeIcon } from '../../../components/Icons'
import { getMyWorn } from '../../../data/moleItems'
import Minimap, { useVillage } from '../Minimap'
import { EmptyField, ExploreOverlays, ExploreTools, HomeButton, OwnerPanel, PANEL_COVER, SignCard, capture, useExploreBase, useExploreKeys } from './common'
import { MAP_COLORS } from './fieldGeo'
import { isRare } from './match'
import { Mole2D, RoomPeek } from './parts'
import s from '../Burrow.module.css'
import rv from '../../../components/RoomView.module.css'
import d from './designs.module.css'
import t from './tunnel.module.css'

/*
 * 탐색 디자인 C — 땅속 굴길 (단면도, 가로로 이어짐). 2026-11-16, docs/explore-designs.md
 * - 땅굴(방)들이 자리 번호 순서(= 땅굴을 만든 순서, 02 F5 1)대로 땅속 굴길에 매달려 있음. 위아래로 번갈아 붙어서 개미집처럼
 * - 들어가지 않고도 방 단면(벽지·관심 분야 소품·집주인 두더지)을 구경 → 말 걸기 전 부담을 낮춤
 * - ←/→ 옆 땅굴로 파고 감, ↑/↓ 나와 관심사가 겹치는 앞/뒤 땅굴로 건너뜀, 방을 누르면 그 방까지 굴길을 따라 감, Enter 들어가기
 * - 휠·끌기로 굴길만 둘러보기(두더지는 그대로) → "내 두더지로" 버튼
 * - 땅 위: 땅굴 입구(링 색 흙더미 + 자리 번호 팻말), 지금 땅굴의 안내판은 입구 옆에 꽂힘
 * DOM·CSS 만 씀 (3D 없음)
 */

const STEP = 214 // 방 사이 가로 간격 (px)
const START_X = 330 // 사다리 (굴길 시작)
const LEFT_SAFE = 320
const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2)
const reduceMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** 화면 높이에 맞춘 세로 자리 (H = 장면 높이) */
function rows(H: number) {
  const surf = Math.round(H * 0.255)
  const tun = Math.round(H * 0.61)
  const dw = Math.round(Math.min(210, Math.max(150, H * 0.22)))
  return { surf, tun, dw, dh: Math.round(dw * 0.8), gap: 36 }
}

export default function ExploreTunnel() {
  const base = useExploreBase()
  const { field, floor } = base
  const v = useVillage(field)
  const worn = useMemo(() => getMyWorn(), [])
  const list = field.residents // 자리 번호 순서
  const [panelOpen, setPanelOpen] = useState(base.params.get('panel') !== 'closed')
  const startIdx = Math.max(0, list.findIndex((r) => r.seat === base.startSeat))
  const [idx, setIdx] = useState(startIdx)
  const [digging, setDigging] = useState(false)
  const [H, setH] = useState(896)
  const [W, setW] = useState(1440)
  const [camX, setCamX] = useState(0)
  const [free, setFree] = useState(false) // 둘러보는 중 (두더지에서 떨어진 화면)
  const scene = useRef<HTMLDivElement>(null)
  const moleEl = useRef<HTMLDivElement>(null)
  const dig = useRef<number>(0)
  const molePos = useRef<{ d: number; facing: 1 | -1 }>({ d: 0, facing: 1 })
  const cover = panelOpen ? PANEL_COVER : 0
  const focusX = panelOpen ? 0.403 : 0.5
  const R = rows(H)
  const here = list[idx]

  /* ---------- 굴길 (Catmull-Rom 을 8px 정도로 잘게 나눈 선) ---------- */
  const geo = useMemo(() => {
    const P: [number, number][] = [[START_X - 120, R.tun + 4], [START_X, R.tun]]
    list.forEach((_, i) => P.push([START_X + 190 + i * STEP, R.tun + Math.round(Math.sin(i * 1.7) * 16)]))
    const endX = (P[P.length - 1]?.[0] ?? START_X) + 170
    P.push([endX, R.tun + 6])
    const samples: [number, number][] = []
    const roomAt: number[] = []
    for (let k = 0; k < P.length - 1; k++) {
      const p0 = P[Math.max(0, k - 1)], p1 = P[k], p2 = P[k + 1], p3 = P[Math.min(P.length - 1, k + 2)]
      if (k >= 2) roomAt[k - 2] = samples.length
      const n = Math.max(6, Math.round(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 8))
      for (let j = 0; j < n; j++) {
        const u = j / n, u2 = u * u, u3 = u2 * u
        const f = (a: number, b: number, c: number, e: number) => 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - e) * u2 + (-a + 3 * b - 3 * c + e) * u3)
        samples.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])])
      }
    }
    samples.push(P[P.length - 1])
    if (list.length) roomAt[list.length - 1] ??= samples.length - 1
    const cum = [0]
    for (let i = 1; i < samples.length; i++) cum.push(cum[i - 1] + Math.hypot(samples[i][0] - samples[i - 1][0], samples[i][1] - samples[i - 1][1]))
    const ladderAt = samples.findIndex((p) => p[0] >= START_X)
    const d = 'M' + samples.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('L')
    return { P, samples, cum, roomAt, ladderAt, d, width: endX + 260 }
  }, [list, R.tun])
  const distOf = (i: number) => (list.length ? geo.cum[geo.roomAt[i]] : geo.cum[geo.ladderAt])
  const pointAt = (dist: number): [number, number] => {
    const { cum, samples } = geo
    let lo = 0, hi = cum.length - 1
    while (lo < hi - 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= dist) lo = mid; else hi = mid }
    const f = Math.min(1, Math.max(0, (dist - cum[lo]) / ((cum[hi] - cum[lo]) || 1)))
    return [samples[lo][0] + (samples[hi][0] - samples[lo][0]) * f, samples[lo][1] + (samples[hi][1] - samples[lo][1]) * f]
  }
  const roomX = (i: number) => START_X + 190 + i * STEP
  /** 그 방(또는 두더지 x)이 화면 쓸 수 있는 곳의 36% 자리에 오도록 */
  const camFor = (x: number) => x - (LEFT_SAFE + (W - cover - LEFT_SAFE) * 0.36)

  const drawMole = () => {
    const el = moleEl.current
    if (!el) return
    const [x, y] = pointAt(molePos.current.d)
    el.style.left = `${x}px`; el.style.top = `${y + 15}px`
    el.dataset.facing = String(molePos.current.facing)
  }

  /* ---------- 크기 ---------- */
  useLayoutEffect(() => {
    const el = scene.current
    if (!el) return
    const measure = () => { setH(el.clientHeight || 896); setW(el.clientWidth || 1440) }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  // 처음·크기가 바뀌면 두더지를 지금 방 앞에, 카메라는 그 방으로
  useLayoutEffect(() => {
    molePos.current.d = distOf(idx)
    drawMole()
    if (!free) setCamX(camFor(list.length ? roomX(idx) : START_X))
  }, [geo, W, cover]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => cancelAnimationFrame(dig.current), [])

  /* ---------- 파고 가기 ---------- */
  const digTo = useCallback((j: number) => {
    if (base.leaving || j < 0 || j >= list.length) return
    cancelAnimationFrame(dig.current)
    const from = molePos.current.d, to = distOf(j)
    setIdx(j); setFree(false); setCamX(camFor(roomX(j)))
    if (Math.abs(to - from) < 1) { setDigging(false); base.rememberSeat(list[j].seat); return }
    molePos.current.facing = to < from ? -1 : 1
    setDigging(true)
    const dur = reduceMotion() ? 0 : Math.min(1700, Math.max(560, Math.abs(to - from) * 2.2))
    const t0 = performance.now()
    const step = () => {
      const k = dur ? Math.min(1, (performance.now() - t0) / dur) : 1
      molePos.current.d = from + (to - from) * ease(k)
      drawMole()
      if (k < 1) { dig.current = requestAnimationFrame(step); return }
      setDigging(false)
      base.rememberSeat(list[j].seat)
    }
    dig.current = requestAnimationFrame(step)
  }, [base, list, geo, W, cover]) // eslint-disable-line react-hooks/exhaustive-deps

  /** 나와 관심사가 겹치는 다음/앞 땅굴 */
  const nextShared = (dir: 1 | -1) => {
    for (let j = idx + dir; j >= 0 && j < list.length; j += dir) if (base.shared(list[j]).length) return j
    return -1
  }
  const enter = () => { if (!digging) base.enter(here) }
  useExploreKeys(!base.leaving, {
    dir: (dir) => {
      if (digging) return
      if (dir === 'left' || dir === 'right') digTo(idx + (dir === 'right' ? 1 : -1))
      else { const j = nextShared(dir === 'down' ? 1 : -1); if (j >= 0) digTo(j) }
    },
    enter,
  })

  /* ---------- 둘러보기 (휠 · 끌기) ---------- */
  const maxCam = Math.max(0, geo.width - W + cover)
  const panBy = (dx: number) => { setFree(true); setCamX((c) => Math.min(maxCam, Math.max(-40, c + dx))) }
  useEffect(() => {
    const el = scene.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest('[data-ui]')) return
      e.preventDefault()
      panBy((Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * 0.9)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  })
  const drag = useRef<{ x: number; c: number; moved: boolean } | null>(null)
  const suppress = useRef(false)
  const onDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('[data-ui]')) return
    drag.current = { x: e.clientX, c: camX, moved: false }; suppress.current = false
  }
  const onMove = (e: React.PointerEvent) => {
    const g = drag.current
    if (!g) return
    const dx = e.clientX - g.x
    if (!g.moved && Math.abs(dx) < 5) return
    if (!g.moved) { g.moved = true; capture(scene.current, e.pointerId, true) }
    setFree(true); setCamX(Math.min(maxCam, Math.max(-40, g.c - dx)))
  }
  const onUp = (e: React.PointerEvent) => {
    const g = drag.current
    drag.current = null
    if (g?.moved) { suppress.current = true; capture(scene.current, e.pointerId, false) }
  }
  const pick = (j: number) => { if (suppress.current) { suppress.current = false; return } if (!digging) digTo(j) }

  const goHome = () => { const j = list.findIndex((r) => r.mine); if (j >= 0) digTo(j) }
  const moleOff = free && Math.abs(camFor(list.length ? roomX(idx) : START_X) - camX) > 260
  // 화면에 가까운 방만 그림 (150자리여도 가벼움)
  const vis0 = Math.floor((camX - 400 - START_X - 190) / STEP), vis1 = Math.ceil((camX + W + 400 - START_X - 190) / STEP)

  return (
    <main className={s.page}>
      <div ref={scene} className={`${rv.scene} ${t.scene}`} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        style={{ '--surf': `${R.surf}px`, '--tun': `${R.tun}px` } as CSSProperties}
        role="application" aria-label={`${floor.campus}-${floor.floor}층 땅속 굴길. 땅굴 ${list.length}개가 만든 순서대로 이어져 있어요`}>
        <div className={t.sky} style={{ backgroundPositionX: `${-camX * 0.25}px` }} aria-hidden />
        <div className={t.world} style={{ width: geo.width, transform: `translateX(${-camX}px)` }} data-free={free ? '' : undefined}>
          <div className={t.soil} aria-hidden />
          <div className={t.grass} aria-hidden />
          {/* 굴길 */}
          <svg className={t.tunnel} width={geo.width} height={H} aria-hidden>
            {list.map((r, i) => {
              const up = i % 2 === 0, x = roomX(i), y = geo.P[i + 2][1]
              return <path key={r.seat} d={up ? `M${x} ${y} V${R.tun - R.gap - 6}` : `M${x} ${y} V${R.tun + R.gap + 8}`} className={t.neck} />
            })}
            {/* 입구 → 방(위쪽 방) 또는 굴길(아래쪽 방) */}
            {list.map((r, i) => <path key={`s${r.seat}`} d={`M${roomX(i)} ${R.surf + 6} V${i % 2 === 0 ? R.tun - R.gap - R.dh + 10 : geo.P[i + 2][1]}`} className={t.shaft} />)}
            <path d={`M${START_X} ${R.surf + 4} V${R.tun}`} className={t.shaft} />
            <path d={geo.d} className={t.tubeOuter} />
            <path d={geo.d} className={t.tubeInner} />
            <path d={geo.d} className={t.tubeLine} />
            {list.map((r, i) => i % 2 === 0 && <path key={`n${r.seat}`} d={`M${roomX(i)} ${geo.P[i + 2][1]} V${R.tun - R.gap - 6}`} className={t.neckInner} />)}
            {list.map((r, i) => i % 2 === 1 && <path key={`m${r.seat}`} d={`M${roomX(i)} ${geo.P[i + 2][1]} V${R.tun + R.gap + 8}`} className={t.neckInner} />)}
            <path d={`M${START_X} ${R.surf + 4} V${R.tun}`} className={t.shaftInner} />
          </svg>
          {/* 사다리: 다른 캠퍼스-층 */}
          <button data-ui className={t.ladder} style={{ left: START_X, top: R.surf - 36 }} onClick={() => base.setModal('floor')} aria-label="사다리: 다른 캠퍼스-층으로">
            <span className={t.ladderRails} aria-hidden style={{ height: R.tun - R.surf + 20 }} />
            <span className={t.ladderSign}>사다리 · 다른 층</span>
          </button>
          {/* 땅 위 입구 + 땅속 방 */}
          {list.map((r, i) => {
            if (i < vis0 || i > vis1) return null
            const x = roomX(i), up = i % 2 === 0
            const ring = r.mine ? MAP_COLORS.mine : v?.seats.get(r.seat)?.ring ?? '#e2b78a'
            const sh = base.shared(r)
            const cur = i === idx
            const top = up ? R.tun - R.gap - R.dh : R.tun + R.gap
            return (
              <div key={r.seat} className={t.slot} data-cur={cur ? '' : undefined} data-mine={r.mine ? '' : undefined}>
                <button className={t.mound} style={{ left: x, top: R.surf, '--ring': ring } as CSSProperties} onClick={() => pick(i)}
                  aria-label={`${r.seat}번 자리 ${r.mine ? '내 땅굴' : `${r.user.nickname}님의 땅굴`} 입구`}>
                  <span className={t.moundHill} aria-hidden />
                  <span className={t.post} aria-hidden>
                    <b>{r.seat}</b>{r.mine ? <><HomeIcon size={11} /> 내 땅굴</> : r.user.nickname}
                    {!r.mine && r.user.online && <i className={t.on} />}
                  </span>
                </button>
                <button className={t.room} style={{ left: x, top, width: R.dw, height: R.dh }} onClick={() => pick(i)}
                  aria-label={`${r.mine ? '내 땅굴' : `${r.user.nickname}님의 땅굴`} 들여다보기${sh.length ? `, 같은 관심사 ${sh.length}개` : ''}`}>
                  <RoomPeek ownerId={r.mine ? ME_ID : r.user.id} interests={r.user.interests} worn={r.mine ? worn : r.user.worn} width={R.dw} mine={r.mine} online={!r.mine && r.user.online} className={t.peek} />
                  {!r.mine && sh.length > 0 && (
                    <span className={t.shared} data-rare={isRare(sh[0]) ? '' : undefined}>
                      {isRare(sh[0]) ? '✦ ' : ''}{sh[0]}{sh.length > 1 ? ` +${sh.length - 1}` : ''}
                    </span>
                  )}
                  {r.mine && <span className={t.mineTag}><HomeIcon size={12} /> 내 땅굴</span>}
                </button>
              </div>
            )
          })}
          {/* 내 두더지 (굴길 위) */}
          <div ref={moleEl} className={t.mole} data-digging={digging ? '' : undefined} aria-hidden>
            <i /><i /><i />
            <Mole2D worn={worn} size={52} />
          </div>
          {/* 지금 땅굴 안내판: 땅 위 입구 옆에 꽂힘 */}
          {here && !digging && (
            <div data-ui className={t.sign} style={{ left: roomX(idx) + 34, top: R.surf + 6 }}>
              <SignCard base={base} r={here} onEnter={enter} />
            </div>
          )}
          <div className={t.end} style={{ left: geo.width - 250, top: R.tun - 40 }} aria-hidden>
            <span>{list.length ? '굴길 끝 · 새 땅굴이 생기면 이어져요' : ''}</span>
          </div>
        </div>

        <div data-ui><ExploreTools base={base} /></div>
        <div data-ui><EmptyField base={base} left={focusX} top="14%" /></div>
        {moleOff && (
          <button data-ui className={t.back} style={{ left: `${focusX * 100}%` }} onClick={() => { setFree(false); setCamX(camFor(list.length ? roomX(idx) : START_X)) }}>
            내 두더지로 돌아가기
          </button>
        )}
        <div data-ui>
          <Minimap field={field} floor={floor} seat={here?.seat ?? 0} moving={digging} moveMs={700} selected={here?.seat ?? null}
            onGo={(n) => { const j = list.findIndex((r) => r.seat === n); if (j >= 0) digTo(j) }} onLadder={() => base.setModal('floor')} />
        </div>
        <span data-ui><HomeButton base={base} atHome={!!here?.mine} onHome={goHome} disabled={digging} /></span>
        <p className={d.keyHint} style={{ left: `${focusX * 100}%` }}>
          <kbd>←</kbd><kbd>→</kbd> 옆 땅굴 · <kbd>↑</kbd><kbd>↓</kbd> 관심사 겹치는 땅굴 · 휠로 굴길 둘러보기 · <kbd>Enter</kbd> 들어가기
        </p>
        <span data-ui><RoomModeToggle style={{ left: `${focusX * 100}%` }} /></span>
      </div>

      <OwnerPanel base={base} r={here} open={panelOpen} setOpen={setPanelOpen} />
      <ExploreOverlays base={base} />
    </main>
  )
}
