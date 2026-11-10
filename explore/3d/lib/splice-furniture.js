// 사용법: node explore/3d/lib/splice-furniture.js <html>  → 페이지의 가구 카탈로그를 lib/furniture.js 최신본으로
const fs = require('fs'); const f = process.argv[2]; let s = fs.readFileSync(f, 'utf8');
const lib = fs.readFileSync(__dirname + '/furniture.js', 'utf8');
const A = '/* ---------- 가구 카탈로그 ---------- */', B = '/* ---------- 가구 카탈로그 끝 ---------- */\n';
let a = s.indexOf(A), b;
if (a >= 0) { b = s.indexOf(B, a) + B.length; }
else { a = s.indexOf('/* ---------- 가구 ---------- */'); b = s.indexOf('/* ---------- 두더지 (탐색하기'); }
if (a < 0 || b < 0) { console.error('markers missing', a, b); process.exit(1); }
s = s.slice(0, a) + lib + s.slice(b);
fs.writeFileSync(f, s); console.log('ok');
