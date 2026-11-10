// npm run build:share 뒤에 실행: 아티팩트용 페이지(dist-share/share-page.html)를 만듦.
// 아티팩트는 <html>/<head>/<body>를 자동으로 붙이므로 본문만 씀. 올릴 파일 목록은 dist-share/files.json
import fs from 'node:fs'
const html = fs.readFileSync('dist-share/index.html', 'utf8')
const js = html.match(/src="\.\/(assets\/[^"]+\.js)"/)[1]
const css = html.match(/href="\.\/(assets\/[^"]+\.css)"/)[1]
fs.writeFileSync('dist-share/share-page.html', `<title>디굴디굴</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Do+Hyeon&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${css}">
<style>body{background:#f7f1e8}</style>
<div id="root"></div>
<script type="module" src="${js}"></script>
`)
fs.writeFileSync('dist-share/files.json', JSON.stringify(fs.readdirSync('dist-share/assets').map(f => 'assets/' + f)))
console.log('share-page.html:', js, css)
