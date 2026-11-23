import { useEffect, useMemo, useRef, useState } from 'react'
import { ENV } from '../../lib/env'
import { Link } from '@/lib/nav'
import SceneCanvas from '../../three/SceneCanvas'
import { mountRoomScene } from '../../three/roomScene'
import type { SceneHandle } from '../../three/engine'
import type { StyleTargetInfo } from '../../three/roomStyle'
import { USERS } from '../../data/mock'
import { WALLPAPERS, tileUrl } from '../../data/wallpapers'
import {
  EMPTY_STYLE, FINISHES, PATTERNS, PATTERN_SIZES, SHAPE_OPTIONS, SWATCHES, THEMES, WOOD_SWATCHES,
  autoStyle, hashSeed, shapeOf, themeOf, type PartStyle, type PatternKind, type PatternSize, type RoomStyle,
} from '../../data/roomStyle'
import s from './StyleLab.module.css'

/*
 * 땅굴 다양성 실험실 (2026-11-16, docs/burrow-diversity.md). 경로 /lab/style
 * 같은 가구라도 집마다 다르게: 색 테마 · 가구 칠하기(색 자리별 색·무늬·마감) · 모양(기본 가구) · 자동(씨앗)
 * 3D 적용은 three/roomStyle.ts, 데이터는 data/roomStyle.ts
 */

type Tab = 'auto' | 'theme' | 'paint' | 'shape'
const TABS: { id: Tab; name: string }[] = [
  { id: 'auto', name: '🎲 자동' }, { id: 'theme', name: '🎨 색 테마' }, { id: 'paint', name: '🖌 칠하기' }, { id: 'shape', name: '🪑 모양' },
]
const OWNERS = ['yerin', 'me', 'seoyeon', 'mingu', 'seobeok', 'ha'] as const

const clone = (x: RoomStyle): RoomStyle => JSON.parse(JSON.stringify(x))

export default function StyleLab() {
  const [owner, setOwner] = useState<(typeof OWNERS)[number]>('yerin')
  const interests = USERS[owner].interests
  const [wallpaper, setWallpaper] = useState<string | undefined>(undefined)
  const [style, setStyle] = useState<RoomStyle>(EMPTY_STYLE)
  const [seed, setSeed] = useState<number | null>(null)
  const [tab, setTab] = useState<Tab>('auto')
  const [sel, setSel] = useState<string | null>(null)
  const [part, setPart] = useState<string | null>(null)
  const [targets, setTargets] = useState<StyleTargetInfo[]>([])
  const [showJson, setShowJson] = useState(false)
  const [grid, setGrid] = useState<{ busy: boolean; items: { label: string; src: string }[] } | null>(null)
  const handle = useRef<SceneHandle | null>(null)
  const styleRef = useRef(style)
  styleRef.current = style

  // 스타일이 바뀌면 장면에 바로 (다시 만들지 않음)
  useEffect(() => {
    const h = handle.current
    if (!h) return
    h.setStyle?.(style)
    setTargets(h.styleTargets?.() ?? [])
  }, [style])

  // 칠하기 탭에서만 가구 고르기 모드
  useEffect(() => {
    const h = handle.current
    h?.setPickMode?.(tab === 'paint' ? (id) => { setSel(id); setPart(null) } : null)
  }, [tab, targets])

  const onReady = (h: SceneHandle) => {
    handle.current = h
    h.loaded?.then(() => {
      if (handle.current !== h) return
      setTargets(h.styleTargets?.() ?? [])
      if (tab === 'paint') h.setPickMode?.((id) => { setSel(id); setPart(null) })
    })
  }

  const update = (fn: (d: RoomStyle) => void) => setStyle((prev) => { const d = clone(prev); fn(d); return d })
  const setPartStyle = (id: string, key: string, fn: (p: PartStyle) => void) => update((d) => {
    const ps = { ...(d.parts[id]?.[key] ?? {}) }
    fn(ps)
    d.parts[id] = { ...(d.parts[id] ?? {}), [key]: ps }
  })

  const dice = () => {
    const n = (Math.random() * 1e9) >>> 0
    setSeed(n); setStyle(autoStyle(n))
  }
  const fromOwner = () => { const n = hashSeed(owner); setSeed(n); setStyle(autoStyle(n)) }

  /** 같은 관심사로 땅굴 6개: 1번은 꾸미기 없음, 나머지는 씨앗 5개 */
  const compare = async () => {
    setGrid({ busy: true, items: [] })
    const host = document.createElement('div')
    host.style.cssText = 'position:fixed;left:0;top:0;width:800px;height:600px;opacity:0;pointer-events:none;z-index:-1'
    document.body.append(host)
    const list: { label: string; style?: RoomStyle }[] = [{ label: '꾸미기 없음 (지금)' }]
    for (let i = 0; i < 5; i++) { const n = hashSeed(`${owner}-${i}-${Date.now()}`); const st = autoStyle(n); list.push({ label: `자동 · ${themeOf(st.theme).name}`, style: st }) }
    const items: { label: string; src: string }[] = []
    try {
      for (const [i, it] of list.entries()) {
        const h = mountRoomScene(host, { ownerId: `cmp${i}`, interests, wallpaper, style: it.style, still: true, focusX: .5 })
        await h.loaded
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
        items.push({ label: it.label, src: h.snapshot?.() ?? '' })
        h.dispose()
        setGrid({ busy: i < list.length - 1, items: [...items] })
      }
    } finally { host.remove() }
  }

  // 개발 서버에서만: 자동 스크린샷 스크립트가 상태를 바꿀 수 있게
  useEffect(() => {
    if (!ENV.dev) return
    ;(window as unknown as { __lab: unknown }).__lab = { setStyle, setTab, setSel, setOwner, compare, autoStyle, targets: () => handle.current?.styleTargets?.() }
  })

  const selInfo = targets.find((t) => t.id === sel) ?? null
  const partInfo = selInfo?.parts.find((p) => p.key === part) ?? selInfo?.parts[0] ?? null
  const ps: PartStyle = (sel && partInfo ? style.parts[sel]?.[partInfo.key] : undefined) ?? {}
  const json = useMemo(() => JSON.stringify(style), [style])
  const theme = themeOf(style.theme)

  return (
    <div className={s.page}>
      <SceneCanvas
        deps={`${owner}|${wallpaper ?? ''}`}
        mount={(el, fx) => mountRoomScene(el, { ownerId: owner, interests, wallpaper, worn: USERS[owner].worn, style: styleRef.current, focusX: fx })}
        focusX={.36}
        className={s.scene}
        label="땅굴 다양성 실험 장면"
        onReady={onReady}
      />

      <header className={s.top}>
        <Link to="/screens" className={s.back}>← 화면 목록</Link>
        <h1>땅굴 다양성 실험실</h1>
        <label className={s.owner}>
          땅굴 주인
          <select value={owner} onChange={(e) => { setOwner(e.target.value as typeof owner); setSel(null) }}>
            {OWNERS.map((id) => <option key={id} value={id}>{USERS[id].nickname} · {USERS[id].interests.slice(0, 3).join(', ')}{USERS[id].interests.length > 3 ? ' …' : ''}</option>)}
          </select>
        </label>
      </header>

      <aside className={s.panel}>
        <nav className={s.tabs} role="tablist">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? s.tabOn : s.tab} onClick={() => setTab(t.id)}>{t.name}</button>
          ))}
        </nav>

        <div className={s.body}>
          {tab === 'auto' && (
            <section>
              <p className={s.lead}>아무것도 안 꾸민 땅굴도 집마다 다르게 보이도록, <b>씨앗 하나</b>로 색 테마·기본 가구 모양·이불·방석·러그 무늬를 골라요. 색은 고른 테마 안에서만 써서 서로 어울려요.</p>
              <div className={s.row}>
                <button className={s.primary} onClick={dice}>🎲 다른 땅굴로</button>
                <button className={s.ghost} onClick={fromOwner}>주인 id 로 정하기</button>
              </div>
              <p className={s.meta}>{seed === null ? '꾸미기 없음 (디자이너 원래 모습)' : `씨앗 ${seed} · ${theme.name}`}</p>
              <button className={s.wide} onClick={compare} disabled={grid?.busy}>같은 관심사 땅굴 6개 나란히 보기</button>
              <p className={s.hint}>같은 관심사(같은 가구)를 고른 이웃 6명의 땅굴이 어떻게 달라지는지 한 장씩 그려요.</p>
            </section>
          )}

          {tab === 'theme' && (
            <section>
              <h3 className={s.h3}>색 테마 <small>가구 색 자리 8개를 한꺼번에</small></h3>
              <div className={s.themes}>
                {THEMES.map((t) => (
                  <button key={t.id} className={style.theme === t.id ? s.themeOn : s.theme} onClick={() => update((d) => { d.theme = t.id })}>
                    <span className={s.strip}>{Object.values(t.colors).map((c, i) => <i key={i} style={{ background: c }} />)}</span>
                    <b>{t.name}</b><small>{t.note}</small>
                  </button>
                ))}
              </div>
              <h3 className={s.h3}>러그 <small>구운 그림의 밝기를 살려 다시 칠함</small></h3>
              <Swatches colors={[...new Set([...Object.values(theme.colors).slice(0, 5), ...SWATCHES.slice(6, 12)])]} value={style.rug?.color} onPick={(c) => update((d) => { d.rug = { ...d.rug, color: c } })} onReset={() => update((d) => { delete d.rug })} />
              <PatternPicker value={style.rug?.pattern} colors={[theme.colors.cream, '#FFFFFF', theme.colors.wood_dark, theme.colors.yellow]}
                onChange={(p) => update((d) => { d.rug = { ...d.rug, color: d.rug?.color ?? theme.colors.orange, pattern: p } })} />
              <h3 className={s.h3}>벽지 <small>(이미 있는 기능, 비교용)</small></h3>
              <div className={s.walls}>
                <button className={!wallpaper ? s.wallOn : s.wall} onClick={() => setWallpaper(undefined)}>관심사로</button>
                {WALLPAPERS.map((w) => (
                  <button key={w.id} className={wallpaper === w.id ? s.wallOn : s.wall} title={w.name_ko} onClick={() => setWallpaper(w.id)}
                    style={{ backgroundImage: tileUrl(w.id, 512) ? `url(${tileUrl(w.id, 512)})` : undefined, backgroundColor: w.solid_color ?? w.avg_color_srgb }} />
                ))}
              </div>
            </section>
          )}

          {tab === 'paint' && (
            <section>
              <p className={s.lead}>방에서 <b>가구를 누르면</b> 그 가구만 칠해요. 가구마다 색 자리(재질)가 2~7개 있어요.</p>
              <div className={s.chips}>
                {targets.filter((t) => t.kind !== 'lights').map((t) => (
                  <button key={t.id} className={sel === t.id ? s.chipOn : s.chip} onClick={() => { setSel(t.id); setPart(null) }}>{t.label}</button>
                ))}
                {targets.filter((t) => t.kind === 'lights').map((t) => (
                  <button key={t.id} className={sel === t.id ? s.chipOn : s.chip} onClick={() => { setSel(t.id); setPart(null) }}>💡 {t.label}</button>
                ))}
              </div>
              {selInfo && partInfo && sel && (
                <div className={s.editor}>
                  <div className={s.editorHead}>
                    <b>{selInfo.label}</b>
                    <button className={s.link} onClick={() => update((d) => { delete d.parts[sel] })}>이 가구 원래대로</button>
                  </div>
                  <div className={s.parts}>
                    {selInfo.parts.map((p) => (
                      <button key={p.key} className={partInfo.key === p.key ? s.partOn : s.part} onClick={() => setPart(p.key)}>
                        <i style={{ background: p.color }} />{p.name}
                      </button>
                    ))}
                  </div>
                  <h4 className={s.h4}>색</h4>
                  <Swatches colors={/wood/.test(partInfo.slot) ? [...WOOD_SWATCHES, ...SWATCHES.slice(0, 16)] : SWATCHES} value={ps.color}
                    onPick={(c) => setPartStyle(sel, partInfo.key, (x) => { x.color = c })} onReset={() => setPartStyle(sel, partInfo.key, (x) => { delete x.color })} />
                  <h4 className={s.h4}>무늬</h4>
                  <PatternPicker value={ps.pattern} colors={['#FFFFFF', theme.colors.cream, theme.colors.orange, theme.colors.sky, theme.colors.yellow, theme.colors.wood_dark]}
                    onChange={(p) => setPartStyle(sel, partInfo.key, (x) => { if (p) x.pattern = p; else delete x.pattern })} />
                  <h4 className={s.h4}>마감</h4>
                  <div className={s.seg}>
                    {FINISHES.map((f) => (
                      <button key={f.id} title={f.note} className={(ps.finish ?? 'clay') === f.id ? s.segOn : s.segBtn}
                        onClick={() => setPartStyle(sel, partInfo.key, (x) => { if (f.id === 'clay') delete x.finish; else x.finish = f.id })}>{f.name}</button>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {tab === 'shape' && (
            <section>
              <p className={s.lead}>모든 땅굴에 똑같이 있는 <b>기본 가구 6개</b>를 새 모델 없이 바꿔요: 크기·비율, 부품 숨기기·복제, 코드로 만든 점토 덧붙이.</p>
              {Object.entries(SHAPE_OPTIONS).map(([id, groups]) => (
                <div key={id} className={s.shapeBox}>
                  <b>{targets.find((t) => t.id === id)?.label ?? id}</b>
                  {groups.map((g) => (
                    <div key={g.id} className={s.shapeRow}>
                      <span>{g.name}</span>
                      <div className={s.seg}>
                        {g.choices.map((c) => (
                          <button key={c.id} className={shapeOf(style, id, g.id) === c.id ? s.segOn : s.segBtn}
                            onClick={() => update((d) => { d.shape[id] = { ...(d.shape[id] ?? {}), [g.id]: c.id } })}>{c.name}</button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </section>
          )}
        </div>

        <footer className={s.foot}>
          <button className={s.ghost} onClick={() => { setStyle(EMPTY_STYLE); setSeed(null) }}>모두 원래대로</button>
          <button className={s.link} onClick={() => setShowJson((v) => !v)}>저장 데이터 {new Blob([json]).size}바이트 {showJson ? '▲' : '▼'}</button>
        </footer>
        {showJson && <pre className={s.json}>{JSON.stringify(style, null, 1)}</pre>}
      </aside>

      {grid && (
        <div className={s.gridWrap} role="dialog" aria-label="땅굴 6개 비교">
          <div className={s.gridHead}>
            <b>같은 관심사 · 땅굴 6개</b><span>{interests.join(', ')}</span>
            <button className={s.ghost} onClick={() => setGrid(null)}>닫기</button>
          </div>
          <div className={s.grid}>
            {Array.from({ length: 6 }, (_, i) => grid.items[i]).map((it, i) => (
              <figure key={i}>{it ? <img src={it.src} alt={it.label} /> : <div className={s.ph}>그리는 중…</div>}<figcaption>{it?.label ?? ''}</figcaption></figure>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Swatches({ colors, value, onPick, onReset }: { colors: string[]; value?: string; onPick: (c: string) => void; onReset: () => void }) {
  return (
    <div className={s.swatches}>
      <button className={!value ? s.swOn : s.sw} onClick={onReset} title="원래 색">↺</button>
      {colors.map((c, i) => <button key={i} className={value?.toLowerCase() === c.toLowerCase() ? s.swOn : s.sw} style={{ background: c }} onClick={() => onPick(c)} title={c} />)}
      <label className={s.sw} title="직접 고르기">＋<input type="color" value={value ?? '#ffffff'} onChange={(e) => onPick(e.target.value)} /></label>
    </div>
  )
}

function PatternPicker({ value, colors, onChange }: { value?: { kind: PatternKind; color: string; size: PatternSize }; colors: string[]; onChange: (p: { kind: PatternKind; color: string; size: PatternSize } | undefined) => void }) {
  const cur = value ?? { kind: 'none' as PatternKind, color: colors[0], size: 'M' as PatternSize }
  return (
    <div className={s.pattern}>
      <div className={s.seg}>
        {PATTERNS.map((p) => (
          <button key={p.id} className={cur.kind === p.id ? s.segOn : s.segBtn} onClick={() => onChange(p.id === 'none' ? undefined : { ...cur, kind: p.id })}>{p.name}</button>
        ))}
      </div>
      {cur.kind !== 'none' && (
        <div className={s.row}>
          <div className={s.swatchesSm}>
            {colors.map((c, i) => <button key={i} className={cur.color.toLowerCase() === c.toLowerCase() ? s.swOn : s.sw} style={{ background: c }} onClick={() => onChange({ ...cur, color: c })} />)}
          </div>
          <div className={s.seg}>
            {PATTERN_SIZES.map((z) => <button key={z.id} className={cur.size === z.id ? s.segOn : s.segBtn} onClick={() => onChange({ ...cur, size: z.id })}>{z.name}</button>)}
          </div>
        </div>
      )}
    </div>
  )
}
