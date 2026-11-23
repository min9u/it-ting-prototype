import { useEffect, useId, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react'
import { AIM_LABEL, FX_DEFS, applyPreset, fxVersion, getFx, presetOf, setFx, subscribeFx, type FxArea, type FxPreset } from '../lib/fxLab'
import { graphicsTier } from '../lib/graphicsTier'
import { lowTier } from '../lib/deviceTier'
import { useReducedMotion } from '../lib/useReducedMotion'
import { lookDiverse, setLookDiverse, subscribeLook } from '../lib/roomLookLab'
import SceneButton from './SceneButton'
import s from './FxPanel.module.css'

/*
 * "✨ 이펙트" 패널 (docs/interest-effects.md, 2026-11-17 실험).
 * 아티팩트에서는 주소(?쿼리)를 못 바꾸므로 관심사 이펙트를 여기서 하나씩 켜고 끄거나 묶음(모두 켬 · 추천 묶음 · 모두 끔)으로 고름.
 * 선택은 lib/fxLab.ts 가 localStorage 에 기억하고, 장면을 다시 만들지 않고 바로 반영됨.
 * 자리: 장면 오른쪽 아래, 정보 패널 왼쪽 (🧪 저사양 실험실은 화면 맨 오른쪽 아래, 탐색 시안 칩은 위 가운데라 안 겹침)
 */
const PRESETS: { id: FxPreset; name: string }[] = [
  { id: 'all', name: '모두 켬' },
  { id: 'rec', name: '추천 묶음' },
  { id: 'none', name: '모두 끔' },
]

/** 지금 이펙트가 어떻게 그려지는지 (three/interestFx/overlay.ts fxMode 와 같은 기준, three.js 를 불러오지 않으려고 따로 셈) */
function modeNote(reduce: boolean): string {
  if (reduce) return '움직임 줄이기 설정이 켜져 있어 움직임 없이 아이콘만 보여요'
  if (graphicsTier() !== 'software') return 'GPU로 그리는 중 · 모든 이펙트가 움직여요'
  return lowTier() === 'weak' ? '아주 느린 PC로 감지됨 · 움직임 없이 아이콘만 보여요' : '그래픽 가속이 꺼짐 · 가까운 것만 20fps로, 8초 동안 가만히 있으면 쉬어요'
}

export default function FxPanel({ area, style }: { area: FxArea; style?: CSSProperties }) {
  useSyncExternalStore(subscribeFx, fxVersion)
  const diverse = useSyncExternalStore(subscribeLook, lookDiverse)
  const fx = getFx()
  const [open, setOpen] = useState(false)
  const reduce = useReducedMotion()
  const id = useId()
  const box = useRef<HTMLDivElement>(null)
  const defs = FX_DEFS.filter((d) => d.area === area)
  const onCount = defs.filter((d) => fx[d.id]).length
  const preset = presetOf(area)

  // 바깥을 누르거나 Esc 면 닫음
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('pointerdown', onDown, true); window.removeEventListener('keydown', onKey) }
  }, [open])

  return (
    <div ref={box} className={s.wrap} style={style} data-fx-panel={area}>
      {open && (
        <section id={id} className={s.card} aria-label="관심사 이펙트 켜고 끄기">
          <header className={s.head}>
            <strong className="display">✨ 관심사 이펙트</strong>
            <span className={s.lab}>실험</span>
            <button type="button" className={s.close} onClick={() => setOpen(false)} aria-label="이펙트 패널 닫기">✕</button>
          </header>
          <p className={s.lead}>{area === 'room' ? '땅굴 안에서 관심사가 한눈에 보이게' : '들판에서 이웃의 관심사가 멀리서도 보이게'}</p>
          {area === 'room' && (
            // 땅굴 색 다양하게 (2026-11-18 2단계 실험, lib/roomLookLab.ts). 이펙트와 따로 기억하고, 묶음 버튼에는 안 들어감
            <label className={`${s.row} ${s.lookRow}`}>
              <input type="checkbox" className={s.switch} checked={diverse} onChange={(e) => setLookDiverse(e.target.checked)} />
              <span className={s.text}>
                <span className={s.name}>🎨 땅굴 색 다양하게</span>
                <span className={s.desc}>대표 관심사마다 다른 색 묶음(벽 · 바닥 · 러그 · 가구)에, 사람마다 이불 · 러그 무늬와 가구 모양이 조금씩 달라요. 끄면 디자이너 원래 색</span>
              </span>
            </label>
          )}
          <div className={s.presets} role="group" aria-label="묶음">
            {PRESETS.map((p) => (
              <button key={p.id} type="button" className={preset === p.id ? s.presetOn : s.preset} aria-pressed={preset === p.id} onClick={() => applyPreset(area, p.id)}>
                {p.name}
              </button>
            ))}
          </div>
          <ul className={s.list}>
            {defs.map((d) => (
              <li key={d.id}>
                <label className={s.row}>
                  <input type="checkbox" className={s.switch} checked={!!fx[d.id]} onChange={(e) => setFx({ [d.id]: e.target.checked })} />
                  <span className={s.text}>
                    <span className={s.name}>
                      {d.name}
                      {d.rec && <i className={s.recTag}>추천</i>}
                      {d.note && <i className={s.noteTag}>{d.note}</i>}
                    </span>
                    <span className={s.desc}>{d.desc}</span>
                    <span className={s.aims}>{d.aims.map((a) => <i key={a}>{AIM_LABEL[a]}</i>)}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <p className={s.mode}>{modeNote(reduce)}</p>
        </section>
      )}
      <SceneButton tone="paper" className={s.btn} onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls={open ? id : undefined}>
        <span aria-hidden>✨</span> 이펙트 <small className={s.count}>{onCount}/{defs.length}</small>
      </SceneButton>
    </div>
  )
}
