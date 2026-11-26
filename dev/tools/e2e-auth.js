// Browser-Test: freiwilliges Konto (Supabase Auth) gegen einen nachgebauten Anmeldedienst.
// Echtes SDK aus dem npm-Paket: SUPA_SDK=<pfad zu @supabase/supabase-js@2.118.0/dist/umd/supabase.js>
// node dev/tools/e2e-auth.js [screenshot-ordner]   (lokaler Server auf Port 8765)
const { chromium } = require('playwright'); const path = require('path'), os = require('os'), fs = require('fs');
const out = process.argv[2] || os.tmpdir();
const SDK = process.env.SUPA_SDK; if (!SDK || !fs.existsSync(SDK)) { console.error('SUPA_SDK fehlt'); process.exit(2); }
let fails = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };
const APP = 'http://127.0.0.1:8765/index.html', SB = 'https://testref.supabase.co';
const CFG = { supabaseUrl: SB, supabaseKey: 'sb_publishable_TESTKEY_abcdefghijklmnop', returnUrl: APP };
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };

/* ---------- nachgebauter Supabase-Anmeldedienst (GoTrue) ---------- */
function fakeAuth(opts = {}) {
  const users = new Map(), tokens = new Map(), log = [];
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const mkUser = (email, provider) => ({ id: 'u-' + (users.size + 1) + '-' + email.split('@')[0], aud: 'authenticated', role: 'authenticated', email, pw: null, confirmed: provider === 'google', provider, created_at: new Date().toISOString() });
  const pub = u => ({ id: u.id, aud: u.aud, role: u.role, email: u.email, email_confirmed_at: u.confirmed ? u.created_at : null, app_metadata: { provider: u.provider, providers: [u.provider] }, user_metadata: { email: u.email }, identities: [{ id: u.id, provider: u.provider, identity_data: { email: u.email } }], created_at: u.created_at });
  const session = u => {
    const exp = Math.floor(Date.now() / 1000) + 3600, at = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ sub: u.id, email: u.email, exp, aud: 'authenticated', role: 'authenticated', session_id: 's' + tokens.size }) + '.sig';
    const rt = 'rt' + tokens.size + Math.random().toString(36).slice(2, 8); tokens.set(at, u); tokens.set(rt, u);
    return { access_token: at, token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: rt, user: pub(u) };
  };
  const hashFor = (u, type) => { const s = session(u); return `#access_token=${s.access_token}&expires_at=${s.expires_at}&expires_in=3600&refresh_token=${s.refresh_token}&token_type=bearer` + (type ? '&type=' + type : ''); };
  const err = (status, code, message) => ({ status, headers: Object.assign({ 'content-type': 'application/json', 'x-supabase-api-version': '2024-01-01' }, CORS), body: JSON.stringify({ code, error_code: code, msg: message, message }) });
  const json = (o, status = 200) => ({ status, headers: Object.assign({ 'content-type': 'application/json' }, CORS), body: JSON.stringify(o) });
  async function handle(route) {
    const req = route.request(), u = new URL(req.url()), p = u.pathname.replace('/auth/v1', ''), m = req.method();
    if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch (e) { /* leer */ }
    const who = tokens.get((req.headers()['authorization'] || '').replace(/^Bearer /, ''));
    log.push({ m, p, q: Object.fromEntries(u.searchParams), body, apikey: req.headers()['apikey'] });
    if (p === '/settings') return route.fulfill(json({ external: { email: true, google: opts.google !== false }, disable_signup: false, mailer_autoconfirm: false }));
    if (p === '/signup') {
      if (users.has(body.email)) { const x = pub(users.get(body.email)); x.identities = []; return route.fulfill(json(x)); }
      if ((body.password || '').length < 8) return route.fulfill(err(422, 'weak_password', 'Password should be at least 8 characters.'));
      const nu = mkUser(body.email, 'email'); nu.pw = body.password; users.set(body.email, nu);
      return route.fulfill(json(Object.assign(pub(nu), { confirmation_sent_at: new Date().toISOString() })));
    }
    if (p === '/token' && u.searchParams.get('grant_type') === 'password') {
      const x = users.get(body.email);
      if (!x || x.pw !== body.password) return route.fulfill(err(400, 'invalid_credentials', 'Invalid login credentials'));
      if (!x.confirmed) return route.fulfill(err(400, 'email_not_confirmed', 'Email not confirmed'));
      return route.fulfill(json(session(x)));
    }
    if (p === '/token' && u.searchParams.get('grant_type') === 'refresh_token') { const x = tokens.get(body.refresh_token); return route.fulfill(x ? json(session(x)) : err(400, 'refresh_token_not_found', 'Invalid Refresh Token')); }
    if (p === '/user' && m === 'GET') return route.fulfill(who ? json(pub(who)) : err(401, 'bad_jwt', 'invalid JWT'));
    if (p === '/user' && m === 'PUT') { if (!who) return route.fulfill(err(401, 'bad_jwt', 'invalid JWT')); if (body.password) who.pw = body.password; return route.fulfill(json(pub(who))); }
    if (p === '/recover') return route.fulfill(json({}));
    if (p === '/resend') return route.fulfill(json({}));
    if (p === '/logout') return route.fulfill({ status: 204, headers: CORS });
    if (p === '/authorize') {                       // Google: beim ersten Mal Konto anlegen, danach dasselbe Konto
      const mail = 'lena.google@example.com';
      if (!users.has(mail)) users.set(mail, mkUser(mail, 'google'));
      const back = u.searchParams.get('redirect_to');
      return route.fulfill({ status: 302, headers: { location: back + hashFor(users.get(mail)) } });
    }
    return route.fulfill(err(404, 'not_found', 'not found ' + p));
  }
  return { users, log, handle, hashFor, confirm: email => { users.get(email).confirmed = true; } };
}

(async () => {
  const b = await chromium.launch(); const errs = [];
  const watch = pg => { pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); }); };
  async function ctxWith(auth, viewport, cfg = CFG) {
    const ctx = await b.newContext({ viewport: viewport || { width: 1180, height: 820 }, acceptDownloads: true });
    await ctx.addInitScript(c => { window.QM_CONFIG = c; }, cfg);
    const sdkHits = { n: 0 };
    await ctx.route('https://cdn.jsdelivr.net/npm/@supabase/**', r => { sdkHits.n++; r.fulfill({ path: SDK, headers: Object.assign({ 'content-type': 'text/javascript' }, CORS) }); });
    if (auth) await ctx.route(SB + '/**', r => auth.handle(r));
    return { ctx, sdkHits };
  }

  // ---------- 0. Ohne Konfiguration: normaler lokaler Start
  { const { ctx, sdkHits } = await ctxWith(null, null, { supabaseUrl: '', supabaseKey: '' }); const pg = await ctx.newPage(); watch(pg); const reqs = []; pg.on('request', r => reqs.push(r.url()));
    await pg.goto(APP); await pg.waitForTimeout(300);
    ok(await pg.evaluate(() => document.querySelector('#btnAccount').hidden && document.querySelector('#btnProfile').hidden && TWApp.APP.auth.configured === false), 'Unkonfiguriert: kein Anmelde-Knopf, App startet lokal');
    ok(sdkHits.n === 0 && !reqs.some(u => /supabase/.test(u)), 'Unkonfiguriert: nichts von Supabase geladen');
    await ctx.close(); }

  // ---------- 0b. Geheimer Schlüssel wird abgelehnt
  { const { ctx } = await ctxWith(null, null, Object.assign({}, CFG, { supabaseKey: 'sb_secret_SHOULD_NEVER_BE_HERE_123' })); const pg = await ctx.newPage();
    await pg.goto(APP); await pg.waitForTimeout(300);
    ok(await pg.evaluate(() => document.querySelector('#btnAccount').hidden), 'Secret Key im Frontend: Konten bleiben aus');
    await ctx.close(); }

  const auth = fakeAuth();
  const { ctx, sdkHits } = await ctxWith(auth);
  const pg = await ctx.newPage(); watch(pg);
  const ev = (f, a) => pg.evaluate(f, a);
  const msg = () => pg.evaluate(() => { const m = document.querySelector('#authMsg'); return m.hidden ? '' : m.textContent; });
  const waitMsg = re => pg.waitForFunction(r => { const m = document.querySelector('#authMsg'); return !m.hidden && new RegExp(r).test(m.textContent) && !document.querySelector('#authSubmit').disabled; }, re.source, { timeout: 8000 });
  const signedIn = () => pg.evaluate(() => !document.querySelector('#btnProfile').hidden && document.querySelector('#btnAccount').hidden);
  await pg.goto(APP); await pg.waitForTimeout(300);

  // ---------- 1. Gastmodus: Notiz erstellen und exportieren, ohne SDK
  ok(await ev(() => !document.querySelector('#btnAccount').hidden && /Anmelden/.test(document.querySelector('#btnAccount').textContent)), 'Konfiguriert: dezenter Knopf „Anmelden“ oben rechts');
  await pg.click('#btnNew'); await pg.fill('#noteTitle', 'Gast-Notiz'); await pg.fill('#editor', 'Ohne Konto geschrieben.');
  await ev(() => { const A = TWApp.APP; A.S.own.glyphs = { 'ß': { s: [[0, 0, 0, 10, 30, 0]], w: 30 } }; A.saveOwn(); A.notes.commit(); });
  await pg.click('#btnExport'); await pg.click('#exGn'); await pg.waitForSelector('#exportResult:not([hidden])', { timeout: 20000 });
  ok(await ev(() => /Gast-Notiz\.goodnotes$/.test(document.querySelector('#exDownload').download)), 'Gastmodus: Notiz erstellt und als .goodnotes exportiert');
  await pg.click('#exportModal [data-close]');
  ok(sdkHits.n === 0 && !auth.log.length, 'Gastmodus: kein Anmelde-SDK und keine Anfrage an Supabase');

  // ---------- 2. Dialog per Tastatur
  await pg.focus('#btnAccount'); await pg.keyboard.press('Enter');
  await pg.waitForFunction(() => !document.querySelector('#authGoogleWrap').hidden, null, { timeout: 8000 });
  ok(await ev(() => document.querySelector('#authModal').contains(document.activeElement)), 'Dialog: Fokus springt hinein');
  ok(auth.log.some(l => l.p === '/settings' && l.apikey === CFG.supabaseKey), '„Mit Google fortfahren“ erscheint, weil der Anbieter in Supabase aktiv ist');
  await pg.focus('#tabIn'); await pg.keyboard.press('ArrowRight');
  ok(await ev(() => document.activeElement.id === 'tabUp' && document.querySelector('#tabUp').getAttribute('aria-selected') === 'true' && !document.querySelector('#fldPw2').hidden && document.querySelector('#authTitle').textContent === 'Konto erstellen' && !document.querySelector('#authGoogleWrap').hidden), 'Pfeiltaste wechselt zu „Konto erstellen“ (mit Google-Knopf)');
  await pg.screenshot({ path: path.join(out, 'auth_konto.png') });

  // ---------- 3. Registrierung mit E-Mail-Bestätigung
  const MAIL = 'mia@example.com', PW = 'Sicher-Passwort-1';
  await pg.fill('#authEmail', MAIL); await pg.fill('#authPw', 'kurz'); await pg.fill('#authPw2', 'kurz'); await pg.click('#authSubmit');
  ok(/mindestens 8 Zeichen/.test(await msg()), 'Zu kurzes Passwort: verständliche Meldung');
  await pg.fill('#authPw', PW); await pg.fill('#authPw2', PW + 'x'); await pg.click('#authSubmit');
  ok(/stimmen nicht überein/.test(await msg()), 'Passwörter verschieden: Meldung');
  await pg.fill('#authPw2', PW); await pg.click('#authSubmit'); await waitMsg(/Fast geschafft/);
  const su = auth.log.find(l => l.p === '/signup');
  ok(su && su.body.email === MAIL && su.q.redirect_to === APP && !(await ev(() => document.querySelector('#authResend').hidden)), 'Registrierung: Bestätigungs-E-Mail angekündigt, Rückkehradresse übergeben');
  await pg.click('#authResend'); await waitMsg(/erneut unterwegs/);
  ok(auth.log.some(l => l.p === '/resend' && l.body.email === MAIL), 'Bestätigungs-E-Mail erneut senden');
  await pg.click('#tabIn'); await pg.fill('#authEmail', MAIL); await pg.fill('#authPw', PW); await pg.click('#authSubmit'); await waitMsg(/bestätige zuerst/);
  ok(!(await ev(() => document.querySelector('#authResend').hidden)), 'Anmelden vor Bestätigung: Hinweis und „erneut senden“');
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(100);
  ok(await ev(() => document.querySelector('#authModal').hidden && document.activeElement.id === 'btnAccount'), 'Escape schließt, Fokus zurück auf „Anmelden“');

  // ---------- 4. Bestätigungslink öffnen
  auth.confirm(MAIL);
  const openLink = async u => { await pg.goto('about:blank'); await pg.goto(u); };     // E-Mail-Link öffnet die Seite frisch
  await openLink(APP + auth.hashFor(auth.users.get(MAIL), 'signup'));
  await pg.waitForFunction(() => !document.querySelector('#btnProfile').hidden, null, { timeout: 8000 });
  ok(await ev(() => document.querySelector('#btnProfile').textContent === 'M' && /E-Mail bestätigt/.test(document.querySelector('#toast').textContent) && !location.hash), 'Bestätigungslink: angemeldet, Hinweis, Adresse aufgeräumt');
  ok(await ev(() => TWApp.APP.notes.list().list.some(n => n.title === 'Gast-Notiz') && !!TWApp.S.own.glyphs['ß']), 'Lokale Notizen und Handschrift bleiben bei der Anmeldung erhalten');

  // ---------- 5. Neuladen stellt die Sitzung wieder her
  await pg.reload(); await pg.waitForFunction(() => !document.querySelector('#btnProfile').hidden, null, { timeout: 8000 });
  ok(await signedIn(), 'Neuladen: weiterhin angemeldet');

  // ---------- 6. Profil-Menü und Abmelden
  await pg.click('#btnProfile'); await pg.waitForTimeout(100);
  ok(await ev(() => !document.querySelector('#profileMenu').hidden && document.querySelector('#profileMail').textContent === 'mia@example.com' && document.activeElement.id === 'btnSignOut' && document.querySelector('#btnProfile').getAttribute('aria-expanded') === 'true'), 'Profil-Menü: E-Mail und „Abmelden“, Fokus im Menü');
  await pg.screenshot({ path: path.join(out, 'auth_menu.png') });
  await pg.keyboard.press('Escape');
  ok(await ev(() => document.querySelector('#profileMenu').hidden && document.activeElement.id === 'btnProfile'), 'Escape schließt das Menü, Fokus zurück');
  await pg.click('#btnProfile'); await pg.click('#btnSignOut'); await pg.waitForTimeout(300);
  ok(!(await signedIn()) && auth.log.some(l => l.p === '/logout'), 'Abmelden');
  ok(await ev(() => TWApp.APP.notes.list().list.some(n => n.title === 'Gast-Notiz') && !!TWApp.S.own.glyphs['ß'] && !localStorage.getItem('quillmark-auth')), 'Nach dem Abmelden: Notizen und Handschrift noch da, Sitzung gelöscht');
  await pg.reload(); await pg.waitForTimeout(500);
  ok(!(await signedIn()), 'Neuladen nach Abmelden: abgemeldet');

  // ---------- 7. Anmelden mit Passwort
  await pg.click('#btnAccount'); await pg.waitForFunction(() => !document.querySelector('#authSubmit').disabled);
  await pg.fill('#authEmail', MAIL); await pg.fill('#authPw', 'falsch-123'); await pg.click('#authSubmit'); await waitMsg(/stimmt nicht/);
  ok(true, 'Falsches Passwort: „E-Mail oder Passwort stimmt nicht.“');
  await pg.fill('#authPw', PW); await pg.click('#authSubmit');
  await pg.waitForFunction(() => document.querySelector('#authModal').hidden, null, { timeout: 8000 });
  ok(await signedIn() && /Angemeldet als mia@example.com/.test(await pg.textContent('#toast')), 'Anmelden mit E-Mail und Passwort');
  await pg.click('#btnProfile'); await pg.click('#btnSignOut'); await pg.waitForTimeout(300);

  // ---------- 8. Passwort vergessen
  await pg.click('#btnAccount'); await pg.waitForFunction(() => !document.querySelector('#authSubmit').disabled);
  await pg.fill('#authEmail', MAIL); await pg.click('#authForgot');
  ok(await ev(() => document.querySelector('#authTitle').textContent === 'Passwort zurücksetzen' && document.querySelector('#fldPw').hidden && document.querySelector('#authEmail').value === 'mia@example.com'), 'Ansicht „Passwort zurücksetzen“');
  await pg.click('#authSubmit'); await waitMsg(/Link zum Zurücksetzen/);
  ok(auth.log.some(l => l.p === '/recover' && l.body.email === MAIL && l.q.redirect_to === APP), 'Reset-Link angefordert, mit Rückkehradresse');
  await pg.keyboard.press('Escape');
  await openLink(APP + auth.hashFor(auth.users.get(MAIL), 'recovery'));
  await pg.waitForFunction(() => !document.querySelector('#authModal').hidden && document.querySelector('#authTitle').textContent === 'Neues Passwort festlegen', null, { timeout: 8000 });
  ok(true, 'Reset-Link öffnet „Neues Passwort festlegen“');
  const NEWPW = 'Neues-Passwort-2';
  await pg.fill('#authPw', NEWPW); await pg.fill('#authPw2', NEWPW); await pg.click('#authSubmit');
  await pg.waitForFunction(() => document.querySelector('#authModal').hidden, null, { timeout: 8000 });
  ok(auth.users.get(MAIL).pw === NEWPW && /Neues Passwort gespeichert/.test(await pg.textContent('#toast')), 'Neues Passwort gespeichert');
  await pg.click('#btnProfile'); await pg.click('#btnSignOut'); await pg.waitForTimeout(300);
  await pg.click('#btnAccount'); await pg.waitForFunction(() => !document.querySelector('#authSubmit').disabled);
  await pg.fill('#authEmail', MAIL); await pg.fill('#authPw', NEWPW); await pg.click('#authSubmit');
  await pg.waitForFunction(() => document.querySelector('#authModal').hidden, null, { timeout: 8000 });
  ok(await signedIn(), 'Anmelden mit dem neuen Passwort');
  await pg.click('#btnProfile'); await pg.click('#btnSignOut'); await pg.waitForTimeout(300);

  // ---------- 9. Google: Rückkehr, erstes Mal Konto anlegen, danach dasselbe Konto
  const google = async () => {
    await pg.click('#btnAccount'); await pg.waitForFunction(() => !document.querySelector('#authGoogleWrap').hidden && !document.querySelector('#authGoogle').disabled);
    await Promise.all([pg.waitForURL(/127\.0\.0\.1/, { timeout: 8000 }), pg.click('#authGoogle')]);
    await pg.waitForFunction(() => !document.querySelector('#btnProfile').hidden, null, { timeout: 8000 });
    return ev(() => JSON.parse(localStorage.getItem('quillmark-auth')).user.id);
  };
  const id1 = await google();
  const az = auth.log.filter(l => l.p === '/authorize').pop();
  ok(az && az.q.provider === 'google' && az.q.redirect_to === APP && await ev(() => !location.hash && document.querySelector('#profileMail').textContent === 'lena.google@example.com'), 'Google: Weiterleitung mit Rückkehradresse, zurück und angemeldet');
  await pg.click('#btnProfile'); await pg.click('#btnSignOut'); await pg.waitForTimeout(300);
  const id2 = await google();
  ok(id1 && id1 === id2 && [...auth.users.values()].filter(u => u.provider === 'google').length === 1, 'Google: zweiter Login öffnet dasselbe Konto (' + id1 + ')');
  await pg.click('#btnProfile'); await pg.click('#btnSignOut'); await pg.waitForTimeout(300);

  // ---------- 10. Fehler bei der Rückkehr
  await openLink(APP + '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');
  await pg.waitForFunction(() => !document.querySelector('#authModal').hidden && /abgelaufen/.test(document.querySelector('#authMsg').textContent), null, { timeout: 8000 });
  ok(await ev(() => !location.hash), 'Abgelaufener Link: verständliche Meldung, Adresse aufgeräumt');
  await pg.keyboard.press('Escape');
  ok(await ev(() => TWApp.APP.notes.list().list.some(n => n.title === 'Gast-Notiz')), 'Notizen nach allen An- und Abmeldungen unverändert');
  await ctx.close();

  // ---------- 11. Google ausgeblendet, solange der Anbieter nicht eingerichtet ist; Handy-Ansicht
  { const a2 = fakeAuth({ google: false }); const { ctx: c2 } = await ctxWith(a2, { width: 390, height: 760 }); const p2 = await c2.newPage(); watch(p2);
    await p2.goto(APP); await p2.waitForTimeout(300);
    await p2.click('#btnAccount'); await p2.waitForFunction(() => !document.querySelector('#authSubmit').disabled && document.querySelector('#authMsg').hidden);
    ok(await p2.evaluate(() => document.querySelector('#authGoogleWrap').hidden), 'Google-Anbieter aus: kein Google-Knopf');
    const fit = await p2.evaluate(() => { const r = document.querySelector('#authModal .modal-card').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && document.documentElement.scrollWidth <= innerWidth && document.querySelector('#btnAccount').getBoundingClientRect().right <= innerWidth; });
    ok(fit, 'Handy (390 px): Dialog und Knopf passen');
    await p2.screenshot({ path: path.join(out, 'auth_handy.png') });
    await c2.close(); }

  ok(!errs.length, 'Keine Seitenfehler ' + JSON.stringify(errs));
  await b.close(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('E2E FAIL', e); process.exit(1); });
