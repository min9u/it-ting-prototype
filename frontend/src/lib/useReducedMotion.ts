import { useSyncExternalStore } from 'react'
import { prefersReducedMotion, subscribeReducedMotion } from './a11y'

/** 움직임 줄이기(prefers-reduced-motion) 설정. 바꾸면 바로 다시 그림 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, prefersReducedMotion, () => false)
}
