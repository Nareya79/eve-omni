/* Einstellungen einer Taste (Property Inspector): Overlay, Timer-Minuten, Aktion, Anzeige, Charakter – gespeichert in der Tasten-Software */
(function(){
  "use strict";
  var HINT = { overlay: "Drücken blendet das gewählte Overlay-Fenster ein oder aus. Offen = Rahmen in der Symbolfarbe.", timer: "Drücken startet einen Timer in der EVE-Omni-Uhr. Die Taste zeigt den nächsten laufenden Timer.",
    jukebox: "Drücken = Abspielen/Anhalten. Die Taste zeigt den Titel.", clock: "Zeigt die Uhrzeit (wie in EVE Omni eingestellt), deinen laufenden Timer bzw. den Countdown bis zur Downtime. Drücken öffnet das Uhr-Overlay.",
    action: "Drücken löst die gewählte Aktion in EVE Omni aus. Aktionen mit „Zwischenablage“: erst in EVE kopieren (Strg+A, Strg+C), dann die Taste drücken.",
    dialJb: "Drehen = Lautstärke, drücken = Jukebox-Overlay öffnen bzw. schließen. Der Streifen zeigt den Titel, beim Drehen 1 s lang nur die Lautstärke.", dialAlpha: "Drehen = Deckkraft aller Overlays in 5-%-Schritten (eigene Werte einzelner Overlays gehen mit), drücken = alle 100 %.",
    dialOv: "Drehen = durch alle Overlays blättern, drücken = das gewählte öffnen bzw. (wenn schon offen) schließen.", dialTimer: "Drehen = Minuten (1–120), drücken = Timer starten. Der Streifen zeigt den laufenden Timer.",
    display: "Zeigt den gewählten Wert live. Rot = Achtung (blinkt bei überbotenen Trades und nahem Feind). Drücken öffnet das passende Overlay – oder die Aktion, die du darunter wählst (Kombi-Taste)." };
  var sock, uuid, kind = "", settings = {}, charSet = {};
  function $(id){ return document.getElementById(id); }
  function opts(list, first){ return (first ? '<option value="">' + first + "</option>" : "") + list.map(function(v){ return '<option value="' + v[0] + '">' + v[1] + "</option>"; }).join(""); }
  function vis(){
    var act = $("act").value, show = $("show").value, sh = EO.SHOWS.filter(function(x){ return x[0] === show; })[0];
    $("f-show").hidden = kind !== "display"; $("f-char").hidden = kind !== "display" || !(sh && sh[4]);
    $("f-act").hidden = kind !== "action" && kind !== "display";
    $("f-view").hidden = !(kind === "overlay" || ((kind === "action" || kind === "display") && act === "ov"));
    $("f-min").hidden = $("f-name").hidden = !(kind === "timer" || kind === "dialTimer" || ((kind === "action" || kind === "display") && act === "timer"));
  }
  function save(){
    settings = { view: $("view").value, min: Math.max(1, Math.min(10080, Number($("min").value) || 5)), name: $("name").value.trim() };
    if (kind === "action") settings.act = $("act").value || "ov";
    if (kind === "display"){ settings.show = $("show").value; settings.act = $("act").value; settings.char = $("char").value; }
    vis(); if (sock) sock.send(JSON.stringify({ event: "setSettings", context: uuid, payload: settings }));
  }
  $("view").innerHTML = opts(EO.VIEWS); $("show").innerHTML = opts(EO.SHOWS);
  ["view", "min", "name", "act", "show", "char"].forEach(function(id){ $(id).addEventListener("change", save); });
  // Charaktere einmal bei EVE Omni abfragen (gleicher Anschluss wie das Plugin)
  function chars(){
    var C = window.EVEOMNI; if (!C || !window.EventSource) return;
    var es = new EventSource("http://127.0.0.1:" + C.port + "/events?k=" + encodeURIComponent(C.key));
    es.onmessage = function(ev){ es.close(); var st = {}; try{ st = JSON.parse(ev.data); }catch(e){}
      ((st.x || {}).chars || []).forEach(function(c){ if (charSet[c.id]){ charSet[c.id].textContent = c.n; return; } var o = charSet[c.id] = document.createElement("option"); o.value = c.id; o.textContent = c.n; $("char").appendChild(o); });
      $("char").value = settings.char || ""; };
    es.onerror = function(){ es.close(); };
  }
  window.connectElgatoStreamDeckSocket = function(port, inUuid, registerEvent, info, actionInfo){
    uuid = inUuid; var ai = {}; try{ ai = JSON.parse(actionInfo); }catch(e){}
    kind = String(ai.action || "").split(".").pop(); settings = (ai.payload && ai.payload.settings) || {};
    $("act").innerHTML = kind === "display" ? opts(EO.ACTS, "Passendes Overlay öffnen") : opts(EO.ACTS);
    $("l-act").textContent = kind === "display" ? "Drücken" : "Aktion";
    $("hint").textContent = (HINT[kind] || "") + " EVE Omni muss laufen (Einstellungen › Programm › Stream-Tasten an).";
    $("view").value = settings.view || "trades"; $("min").value = settings.min || 5; $("name").value = settings.name || "";
    $("act").value = settings.act || (kind === "display" ? "" : "ov"); $("show").value = settings.show || "dt";
    if (settings.char && !charSet[settings.char]){ var o = charSet[settings.char] = document.createElement("option"); o.value = settings.char; o.textContent = "(gespeicherter Charakter)"; $("char").appendChild(o); }
    $("char").value = settings.char || "";
    vis(); if (kind === "display") chars();
    sock = new WebSocket("ws://127.0.0.1:" + port);
    sock.onopen = function(){ sock.send(JSON.stringify({ event: registerEvent, uuid: uuid })); };
  };
})();
