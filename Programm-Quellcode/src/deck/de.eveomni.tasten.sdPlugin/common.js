/* SD-C: Listen für Plugin und Einstellungsfenster (eine Stelle). [id, Text, Symbol, drücken-Standard] */
window.EO = {
  VIEWS: [["trades", "Trades"], ["track", "Watchlist"], ["route", "Navigation"], ["karte", "Karte"], ["radar", "Radar"], ["dscan", "D-Scan"], ["uhr", "Uhr & Timer"], ["mining", "Mining"],
    ["skills", "Skills"], ["wallet", "Wallet"], ["handel", "Handel"], ["local", "Local Report"], ["musik", "Jukebox"], ["notiz", "Notizen"], ["assets", "Assets"], ["industrie", "Industrie"],
    ["appraisal", "Wertschätzer"], ["courier", "Kurier"], ["chars", "Charaktere"], ["pi", "Planeten"], ["alarm", "Alert"], ["gangreport", "Gang-Report"], ["leistung", "Leistung"], ["scanner", "Scanner-Plan"]],
  // Aktionen: Befehl an EVE Omni; open = Overlay dazu öffnen (Ergebnis sehen)
  ACTS: [
    ["ov", "Overlay ein/aus", null],
    ["all", "Alle Overlays zeigen/verstecken", "i:evecore", { type: "toggleAll" }],
    ["ct", "Durchklicken an/aus", "i:settings", { type: "clickThrough" }],
    ["main", "Hauptfenster", "i:evecore", { type: "showMain" }],
    ["local", "Local prüfen (Zwischenablage)", "local", { type: "ltClip", open: "local" }],
    ["dscan", "D-Scan auswerten (Zwischenablage)", "dscan", { type: "dsClip", open: "dscan" }],
    ["radar", "Radar scannen", "radar", { type: "radarGo", open: "radar" }],
    ["refresh", "Trades/Läufe aktualisieren", "trades", { type: "refresh", arg: "trades" }],
    ["route", "Route → EVE (Wegpunkte)", "route", { type: "rtEve" }],
    ["appraisal", "Wertschätzer (Zwischenablage)", "appraisal", { type: "apClip", open: "appraisal" }],
    ["timer", "Timer starten", "uhr", null],
    ["dt", "Downtime-Alarm an/aus", "uhr", { type: "tmDt" }],
    ["jbToggle", "Jukebox Play/Pause", "musik", { type: "jb", cmd: "toggle" }],
    ["jbNext", "Jukebox weiter", "musik", { type: "jb", cmd: "next" }],
    ["jbPrev", "Jukebox zurück", "musik", { type: "jb", cmd: "prev" }]
  ],
  // Anzeigen: [id, Text, Symbol, Overlay beim Drücken (Standard), Charakter wählbar]
  SHOWS: [
    ["clock", "Uhrzeit (EVE/Ort)", "uhr", "uhr"],
    ["dt", "Countdown Downtime", "uhr", "uhr"],
    ["tm", "Nächster Timer", "uhr", "uhr"],
    ["moon", "Nächster Mond-Brocken", "mining", "mining"],
    ["ob", "Überbotene Trades", "trades", "trades"],
    ["act", "Aktive Trades/Läufe", "track", "track"],
    ["wal", "Wallet", "wallet", "wallet", true],
    ["al", "Alert (Feind in X Sprüngen)", "alarm", "alarm", true],
    ["loc", "Local-Rotlichter", "local", "local"],
    ["jb", "Jukebox-Titel", "musik", "musik"],
    ["mine", "Mining heute", "mining", "mining", true],
    ["sk", "Skill-Warteschlange", "skills", "skills", true],
    ["pfCpu", "PC: CPU + Temperatur", "leistung", "leistung"],
    ["pfRam", "PC: RAM", "leistung", "leistung"],
    ["pfGpu", "PC: GPU + Temperatur", "leistung", "leistung"],
    ["pfPing", "Ping", "leistung", "leistung"],
    ["pfSrv", "EVE-Server / Spieler", "leistung", "leistung"]
  ]
};
// ZZ3: Englisch – Sprache kommt von EVE Omni (st.lang), vorher aus config.js (bei der Installation geschrieben)
EO.lang = (window.EVEOMNI && window.EVEOMNI.lang) || "de";
EO.t = function(s){ return EO.lang === "en" && EO.EN[s] != null ? EO.EN[s] : s; };
EO.EN = {
  "Trades": "Trades", "Watchlist": "Watchlist", "Navigation": "Navigation", "Karte": "Map", "Radar": "Radar", "D-Scan": "D-Scan", "Uhr & Timer": "Clock & timers", "Uhr": "Clock", "Mining": "Mining",
  "Skills": "Skills", "Wallet": "Wallet", "Handel": "Hauling", "Local Report": "Local report", "Local": "Local", "Jukebox": "Jukebox", "Notizen": "Notes", "Assets": "Assets", "Industrie": "Industry",
  "Wertschätzer": "Appraisal", "Kurier": "Courier", "Charaktere": "Characters", "Planeten": "Planets", "Alert": "Alert", "Gang-Report": "Gang report", "Gang": "Gang", "Leistung": "Performance", "Scanner-Plan": "Scanner plan",
  "Overlay ein/aus": "Overlay on/off", "Alle Overlays zeigen/verstecken": "Show/hide all overlays", "Durchklicken an/aus": "Click-through on/off", "Hauptfenster": "Main window",
  "Local prüfen (Zwischenablage)": "Check Local (clipboard)", "D-Scan auswerten (Zwischenablage)": "Evaluate D-Scan (clipboard)", "Radar scannen": "Scan radar", "Trades/Läufe aktualisieren": "Refresh trades/runs",
  "Route → EVE (Wegpunkte)": "Route → EVE (waypoints)", "Wertschätzer (Zwischenablage)": "Appraisal (clipboard)", "Timer starten": "Start timer", "Downtime-Alarm an/aus": "Downtime alarm on/off",
  "Jukebox Play/Pause": "Jukebox play/pause", "Jukebox weiter": "Jukebox next", "Jukebox zurück": "Jukebox back",
  "Uhrzeit (EVE/Ort)": "Time (EVE/local)", "Countdown Downtime": "Downtime countdown", "Nächster Timer": "Next timer", "Nächster Mond-Brocken": "Next moon chunk", "Überbotene Trades": "Outbid trades",
  "Aktive Trades/Läufe": "Active trades/runs", "Alert (Feind in X Sprüngen)": "Alert (enemy X jumps away)", "Local-Rotlichter": "Local reds", "Jukebox-Titel": "Jukebox track", "Mining heute": "Mining today",
  "Skill-Warteschlange": "Skill queue", "PC: CPU + Temperatur": "PC: CPU + temperature", "PC: RAM": "PC: RAM", "PC: GPU + Temperatur": "PC: GPU + temperature", "Ping": "Ping", "EVE-Server / Spieler": "EVE server / players",
  // Tasten
  "Alle Overlays": "All overlays", "Durchklicken": "Click-through", "Local prüfen": "Check Local", "Aktualisieren": "Refresh", "DT-Alarm": "DT alarm", "Weiter": "Next", "Zurück": "Back",
  "jetzt": "now", "T ": "d ", "Downtime": "Downtime", " · Alarm an": " · alarm on", "kein Timer": "no timer", "kein Mond-Brocken": "no moon chunk", "überboten": "outbid", "nicht überboten": "not outbid",
  "Trades / Läufe": "Trades / runs", "Wallet einmal laden": "load wallet once", "Wallet gesamt": "Wallet total", "Charakter": "Character", " Sprung": " jump", " Spr.": " jumps", "ruhig": "quiet", "kein Alert": "no alert",
  "rot · ": "red · ", " in Local": " in Local", "Local nicht geprüft": "Local not checked", "leer": "empty", "keine Charaktere": "no characters", "Tranquility · ": "Tranquility · ", "nur VIP": "VIP only", "online": "online",
  "Server nicht erreichbar": "server not reachable", "Server": "Server", "drücken": "press", "an": "on", "aus": "off", "Alarm an": "alarm on", "Alarm aus": "alarm off", " überboten": " outbid", "nichts überboten": "nothing outbid",
  " rot": " red", "EVE Omni offline": "EVE Omni offline", "Overlay": "Overlay", "Aktion": "Action", "offen": "open", "zu": "closed", " Min.": " min", "drücken = starten": "press = start", "keine Musik": "no music",
  "läuft": "playing", "Pause": "paused", "EVE-Zeit": "EVE time", "Ortszeit": "Local time", "EVE ": "EVE ", "DT ": "DT ", "Downtime-Alarm an": "Downtime alarm on", "Downtime-Alarm aus": "Downtime alarm off",
  "Lautstärke": "Volume", "Deckkraft": "Opacity", "Deckkraft ": "Opacity ", "Overlays": "Overlays", "Timer": "Timer",
  " Bio.": " T", " Mrd.": " B", " Mio.": " M", " Tsd.": " k",
  // Einstellungsfenster
  "Anzeige": "Display", "alle": "all", "Minuten": "Minutes", "Name des Timers (leer = „Stream-Taste … Min.“)": "Timer name (empty = “Stream key … min”)", "Drücken": "Press", "Passendes Overlay öffnen": "Open matching overlay",
  "(gespeicherter Charakter)": "(saved character)", " EVE Omni muss laufen (Einstellungen › Programm › Stream-Tasten an).": " EVE Omni must be running (Settings › EVE Omni › Stream keys on).",
  "h_overlay": "Press to show or hide the chosen overlay window. Open = frame in the icon colour.", "h_timer": "Press to start a timer in the EVE Omni clock. The key shows the next running timer.",
  "h_jukebox": "Press = open/close the Jukebox overlay. The key shows the track and playing/paused (play/pause is on the dial).", "h_clock": "Shows the time (as set in EVE Omni), your running timer or the countdown to downtime. Press opens the clock overlay.",
  "h_action": "Press triggers the chosen action in EVE Omni. Actions with “clipboard”: copy in EVE first (Ctrl+A, Ctrl+C), then press the key.",
  "h_dialJb": "Turn = volume, press = play/pause. The strip shows the track, while turning the volume for 1 s.", "h_dialAlpha": "Turn = opacity of all overlays in 5 % steps (individual overlay values follow), press = all 100 %.",
  "h_dialOv": "Turn = page through all overlays, press = open the chosen one (or close it if open).", "h_dialTimer": "Turn = minutes (1–120), press = start timer. The strip shows the running timer.",
  "h_display": "Shows the chosen value live. Red = attention (blinks for outbid trades and nearby enemies). Press opens the matching overlay – or the action you pick below (combo key)."
};
