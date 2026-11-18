import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import RoomView from '../../components/RoomView'
import { getMyWorn } from '../../data/moleItems'
import { ME_ID, USERS } from '../../data/mock'
import { MY_FLOOR, fieldOf, fieldUserOf } from '../../data/field'
import { getMyInterests, interestCatOf, subOf, toSubIds } from '../../data/interests'
import { planRoom } from '../../data/roomPlan'
import { topCategoryOf, wallpaperForPicks, wallpaperOf } from '../../data/wallpapers'
import { MOOD_NAMES } from '../../data/myBurrow'
import { talkMoodOf } from '../../data/interestFx'
import s from '../burrow/Burrow.module.css'

/*
 * 땅굴 비교 실험실 (2026-11-18, docs/room-diversity-2026-11-18.md). 경로 /lab/rooms
 * 남의 땅굴(방문자 뷰, screens/burrow/VisitBurrow.tsx)과 같은 방을 아무 관심사로나 띄움 → tools/room-diversity 가 사람마다 같은 구도로 찍음.
 * 방문자 뷰에서 방 정보 패널을 접은 것과 같은 구도(focusX 0.5) · 같은 RoomView · 집주인 두더지 + 내 두더지. 화면 위 버튼·말풍선은 없음.
 * 입장 연출 없이 다 차려진 방(still)으로 시작 (?still=0 이면 연출 있음). 제품 화면·목 데이터는 바꾸지 않음.
 *   ?interests=소설,영화        관심사 (소분류 이름 또는 id, 쉼표. 3~10개 규칙은 검사하지 않음)
 *   ?user=yerin                 목 사람 · 들판 주민 id 의 관심사·액세서리 그대로 (me = 내 관심사)
 *   ?seat=3                     내 들판(서울-2층)의 자리 번호
 *   ?name=운동형&worn=hat_beret  이름표 · 집주인 액세서리 (interests 와 같이)
 *   ?wallpaper=wallpaper_01_default  벽지를 이것으로 고정 (가구·소품 차이만 보려고. 없으면 방문자 뷰처럼 관심사로 정함)
 *   ?bare=1                     왼쪽 위 정보 상자 숨김 (찍기용)
 * 찍기 스크립트가 읽는 값: window.__roomLab (사람 · 이 방에 실제로 놓인 것)
 */

interface Owner { id: string; nickname: string; interests: string[]; worn: string[] }

function ownerFrom(p: URLSearchParams): Owner | null {
  const list = p.get('interests')
  if (list !== null) {
    // 빈 값(?interests=)이면 관심사 0개 = 모든 방에 늘 있는 것만 (비교 기준, 실제로는 3개 이상 골라야 함)
    // 화면 이름으로 바꿔서 넘김 (벽지 계산 topCategoryOf 가 이름으로 찾음 — 방문자 뷰도 이름을 넘김)
    const names = toSubIds(list.split(',').map((x) => x.trim()).filter(Boolean)).map((id) => subOf(id)!.name_ko)
    const name = p.get('name') ?? '실험'
    return { id: `lab-${name}`, nickname: name, interests: names, worn: (p.get('worn') ?? '').split(',').filter(Boolean) }
  }
  const seat = p.get('seat')
  const id = seat ? fieldOf(MY_FLOOR).residents.find((r) => r.seat === +seat)?.user.id : p.get('user')
  if (!id) return null
  if (id === ME_ID) return { id, nickname: USERS.me.nickname, interests: getMyInterests(USERS.me.interests), worn: getMyWorn() }
  const u = USERS[id] ?? fieldUserOf(id)
  return u ? { id: u.id, nickname: u.nickname, interests: u.interests, worn: u.worn ?? [] } : null
}

/** 관심사 → 이 방에 실제로 놓이는 것 (roomScene 과 같은 계산: data/roomPlan.ts · data/wallpapers.ts) */
function roomSummary(names: string[]) {
  const plan = planRoom(names)
  const top = topCategoryOf(names)
  const wp = wallpaperOf(wallpaperForPicks(names))
  return {
    picks: plan.picks.map((id) => { const x = subOf(id)!; return { id, name: x.name_ko, cat: x.category, prop: x.prop } }),
    categories: plan.categories.map((c) => {
      const cd = interestCatOf(c)!
      return { id: c, name: cd.name_ko, kit: cd.kit, furniture: cd.furniture, substitute: cd.substitute ?? null }
    }),
    topCategory: top ?? null,
    mood: top ? MOOD_NAMES[top] ?? null : null,
    wallpaper: { id: wp.id, no: wp.no, name: wp.name_ko },
    items: plan.items.map((it) => ({
      id: it.row.id, name: it.row.name_ko, type: it.row.type, cat: it.category, sub: it.sub, slot: it.slot.name, kind: it.slot.kind, built: it.built,
    })),
  }
}

export default function RoomsLab() {
  const [params] = useSearchParams()
  const owner = useMemo(() => ownerFrom(params), [params])
  const summary = useMemo(() => (owner ? roomSummary(owner.interests) : null), [owner])
  const [fx] = useState(() => ({ viewer: getMyInterests(USERS.me.interests), talk: talkMoodOf(owner?.id) }))
  const bare = params.get('bare') === '1'
  const wallpaper = params.get('wallpaper') ?? undefined

  useEffect(() => {
    // 찍기 스크립트용 (tools/room-diversity/capture.mjs)
    const neighbors = fieldOf(MY_FLOOR).residents.map((r) => ({ seat: r.seat, id: r.user.id, nickname: r.user.nickname, interests: r.user.interests, worn: r.user.worn ?? [], mine: !!r.mine }))
    ;(window as unknown as { __roomLab?: unknown }).__roomLab = { owner, summary, neighbors, wallpaperForced: wallpaper ? wallpaperOf(wallpaper).id : null }
  }, [owner, summary, wallpaper])

  if (!owner || !summary) {
    return <main className={s.page} style={{ display: 'grid', placeItems: 'center' }}><p>?interests=소설,영화 · ?user=yerin · ?seat=3 중 하나를 주세요</p></main>
  }
  const props = summary.items.filter((it) => it.type === 'sub_prop')
  return (
    <main className={s.page}>
      <RoomView ownerId={owner.id} interests={owner.interests} hostName={owner.nickname} hostWorn={owner.worn} worn={getMyWorn()} focusX={0.5}
        label={`${owner.nickname}의 땅굴`} still={params.get('still') !== '0'} fx={fx} wallpaper={wallpaper} />
      {!bare && (
        <aside style={{ position: 'absolute', left: 16, top: 16, zIndex: 5, maxWidth: 340, padding: '12px 14px', borderRadius: 12, background: 'var(--surface)', boxShadow: 'var(--shadow-card)', fontSize: 13, lineHeight: 1.6 }}>
          <strong>{owner.nickname}</strong> · 관심사 {owner.interests.length}개
          <div>{owner.interests.join(' · ')}</div>
          <div>벽지 {wallpaper ? `${wallpaperOf(wallpaper).no} ${wallpaperOf(wallpaper).name_ko} (고정)` : `${summary.wallpaper.no} ${summary.wallpaper.name}`} · 가구 {summary.items.filter((it) => it.type === 'category_furniture').length} · 소품 {props.length}</div>
        </aside>
      )}
    </main>
  )
}
