// Browser-Test: Chat mit Tizian, Lernzettel mit Skizze, Bilder im Lernzettel (Vorschau, PDF, .goodnotes).
// node dev/tools/e2e-chat.js [screenshot-ordner]   (lokaler Server auf Port 8765)
const { chromium } = require('playwright'); const path = require('path'), fs = require('fs'), os = require('os');
const out = process.argv[2] || os.tmpdir();
let fails = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };
const sse = t => t.split(/(?<= )/).map(p => `data: ${JSON.stringify({ choices: [{ delta: { content: p } }] })}\n\n`).join('') + 'data: [DONE]\n\n';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
const SHEET = '# Vulkane\n\n## Entstehung\n- Magma steigt aus dem **Erdmantel** auf\n- Druck baut sich auf\n\n[[Magma -> Druck -> Ausbruch -> Lava]]\n\n## Typen\n[[Vulkane: Schichtvulkan, Schildvulkan, Supervulkan]]\n- Lava kühlt zu Gestein ab';
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 1, acceptDownloads: true });
  const reqs = [];
  await ctx.route('https://lokilaptop.tail129eea.ts.net/**', r => {
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS });
    const body = JSON.parse(r.request().postData()); reqs.push(body);
    const last = body.messages[body.messages.length - 1].content;
    const ans = /Lernzettel/.test(last) ? SHEET : /Antworte nur/.test(last) ? 'OK' : 'Die Fotosynthese wandelt Licht in **chemische Energie** um.';
    r.fulfill({ status: 200, headers: Object.assign({ 'content-type': 'text/event-stream' }, CORS), body: sse(ans) });
  });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await pg.goto('http://127.0.0.1:8765/index.html'); await pg.waitForTimeout(300);
  const ev = f => pg.evaluate(f);

  // --- ohne Tizian: verständlicher Hinweis
  await pg.click('#modeSeg [data-mode=chat]'); await pg.waitForTimeout(100);
  ok(await ev(() => !document.querySelector('[data-panel=chat]').hidden && document.querySelector('#panel').dataset.mode === 'chat'), 'Chat-Seite über die Seitenleiste erreichbar');
  ok(await ev(() => document.querySelectorAll('#modeSeg button').length === 4), 'Seitenleiste hat 4 Schritte');
  await pg.fill('#chatInput', 'Hallo'); await pg.click('#chatSend'); await pg.waitForTimeout(150);
  ok(/Server statt lokal/.test(await pg.textContent('#chatLog')), 'Ohne WebGPU und Server: Hinweis auf „Server statt lokal“');
  await pg.fill('#chatInput', '12 + 30 ='); await pg.click('#chatSend'); await pg.waitForTimeout(150);
  ok(/12 \+ 30 = 42/.test(await pg.textContent('#chatLog')) && /Rechner/.test(await pg.textContent('#chatLog')) && reqs.length === 0, 'Rechenzeile: exakter Rechner, ohne Server-Anfrage');
  await pg.fill('#chatInput', 'Was ist 5+5?'); await pg.click('#chatSend'); await pg.waitForTimeout(150);
  ok(await ev(() => [...document.querySelectorAll('#chatLog .msg.ai .bub')].pop().textContent.trim() === '10') && reqs.length === 0, 'Frage „Was ist 5+5?“: Rechner antwortet nur „10“');
  ok(await ev(() => getComputedStyle(document.querySelector('.radio input')).appearance === 'none'), 'Auswahlkreise eigen gestaltet (nicht schwarz gefüllt)');
  await pg.click('#chatClear'); await pg.click('#confirmYes'); await pg.waitForTimeout(100);

  // --- mit eigenem Rechner (Tailscale)
  await ev(() => localStorage.setItem('tintenwerk.server.v1', JSON.stringify({ on: true, url: 'https://lokilaptop.tail129eea.ts.net', model: 'tintenwerk-cpu:latest', key: '' })));
  await pg.reload(); await pg.waitForTimeout(400);
  await pg.click('#modeSeg [data-mode=chat]');
  ok(/Eigener Rechner/.test(await pg.textContent('#chatState')), 'Chat zeigt Tizian-Status „Eigener Rechner“');
  await pg.fill('#chatInput', 'Was ist Fotosynthese?'); await pg.press('#chatInput', 'Enter');
  await pg.waitForFunction(() => /chemische Energie/.test(document.querySelector('#chatLog').textContent) && document.querySelector('#chatSend').textContent === 'Senden', null, { timeout: 8000 });
  const r0 = reqs[reqs.length - 1];
  ok(r0.messages[0].role === 'system' && /Du heißt Tizian/.test(r0.messages[0].content) && r0.messages.filter(m => m.role === 'user' && m.content === 'Was ist Fotosynthese?').length === 1, 'Anfrage: Systemanweisung, Frage genau einmal');
  ok(await ev(() => !/\*\*/.test(document.querySelector('#chatLog').innerText)), 'Keine **Sternchen** in der Chat-Anzeige');
  ok(/nur das Ergebnis/.test(r0.messages[0].content) && !/zeige ihn kurz/.test(r0.messages[0].content), 'Ohne Bitte: Anweisung „nur das Ergebnis“, kein Rechenweg');
  const nReq = reqs.length;
  await pg.fill('#chatInput', 'Erklär mir den Rechenweg für 17 * 23'); await pg.press('#chatInput', 'Enter');
  await pg.waitForFunction(() => document.querySelector('#chatSend').textContent === 'Senden', null, { timeout: 8000 }); await pg.waitForTimeout(100);
  ok(reqs.length === nReq + 1 && /zeige ihn kurz/.test(reqs[reqs.length - 1].messages[0].content), 'Mit Bitte um Rechenweg: Anweisung, ihn zu zeigen');
  ok(/Notiztext/.test(r0.messages[0].content) === false, 'Beispielnotiz wird nicht als Hintergrund mitgeschickt');

  // --- Lernzettel mit Skizze
  await pg.fill('#chatInput', 'Vulkane'); await pg.click('#chatChips [data-act=lernzettel]');
  await pg.waitForFunction(() => /Supervulkan/.test(document.querySelector('#chatLog').textContent) && document.querySelector('#chatSend').textContent === 'Senden', null, { timeout: 8000 });
  ok(/Lernzettel über: Vulkane/.test(reqs[reqs.length - 1].messages.slice(-1)[0].content) && /\[\[A -> B -> C\]\]/.test(reqs[reqs.length - 1].messages.slice(-1)[0].content), 'Lernzettel-Auftrag mit Skizzen-Format');
  ok(await ev(() => document.querySelectorAll('#chatLog .sk').length === 2), 'Skizzen in der Antwort markiert');
  await pg.screenshot({ path: path.join(out, 'chat.png') });
  await pg.locator('#chatLog [data-take]').last().click(); await pg.waitForTimeout(300);
  const d = await ev(() => ({ title: TWApp.S.draft.title, sk: (TWApp.S.draft.text.match(/\[\[/g) || []).length, strokes: TWApp.S.layout.stats.strokes, lay: TW.verifyLayout(TWApp.S.layout) }));
  ok(d.title === 'Vulkane' && d.sk === 2 && d.strokes > 100 && d.lay.offBase === 0 && d.lay.offMargin === 0 && d.lay.offPage === 0, 'Als Lernzettel übernommen, Skizzen gezeichnet, Raster und Ränder eingehalten: ' + JSON.stringify(d));
  await pg.screenshot({ path: path.join(out, 'chat_blatt.png') });

  // --- Bild einfügen
  const png = path.join(os.tmpdir(), 'qm-bild.png');
  const data = await ev(() => { const c = document.createElement('canvas'); c.width = 800; c.height = 500; const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 800, 500); g.addColorStop(0, '#d35400'); g.addColorStop(1, '#2c3e50'); x.fillStyle = g; x.fillRect(0, 0, 800, 500); x.fillStyle = '#fff'; x.font = 'bold 60px sans-serif'; x.fillText('Vulkan', 260, 270); return c.toDataURL('image/png').split(',')[1]; });
  fs.writeFileSync(png, Buffer.from(data, 'base64'));
  await pg.click('#modeSeg [data-mode=import]');
  await pg.evaluate(() => { const e = document.querySelector('#editor'); e.focus(); e.setSelectionRange(e.value.indexOf('## Typen'), e.value.indexOf('## Typen')); });
  await pg.setInputFiles('#imgFile', png); await pg.waitForSelector('#cropModal:not([hidden])'); await pg.waitForTimeout(200);
  ok(await ev(() => document.querySelector('.lang-bar').hidden && document.querySelector('#cropOk').textContent === 'Bild einfügen'), 'Zuschnitt im Bild-Modus (ohne Sprachleiste)');
  await pg.click('#cropOk'); await pg.waitForTimeout(500);
  const im = await ev(() => ({ md: /!\[Bild\]\(bild:[a-z0-9]+\)/.test(TWApp.S.draft.text), n: TWApp.S.layout.stats.images, lay: TW.verifyLayout(TWApp.S.layout) }));
  ok(im.md && im.n === 1 && im.lay.offBase === 0, 'Bild im Notiztext und auf dem Blatt: ' + JSON.stringify(im));
  await pg.evaluate(() => { const L = TWApp.S.layout; TWApp.S.page = Math.max(0, L.pages.findIndex(p => p.images.length)); }); await pg.click('#zoomLabel'); await pg.click('#zoomLabel');
  await pg.waitForTimeout(500); await pg.screenshot({ path: path.join(out, 'bild_blatt.png') });
  ok(await ev(async () => { const v = document.querySelector('#sheetCanvas'); const c = v.getContext('2d'); const L = TWApp.S.layout, p = L.pages.find(p => p.images.length), i = p ? p.images[0] : null; if (!i) return false; const k = v.width / TW.PAGE_W; const px = c.getImageData(Math.round((i.x + i.w * 0.1) * k), Math.round((i.y + i.h * 0.1) * k), 1, 1).data; return px[0] > 120 && px[2] < 140; }), 'Bild in der Vorschau gezeichnet');

  // --- Export mit Bild
  await pg.click('#modeSeg [data-mode=blatt]'); await pg.click('#btnExportPdf'); await pg.waitForFunction(() => /\.pdf$/.test(document.querySelector('#exDownload').download), null, { timeout: 20000 });
  const pdf = await ev(async () => { const a = document.querySelector('#exDownload'); const t = new TextDecoder('latin1').decode(new Uint8Array(await (await fetch(a.href)).arrayBuffer())); return { img: /\/Subtype \/Image/.test(t) && /\/DCTDecode/.test(t), pages: (t.match(/\/Type \/Page\b/g) || []).length }; });
  ok(pdf.img, 'PDF enthält das Bild (JPEG): ' + JSON.stringify(pdf));
  await pg.click('#exGn'); await pg.waitForFunction(() => /\.goodnotes$/.test(document.querySelector('#exDownload').download), null, { timeout: 20000 });
  const gn = await ev(async () => { const a = document.querySelector('#exDownload'); const files = await TW.unzip(new Uint8Array(await (await fetch(a.href)).arrayBuffer())); const att = files.filter(f => f.name.startsWith('attachments/')); return { att: att.length, withImg: att.filter(f => /\/DCTDecode/.test(new TextDecoder('latin1').decode(f.data))).length, bad: document.querySelectorAll('#exportChecks li.bad').length }; });
  ok(gn.withImg === 1 && gn.bad === 0, '.goodnotes: Bild im Seitenhintergrund, Prüfungen grün: ' + JSON.stringify(gn));
  await pg.click('#exportModal [data-close]');

  // --- Chat bleibt nach Neuladen erhalten
  await pg.reload(); await pg.waitForTimeout(400); await pg.click('#modeSeg [data-mode=chat]');
  ok(/Supervulkan/.test(await pg.textContent('#chatLog')), 'Chat-Verlauf bleibt nach Neuladen erhalten');
  ok(!errs.length, 'Keine Seitenfehler ' + JSON.stringify(errs));
  await b.close(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('E2E FAIL', e); process.exit(1); });
