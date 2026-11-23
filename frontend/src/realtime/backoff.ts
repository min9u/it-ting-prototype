/**
 * 다시 연결 기다리는 시간: 지수 백오프 + 지터 ("full jitter").
 * attempt 번째(0부터) 실패 뒤 0 ~ min(max, base × 2^attempt) 사이에서 고르게 고름. 너무 짧지 않게 floor 를 둠.
 * 서버가 재시작하면 모든 사용자가 같은 순간에 끊김 → 지터가 없으면 같은 순간에 몰려 다시 붙어서 서버가 또 넘어짐(thundering herd)
 */
export interface BackoffOptions {
  base?: number
  max?: number
  floor?: number
  /** 시험용 난수 (0~1) */
  random?: () => number
}

export function backoffDelay(attempt: number, o: BackoffOptions = {}): number {
  const base = o.base ?? 500
  const max = o.max ?? 30_000
  const floor = o.floor ?? 300
  const rnd = o.random ?? Math.random
  const cap = Math.min(max, base * 2 ** Math.min(attempt, 16))
  return Math.max(floor, Math.round(rnd() * cap))
}
