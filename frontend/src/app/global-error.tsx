'use client'

/**
 * 루트 레이아웃(providers 포함)까지 깨졌을 때의 마지막 그물. 스타일 · 글꼴이 없을 수 있어 글과 버튼만.
 * 문구는 components/NotFound.tsx 의 오류 화면과 같게 (스모크가 "잠시 문제가 생겼어요"로 오류 화면을 알아봄)
 */
export default function GlobalError({ error }: { error: Error & { digest?: string }; reset: () => void }) {
  if (typeof console !== 'undefined') console.error(error)
  return (
    <html lang="ko">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#fffaf5', color: '#2b1d14' }}>
        <main id="root" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', textAlign: 'center', padding: 24 }}>
          <div>
            <h1 style={{ fontSize: 24 }}>잠시 문제가 생겼어요</h1>
            <p>연결이 고르지 않거나 서버가 잠깐 쉬고 있어요. 조금 뒤에 다시 시도해 주세요.</p>
            <button type="button" onClick={() => window.location.reload()} style={{ marginTop: 16, padding: '10px 20px', borderRadius: 999, border: 0, background: '#e2733b', color: '#fff', fontSize: 15 }}>
              다시 시도
            </button>
          </div>
        </main>
      </body>
    </html>
  )
}
