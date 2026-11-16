import { useState } from 'react'
import Modal from './Modal'

const DOCS = {
  terms: {
    title: '이용약관',
    body: ['디굴디굴은 관심사로 이웃을 만나는 커뮤니티예요.', '다른 사람을 불편하게 하는 글·대화·모임은 신고를 받아 가려지거나 이용이 제한될 수 있어요.', '(프로토타입이라 실제 약관 문구는 정해지면 넣어요.)'],
  },
  privacy: {
    title: '개인정보처리방침',
    body: ['가입할 때 받은 이메일과 프로필(닉네임 · 캠퍼스 · 기수 · 층 · 관심사)만 서비스 안에서 써요.', '실명과 사진은 받지 않아요. 탈퇴하면 계정 정보는 바로 지워져요.', '(프로토타입이라 실제 방침 문구는 정해지면 넣어요.)'],
  },
} as const

/**
 * 00 공통 3 푸터: 서비스 정보, 이용약관 · 개인정보처리방침 링크.
 * 모임 · 커뮤니티 · 알림처럼 스크롤하는 화면 맨 아래에 둔다
 */
export default function Footer() {
  const [doc, setDoc] = useState<keyof typeof DOCS | null>(null)
  return (
    <footer className="footer">
      <strong>디굴디굴</strong>
      <span>관심사로 이웃을 만나는 땅굴 커뮤니티 · 버전 1.0.0</span>
      <button type="button" onClick={() => setDoc('terms')}>이용약관</button>
      <button type="button" onClick={() => setDoc('privacy')}><b>개인정보처리방침</b></button>
      <Modal open={!!doc} onClose={() => setDoc(null)} width={440} labelledBy="footer-doc-title">
        {doc && (
          <div style={{ padding: '26px 26px 24px' }}>
            <h2 id="footer-doc-title" className="display" style={{ fontSize: 21 }}>{DOCS[doc].title}</h2>
            {DOCS[doc].body.map((p) => <p key={p} style={{ marginTop: 12, fontSize: 13, lineHeight: 1.6, color: 'var(--ink-700)' }}>{p}</p>)}
          </div>
        )}
      </Modal>
    </footer>
  )
}
