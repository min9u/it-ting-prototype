/**
 * 브라우저 알림을 처음 켤 때 서비스 워커가 활성화된 뒤에 구독을 만드는지 (PR #37 Codex 리뷰 P1).
 * register() 는 설치 중에 돌아올 수 있고, 그때 subscribe() 를 부르면 InvalidStateError
 */
import { describe, expect, it, vi } from 'vitest'
import { whenActive } from '../lib/browserPush'

class FakeWorker extends EventTarget {
  state = 'installing'
  go(s: string) { this.state = s; this.dispatchEvent(new Event('statechange')) }
}
const reg = (o: Partial<Record<'active' | 'installing' | 'waiting', unknown>>) => ({ active: null, installing: null, waiting: null, ...o }) as unknown as ServiceWorkerRegistration

describe('whenActive', () => {
  it('이미 활성이면 바로', async () => {
    const r = reg({ active: {} })
    await expect(whenActive(r)).resolves.toBe(r)
  })
  it('설치 중이면 activated 가 될 때까지 기다림', async () => {
    const w = new FakeWorker()
    const r = reg({ installing: w })
    let done = false
    const p = whenActive(r).then(() => { done = true })
    w.go('installed')
    await Promise.resolve()
    expect(done).toBe(false)
    w.go('activated')
    await p
    expect(done).toBe(true)
  })
  it('설치에 실패(redundant)하거나 너무 오래 걸리면 오류', async () => {
    const w = new FakeWorker()
    const p = whenActive(reg({ installing: w }))
    w.go('redundant')
    await expect(p).rejects.toThrow()
    vi.useFakeTimers()
    const slow = whenActive(reg({ waiting: new FakeWorker() }), 1000)
    vi.advanceTimersByTime(1000)
    await expect(slow).rejects.toThrow()
    vi.useRealTimers()
  })
})
