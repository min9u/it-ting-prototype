// 사용법: node explore/3d/lib/splice.js <html>
// 페이지 안의 두더지 코드(재료 설정 + makeMole + 움직임)를 lib/의 최신본으로 바꿔 끼움.
// 원본은 lib/mole-felt-cfg.js, lib/mole.js, lib/mole-motion.js
const fs = require('fs'); const D = __dirname + '/';
const f = process.argv[2]; let s = fs.readFileSync(f, 'utf8');
const fn = fs.readFileSync(D + 'mole.js', 'utf8'), cfg = fs.readFileSync(D + 'mole-felt-cfg.js', 'utf8'), mot = fs.readFileSync(D + 'mole-motion.js', 'utf8');
const M0 = '/* ---------- 두더지 움직임 ---------- */', M1 = '/* ---------- 두더지 움직임 끝 ---------- */\n';
// 기존 움직임 블록 지우기
{ const a = s.indexOf(M0); if (a >= 0) { const b = s.indexOf(M1, a); if (b < 0) { console.error('motion end marker missing'); process.exit(1); } s = s.slice(0, a) + s.slice(b + M1.length); } }
const CFG0 = '/* ---------- 두더지 펠트 재료 ---------- */';
let a = s.indexOf(CFG0); if (a < 0) a = s.indexOf('function makeMole() {');
const endMark = '  return mole;\n}\n'; const b = s.indexOf(endMark, s.indexOf('function makeMole() {'));
if (a < 0 || b < 0) { console.error('markers missing', a, b); process.exit(1); }
s = s.slice(0, a) + cfg + fn + mot + s.slice(b + endMark.length);
fs.writeFileSync(f, s); console.log('ok');
