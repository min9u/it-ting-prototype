import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from '@/lib/nav'
import RoomView from '../../components/RoomView'
import { getMyWorn } from '../../data/moleItems'
import { USERS } from '../../data/mock'
import { MY_FLOOR, fieldOf } from '../../data/field'
import { getMyInterests, interestCatOf, subOf, toSubIds } from '../../data/interests'
import { planRoom } from '../../data/roomPlan'
import { wallpaperOf } from '../../data/wallpapers'
import { MOOD_NAMES } from '../../data/myBurrow'
import { roomLookOf, type SavedRoom } from '../../data/roomLook'
import { talkMoodOf } from '../../data/interestFx'
import { themeOf } from '../../data/roomStyle'
import { lookDiverse } from '../../lib/roomLookLab'
import { useVisitBurrow } from '../../api/explore'
import s from '../burrow/Burrow.module.css'

/*
 * 땅굴 비교 실험실 (2026-11-18, docs/room-diversity-2026-11-18.md). 경로 /lab/rooms
 * 남의 땅굴(방문자 뷰, screens/burrow/VisitBurrow.tsx)과 같은 방을 아무 관심사로나 띄움 → tools/room-diversity 가 사람마다 같은 구도로 찍음.
 * 방문자 뷰에서 방 정보 패널을 접은 것과 같은 구도(focusX 0.5) · 같은 RoomView · 집주인 두더지 + 내 두더지. 화면 위 버튼·말풍선은 없음.
 * 입장 연출 없이 다 차려진 방(still)으로 시작 (?still=0 이면 연출 있음). 제품 화면·목 데이터는 바꾸지 않음.
 *   ?interests=소설,영화        관심사 (소분류 이름 또는 id, 쉼표. 3~10개 규칙은 검사하지 않음). 저장한 방 없음
 *   ?user=yerin                 목 사람 · 들판 주민 id (me = 나). 방문자 뷰와 같이 땅굴 API(목 서버 GET /burrows/{id})로 받아서
 *                               집주인 관심사 · 저장한 방(room)까지 같은 값을 씀 (2026-11-18 1단계: "남이 보는 내 땅굴" 확인용)
 *   ?seat=3                     내 들판(서울-2층)의 자리 번호 (user 와 같은 방법)
 *   ?name=운동형&worn=hat_beret  이름표 · 집주인 액세서리 (interests 와 같이)
 *   ?wallpaper=wallpaper_01_default  벽지를 이것으로 고정 (가구·소품 차이만 보려고. 없으면 방문자 뷰처럼 roomLookOf)
 *   ?bare=1                     왼쪽 위 정보 상자 숨김 (찍기용)
 * 찍기 스크립트가 읽는 값: window.__roomLab (사람 · 방 모습 · 이 방에 실제로 놓인 것)
 */

interface Owner { id: string; nickname: string; interests: string[]; worn: string[]; room: SavedRoom | null }

/** ?interests= 로 만든 실험용 사람 (저장한 방 없음) */
function adhocOwner(p: URLSearchParams): Owner | null {
  const list = p.get('interests')
  if (list === null) return null
  // 빈 값(?interests=)이면 관심사 0개 = 모든 방에 늘 있는 것만 (비교 기준, 실제로는 3개 이상 골라야 함)
  const names = toSubIds(list.split(',').map((x) => x.trim()).filter(Boolean)).map((id) => subOf(id)!.name_ko)
  const name = p.get('name') ?? '실험'
  return { id: `lab-${name}`, nickname: name, interests: names, worn: (p.get('worn') ?? '').split(',').filter(Boolean), room: null }
}
/** ?user= · ?seat= → 회원 id */
function userIdOf(p: URLSearchParams): string | null {
  const seat = p.get('seat')
  return seat ? fieldOf(MY_FLOOR).residents.find((r) => r.seat === +seat)?.user.id ?? null : p.get('user')
}

/** 관심사 → 이 방에 실제로 놓이는 것 (roomScene 과 같은 계산: data/roomPlan.ts · data/roomLook.ts) */
function roomSummary(o: Owner, wallpaperId: string) {
  const plan = planRoom(o.interests)
  const look = roomLookOf(o.id, o.interests, o.room)
  const wp = wallpaperOf(wallpaperId)
  return {
    picks: plan.picks.map((id) => { const x = subOf(id)!; return { id, name: x.name_ko, cat: x.category, prop: x.prop } }),
    categories: plan.categories.map((c) => {
      const cd = interestCatOf(c)!
      return { id: c, name: cd.name_ko, kit: cd.kit, furniture: cd.furniture, substitute: cd.substitute ?? null }
    }),
    // 벽지를 정한 대분류 = 대표 관심사(맨 앞)의 대분류 (예전 이름 topCategory 를 그대로 둠: tools/room-diversity/analyze.py 가 읽음)
    lead: look.lead,
    topCategory: look.lead,
    mood: look.lead ? MOOD_NAMES[look.lead] ?? null : null,
    wallpaper: { id: wp.id, no: wp.no, name: wp.name_ko },
    look,
    // 2단계 색 묶음 (data/roomStyle.ts): 비교 페이지의 "대분류별 묶음" 표와 방 카드에 씀. 🎨 스위치가 꺼져 있으면(?look=designer) null
    theme: look.style && lookDiverse() ? (() => {
      const t = themeOf(look.style.theme)
      return { id: t.id, name: t.name, note: t.note, shell: t.shell ?? null, rug: t.rug ?? null, colors: t.colors, wall: look.style.wall ?? null, floor: look.style.floor ?? null }
    })() : null,
    items: plan.items.map((it) => ({
      id: it.row.id, name: it.row.name_ko, type: it.row.type, cat: it.category, sub: it.sub, slot: it.slot.name, kind: it.slot.kind, built: it.built,
    })),
  }
}

export default function RoomsLab() {
  const [params] = useSearchParams()
  const adhoc = useMemo(() => adhocOwner(params), [params])
  const uid = adhoc ? null : userIdOf(params)
  // 방문자 뷰와 같은 길: 땅굴 API(GET /users/{userId}/burrow) → toBurrow. 명세상 서버는 방 꾸미기 값을 주지 않아 room 은 늘 null (관심사로 계산)
  const q = useVisitBurrow(uid ?? '', !!uid)
  const owner: Owner | null = adhoc ?? (q.data ? { id: q.data.owner.id, nickname: q.data.owner.nickname, interests: q.data.owner.interests, worn: q.data.owner.worn ?? [], room: null } : null)
  const forced = params.get('wallpaper') ?? undefined
  const look = useMemo(() => (owner ? roomLookOf(owner.id, owner.interests, owner.room) : null), [owner?.id, owner?.interests, owner?.room]) // eslint-disable-line react-hooks/exhaustive-deps
  const summary = useMemo(() => (owner && look ? roomSummary(owner, forced ?? look.wallpaper) : null), [owner?.id, look, forced]) // eslint-disable-line react-hooks/exhaustive-deps
  const [fx] = useState(() => ({ viewer: getMyInterests(USERS.me.interests), talk: talkMoodOf(uid ?? adhoc?.id) }))
  const bare = params.get('bare') === '1'

  useEffect(() => {
    // 찍기 스크립트용 (tools/room-diversity/capture.mjs)
    const neighbors = fieldOf(MY_FLOOR).residents.map((r) => ({ seat: r.seat, id: r.user.id, nickname: r.user.nickname, interests: r.user.interests, worn: r.user.worn ?? [], mine: !!r.mine }))
    ;(window as unknown as { __roomLab?: unknown }).__roomLab = { owner, summary, neighbors, wallpaperForced: forced ? wallpaperOf(forced).id : null }
  }, [owner?.id, summary, forced]) // eslint-disable-line react-hooks/exhaustive-deps

  if (uid && q.isPending) return <main className={s.page} aria-busy="true" />
  if (!owner || !summary || !look) {
    return <main className={s.page} style={{ display: 'grid', placeItems: 'center' }}><p>?interests=소설,영화 · ?user=yerin · ?seat=3 중 하나를 주세요</p></main>
  }
  const props = summary.items.filter((it) => it.type === 'sub_prop')
  const wp = wallpaperOf(forced ?? look.wallpaper)
  return (
    <main className={s.page}>
      <RoomView ownerId={owner.id} interests={owner.interests} wallpaper={wp.id} furniture={look.furniture} style={look.style}
        hostName={owner.nickname} hostWorn={owner.worn} worn={getMyWorn()} focusX={0.5}
        label={`${owner.nickname}의 땅굴`} still={params.get('still') !== '0'} fx={fx} />
      {!bare && (
        <aside style={{ position: 'absolute', left: 16, top: 16, zIndex: 5, maxWidth: 340, padding: '12px 14px', borderRadius: 12, background: 'var(--surface)', boxShadow: 'var(--shadow-card)', fontSize: 13, lineHeight: 1.6 }}>
          <strong>{owner.nickname}</strong> · 관심사 {owner.interests.length}개
          <div>{owner.interests.join(' · ')}</div>
          <div>벽지 {wp.no} {wp.name_ko}{forced ? ' (고정)' : look.from.wallpaper === 'saved' ? ' (저장한 벽지)' : ''} · 가구 {summary.items.filter((it) => it.type === 'category_furniture').length} · 소품 {props.length}</div>
          <div>색: {summary.theme ? `${summary.theme.name} (${summary.theme.note})` : '디자이너 원래 색'}</div>
        </aside>
      )}
    </main>
  )
}
