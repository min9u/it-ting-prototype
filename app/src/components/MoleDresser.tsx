import { lazy, Suspense, useState, type CSSProperties } from 'react'
import MoleAvatar from './MoleAvatar'
import { MAX_WORN, MOLE_ITEMS, MOLE_PARTS, MY_LEVEL, NONE_ICON, blockedBy, itemOf, lockOf, partTotal, type MolePart } from '../data/moleItems'
import { CloseIcon } from './Icons'
import styles from './MoleDresser.module.css'

/**
 * 두더지 꾸미기 — 부위 탭 + 아이템 격자 (온보딩 1 408:18310 · 꾸미기 모드 682:7764 공용)
 * 규칙 (3D 핸드오프 v2 accessories.md v1.2): 부위마다 하나, 최대 4개.
 * 잠금: 레벨(Lv 표시) / 관심사 전용(picks 를 넘기면 그 관심사가 있어야 열림) / 같이 못 끼는 조합(등 리본 + 캐리어)
 * - compact: 꾸미기 사이드바용 (착용 칩을 위에)
 */
export default function MoleDresser({ worn, onChange, compact, picks }: {
  worn: string[]
  onChange: (ids: string[]) => void
  compact?: boolean
  /** 고른 관심사 태그. 없으면(온보딩 1단계, 관심사를 고르기 전) 관심사 아이템을 열어 둠 */
  picks?: string[]
}) {
  const [part, setPart] = useState<MolePart>('머리')
  const [msg, setMsg] = useState<string | null>(null)
  const wornParts = worn.map((id) => itemOf(id)?.part)
  const items = MOLE_ITEMS.filter((x) => x.part === part)
  const partWorn = worn.find((id) => itemOf(id)?.part === part)

  const pick = (id: string | null) => {
    setMsg(null)
    const rest = worn.filter((w) => itemOf(w)?.part !== part)
    if (id === null || partWorn === id) return onChange(rest)
    const x = itemOf(id)!
    const why = lockOf(x, { picks }) ?? (blockedBy(id, rest) ? `${itemOf(blockedBy(id, rest)!)?.name}와(과) 같이 쓸 수 없어요` : null)
    if (why) { setMsg(`${x.name}: ${why}`); return }
    onChange([...rest, id])
  }

  return (
    <div className={compact ? `${styles.wrap} ${styles.compact}` : styles.wrap}>
      {compact && (
        <>
          <p className={styles.wornHead}>지금 착용 중 <span>{worn.length} / {MAX_WORN}</span></p>
          <WornChips worn={worn} onRemove={(id) => onChange(worn.filter((w) => w !== id))} />
        </>
      )}
      <div className={styles.parts} role="tablist" aria-label="꾸밀 부위">
        {MOLE_PARTS.map((p) => (
          <button key={p.part} role="tab" aria-selected={part === p.part} className={part === p.part ? styles.partOn : styles.part} onClick={() => { setPart(p.part); setMsg(null) }}>
            {p.part}{!compact && <small>{partTotal(p.part)}</small>}{wornParts.includes(p.part) && <i aria-label="착용 중" />}
          </button>
        ))}
      </div>
      <div className={styles.grid}>
        <button className={!partWorn ? styles.itemOn : styles.item} onClick={() => pick(null)} aria-pressed={!partWorn}>
          <img src={NONE_ICON} alt="" /><span>없음</span>
        </button>
        {items.map((x) => {
          const on = worn.includes(x.id)
          const rest = worn.filter((w) => itemOf(w)?.part !== part)
          const lock = on ? null : lockOf(x, { picks })
          const blocked = on || lock ? null : blockedBy(x.id, rest)
          const off = !!lock || !!blocked
          return (
            <button key={x.id} className={on ? styles.itemOn : off ? `${styles.item} ${styles.locked}` : styles.item}
              onClick={() => pick(x.id)} aria-pressed={on} aria-disabled={off}
              title={lock ?? (blocked ? `${itemOf(blocked)?.name}와(과) 같이 쓸 수 없어요` : x.name)}>
              {x.interest && <em className={styles.badge}>{x.interest}</em>}
              {x.level && !x.interest && <em className={`${styles.badge} ${styles.lv}`}>Lv.{x.level}</em>}
              <img src={x.icon} alt="" /><span>{x.name}</span>
              {on && <b className={styles.check} aria-hidden>✓</b>}
              {off && <b className={styles.lock} aria-hidden><LockIcon /></b>}
            </button>
          )
        })}
      </div>
      {msg && <p className={styles.notice} role="status">ⓘ {msg}</p>}
      {!compact && (
        <p className={styles.legend}>
          <i aria-hidden /> 관심사 아이템{picks ? ' · 그 관심사를 고르면 열려요' : ' · 바로 고를 수 있어요'}
          <i className={styles.lvDot} aria-hidden /> 레벨 아이템 · 지금 Lv.{MY_LEVEL}
        </p>
      )}
    </div>
  )
}

const LockIcon = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden><rect x="1.5" y="4.3" width="7" height="5" rx="1.2" fill="currentColor" /><path d="M3.2 4.5V3.2a1.8 1.8 0 0 1 3.6 0v1.3" fill="none" stroke="currentColor" strokeWidth="1.2" /></svg>
)

/** 착용 중 칩 (아이콘 + 이름 + ×) */
export function WornChips({ worn, onRemove, withPart, large }: { worn: string[]; onRemove: (id: string) => void; withPart?: boolean; large?: boolean }) {
  return (
    <ul className={large ? `${styles.worn} ${styles.wornLarge}` : styles.worn}>
      {worn.map((id) => {
        const x = itemOf(id)
        if (!x) return null
        return (
          <li key={id}>
            <img src={x.icon} alt="" />
            <span>{x.name}</span>
            {withPart && <small>{x.part}</small>}
            <button onClick={() => onRemove(id)} aria-label={`${x.name} 빼기`}><CloseIcon size={14} /></button>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * 고른 아이템을 얹은 두더지 (2D). 작은 아바타 자리와, 3D(WebGL)를 못 쓸 때 미리 보기 대신으로 씀.
 */
export function MoleWithItems({ worn, size = 150, radius, spin, label }: { worn: string[]; size?: number; radius?: number; spin?: boolean; label?: string }) {
  const at: Record<MolePart, CSSProperties> = {
    머리: { left: '50%', top: '2%', width: '46%', transform: 'translateX(-50%)' },
    얼굴: { left: '50%', top: '30%', width: '40%', transform: 'translateX(-50%)' },
    목: { left: '50%', top: '58%', width: '50%', transform: 'translateX(-50%)' },
    손: { left: '4%', bottom: '8%', width: '32%' },
  }
  return (
    <div className={spin ? `${styles.moleBox} ${styles.spin}` : styles.moleBox} style={{ width: size, height: size }} role="img" aria-label={label ?? '두더지 미리 보기'}>
      <MoleAvatar size={size} radius={radius} />
      {worn.map((id) => {
        const x = itemOf(id)
        return x ? <img key={id} src={x.icon} alt="" className={styles.moleItem} style={at[x.part]} /> : null
      })}
    </div>
  )
}

const MolePreviewCanvas = lazy(() => import('../three/MolePreviewCanvas'))

/**
 * 3D 미리 보기 (accessories.md 7번: mole_showcase 반복 + 초당 60° 회전).
 * 3D가 준비되기 전이나 WebGL을 못 쓰면 2D(MoleWithItems)를 그대로 보여 줌.
 */
export function MolePreview({ worn, size, spin, label }: { worn: string[]; size: number; spin: boolean; label?: string }) {
  const [ready, setReady] = useState(false)
  return (
    <div className={styles.preview3d} style={{ width: size, height: size }}>
      {!ready && <MoleWithItems size={size} radius={0} worn={worn} spin={spin} label={label} />}
      <Suspense fallback={null}>
        <MolePreviewCanvas worn={worn} spin={spin} label={label} className={ready ? styles.canvas3d : `${styles.canvas3d} ${styles.hidden3d}`} onReady={() => setReady(true)} />
      </Suspense>
    </div>
  )
}
