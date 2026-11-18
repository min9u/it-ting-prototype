# 게시용 페이지를 로컬에서 열어 보기 위한 감싸기 (게시할 때 붙는 <html>/<head>/<body> 와 같은 모양)
# 사용: python -I tools/room-diversity/preview.py  →  out/_preview.html (files.json 에는 안 들어감, 올리지 않음)
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out')
body = open(os.path.join(OUT, 'room-diversity.html'), encoding='utf-8').read()
head = ('<!doctype html><html lang="ko"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
        '<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}'
        'body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>')
with open(os.path.join(OUT, '_preview.html'), 'w', encoding='utf-8') as f:
    f.write(head + body + '</body></html>')
print('out/_preview.html')
