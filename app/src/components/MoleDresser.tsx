import { useState, type CSSProperties } from 'react'
import MoleAvatar from './MoleAvatar'
import { MAX_WORN, MOLE_ITEMS, MOLE_PARTS, NONE_ICON, itemOf, type MolePart } from '../data/moleItems'
import { CloseIcon } from './Icons'
import styles from './MoleDresser.module.css'

/**
 * 두더지 꾸미기 — 부위 탭 + 아이템 격자 (온보딩 1 408:18310 · 꾸미기 모드 682:7764 공용)
 * - 최대 2개, 부위마다 하나. 2개를 다 고르면 다른 부위 아이템은 잠기고 안내가 뜬다
 * - compact: 꾸미기 사이드바용 (착용 칩을 위에, 부위 탭에 개수 없이)
 */
export default function MoleDresser({ worn, onChange, compact }: {
  worn: string[]
  onChange: (ids: string[]) => void
  compact?: boolean
}) {
  const [part, setPart] = useState<MolePart>('머리')
  const wornParts = worn.map((id) => itemOf(id)?.part)
  const full = worn.length >= MAX_WORN
  const items = MOLE_ITEMS.filter((x) => x.part === part)
  const partWorn = worn.find((id) => itemOf(id)?.part === part)

  const pick = (id: string | null) => {
    const rest = worn.filter((w) => itemOf(w)?.part !== part)
    if (id === null) return onChange(rest)
    if (partWorn === id) return onChange(rest)
    if (!partWorn && full) return
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
          <button key={p.part} role="tab" aria-selected={part === p.part} className={part === p.part ? styles.partOn : styles.part} onClick={() => setPart(p.part)}>
            {p.part}{!compact && <small>{p.total}</small>}{wornParts.includes(p.part) && <i aria-label="착용 중" />}
          </button>
        ))}
      </div>
      <div className={styles.grid}>
        <button className={!partWorn ? styles.itemOn : styles.item} onClick={() => pick(null)} aria-pressed={!partWorn}>
          <img src={NONE_ICON} alt="" /><span>없음</span>
        </button>
        {items.map((x) => {
          const on = worn.includes(x.id)
          const locked = !on && !partWorn && full
          return (
            <button key={x.id} className={on ? styles.itemOn : locked ? `${styles.item} ${styles.locked}` : styles.item}
              onClick={() => pick(x.id)} aria-pressed={on} aria-disabled={locked}>
              {x.interest && <em className={styles.badge}>{x.interest}</em>}
              <img src={x.icon} alt="" /><span>{x.name}</span>
              {on && <b className={styles.check} aria-hidden>✓</b>}
            </button>
          )
        })}
      </div>
      {items.length === 0 && <p className={styles.unknown}>{part} 아이템은 Figma에 목록이 아직 없어요. (확인 못 함)</p>}
      {!compact && <p className={styles.legend}><i aria-hidden /> 관심사 아이템 · 바로 고를 수 있어요</p>}
      {!compact && full && (
        <p className={styles.notice} role="status">ⓘ 2개를 모두 골랐어요. 다른 부위를 꾸미려면 오른쪽에서 하나를 빼 주세요.</p>
      )}
    </div>
  )
}

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
 * 고른 아이템을 얹은 두더지 (2D). 머리 아이템은 정수리, 손 아이템은 왼쪽 아래, 얼굴·목은 가운데.
 * Figma 미리 보기는 3D 렌더지만 glb 두더지에 아이템 모델이 아직 없어서 2D 아바타 위에 아이콘을 겹쳐 대신함.
 */
export function MoleWithItems({ worn, size = 150, radius, spin, label }: { worn: string[]; size?: number; radius?: number; spin?: boolean; label?: string }) {
  const at: Record<MolePart, CSSProperties> = {
    머리: { left: '50%', top: '4%', width: '46%', transform: 'translateX(-50%)' },
    얼굴: { left: '50%', top: '36%', width: '34%', transform: 'translateX(-50%)' },
    목: { left: '50%', top: '62%', width: '44%', transform: 'translateX(-50%)' },
    손: { left: '6%', bottom: '6%', width: '34%' },
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
