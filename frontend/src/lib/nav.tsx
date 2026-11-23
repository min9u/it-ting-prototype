'use client'

/**
 * 화면 이동 어댑터 (docs/nextjs-migration.md "라우팅").
 * Vite 앱은 react-router 를 썼다. 화면 코드를 거의 그대로 두려고 react-router 와 같은 이름 · 모양의 작은 함수들을
 * next/navigation · next/link 위에 만든다. 화면은 'react-router-dom' 대신 '@/lib/nav' 에서 가져온다.
 *
 * | react-router            | 여기                                                                    |
 * |-------------------------|-------------------------------------------------------------------------|
 * | useNavigate             | useNavigate() → nav('/x', { replace, state }) · nav(-1)                 |
 * | useParams               | useParams() (Next 의 동적 세그먼트 [id] → { id })                       |
 * | useSearchParams         | [params, setParams] (setParams 는 스크롤을 옮기지 않음, react-router 와 같음) |
 * | useLocation             | { pathname, search, hash, state }                                       |
 * | Link · NavLink          | next/link 를 감쌈 (to · replace · state · NavLink 의 isActive · end)      |
 * | Navigate                | 그려지면 바로 이동 (useEffect)                                          |
 * | Outlet                  | 레이아웃(layout.tsx)이 OutletProvider 로 넘긴 children                  |
 * | useBlocker              | 앱 안 이동(Link · navigate)과 브라우저 뒤로/앞으로를 막음 (아래 "막기")  |
 *
 * 이동 state(react-router 의 location.state): Next 는 기록(history)에 state 를 못 실어서 주소별로 기억한다
 * (메모리 + sessionStorage, 키 = 경로 + 쿼리). state 없이 같은 주소로 가면 지움. 새로고침해도 남는 것은 react-router 와 같음.
 */

import NextLink from 'next/link'
import {
  useParams as useNextParams, usePathname, useRouter, useSearchParams as useNextSearchParams,
} from 'next/navigation'
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore,
  type AnchorHTMLAttributes, type MouseEvent, type ReactNode, type Ref,
} from 'react'
import { registerNavigator } from './authFlow'

/* ===== 주소 ===== */

export type To = string | { pathname?: string; search?: string; hash?: string }
export interface NavigateOptions { replace?: boolean; state?: unknown; preventScrollReset?: boolean }
export interface Location { pathname: string; search: string; hash: string; state: unknown; key: string }

export function toHref(to: To): string {
  if (typeof to === 'string') return to
  const search = to.search ? (to.search.startsWith('?') ? to.search : `?${to.search}`) : ''
  const hash = to.hash ? (to.hash.startsWith('#') ? to.hash : `#${to.hash}`) : ''
  return `${to.pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '/')}${search}${hash}`
}

/** state 저장 키: 경로 + 정리한 쿼리 (해시 빼고). '?a=1&b=%7C' 와 '?a=1&b=|' 가 같게 */
function stateKey(href: string): string {
  const u = new URL(href, 'http://x')
  const q = new URLSearchParams(u.search).toString()
  return `${u.pathname}${q ? `?${q}` : ''}`
}

function parseLoc(href: string): Pick<Location, 'pathname' | 'search' | 'hash'> {
  const u = new URL(href, typeof window !== 'undefined' ? window.location.href : 'http://x')
  return { pathname: u.pathname, search: u.search, hash: u.hash }
}

const currentHref = () => (typeof window === 'undefined' ? '/' : `${window.location.pathname}${window.location.search}${window.location.hash}`)

/* ===== 이동 state (react-router location.state 대신) ===== */

const STATE_STORE = 'digul.navState'
let states: Map<string, unknown> | null = null
function stateMap(): Map<string, unknown> {
  if (states) return states
  states = new Map()
  try {
    const raw = typeof window !== 'undefined' ? sessionStorage.getItem(STATE_STORE) : null
    if (raw) for (const [k, v] of JSON.parse(raw) as [string, unknown][]) states.set(k, v)
  } catch { /* 저장소가 막힌 곳 */ }
  return states
}
function setNavState(href: string, state: unknown) {
  const m = stateMap()
  const k = stateKey(href)
  if (state === undefined || state === null) m.delete(k)
  else m.set(k, state)
  // 너무 쌓이지 않게 최근 30개만
  while (m.size > 30) m.delete(m.keys().next().value as string)
  try { sessionStorage.setItem(STATE_STORE, JSON.stringify([...m])) } catch { /* 저장 못 해도 이번 탭 메모리에는 있음 */ }
}
const getNavState = (href: string) => stateMap().get(stateKey(href)) ?? null

/* ===== 막기 (react-router useBlocker 대신) ===== */

type BlockArgs = { currentLocation: Location; nextLocation: Location; historyAction: 'PUSH' | 'REPLACE' | 'POP' }
type BlockerEntry = { test: (a: BlockArgs) => boolean; block: (go: () => void) => void }
const blockers = new Set<BlockerEntry>()

function locOf(href: string, state: unknown = null): Location {
  return { ...parseLoc(href), state, key: 'default' }
}

/** 막는 블로커가 있으면 그 블로커에 "나중에 갈 곳"(go)을 맡기고 true. go 는 다시 검사하지 않고 바로 이동함 */
function blocked(nextHref: string, action: BlockArgs['historyAction'], go: () => void, state?: unknown, fromHref = currentHref()): boolean {
  if (!blockers.size) return false
  const args = { currentLocation: locOf(fromHref, getNavState(fromHref)), nextLocation: locOf(nextHref, state ?? null), historyAction: action }
  for (const b of blockers) {
    if (b.test(args)) { b.block(go); return true }
  }
  return false
}

/*
 * 브라우저 뒤로/앞으로 막기: Next 의 popstate 처리기보다 먼저(capture) 받아서, 막아야 하면 Next 에 넘기지 않고
 * history.go 로 제자리로 되돌린 뒤 블로커에 "나중에 갈 곳"(같은 칸 수만큼 다시 이동)을 맡김.
 * 몇 칸 움직였는지는 Navigation API(크롬 · 엣지 102+, 사파리 26.2+, 파이어폭스 147+)의 기록 번호로 앎. 없으면 막지 않음.
 */
type NavApi = { currentEntry?: { index: number } | null; addEventListener: (t: string, f: (e: Event & { navigationType?: string }) => void) => void }
const navApi = (): NavApi | undefined => (typeof window !== 'undefined' ? (window as unknown as { navigation?: NavApi }).navigation : undefined)
let lastIndex = -1
let lastHref = '/'
let swallowPop = 0
let allowPop = false
if (typeof window !== 'undefined') {
  const commit = () => { lastIndex = navApi()?.currentEntry?.index ?? -1; lastHref = currentHref() }
  commit()
  // push · replace (앱 안 이동)는 여기서, 뒤로/앞으로(traverse)는 아래 popstate 에서 기록
  navApi()?.addEventListener('currententrychange', (e) => { if (e.navigationType !== 'traverse') commit() })
  window.addEventListener('popstate', (e) => {
    if (swallowPop) { swallowPop--; e.stopImmediatePropagation(); return } // 되돌린 이동: Next 에 안 알림
    const idx = navApi()?.currentEntry?.index
    const delta = idx != null && lastIndex >= 0 ? idx - lastIndex : 0
    if (allowPop) { allowPop = false; commit(); return }
    if (delta) {
      const go = () => { allowPop = true; window.history.go(delta) }
      if (blocked(currentHref(), 'POP', go, undefined, lastHref)) {
        e.stopImmediatePropagation()
        swallowPop++
        window.history.go(-delta)
        return
      }
    }
    commit()
  }, { capture: true })
}

export interface Blocker { state: 'unblocked' | 'blocked' | 'proceeding'; proceed?: () => void; reset?: () => void; location?: Location }

/** react-router useBlocker 와 같은 모양. shouldBlock 이 true 를 돌려주면 이동을 멈추고 state 가 'blocked' */
export function useBlocker(shouldBlock: boolean | ((a: BlockArgs) => boolean)): Blocker {
  const fn = useRef(shouldBlock)
  useEffect(() => { fn.current = shouldBlock })
  const [pending, setPending] = useState<{ go: () => void } | null>(null)
  useEffect(() => {
    const entry: BlockerEntry = {
      test: (a) => (typeof fn.current === 'function' ? fn.current(a) : fn.current),
      block: (go) => setPending({ go }),
    }
    blockers.add(entry)
    return () => { blockers.delete(entry) }
  }, [])
  return useMemo<Blocker>(() => (pending
    ? { state: 'blocked', proceed: () => { setPending(null); pending.go() }, reset: () => setPending(null) }
    : { state: 'unblocked' }), [pending])
}

/* ===== 훅 ===== */

export type NavigateFunction = (to: To | number, opts?: NavigateOptions) => void

export function useNavigate(): NavigateFunction {
  const router = useRouter()
  return useCallback((to: To | number, opts?: NavigateOptions) => {
    if (typeof to === 'number') { window.history.go(to); return }
    const href = toHref(to)
    const go = () => {
      setNavState(href, opts?.state)
      const o = { scroll: !opts?.preventScrollReset }
      if (opts?.replace) router.replace(href, o)
      else router.push(href, o)
    }
    if (blocked(href, opts?.replace ? 'REPLACE' : 'PUSH', go, opts?.state)) return
    go()
  }, [router])
}

export function useParams<T extends Record<string, string | undefined> = Record<string, string | undefined>>(): T {
  const p = useNextParams()
  return useMemo(() => {
    const out: Record<string, string | undefined> = {}
    for (const [k, v] of Object.entries(p ?? {})) out[k] = Array.isArray(v) ? v.join('/') : safeDecode(v)
    return out as T
  }, [p])
}
/** Next 의 params 는 퍼센트 인코딩이 남아 있을 수 있음 (한글 등). react-router 처럼 풀어서 줌 */
function safeDecode(v: string | undefined) {
  if (v == null) return v
  try { return decodeURIComponent(v) } catch { return v }
}

type ParamsInit = URLSearchParams | string | Record<string, string | string[]> | [string, string][]
function toParams(init: ParamsInit): URLSearchParams {
  if (init instanceof URLSearchParams) return new URLSearchParams(init)
  if (typeof init === 'string' || Array.isArray(init)) return new URLSearchParams(init)
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(init)) for (const x of Array.isArray(v) ? v : [v]) p.append(k, x)
  return p
}
export type SetURLSearchParams = (next: ParamsInit | ((prev: URLSearchParams) => ParamsInit), opts?: NavigateOptions) => void

/** react-router 처럼 [바꿀 수 있는 복사본, 바꾸는 함수]. 바꾸면 같은 경로에 새 쿼리로 이동(해시는 버림) */
export function useSearchParams(): [URLSearchParams, SetURLSearchParams] {
  const sp = useNextSearchParams()
  const nav = useNavigate()
  const str = sp?.toString() ?? ''
  const params = useMemo(() => new URLSearchParams(str), [str])
  const set = useCallback<SetURLSearchParams>((next, opts) => {
    const v = typeof next === 'function' ? next(new URLSearchParams(window.location.search)) : next
    const q = toParams(v).toString()
    nav(`${window.location.pathname}${q ? `?${q}` : ''}`, { preventScrollReset: true, ...opts })
  }, [nav])
  return [params, set]
}

function subscribeHash(cb: () => void) {
  window.addEventListener('hashchange', cb)
  window.addEventListener('popstate', cb)
  return () => { window.removeEventListener('hashchange', cb); window.removeEventListener('popstate', cb) }
}

export function useLocation(): Location {
  const pathname = usePathname() ?? '/'
  const sp = useNextSearchParams()
  const q = sp?.toString() ?? ''
  const hash = useSyncExternalStore(subscribeHash, () => window.location.hash, () => '')
  const search = q ? `?${q}` : ''
  return useMemo(() => ({ pathname, search, hash, state: getNavState(`${pathname}${search}`), key: `${pathname}${search}` }), [pathname, search, hash])
}

/* ===== 링크 ===== */

type AnchorProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>
export interface LinkProps extends AnchorProps {
  to: To
  replace?: boolean
  state?: unknown
  prefetch?: boolean
  preventScrollReset?: boolean
  ref?: Ref<HTMLAnchorElement>
}

export function Link({ to, replace, state, prefetch, preventScrollReset, onClick, ref, ...rest }: LinkProps) {
  const href = toHref(to)
  const router = useRouter()
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e)
    if (e.defaultPrevented) return
    // 새 탭 · 다운로드 등은 브라우저에 맡김
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || (rest.target && rest.target !== '_self')) return
    const go = () => {
      setNavState(href, state)
      const o = { scroll: !preventScrollReset }
      if (replace) router.replace(href, o)
      else router.push(href, o)
    }
    if (blocked(href, replace ? 'REPLACE' : 'PUSH', go, state)) { e.preventDefault(); return }
    setNavState(href, state)
  }
  return <NextLink ref={ref} href={href} replace={replace} prefetch={prefetch} scroll={!preventScrollReset} onClick={handle} {...rest} />
}

export interface NavLinkProps extends Omit<LinkProps, 'className' | 'children' | 'style'> {
  end?: boolean
  className?: string | ((s: { isActive: boolean; isPending: boolean }) => string | undefined)
  style?: React.CSSProperties | ((s: { isActive: boolean; isPending: boolean }) => React.CSSProperties | undefined)
  children?: ReactNode | ((s: { isActive: boolean; isPending: boolean }) => ReactNode)
}

/** react-router NavLink: 지금 주소가 to 이거나 그 아래면 isActive (end 면 똑같을 때만). 문자열 className 이면 'active' 를 붙임 */
export function NavLink({ to, end, className, style, children, ...rest }: NavLinkProps) {
  const pathname = usePathname() ?? '/'
  const path = parseLoc(toHref(to)).pathname
  const base = path.length > 1 ? path.replace(/\/+$/, '') : path
  const isActive = pathname === base || (!end && base !== '/' && pathname.startsWith(`${base}/`))
  const st = { isActive, isPending: false }
  const cls = typeof className === 'function' ? className(st) : [className, isActive ? 'active' : ''].filter(Boolean).join(' ') || undefined
  return (
    <Link to={to} className={cls} style={typeof style === 'function' ? style(st) : style} aria-current={isActive ? 'page' : undefined} {...rest}>
      {typeof children === 'function' ? children(st) : children}
    </Link>
  )
}

/** 그려지면 바로 이동 (react-router 와 같이 effect 에서) */
export function Navigate({ to, replace, state }: { to: To; replace?: boolean; state?: unknown }) {
  const nav = useNavigate()
  const href = toHref(to)
  useEffect(() => { nav(href, { replace, state }) }, [href]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

/* ===== 중첩 레이아웃 ===== */

const OutletCtx = createContext<ReactNode>(null)
/** layout.tsx 에서: <OutletProvider outlet={children}><Shell /></OutletProvider> → Shell 안의 <Outlet /> 자리에 children */
export function OutletProvider({ outlet, children }: { outlet: ReactNode; children: ReactNode }) {
  return <OutletCtx.Provider value={outlet}>{children}</OutletCtx.Provider>
}
export function Outlet() { return <>{useContext(OutletCtx)}</> }

/* ===== 바깥(라우터 밖 코드)에서 쓰는 이동 ===== */

/** lib/authFlow 의 navigateFn 을 Next 라우터로 이어 줌 (Providers 에서 한 번) */
export function NavBridge() {
  const nav = useNavigate()
  useEffect(() => { registerNavigator((to, o) => nav(to, o)) }, [nav])
  return null
}
