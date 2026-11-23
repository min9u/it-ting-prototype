import { useEffect, useMemo, useRef, useState } from 'react'
import { ME_ID } from '../../../data/mock'
import RoomModeToggle from '../../../components/RoomModeToggle'
import Avatar from '../../../components/Avatar'
import InterestChip from '../../../components/InterestChip'
import { EmptyMole } from '../../../components/Feedback'
import { ChevronLeft, ChevronRight } from '../../../components/Icons'
import { affOf, floorLabel, type Resident } from '../../../data/field'
import { useRegularOwnerIds } from '../../../api/explore'
import { getMyWorn } from '../../../data/moleItems'
import Minimap from '../Minimap'
import { EmptyField, ExploreOverlays, ExploreTools, HomeButton, capture, useExploreBase, useExploreKeys, type ExploreBase } from './common'
import { isRare, matchScore, peopleOf } from './match'
import { RoomPeek } from './parts'
import s from '../Burrow.module.css'
import rv from '../../../components/RoomView.module.css'
import d from './designs.module.css'
import c from './cards.module.css'

/*
 * 탐색 디자인 D — 이웃 카드 넘기기. 2026-11-16, docs/explore-designs.md
 * - 지도 대신 "나와 잘 맞는 순"으로 이웃 땅굴을 큰 카드로 한 장씩: 방 미리보기 그림 · 주인 정보 · 겹치는 관심사(드문 취미 ✦) · 말 거는 계기
 * - 잘 맞는 정도 = 겹치는 관심사마다 1 + 1000/그 관심사 인원 (드문 취미일수록 무거움, 온보딩 땅굴 무드와 같은 식)
 * - 정렬: 잘 맞는 순 · 접속 중 · 단골 · 자리 순. 맨 앞 카드는 내 땅굴 (내 땅굴로 돌아가기 = 맨 앞으로)
 * - ←/→ 넘기기(끌어서 넘기기도), ↑/↓ 카드 뒤집기(Q&A), Enter 놀러가기. 오른쪽: 미니맵(이 땅굴이 마을 어디쯤) + 다음 차례
 * DOM·CSS 만 씀 (3D 없음)
 */

type Sort = 'match' | 'online' | 'regular' | 'seat'
const SORTS: [Sort, string][] = [['match', '잘 맞는 순'], ['online', '접속 중'], ['regular', '단골'], ['seat', '자리 순']]

export default function ExploreCards() {
  const base = useExploreBase()
  const { field, floor, mine } = base
  const regulars = useRegularOwnerIds() // GET /me/regular-burrows
  const worn = useMemo(() => getMyWorn(), [])
  const q = base.params.get('sort')
  const [sort, setSortState] = useState<Sort>(q === 'online' || q === 'regular' || q === 'seat' ? q : 'match')
  const makeDeck = (srt: Sort) => {
    const me = field.residents.filter((r) => r.mine)
    let others = field.residents.filter((r) => !r.mine)
    if (srt === 'online') others = others.filter((r) => r.user.online)
    if (srt === 'regular') others = others.filter((r) => regulars.includes(r.user.id))
    const score = (r: Resident) => matchScore(r.user, mine.interests) + (r.user.online ? 0.3 : 0)
    others = srt === 'seat' ? others : [...others].sort((a, b) => score(b) - score(a) || a.seat - b.seat)
    return [...me, ...others]
  }
  const deck = useMemo(() => makeDeck(sort), [field, sort, regulars, mine]) // eslint-disable-line react-hooks/exhaustive-deps
  /** 처음 카드: 주소의 자리, 없으면 내 카드 다음(가장 잘 맞는 이웃) */
  const firstOf = (dk: Resident[], seat?: number) => {
    const j = seat != null ? dk.findIndex((r) => r.seat === seat) : -1
    return j >= 0 ? j : Math.min(dk[0]?.mine ? 1 : 0, Math.max(0, dk.length - 1))
  }
  const [idx, setIdx] = useState(() => firstOf(deck, Number(base.params.get('seat'))))
  const [dir, setDir] = useState<1 | -1>(1)
  const [back, setBack] = useState(false)
  const [moving, setMoving] = useState(false)
  const card = deck[Math.min(idx, deck.length - 1)]
  const movingT = useRef(0)

  const go = (j: number, how?: 1 | -1) => {
    if (base.leaving || !deck.length) return
    const n = Math.max(0, Math.min(deck.length - 1, j))
    if (n === idx) return
    setDir(how ?? (n > idx ? 1 : -1)); setIdx(n); setBack(false)
    setMoving(true); window.clearTimeout(movingT.current); movingT.current = window.setTimeout(() => setMoving(false), 520)
    base.rememberSeat(deck[n].seat)
  }
  useEffect(() => () => window.clearTimeout(movingT.current), [])
  /** 순서 바꾸기: keep 자리(기본은 지금 카드)가 새 목록에도 있으면 그 카드, 없으면 맨 앞 이웃. 주소는 한 번에 (sort·seat) */
  const setSort = (v: Sort, keep = card?.seat) => {
    const nd = makeDeck(v), n = firstOf(nd, keep)
    setSortState(v); setIdx(n); setBack(false)
    base.setParams((p) => {
      const q2 = new URLSearchParams(p)
      if (v === 'match') q2.delete('sort'); else q2.set('sort', v)
      if (nd[n]) q2.set('seat', String(nd[n].seat))
      return q2
    }, { replace: true })
  }

  const enter = () => base.enter(card)
  useExploreKeys(!base.leaving, {
    dir: (dd) => {
      if (dd === 'left') go(idx - 1, -1)
      else if (dd === 'right') go(idx + 1, 1)
      else setBack((b) => !b)
    },
    enter,
  })

  /* ---------- 끌어서 넘기기 ---------- */
  const cardEl = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; dx: number; moved: boolean } | null>(null)
  const onDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button, a')) return
    drag.current = { x: e.clientX, dx: 0, moved: false }
  }
  const onMove = (e: React.PointerEvent) => {
    const g = drag.current, el = cardEl.current
    if (!g || !el) return
    g.dx = e.clientX - g.x
    if (!g.moved && Math.abs(g.dx) < 6) return
    if (!g.moved) { g.moved = true; capture(el, e.pointerId, true) }
    el.style.transform = `translateX(${g.dx}px) rotate(${g.dx / 40}deg)`
  }
  const onUp = (e: React.PointerEvent) => {
    const g = drag.current, el = cardEl.current
    drag.current = null
    if (!g?.moved || !el) return
    capture(el, e.pointerId, false)
    el.style.transform = ''
    if (g.dx < -90) go(idx + 1, 1)
    else if (g.dx > 90) go(idx - 1, -1)
  }

  const myIdx = deck.findIndex((r) => r.mine)
  const upNext = deck.slice(idx + 1, idx + 5)
  const deckX = 0.455
  return (
    <main className={s.page}>
      <div className={`${rv.scene} ${c.scene}`} role="region" aria-label={`${floorLabel(floor)} 이웃 땅굴 카드`}>
        <div className={c.hills} aria-hidden />
        <ExploreTools base={base} />

        <div className={c.sorts} role="tablist" aria-label="카드 순서" style={{ left: `${deckX * 100}%` }}>
          {SORTS.map(([v, name]) => (
            <button key={v} role="tab" aria-selected={sort === v} className={sort === v ? c.sortOn : c.sort} onClick={() => setSort(v)}>{name}</button>
          ))}
        </div>

        {card ? (
          <div className={c.deck} style={{ left: `${deckX * 100}%` }}>
            <div className={c.stack} aria-hidden><i /><i /></div>
            <div ref={cardEl} key={card.seat} className={c.card} data-dir={dir} data-back={back ? '' : undefined} data-mine={card.mine ? '' : undefined}
              onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
              {back ? <CardBack r={card} onFlip={() => setBack(false)} /> : <CardFront base={base} r={card} worn={worn} regular={regulars.includes(card.user.id)} onFlip={() => setBack(true)} />}
              <div className={c.actions}>
                <button className={`btn btn-line ${c.nav}`} onClick={() => go(idx - 1, -1)} disabled={idx === 0} aria-label="이전 카드"><ChevronLeft size={18} /> 이전</button>
                <button className={`btn btn-cta ${c.enter}`} onClick={enter}>
                  {card.mine ? '내 땅굴 들어가기' : '땅굴 놀러가기'} <kbd className={c.kbd}>Enter</kbd>
                </button>
                <button className={`btn btn-line ${c.nav}`} onClick={() => go(idx + 1, 1)} disabled={idx >= deck.length - 1} aria-label="다음 카드">다음 <ChevronRight size={18} /></button>
              </div>
            </div>
            <div className={c.progress} aria-label={`${deck.length}장 중 ${idx + 1}번째`}>
              <span style={{ width: `${((idx + 1) / deck.length) * 100}%` }} />
              <em>{idx + 1} / {deck.length}</em>
            </div>
          </div>
        ) : null}
        {!card && field.residents.length > 0 && (
          <div className={c.noCards} style={{ left: `${deckX * 100}%` }}>
            <EmptyMole message={sort === 'regular' ? '이 들판에는 단골 땅굴이 없어요' : '지금 접속 중인 이웃이 없어요'}>
              <button className="btn btn-cta" onClick={() => setSort('match')}>잘 맞는 순으로 보기</button>
            </EmptyMole>
          </div>
        )}
        <EmptyField base={base} left={deckX} top="16%" />

        {/* 오른쪽: 미니맵 + 다음 차례 */}
        <div className={c.side}>
          <Minimap field={field} floor={floor} seat={card?.seat ?? 0} moving={moving} moveMs={480} selected={card?.seat ?? null}
            onGo={(n) => { const j = deck.findIndex((r) => r.seat === n); if (j >= 0) go(j); else setSort('seat', n) }}
            onLadder={() => base.setModal('floor')} className={c.mini} title={`${floorLabel(floor)} 마을 · 이 땅굴 위치`} />
          {upNext.length > 0 && (
            <section className={c.queue} aria-label="다음 차례">
              <h3 className="display">다음 차례</h3>
              <ul>
                {upNext.map((r, k) => {
                  const sh = base.shared(r)
                  return (
                    <li key={r.seat}>
                      <button onClick={() => go(idx + 1 + k, 1)}>
                        <Avatar size={30} />
                        <span><strong>{r.user.nickname}{r.user.online && <i className={c.on} aria-label="접속 중" />}</strong><small>{sh.length ? `같은 관심사 ${sh.length}개${isRare(sh[0]) ? ' · ✦ 드문 취미' : ''}` : `${r.seat}번 자리`}</small></span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}
        </div>

        <HomeButton base={base} atHome={idx === myIdx} onHome={() => go(myIdx, -1)} />
        <p className={d.keyHint} style={{ left: `${deckX * 100}%` }}>
          <kbd>←</kbd><kbd>→</kbd> 넘기기 · <kbd>↑</kbd><kbd>↓</kbd> 카드 뒤집기 (Q&amp;A) · <kbd>Enter</kbd> 놀러가기
        </p>
        <RoomModeToggle style={{ left: `${deckX * 100}%` }} />
      </div>
      <ExploreOverlays base={base} />
    </main>
  )
}

/** 카드 앞면: 방 미리보기 + 주인 + 겹치는 관심사 + 말 거는 계기 */
function CardFront({ base, r, worn, regular, onFlip }: { base: ExploreBase; r: Resident; worn: string[]; regular: boolean; onFlip: () => void }) {
  const u = r.user
  const sh = base.shared(r)
  const rare = sh.filter(isRare)
  const rest = u.interests.filter((i) => !sh.includes(i))
  const qa = u.qna?.[0]
  return (
    <div className={c.front}>
      <div className={c.peekCol}>
        <RoomPeek ownerId={r.mine ? ME_ID : u.id} interests={u.interests} worn={r.mine ? worn : u.worn} width={236} mine={r.mine} online={!r.mine && u.online} />
        <span className={c.seat}>{floorLabel(base.floor)} · {r.seat}번 자리</span>
      </div>
      <div className={c.info}>
        <div className={c.who}>
          <Avatar size={52} />
          <div>
            <h2 className="display">{r.mine ? '내 땅굴' : `${u.nickname}님의 땅굴`}</h2>
            <p>{affOf(u)}{!r.mine && u.online && <b className={c.online}>● 접속 중</b>}{regular && <b className={c.reg}>★ 단골</b>}</p>
          </div>
        </div>
        {r.mine ? (
          <p className={c.mineNote}>내 땅굴이에요. 이웃들이 이 카드를 보고 놀러 와요. 넘겨서 이웃을 만나 보세요.</p>
        ) : (
          <>
            <p className={c.label}>겹치는 관심사 <b>{sh.length}개</b>{rare.length > 0 && <span className={c.rareNote}>✦ 드문 취미 {rare.length}개</span>}</p>
            <div className={c.chips}>
              {sh.length ? sh.map((t) => (
                <span key={t} className={isRare(t) ? c.rareChip : undefined} title={`이 관심사를 고른 사람 약 ${peopleOf(t).toLocaleString()}명`}>
                  <InterestChip label={t} shared />
                </span>
              )) : <span className={c.none}>아직 겹치는 관심사가 없어요</span>}
            </div>
          </>
        )}
        <p className={c.label}>관심 분야</p>
        <div className={c.chips}>{(r.mine ? u.interests : rest).slice(0, 5).map((t) => <InterestChip key={t} label={t} />)}{(r.mine ? u.interests : rest).length > 5 && <span className={c.more}>외 {(r.mine ? u.interests : rest).length - 5}개</span>}</div>
        {!r.mine && (
          <div className={c.starter}>
            <strong>말 거는 계기</strong>
            {rare[0] ? <p>✦ <b>{rare[0]}</b>, 나랑 같은 드문 취미예요. 고른 사람이 약 {peopleOf(rare[0]).toLocaleString()}명뿐이에요</p>
              : sh[0] ? <p><b>{sh[0]}</b> 이야기로 시작해 보세요</p>
                : qa ? <p>{qa.q.replace(/^Q\d\.\s*/, '')} → “{qa.a}”</p>
                  : <p>방명록에 인사를 남겨 보세요</p>}
          </div>
        )}
        {u.qna?.length ? <button className={c.flip} onClick={onFlip}>Q&amp;A {u.qna.length}개 보기 <kbd>↑</kbd></button> : null}
      </div>
    </div>
  )
}

/** 카드 뒷면: 자기소개 + 질문 3개와 답 */
function CardBack({ r, onFlip }: { r: Resident; onFlip: () => void }) {
  const u = r.user
  return (
    <div className={c.backSide}>
      <div className={c.who}>
        <Avatar size={44} />
        <div>
          <h2 className="display">{r.mine ? '내 땅굴' : `${u.nickname}님의 땅굴`}</h2>
          <p>{affOf(u)} · {r.seat}번 자리</p>
        </div>
      </div>
      <div className={c.intro}><strong>자기소개</strong><p>{u.intro || '아직 작성한 자기소개가 없어요.'}</p></div>
      <dl className={c.qna}>{(u.qna ?? []).slice(0, 3).map((x) => <div key={x.q}><dt>{x.q}</dt><dd>{x.a}</dd></div>)}</dl>
      <button className={c.flip} onClick={onFlip}>← 앞면으로 <kbd>↓</kbd></button>
    </div>
  )
}
