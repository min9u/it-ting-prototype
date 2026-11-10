import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Footer from '../../components/Footer'
import Modal from '../../components/Modal'
import MonthCalendar from '../../components/MonthCalendar'
import InterestChip from '../../components/InterestChip'
import { ME_ID, USERS } from '../../data/mock'
import { dateParts } from '../../lib/format'
import s from './Meetups.module.css'

const TIMES = ['오전 10:00', '오전 11:00', '오후 12:00', '오후 1:00', '오후 2:00', '오후 3:00', '오후 4:00', '오후 5:00', '오후 6:00', '오후 7:00', '오후 8:00']

/**
 * 모임 만들기 408:13607 · 모임 생성 완료 팝업 408:14074
 * 메타데이터 기반 — 스크린샷 대조 필요. 데모용 쿼리: ?modal=done
 */
export default function MeetupNew() {
  const [params] = useSearchParams()
  const me = USERS[ME_ID]
  const [title, setTitle] = useState('주말의 작은 독서 모임')
  const [intro, setIntro] = useState('')
  const [interest, setInterest] = useState('독서')
  const [day, setDay] = useState(8)
  const [start, setStart] = useState('오후 2:00')
  const [end, setEnd] = useState('오후 4:00')
  const [mode, setMode] = useState<'오프라인' | '온라인'>('오프라인')
  const [place, setPlace] = useState('성수동 어반플레이스')
  const [placeDetail, setPlaceDetail] = useState('3층')
  const [cap, setCap] = useState(6)
  const [prep, setPrep] = useState('')
  const [askMsg, setAskMsg] = useState(true)
  const [done, setDone] = useState(params.get('modal') === 'done')

  const ymd = `2026-11-${String(day).padStart(2, '0')}`
  const { w } = dateParts(ymd)
  const valid = title.trim().length > 0 && place.trim().length > 0

  return (
    <div className={s.detailWrap}>
      <nav className={s.crumb}><Link to="/meetups">모임</Link> / <span>모임 만들기</span></nav>
      <h1 className={`display ${s.newTitle}`}>모임 만들기</h1>
      <p className={s.newLead}>열고 싶은 모임을 알려주세요. 만든 뒤에도 고칠 수 있어요.</p>

      <div className={s.columns}>
        <form className={s.mainCol} onSubmit={(e) => { e.preventDefault(); if (valid) setDone(true) }}>
          <section className={s.block}>
            <h2 className={`display ${s.stepH}`}><span>1</span>무엇을 함께할까요</h2>
            <div className="field"><label htmlFor="t">모임 이름</label><input id="t" className="input" value={title} maxLength={30} onChange={(e) => setTitle(e.target.value)} /></div>
            <div className="field"><label htmlFor="i">소개</label><textarea id="i" className="textarea" value={intro} maxLength={300} onChange={(e) => setIntro(e.target.value)} placeholder="어떤 분위기의 모임인지, 처음 오는 사람이 알아야 할 게 있는지 적어주세요" /><span className="hint">{intro.length} / 300</span></div>
            <div className="field"><span className="field-label">대표 관심사</span>
              <div className={s.pickChips}>
                {me.interests.map((x) => (
                  <button type="button" key={x} className={x === interest ? s.pickOn : s.pick} onClick={() => setInterest(x)}><InterestChip label={x} /></button>
                ))}
              </div>
              <span className="hint">관심사가 같은 두더지들에게 먼저 보여요.</span>
            </div>
          </section>

          <section className={s.block}>
            <h2 className={`display ${s.stepH}`}><span>2</span>언제 만나요</h2>
            <p className={s.calMonth}>2026년 11월</p>
            <MonthCalendar year={2026} month={11} selected={day} onSelect={setDay} minDay={3} />
            <div className={s.timeRow}>
              <div className="field"><span className="field-label">고른 날짜</span><strong>11월 {day}일 {w}요일</strong></div>
              <div className="field"><label htmlFor="st">시작 시간</label><select id="st" className="input" value={start} onChange={(e) => setStart(e.target.value)}>{TIMES.map((t) => <option key={t}>{t}</option>)}</select></div>
              <div className="field"><label htmlFor="et">끝나는 시간 <span className="hint">선택</span></label><select id="et" className="input" value={end} onChange={(e) => setEnd(e.target.value)}>{TIMES.map((t) => <option key={t}>{t}</option>)}</select></div>
            </div>
          </section>

          <section className={s.block}>
            <h2 className={`display ${s.stepH}`}><span>3</span>어디서 만나요</h2>
            <div className="field"><span className="field-label">만나는 방식</span>
              <div className={s.seg}>{(['오프라인', '온라인'] as const).map((x) => <button type="button" key={x} className={mode === x ? s.segOn : s.segBtn} onClick={() => setMode(x)}>{x}</button>)}</div>
            </div>
            <div className="field"><label htmlFor="pl">장소</label>
              <div className={s.inline}><input id="pl" className="input" value={place} onChange={(e) => setPlace(e.target.value)} placeholder={mode === '온라인' ? '디스코드, 줌 링크 등' : '장소 이름'} />{mode === '오프라인' && <button type="button" className="btn btn-ghost">주소 찾기</button>}</div>
            </div>
            {mode === '오프라인' && <div className="field"><label htmlFor="pd">상세 주소</label><input id="pd" className="input" value={placeDetail} onChange={(e) => setPlaceDetail(e.target.value)} /></div>}
          </section>

          <section className={s.block}>
            <h2 className={`display ${s.stepH}`}><span>4</span>몇 명과 함께할까요</h2>
            <div className="field"><span className="field-label">정원</span>
              <div className={s.stepper}>
                <button type="button" onClick={() => setCap((c) => Math.max(2, c - 1))} aria-label="정원 줄이기">−</button>
                <strong>{cap}명</strong>
                <button type="button" onClick={() => setCap((c) => Math.min(30, c + 1))} aria-label="정원 늘리기">+</button>
              </div>
              <span className="hint">나를 포함한 인원이에요. 2–30명</span>
            </div>
            <div className="field"><label htmlFor="pr">준비물 <span className="hint">선택</span></label><input id="pr" className="input" value={prep} onChange={(e) => setPrep(e.target.value)} placeholder="예: 읽고 있는 책 한 권" /></div>
            <div className="field"><span className="field-label">신청할 때 메시지 받기</span>
              <div className={s.seg}>
                <button type="button" className={askMsg ? s.segOn : s.segBtn} onClick={() => setAskMsg(true)}>받을게요</button>
                <button type="button" className={!askMsg ? s.segOn : s.segBtn} onClick={() => setAskMsg(false)}>안 받을게요</button>
              </div>
            </div>
          </section>

          <div className={s.formActions}>
            <Link to="/meetups" className="btn btn-ghost">그만두기</Link>
            <button className="btn btn-primary" disabled={!valid}>모임 만들기</button>
          </div>
        </form>

        <aside className={s.chatCol}>
          <div className={`${s.chatPreview} ${s.previewSticky}`}>
            <h2 className="display">이렇게 보여요</h2>
            <div className={s.previewCard}>
              <InterestChip label={interest} />
              <strong className="display">{title || '모임 이름'}</strong>
              <span>11월 {day}일 ({w}) {start}{end ? ` – ${end}` : ''}</span>
              <span>{mode === '온라인' ? `온라인 · ${place}` : `${place} ${placeDetail}`.trim()}</span>
              <span>1 / {cap}명</span>
            </div>
            <p className="hint">모임 탐색과 땅굴 지도에 표지판으로 세워져요.</p>
          </div>
        </aside>
      </div>
      <Footer />

      <Modal open={done} onClose={() => setDone(false)} width={460} labelledBy="done-title">
        <div className={s.doneModal}>
          <div className={s.doneIcon} aria-hidden>🪧</div>
          <p className={s.doneSmall}>{title}</p>
          <h2 id="done-title" className="display">모임이 만들어졌어요!</h2>
          <p className={s.doneLead}>모임 탐색과 땅굴 지도에 표지판이 세워졌어요. 관심사가 같은 두더지들에게 먼저 보여요.</p>
          <ul className={s.doneInfo}>
            <li>📅 11월 {day}일 ({w}) {start} – {end}</li>
            <li>📍 {place} {placeDetail} · {mode}</li>
            <li>👥 1 / {cap}명 · 나를 포함한 인원</li>
          </ul>
          <p className={s.doneChat}>모임 채팅방이 열렸어요. 참여가 확정된 사람부터 들어와요.</p>
          <div className={s.applyActions}>
            <button className="btn btn-ghost">공유하기</button>
            <Link to="/meetups/m3" className="btn btn-primary">모임 보러 가기</Link>
          </div>
          <p className="hint" style={{ textAlign: 'center', marginTop: 10 }}>내 모임에서 언제든 수정할 수 있어요.</p>
        </div>
      </Modal>
    </div>
  )
}
