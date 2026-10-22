// NX3 (11.10.2026): Funktionsliste aus dem Programm (FEATURES in EVE-Omni.html) in die Homepage schreiben – Abschnitt
// <section id="all-functions"> vor „Support“, zwischen den Markierungen <!-- FUNKTIONEN-START --> und <!-- FUNKTIONEN-ENDE -->.
// Aufruf aus dem Projektordner:  node tools/funktionsliste.js     (danach die Homepage wie gewohnt hochladen)
const fs = require("fs"), path = require("path");
const R = path.join(__dirname, ".."), html = fs.readFileSync(path.join(R, "EVE-Omni.html"), "utf8");
const i = html.indexOf("var FEATURES = ["), j = html.indexOf("];", i);
if (i < 0) throw new Error("FEATURES nicht gefunden");
const FEATURES = new Function("return " + html.slice(i + "var FEATURES = ".length, j + 1))();
const G = { "Handel": "Trading", "Besitz": "Assets", "Navigation & Intel": "Navigation & intel", "Charaktere": "Characters", "EVE-Clients": "EVE clients", "Overlays & Fenster": "Overlays & windows", "Extras": "Extras", "Daten & Konto": "Data & account" };
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const both = (en, de) => '<span data-en>' + esc(en) + '</span><span data-de>' + esc(de) + "</span>";
const groups = [];
FEATURES.forEach(f => { let g = groups.find(x => x.n === f[0]); if (!g) groups.push(g = { n: f[0], l: [] }); g.l.push(f); });
const body = groups.map(g => '      <div class="fx-col"><h3>' + both(G[g.n] || g.n, g.n) + "</h3><ul>\n" +
  g.l.map(f => "        <li>" + both(f[2], f[1]) + (f[6] ? ' <span class="fx-ov" title="Overlay">◱</span>' : "") + '<small>' + both(f[4], f[3]) + "</small></li>").join("\n") + "\n      </ul></div>").join("\n");
const sec = `<!-- FUNKTIONEN-START (erzeugt von tools/funktionsliste.js – nicht von Hand ändern) -->
<section id="all-functions">
  <div class="wrap">
    <h2>${both("All <b>functions</b>".replace(/<\/?b>/g, ""), "Alle Funktionen")}</h2>
    <p class="intro">${both(FEATURES.length + " functions – and where to find them in the app. ◱ = also available as an overlay on top of EVE.", FEATURES.length + " Funktionen – und wo du sie im Programm findest. ◱ = auch als Overlay über EVE.")}</p>
    <div class="fx-grid">
${body}
    </div>
  </div>
</section>
<!-- FUNKTIONEN-ENDE -->`;
const css = ".fx-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:22px 30px}.fx-col h3{font-size:15px;letter-spacing:.08em;text-transform:uppercase;color:var(--accent,#86d1eb);margin:0 0 8px}" +
  ".fx-col ul{list-style:none;margin:0;padding:0}.fx-col li{padding:6px 0;border-bottom:1px solid var(--line);font-size:14px}.fx-col li small{display:block;color:var(--mut);font-size:12px;margin-top:2px}.fx-ov{color:var(--accent,#86d1eb);font-size:12px}   /* Funktionsliste */";
const hp = path.join(R, "EVE-Omni-Homepage", "index.html");
let s = fs.readFileSync(hp, "utf8");
const a = s.indexOf("<!-- FUNKTIONEN-START"), b = s.indexOf("<!-- FUNKTIONEN-ENDE -->");
if (a >= 0 && b > a) s = s.slice(0, a) + sec + s.slice(b + "<!-- FUNKTIONEN-ENDE -->".length);
else { const k = s.indexOf('<section class="alt support" id="support">'); if (k < 0) throw new Error("Support-Abschnitt nicht gefunden"); s = s.slice(0, k) + sec + "\n\n" + s.slice(k); }
if (s.indexOf("/* Funktionsliste */") < 0) s = s.replace("</style>", css + "\n</style>");
fs.writeFileSync(hp, s);
console.log("Homepage: " + FEATURES.length + " Funktionen in " + groups.length + " Bereichen geschrieben");
