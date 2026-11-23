import { useEffect, useState } from 'react'
import { useSearchParams } from '@/lib/nav'
import Modal from '../../components/Modal'
import NotFound from '../../components/NotFound'
import { Toast } from '../../components/Feedback'
import { leaveLog, setAdmin, useAccount } from '../../data/account'
import {
  liftSuspension, questionStore, reportStore, resolveReport, sanctionStore, saveQuestion, suspend,
  type IntroQuestion, type QuestionType, type ReportItem,
} from '../../data/admin'
import { CATEGORIES } from '../../data/mock'
import { addServiceNotice, SERVICE_NOTICE_CATS, type ServiceNoticeCat } from '../../data/serviceNotices'
import s from './Admin.module.css'
import { RULES } from '../../lib/validation'

type Menu = 'questions' | 'reports' | 'users' | 'notice' | 'leave'
const MENUS: { id: Menu; title: string; sub: string }[] = [
  { id: 'questions', title: '자기소개 질문 관리', sub: '추가 · 수정, 종류 지정, 대분류 연결' },
  { id: 'reports', title: '신고 처리', sub: '신고 목록 확인, 가려진 글 복구' },
  { id: 'users', title: '사용자 조치', sub: '계정 정지 · 해제' },
  { id: 'notice', title: '공지 작성', sub: '분류 · 제목 · 본문 작성' },
  { id: 'leave', title: '탈퇴 사유 확인', sub: '탈퇴할 때 고른 사유' },
]

/**
 * 관리자 – 기능 목록 (Desktop · 저충실도) F11
 * 관리자는 일반 계정에 관리자 역할을 DB에서 직접 준 사람. 서비스 메뉴에 드러나지 않는 별도 주소(/admin)로 들어오고,
 * 역할이 없는 계정에는 없는 주소처럼 보인다(00 공통 21 화면). 프로토타입은 /admin?as=admin 으로 역할을 켬(?as=user 로 끔).
 * 세부 화면은 "추후 정한다"라 기능이 동작하는 최소 화면만 둔다. 관심사 태그 · 캠퍼스-층 목록 관리는 넣지 않음(00 공통 19: 관리 화면 없음)
 */
export default function Admin() {
  const [params, setParams] = useSearchParams()
  const acc = useAccount()
  useEffect(() => {
    const as = params.get('as')
    if (as === 'admin' || as === 'user') { setAdmin(as === 'admin'); params.delete('as'); setParams(params, { replace: true }) }
  }, [params, setParams])
  const menu = (MENUS.find((m) => m.id === params.get('m'))?.id ?? 'questions') as Menu
  if (!acc.admin && params.get('as') !== 'admin') return <NotFound />

  return (
    <div className={s.shell}>
      <nav className={s.side} aria-label="관리자 메뉴">
        <h1 className="display">디굴디굴 관리자</h1>
        {MENUS.map((m) => (
          <button key={m.id} className={menu === m.id ? s.navOn : s.nav} onClick={() => setParams({ m: m.id })}>
            <strong>{m.title}</strong><small>{m.sub}</small>
          </button>
        ))}
      </nav>
      <main className={s.main}>
        {menu === 'questions' && <Questions />}
        {menu === 'reports' && <Reports onUsers={() => setParams({ m: 'users' })} />}
        {menu === 'users' && <Users />}
        {menu === 'notice' && <NoticeWrite />}
        {menu === 'leave' && <LeaveReasons />}
      </main>
    </div>
  )
}

/** 자기소개 질문 관리: 필터(전체 / TMI / 관심사), 목록(질문 · 종류 · 연결 대분류 · 수정), 질문 추가. 숨기거나 지우지 않음 */
function Questions() {
  const { list } = questionStore.use()
  const [filter, setFilter] = useState<'전체' | QuestionType>('전체')
  const [edit, setEdit] = useState<Partial<IntroQuestion> | null>(null)
  const shown = list.filter((q) => filter === '전체' || q.type === filter)
  const interest = list.filter((q) => q.type === '관심사').length
  const pct = list.length ? Math.round((interest / list.length) * 100) : 0
  return (
    <>
      <div className={s.head}>
        <h2 className="display">자기소개 질문 관리</h2>
        <button className={s.primary} onClick={() => setEdit({ type: '관심사', text: '', category: CATEGORIES[0]?.name ?? null })}>+ 질문 추가</button>
      </div>
      <div className={s.chips}>
        {(['전체', 'TMI', '관심사'] as const).map((f) => <button key={f} className={filter === f ? s.chipOn : s.chip} onClick={() => setFilter(f)}>{f}</button>)}
        <span className={s.ratio}>관심사 {pct}% · TMI {100 - pct}% (목표 60% : 40%)</span>
      </div>
      <table className={s.table}>
        <thead><tr><th>질문</th><th>종류</th><th>연결 대분류</th><th>작업</th></tr></thead>
        <tbody>
          {shown.map((q) => (
            <tr key={q.id}><td>{q.text}</td><td>{q.type}</td><td>{q.category ?? '—'}</td><td><button className={s.link} onClick={() => setEdit(q)}>수정</button></td></tr>
          ))}
        </tbody>
      </table>
      <p className={s.caption}>저충실도 기능 목록 화면이에요. 관심사 태그 관리는 넣지 않았어요.</p>
      <Modal open={!!edit} onClose={() => setEdit(null)} width={460} labelledBy="q-title">
        {edit && (
          <form className={s.form} onSubmit={(e) => {
            e.preventDefault()
            if (!edit.text?.trim()) return
            saveQuestion({ id: edit.id, text: edit.text.trim(), type: edit.type ?? 'TMI', category: edit.type === '관심사' ? edit.category ?? null : null })
            setEdit(null)
          }}>
            <h3 id="q-title" className="display">{edit.id ? '질문 수정' : '질문 추가'}</h3>
            <label>질문 문구<input value={edit.text ?? ''} onChange={(e) => setEdit({ ...edit, text: e.target.value })} placeholder="예: 요즘 가장 자주 듣는 노래는?" /></label>
            <label>종류
              <select value={edit.type} onChange={(e) => setEdit({ ...edit, type: e.target.value as QuestionType })}>
                <option value="관심사">관심사</option><option value="TMI">TMI</option>
              </select>
            </label>
            {edit.type === '관심사' && (
              <label>연결할 관심사 대분류
                <select value={edit.category ?? ''} onChange={(e) => setEdit({ ...edit, category: e.target.value })}>
                  {CATEGORIES.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </label>
            )}
            <div className={s.formActions}>
              <button type="button" className={s.ghost} onClick={() => setEdit(null)}>취소</button>
              <button type="submit" className={s.primary} disabled={!edit.text?.trim()}>저장</button>
            </div>
          </form>
        )}
      </Modal>
    </>
  )
}

/** 신고 처리: 글 · 댓글 · 사용자 · 방명록 글 신고 목록, 처리 결과 기록, 가려진 글 · 댓글 복구, 방명록 글 삭제 */
function Reports({ onUsers }: { onUsers: () => void }) {
  const { list } = reportStore.use()
  const act = (r: ReportItem, status: ReportItem['status']) => {
    const memo = window.prompt('처리 결과 메모 (선택)', r.memo ?? '') ?? undefined
    resolveReport(r.id, status, memo)
  }
  return (
    <>
      <div className={s.head}><h2 className="display">신고 처리</h2></div>
      <table className={s.table}>
        <thead><tr><th>대상</th><th>내용</th><th>사유</th><th>신고한 사람</th><th>날짜</th><th>상태</th><th>작업</th></tr></thead>
        <tbody>
          {list.map((r) => (
            <tr key={r.id}>
              <td>{r.target}</td><td>{r.summary}</td><td>{r.reason}</td><td>{r.reporter}</td><td>{r.at}</td>
              <td><span className={r.status === '대기' ? s.badgeWait : s.badge}>{r.status}</span>{r.memo && <small className={s.memo}>{r.memo}</small>}</td>
              <td className={s.acts}>
                {r.target === '방명록 글' ? <button className={s.link} onClick={() => act(r, '삭제')}>삭제</button>
                  : r.target === '사용자' ? <button className={s.link} onClick={onUsers}>계정 조치</button>
                  : r.status === '가림' ? <button className={s.link} onClick={() => act(r, '복구')}>복구</button>
                  : <button className={s.link} onClick={() => act(r, '가림')}>가리기</button>}
                {r.status === '대기' && <button className={s.link} onClick={() => act(r, '문제 없음')}>문제 없음</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

/** 사용자 조치: 계정 정지(기간을 정해서, 예 7일) · 해제. 정지된 계정은 로그인할 때 사유와 기간을 팝업으로 본다(F2 로그인 4) */
function Users() {
  const { list } = sanctionStore.use()
  const [target, setTarget] = useState<string | null>(null)
  const [days, setDays] = useState(7)
  const [reason, setReason] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  return (
    <>
      <div className={s.head}><h2 className="display">사용자 조치</h2></div>
      <table className={s.table}>
        <thead><tr><th>닉네임</th><th>상태</th><th>사유</th><th>작업</th></tr></thead>
        <tbody>
          {list.map((u) => (
            <tr key={u.userId}>
              <td>{u.nickname}</td>
              <td>{u.until ? <span className={s.badgeWait}>{u.until}까지 정지</span> : <span className={s.badge}>정상</span>}</td>
              <td>{u.reason || '—'}</td>
              <td>{u.until
                ? <button className={s.link} onClick={() => { liftSuspension(u.userId); setToast(`${u.nickname}님의 정지를 해제했어요`) }}>정지 해제</button>
                : <button className={s.link} onClick={() => { setTarget(u.userId); setDays(7); setReason('') }}>계정 정지</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Modal open={!!target} onClose={() => setTarget(null)} width={420} labelledBy="ban-title">
        <form className={s.form} onSubmit={(e) => {
          e.preventDefault()
          if (!target || !reason.trim()) return
          const u = list.find((x) => x.userId === target)
          suspend(target, days, reason.trim()); setTarget(null); setToast(`${u?.nickname}님을 ${days}일 정지했어요`)
        }}>
          <h3 id="ban-title" className="display">계정 정지</h3>
          <label>기간
            <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
              {[1, 3, 7, 14, 30].map((d) => <option key={d} value={d}>{d}일</option>)}
            </select>
          </label>
          <label>사유 (정지된 사람이 로그인할 때 보여요)<input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="예: 반복된 홍보 글" /></label>
          <div className={s.formActions}>
            <button type="button" className={s.ghost} onClick={() => setTarget(null)}>취소</button>
            <button type="submit" className={s.primary} disabled={!reason.trim()}>정지하기</button>
          </div>
        </form>
      </Modal>
      <Toast open={!!toast} title={toast ?? ''} onClose={() => setToast(null)} />
    </>
  )
}

/** 공지 작성: 분류 · 제목 · 본문 → 설정 › 공지사항 맨 위 + "공지" 알림 */
function NoticeWrite() {
  const [cat, setCat] = useState<ServiceNoticeCat>('공지')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [toast, setToast] = useState(false)
  return (
    <>
      <div className={s.head}><h2 className="display">공지 작성</h2></div>
      <form className={`${s.form} ${s.formCard}`} onSubmit={(e) => {
        e.preventDefault()
        if (!title.trim() || !body.trim()) return
        addServiceNotice({ cat, title: title.trim(), body: body.split('\n') })
        setTitle(''); setBody(''); setToast(true)
      }}>
        <label>분류
          <select value={cat} onChange={(e) => setCat(e.target.value as ServiceNoticeCat)}>
            {SERVICE_NOTICE_CATS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label>제목<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={RULES.noticeTitle.max} /></label>
        <label>본문<textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} /></label>
        <p className={s.caption}>서비스 버전이 바뀐 소식은 “업데이트” 분류로 올려요. 올리면 모든 사용자에게 공지 알림이 가요.</p>
        <div className={s.formActions}><button type="submit" className={s.primary} disabled={!title.trim() || !body.trim()}>올리기</button></div>
      </form>
      <Toast open={toast} title="공지가 등록되었어요" desc="설정 › 공지사항에서 확인할 수 있어요" action={{ label: '공지 보기', to: '/settings/notices' }} onClose={() => setToast(false)} />
    </>
  )
}

/** 탈퇴 사유 확인: 사유별 건수 + 최근 목록 */
function LeaveReasons() {
  const { reasons } = leaveLog.use()
  const counts = reasons.reduce<Record<string, number>>((a, r) => ({ ...a, [r.reason]: (a[r.reason] ?? 0) + 1 }), {})
  return (
    <>
      <div className={s.head}><h2 className="display">탈퇴 사유 확인</h2></div>
      <table className={s.table}>
        <thead><tr><th>사유</th><th>건수</th></tr></thead>
        <tbody>{Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([r, n]) => <tr key={r}><td>{r}</td><td>{n}</td></tr>)}</tbody>
      </table>
      <p className={s.caption}>사유를 고르지 않고 탈퇴한 경우는 세지 않아요. 최근: {reasons.slice(0, 3).map((r) => `${r.at} ${r.reason}`).join(' · ') || '없음'}</p>
    </>
  )
}
