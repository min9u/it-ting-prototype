import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useBlocker, useNavigate, useParams } from 'react-router-dom'
import { ConfirmDialog } from '../../components/Feedback'
import fb from '../../components/Feedback.module.css'
import Footer from '../../components/Footer'
import InterestChip from '../../components/InterestChip'
import MeetupCard from '../../components/MeetupCard'
import Modal from '../../components/Modal'
import MonthCalendar from '../../components/MonthCalendar'
import MoleAvatar from '../../components/MoleAvatar'
import { ChevronLeft, ChevronRight } from '../../components/Icons'
import { ME_ID, USERS } from '../../data/mock'
import {
  CAMPUSES, type Draft, MY_CAMPUS, type MeetupX, PLATFORMS, canCancel, canEdit, cancelMeetup, clearDraft, confirmedOf, createMeetup,
  deadlineLabel, deleteMeetup, draftOf, findMeetup, getMeetupState, membersOf, myOf, parseHour, saveDraft, updateMeetup, useMeetups,
} from '../../data/meetupStore'
import { dateParts } from '../../lib/format'
import { TODAY_PARTS, shiftMonth } from './parts'
import s from './Meetups.module.css'
import { RULES } from '../../lib/validation'

/** 30분 간격 오전 7시 ~ 오후 11시 30분 */
const TIMES = Array.from({ length: 34 }, (_, i) => {
  const h = 7 + Math.floor(i / 2), mm = i % 2 ? '30' : '00'
  return `${h < 12 ? '오전' : '오후'} ${h % 12 === 0 ? 12 : h % 12}:${mm}`
})
const EMPTY: Draft = {
  cap: 6, prep: '', askMsg: true, ymd: '', start: '', end: '', deadline: '',
  mode: '오프라인', campus: MY_CAMPUS, place: '', placeDetail: '', platform: 'Zoom', platformEtc: '', link: '',
  title: '', intro: '', interest: '', tags: [],
}
const same = (a: Draft, b: Draft) => JSON.stringify(a) === JSON.stringify(b)
/** '오후 2:00' + '2026-11-08' → '2026-11-08T14:00' */
const toIso = (ymd: string, t: string) => { const h = parseHour(t); return `${ymd}T${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}` }

/**
 * 모임 – 만들기 (Figma 02 F7 1073:10314) · 모임 수정 · 취소 (740:5020) · 수정 · 삭제 확인 팝업 (972:10324)
 * 만들기
 *  1 정원 −/+ 2~50명, 기본 6, 주최자 포함(M2) · 준비물(선택) · 신청할 때 메시지 받기(안 받으면 상세의 "주최자에게 남길 말"을 숨김)
 *  2 날짜(오늘 이후) · 시작 시간 · 끝나는 시간(선택, 시작보다 뒤) · 모집 마감(선택, 비우면 모임 시작 때 마감)
 *  3 오프라인 = 캠퍼스(목록에서 하나, 기본 내 캠퍼스) + 장소(직접 입력 또는 주소 찾기) + 상세 주소(선택)
 *    온라인 = 플랫폼 이름(Zoom / Discord / Gather / 기타 직접 입력, 필수) + 접속 링크(선택, 확정자에게만 보임) (M16)
 *  4 모임 이름(필수) · 소개(선택) · 대표 관심사 1개(필수) + 관심사 태그 최대 3개(선택) (M15)
 *  5 미리보기 카드  6 그만두기 = 임시 저장 후 나감, 다시 들어오면 이어 씀(M3) / 모임 만들기 = 필수값을 채워야 켜짐 → 상세(주최자) + 완료 토스트(M1)
 * 수정
 *  기존 정보를 채워 엶. 시작 12시간 전까지만 수정(그 뒤엔 입력 칸이 잠기고 취소만), 모집 마감 일시는 바꿀 수 없음
 *  정원은 확정 인원(주최자 포함)보다 줄일 수 없음(빨간 안내). 확정자(주최자 제외) 0명이면 "모임 삭제하기", 1명 이상이면 "모임 취소하기"
 *  입력하던 내용이 있는데 나가면 "아직 저장되지 않았습니다"(00 공통 18)
 */
export default function MeetupNew() {
  const { id } = useParams()
  const nav = useNavigate()
  const st = useMeetups()
  const editing = id ? findMeetup(id, st) : undefined
  const me = USERS[ME_ID]
  const [initial] = useState<Draft>(() => (editing ? draftOf(editing) : getMeetupState().draft ?? EMPTY))
  const [restored] = useState(() => !editing && !!getMeetupState().draft)
  const [d, setD] = useState<Draft>(initial)
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }))
  const [ym, setYm] = useState(() => (initial.ymd ? { y: +initial.ymd.slice(0, 4), m: +initial.ymd.slice(5, 7) } : { y: TODAY_PARTS.y, m: TODAY_PARTS.m }))
  const [capWarn, setCapWarn] = useState(false)
  const [ask, setAsk] = useState<null | 'cancel' | 'delete'>(null)
  const leaving = useRef(false)
  const latest = useRef(d)
  latest.current = d

  // 만들기: 어떤 길로 나가든 입력한 내용이 있으면 임시 저장 (M3)
  useEffect(() => () => {
    if (editing || leaving.current) return
    if (!same(latest.current, EMPTY)) saveDraft(latest.current)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = !same(d, initial)
  const blocker = useBlocker(({ currentLocation, nextLocation }) => !!editing && dirty && !leaving.current && currentLocation.pathname !== nextLocation.pathname)

  if (id && !editing) return <Navigate to="/meetups" replace />
  if (editing && myOf(editing.id, st)?.st !== 'host') return <Navigate to={`/meetups/${editing.id}`} replace />

  const locked = !!editing && !canEdit(editing)
  const minCap = editing ? confirmedOf(editing, st) : 2
  const memberCount = editing ? membersOf(editing.id, st).length : 0
  const { w } = d.ymd ? dateParts(d.ymd) : { w: '' }
  const endBad = !!d.end && !!d.start && parseHour(d.end) <= parseHour(d.start)
  const dlBad = !!d.deadline && !!d.ymd && !!d.start && d.deadline >= toIso(d.ymd, d.start)
  const missing = [
    !d.title.trim() && '모임 이름', !d.interest && '대표 관심사', !d.ymd && '날짜', !d.start && '시작 시간',
    d.mode === '오프라인' && !d.place.trim() && '장소', d.mode === '온라인' && (d.platform === '기타' ? !d.platformEtc.trim() : !d.platform) && '온라인 플랫폼',
  ].filter(Boolean) as string[]
  const valid = missing.length === 0 && !endBad && !dlBad
  const minDay = ym.y === TODAY_PARTS.y && ym.m === TODAY_PARTS.m ? TODAY_PARTS.d : 1
  const pickedDay = d.ymd && d.ymd.startsWith(`${ym.y}-${String(ym.m).padStart(2, '0')}`) ? +d.ymd.slice(8) : undefined

  const preview: MeetupX = {
    id: 'preview', title: d.title || '모임 이름', interest: d.interest || '관심사', date: d.ymd || `${TODAY_PARTS.y}-11-08`, start: d.start || '오후 2:00', end: d.end,
    area: d.mode === '온라인' ? '온라인' : d.place.split(/\s+/).slice(0, 2).join(' ') || '장소', place: d.place, mode: d.mode, capacity: d.cap,
    memberIds: [ME_ID], hostId: ME_ID, intro: d.intro, closesAt: '', sign: (d.title || '모임 이름').slice(0, 8), askMsg: d.askMsg, tags: d.tags, likes: 0, seq: 0, campus: d.campus,
  }
  const previewPlace = d.mode === '온라인' ? `온라인 · ${d.platform === '기타' ? d.platformEtc || '플랫폼' : d.platform}` : `${d.campus} · ${preview.area} · 오프라인`

  const submit = () => {
    if (!valid || locked) return
    leaving.current = true
    if (editing) { updateMeetup(editing.id, d); nav(`/meetups/${editing.id}?toast=edited`) }
    else { const nid = createMeetup(d); nav(`/meetups/${nid}?toast=created`, { replace: true }) }
  }
  const quit = () => { if ((window.history.state?.idx ?? 0) > 0) nav(-1); else nav('/meetups') }

  return (
    <div className={s.detailWrap}>
      <nav className={s.crumb}><Link to="/meetups">모임</Link> / <span>{editing ? '모임 수정' : '모임 만들기'}</span></nav>
      <header className={s.newHead}>
        <MoleAvatar size={64} radius={10} />
        <div>
          <h1 className={`display ${s.newTitle}`}>{editing ? '모임 수정' : '모임 만들기'}</h1>
          <p className={s.newLead}>{editing ? '바꾼 내용은 신청자와 참여자 모두에게 알림으로 가요.' : '열고 싶은 모임을 알려주세요. 만든 뒤에도 고칠 수 있어요.'}</p>
        </div>
      </header>
      {restored && same(d, initial) && (
        <p className={s.draftBar}>임시 저장한 내용을 이어서 쓰고 있어요. <button type="button" onClick={() => { clearDraft(); setD(EMPTY) }}>새로 쓰기</button></p>
      )}
      {locked && <p className={s.lockBar}>모임 시작 12시간 전이 지나 수정할 수 없어요. 모임 취소만 할 수 있어요.</p>}

      <div className={s.newCols}>
        <form className={s.newForm} onSubmit={(e) => { e.preventDefault(); submit() }}>
          <fieldset disabled={locked} className={s.fs}>
            <section className={s.newBlock}>
              <h2 className={`display ${s.stepH}`}><span>1</span>몇 명과 함께할까요</h2>
              <div className="field"><span className="field-label">정원</span>
                <div className={s.stepper}>
                  <button type="button" onClick={() => { if (d.cap <= minCap) setCapWarn(true); else { set('cap', d.cap - 1); setCapWarn(false) } }} aria-label="정원 줄이기">−</button>
                  <strong>{d.cap}명</strong>
                  <button type="button" onClick={() => { set('cap', Math.min(50, d.cap + 1)); setCapWarn(false) }} aria-label="정원 늘리기">+</button>
                </div>
                <span className="hint">나를 포함한 인원이에요. 2명부터 50명까지 정할 수 있어요.</span>
                {editing && capWarn && <span className={s.capWarn}>ⓘ 이미 확정된 {minCap}명보다 적게 줄일 수 없어요.</span>}
              </div>
              <div className="field"><label htmlFor="pr">준비물 <span className={s.optTag}>선택</span></label><input id="pr" className={`input ${s.fill}`} value={d.prep} maxLength={RULES.meetupSupplies.max} onChange={(e) => set('prep', e.target.value)} placeholder="예: 읽고 있는 책 한 권" /></div>
              <div className="field"><span className="field-label">신청할 때 메시지 받기</span>
                <div className={s.seg}>
                  <button type="button" className={d.askMsg ? s.segOn : s.segBtn} onClick={() => set('askMsg', true)}>받을게요</button>
                  <button type="button" className={!d.askMsg ? s.segOn : s.segBtn} onClick={() => set('askMsg', false)}>안 받을게요</button>
                </div>
                <span className="hint">신청자가 짧은 인사를 함께 보낼 수 있어요.</span>
              </div>
            </section>

            <section className={s.newBlock}>
              <h2 className={`display ${s.stepH}`}><span>2</span>언제 만나요</h2>
              <div className={s.whenCols}>
                <div className={s.calBox}>
                  <div className={s.rangeHead}>
                    <strong className={s.calMonth}>{ym.y}년 {ym.m}월</strong>
                    <span>
                      <button type="button" className={s.navBtn} disabled={ym.y === TODAY_PARTS.y && ym.m <= TODAY_PARTS.m} onClick={() => setYm(shiftMonth(ym.y, ym.m, -1))} aria-label="이전 달"><ChevronLeft size={14} /></button>
                      <button type="button" className={s.navBtn} onClick={() => setYm(shiftMonth(ym.y, ym.m, 1))} aria-label="다음 달"><ChevronRight size={14} /></button>
                    </span>
                  </div>
                  <MonthCalendar year={ym.y} month={ym.m} selected={pickedDay} minDay={minDay}
                    onSelect={(day) => set('ymd', `${ym.y}-${String(ym.m).padStart(2, '0')}-${String(day).padStart(2, '0')}`)} />
                </div>
                <div className={s.whenSide}>
                  <div className="field"><span className="field-label">고른 날짜</span><strong className={`display ${s.pickedDay}`}>{d.ymd ? `${+d.ymd.slice(5, 7)}월 ${+d.ymd.slice(8)}일 ${w}요일` : '달력에서 골라 주세요'}</strong></div>
                  <div className="field"><label htmlFor="st">시작 시간</label>
                    <select id="st" className={`input ${s.fill}`} value={d.start} onChange={(e) => set('start', e.target.value)}><option value="">시작 시간을 골라 주세요</option>{TIMES.map((t) => <option key={t}>{t}</option>)}</select></div>
                  <div className="field"><label htmlFor="et">끝나는 시간 <span className={s.optTag}>선택</span></label>
                    <select id="et" className={`input ${s.fill}`} value={d.end} onChange={(e) => set('end', e.target.value)}><option value="">정하지 않음</option>{TIMES.map((t) => <option key={t}>{t}</option>)}</select>
                    {endBad ? <span className={s.capWarn}>ⓘ 끝나는 시간은 시작 시간보다 뒤여야 해요.</span> : <span className="hint">비워두면 시작 시간만 보여요.</span>}</div>
                  <div className="field"><label htmlFor="dl">모집 마감 <span className={s.optTag}>선택</span></label>
                    {editing
                      ? <><p className={s.readonly}>{d.deadline ? deadlineLabel(d.deadline) : '모임이 시작될 때 마감돼요'}</p><span className="hint">모집 마감 일시는 만들 때만 정할 수 있어요.</span></>
                      : <><input id="dl" type="datetime-local" className={`input ${s.fill}`} value={d.deadline} min={`${TODAY_PARTS.y}-${String(TODAY_PARTS.m).padStart(2, '0')}-${String(TODAY_PARTS.d).padStart(2, '0')}T12:00`} max={d.ymd && d.start ? toIso(d.ymd, d.start) : undefined} onChange={(e) => set('deadline', e.target.value)} />
                        {dlBad ? <span className={s.capWarn}>ⓘ 모집 마감은 모임 시작보다 앞이어야 해요.</span> : <span className="hint">비우면 모임 시작 때 마감돼요. 정원이 차 있는 동안에는 새 신청을 받지 않아요.</span>}</>}
                  </div>
                </div>
              </div>
            </section>

            <section className={s.newBlock}>
              <h2 className={`display ${s.stepH}`}><span>3</span>어디서 만나요</h2>
              <div className="field"><span className="field-label">만나는 방식</span>
                <div className={s.seg}>{(['오프라인', '온라인'] as const).map((x) => <button type="button" key={x} className={d.mode === x ? s.segOn : s.segBtn} onClick={() => set('mode', x)}>{x}</button>)}</div>
                <span className="hint">온라인을 고르면 주소 대신 플랫폼과 접속 링크를 받아요.</span>
              </div>
              {d.mode === '오프라인' ? <>
                <div className="field"><span className="field-label">캠퍼스</span>
                  <div className={s.seg}>{CAMPUSES.map((c) => <button type="button" key={c} className={d.campus === c ? s.segOn : s.segBtn} onClick={() => set('campus', c)}>{c}</button>)}</div>
                  <span className="hint">오프라인 모임만 골라요. 기본은 내 캠퍼스예요. 목록은 임시예요.</span>
                </div>
                <div className="field"><label htmlFor="pl">장소</label>
                  <div className={s.placeBox}>
                    <PinSvg />
                    <input id="pl" value={d.place} maxLength={RULES.meetupPlace.max} onChange={(e) => set('place', e.target.value)} placeholder="주소를 직접 입력하거나 주소 찾기를 눌러 주세요 (예: 멀티캠퍼스 역삼 앞 벤치)" />
                    <button type="button" onClick={() => set('place', '서울 강남구 테헤란로 212 멀티캠퍼스 역삼')}>주소 찾기</button>
                  </div>
                </div>
                <div className="field"><label htmlFor="pd">상세 주소 <span className={s.optTag}>선택</span></label><input id="pd" className={`input ${s.fill}`} value={d.placeDetail} maxLength={RULES.meetupPlaceDetail.max} onChange={(e) => set('placeDetail', e.target.value)} placeholder="예: 3층 세미나실" /></div>
              </> : <>
                <div className="field"><span className="field-label">플랫폼</span>
                  <div className={s.seg}>{PLATFORMS.map((p) => <button type="button" key={p} className={d.platform === p ? s.segOn : s.segBtn} onClick={() => set('platform', p)}>{p === '기타' ? '기타 직접 입력' : p}</button>)}</div>
                  {d.platform === '기타' && <input className={`input ${s.fill}`} value={d.platformEtc} maxLength={RULES.meetupPlatform.max} onChange={(e) => set('platformEtc', e.target.value)} placeholder="플랫폼 이름 (예: 왓챠 파티)" aria-label="플랫폼 이름" />}
                  <span className="hint">온라인 모임은 어느 캠퍼스를 골라도 보여요.</span>
                </div>
                <div className="field"><label htmlFor="lk">접속 링크 <span className={s.optTag}>선택</span></label><input id="lk" className={`input ${s.fill}`} value={d.link} onChange={(e) => set('link', e.target.value)} placeholder="https://" />
                  <span className="hint">링크는 참여가 확정된 사람에게만 보이고, 모임 대화방에도 안내돼요.</span></div>
              </>}
            </section>

            <section className={s.newBlock}>
              <h2 className={`display ${s.stepH}`}><span>4</span>무엇을 함께할까요</h2>
              <div className="field"><label htmlFor="t">모임 이름</label><input id="t" className={`input ${s.fill}`} value={d.title} maxLength={RULES.meetupTitle.max} onChange={(e) => set('title', e.target.value)} placeholder="예: 주말의 작은 독서 모임" /></div>
              <div className="field"><label htmlFor="i">소개 <span className={s.optTag}>선택</span></label><textarea id="i" className={`textarea ${s.fill}`} value={d.intro} maxLength={RULES.meetupIntro.max} onChange={(e) => set('intro', e.target.value)} placeholder="어떤 분위기의 모임인지, 처음 오는 사람이 알아야 할 게 있는지 적어주세요" /></div>
              <div className="field"><span className="field-label">대표 관심사</span>
                <div className={s.pickChips}>
                  {(me.interests.includes(d.interest) || !d.interest ? me.interests : [d.interest, ...me.interests]).map((x) => (
                    <button type="button" key={x} aria-pressed={x === d.interest} className={x === d.interest ? s.pickOn : s.pick} onClick={() => setD((v) => ({ ...v, interest: x, tags: v.tags.filter((t) => t !== x) }))}><InterestChip label={x === d.interest ? `✓ ${x}` : x} tone={undefined} /></button>
                  ))}
                </div>
                <span className="hint">하나를 골라요. 고른 관심사가 모임 카드 색, 표지판, 캘린더 라벨 색을 정해요.</span>
              </div>
              <div className="field"><span className="field-label">관심사 태그 <span className={s.optTag}>선택 · 최대 3개</span></span>
                <div className={s.pickChips}>
                  {me.interests.filter((x) => x !== d.interest).map((x) => {
                    const on = d.tags.includes(x)
                    return <button type="button" key={x} aria-pressed={on} disabled={!on && d.tags.length >= 3} className={on ? s.pickOn : s.pick} onClick={() => set('tags', on ? d.tags.filter((t) => t !== x) : [...d.tags, x])}><InterestChip label={x} /></button>
                  })}
                </div>
                <span className="hint">검색과 추천에 함께 쓰여요. {d.tags.length} / 3</span>
              </div>
            </section>
          </fieldset>

          <div className={s.formActions}>
            {!valid && !locked && <span className={s.missing}>{missing.length ? `${missing.join(', ')}을(를) 채우면 ${editing ? '수정할' : '만들'} 수 있어요` : '입력한 시간을 확인해 주세요'}</span>}
            {editing ? (
              memberCount > 0
                ? <button type="button" className={`btn btn-line ${s.cancelBtn}`} disabled={!canCancel(editing)} onClick={() => setAsk('cancel')}>모임 취소하기</button>
                : <button type="button" className={`btn btn-line ${s.cancelBtn}`} disabled={!canCancel(editing)} onClick={() => setAsk('delete')}>모임 삭제하기</button>
            ) : (
              <button type="button" className="btn btn-line" onClick={quit}>그만두기</button>
            )}
            <button className="btn btn-cta" disabled={!valid || locked || (!!editing && !dirty)}>{editing ? '수정 완료' : '모임 만들기'}</button>
          </div>
        </form>

        <aside className={s.previewCol}>
          <p className={s.previewLabel}>이렇게 보여요</p>
          <div className={s.previewWrap} aria-hidden>
            <MeetupCard m={preview} badge={{ label: '모집 중', tone: 'open' }} people={`${editing ? confirmedOf(editing, st) : 1} / ${d.cap}명`} place={previewPlace} />
          </div>
          <p className="hint">모임 탐색에 표지판으로 함께 올라가요.</p>
          {!editing && <p className={s.previewNote}>모임 대화방은 모임을 만들 때 함께 열리고, 참여가 확정된 사람부터 들어와요.</p>}
        </aside>
      </div>
      <Footer />

      {editing && <>
        <ConfirmDialog open={ask === 'cancel'} onClose={() => setAsk(null)} title="모임을 취소할까요?" confirmLabel="모임 취소"
          desc="신청자와 참여자 모두에게 취소 알림이 가요. 취소한 모임은 내 모임의 지난 모임에 기록으로 남고, 모임 대화방은 그대로 남아요."
          onConfirm={() => { leaving.current = true; cancelMeetup(editing.id); nav('/meetups/me?tab=past&toast=cancelled') }} />
        <ConfirmDialog open={ask === 'delete'} onClose={() => setAsk(null)} title="모임을 삭제할까요?" confirmLabel="삭제"
          desc="삭제하면 모임과 신청 내역이 사라지고 되돌릴 수 없어요."
          onConfirm={() => { leaving.current = true; const del = editing.id; nav('/meetups/me?tab=hosting&toast=deleted'); setTimeout(() => deleteMeetup(del), 0) }} />
      </>}
      {/* 00 공통 18 저장 전 취소 */}
      <Modal open={blocker.state === 'blocked'} onClose={() => blocker.reset?.()} width={400} labelledBy="unsaved-title" hideClose>
        <div className={fb.confirm}>
          <h2 id="unsaved-title" className="display">아직 저장되지 않았습니다</h2>
          <p>나가면 수정하던 내용이 사라져요.</p>
          <div className={fb.actions}>
            <button className="btn btn-line" onClick={() => blocker.reset?.()}>계속 수정</button>
            <button className="btn btn-danger" onClick={() => blocker.proceed?.()}>나가기</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

const PinSvg = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ color: 'var(--ink-500)', flex: 'none' }}><path d="M12 21s-7-6.3-7-11.5a7 7 0 0 1 14 0C19 14.7 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
