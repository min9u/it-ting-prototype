/**
 * 목 모드 도우미: 저장소(data/*Store)가 바뀌면 "서버 값이 바뀐 것"으로 보고 그 영역 캐시를 새로 받음.
 * 아직 api 를 거치지 않는 화면이 저장소를 직접 바꿔도 목록·상세가 따라오게. 실제 서버로 바꾼 영역에서는 아무것도 안 함
 * (실제 모드에서는 이 역할을 실시간 소식(SSE)과 쓰기 뒤 invalidate 가 함).
 *
 * 영역 queries.ts 에서: export function useMeetupsMockSync() { useMockStoreSync('meetups', useMeetups(), meetupKeys.all) }
 * 그리고 api/mockSync.tsx 의 목록에 그 훅이 있어야 함 (새 영역 훅을 더할 때만 공통 담당이 고침)
 */
import { useEffect, useRef } from 'react'
import { useQueryClient, type QueryKey } from '@tanstack/react-query'
import { areaMode, type Area } from './config'

export function useMockStoreSync(area: Area, dep: unknown, key: QueryKey) {
  const qc = useQueryClient()
  const first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    if (areaMode(area) === 'mock') void qc.invalidateQueries({ queryKey: key })
  }, [dep]) // eslint-disable-line react-hooks/exhaustive-deps
}
