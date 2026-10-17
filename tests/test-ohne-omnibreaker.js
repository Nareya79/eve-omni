// 12.10.2026: OmniBreaker beim Installieren abwählbar – Merker-Datei ohne-omnibreaker → Spiel überall ausgeblendet
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
const mainJs = fs.readFileSync('/home/claude/main.js', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
function load(noGame){
  return new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
    beforeParse(w){
      w.fetch = () => Promise.reject(new Error('offline'));
      w.evecoreHost = { noGame: noGame, getSettings: () => Promise.resolve({ windows: {} }), setSettings: p => Promise.resolve(p), onCommand(){}, ready(){}, setMode(){} };
    } }).window;
}
const mit = load(false), ohne = load(true);
setTimeout(() => {
  try{
    ['neo-btn-game'].forEach(id => {   // UU3: Minispiel-Kasten in Einstellungen gibt es nicht mehr
      assert(mit.document.getElementById(id), 'mit Spiel: #' + id + ' da');
      assert(!ohne.document.getElementById(id), 'ohne Spiel: #' + id + ' weg');
    });
    new (require('vm').Script)('(function(require,module,exports,__dirname,__filename){' + mainJs + '\n})');   // 12.10.: Kommentar hatte „});“ verschluckt → Programm startete nicht
    assert(true, 'main.js lässt sich übersetzen');
    assert(/noGame: fs\.existsSync\(path\.join\(__dirname, 'ohne-omnibreaker'\)\)/.test(mainJs), 'main.js liest den Merker');
    console.log('\nALL OHNE-OMNIBREAKER TESTS PASSED'); process.exit(0);
  }catch(e){ console.log(e.message); process.exit(1); }
}, 900);
