/* EVE Omni – Plugin für Stream-Tasten (MiraBox Stream Dock, später Elgato Stream Deck).
   Spricht mit der Tasten-Software über deren WebSocket (connectElgatoStreamDeckSocket) und mit EVE Omni über
   http://127.0.0.1:<Port> (Event-Stream /events für den Zustand, POST /cmd für Befehle). Tastenbilder zeichnet es selbst. */
(function(){
  "use strict";
  var CFG = window.EVEOMNI || { port: 51780, key: "" }, BASE = "http://127.0.0.1:" + CFG.port, Q = "?k=" + encodeURIComponent(CFG.key);
  var sock = null, keys = {}, st = null, online = false, es = null, tick = 0;
  var VIEWS = {}, ACTS = {}, SHOWS = {};
  EO.VIEWS.forEach(function(v){ VIEWS[v[0]] = v[1].replace(" & Timer", "").replace(" Report", ""); });
  EO.ACTS.forEach(function(a){ ACTS[a[0]] = { t: a[1], ic: a[2], c: a[3] }; });
  EO.SHOWS.forEach(function(a){ SHOWS[a[0]] = { t: a[1], ic: a[2], ov: a[3] }; });
  var SHORT = { all: "Alle Overlays", ct: "Durchklicken", main: "Hauptfenster", local: "Local prüfen", dscan: "D-Scan", radar: "Radar scannen", refresh: "Aktualisieren", route: "Route → EVE",
    appraisal: "Wertschätzer", dt: "DT-Alarm", jbNext: "Weiter", jbPrev: "Zurück" };
  var C = { bg: "#0d141c", bg2: "#172838", gold: "#e0b45d", cyan: "#86d1eb", red: "#ff5a52", grey: "#5c6670", text: "#e8eef4", muted: "#8fa0b0" };

  // ---------- EVE Omni ----------
  function eveConnect(){
    if (es) try{ es.close(); }catch(e){}
    es = new EventSource(BASE + "/events" + Q);
    es.onmessage = function(ev){ var n; try{ n = JSON.parse(ev.data); }catch(e){ return; } if (!n.ic && st && st.ic) n.ic = st.ic; holdApply(n); st = n; online = true; drawAll(); };   // Symbole kommen nur einmal
    es.onopen = function(){ perfTell(true); };
    es.onerror = function(){ if (online){ online = false; drawAll(); } };   // EventSource verbindet sich selbst neu
  }
  // 4.0.30: nach dem Drehen den eigenen Wert kurz halten – sonst setzt ein Zustand, der noch vor dem Befehl gebaut wurde, die Anzeige zurück (Knopf „springt“)
var hold = {};
function holdApply(n){ var now = Date.now(); if (hold.vol && hold.vol.until > now && n.jb) n.jb.vol = hold.vol.v; if (hold.a && hold.a.until > now) n.aAll = hold.a.v; }
function cmd(a){ return fetch(BASE + "/cmd" + Q, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(a) }).then(function(r){ if (!r.ok) throw new Error(r.status); }); }

  // ---------- Zeichnen (144×144, die Software verkleinert passend) ----------
  function fmtDur(ms){ if (ms <= 0) return "jetzt"; var s = Math.ceil(ms / 1000), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), p = function(n){ return (n < 10 ? "0" : "") + n; };
    return d ? d + "T " + h + "h" : h ? h + ":" + p(m) + ":" + p(s % 60) : m + ":" + p(s % 60); }
  function fmtClock(ms, eve){ var d = new Date(ms), h = eve ? d.getUTCHours() : d.getHours(), m = eve ? d.getUTCMinutes() : d.getMinutes(); return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m; }
  function canvas(frame){
    var c = document.createElement("canvas"); c.width = c.height = 144; var g = c.getContext("2d");
    var gr = g.createRadialGradient(72, 72, 10, 72, 72, 100); gr.addColorStop(0, C.bg2); gr.addColorStop(1, C.bg); g.fillStyle = gr; g.fillRect(0, 0, 144, 144);
    if (frame){ g.strokeStyle = frame; g.lineWidth = 6; g.strokeRect(3, 3, 138, 138); }
    return { c: c, g: g };
  }
  function text(g, t, y, size, col, bold, fit){ g.fillStyle = col || C.text; g.textAlign = "center"; g.textBaseline = "middle";
    var f = function(){ g.font = (bold ? "bold " : "") + size + "px Segoe UI, Arial, sans-serif"; }; f();
    var s = String(t); if (fit) while (g.measureText(s).width > 132 && size > 14){ size -= 2; f(); }   // SD-C: Zahl lieber kleiner als abgeschnitten
    while (g.measureText(s).width > 132 && s.length > 2) s = s.slice(0, -2) + "…"; g.fillText(s, 72, y); }
  function icon(g, kind, col){   // einfache Linien-Symbole im Neocom-Stil
    g.save(); g.strokeStyle = col || C.gold; g.lineWidth = 5; g.lineCap = g.lineJoin = "round"; g.translate(72, 50); g.beginPath();
    if (kind === "overlay"){ g.rect(-26, -20, 52, 38); g.moveTo(-26, -8); g.lineTo(26, -8); }
    else if (kind === "timer"){ g.arc(0, 4, 22, 0, Math.PI * 2); g.moveTo(0, 4); g.lineTo(0, -10); g.moveTo(0, 4); g.lineTo(10, 10); g.moveTo(-8, -26); g.lineTo(8, -26); }
    else if (kind === "jukebox"){ g.moveTo(-10, 18); g.lineTo(-10, -20); g.lineTo(20, -26); g.lineTo(20, 12); g.stroke(); g.beginPath(); g.arc(-16, 18, 7, 0, Math.PI * 2); g.moveTo(21, 12); g.arc(14, 12, 7, 0, Math.PI * 2); }
    else if (kind === "clock"){ g.arc(0, 0, 24, 0, Math.PI * 2); g.moveTo(0, 0); g.lineTo(0, -15); g.moveTo(0, 0); g.lineTo(12, 6); }
    g.stroke(); g.restore();
  }
  var imgs = {};   // EVE-Omni-Symbole: Schlüssel Ansicht|Farbe → Image (lädt einmal, danach neu zeichnen)
  function eveIcon(view){
    var svg = st && st.ic && st.ic[view]; if (!svg) return null;
    var k = view + "|" + st.icc, im = imgs[k];
    if (!im){ im = imgs[k] = new Image(); im.onload = function(){ im.ok = true; drawAll(); }; im.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg); }
    return im.ok ? im : null;
  }
  function tile(view, on, fallback){   // Kachel wie im Neocom: Symbol oben, darunter Text; offen = Rahmen in der Symbolfarbe
    var x = canvas(), g = x.g, im = eveIcon(view), col = (st && st.icc) || C.gold;
    g.fillStyle = "#000"; g.fillRect(0, 0, 144, 144);
    if (im) g.drawImage(im, 26, 2, 92, 92); else icon(g, fallback, col);
    if (on){ g.save(); g.strokeStyle = col; g.shadowColor = col; g.shadowBlur = 12; g.lineWidth = 5; roundRect(g, 3, 3, 138, 138, 18); g.stroke(); g.restore(); }
    return x;
  }
  function roundRect(g, x, y, w, h, r){ g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function isk(v){ v = Number(v) || 0; var a = Math.abs(v); return a >= 1e12 ? (v / 1e12).toFixed(2) + " Bio." : a >= 1e9 ? (v / 1e9).toFixed(2) + " Mrd." : a >= 1e6 ? (v / 1e6).toFixed(1) + " Mio." : a >= 1e3 ? Math.round(v / 1e3) + " Tsd." : String(Math.round(v)); }
  function grp(n){ return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, "."); }
  function charName(id){ var c = ((st.x || {}).chars || []).filter(function(c){ return c.id === id; })[0]; return c ? c.n : "Charakter"; }
  // SD-C: Wert einer Anzeige → { v: groß, sub: klein, hot: rot, warn: gelb, blink }
  function showVal(id, s, now){
    var x = st.x || {}, ch = s.char || "", L = st.pf || {}, a;
    if (id === "dt") return { v: fmtDur(st.dt - now), sub: "Downtime" + (st.dtOn ? " · Alarm an" : ""), hot: st.dt - now < 15 * 60000 };
    if (id === "tm") return st.tm ? { v: fmtDur(st.tm.at - now), sub: st.tm.n, hot: st.tm.at - now < 60000 } : { v: "–", sub: "kein Timer" };
    if (id === "moon") return x.moon ? { v: fmtDur(x.moon.at - now), sub: x.moon.n, warn: x.moon.at - now < 3600e3 } : { v: "–", sub: "kein Mond-Brocken" };
    if (id === "ob") return { v: String(x.ob || 0), sub: x.ob ? "überboten" : "nicht überboten", hot: x.ob > 0, blink: x.ob > 0 };
    if (id === "act"){ a = x.act || { t: 0, l: 0 }; return { v: a.t + " / " + a.l, sub: "Trades / Läufe" }; }
    if (id === "wal") return x.wal ? { v: isk(ch ? x.wal.by[ch] : x.wal.all), sub: ch ? charName(ch) : "Wallet gesamt" } : { v: "–", sub: "Wallet einmal laden" };
    if (id === "mine") return x.mine ? { v: isk(ch ? x.mine.by[ch] : x.mine.all), sub: (ch ? charName(ch) + " · " : "") + "Mining heute" } : { v: "–", sub: "Mining heute" };
    if (id === "al"){ a = (x.al || []).filter(function(e){ return !ch || e.who.indexOf(charName(ch)) >= 0; })[0];
      return a ? { v: a.d + (a.d === 1 ? " Sprung" : " Spr."), sub: a.s, hot: true, blink: a.d <= 2 } : { v: "ruhig", sub: "kein Alert" }; }
    if (id === "loc") return x.loc ? { v: String(x.loc.red), sub: "rot · " + x.loc.n + " in Local", hot: x.loc.red > 0 } : { v: "–", sub: "Local nicht geprüft" };
    if (id === "sk"){ var l = (x.sk || []).filter(function(c){ return !ch || c.id === ch; }).sort(function(p, q){ return (p.al === "red" ? 0 : p.end || 1) - (q.al === "red" ? 0 : q.end || 1); }); a = l[0];
      return a ? { v: a.al === "red" || !a.end ? "leer" : fmtDur(a.end - now), sub: a.n, hot: a.al === "red", warn: a.al === "yellow" } : { v: "–", sub: "keine Charaktere" }; }
    var tC = function(t){ return t == null ? "" : " · " + t + " °C"; };
    if (id === "pfCpu") return { v: L.cpu == null ? "–" : L.cpu + " %", sub: "CPU" + tC(L.cpuTemp), hot: L.cpu >= 85 || L.cpuTemp >= 85, warn: L.cpuTemp >= 75 };
    if (id === "pfRam") return { v: L.ram == null ? "–" : L.ram + " %", sub: "RAM", hot: L.ram >= 85 };
    if (id === "pfGpu") return { v: L.gpu == null ? "–" : L.gpu + " %", sub: "GPU" + tC(L.gpuTemp), hot: L.gpu >= 85 || L.gpuTemp >= 85, warn: L.gpuTemp >= 75 };
    if (id === "pfPing") return { v: L.ping == null ? "–" : L.ping + " ms", sub: "Ping", warn: L.ping > 250 };
    if (id === "pfSrv") return L.srv ? { v: grp(L.srv.pl), sub: "Tranquility · " + (L.srv.vip ? "nur VIP" : "online"), warn: L.srv.vip } : { v: "–", sub: L.srvErr ? "Server nicht erreichbar" : "Server", hot: !!L.srvErr };
    return { v: "?", sub: id };
  }
  function display(s, now){
    var sh = SHOWS[s.show] || SHOWS.dt, r = showVal(SHOWS[s.show] ? s.show : "dt", s, now), x = canvas(), g = x.g, im = eveIcon(sh.ic);
    var fc = r.hot ? C.red : r.warn ? "#f0b030" : null;
    g.fillStyle = "#000"; g.fillRect(0, 0, 144, 144);
    if (im) g.drawImage(im, 48, 4, 48, 48);
    if (fc && !(r.blink && tick % 2)){ g.save(); g.strokeStyle = fc; g.shadowColor = fc; g.shadowBlur = 10; g.lineWidth = 5; roundRect(g, 3, 3, 138, 138, 18); g.stroke(); g.restore(); }
    text(g, r.v, 80, 34, fc || C.text, true, true); text(g, r.sub, 118, 15, C.muted);
    return x.c;
  }
  function action(s){   // SD-C: Aktion mit Symbol, Name und kurzer Rückmeldung
    var id = s.act, A = ACTS[id] || {}, on = false, sub = "drücken", x = st.x || {};
    if (id === "ct"){ on = !!st.ct; sub = on ? "an" : "aus"; }
    else if (id === "dt"){ on = !!st.dtOn; sub = on ? "Alarm an" : "Alarm aus"; }
    else if (id === "refresh"){ on = x.ob > 0; sub = on ? x.ob + " überboten" : "nichts überboten"; }   // Kombi: zeigt überbotene
    else if (id === "local" && x.loc){ on = x.loc.red > 0; sub = x.loc.red + " rot"; }
    else if (id === "jbNext" || id === "jbPrev") sub = (st.jb || {}).t || "";
    var y = tile(A.ic || "trades", on, "overlay"), warn = on && (id === "refresh" || id === "local");
    text(y.g, SHORT[id] || A.t || id, 110, 19, C.text, true); text(y.g, sub, 131, 14, warn ? C.red : on ? st.icc || C.cyan : C.muted); return y.c;
  }
  function offline(kind, label){ var k = canvas(); icon(k.g, kind, C.grey); text(k.g, label, 100, 20, C.muted, true); text(k.g, "EVE Omni offline", 124, 15, C.grey); return k.c; }
  function render(k){
    var s = k.settings || {}, now = Date.now(), a = k.kind, v;
    if (a === "action") a = !s.act || s.act === "ov" ? "overlay" : s.act === "timer" ? "timer" : s.act === "jbToggle" ? "jukebox" : "action";   // SD-C: gleiche Bilder wie die einzelnen Tasten
    else if (a === "display") a = s.show === "clock" ? "clock" : s.show === "jb" ? "jukebox" : "display";
    if (!online || !st) return offline(a === "action" ? "overlay" : a === "display" ? "clock" : a, a === "overlay" ? VIEWS[s.view || "trades"] || "Overlay" : a === "timer" ? (s.min || 5) + " Min." : a === "jukebox" ? "Jukebox" :
      a === "action" ? SHORT[s.act] || "Aktion" : a === "display" ? (SHOWS[s.show] || SHOWS.dt).t : "Uhr");
    if (a === "action") return action(s);
    if (a === "display") return display(s, now);
    if (a === "overlay"){
      var id = s.view || "trades", on = !!(st.ov && st.ov[id]), x = tile(id, on, "overlay");
      text(x.g, VIEWS[id] || id, 110, 21, C.text, true); text(x.g, on ? "offen" : "zu", 131, 15, on ? st.icc || C.cyan : C.muted); return x.c;
    }
    if (a === "timer"){
      var t = st.own, run = t && t.at > now, y = tile("uhr", run, "timer");
      if (run){ text(y.g, fmtDur(t.at - now), 110, 26, t.at - now < 60000 ? C.red : C.text, true); text(y.g, t.n, 132, 13, C.muted); }
      else { text(y.g, (s.min || 5) + " Min.", 110, 24, C.text, true); text(y.g, "drücken = starten", 132, 13, C.muted); }
      return y.c;
    }
    if (a === "jukebox"){
      var j = st.jb || {}, z = tile("musik", j.p, "jukebox"), title = j.t || "keine Musik";
      if (title.length > 12 && j.p){ v = title + "   ·   "; var off = (tick % v.length); title = (v + v).slice(off, off + 14); }   // Laufschrift
      text(z.g, title, 110, 17, C.text, true); text(z.g, j.p ? "läuft" : "Pause", 131, 14, j.p ? st.icc || C.cyan : C.muted); return z.c;
    }
    var w = canvas(), g = w.g, own = st.own && st.own.at > now ? st.own : null, hot = own ? own.at - now < 60000 : st.dt - now < 15 * 60000, col = st.icc || C.gold;
    g.fillStyle = "#000"; g.fillRect(0, 0, 144, 144); g.save(); g.strokeStyle = hot ? C.red : col; g.globalAlpha = hot ? 1 : .55; g.lineWidth = 3; roundRect(g, 3, 3, 138, 138, 18); g.stroke(); g.restore();
    if (st.clock === "both"){ text(g, fmtClock(now, false), 30, 30, C.text, true); text(g, "EVE " + fmtClock(now, true), 58, 14, C.muted); }   // wie im Neocom: groß Ortszeit, klein EVE-Zeit
    else { text(g, fmtClock(now, st.clock !== "local"), 36, 36, C.text, true); text(g, st.clock !== "local" ? "EVE-Zeit" : "Ortszeit", 64, 14, C.muted); }
    if (own){ text(g, fmtDur(own.at - now), 96, 24, hot ? C.red : col, true); text(g, own.n, 122, 13, C.muted); }
    else { text(g, "DT " + fmtDur(st.dt - now), 96, 22, hot ? C.red : col, true); text(g, st.dtOn ? "Downtime-Alarm an" : "Downtime-Alarm aus", 122, 12, C.muted); }
    return w.c;
  }
  function draw(ctx){ var k = keys[ctx]; if (!k || !sock) return; if (isDial(k)) return drawStrip(ctx); var url = render(k).toDataURL("image/png"); if (url === k.last) return; k.last = url;
    sock.send(JSON.stringify({ event: "setImage", context: ctx, payload: { image: url, target: 0 } })); }
  // 4.0.32: beim Drehen nur die Drehknopf-Streifen zeichnen (die N4 überträgt Bilder nacheinander – andere Tasten würden den Streifen ausbremsen)
  var turning = 0, stripT = 0;
  function drawAll(){ var dialOnly = Date.now() - turning < 700; Object.keys(keys).forEach(function(c){ if (!dialOnly || isDial(keys[c])) draw(c); }); }
  function drawSoon(){ if (!stripT) stripT = setTimeout(function(){ stripT = 0; drawAll(); }, 60); }   // höchstens alle 60 ms ein neues Streifenbild
  setInterval(function(){ if (turning && Date.now() - turning > 700){ turning = 0; drawAll(); } }, 250);   // danach die übrigen Tasten nachholen
  // schnelle Raster-Schritte sammeln: ein Befehl je 50 ms mit der Summe statt einer je Schritt
  var tq = {}, tqT = 0;
  function tqAdd(kind, t){ tq[kind] = (tq[kind] || 0) + t; if (!tqT) tqT = setTimeout(tqFlush, 50); }
  function tqFlush(){ tqT = 0; var q = tq; tq = {};
    Object.keys(q).forEach(function(kind){ var t = q[kind]; if (!t) return;
      if (kind === "dialJb") for (var i = 0; i < Math.min(10, Math.abs(t)); i++) cmd({ type: "jb", cmd: t > 0 ? "volup" : "voldown" }).catch(function(){});
      else if (kind === "dialAlpha") cmd({ type: "ovAlpha", d: t }).catch(function(){});
      else if (kind === "dialOv") cmd({ type: "ovCycle", d: t }).catch(function(){});
    }); }
  setInterval(function(){ tick++; drawAll(); }, 1000);
  // 4.0.21: EVE Omni fragt Leistungsdaten nur ab, solange eine Taste sie zeigt (sonst alle 5 s nvidia-smi umsonst)
  function perfNeed(){ return Object.keys(keys).some(function(c){ var k = keys[c]; return k.kind === "display" && /^pf/.test((k.settings || {}).show || ""); }); }
  var perfLast = 0;
  function perfTell(force){ if (perfNeed() && Date.now() - perfLast > (force ? 2000 : 20000)){ perfLast = Date.now(); cmd({ type: "perfWant" }).catch(function(){}); } }
  setInterval(function(){ perfTell(false); }, 5000);

  // ---------- SD-D: Drehknöpfe + Touch-Streifen (200×100 je Knopf) ----------
  function strip(k){
    var c = document.createElement("canvas"); c.width = 200; c.height = 100; var g = c.getContext("2d"), now = Date.now(), col = (st && st.icc) || C.gold;
    g.fillStyle = "#000"; g.fillRect(0, 0, 200, 100);
    var line = function(t, y, size, cl, bold){ g.fillStyle = cl || C.text; g.font = (bold ? "bold " : "") + size + "px Segoe UI, Arial, sans-serif"; g.textAlign = "left"; g.textBaseline = "middle";
      var s = String(t); while (g.measureText(s).width > 124 && s.length > 2) s = s.slice(0, -2) + "…"; g.fillText(s, 72, y); };
    var bar = function(v){ g.fillStyle = "#2a3440"; g.fillRect(72, 78, 120, 8); g.fillStyle = col; g.fillRect(72, 78, Math.round(120 * Math.max(0, Math.min(1, v))), 8); };
    var view = { dialJb: "musik", dialAlpha: "assets", dialOv: "trades", dialTimer: "uhr" }[k.kind], s = k.settings || {};
    if (online && st && k.kind === "dialOv" && st.cur) view = st.cur.v;
    if (k.kind === "dialAlpha") view = "i:evecore";
    var im = online && st ? eveIcon(view) : null; if (im) g.drawImage(im, 4, 18, 64, 64);
    if (!online || !st){ line({ dialJb: "Jukebox", dialAlpha: "Deckkraft", dialOv: "Overlays", dialTimer: "Timer" }[k.kind], 34, 20, C.muted, true); line("EVE Omni offline", 62, 14, C.grey); return c; }
    if (k.kind === "dialJb" && now - (k.turnAt || 0) < 1000){ var jv = Math.round(((st.jb || {}).vol == null ? 1 : st.jb.vol) * 100);   // 4.0.35: beim Drehen nur Lautstärke, nach 1 s wieder der Titel
      line("Lautstärke", 26, 18, C.text, true); line(jv + " %", 56, 24, col, true); bar(jv / 100); }
    else if (k.kind === "dialJb"){ var j = st.jb || {}, t = j.t || "keine Musik"; if (t.length > 16 && j.p){ var v = t + "   ·   ", o = tick % v.length; t = (v + v).slice(o, o + 18); }
      line(t, 26, 18, C.text, true); line((j.p ? "läuft" : "Pause") + " · " + Math.round((j.vol == null ? 1 : j.vol) * 100) + " %", 54, 15, j.p ? col : C.muted); bar(j.vol == null ? 1 : j.vol); }
    else if (k.kind === "dialAlpha"){ var al = st.aAll || 1; line("Alle Overlays", 26, 19, C.text, true); line("Deckkraft " + Math.round(al * 100) + " %", 54, 15, col); bar(al); }
    else if (k.kind === "dialOv"){
      if (!st.cur){ line("Overlays", 40, 16, C.muted, true); return c; }
      line(st.cur.n, 26, 19, C.text, true);
      line((st.cur.open ? "offen" : "zu") + " · " + st.cur.i + "/" + st.cur.of, 54, 15, st.cur.open ? col : C.muted); bar(st.cur.i / st.cur.of);
    }
    else { var own = st.own && st.own.at > now ? st.own : null, m = dialMin(k);
      line(m + " Min.", 26, 24, C.text, true); line(own ? fmtDur(own.at - now) + " · " + own.n : "drücken = starten", 56, 14, own ? (own.at - now < 60000 ? C.red : col) : C.muted); bar(m / 120); }
    return c;
  }
  function dialMin(k){ return Math.max(1, Math.min(120, Number((k.settings || {}).min) || 5)); }
  function drawStrip(ctx){ var k = keys[ctx]; if (!k || !sock) return; var url = strip(k).toDataURL("image/png"); if (url === k.last) return; k.last = url;
    sock.send(JSON.stringify({ event: "setImage", context: ctx, payload: { image: url, target: 0 } }));
    if (k.enc) sock.send(JSON.stringify({ event: "setFeedback", context: ctx, payload: { "full-canvas": url, title: "" } }));   // SD-F: Elgato Stream Deck + (Layout $A0)
  }
  function turn(k, t){
    t = Math.max(-5, Math.min(5, Number(t) || 0)); if (!t) return;
    // gleich selbst anzeigen, EVE Omni bestätigt kurz danach (Streifen reagiert sofort)
    turning = Date.now();
    if (k.kind === "dialJb"){ tqAdd("dialJb", t); k.turnAt = Date.now(); clearTimeout(k.backT); k.backT = setTimeout(function(){ drawStrip(k.ctx); }, 1050);
      if (st && st.jb){ st.jb.vol = Math.max(0, Math.min(1, (st.jb.vol == null ? 0.6 : st.jb.vol) + t * 0.1)); hold.vol = { v: st.jb.vol, until: Date.now() + 1500 }; drawSoon(); } }
    else if (k.kind === "dialAlpha"){ tqAdd("dialAlpha", t); if (st){ st.aAll = Math.max(0.2, Math.min(1, Math.round(((st.aAll || 1) + t * 0.05) * 100) / 100)); hold.a = { v: st.aAll, until: Date.now() + 1500 }; drawSoon(); } }
    else if (k.kind === "dialOv") tqAdd("dialOv", t > 0 ? 1 : -1);
    else if (k.kind === "dialTimer"){ k.settings = Object.assign({}, k.settings, { min: Math.max(1, Math.min(120, dialMin(k) + t)) }); k.last = null; drawStrip(k.ctx);
      sock.send(JSON.stringify({ event: "setSettings", context: k.ctx, payload: k.settings })); }
  }
  function push(k){
    var a = k.kind === "dialJb" ? { type: "jb", cmd: "toggle" } : k.kind === "dialAlpha" ? { type: "ovAlpha", set: 1 } : k.kind === "dialOv" ? (st && st.cur ? { type: "ov", arg: st.cur.v } : null) :
      { type: "timer", arg: dialMin(k), name: (k.settings || {}).name || "" };
    if (a) cmd(a).catch(function(){ if (sock) sock.send(JSON.stringify({ event: "showAlert", context: k.ctx })); });
  }
  function isDial(k){ return /^dial/.test(k.kind); }

  // ---------- Tasten-Software ----------
  function kindOf(action){ return String(action || "").split(".").pop(); }
  function press(k){
    var s = k.settings || {};
    var a = k.kind === "overlay" ? { type: "ov", arg: s.view || "trades" } : k.kind === "timer" ? { type: "timer", arg: s.min || 5, name: s.name || "" } : k.kind === "jukebox" ? { type: "ov", arg: "musik" } : { type: "ov", arg: "uhr" };   // Uhr-Taste öffnet das Uhr-Overlay (Timer, Alarme)
    if (k.kind === "action" || (k.kind === "display" && s.act)){   // SD-C: Aktion bzw. Kombi (Anzeige + eigene Aktion beim Drücken)
      var id = s.act || "ov", A = ACTS[id];
      a = id === "ov" ? { type: "ov", arg: s.view || "trades" } : id === "timer" ? { type: "timer", arg: s.min || 5, name: s.name || "" } : A && A.c ? JSON.parse(JSON.stringify(A.c)) : null;
    }
    else if (k.kind === "display") a = { type: "ov", arg: (SHOWS[s.show] || SHOWS.dt).ov };   // Anzeige ohne eigene Aktion: passendes Overlay
    if (!a) return;
    cmd(a).catch(function(){ if (sock) sock.send(JSON.stringify({ event: "showAlert", context: k.ctx })); });
  }
  window.connectElgatoStreamDeckSocket = function(port, uuid, registerEvent){
    sock = new WebSocket("ws://127.0.0.1:" + port);
    sock.onopen = function(){ sock.send(JSON.stringify({ event: registerEvent, uuid: uuid })); eveConnect(); };
    sock.onmessage = function(e){
      var m; try{ m = JSON.parse(e.data); }catch(x){ return; }
      var ctx = m.context, p = m.payload || {};
      if (m.event === "willAppear"){ keys[ctx] = { ctx: ctx, kind: kindOf(m.action), settings: p.settings || {}, enc: p.controller === "Encoder" }; draw(ctx); perfTell(true); }
      else if (m.event === "willDisappear") delete keys[ctx];
      else if (m.event === "didReceiveSettings" && keys[ctx]){ keys[ctx].settings = p.settings || {}; keys[ctx].last = null; draw(ctx); perfTell(true); }
      else if (m.event === "keyDown" && keys[ctx]) press(keys[ctx]);
      else if (m.event === "dialRotate" && keys[ctx]) turn(keys[ctx], p.ticks);   // SD-D
      else if ((m.event === "dialDown" || m.event === "touchTap" || (m.event === "dialPress" && p.pressed)) && keys[ctx]) push(keys[ctx]);
      else if (m.event === "systemDidWakeUp") eveConnect();
    };
  };
  window.EVEOMNI_TEST = { keys: keys, render: render, press: press, setState: function(s, on){ st = s; online = on !== false; }, VIEWS: VIEWS, ACTS: ACTS, SHOWS: SHOWS, strip: strip, turn: turn, push: push };   // für die Tests
})();
