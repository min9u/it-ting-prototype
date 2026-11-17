// 그림(SVG) 확인용 한 장: 페이지와 같은 색 토큰·서체로 SVG 여러 개를 늘어놓음 (밝게 · 어둡게)
// 사용: node tools/guide-page/svg-sheet.mjs <출력.html> [--dark] [--width=736] docs/guide-diagrams/a.svg b.svg ...
//   → node tools/guide-page/shoot.mjs --url=file:///<출력.html> --out=sheet.png --full
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const argv = process.argv.slice(2)
const dark = argv.includes('--dark')
const width = +(argv.find((a) => a.startsWith('--width='))?.slice(8) ?? 736)
const [out, ...files] = argv.filter((a) => !a.startsWith('--'))
const tpl = fs.readFileSync(path.join(here, 'template.html'), 'utf8')
const style = /<style>[\s\S]*?<\/style>/.exec(tpl)[0]
const fonts = tpl.split('\n').filter((l) => l.startsWith('<link')).join('\n')
const figs = files.map((f, n) => {
  let s = fs.readFileSync(f, 'utf8').replace(/<\?xml[^>]*\?>\s*/g, '').replace(/<!--[\s\S]*?-->/g, '').trim()
  for (const [, id] of s.matchAll(/\sid="([^"]+)"/g)) s = s.split(`"${id}"`).join(`"q${n}-${id}"`).split(`#${id})`).join(`#q${n}-${id})`).split(`"#${id}"`).join(`"#q${n}-${id}"`)
  const w = +(/viewBox="[\d.\s-]+"/.exec(s)?.[0].match(/[\d.]+/g)[2] ?? 760)
  s = s.replace(/^<svg\b[^>]*>/, (t) => t.replace(/\s(width|height)="[^"]*"/g, '').replace(/^<svg/, '<svg class="dg"'))
  return `<figure class="fig"><div class="fig-frame" style="--minw:${Math.round(w * 0.8)}px">${s}</div><figcaption>${path.basename(f)}</figcaption></figure>`
})
fs.writeFileSync(out, `<!doctype html><html lang="ko"${dark ? ' data-theme="dark"' : ' data-theme="light"'}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${fonts}${style}</head>
<body><main style="max-width:${width}px;margin:0 auto;padding:16px"><div class="doc" style="max-width:none">${figs.join('\n')}</div></main></body></html>`)
console.log(out)
