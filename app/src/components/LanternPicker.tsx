import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { fxOn, fxVersion, getLantern, setLantern, subscribeFx } from '../lib/fxLab'
import { lanternChoicesOf, peopleCount, subName } from '../data/interestFx'
import { toSubIds } from '../data/interests'
import SceneButton from './SceneButton'
import s from './LanternPicker.module.css'

/*
 * 🏮 관심사 등불 고르기 (f_lantern, docs/interest-effects.md 2차). 탐색 들판 왼쪽 위 버튼 줄 맨 아래.
 * 관심사 하나를 고르면 그 관심사를 가진 땅굴만 등불이 켜지고 나머지는 흐려짐 (three/interestFx/fieldFx.ts) + 미니맵에서도 (Minimap.tsx).
 * 고를 수 있는 것: 내 관심사(이 들판에 가진 이웃 수) · 이 들판의 드문 관심사(드문 순 4개). 고른 값은 탭 안에서만 기억 (lib/fxLab getLantern)
 */
export default function LanternPicker({ residents, myInterests }: { residents: { user: { interests: string[] }; mine?: boolean }[]; myInterests: string[] }) {
  useSyncExternalStore(subscribeFx, fxVersion)
  const [open, setOpen] = useState(false)
  const id = useId()
  const box = useRef<HTMLDivElement>(null)
  const choices = useMemo(() => lanternChoicesOf(residents, myInterests), [residents, myInterests])
  const cur = getLantern()
  const curN = cur ? residents.filter((r) => !r.mine && toSubIds(r.user.interests).includes(cur)).length : 0

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('pointerdown', onDown, true); window.removeEventListener('keydown', onKey) }
  }, [open])

  if (!fxOn('f_lantern')) return null
  const pick = (sub: string | null) => { setLantern(sub); setOpen(false) }
  return (
    <div ref={box} className={s.wrap} data-lantern-open={open ? '' : undefined}>
      <SceneButton tone={cur ? 'mint' : 'paper'} onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls={open ? id : undefined}>
        <span aria-hidden>🏮</span> {cur ? <>{subName(cur)} <small className={s.n}>{curN}집</small></> : '관심사 등불'}
      </SceneButton>
      {cur && <button type="button" className={s.off} onClick={() => pick(null)} aria-label="등불 끄기">✕</button>}
      {open && (
        <section id={id} className={s.card} aria-label="관심사 등불 고르기">
          <p className={s.lead}>관심사 하나를 고르면 그 관심사를 가진 땅굴에만 등불이 켜져요</p>
          <h3 className={s.h}>내 관심사</h3>
          <div className={s.chips}>
            {choices.mine.map((c) => (
              <button key={c.sub} type="button" className={cur === c.sub ? s.chipOn : s.chip} disabled={!c.n} aria-pressed={cur === c.sub} onClick={() => pick(c.sub)}>
                {subName(c.sub)} <small>{c.n}집</small>
              </button>
            ))}
          </div>
          {choices.rare.length > 0 && (
            <>
              <h3 className={s.h}>이 들판의 드문 관심사</h3>
              <div className={s.chips}>
                {choices.rare.map((c) => (
                  <button key={c.sub} type="button" className={cur === c.sub ? s.chipOn : s.chipRare} aria-pressed={cur === c.sub} onClick={() => pick(c.sub)}
                    title={`이 관심사를 고른 사람 ${(peopleCount(c.sub) ?? 0).toLocaleString()}명`}>
                    ✦ {subName(c.sub)} <small>{c.n}집</small>
                  </button>
                ))}
              </div>
            </>
          )}
          {cur && <button type="button" className={`link-accent ${s.clear}`} onClick={() => pick(null)}>등불 끄기</button>}
        </section>
      )}
    </div>
  )
}
