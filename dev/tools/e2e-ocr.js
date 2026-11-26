// Browser-Test der echten Texterkennung (Tesseract.js) an einer erzeugten zweisprachigen Vokabelliste.
// Benötigt die npm-Pakete lokal entpackt (kein Internet nötig):
//   tesseract.js@7.0.0, tesseract.js-core@7.0.0, @tesseract.js-data/{deu,eng,spa}
//   je mit `npm pack <paket>` herunterladen und nach $TESS_PK/x_<dateiname>/ entpacken.
// Aufruf: TESS_PK=/pfad/zu/paketen node dev/tools/e2e-ocr.js   (lokaler Server auf Port 8765)
const { chromium } = require('playwright'); const fs = require('fs');
const pk = process.env.TESS_PK; if (!pk) { console.error('TESS_PK nicht gesetzt'); process.exit(2); }
const T = pk + '/x_tesseract.js-7.0.0.tgz/package/dist/', C = pk + '/x_tesseract.js-core-7.0.0.tgz/package/';
let fails = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };
const VOC = [['la estación de esquí', 'das Skigebiet'], ['el equipo de fútbol', 'die Fußballmannschaft'], ['el kilómetro', 'der Kilometer'], ['el niño', 'das Kind'], ['la canción', 'das Lied'], ['el rascacielos', 'der Wolkenkratzer'], ['la feria artesanal', 'der Kunsthandwerkermarkt']];
const SENT = [['Cerca de Madrid hay una', 'In der Nähe von Madrid gibt es ein'], ['estación de esquí.', 'Skigebiet.']];
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1180, height: 820 } });
  await ctx.route('https://cdn.jsdelivr.net/**', route => {
    const u = route.request().url(); let f = null;
    if (u.includes('/tesseract.js@7.0.0/dist/') || u.includes('/tesseract.js@v7.0.0/dist/')) f = T + u.split('/dist/')[1];
    else if (u.includes('/tesseract.js-core@')) f = C + u.split('/').pop();
    else if (u.includes('@tesseract.js-data/')) { const m = /@tesseract\.js-data\/(\w+)\/(.*)$/.exec(u); f = `${pk}/x_tesseract.js-data-${m[1]}-1.0.0.tgz/package/${m[2]}`; }
    if (f && fs.existsSync(f)) return route.fulfill({ path: f, contentType: f.endsWith('.js') ? 'text/javascript' : f.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream' });
    route.abort();
  });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('http://127.0.0.1:8765/Tintenwerk.html'); await pg.waitForTimeout(400);
  const png = await pg.evaluate(({ VOC, SENT }) => {
    const c = document.createElement('canvas'); c.width = 1300; c.height = 980; const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
    x.strokeStyle = '#000'; x.lineWidth = 3; x.beginPath(); x.moveTo(640, 20); x.lineTo(640, 950); x.moveTo(60, 90); x.lineTo(1240, 90); x.stroke();
    x.font = 'italic 44px cursive'; x.fillStyle = '#111'; x.fillText('Spanish', 90, 75); x.fillText('Deutsch', 700, 75);
    x.font = '34px sans-serif'; VOC.forEach(([a, d], i) => { x.fillText(a, 90, 150 + i * 46); x.fillText(d, 680, 150 + i * 46); });
    x.fillStyle = '#1D7BEA'; SENT.forEach(([a, d], i) => { x.fillText(a, 90, 540 + i * 40); x.fillText(d, 680, 540 + i * 40); });
    return c.toDataURL('image/png').split(',')[1];
  }, { VOC, SENT });
  const file = require('path').join(require('os').tmpdir(), 'tw-ocr-vokabeln.png'); fs.writeFileSync(file, Buffer.from(png, 'base64'));
  await pg.evaluate(() => { TWApp.S.settings.ocrLangs = ['deu', 'eng', 'spa']; });
  await pg.setInputFiles('#fileInput', file);
  await pg.waitForSelector('#cropModal:not([hidden])'); await pg.waitForTimeout(200);
  ok(await pg.evaluate(() => [...document.querySelectorAll('#ocrLangs .lang.on')].map(b => b.textContent).join(',')) === 'DE,EN,ES', 'Sprachleiste zeigt DE, EN, ES aktiv');
  await pg.click('#cropFull'); await pg.click('#cropOk');
  await pg.waitForSelector('#stagingCard:not([hidden])', { timeout: 240000 });
  const t = await pg.inputValue('#stagingText'); console.log(t);
  const lines = t.split('\n');
  const hit = VOC.filter(([a, d]) => lines.includes(`${a} | ${d}`)).length;
  ok(hit >= VOC.length - 1, `Vokabelpaare exakt erkannt (mit Akzenten, ñ, ß): ${hit}/${VOC.length}`);
  ok(lines.some(l => l === 'Cerca de Madrid hay una estación de esquí. | In der Nähe von Madrid gibt es ein Skigebiet.'), 'Umbrochener Beispielsatz zu einer Zeile zusammengeführt');
  ok(!lines.some(l => l === ''), 'Keine Leerzeilen zwischen Tabellenzeilen');
  ok(!/Spanish|Deutsch/.test(lines[0]) || / \| /.test(lines[0]), 'Kopfzeile nicht als Unsinn übernommen (oder als Tabellenzeile)');
  await pg.click('#btnTake'); await pg.waitForTimeout(300);
  ok(/^Vokabeln vom /.test(await pg.inputValue('#noteTitle')), 'Titel „Vokabeln vom …“');
  ok(!errs.length, 'Keine Seitenfehler ' + JSON.stringify(errs));
  await b.close(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('E2E FAIL', e); process.exit(1); });
