/* ---------- 두더지 펠트 재료 ---------- */
// 섬유 노멀맵: 짧은 털 가닥을 높이맵으로 그린 뒤 기울기로 노멀을 만듦
function feltNormalTex(size = 512, strands = 9000, rep = [6, 3]) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
  g.fillStyle = 'rgb(128,128,128)'; g.fillRect(0, 0, size, size);
  g.lineCap = 'round';
  for (let i = 0; i < strands; i++) {
    const x = Math.random() * size, y = Math.random() * size, a = Math.random() * Math.PI * 2, l = 2 + Math.random() * 6, v = Math.random() < .5 ? 175 : 85;
    g.strokeStyle = `rgba(${v},${v},${v},.55)`; g.lineWidth = .6 + Math.random() * .8;
    for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) { g.beginPath(); g.moveTo(x + ox, y + oy); g.lineTo(x + ox + Math.cos(a) * l, y + oy + Math.sin(a) * l); g.stroke(); }
  }
  const src = g.getImageData(0, 0, size, size).data, out = g.createImageData(size, size), h = (x, y) => src[(((y + size) % size) * size + ((x + size) % size)) * 4] / 255;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (h(x + 1, y) - h(x - 1, y)) * 2.0, dy = (h(x, y + 1) - h(x, y - 1)) * 2.0, l = Math.hypot(dx, dy, 1), i = (y * size + x) * 4;
    out.data[i] = (-dx / l * .5 + .5) * 255; out.data[i + 1] = (dy / l * .5 + .5) * 255; out.data[i + 2] = (1 / l * .5 + .5) * 255; out.data[i + 3] = 255;
  }
  g.putImageData(out, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); t.anisotropy = 8; return t;
}
// 잔털 알파맵: 픽셀마다 무작위 값. 껍질마다 alphaTest를 올려 바깥일수록 털이 드문드문
function fuzzAlphaTex(size = 512, rep = [10, 5]) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'), d = g.createImageData(size, size);
  for (let i = 0; i < d.data.length; i += 4) { const v = Math.pow(Math.random(), 1.4) * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
  g.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); t.magFilter = THREE.NearestFilter; return t;
}
const MOLE_FELT = {
  shape: location.hash.includes('cyl') ? 'cyl' : 'taper', // 'taper' = 원본형(위로 좁아짐), 'cyl' = 이전 원통형
  body: '#977f72', nose: '#f39e96', tip: '#e9787c', paw: '#f2aaa4', foot: '#ebd2c9',
  sheen: 1, nScale: .45, shells: 12, fuzz: .014, tipLight: .18,
  cheekY: .655, cheekPhi: .6, cheekR: 32, cheekA: .5,
};
MOLE_FELT.normal = feltNormalTex();
MOLE_FELT.fuzzTex = fuzzAlphaTex();

