/**
 * 테스트용 메모리 라우터 (react-router 의 MemoryRouter 대신).
 * 화면 코드는 lib/nav.tsx → next/navigation 훅을 쓰는데, 그 훅들은 Next 앱 라우터가 넣어 주는 React 컨텍스트를 읽음.
 * 여기서 같은 컨텍스트를 넣어 주면 Next 없이(jsdom) 화면을 그릴 수 있음. push · replace 는 메모리 안 주소만 바꿈.
 * (JSX 대신 createElement: vitest 설정이 *.test.ts 만 읽고 이 파일도 .ts)
 */
import { createElement as h, useMemo, useState, type ReactNode } from 'react'
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { PathnameContext, PathParamsContext, SearchParamsContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime'

type Router = NonNullable<React.ContextType<typeof AppRouterContext>>

export function MemoryRouter({ initialEntries = ['/'], params = {}, children }: { initialEntries?: string[]; params?: Record<string, string>; children?: ReactNode }) {
  const [entries, setEntries] = useState(initialEntries)
  const href = entries[entries.length - 1] ?? '/'
  const url = useMemo(() => new URL(href, 'http://test'), [href])
  const router = useMemo<Router>(() => ({
    back: () => setEntries((e) => (e.length > 1 ? e.slice(0, -1) : e)),
    forward: () => {},
    refresh: () => {},
    hmrRefresh: () => {},
    prefetch: () => {},
    push: (to: string) => setEntries((e) => [...e, to]),
    replace: (to: string) => setEntries((e) => [...e.slice(0, -1), to]),
  } as unknown as Router), [])
  const search = useMemo(() => new URLSearchParams(url.search), [url])
  return h(AppRouterContext.Provider, { value: router },
    h(PathnameContext.Provider, { value: url.pathname },
      h(SearchParamsContext.Provider, { value: search },
        h(PathParamsContext.Provider, { value: params }, children))))
}
