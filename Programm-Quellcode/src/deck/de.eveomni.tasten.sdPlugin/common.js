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
