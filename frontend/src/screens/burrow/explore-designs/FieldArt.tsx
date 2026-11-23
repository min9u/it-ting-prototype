/**
 * 들판(마을) 바탕 그림 — SVG <g>, 단위 m (x 오른쪽, y = three z, 아래가 남쪽).
 * 미니맵(mini) · 전체 마을 지도(big) · 디자인 B 마을 지도(rich)가 같이 씀. 구멍·두더지는 쓰는 쪽에서 그림
 * v3.10 (2026-11-18): 바닥 전체가 잔디, 흙은 켜진 구역의 길·구멍 둘레에만 부드러운 띠 (3D soil_zoneN · soil_link_N_M 과 같은 모양을 흉내).
 *   안 켠 구역은 잔디만. 잔디 덩어리는 없어짐
 */
import { memo } from 'react'
import { CROP_COLORS, FIELD_BOUNDS as B, LADDER, MAP_COLORS as C, type Village } from './fieldGeo'

export const FieldArt = memo(function FieldArt({ v, detail }: { v: Village; detail: 'mini' | 'big' | 'rich' }) {
  const rich = detail === 'rich'
  const seats = [...v.seats.values()]
  const crop = CROP_COLORS[v.crop] ?? CROP_COLORS.pumpkin
  return (
    <g>
      {/* 잔디 슬랩 (바깥 모서리만 둥글게) */}
      <rect x={B.x0} y={B.z0} width={B.x1 - B.x0} height={B.z1 - B.z0} rx={2.6} fill={C.grass} stroke="#7DB457" strokeWidth={detail === 'mini' ? 0.6 : 0.35} />
      {/* 켜진 구역은 살짝 밝게 (안 켠 구역 = 잔디만과 구분) */}
      {v.zonesOn.map((z) => (
        <rect key={`l${z.zone}`} x={Math.min(...z.bounds.x)} y={Math.min(...z.bounds.z)} width={36} height={36} fill={C.grassLit} />
      ))}
      {detail !== 'mini' && v.zonesOff.map((z) => (
        <g key={`o${z.zone}`}>
          <rect x={z.bounds.x[0] + 1} y={z.bounds.z[1] + 1} width={34} height={34} rx={2} fill="none" stroke="#fff" strokeOpacity={0.45} strokeWidth={0.3} strokeDasharray="1.2 1.2" />
          <text x={(z.bounds.x[0] + z.bounds.x[1]) / 2} y={(z.bounds.z[0] + z.bounds.z[1]) / 2} textAnchor="middle" fontSize={rich ? 1.9 : 2.4} fill="#fff" fillOpacity={0.8} fontFamily="var(--font-display)">
            아직 비어 있는 구역
          </text>
        </g>
      ))}
      {/* 흙 띠: 길을 따라 넓게 + 구멍·빈 자리 둘레 (3D 흙 노드처럼 가장자리가 옅게: 넓고 옅은 띠 위에 좁고 짙은 띠) */}
      <g fill="none" stroke={C.soil} strokeLinecap="round" strokeLinejoin="round">
        <path d={v.pathD} strokeWidth={3.6} opacity={0.35} />
        <path d={v.pathD} strokeWidth={2.2} opacity={0.75} />
      </g>
      <g fill={C.soil}>
        {seats.map((h) => <circle key={h.seat} cx={h.x} cy={h.z} r={2.2} opacity={0.35} />)}
        {seats.map((h) => <circle key={`c${h.seat}`} cx={h.x} cy={h.z} r={1.5} opacity={0.75} />)}
      </g>
      {rich && (
        <>
          <g fill={C.flower} opacity={0.85}>{v.flowers.map((f, i) => <circle key={i} cx={f.x} cy={f.z} r={0.2} />)}</g>
          <g fill={crop[0]} stroke={crop[1]} strokeWidth={0.1}>{v.crops.map((c, i) => <circle key={i} cx={c.x} cy={c.z} r={0.42 * c.s} />)}</g>
        </>
      )}
      {/* 길 */}
      {rich && <path d={v.pathD} fill="none" stroke="#D99A62" strokeWidth={0.86} strokeLinecap="round" strokeLinejoin="round" opacity={0.55} transform="translate(0 .12)" />}
      <path d={v.pathD} fill="none" stroke={C.path} strokeWidth={detail === 'mini' ? 0.9 : 0.62} strokeLinecap="round" strokeLinejoin="round" opacity={detail === 'mini' ? 0.85 : 1} />
      {/* 빈 자리 */}
      <g fill={C.pad} stroke={C.soilEdge} strokeWidth={0.12} opacity={0.9}>
        {seats.filter((h) => !h.occupied).map((h) => <circle key={h.seat} cx={h.x} cy={h.z} r={detail === 'mini' ? 0.8 : 0.62} />)}
      </g>
      {/* 사다리 (다른 캠퍼스-층으로). 마을 지도(rich)는 HTML 버튼으로 따로 그림 */}
      {!rich && <g transform={`translate(${LADDER.x} ${LADDER.z})`}>
        <circle r={detail === 'mini' ? 1.6 : 1.25} fill={C.ladder} stroke="#fbf4ec" strokeWidth={detail === 'mini' ? 0.45 : 0.25} />
        <path d="M-.45 -.75v1.5M.45 -.75v1.5M-.45 -.35h.9M-.45 .05h.9M-.45 .45h.9" stroke="#f7e6c8" strokeWidth={0.18} strokeLinecap="round" />
      </g>}
    </g>
  )
})
