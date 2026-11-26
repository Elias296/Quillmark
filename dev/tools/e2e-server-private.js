// Browser-Test: Server-Modus mit eigenem Rechner (Tailscale) zeigt milderen Hinweis.
// node dev/tools/e2e-server-private.js   (lokaler Server auf Port 8765)
const { chromium } = require('playwright');
let fails = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };
const sse = t => `data: ${JSON.stringify({ choices: [{ delta: { content: t } }] })}\n\ndata: [DONE]\n\n`;
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1180, height: 820 } });
  await ctx.route('https://lokilaptop.tail129eea.ts.net/**', r => r.request().method() === 'OPTIONS' ? r.fulfill({ status: 204, headers: CORS })
    : r.fulfill({ status: 200, headers: Object.assign({ 'content-type': 'text/event-stream' }, CORS), body: sse('OK') }));
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('http://127.0.0.1:8765/Tintenwerk.html'); await pg.waitForTimeout(400);
  const P = await pg.evaluate(() => ['lokilaptop.tail129eea.ts.net', '192.168.1.20:11434', '10.0.0.5', '172.20.1.1', '100.101.2.3', 'nas.local', 'localhost:11434',
    'openrouter.ai', 'demo.hf.space', '172.40.1.1', '100.10.2.3', '8.8.8.8'].map(h => TWApp.AI.srvPrivate(h)));
  ok(JSON.stringify(P) === JSON.stringify([true, true, true, true, true, true, true, false, false, false, false, false]), 'Erkennung eigener Rechner: ' + JSON.stringify(P));
  ok(!/100 % lokal/.test(await pg.inputValue('#editor')) && /Notizen und deine Handschrift bleiben/.test(await pg.inputValue('#editor')), 'Beispielnotiz ohne „100 % lokal“');
  await pg.click('#srvFold summary');
  ok(/eigenen Laptop/.test(await pg.textContent('#srvFold .fold-body .hint')), 'Kurzhinweis nennt den eigenen Laptop');
  await pg.click('#srvFold .info[data-info=server]');
  const pop = await pg.textContent('#pop');
  ok(/Ollama/.test(pop) && /tailscale serve/.test(pop) && /OpenRouter/.test(pop) && !/Hugging/.test(pop), 'Anleitung: Ollama + Tailscale, Alternative OpenRouter, kein Hugging Face');
  await pg.click('#stage');
  await pg.fill('#srvUrl', 'https://lokilaptop.tail129eea.ts.net'); await pg.fill('#srvModel', 'tintenwerk-cpu:latest'); await pg.locator('#srvModel').blur();
  await pg.click('#srvOn'); await pg.waitForSelector('#confirmModal:not([hidden])');
  ok(/deinem Rechner/.test(await pg.textContent('#confirmTitle')) && /privaten Netz/.test(await pg.textContent('#confirmText')), 'Abfrage für eigenen Rechner formuliert');
  await pg.click('#confirmYes'); await pg.waitForTimeout(100);
  ok(await pg.evaluate(() => /Eigener Rechner/.test(document.querySelector('#gpuBadge').textContent) && document.querySelector('#gpuBadge').classList.contains('ok') && document.querySelector('#srvBadge').hidden), 'Badge „Eigener Rechner“, kein Warn-Badge');
  ok(/deinem Rechner .*privaten Netz/.test(await pg.textContent('#aiOne')), 'Beschreibung: ' + await pg.textContent('#aiOne'));
  await pg.click('#btnSettings'); await pg.waitForTimeout(100);
  ok(/eigener Rechner im privaten Netz/.test(await pg.textContent('#privServer')), 'Datenschutz-Fenster nennt eigenen Rechner');
  await pg.click('#settingsModal [data-close]');
  await pg.screenshot({ path: process.argv[2] || require('path').join(require('os').tmpdir(), 'tw-private.png') });
  ok(!errs.length, 'Keine Seitenfehler ' + JSON.stringify(errs));
  await b.close(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('E2E FAIL', e); process.exit(1); });
