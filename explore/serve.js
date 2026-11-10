// 3D 실험 미리보기 서버: node explore/serve.js [포트]  → http://127.0.0.1:5190/3d/room.html
// explore/ 아래 파일을 그대로 내보내고, .html은 아티팩트처럼 <html><body>로 감싸서 보냄
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = __dirname, PORT = +process.argv[2] || 5190;
const TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.css': 'text/css' };
http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0]);
  const f = path.join(ROOT, u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end('not found'); }
  if (f.endsWith('.html')) {
    r.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    return r.end('<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>[hidden]{display:none!important}body{margin:0}</style></head><body>' + fs.readFileSync(f, 'utf8') + '</body></html>');
  }
  r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(f).pipe(r);
}).listen(PORT, '127.0.0.1', () => console.log('http://127.0.0.1:' + PORT));
