# EE3a: Wurmloch-Daten von anoik.is (static.json) gekürzt in EVE-Omni.html einbauen (<script type="application/json" id="wh-data">).
# Bei neuen EVE-Patches neu laufen lassen:  python Programm-Quellcode/wh-daten.py   (lädt https://anoik.is/static/static.json)
import json, re, sys, urllib.request
from pathlib import Path
root = Path(__file__).resolve().parent.parent
src = sys.argv[1] if len(sys.argv) > 1 else None
d = json.load(open(src, encoding='utf-8')) if src else json.loads(urllib.request.urlopen('https://anoik.is/static/static.json').read())
PL = {'Barren': 'B', 'Temperate': 'T', 'Oceanic': 'O', 'Lava': 'L', 'Gas': 'G', 'Ice': 'I', 'Storm': 'S', 'Plasma': 'P', 'Shattered': 'X'}
ptype = {}
for tid, c in d['celestialtypes'].items():
    m = re.match(r'Planet \((\w+)\)', c['typeName'])
    if m and m.group(1) in PL: ptype[int(tid)] = PL[m.group(1)]
out = {
    'v': d['version'],
    'cls': {k: [c.get('effectPower', 0), c['title']] for k, c in d['wormholeclasses'].items()},
    'fx': d['effects'],
    # Typ: [Ziel, Lebensdauer Std., Gesamtmasse, max. Masse je Sprung, Static 0/1, Herkunft]
    'wt': {k: [w['dest'], w['lifetime'], w['total_mass'], w['max_mass_per_jump'], 1 if w['static'] else 0, ','.join(w['src'] or [])] for k, w in d['wormholes'].items()},
    'rg': d['regions'],
    # System: [ID, Klasse, Effekt, Statics, Region, Planeten (Buchstaben)]
    's': {n: [s['solarSystemID'], s['wormholeClass'], s.get('effectName') or '', ','.join(s.get('statics') or []), d['regions'].get(str(s['regionID']), ''),
              ''.join(ptype.get(c[1], '') for c in s.get('cels', []) if c[0] == 7)] for n, s in d['systems'].items()},
}
js = json.dumps(out, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
p = root / 'EVE-Omni.html'
h = open(p, encoding='utf-8', newline='').read()
tag = '<script type="application/json" id="wh-data">'
if tag in h:
    i = h.index(tag); j = h.index('</script>', i)
    h = h[:i] + tag + js + h[j:]
else:
    i = h.rindex('<script>')
    h = h[:i] + tag + js + '</script>\n' + h[i:]
open(p, 'w', encoding='utf-8', newline='').write(h)
print('wh-data', len(js) // 1024, 'KB,', len(out['s']), 'Systeme,', len(out['wt']), 'Typen')
