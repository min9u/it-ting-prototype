import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Footer from '../../components/Footer'
import Modal from '../../components/Modal'
import MonthCalendar from '../../components/MonthCalendar'
import InterestChip from '../../components/InterestChip'
import MoleAvatar from '../../components/MoleAvatar'
import { ME_ID, USERS, categoryOf } from '../../data/mock'
import { dateParts } from '../../lib/format'
import s from './Meetups.module.css'

const TIMES = ['오전 10:00', '오전 11:00', '오후 12:00', '오후 1:00', '오후 2:00', '오후 3:00', '오후 4:00', '오후 5:00', '오후 6:00', '오후 7:00', '오후 8:00']

/**
 * 모임 만들기 408:13607 · 모임 생성 완료 팝업 408:14074
 * 2026-11-11 Figma 스크린샷 대조로 순서·배치 갱신. 데모용 쿼리: ?modal=done
 * Figma 메모: "내모임 만들기 확정 멘트 수정 필요" — 완료 팝업 문구는 아직 확정 안 됨
 */
export default function MeetupNew() {
  const [params] = useSearchParams()
  const me = USERS[ME_ID]
  const [title, setTitle] = useState('주말의 작은 독서 모임')
  const [intro, setIntro] = useState('한 주에 한 권씩. 각자 읽은 책을 들고 모입니다. 발제나 독후감은 없어요.\n처음 오시는 분은 다 못 읽고 오셔도 괜찮아요.')
  // 예시 제목이 독서 모임이라 책·글 관심사를 먼저 고름 (관심사 v2: 세부 관심사 중에서)
  const [interest, setInterest] = useState(() => me.interests.find((i) => categoryOf(i)?.id === 'book') ?? me.interests[0] ?? '')
  const [day, setDay] = useState(8)
  const [start, setStart] = useState('오후 2:00')
  const [end, setEnd] = useState('오후 4:00')
  const [mode, setMode] = useState<'오프라인' | '온라인'>('오프라인')
  const [place, setPlace] = useState('')
  const [placeDetail, setPlaceDetail] = useState('3층 세미나실')
  const [cap, setCap] = useState(6)
  const [prep, setPrep] = useState('읽고 있는 책 한 권')
  const [askMsg, setAskMsg] = useState(true)
  const [done, setDone] = useState(params.get('modal') === 'done')

  const ymd = `2026-11-${String(day).padStart(2, '0')}`
  const { w } = dateParts(ymd)
  const valid = title.trim().length > 0

  return (
    <div className={s.detailWrap}>
      <nav className={s.crumb}><Link to="/meetups">모임</Link> / <span>모임 만들기</span></nav>
      {/* 2026-11-11 Figma 408:13607: 두더지 아이콘 + 제목, 1·2 두 칸 → 3 → 4, 오른쪽 미리보기 없음 */}
      <header className={s.newHead}>
        <MoleAvatar size={64} radius={10} />
        <div>
          <h1 className={`display ${s.newTitle}`}>모임 만들기</h1>
          <p className={s.newLead}>열고 싶은 모임을 알려주세요. 만든 뒤에도 고칠 수 있어요.</p>
        </div>
      </header>

      <form className={s.newForm} onSubmit={(e) => { e.preventDefault(); if (valid) setDone(true) }}>
        <div className={s.newRow}>
          <section className={s.newBlock}>
            <h2 className={`display ${s.stepH}`}><span>1</span>몇 명과 함께할까요</h2>
            <div className="field"><span className="field-label">정원</span>
              <div className={s.stepper}>
                <button type="button" onClick={() => setCap((c) => Math.max(2, c - 1))} aria-label="정원 줄이기">−</button>
                <strong>{cap}명</strong>
                <button type="button" onClick={() => setCap((c) => Math.min(30, c + 1))} aria-label="정원 늘리기">+</button>
              </div>
              <span className="hint">나를 포함한 인원이에요. 2명부터 정할 수 있어요.</span>
            </div>
            <div className="field"><label htmlFor="pr">준비물 <span className={s.optTag}>선택</span></label><input id="pr" className={`input ${s.fill}`} value={prep} onChange={(e) => setPrep(e.target.value)} placeholder="예: 읽고 있는 책 한 권" /></div>
            <div className="field"><span className="field-label">신청할 때 메시지 받기</span>
              <div className={s.seg}>
                <button type="button" className={askMsg ? s.segOn : s.segBtn} onClick={() => setAskMsg(true)}>받을게요</button>
                <button type="button" className={!askMsg ? s.segOn : s.segBtn} onClick={() => setAskMsg(false)}>안 받을게요</button>
              </div>
              <span className="hint">신청자가 짧은 인사를 함께 보낼 수 있어요.</span>
            </div>
          </section>

          <section className={s.newBlock}>
            <h2 className={`display ${s.stepH}`}><span>2</span>언제 만나요</h2>
            <div className={s.whenCols}>
              <div className={s.calBox}>
                <p className={s.calMonth}>2026년 11월</p>
                <MonthCalendar year={2026} month={11} selected={day} onSelect={setDay} minDay={3} />
              </div>
              <div className={s.whenSide}>
                <div className="field"><span className="field-label">고른 날짜</span><strong className={`display ${s.pickedDay}`}>11월 {day}일 {w}요일</strong></div>
                <div className="field"><label htmlFor="st">시작 시간</label><select id="st" className={`input ${s.fill}`} value={start} onChange={(e) => setStart(e.target.value)}>{TIMES.map((t) => <option key={t}>{t}</option>)}</select></div>
                <div className="field"><label htmlFor="et">끝나는 시간 <span className={s.optTag}>선택</span></label><select id="et" className={`input ${s.fill}`} value={end} onChange={(e) => setEnd(e.target.value)}><option value="">정하지 않음</option>{TIMES.map((t) => <option key={t}>{t}</option>)}</select>
                  <span className="hint">비워두면 시작 시간만 보여요.</span></div>
              </div>
            </div>
          </section>
        </div>

        <section className={s.newBlock}>
          <h2 className={`display ${s.stepH}`}><span>3</span>어디서 만나요</h2>
          <div className="field"><span className="field-label">만나는 방식</span>
            <div className={s.seg}>{(['오프라인', '온라인'] as const).map((x) => <button type="button" key={x} className={mode === x ? s.segOn : s.segBtn} onClick={() => setMode(x)}>{x}</button>)}</div>
            <span className="hint">온라인을 고르면 주소 대신 접속 링크를 받아요.</span>
          </div>
          <div className="field"><label htmlFor="pl">{mode === '온라인' ? '접속 링크' : '장소'}</label>
            <div className={s.placeBox}>
              <input id="pl" value={place} onChange={(e) => setPlace(e.target.value)} placeholder={mode === '온라인' ? '디스코드, 줌 링크 등' : '주소를 직접 입력하거나 주소 찾기를 눌러 주세요'} />
              {mode === '오프라인' && <button type="button">주소 찾기</button>}
            </div>
          </div>
          {mode === '오프라인' && <div className="field"><label htmlFor="pd">상세 주소 <span className={s.optTag}>선택</span></label><input id="pd" className={`input ${s.fill}`} value={placeDetail} onChange={(e) => setPlaceDetail(e.target.value)} /></div>}
        </section>

        <section className={s.newBlock}>
          <h2 className={`display ${s.stepH}`}><span>4</span>무엇을 함께할까요</h2>
          <div className="field"><label htmlFor="t">모임 이름</label><input id="t" className={`input ${s.fill}`} value={title} maxLength={30} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="field"><label htmlFor="i">소개</label><textarea id="i" className={`textarea ${s.fill}`} value={intro} maxLength={300} onChange={(e) => setIntro(e.target.value)} placeholder="어떤 분위기의 모임인지, 처음 오는 사람이 알아야 할 게 있는지 적어주세요" /></div>
          <div className="field"><span className="field-label">대표 관심사</span>
            <div className={s.pickChips}>
              {me.interests.map((x) => (
                <button type="button" key={x} className={x === interest ? s.pickOn : s.pick} onClick={() => setInterest(x)}><InterestChip label={x} /></button>
              ))}
            </div>
            <span className="hint">내 땅굴에 둔 관심사 가구 중에서 고를 수 있어요. 고른 관심사가 모임 표지판에 붙어요.</span>
          </div>
        </section>

        <div className={s.formActions}>
          <Link to="/meetups" className="btn btn-ghost">그만두기</Link>
          <button className="btn btn-cta" disabled={!valid}>모임 만들기</button>
        </div>
      </form>
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
