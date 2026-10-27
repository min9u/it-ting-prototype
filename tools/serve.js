// 로컬 미리보기: node tools/serve.js → http://127.0.0.1:5178
// 아티팩트 파일엔 html/head/body가 없어서(게시할 때 자동으로 붙음) 여기서 감싸서 내보냄
const http=require('http'),fs=require('fs'),path=require('path');
const FILE=path.join(__dirname,'..',process.argv[2]||'itting-prototype.html'), PORT=+process.env.PORT||5178;
http.createServer((q,r)=>{
  const body='<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>'+fs.readFileSync(FILE,'utf8')+'</body></html>';
  r.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}); r.end(body);
}).listen(PORT,'127.0.0.1',()=>console.log('http://127.0.0.1:'+PORT));
