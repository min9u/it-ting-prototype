'use client'

import dynamic from 'next/dynamic'
import type { ComponentType } from 'react'

/*
 * 화면 안에 끼는 실험실 조각 (docs/team-repo-migration.md "실험실: 로컬에서만", docs/nextjs-migration.md "실험실").
 * - 🧪 저사양 실험실 패널(LowLab), 목 서버 손잡이 배지(ApiKnobBadge)
 * - NEXT_PUBLIC_LABS 는 빌드 때 글자 그대로 바뀌어 들어감(next.config.ts env) → 꺼진 빌드에서는 조건이 '0' === '1' 로 정해져서
 *   번들러가 import() 를 아예 따라가지 않음 → 실험실 코드가 결과물에 없음 (scripts/check-labs-off.mjs 가 확인)
 * - 그래서 이 파일만 예외로 process.env 를 직접 읽음 (값을 다른 모듈의 상수로 받으면 번들러가 미리 정할 수 없어서 import 가 남음).
 *   그 밖의 코드는 lib/env.ts 의 ENV.labs 를 씀
 * 실험실 페이지(/lab/*, /screens, /dev/crash)는 여기 말고 src/app 의 page.lab.tsx (next.config.ts pageExtensions)
 */

const Off: ComponentType = () => null

export const LowLab: ComponentType = process.env.NEXT_PUBLIC_LABS === '1'
  ? dynamic(() => import('../components/LowLab'), { ssr: false })
  : Off

export const ApiKnobBadge: ComponentType = process.env.NEXT_PUBLIC_LABS === '1'
  ? dynamic(() => import('../components/ApiKnobBadge'), { ssr: false })
  : Off
