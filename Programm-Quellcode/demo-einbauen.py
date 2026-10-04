# V1: Demo-Baustein (Programm-Quellcode/demo.js) als <script id="demo-js"> ganz vorn in EVE-Omni.html einbauen bzw. erneuern.
# Nach jeder Änderung an demo.js:  python Programm-Quellcode/demo-einbauen.py
from pathlib import Path
root = Path(__file__).resolve().parent.parent
js = open(root / 'Programm-Quellcode/demo.js', encoding='utf-8', newline='').read()
assert '</script' not in js
p = root / 'EVE-Omni.html'
h = open(p, encoding='utf-8', newline='').read()
tag = '<script id="demo-js">'
if tag in h:
    i = h.index(tag); j = h.index('</script>', i)
    h = h[:i] + tag + '\n' + js + h[j:]
else:
    i = h.index('<script>')
    h = h[:i] + tag + '\n' + js + '</script>\n' + h[i:]
open(p, 'w', encoding='utf-8', newline='').write(h)
print('demo-js', len(js) // 1024, 'KB')
