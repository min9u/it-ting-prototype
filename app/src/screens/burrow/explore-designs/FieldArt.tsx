/**
 * 들판(마을) 바탕 그림 — SVG <g>, 단위 m (x 오른쪽, y = three z, 아래가 남쪽).
 * 미니맵(mini) · 전체 마을 지도(big) · 디자인 B 마을 지도(rich)가 같이 씀. 구멍·두더지는 쓰는 쪽에서 그림
 */
import { memo } from 'react'
import { FIELD_BOUNDS as B, LADDER, MAP_COLORS as C, type Village } from './fieldGeo'

const rad2deg = 180 / Math.PI

export const FieldArt = memo(function FieldArt({ v, detail }: { v: Village; detail: 'mini' | 'big' | 'rich' }) {
  const rich = detail === 'rich'
  return (
    <g>
      {/* 흙 슬랩 (바깥 모서리만 둥글게) */}
      <rect x={B.x0} y={B.z0} width={B.x1 - B.x0} height={B.z1 - B.z0} rx={2.6} fill={C.soil} stroke={C.soilEdge} strokeWidth={detail === 'mini' ? 0.6 : 0.35} />
      {/* 안 켠 구역 = 잔디 (3D 처럼 바깥쪽으로 1.5m 더 덮음) */}
      {v.zonesOff.map((z) => {
        const pad = 1.6
        const x0 = z.bounds.x[0] - (z.bounds.x[0] <= B.x0 ? pad : 0), x1 = z.bounds.x[1] + (z.bounds.x[1] >= B.x1 ? pad : 0)
        const zs = z.bounds.z[0] + (z.bounds.z[0] >= B.z1 ? pad : 0), zn = z.bounds.z[1] - (z.bounds.z[1] <= B.z0 ? pad : 0)
        // 이웃한 덮개끼리 틈(안티에일리어싱 선)이 안 보이게 0.3m 씩 겹침
        return <rect key={z.zone} x={x0 - 0.3} y={zn - 0.3} width={x1 - x0 + 0.6} height={zs - zn + 0.6} fill={C.grass} />
      })}
      {detail !== 'mini' && v.zonesOff.map((z) => (
        <g key={`o${z.zone}`}>
          <rect x={z.bounds.x[0] + 1} y={z.bounds.z[1] + 1} width={34} height={34} rx={2} fill="none" stroke="#fff" strokeOpacity={0.45} strokeWidth={0.3} strokeDasharray="1.2 1.2" />
          <text x={(z.bounds.x[0] + z.bounds.x[1]) / 2} y={(z.bounds.z[0] + z.bounds.z[1]) / 2} textAnchor="middle" fontSize={rich ? 1.9 : 2.4} fill="#fff" fillOpacity={0.8} fontFamily="var(--font-display)">
            아직 비어 있는 구역
          </text>
        </g>
      ))}
      {/* 잔디 덩어리 (마을 지도는 아래쪽에 짙은 그림자를 깔아 점토처럼) */}
      {rich && (
        <g fill="#6FA34F" opacity={0.55}>
          {v.grass.map((g, i) => (
            <rect key={i} x={-g.w / 2} y={-g.h / 2} width={g.w} height={g.h} rx={Math.min(g.w, g.h) * 0.45}
              transform={`translate(${g.x} ${g.z + 0.35}) rotate(${-g.ry * rad2deg})`} />
          ))}
        </g>
      )}
      <g fill={C.patch} stroke={detail === 'mini' ? 'none' : C.patchEdge} strokeWidth={0.18} opacity={detail === 'mini' ? 0.75 : 0.95}>
        {v.grass.map((g, i) => (
          <rect key={i} x={-g.w / 2} y={-g.h / 2} width={g.w} height={g.h} rx={Math.min(g.w, g.h) * 0.45}
            transform={`translate(${g.x} ${g.z}) rotate(${-g.ry * rad2deg})`} />
        ))}
      </g>
      {rich && (
        <>
          <g fill={C.flower} opacity={0.85}>{v.flowers.map((f, i) => <circle key={i} cx={f.x} cy={f.z} r={0.2} />)}</g>
          <g fill={C.pumpkin} stroke="#C8642A" strokeWidth={0.1}>{v.crops.map((c, i) => <circle key={i} cx={c.x} cy={c.z} r={0.42 * c.s} />)}</g>
        </>
      )}
      {/* 길 */}
      {rich && <path d={v.pathD} fill="none" stroke="#D99A62" strokeWidth={0.86} strokeLinecap="round" strokeLinejoin="round" opacity={0.55} transform="translate(0 .12)" />}
      <path d={v.pathD} fill="none" stroke={C.path} strokeWidth={detail === 'mini' ? 0.9 : 0.62} strokeLinecap="round" strokeLinejoin="round" opacity={detail === 'mini' ? 0.85 : 1} />
      {/* 빈 자리 */}
      <g fill={C.pad} stroke={C.soilEdge} strokeWidth={0.12} opacity={0.9}>
        {[...v.seats.values()].filter((h) => !h.occupied).map((h) => <circle key={h.seat} cx={h.x} cy={h.z} r={detail === 'mini' ? 0.8 : 0.62} />)}
      </g>
      {/* 사다리 (다른 캠퍼스-층으로). 마을 지도(rich)는 HTML 버튼으로 따로 그림 */}
      {!rich && <g transform={`translate(${LADDER.x} ${LADDER.z})`}>
        <circle r={detail === 'mini' ? 1.6 : 1.25} fill={C.ladder} stroke="#fbf4ec" strokeWidth={detail === 'mini' ? 0.45 : 0.25} />
        <path d="M-.45 -.75v1.5M.45 -.75v1.5M-.45 -.35h.9M-.45 .05h.9M-.45 .45h.9" stroke="#f7e6c8" strokeWidth={0.18} strokeLinecap="round" />
      </g>}
    </g>
  )
})
