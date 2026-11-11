import { useState, type ReactNode } from 'react'
import { ChevronRight } from '../../components/Icons'
import { ConfirmDialog, Toast } from '../../components/Feedback'
import s from './Settings.module.css'

/**
 * 설정 (Desktop) 554:21331 — 스크린샷 대조함 (design/figma/screens-2026-11-11/settings.png)
 * "다른 버전" 582:7997 은 스크린샷 미확인
 * 각 행의 다음 화면(비밀번호 변경·알림 설정·차단 관리·언어·공지사항)은 Figma에 없어 토스트로 안내만 한다.
 */
export default function Settings() {
  const [google, setGoogle] = useState(false)
  const [dark, setDark] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const soon = (what: string) => setToast(`${what} 화면은 아직 디자인이 없어요`)

  return (
    <main className={s.page}>
      <h1 className="page-sign">설정</h1>

      <Group title="계정">
        <Row label="비밀번호 변경" onClick={() => soon('비밀번호 변경')} />
        <div className={s.row}>
          <span className={s.label}>Google 연동하기</span>
          <span className={s.value}>{google ? '연결됨' : '연결 안 됨'}</span>
          <button className={s.linkBtn} onClick={() => setGoogle((v) => !v)}>{google ? '연동 해제' : '연동하기'}</button>
        </div>
      </Group>

      <Group title="알림 · 차단">
        <Row label="알림 설정" onClick={() => soon('알림 설정')} />
        <Row label="차단 관리" value="2명" onClick={() => soon('차단 관리')} />
      </Group>

      <Group title="앱 설정">
        <Row label="언어 설정" value="한국어" onClick={() => soon('언어 설정')} />
        <div className={s.row}>
          <span className={s.label} id="dark-label">다크 모드</span>
          <button role="switch" aria-checked={dark} aria-labelledby="dark-label" className={dark ? s.switchOn : s.switch} onClick={() => setDark((v) => !v)}>
            <span />
          </button>
        </div>
      </Group>

      <Group title="정보">
        <Row label="공지사항" onClick={() => soon('공지사항')} />
        <div className={s.row}>
          <span className={s.label}>버전 정보</span>
          <span className={s.value}>1.0.0</span>
        </div>
      </Group>

      <button className={s.leave} onClick={() => setLeaveOpen(true)}>회원 탈퇴</button>

      <ConfirmDialog open={leaveOpen} onClose={() => setLeaveOpen(false)} onConfirm={() => setToast('프로토타입이라 실제로 탈퇴되지는 않아요')}
        title="정말 탈퇴할까요?" desc="내 땅굴과 방명록, 쓴 글이 모두 사라지고 되돌릴 수 없어요." confirmLabel="탈퇴" />
      <Toast open={!!toast} title={toast ?? ''} onClose={() => setToast(null)} />
    </main>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={s.group}>
      <h2>{title}</h2>
      <div className={s.box}>{children}</div>
    </section>
  )
}

function Row({ label, value, onClick }: { label: string; value?: string; onClick: () => void }) {
  return (
    <button className={`${s.row} ${s.rowBtn}`} onClick={onClick}>
      <span className={s.label}>{label}</span>
      {value && <span className={s.value}>{value}</span>}
      <ChevronRight size={18} />
    </button>
  )
}
