// 사용법: node explore/3d/lib/build-app.js
// explore/3d/lib의 두더지·가구 원본(JS)으로 앱용 TS 모듈을 만듦:
//   app/src/three/mole.ts       ← mole-felt-cfg.js + mole.js + mole-motion.js
//   app/src/three/furniture.ts  ← furniture.js
// 원본은 lib 쪽이라 앱 파일은 직접 고치지 말고 lib를 고친 뒤 이 스크립트를 다시 돌릴 것.
const fs = require('fs'), path = require('path');
const L = __dirname, OUT = path.join(__dirname, '../../../app/src/three');
const rd = f => fs.readFileSync(path.join(L, f), 'utf8');
const HEAD = (what) => `// @ts-nocheck — 자동 생성 파일. 직접 고치지 말 것.
// 원본: explore/3d/lib/${what} → node explore/3d/lib/build-app.js 로 다시 만듦
import * as THREE from 'three'
`;

// 두더지: 앱에서는 원본형(taper)으로 고정
let cfg = rd('mole-felt-cfg.js').replace("shape: location.hash.includes('cyl') ? 'cyl' : 'taper',", "shape: 'taper',");
if (!cfg.includes("shape: 'taper',")) { console.error('mole-felt-cfg: shape 줄을 못 찾음'); process.exit(1); }
const mole = HEAD('mole-felt-cfg.js, mole.js, mole-motion.js') +
  "import { add, clay } from './clay'\n\n" +
  "const SPH = new THREE.SphereGeometry(1, 32, 20)\n\n" +
  cfg + '\n' + rd('mole.js') + '\n' + rd('mole-motion.js') + '\n' +
  `/**
 * 계약
 *   makeMole(): THREE.Group  높이 1, 발이 원점, +Z를 바라봄. 부위는 mole.userData.parts
 *   createMoleMotion(mole, { ground, wander, clamp, speed, startRest }) → { update(dt, t), walkTo(p), setWander(o) }
 */
export { MOLE_FELT, makeMole, createMoleMotion, bindMoleKeys }
`;
fs.writeFileSync(path.join(OUT, 'mole.ts'), mole);

const fur = HEAD('furniture.js') +
  "import { add, at, box, clay, cyl, sph } from './clay'\n\n" +
  rd('furniture.js') + '\n' +
  `/** 계약: furnishRoom(root, { interests }) — interests는 분야 이름이나 '캠핑' 같은 태그. 놓인 가구 그룹 배열을 돌려줌 */
export { FURNITURE, FURNITURE_CATS, interestCats, furnishRoom }
`;
fs.writeFileSync(path.join(OUT, 'furniture.ts'), fur);
console.log('wrote', path.join(OUT, 'mole.ts'), path.join(OUT, 'furniture.ts'));
