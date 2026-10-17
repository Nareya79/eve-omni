#!/bin/sh
# Alle Tests auf dem Windows-PC des Nutzers (Git Bash) - ohne Claudes Linux-Sandbox.
# Biegt die fest eingetragenen Linux-Pfade um: /home/claude -> $W/home, /tmp/ -> $W/tmp/, Chromium -> lokaler Chrome.
# Einmalig (macht das Skript selbst): npm install jsdom playwright in $W/home.
# Aufruf aus dem Projektordner:  sh tests/run-local-windows.sh        (alle Reihen)
#                                sh tests/run-local-windows.sh test-neocom-frame.js   (nur eine Reihe)
W="$(cygpath -m "$HOME" 2>/dev/null || echo "$HOME")/.evecore-tests"   # Hilfsprogramme im Benutzerordner
CHROME="C:/Program Files/Google/Chrome/Application/chrome.exe"
P="$(cd "$(dirname "$0")/.." && pwd)"
export EVEOMNI_ROOT="$P"   # V8-Test prüft das echte Projekt
mkdir -p "$W/home" "$W/tmp" "$W/t"
if [ -d "$P/node_modules/playwright" ]; then export NODE_PATH="$(cygpath -m "$P" 2>/dev/null || echo "$P")/node_modules"   # V6/CI: jsdom + playwright aus der Sperrdatei (npm ci im Repo)
else [ -d "$W/home/node_modules/playwright" ] || (cd "$W/home" && npm init -y >/dev/null && npm install jsdom playwright >/dev/null 2>&1) || { echo "npm install fehlgeschlagen"; exit 1; }; fi
for f in "$P"/tests/*.js "$P"/tests/*.py; do
  sed -e "s#/home/claude#$W/home#g" -e "s#/tmp/#$W/tmp/#g" -e "s#/opt/pw-browsers/chromium#$CHROME#g" -e "s#file://$W#file:///$W#g" "$f" > "$W/t/$(basename "$f")"
done
cp "$P/EVE-Omni.html" "$W/home/EVECore.html"
cp "$P/Programm-Quellcode/src/umzug.js" "$P/Programm-Quellcode/src/main.js" "$P/Programm-Quellcode/src/browser.html" "$P/Programm-Quellcode/src/sync.js" "$P/Programm-Quellcode/src/evesave.js" "$P/Programm-Quellcode/src/helfer.cs" "$P/Programm-Quellcode/src/preload.js" "$P/Programm-Quellcode/src/discord.html" "$W/home/"   # BB0, DC: Datenumzug testen
rm -rf "$W/home/deck" && cp -r "$P/Programm-Quellcode/src/deck" "$W/home/deck"   # SD: Plugin für Stream-Tasten
(cd "$W/t" && python make_test_copy.py "$W/tmp/eve-zentrale-test14.html" >/dev/null) || { echo "Testkopie fehlgeschlagen"; exit 1; }
node -e "const s=require('fs').readFileSync('$W/home/EVECore.html','utf8');const i=s.lastIndexOf('<script>');new Function(s.slice(i+8,s.indexOf('</script>',i)));console.log('SYNTAX OK')" || exit 1
ok=0; bad=0
for t in ${1:-$(cd "$W/t" && ls test-*.js)}; do
  cp "$W/t/$t" "$W/home/__$t"
  r=$(cd "$W/home" && timeout 180 node "__$t" 2>&1 | tail -1); rm -f "$W/home/__$t"
  case "$r" in *PASSED) ok=$((ok+1));; *) bad=$((bad+1)); echo "ROT  $t: $r";; esac
done
echo "gruen: $ok  rot: $bad"
[ "$bad" = 0 ]
