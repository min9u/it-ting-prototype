import { lazy, Suspense, useEffect } from 'react'
import { useSearchParams } from '@/lib/nav'
import ExploreBurrow from '../ExploreBurrow'
import { MY_FLOOR, parseFloor } from '../../../data/field'
import d from './designs.module.css'
import s from '../Burrow.module.css'

const ExploreMap = lazy(() => import('./ExploreMap'))
const ExploreTunnel = lazy(() => import('./ExploreTunnel'))
const ExploreCards = lazy(() => import('./ExploreCards'))

/** 탐색 화면 디자인 시안 (팀 비교용, docs/explore-designs.md) */
export const EXPLORE_DESIGNS = [
  { id: 'a', name: '들판 점프', desc: '3D 들판에서 구멍에서 구멍으로 점프 (지금 디자인)' },
  { id: 'b', name: '마을 지도', desc: '층 전체를 2D 지도로, 두더지가 길을 따라 걸어감' },
  { id: 'c', name: '땅속 굴길', desc: '단면도, 굴길을 따라 옆 땅굴로 파고 감' },
  { id: 'd', name: '이웃 카드', desc: '나와 잘 맞는 순으로 이웃 땅굴 카드를 넘김' },
] as const
export type DesignId = (typeof EXPLORE_DESIGNS)[number]['id']

const KEY = 'digul.exploreDesign'
const isDesign = (v: string | null): v is DesignId => !!v && EXPLORE_DESIGNS.some((x) => x.id === v)
// 메모리에도 들고 있음 (아티팩트처럼 sessionStorage 가 막힌 곳에서도 한 페이지 안에서는 이어지게, data/interests 와 같은 방식)
let mem: DesignId | null = null
function stored(): DesignId | null { try { const v = sessionStorage.getItem(KEY); if (isDesign(v)) return v } catch { /* 저장소 없음 */ } return mem }
function store(v: DesignId) { mem = v; try { sessionStorage.setItem(KEY, v) } catch { /* 저장소 없음: 메모리와 주소의 ?design= 로 */ } }

/**
 * /burrow/explore 라우트: 디자인 A·B·C·D 를 고름 (2026-11-16)
 * - 주소 ?design=a|b|c|d 가 먼저, 없으면 이 탭에서 마지막으로 고른 것(sessionStorage), 그것도 없으면 A
 * - 위쪽 가운데 "시안" 칩으로 바꿈 (주소의 들판·자리는 그대로라 같은 땅굴에서 다른 시안으로 넘어감)
 * - B·C·D 는 들판이 바뀌면 새로 그림 (key)
 */
export default function ExploreDesigns() {
  const [params, setParams] = useSearchParams()
  const q = params.get('design')
  const design: DesignId = isDesign(q) ? q : stored() ?? 'a'
  useEffect(() => { store(design) }, [design])
  const floorId = (parseFloor(params.get('floor') ?? '') ?? MY_FLOOR).id
  const pick = (id: DesignId) => setParams((p) => { const n = new URLSearchParams(p); n.set('design', id); n.delete('modal'); return n }, { replace: true })
  const View = design === 'b' ? ExploreMap : design === 'c' ? ExploreTunnel : ExploreCards
  return (
    <>
      {design === 'a' ? <ExploreBurrow /> : (
        <Suspense fallback={<main className={s.page} />}>
          <View key={`${design}|${floorId}`} />
        </Suspense>
      )}
      <nav className={d.designChips} aria-label="탐색 화면 디자인 시안 (프로토타입 비교용)">
        <span className={d.designLabel}>시안</span>
        {EXPLORE_DESIGNS.map((x) => (
          <button key={x.id} className={design === x.id ? d.designOn : d.designChip} aria-pressed={design === x.id} title={x.desc} onClick={() => pick(x.id)}>
            <b>{x.id.toUpperCase()}</b> {x.name}
          </button>
        ))}
      </nav>
    </>
  )
}
