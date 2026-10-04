/* V1: Demo-Modus – läuft nur bei ?demo=1, VOR allen anderen Skripten (eingebaut von Programm-Quellcode/demo-einbauen.py).
   1) Speicher: localStorage/sessionStorage → Schlüssel „eve-zentrale-demo-…“ (echte Daten bleiben unberührt)
   2) Hauptfenster: Demo-Speicher bei jedem Start frisch mit Beispieldaten füllen
   3) fetch: Demo-Händler beantwortet ESI, SSO, zKillboard, EVE-Scout … selbst – keine einzige Abfrage nach draußen
   4) Porträts/Logos der erfundenen Charaktere als Initialen-Bild, Banner „DEMO – erfundene Daten“, gesperrte Knöpfe
   Alle Zeiten relativ zu „jetzt“, Zufall mit festem Startwert (immer gleicher Ausgangszustand). */
(function(){
  if (!/[?&]demo=1(&|$)/.test(location.search)) return;
  var NOW = Date.now(), H = 3600000, D = 86400000, SAT = /[?&]fenster=/.test(location.search);
  var DEMO = window.EVE_DEMO = { on: true, log: [], sat: SAT };
  document.documentElement.classList.add("demo");

  /* ---------- 1) Speicher ---------- */
  var RP = "eve-zentrale-", DP = "eve-zentrale-demo-";
  function dk(k){ k = String(k); return k.indexOf(RP) === 0 ? DP + k.slice(RP.length) : DP + "x-" + k; }
  function uk(k){ var r = k.slice(DP.length); return r.indexOf("x-") === 0 ? r.slice(2) : RP + r; }
  function wrap(real){
    function keys(){ var o = []; for (var i = 0; i < real.length; i++){ var k = real.key(i); if (k && k.indexOf(DP) === 0) o.push(uk(k)); } return o; }
    var api = {
      getItem: function(k){ return real.getItem(dk(k)); }, setItem: function(k, v){ real.setItem(dk(k), String(v)); }, removeItem: function(k){ real.removeItem(dk(k)); },
      clear: function(){ keys().forEach(function(k){ real.removeItem(dk(k)); }); }, key: function(i){ return keys()[i] || null; }
    };
    Object.defineProperty(api, "length", { get: function(){ return keys().length; } });
    api.__real = real;
    return api;
  }
  var realLS = window.localStorage, realSS = window.sessionStorage;
  try{ Object.defineProperty(window, "localStorage", { value: wrap(realLS), configurable: true }); Object.defineProperty(window, "sessionStorage", { value: wrap(realSS), configurable: true }); }catch(e){}
  // „storage“-Ereignisse anderer Fenster mit den Demo-Namen weitergeben (Sprache, Overlay-Abgleich)
  var addEv = window.addEventListener;
  window.addEventListener = function(type, fn, o){
    if (type !== "storage" || typeof fn !== "function") return addEv.call(this, type, fn, o);
    return addEv.call(this, type, function(ev){ if (!ev.key || ev.key.indexOf(DP) !== 0) return; fn({ key: uk(ev.key), newValue: ev.newValue, oldValue: ev.oldValue, storageArea: window.localStorage }); }, o);
  };

  /* ---------- Hilfen ---------- */
  var seed = 7; function rnd(){ seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
  function iso(ms){ return new Date(ms).toISOString().replace(/\.\d+Z$/, "Z"); }
  function b64(s){ return btoa(unescape(encodeURIComponent(s))).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_"); }
  function r2(x){ return Math.round(x * 100) / 100; }
  function tick(p){ var d = Math.pow(10, Math.max(0, Math.floor(Math.log10(Math.max(p, 1))) - 3)); return Math.round(p / d) * d; }   // 4 gültige Stellen wie in EVE

  /* ---------- Stammdaten ---------- */
  var CORP = { id: 98999901, name: "Demo Industries", ticker: "DEMO" };
  var CH = [
    { id: 2099000001, name: "Aria Demo", role: "Handel", wallet: 3215480000.42, sys: 30000142, st: 60003760, ship: [649, "Arias Tayra"], sp: 48e6, col: "#3a8fb7" },
    { id: 2099000002, name: "Kael Demo", role: "Frachter", wallet: 851230500.1, sys: 30000142, st: 60003760, ship: [20185, "Kaels Charon"], sp: 31e6, col: "#c9822b" },
    { id: 2099000003, name: "Nova Demo", role: "Sprungpilot", wallet: 420998000, sys: 30002187, st: 60008494, ship: [621, "Novas Caracal"], sp: 22e6, col: "#7a5cc4" }];
  var BYCH = {}; CH.forEach(function(c){ BYCH[c.id] = c; });
  var JITA = 60003760, FORGE = 10000002;
  // [Typ, Name, Volumen, Gruppe, Jita-Verkaufspreis, Spanne (Kauf unter Verkauf), Umsatz/Tag]
  var T = {};
  [[34,"Tritanium",.01,18,4.12,.06,9e7],[35,"Pyerite",.01,18,9.84,.07,4e7],[36,"Mexallon",.01,18,61.9,.09,9e6],[37,"Isogen",.01,18,121,.08,4e6],[38,"Nocxium",.01,18,642,.11,8e5],[39,"Zydrine",.01,18,1098,.14,3e5],[40,"Megacyte",.01,18,2312,.12,2e5],
   [2048,"Damage Control II",5,60,1150000,.12,900],[3831,"Medium Shield Extender II",5,38,1890000,.15,520],[2488,"Warrior II",5,100,381000,.13,2400],[2456,"Hobgoblin II",5,100,519000,.14,2100],[2185,"Hammerhead II",10,100,1249000,.16,800],
   [2203,"Acolyte I",5,100,9120,.22,1500],[230,"Antimatter Charge M",.0125,85,262,.18,1.2e6],[209,"Scourge Heavy Missile",.03,385,181,.19,9e5],[28668,"Nanite Repair Paste",.01,1136,23950,.09,40000],
   [40520,"Large Skill Injector",.01,1739,821400000,.035,950],[40519,"Skill Extractor",.01,1739,331200000,.04,700],[519,"Gyrostabilizer II",5,59,1598000,.17,450],[10190,"Magnetic Field Stabilizer II",5,302,1412000,.16,380],
   [2364,"Heat Sink II",5,205,1098000,.15,420],[22291,"Ballistic Control System II",5,367,1712000,.18,600],[4405,"Drone Damage Amplifier II",5,645,2298000,.2,700],[12058,"10MN Afterburner II",5,46,1199000,.17,300],
   [12076,"50MN Microwarpdrive II",10,46,3402000,.19,350],[1319,"Expanded Cargohold II",5,764,1048000,.18,520],[1335,"Reinforced Bulkheads II",5,78,752000,.21,330],[2410,"Heavy Missile Launcher II",10,510,2104000,.16,260],
   [2629,"Scourge Fury Heavy Missile",.03,385,981,.2,2e5],[438,"1MN Afterburner II",5,46,689000,.2,280],[11269,"Multispectrum Energized Membrane II",5,328,1912000,.17,310],[3841,"Large Shield Extender II",10,38,5198000,.14,500],
   [1541,"Power Diagnostic System II",5,766,1301000,.16,420],[2605,"Nanofiber Internal Structure II",5,763,651000,.19,380],[24427,"Drone Link Augmentor II",25,645,2799000,.24,90],
   [20185,"Charon",1300000,513,1612000000,.06,6],[12731,"Bustard",20000,380,291000000,.08,8],[648,"Badger",20000,28,1100000,.18,60],[649,"Tayra",20000,28,2120000,.17,40],[587,"Rifter",2500,25,651000,.16,110],
   [621,"Caracal",10000,26,13200000,.12,90],[24698,"Drake",15000,419,60400000,.09,70],[32880,"Venture",2500,1283,1210000,.15,150],[17478,"Retriever",3750,463,33100000,.11,30],
   [2393,"Bacteria",.38,1042,412,.2,3e5],[3645,"Water",.38,1042,388,.2,4e5],[9832,"Coolant",1.5,1034,9800,.15,9e4],[2073,"Microorganisms",.01,1032,6.8,.25,3e6],[2268,"Aqueous Liquids",.01,1032,7.3,.25,3e6]
  ].forEach(function(x){ T[x[0]] = { id: x[0], n: x[1], v: x[2], g: x[3], p: x[4], sp: x[5], vol: x[6] }; });
  var SK = { 3446:"Broker Relations",16622:"Accounting",16597:"Advanced Broker Relations",3443:"Trade",3444:"Retail",16596:"Wholesale",18580:"Tycoon",16598:"Marketing",16594:"Procurement",16595:"Daytrading",3447:"Visibility",25235:"Contracting",
    3449:"Navigation",3402:"Science",3327:"Spaceship Command",3300:"Gunnery",3436:"Drones",3426:"CPU Management",3413:"Power Grid Management",3418:"Capacitor Management",24241:"Light Drone Operation",33467:"Customs Code Expertise",
    3340:"Gallente Hauler",3341:"Minmatar Hauler",3342:"Caldari Hauler",3343:"Amarr Hauler",20524:"Caldari Freighter",19719:"Transport Ships",3332:"Caldari Frigate",3335:"Caldari Cruiser",3455:"Evasive Maneuvering",3453:"Warp Drive Operation",
    3416:"Shield Operation",3419:"Shield Management",3394:"Hull Upgrades",3392:"Mechanics",1:"" };
  delete SK[1];
  Object.keys(SK).forEach(function(id){ if (!T[id]) T[id] = { id: +id, n: SK[id], v: .01, g: 255, p: 0, skill: true }; });
  var GRP = { 18:["Mineral",4],60:["Damage Control",7],38:["Shield Extender",7],100:["Combat Drone",18],85:["Hybrid Charge",8],385:["Heavy Missile",8],1136:["Fuel Block",4],1739:["Skill Injector",17],59:["Gyrostabilizer",7],302:["Magnetic Field Stabilizer",7],
    205:["Heat Sink",7],367:["Ballistic Control system",7],645:["Drone Damage Modules",7],46:["Propulsion Module",7],764:["Expanded Cargohold",7],78:["Reinforced Bulkhead",7],510:["Missile Launcher Heavy",7],328:["Armor Hardener",7],766:["Power Diagnostic System",7],
    763:["Nanofiber Internal Structure",7],513:["Freighter",6],380:["Deep Space Transport",6],28:["Hauler",6],25:["Frigate",6],26:["Cruiser",6],419:["Combat Battlecruiser",6],1283:["Expedition Frigate",6],463:["Mining Barge",6],255:["Gunnery",16],
    1042:["Basic Commodities - Tier 1",43],1034:["Refined Commodities - Tier 2",43],1032:["Planet Solid - Raw Resource",42] };
  var CAT = { 4:"Material",6:"Ship",7:"Module",8:"Charge",16:"Skill",17:"Commodity",18:"Drone",42:"Planetary Resources",43:"Planetary Commodities" };
  // Schiffe/Module mit echten Dogma-Werten (für Laderaum, EHP, Gank-Ampel)
  var DOGMA = {
    20185: { m: 960000000, c: 465000, a: {4:960000000,9:42000,263:75000,265:22500,267:.5,268:.8,269:.65,270:.9,271:1,272:.8,273:.6,274:.5,109:1,110:1,111:1,113:1,12:3,13:0,14:0,1137:3,70:.0085,37:65,552:15000,600:1.5,1281:.75,48:0,11:0,38:465000,182:20524} },
    12731: { m: 20000000, c: 9000, a: {4:20000000,9:4000,263:4300,265:2300,267:.5,268:.9,269:.375,270:.1375,271:1,272:.5,273:.3,274:.2,109:.67,110:.67,111:.67,113:.67,12:3,13:6,14:2,1137:2,70:1,37:80,552:165,600:3.5,1281:1,48:290,11:200,38:9000,182:3342,183:19719,808:-4} },
    648: { m: 10750000, c: 3900, a: {4:10750000,9:1680,263:1000,265:750,267:.5,268:.9,269:.75,270:.9,271:1,272:.8,273:.6,274:.5,109:.67,110:.67,111:.67,113:.67,12:3,13:4,14:1,1137:3,70:1.15,37:115,552:155,600:3,1281:1,48:200,11:40,38:3900,182:3342} },
    649: { m: 13000000, c: 7300, a: {4:13000000,9:2300,263:1400,265:850,267:.5,268:.9,269:.75,270:.9,271:1,272:.8,273:.6,274:.5,109:.67,110:.67,111:.67,113:.67,12:4,13:4,14:1,1137:3,70:1.1,37:110,552:215,600:3,1281:1,48:220,11:45,38:7300,182:3342} },
    621: { m: 11910000, c: 450, a: {4:11910000,9:1500,263:1950,265:1300,267:.5,268:.9,269:.75,270:.9,271:1,272:.6,273:.5,274:.4,109:.67,110:.67,111:.67,113:.67,12:4,13:5,14:5,1137:3,70:.5,37:235,552:110,600:3,1281:3,48:400,11:900,38:450,182:3335} },
    1319: { a: {149:1.275,150:.77} }, 1335: { a: {150:1.25,614:-10} } };
  // Systeme, Konstellationen, Regionen, Stargates aus der eingebauten Schema-Karte (MP_SCH steht im Hauptskript – erst später verfügbar)
  var U = null;
  function uni(){
    if (U) return U;
    var S = window.__MP_SCH || (function(){ try{ return JSON.parse(document.getElementById("demo-mpsch").textContent); }catch(e){ return null; } })();
    U = { sys: {}, con: {}, reg: {}, adj: {}, gate: {}, ids: [] };
    if (!S) return U;
    var id = 0;
    S.s.forEach(function(a, i){ id += a[0]; var r = S.r[a[4]], c = S.c[a[5]]; U.ids[i] = id;
      U.sys[id] = { id: id, n: a[6], s: a[3], x: a[1], y: a[2], r: r[0], c: c[0], st: a[7] || 0 };
      (U.con[c[0]] = U.con[c[0]] || { id: c[0], n: c[1], r: r[0], sys: [] }).sys.push(id);
      (U.reg[r[0]] = U.reg[r[0]] || { id: r[0], n: r[1], con: [] }); if (U.reg[r[0]].con.indexOf(c[0]) < 0) U.reg[r[0]].con.push(c[0]); });
    for (var k = 0; k < S.e.length; k += 2){ var a = U.ids[S.e[k]], b = U.ids[S.e[k + 1]], ga = 50000000 + k, gb = 50000001 + k;
      (U.adj[a] = U.adj[a] || []).push(b); (U.adj[b] = U.adj[b] || []).push(a); U.gate[ga] = [a, b]; U.gate[gb] = [b, a]; }
    return U;
  }
  function route(a, b, pref, avoid, conns){
    var u = uni(), adj = function(x){ var l = (u.adj[x] || []).slice(); (conns || []).forEach(function(c){ if (c.from === x) l.push(c.to); }); return l; };
    var cost = function(x){ var s = (u.sys[x] || {}).s; if (s == null) return 1; var hi = Math.round(s * 10) / 10 >= .5;
      return pref === "Safer" ? (hi ? 1 : 5000) : pref === "LessSecure" ? (hi ? 5000 : 1) : 1; };
    var av = {}; (avoid || []).forEach(function(x){ av[x] = 1; });
    var dist = {}, prev = {}, q = [[0, a]]; dist[a] = 0;
    while (q.length){
      q.sort(function(x, y){ return x[0] - y[0]; }); var cur = q.shift(), d = cur[0], x = cur[1];
      if (x === b) break; if (d > dist[x]) continue;
      adj(x).forEach(function(y){ if (av[y] && y !== b) return; var nd = d + cost(y); if (dist[y] === undefined || nd < dist[y]){ dist[y] = nd; prev[y] = x; q.push([nd, y]); } });
    }
    if (dist[b] === undefined) return null;
    var p = [b]; while (p[0] !== a) p.unshift(prev[p[0]]); return p;
  }
  var STATIONS = { 60003760: ["Jita IV - Moon 4 - Caldari Navy Assembly Plant", 30000142, 1529], 60008494: ["Amarr VIII (Oris) - Emperor Family Academy", 30002187, 1932], 60011866: ["Dodixie IX - Moon 20 - Federation Navy Assembly Plant", 30002659, 1926],
    60004588: ["Rens VI - Moon 8 - Brutor Tribe Treasury", 30002510, 1929], 60005686: ["Hek VIII - Moon 12 - Boundless Creation Factory", 30002053, 1928], 60003466: ["Perimeter II - Moon 1 - Caldari Business Tribunal", 30000144, 1529] };
  var HUBREG = { 10000002: 60003760, 10000043: 60008494, 10000032: 60011866, 10000030: 60004588, 10000042: 60005686 };
  // Preisfaktoren je Hub (Jita = 1): für Hauling/Hub-Handel einige Waren in anderen Hubs teurer
  var HUBF = { 10000043: [1.09, 1.18], 10000032: [1.06, 1.12], 10000030: [1.07, 1.1], 10000042: [1.04, 1.09] };

  /* ---------- Markt (Orderbuch + Historie) ---------- */
  var oid = 7100000000, BOOK = {}, MYORD = [], MYHIST = [], TX = {}, JR = {}, txid = 9100000000, jrid = 9200000000;
  function book(region){
    if (BOOK[region]) return BOOK[region];
    var out = [], st = HUBREG[region], f = HUBF[region], s0 = seed; seed = region % 1000 + 11;
    Object.keys(T).forEach(function(k){ var t = T[k]; if (!t.p) return;
      var fac = f ? f[0] + (rnd() < .45 ? rnd() * (f[1] - f[0]) * 2 : -rnd() * .04) : 1, sell = tick(t.p * fac), buy = tick(sell * (1 - t.sp * (f ? .6 + rnd() * .5 : 1)));
      if (f && rnd() < .35) buy = tick(t.p * (1.08 + rnd() * .12));   // lohnend: Kauforder im Ziel-Hub über Jita-Verkauf
      var n = 4 + Math.floor(rnd() * 5), q = Math.max(1, Math.round(t.vol / 6));
      for (var i = 0; i < n; i++){
        out.push({ order_id: ++oid, type_id: t.id, is_buy_order: false, price: tick(sell * (1 + i * .004 + rnd() * .002)), volume_remain: Math.max(1, Math.round(q * (.3 + rnd()))), volume_total: q * 2, location_id: st, system_id: (STATIONS[st] || [])[1], issued: iso(NOW - rnd() * 3 * D), duration: 90, min_volume: 1, range: "region" });
        out.push({ order_id: ++oid, type_id: t.id, is_buy_order: true, price: tick(buy * (1 - i * .005 - rnd() * .002)), volume_remain: Math.max(1, Math.round(q * (.3 + rnd()))), volume_total: q * 2, location_id: st, system_id: (STATIONS[st] || [])[1], issued: iso(NOW - rnd() * 3 * D), duration: 90, min_volume: 1, range: i % 2 ? "region" : "station" });
      } });
    if (region === FORGE) MYORD.forEach(function(o){ out.push(o.pub); });
    seed = s0; BOOK[region] = out; return out;
  }
  function hist(region, tid){
    var t = T[tid]; if (!t || !t.p) return [];
    var s0 = seed; seed = tid * 7 + region % 97; var out = [], f = HUBF[region] ? HUBF[region][0] : 1;
    for (var i = 60; i >= 1; i--){ var avg = t.p * f * (1 - t.sp / 2) * (1 + Math.sin(i / 6 + tid) * .04 + (rnd() - .5) * .03);
      out.push({ date: new Date(NOW - i * D).toISOString().slice(0, 10), average: r2(avg), highest: r2(avg * (1 + t.sp / 2)), lowest: r2(avg * (1 - t.sp / 2)), volume: Math.round(t.vol * (.7 + rnd() * .6) / (f > 1 ? 3 : 1)), order_count: 20 + Math.floor(rnd() * 200) }); }
    seed = s0; return out;
  }

  /* ---------- Trades, Orders, Wallet ---------- */
  var ARIA = CH[0].id, KAEL = CH[1].id;
  function myOrder(cid, tid, buy, price, total, remain, ago){
    var o = { order_id: ++oid, type_id: tid, is_buy_order: buy, price: price, volume_total: total, volume_remain: remain, location_id: JITA, region_id: FORGE, issued: iso(NOW - ago), duration: 90, range: "station", min_volume: 1, is_corporation: false, escrow: buy ? price * remain : undefined };
    o.pub = { order_id: o.order_id, type_id: tid, is_buy_order: buy, price: price, volume_remain: remain, volume_total: total, location_id: JITA, system_id: 30000142, issued: o.issued, duration: 90, min_volume: 1, range: "station" };
    o.cid = cid; MYORD.push(o); return o;
  }
  function tx(cid, tid, buy, q, price, at, ord){
    var id = ++txid, j = ++jrid; (TX[cid] = TX[cid] || []).push({ transaction_id: id, date: iso(at), type_id: tid, quantity: q, unit_price: price, is_buy: buy, is_personal: true, location_id: JITA, client_id: 2099500000 + (id % 40), journal_ref_id: j });
    (JR[cid] = JR[cid] || []).push({ id: j, date: iso(at), ref_type: "market_transaction", amount: r2((buy ? -1 : 1) * q * price), description: "Markthandel", context_id: id, context_id_type: "market_transaction_id", first_party_id: cid, second_party_id: 2099500000 });
    if (!buy) JR[cid].push({ id: ++jrid, date: iso(at + 1000), ref_type: "transaction_tax", amount: -r2(q * price * .03375), description: "Verkaufssteuer", context_id: id, context_id_type: "market_transaction_id", first_party_id: cid, second_party_id: 1000132 });
  }
  function fee(cid, amount, at, ord){ (JR[cid] = JR[cid] || []).push({ id: ++jrid, date: iso(at), ref_type: "brokers_fee", amount: -r2(amount), description: "Maklergebühr", context_id: ord, context_id_type: "market_order_id", first_party_id: cid, second_party_id: 1000132 }); }
  var TRADES = [];
  function trade(tid, qty, buyP, sellP, ago, how){
    var t = T[tid], created = NOW - ago, tr = { id: created + "-" + tid, tid: tid, name: t.n, hub: "jita", charId: String(ARIA), charName: "Aria Demo", qty: qty, buy: buyP, sell: sellP,
      unit: r2(sellP * (1 - .03375 - .015) - buyP * 1.015), margin: r2((sellP - buyP) / buyP * 100), created: created, status: "active", buyDone: false };
    var bo = myOrder(ARIA, tid, true, buyP, qty, how.bought >= qty ? 0 : qty - how.bought, ago - 60000); fee(ARIA, buyP * qty * .015, created + 30000, bo.order_id); tr.buyOrderId = bo.order_id;
    if (bo.volume_remain === 0) MYORD.splice(MYORD.indexOf(bo), 1), MYHIST.push(Object.assign({}, bo, { state: "expired" }));
    for (var i = 0, n = how.bought; n > 0; i++){ var q = Math.min(n, Math.ceil(qty / 3)); tx(ARIA, tid, true, q, buyP, created + (i + 1) * ago / (how.sold ? 8 : 5), bo.order_id); n -= q; }
    if (how.bought >= qty) tr.buyDone = true;
    if (how.sell){ var so = myOrder(ARIA, tid, false, how.sell, how.bought, how.bought - (how.sold || 0), ago / 2); fee(ARIA, how.sell * how.bought * .015, NOW - ago / 2 + 5000, so.order_id); tr.sellOrderId = so.order_id;
      if (so.volume_remain === 0) MYORD.splice(MYORD.indexOf(so), 1), MYHIST.push(Object.assign({}, so, { state: "expired" }));
      for (var s = 0, m = how.sold || 0; m > 0; s++){ var qs = Math.min(m, Math.ceil(how.bought / 3)); tx(ARIA, tid, false, qs, how.sell, NOW - ago / 2 + (s + 1) * ago / 8, so.order_id); m -= qs; } }
    if (how.done){ tr.status = "done"; tr.done = NOW - ago / 10; }
    if (how.outbid) book(FORGE).push({ order_id: ++oid, type_id: tid, is_buy_order: true, price: tick(buyP * 1.0009) + (buyP > 1e5 ? 100 : .01), volume_remain: 40, volume_total: 40, location_id: JITA, system_id: 30000142, issued: iso(NOW - 25 * 60000), duration: 90, min_volume: 1, range: "station" });
    TRADES.unshift(tr); return tr;
  }
  function mkTrades(){
    trade(2048, 40, 1012000, 1149000, 9 * H, { bought: 15 });                                     // Kauf läuft
    trade(519, 30, 1342000, 1597000, 5 * H, { bought: 8, outbid: true });                         // überboten
    trade(2456, 120, 451200, 518900, 2.2 * D, { bought: 120, sell: 518900, sold: 50 });           // Verkauf läuft
    trade(3831, 60, 1611000, 1889000, 4 * D, { bought: 60, sell: 1889000, sold: 60, done: true });   // erledigt, Gewinn
    trade(28668, 2000, 23100, 23890, 6 * D, { bought: 2000, sell: 23290, sold: 2000, done: true });  // erledigt, kleiner Verlust
    trade(2410, 25, 1802000, 2101000, 40 * 60000, { bought: 0 });                                 // gerade eingestellt
    trade(4405, 50, 1905000, 2297000, 3.1 * D, { bought: 50, sell: 2297000, sold: 12 });
    // Journal: 30 Tage Handel für eine schöne Kurve (ältere Geschäfte, schon abgeschlossen)
    var s0 = seed; seed = 99;
    Object.keys(T).filter(function(k){ return T[k].p > 5000 && T[k].p < 5e6 && [6].indexOf((GRP[T[k].g] || [])[1]) < 0; }).forEach(function(k, i){   // keine Schiffe in der Handelskurve
      var t = T[k], at = NOW - (29 - (i % 28)) * D - rnd() * D, q = 60 + Math.floor(rnd() * 140), b = tick(t.p * (1 - t.sp * .85)), s = tick(t.p * (1 - rnd() * .015));
      tx(ARIA, t.id, true, q, b, at, 0); tx(ARIA, t.id, false, q, s, at + (1 + rnd() * 2) * D, 0); fee(ARIA, b * q * .015 + s * q * .015, at + 60000, ++oid); });
    seed = s0;
  }
  function journalWithBalance(cid){
    var j = (JR[cid] || []).slice().sort(function(a, b){ return a.date < b.date ? -1 : 1; }), bal = BYCH[cid].wallet - j.reduce(function(s, x){ return s + x.amount; }, 0);
    j.forEach(function(x){ bal += x.amount; x.balance = r2(bal); }); return j.reverse();
  }

  /* ---------- Hangar, Skills, PI ---------- */
  var item = 1050000000000;
  function assets(cid){
    if (cid === KAEL){ var ch = ++item, bu = ++item;
      return [{ item_id: ch, type_id: 20185, location_id: JITA, location_flag: "Hangar", location_type: "station", quantity: 1, is_singleton: true },
        { item_id: ++item, type_id: 1319, location_id: ch, location_flag: "LoSlot0", location_type: "item", quantity: 1, is_singleton: true },
        { item_id: ++item, type_id: 1335, location_id: ch, location_flag: "LoSlot1", location_type: "item", quantity: 1, is_singleton: true },
        { item_id: ++item, type_id: 1335, location_id: ch, location_flag: "LoSlot2", location_type: "item", quantity: 1, is_singleton: true },
        { item_id: bu, type_id: 12731, location_id: JITA, location_flag: "Hangar", location_type: "station", quantity: 1, is_singleton: true },
        { item_id: ++item, type_id: 1335, location_id: bu, location_flag: "LoSlot0", location_type: "item", quantity: 1, is_singleton: true },
        { item_id: ++item, type_id: 648, location_id: JITA, location_flag: "Hangar", location_type: "station", quantity: 1, is_singleton: true },
        { item_id: ++item, type_id: 34, location_id: JITA, location_flag: "Hangar", location_type: "station", quantity: 2500000, is_singleton: false }]; }
    if (cid === ARIA){ var ac = ++item, ab = ++item; return [{ item_id: ++item, type_id: 649, location_id: JITA, location_flag: "Hangar", location_type: "station", quantity: 1, is_singleton: true },
      { item_id: ac, type_id: 20185, location_id: JITA, location_flag: "Hangar", location_type: "station", quantity: 1, is_singleton: true },
      { item_id: ++item, type_id: 1335, location_id: ac, location_flag: "LoSlot0", location_type: "item", quantity: 1, is_singleton: true },
      { item_id: ab, type_id: 12731, location_id: JITA, location_flag: "Hangar", location_type: "station", quantity: 1, is_singleton: true },
      { item_id: ++item, type_id: 2456, location_id: JITA, location_flag: "Hangar", location_type: "station", quantity: 70, is_singleton: false },
      { item_id: ++item, type_id: 40520, location_id: JITA, location_flag: "Hangar", location_type: "station", quantity: 2, is_singleton: false },
      { item_id: ++item, type_id: 36, location_id: JITA, location_flag: "Hangar", location_type: "station", quantity: 180000, is_singleton: false }]; }
    return [{ item_id: ++item, type_id: 621, location_id: 60008494, location_flag: "Hangar", location_type: "station", quantity: 1, is_singleton: true },
      { item_id: ++item, type_id: 32880, location_id: 60008494, location_flag: "Hangar", location_type: "station", quantity: 1, is_singleton: true }];
  }
  function skills(cid){
    var lv = cid === ARIA ? { 3446:5,16622:5,16597:4,3443:5,3444:5,16596:4,18580:3,16598:4,16594:4,16595:3,3447:3,25235:3,3449:4,3327:4,3342:4,19719:1 }
      : cid === KAEL ? { 3446:2,16622:3,3443:4,3444:2,3449:5,3327:5,3342:5,20524:4,19719:4,3455:4,3453:4,3416:4,3419:4,3394:4,3392:4 } : { 3446:1,16622:2,3443:3,3449:4,3327:4,3335:4,3332:5,3300:3,3436:3,3426:4,3413:4,3418:3,24241:3 };
    var l = Object.keys(lv).map(function(id){ var x = lv[id]; return { skill_id: +id, trained_skill_level: x, active_skill_level: x, skillpoints_in_skill: [0, 250, 1415, 8000, 45255, 256000][x] * 3 }; });
    return { skills: l, total_sp: BYCH[cid].sp, unallocated_sp: cid === KAEL ? 120000 : 0 };
  }
  function queue(cid){
    var q = cid === ARIA ? [[18580, 4, 2.4 * H, 9 * H], [16597, 5, 9 * H, 4.2 * D], [3447, 4, 4.2 * D, 6 * D]] : cid === KAEL ? [[19719, 5, 1.3 * D, 9 * D]] : [[3335, 5, 2 * H, 3 * D], [3426, 5, 3 * D, 7 * D]];
    return q.map(function(x, i){ return { skill_id: x[0], finished_level: x[1], queue_position: i, start_date: iso(NOW + (i ? x[2] : -6 * H)), finish_date: iso(NOW + x[3]), level_start_sp: 45255, level_end_sp: 256000, training_start_sp: 50000 }; });
  }
  var PLANETS = [{ planet_id: 40009081, solar_system_id: 30000144, planet_type: "barren", upgrade_level: 4, num_pins: 12, last_update: iso(NOW - 2 * H), _n: "Perimeter III", _x: [[2073, 6 * H]] },
    { planet_id: 40009087, solar_system_id: 30000144, planet_type: "temperate", upgrade_level: 4, num_pins: 14, last_update: iso(NOW - 26 * H), _n: "Perimeter V", _x: [[2268, -30 * 60000]] }];
  function planet(pid){
    var p = PLANETS.filter(function(x){ return x.planet_id === pid; })[0]; if (!p) return null;
    var pins = p._x.map(function(x, i){ return { pin_id: pid * 10 + i, type_id: 3060 + i, latitude: .5, longitude: .5, install_time: iso(NOW - 5 * D), last_cycle_start: iso(NOW - H), expiry_time: iso(NOW + x[1]),
      extractor_details: { product_type_id: x[0], cycle_time: 1800, qty_per_cycle: 4200, head_radius: .01, heads: [{ head_id: 0, latitude: .5, longitude: .5 }] } }; });
    pins.push({ pin_id: pid * 10 + 8, type_id: 2470, latitude: .5, longitude: .5, schematic_id: 121, last_cycle_start: iso(NOW - 20 * 60000), contents: [{ type_id: 2393, amount: 4000 }] });
    pins.push({ pin_id: pid * 10 + 9, type_id: 2562, latitude: .5, longitude: .5, contents: [{ type_id: 2393, amount: 12000 }, { type_id: 3645, amount: 8000 }] });
    return { pins: pins, links: [], routes: [] };
  }

  /* ---------- Intel: erfundene Piloten für Local ---------- */
  var PIL = ["Zed Vortex","Mira Kestrel","Orin Talvek","Sable Quinn","Jax Morrow","Lyra Venn","Draco Holt","Iris Calder","Bram Okonkwo","Tessa Lark","Vik Ardent","Nell Ashby","Kato Rhee","Runa Falk","Petro Vasquez"].map(function(n, i){
    return { id: 2099500001 + i, n: n, corp: 2099600001 + (i % 5), danger: [5, 92, 30, 75, 10, 61, 3, 88, 44, 18, 70, 8, 55, 25, 97][i], kills: [3, 410, 40, 220, 8, 160, 1, 380, 90, 22, 190, 4, 120, 30, 640][i] }; });
  var PCORP = { 2099600001: "Void Lantern Co", 2099600002: "Kestrel Cartel", 2099600003: "Quiet Harbor", 2099600004: "Ashen Drift", 2099600005: "Northwind Survey" };

  /* ---------- Namen ---------- */
  function nameOf(id){
    id = +id; var u = uni();
    if (T[id]) return { id: id, name: T[id].n, category: "inventory_type" };
    if (BYCH[id]) return { id: id, name: BYCH[id].name, category: "character" };
    if (id === CORP.id) return { id: id, name: CORP.name, category: "corporation" };
    var p = PIL.filter(function(x){ return x.id === id; })[0]; if (p) return { id: id, name: p.n, category: "character" };
    if (PCORP[id]) return { id: id, name: PCORP[id], category: "corporation" };
    if (u.sys[id]) return { id: id, name: u.sys[id].n, category: "solar_system" };
    if (u.reg[id]) return { id: id, name: u.reg[id].n, category: "region" };
    if (u.con[id]) return { id: id, name: u.con[id].n, category: "constellation" };
    if (STATIONS[id]) return { id: id, name: STATIONS[id][0], category: "station" };
    var pl = PLANETS.filter(function(x){ return x.planet_id === id; })[0]; if (pl) return { id: id, name: pl._n, category: "planet" };
    if (id === 1000132) return { id: id, name: "Secure Commerce Commission", category: "corporation" };
    return null;
  }
  function idsOf(names){
    var u = uni(), o = { characters: [], inventory_types: [], systems: [], regions: [], constellations: [], stations: [], corporations: [] };
    names.forEach(function(n){ var l = String(n).toLowerCase(), hit = false;
      Object.keys(T).forEach(function(k){ if (!hit && T[k].n.toLowerCase() === l){ o.inventory_types.push({ id: +k, name: T[k].n }); hit = true; } });
      CH.concat(PIL.map(function(p){ return { id: p.id, name: p.n }; })).forEach(function(c){ if (!hit && (c.name || c.n).toLowerCase() === l){ o.characters.push({ id: c.id, name: c.name || c.n }); hit = true; } });
      if (!hit) for (var k in u.sys){ if (u.sys[k].n.toLowerCase() === l){ o.systems.push({ id: +k, name: u.sys[k].n }); hit = true; break; } }
      if (!hit) for (var r in u.reg){ if (u.reg[r].n.toLowerCase() === l){ o.regions.push({ id: +r, name: u.reg[r].n }); break; } } });
    Object.keys(o).forEach(function(k){ if (!o[k].length) delete o[k]; });
    return o;
  }

  /* ---------- 3) Demo-Händler ---------- */
  function res(body, status, hdr){
    status = status || 200; var txt = typeof body === "string" ? body : JSON.stringify(body), h = Object.assign({ "content-type": "application/json", "last-modified": new Date(NOW - 60000).toUTCString(), expires: new Date(NOW + 300000).toUTCString() }, hdr || {});
    var r = { ok: status >= 200 && status < 300, status: status, statusText: String(status), url: "", headers: { get: function(k){ return h[String(k).toLowerCase()] || null; }, has: function(k){ return String(k).toLowerCase() in h; } },
      json: function(){ return Promise.resolve(JSON.parse(txt)); }, text: function(){ return Promise.resolve(txt); }, clone: function(){ return res(body, status, hdr); } };
    return Promise.resolve(r);
  }
  function pages(list, url, per){ per = per || 1000; var p = +((/[?&]page=(\d+)/.exec(url) || [0, 1])[1]), n = Math.max(1, Math.ceil(list.length / per)); return res(list.slice((p - 1) * per, p * per), 200, { "x-pages": String(n) }); }
  function q(url, k){ var m = new RegExp("[?&]" + k + "=([^&]*)").exec(url); return m ? decodeURIComponent(m[1]) : null; }
  function esi(path, url, opts){
    var m, body = opts && opts.body ? (function(){ try{ return JSON.parse(opts.body); }catch(e){ return null; } })() : null, u = uni();
    if (path === "/status/") return res({ players: 23817, server_version: "2980921", start_time: iso(NOW - 7 * H) });
    if ((m = /^\/characters\/(\d+)\/$/.exec(path))) return BYCH[m[1]] ? res({ name: BYCH[m[1]].name, corporation_id: CORP.id, birthday: "2019-05-14T18:22:00Z", security_status: 2.4, gender: "female", race_id: 1 }) : res({ error: "not found" }, 404);
    if ((m = /^\/characters\/(\d+)\/(.*)$/.exec(path))){
      var cid = +m[1], sub = m[2], c = BYCH[cid]; if (!c) return res({ error: "forbidden" }, 403);
      if (sub === "wallet/") return res(c.wallet);
      if (sub === "wallet/journal/") return pages(journalWithBalance(cid), url, 2500);
      if (sub === "wallet/transactions/") return res((TX[cid] || []).slice().sort(function(a, b){ return a.date < b.date ? 1 : -1; }));
      if (sub === "orders/") return res(MYORD.filter(function(o){ return o.cid === cid; }).map(function(o){ var x = Object.assign({}, o); delete x.pub; delete x.cid; return x; }));
      if (sub === "orders/history/") return pages(MYHIST.filter(function(o){ return o.cid === cid; }).map(function(o){ var x = Object.assign({}, o); delete x.pub; delete x.cid; return x; }), url);
      if (sub === "skills/") return res(skills(cid));
      if (sub === "skillqueue/") return res(queue(cid));
      if (sub === "attributes/") return res({ intelligence: 24, memory: 24, perception: 20, willpower: 20, charisma: 19, bonus_remaps: 1 });
      if (sub === "location/") return res({ solar_system_id: c.sys, station_id: c.st });
      if (sub === "ship/") return res({ ship_type_id: c.ship[0], ship_item_id: 1049000000000 + cid % 1000, ship_name: c.ship[1] });
      if (sub === "online/") return res({ online: cid !== CH[2].id, last_login: iso(NOW - 2 * H), last_logout: iso(NOW - 14 * H), logins: 812 });
      if (sub === "assets/") return pages(assets(cid), url);
      if (sub === "assets/names/") return res((body || []).map(function(i){ return { item_id: i, name: "None" }; }));
      if (sub === "assets/locations/") return res([]);
      if (sub === "implants/") return res(cid === KAEL ? [27104] : []);
      if (sub === "clones/") return res({ home_location: { location_id: JITA, location_type: "station" }, jump_clones: cid === CH[2].id ? [{ jump_clone_id: 1, location_id: 60008494, location_type: "station", implants: [] }] : [] });
      if (sub === "planets/") return res(cid === ARIA ? PLANETS.map(function(p){ var x = Object.assign({}, p); delete x._n; delete x._x; return x; }) : []);
      if ((m = /^planets\/(\d+)\/$/.exec(sub))) return planet(+m[1]) ? res(planet(+m[1])) : res({ error: "not found" }, 404);
      if (sub === "standings/") return res([{ from_id: 500001, from_type: "faction", standing: 3.2 }, { from_id: 1000035, from_type: "npc_corp", standing: 5.1 }]);
      if (sub === "industry/jobs/") return res(cid === ARIA ? [{ job_id: 51001, activity_id: 1, blueprint_type_id: 2049, blueprint_id: 1, blueprint_location_id: JITA, product_type_id: 2048, runs: 10, status: "active", start_date: iso(NOW - 3 * H), end_date: iso(NOW + 5 * H), facility_id: JITA, station_id: JITA, output_location_id: JITA, installer_id: cid, duration: 8 * 3600, cost: 125000 }] : []);
      return res([]);   // contracts, contacts, blueprints, mining, fittings …
    }
    if ((m = /^\/corporations\/(\d+)\/$/.exec(path))) return res(+m[1] === CORP.id ? { name: CORP.name, ticker: CORP.ticker, member_count: 3, ceo_id: ARIA } : PCORP[m[1]] ? { name: PCORP[m[1]], ticker: PCORP[m[1]].replace(/[^A-Z]/g, "").slice(0, 5), member_count: 40 } : { name: "Unbekannt", ticker: "?" });
    if (/^\/corporations\//.test(path)) return res([], 403);
    if (path === "/characters/affiliation/") return res((body || []).map(function(id){ var p = PIL.filter(function(x){ return x.id === id; })[0]; return { character_id: id, corporation_id: p ? p.corp : CORP.id }; }));
    if (path === "/universe/names/") return res((body || []).map(nameOf).filter(Boolean));
    if (path === "/universe/ids/") return res(idsOf(body || []));
    if ((m = /^\/universe\/types\/(\d+)\/$/.exec(path))){ var t = T[m[1]], dg = DOGMA[m[1]]; if (!t) return res({ error: "Type not found" }, 404);
      return res({ type_id: t.id, name: t.n, description: "", group_id: t.g, market_group_id: t.p ? 1000 + t.g : undefined, volume: t.v, packaged_volume: t.v, published: true, mass: dg && dg.m || 0, capacity: dg && dg.c || 0,
        dogma_attributes: dg ? Object.keys(dg.a).map(function(k){ return { attribute_id: +k, value: dg.a[k] }; }) : t.skill ? [{ attribute_id: 275, value: 2 }, { attribute_id: 180, value: 165 }, { attribute_id: 181, value: 166 }] : [], dogma_effects: [] }); }
    if ((m = /^\/universe\/groups\/(\d+)\/$/.exec(path))){ var g = GRP[m[1]] || ["Gruppe " + m[1], 4]; return res({ group_id: +m[1], name: g[0], category_id: g[1], published: true, types: Object.keys(T).filter(function(k){ return T[k].g === +m[1]; }).map(Number) }); }
    if ((m = /^\/universe\/categories\/(\d+)\/$/.exec(path))) return res({ category_id: +m[1], name: CAT[m[1]] || "Kategorie", groups: Object.keys(GRP).filter(function(k){ return GRP[k][1] === +m[1]; }).map(Number), published: true });
    if (path === "/universe/systems/") return res(Object.keys(u.sys).map(Number));
    if ((m = /^\/universe\/systems\/(\d+)\/$/.exec(path))){ var s = u.sys[m[1]]; if (!s) return res({ error: "not found" }, 404);
      var gates = []; Object.keys(u.gate).forEach(function(gid){ if (u.gate[gid][0] === s.id) gates.push(+gid); });
      return res({ system_id: s.id, name: s.n, security_status: s.s, constellation_id: s.c, star_id: 40000000 + s.id % 1000000, position: { x: s.x * 1e14, y: 0, z: -s.y * 1e14 }, stargates: gates,
        stations: Object.keys(STATIONS).filter(function(k){ return STATIONS[k][1] === s.id; }).map(Number), planets: [] }); }
    if ((m = /^\/universe\/stargates\/(\d+)\/$/.exec(path))){ var gt = u.gate[m[1]]; return gt ? res({ stargate_id: +m[1], system_id: gt[0], name: "Stargate (" + (u.sys[gt[1]] || {}).n + ")", destination: { system_id: gt[1], stargate_id: +m[1] ^ 1 } }) : res({}, 404); }
    if ((m = /^\/universe\/constellations\/(\d+)\/$/.exec(path))){ var co = u.con[m[1]]; return co ? res({ constellation_id: co.id, name: co.n, region_id: co.r, systems: co.sys }) : res({}, 404); }
    if (path === "/universe/regions/") return res(Object.keys(u.reg).map(Number));
    if ((m = /^\/universe\/regions\/(\d+)\/$/.exec(path))){ var rg = u.reg[m[1]]; return rg ? res({ region_id: rg.id, name: rg.n, constellations: rg.con }) : res({}, 404); }
    if ((m = /^\/universe\/planets\/(\d+)\/$/.exec(path))){ var pp = PLANETS.filter(function(x){ return x.planet_id === +m[1]; })[0]; return pp ? res({ planet_id: pp.planet_id, name: pp._n, system_id: pp.solar_system_id, type_id: pp.planet_type === "barren" ? 2016 : 11 }) : res({}, 404); }
    if ((m = /^\/universe\/stations\/(\d+)\/$/.exec(path))){ var st = STATIONS[m[1]]; return st ? res({ station_id: +m[1], name: st[0], system_id: st[1], type_id: st[2], owner: 1000035, services: ["market"] }) : res({}, 404); }
    if (/^\/universe\/structures\//.test(path)) return res({ error: "forbidden" }, 403);
    if (path === "/universe/system_kills/"){ var k = [[30000142, 3, 0, 1], [30002813, 7, 12, 4], [30002812, 2, 5, 1], [30000144, 1, 0, 0], [30002187, 2, 3, 0], [30002659, 1, 0, 0]]; return res(k.map(function(x){ return { system_id: x[0], ship_kills: x[1], npc_kills: x[2], pod_kills: x[3] }; })); }
    if (path === "/universe/system_jumps/") return res([[30000142, 2210], [30000144, 1980], [30002187, 1610], [30002813, 640], [30002659, 820]].map(function(x){ return { system_id: x[0], ship_jumps: x[1] }; }));
    if ((m = /^\/route\/(\d+)\/(\d+)/.exec(path))){ var rt = route(+m[1], +m[2], body && body.preference, body && body.avoid_systems, body && body.connections); return rt ? res({ route: rt }) : res({ error: "No route found" }, 404); }
    if ((m = /^\/markets\/(\d+)\/orders\/$/.exec(path))){ var reg = +m[1], ty = q(url, "type_id"), ot = q(url, "order_type") || "all";
      var L = book(reg).filter(function(o){ return (!ty || o.type_id === +ty) && (ot === "all" || (ot === "buy") === o.is_buy_order); }); return pages(L, url); }
    if ((m = /^\/markets\/(\d+)\/history\/$/.exec(path))) return res(hist(+m[1], +q(url, "type_id")));
    if (path === "/markets/prices/") return res(Object.keys(T).filter(function(k){ return T[k].p; }).map(function(k){ return { type_id: +k, average_price: T[k].p, adjusted_price: T[k].p * .95 }; }));
    if ((m = /^\/contracts\/public\/(\d+)\/$/.exec(path))) return pages(+m[1] === FORGE ? [[60003760, 60008494, 18e6, 450e6, 120000], [60003760, 60011866, 9.5e6, 120e6, 30000], [60003466, 60004588, 6.1e6, 2.1e9, 340000], [60003760, 60005686, 11e6, 80e6, 12000]].map(function(x, i){
      return { contract_id: 190000001 + i, type: "courier", issuer_id: PIL[i].id, issuer_corporation_id: PIL[i].corp, start_location_id: x[0], end_location_id: x[1], reward: x[2], collateral: x[3], volume: x[4], days_to_complete: 3, date_issued: iso(NOW - (i + 1) * 5 * H), date_expired: iso(NOW + (6 - i) * D), title: i === 2 ? "fragile" : "" }; }) : [], url);
    if (path === "/sovereignty/map/" || path === "/insurance/prices/" || /^\/dogma\//.test(path)) return res(/^\/dogma\//.test(path) ? { error: "not found" } : [], /^\/dogma\//.test(path) ? 404 : 200);
    if (/^\/ui\//.test(path)) return res({ error: "Demo" }, 403);
    DEMO.log.push("ESI? " + path);
    return res([]);
  }
  var realFetch = window.fetch;
  window.fetch = function(input, opts){
    var url = String(input && input.url || input), m;
    if ((m = /^https:\/\/esi\.evetech\.net(?:\/latest)?(\/[^?]*)/.exec(url))) return esi(m[1], url, opts);
    if (/^https:\/\/login\.eveonline\.com\//.test(url)) return res({ error: "invalid_request", error_description: "Demo – kein Login" }, 400);
    if (/zkillboard\.com\/api\/stats\/characterID\/(\d+)/.test(url)){ var p = PIL.filter(function(x){ return x.id === +RegExp.$1; })[0]; return res(p ? { shipsDestroyed: p.kills, shipsLost: Math.round(p.kills / 4) + 2, dangerRatio: p.danger, gangRatio: 100 - p.danger / 2, soloKills: Math.round(p.kills / 9), iskDestroyed: p.kills * 6.5e7, iskLost: p.kills * 1e7, activepvp: { kills: { count: Math.round(p.kills / 20) } }, topLists: [] } : {}); }
    if (/zkillboard\.com|r2z2\.zkillboard\.com/.test(url)) return res([], 200);
    if (/api\.eve-scout\.com/.test(url)) return res([{ id: "1", signature_type: "wormhole", out_system_id: 31000005, out_system_name: "Thera", out_signature: "ABC-123", in_system_id: 30002813, in_system_name: "Tama", in_system_class: "ls", in_region_name: "The Citadel", in_signature: "XYZ-987", max_ship_size: "large", remaining_hours: 11, expires_at: iso(NOW + 11 * H) },
      { id: "2", signature_type: "wormhole", out_system_id: 31000005, out_system_name: "Thera", out_signature: "QWE-456", in_system_id: 30002187, in_system_name: "Amarr", in_system_class: "hs", in_region_name: "Domain", in_signature: "RTY-654", max_ship_size: "medium", remaining_hours: 4, expires_at: iso(NOW + 4 * H) }]);
    if (/omni\.nareya79\.com\/version\.json|api\.github\.com/.test(url)) return res({}, 404);
    if (/^https?:\/\//.test(url)){ DEMO.log.push("gesperrt " + url.slice(0, 120)); return Promise.reject(new TypeError("Demo: keine Verbindung nach draußen")); }
    return realFetch.apply(this, arguments);   // file://, data:
  };

  /* ---------- 2) Beispieldaten in den Demo-Speicher (nur Hauptfenster) ---------- */
  function jwt(c){ return "x." + b64(JSON.stringify({ sub: "CHARACTER:EVE:" + c.id, name: c.name, scp: [], exp: Math.floor((NOW + 3650 * D) / 1000) })) + ".demo"; }
  mkTrades();
  if (!SAT){
    var keep = {}; ["eve-zentrale-lang-v1", "eve-zentrale-clientlang-v1"].forEach(function(k){ var v = realLS.getItem(k); if (v !== null) keep[k] = v; });
    var LS = window.localStorage; LS.clear(); window.sessionStorage.clear();
    var put = function(k, v){ LS.setItem(k, typeof v === "string" ? v : JSON.stringify(v)); };
    Object.keys(keep).forEach(function(k){ put(k, keep[k]); });
    put("eve-zentrale-welcome-v1", "done");
    put("eve-zentrale-characters", CH.map(function(c){ return { access_token: jwt(c), refresh_token: "demo", expires_at: NOW + 3650 * D, character_id: String(c.id), character_name: c.name, client_id: "demo" }; }));
    put("eve-zentrale-active-char", String(ARIA)); put("eve-zentrale-hauler-char", String(KAEL)); put("eve-zentrale-jump-pilot", String(CH[2].id));
    put("eve-zentrale-trades-v1", TRADES);
    put("eve-zentrale-owned-ships-v1", ["Charon (Caldari)", "Bustard (Caldari)", "Badger (Caldari)", "Tayra (Caldari)"]);
    put("eve-zentrale-hubhandel-v1", { src: "jita", dst: ["amarr", "dodixie"], ship: "Charon (Caldari)", cargo: "435.000", budget: "800.000.000", depth: "300", tax: "3.375", sellmode: "instant", selldays: "7", extra: "5" });
    put("eve-zentrale-haulruns-v1", [{ id: (NOW - 3 * H) + "-60008494", from: JITA, fromName: "Jita IV - Moon 4 - Caldari Navy Assembly Plant", to: 60008494, toName: "Amarr VIII (Oris) - Emperor Family Academy", charId: String(KAEL), charName: "Kael Demo", sm: "instant",
      items: [{ tid: 2048, name: "Damage Control II", q: 60, sp: 61200000, p: 7900000 }, { tid: 3841, name: "Large Shield Extender II", q: 40, sp: 207900000, p: 31400000 }, { tid: 4405, name: "Drone Damage Amplifier II", q: 80, sp: 183800000, p: 24100000 }],
      created: NOW - 3 * H, status: "active", ship: "Charon (Caldari)", buyDone: true }]);
    put("eve-zentrale-routeplanner-v1", { from: "Jita", to: "Amarr", pref: "secure" });
    put("eve-zentrale-kurier-v1", [{ id: 190000001, src: "merk", st: "gemerkt", from: "Jita IV - Moon 4 - Caldari Navy Assembly Plant", to: "Amarr VIII (Oris) - Emperor Family Academy", fl: JITA, tl: 60008494, rew: 18e6, col: 450e6, vol: 120000, days: 3, exp: NOW + 6 * D, t: NOW - H }]);
    put("eve-zentrale-gksafe-v1", { is: true, hl: true });
  }
  DEMO.chars = CH; DEMO.trades = TRADES;

  /* ---------- 4) Bilder, Banner, gesperrte Knöpfe ---------- */
  var DEMO_IDS = {}; CH.forEach(function(c){ DEMO_IDS[c.id] = [c.name, c.col]; }); DEMO_IDS[CORP.id] = [CORP.ticker, "#2f6f5f"];
  PIL.forEach(function(p, i){ DEMO_IDS[p.id] = [p.n, ["#8a4b4b", "#4b6a8a", "#6a8a4b", "#8a7a4b", "#5b4b8a"][i % 5]]; }); Object.keys(PCORP).forEach(function(k){ DEMO_IDS[k] = [PCORP[k], "#444c55"]; });
  function initials(n){ return String(n).split(/\s+/).map(function(w){ return w.charAt(0); }).join("").slice(0, 2).toUpperCase(); }
  function face(id){ var x = DEMO_IDS[id]; if (!x) return null;
    return "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#0d141c"/><circle cx="32" cy="32" r="28" fill="' + x[1] + '"/><text x="32" y="40" font-family="Segoe UI,Arial" font-size="22" font-weight="700" fill="#fff" text-anchor="middle">' + initials(x[0]) + "</text></svg>"); }
  var IMG_RE = /images\.evetech\.net\/(characters|corporations|alliances)\/(\d+)\//;
  function fixImg(img){ var s = img.getAttribute("src") || "", m = IMG_RE.exec(s); if (!m) return; var f = face(m[2]); img.setAttribute("src", f || "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#26303a"/></svg>')); }
  function scan(root){ if (root.tagName === "IMG") fixImg(root); if (root.querySelectorAll) root.querySelectorAll('img[src*="images.evetech.net/"]').forEach(fixImg); }
  function fixStr(h){ return typeof h === "string" && h.indexOf("images.evetech.net/") >= 0 ? h.replace(/https:\/\/images\.evetech\.net\/(characters|corporations|alliances)\/(\d+)\/[^"'\s)]*/g, function(all, k, id){ return face(id) || all; }) : h; }
  (function(){
    var E = Element.prototype, ih = Object.getOwnPropertyDescriptor(E, "innerHTML"), oh = Object.getOwnPropertyDescriptor(E, "outerHTML"), ia = E.insertAdjacentHTML, sa = E.setAttribute;
    if (ih) Object.defineProperty(E, "innerHTML", { configurable: true, get: ih.get, set: function(v){ ih.set.call(this, fixStr(v)); } });
    if (oh) Object.defineProperty(E, "outerHTML", { configurable: true, get: oh.get, set: function(v){ oh.set.call(this, fixStr(v)); } });
    E.insertAdjacentHTML = function(pos, h){ return ia.call(this, pos, fixStr(h)); };
    E.setAttribute = function(n, v){ return sa.call(this, n, n === "src" || n === "href" || n === "style" ? fixStr(String(v)) : v); };
    var sd = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src"); if (sd) Object.defineProperty(HTMLImageElement.prototype, "src", { configurable: true, get: sd.get, set: function(v){ sd.set.call(this, fixStr(String(v))); } });
  })();
  try{ new MutationObserver(function(ms){ ms.forEach(function(m){ if (m.type === "attributes") fixImg(m.target); else m.addedNodes.forEach(function(n){ if (n.nodeType === 1) scan(n); }); }); })
    .observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["src"] }); }catch(e){}
  DEMO.face = face;
  // Knöpfe, die in der Demo nichts tun dürfen (Login, Sicherung, Sync, EVE starten/beenden, Autopilot, Fenster in EVE …)
  var BLOCK = '#sso-login-btn,#sso-paste-btn,[data-chdel],[data-chlogout],#win-eve,#win-eve-q,[data-mk],[data-ap],[data-apdest],[data-rt-ap],[data-tsc-mk],' +
    '[data-ova="rtEve"],[data-ova="rtAp"],[data-ova="coEve"],[data-ova="coDest"],[data-ova="ckEve"],[data-ova="ckDest"],[data-ova="hcEve"],[data-ova="mkOpen"],[data-ova="miEve"],[data-ova="jpDest"],[data-ck="Eve"],[data-ck="Dest"],' +
    '#bk-export,#bk-import,#bk-now,#bk-dir,#data-export,#data-import,#sync-bat,#sync-now,#sync-direct,[data-sync],[data-backup],[data-wl="login"],#rt-ap,#rt-eve,#rt-dest,#jp-ap';
  function toast(t){ var d = document.createElement("div"); d.className = "demo-toast"; d.textContent = t; document.body.appendChild(d); setTimeout(function(){ d.remove(); }, 2200); }
  DEMO.blocked = BLOCK; DEMO.toast = toast;
  document.addEventListener("click", function(ev){ var b = ev.target && ev.target.closest && ev.target.closest(BLOCK); if (!b) return; ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation(); toast("In der Demo nicht möglich"); }, true);
  function end(){ var u = new URL(location.href); u.searchParams.delete("demo"); location.href = u.toString(); }
  DEMO.end = end;
  function ui(){
    var css = document.createElement("style");
    css.textContent = "html.demo body{padding-top:" + (SAT ? 0 : 26) + "px}.demo-bar{position:fixed;top:0;left:0;right:0;height:26px;z-index:9500;display:flex;align-items:center;justify-content:center;gap:14px;background:#b8860b;color:#111;font:600 13px 'Segoe UI',sans-serif;letter-spacing:.04em;-webkit-app-region:no-drag}" +
      ".demo-bar button{font:inherit;font-weight:600;padding:1px 10px;border:1px solid #111;background:#111;color:#f3d27a;border-radius:3px;cursor:pointer}.demo-tag{display:inline-block;margin:0 6px;padding:0 5px;border-radius:3px;background:#b8860b;color:#111;font:700 10px 'Segoe UI',sans-serif;letter-spacing:.06em;vertical-align:middle}" +
      ".demo-toast{position:fixed;left:50%;bottom:30px;transform:translateX(-50%);z-index:9600;background:#1b222b;color:#f3d27a;border:1px solid #b8860b;padding:8px 16px;border-radius:4px;font:13px 'Segoe UI',sans-serif}" +
      "html.demo header.top{top:26px !important}";
    document.head.appendChild(css);
    if (!SAT){ var bar = document.createElement("div"); bar.className = "demo-bar"; bar.innerHTML = "<span>DEMO – erfundene Daten</span>"; var b = document.createElement("button"); b.type = "button"; b.textContent = "Demo beenden"; b.onclick = end; bar.appendChild(b); document.body.appendChild(bar); }
    else { var put2 = function(){ var t = document.querySelector("#ov-tabs, .ov-bar"); if (t && !t.querySelector(".demo-tag")){ var s = document.createElement("span"); s.className = "demo-tag"; s.textContent = "DEMO"; t.insertBefore(s, t.firstChild); } }; put2(); setInterval(put2, 1500); }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ui); else ui();
})();
