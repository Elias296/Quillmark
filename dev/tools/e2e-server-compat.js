// Browser-Test: Server-Modus mit Modellen ohne System-Anweisung (z. B. Gemma) und Limit-Fehlern.
// node dev/tools/e2e-server-compat.js   (lokaler Server auf Port 8765)
const { chromium } = require('playwright');
let fails = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };
const sse = t => `data: ${JSON.stringify({ choices: [{ delta: { content: t } }] })}\n\ndata: [DONE]\n\n`;
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST' };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1180, height: 820 } });
  const reqs = []; let limit = false;
  await ctx.route('https://openrouter.ai/**', async r => {
    const req = r.request();
    if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS });
    const body = JSON.parse(req.postData()); reqs.push({ body, title: req.headers()['x-title'] });
    if (limit) return r.fulfill({ status: 429, headers: Object.assign({ 'content-type': 'application/json' }, CORS), body: '{"error":{"message":"Rate limit exceeded: free-models-per-day"}}' });
    if (body.messages.some(m => m.role === 'system')) return r.fulfill({ status: 400, headers: Object.assign({ 'content-type': 'application/json' }, CORS), body: '{"error":{"message":"Developer instruction is not enabled for models/gemma"}}' });
    const u = body.messages[0].content;
    r.fulfill({ status: 200, headers: Object.assign({ 'content-type': 'text/event-stream' }, CORS), body: sse(/Antworte nur/.test(u) ? 'OK' : 'Antwort mit eingebetteter Anweisung: ' + /Du heißt Tizian/.test(u)) });
  });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('http://127.0.0.1:8765/Tintenwerk.html'); await pg.waitForTimeout(500);
  await pg.click('#srvFold summary');
  await pg.fill('#srvUrl', 'https://openrouter.ai/api/v1'); await pg.fill('#srvModel', 'google/gemma-4-31b-it:free'); await pg.fill('#srvKey', 'sk-or-test'); await pg.locator('#srvKey').blur();
  await pg.click('#srvOn'); await pg.click('#confirmYes'); await pg.waitForTimeout(100);
  await pg.fill('#editor', 'Fotosynthese\n\nDie Fotosynthese wandelt Licht in chemische Energie um. Dabei entsteht Glucose.'); await pg.locator('#editor').blur();
  await pg.click('#btnRewrite'); await pg.waitForFunction(() => /fertig|abgebrochen/.test(document.querySelector('#cmpProgress').textContent), null, { timeout: 10000 });
  ok(/eingebetteter Anweisung: true/.test(await pg.inputValue('#cmpAi')), 'Modell ohne System-Anweisung: automatischer zweiter Versuch mit eingebetteter Anweisung');
  ok(reqs[0].body.model === 'google/gemma-4-31b-it:free' && reqs[0].body.messages[0].role === 'system' && reqs[1].body.messages[0].role === 'user', 'Anfragen: Modell-ID, zuerst mit, dann ohne System-Rolle');
  await pg.click('#cmpDiscard');
  const n = reqs.length;
  await pg.click('#btnRewrite'); await pg.waitForFunction(() => /fertig|abgebrochen/.test(document.querySelector('#cmpProgress').textContent), null, { timeout: 10000 });
  ok(reqs.length === n + 1 && reqs[n].body.messages.every(m => m.role !== 'system'), 'Gemerkt: weitere Anfragen gleich ohne System-Rolle (kein Fehlversuch)');
  await pg.click('#cmpDiscard');
  limit = true;
  await pg.click('#btnRewrite'); await pg.waitForSelector('#toast:not([hidden])', { timeout: 10000 });
  ok(/429/.test(await pg.textContent('#toast')) && /Limit erreicht/.test(await pg.textContent('#toast')), 'Limit-Fehler 429 wird verständlich gemeldet: ' + (await pg.textContent('#toast')).slice(0, 90));
  ok(!errs.length, 'Keine Seitenfehler ' + JSON.stringify(errs));
  await b.close(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('E2E FAIL', e); process.exit(1); });
