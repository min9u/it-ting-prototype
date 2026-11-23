import { Component, createContext, type ErrorInfo, type ReactNode } from 'react'
import { isChunkLoadError } from '../lib/chunkReload'

/**
 * 3D 캔버스 에러 경계 (docs/dev-deploy-risks.md D2 · F1, docs/frontend-hardening.md "3D 에러 경계").
 * 3D 청크를 못 받거나(재배포 뒤 옛 탭), WebGL 을 못 만들거나, 장면이 그리다 던지면 **3D 자리만** 비우고 화면 나머지는 그대로.
 * 각 화면은 이미 3D 아래에 2D 대체 그림(땅굴 자리표시·찻방 2D 두더지·들판 배경)을 깔아 두었으므로 fallback 은 보통 비워 둠.
 * onError 로 화면에 알려 주면 로딩 표시를 바로 거두고 2D 그림으로 바꿀 수 있음 (RoomView).
 * 청크 문제(재배포 뒤 옛 탭): 지연 로딩 실패가 여기까지 오면 isChunkLoadError 로 가려 한 번 새로고침 (lib/chunkReload.ts).
 * 30초 안에 또 실패하면(새로고침해도 안 됨) 여기서 2D 그림 + "새 버전이 나왔어요" 버튼만 보여 주고 자동 새로고침은 하지 않음
 *
 * SceneCanvas 는 WebGL 을 못 만들면 이 경계에 알림(SceneErrorContext). 경계 밖에서 쓰면 예전처럼 콘솔에만 남김
 */
export const SceneErrorContext = createContext<((err: unknown) => void) | null>(null)

interface Props {
  children: ReactNode
  /** 실패했을 때 3D 자리에 둘 것 (보통 없음) */
  fallback?: ReactNode
  onError?: (err: unknown) => void
}

export default class SceneBoundary extends Component<Props, { error: unknown; reported: unknown }> {
  state = { error: null as unknown, reported: null as unknown }

  static getDerivedStateFromError(error: unknown) { return { error } }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.warn('[3D] 장면을 띄우지 못해 2D 그림으로 둬요', error, info.componentStack)
    this.props.onError?.(error)
  }

  /** SceneCanvas 가 렌더 밖(effect 안)에서 실패를 알릴 때 */
  private report = (err: unknown) => {
    if (this.state.reported) return
    console.warn('[3D] WebGL 장면을 만들지 못해 2D 그림으로 둬요', err)
    this.setState({ reported: err })
    this.props.onError?.(err)
  }

  render() {
    const failed = this.state.error ?? this.state.reported
    if (failed == null) return <SceneErrorContext.Provider value={this.report}>{this.props.children}</SceneErrorContext.Provider>
    return (
      <>
        {this.props.fallback ?? null}
        {isChunkLoadError(failed) && (
          <button type="button" onClick={() => window.location.reload()}
            style={{
              position: 'absolute', left: '50%', bottom: 24, transform: 'translateX(-50%)', zIndex: 20,
              padding: '9px 16px', borderRadius: 999, border: 0, cursor: 'pointer',
              font: '600 13px/1.2 var(--font-body)', background: 'var(--toast-bg)', color: 'var(--on-brown)', boxShadow: 'var(--shadow-pop)',
            }}>
            새 버전이 나왔어요 · 새로고침하면 3D 가 보여요
          </button>
        )}
      </>
    )
  }
}
