/**
 * 측정용 주소 손잡이 (?maxfps=0 → fps 제한 없음, ?partial=0 → 땅굴 부분 그리기 끔 …). 주소에서 값을 읽음.
 * three.js 를 부르지 않는 작은 파일로 따로 둠: 화면 코드가 three/engine 에서 가져오면 three.js 본체(약 300KB gzip)가 첫 화면 번들에 딸려 들어옴
 */
export function testParam(name: string): string | null {
  try { return (location.search + location.hash).match(new RegExp(`[?&]${name}=(\\w+)`))?.[1] ?? null } catch { return null }
}
