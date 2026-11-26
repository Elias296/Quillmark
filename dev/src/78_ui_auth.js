/* ==========================================================================
   Quillmark – freiwilliges Konto (Supabase Auth): Anmelden, Konto erstellen,
   Passwort vergessen, Google, Abmelden. Ohne Konfiguration bleibt alles lokal.
   Notizen, Bilder und Handschrift bleiben unabhängig vom Konto auf dem Gerät.
   ========================================================================== */
(function () {
'use strict';
const A = window.TWApp.APP;
const { $, $$, toast, openModal, closeModal } = A;
const C = window.QM_CONFIG || {};
const SB_URL = String(C.supabaseUrl || '').trim().replace(/\/+$/, ''), SB_KEY = String(C.supabaseKey || '').trim();
const RETURN = String(C.returnUrl || '').trim() || (location.origin + location.pathname);
const SDK_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/dist/umd/supabase.js';
const SDK_SRI = 'sha384-TcHRA3zBbn+Lexh5n+Oil4guNPOS3rjNDpGRAN46u/s/mB2IZ50ceC6TYDU2yvgK';
const STORE = 'quillmark-auth';                       // localStorage-Schlüssel der Sitzung (nur Anmeldedaten)
const MIN_PW = 8;

/* Geheime Schlüssel gehören nie ins Frontend – dann lieber gar kein Konto anbieten */
function isSecretKey(k) {
  if (/^sb_secret_/i.test(k)) return true;
  try { const p = JSON.parse(atob(k.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); return p && p.role === 'service_role'; } catch (e) { return false; }
}
const configured = /^https:\/\/[A-Za-z0-9.-]+(:\d+)?$/.test(SB_URL) && SB_KEY.length >= 20 && !isSecretKey(SB_KEY);
if (SB_KEY && isSecretKey(SB_KEY)) console.error('Quillmark: In QM_CONFIG steht ein geheimer Supabase-Schlüssel. Bitte den Publishable Key verwenden – Konten bleiben deaktiviert.');
if (!configured) { A.auth = { configured: false }; return; }

/* Rückkehr aus E-Mail-Link oder Google: Hinweise merken, bevor das SDK die Adresse aufräumt */
const ret = (() => {
  const h = new URLSearchParams(location.hash.replace(/^#/, '')), q = new URLSearchParams(location.search), g = k => h.get(k) || q.get(k);
  return { token: h.has('access_token'), type: g('type') || '', error: g('error') || '', code: g('error_code') || '', desc: g('error_description') || '' };
})();

const btnAcc = $('#btnAccount'), btnProf = $('#btnProfile'), menu = $('#profileMenu');
btnAcc.hidden = false;

/* ---------- SDK nur bei Bedarf laden (Gäste laden nichts nach) ---------- */
let client = null, sdkP = null, settingsP = null, user = null;
function loadSdk() {
  if (sdkP) return sdkP;
  sdkP = new Promise((res, rej) => {
    if (window.supabase && window.supabase.createClient) { res(window.supabase); return; }
    const s = document.createElement('script');
    s.src = SDK_URL; s.integrity = SDK_SRI; s.crossOrigin = 'anonymous'; s.referrerPolicy = 'no-referrer';
    s.onload = () => (window.supabase && window.supabase.createClient ? res(window.supabase) : rej(new Error('sdk')));
    s.onerror = () => rej(new Error('sdk'));
    document.head.appendChild(s);
  }).then(sb => {
    client = sb.createClient(SB_URL, SB_KEY, { auth: { flowType: 'implicit', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: STORE } });
    client.auth.onAuthStateChange((ev, session) => setTimeout(() => onAuth(ev, session), 0));   // nie im Rückruf selbst weiter-awaiten
    return client;
  });
  sdkP.catch(() => { sdkP = null; });
  return sdkP;
}
function loadSettings() {           // welche Anbieter sind im Supabase-Projekt eingeschaltet?
  if (!settingsP) settingsP = fetch(SB_URL + '/auth/v1/settings', { headers: { apikey: SB_KEY } })
    .then(r => (r.ok ? r.json() : {})).catch(() => ({}));
  return settingsP;
}
const hasStoredSession = () => { try { return !!localStorage.getItem(STORE); } catch (e) { return false; } };

/* ---------- Zustand anzeigen ---------- */
function showUser(u) {
  user = u || null;
  const mail = user ? (user.email || (user.user_metadata && user.user_metadata.email) || 'Konto') : '';
  btnAcc.hidden = !!user; btnProf.hidden = !user;
  if (user) {
    btnProf.textContent = (mail.trim()[0] || '?').toUpperCase();
    btnProf.setAttribute('aria-label', 'Konto: ' + mail);
    btnProf.title = mail;
    $('#profileMail').textContent = mail;
  } else closeMenu(false);
}
let welcomed = false;
function welcome(session) {          // nach Rückkehr aus E-Mail-Link oder Google genau einmal begrüßen
  if (welcomed || !session || !ret.token || ret.type === 'recovery') return;
  welcomed = true;
  const mail = session.user.email || 'deinem Konto';
  toast(ret.type === 'signup' ? 'E-Mail bestätigt – du bist angemeldet als ' + mail + '.' : 'Angemeldet als ' + mail + '.', 4500);
}
function onAuth(ev, session) {
  showUser(session ? session.user : null);
  if (ev === 'PASSWORD_RECOVERY') { if ($('#authModal').hidden || view !== 'newpw') openAuth('newpw'); return; }
  if (session) welcome(session);
}

/* ---------- Meldungen ---------- */
function friendly(e) {
  const c = String((e && (e.code || e.error_code)) || ''), m = String((e && (e.message || e.error_description)) || '');
  if ((e && e.name === 'AuthRetryableFetchError') || /Failed to fetch|NetworkError|Load failed|fetch/i.test(m) && !c) return 'Keine Verbindung zum Anmeldedienst. Prüfe dein Internet und versuche es noch einmal.';
  if (c === 'invalid_credentials' || /Invalid login credentials/i.test(m)) return 'E-Mail oder Passwort stimmt nicht.';
  if (c === 'email_not_confirmed' || /Email not confirmed/i.test(m)) return 'Bitte bestätige zuerst deine E-Mail-Adresse über den Link in der Bestätigungs-E-Mail.';
  if (c === 'user_already_exists' || c === 'email_exists' || /already (been )?registered/i.test(m)) return 'Für diese E-Mail gibt es schon ein Konto. Melde dich an oder nutze „Passwort vergessen?“.';
  if (c === 'weak_password' || /Password should/i.test(m)) return 'Das Passwort ist zu schwach. Nimm mindestens 8 Zeichen, am besten mit Zahlen oder Sonderzeichen.';
  if (c === 'same_password') return 'Das neue Passwort muss sich vom bisherigen unterscheiden.';
  if (/rate_limit/.test(c) || /rate limit|too many|seconds/i.test(m)) return 'Zu viele Versuche oder E-Mails in kurzer Zeit. Bitte warte ein paar Minuten und versuche es dann erneut.';
  if (c === 'signup_disabled' || /Signups not allowed/i.test(m)) return 'Neue Konten können gerade nicht erstellt werden.';
  if (c === 'email_address_invalid' || /Unable to validate email|invalid format|email address .* invalid/i.test(m)) return 'Diese E-Mail-Adresse ist ungültig.';
  if (c === 'otp_expired' || /expired|invalid or has expired/i.test(m)) return 'Der Link ist abgelaufen oder wurde schon benutzt. Fordere einfach einen neuen an.';
  if (c === 'provider_disabled' || /provider is not enabled/i.test(m)) return 'Die Anmeldung mit Google ist noch nicht eingerichtet.';
  if (c === 'access_denied' || /access_denied/i.test(m)) return 'Die Anmeldung wurde abgebrochen.';
  if (m === 'sdk') return 'Der Anmeldedienst konnte nicht geladen werden. Prüfe deine Internetverbindung – Quillmark funktioniert weiter ohne Konto.';
  return 'Das hat nicht geklappt' + (m ? ': ' + m : '.');
}
function say(text, kind, busy) {
  const m = $('#authMsg');
  m.hidden = !text; m.className = 'auth-msg' + (kind ? ' ' + kind : '');
  m.innerHTML = (busy ? '<span class="spin dark"></span>' : '') + A.esc(text || '');
}

/* ---------- Dialog: Ansichten ---------- */
const V = {
  in: { title: 'Anmelden', submit: 'Anmelden', pw: true, pwAuto: 'current-password', tabs: true, google: true, intro: '' },
  up: { title: 'Konto erstellen', submit: 'Konto erstellen', pw: true, pw2: true, pwAuto: 'new-password', tabs: true, google: true, intro: '' },
  forgot: { title: 'Passwort zurücksetzen', submit: 'Link zum Zurücksetzen senden', pw: false, tabs: false, google: false, intro: 'Gib deine E-Mail-Adresse ein. Wir schicken dir einen Link, mit dem du ein neues Passwort festlegst.' },
  newpw: { title: 'Neues Passwort festlegen', submit: 'Passwort speichern', pw: true, pw2: true, pwAuto: 'new-password', email: false, tabs: false, google: false, intro: 'Du bist über den Link aus der E-Mail angemeldet. Lege jetzt ein neues Passwort fest.' }
};
let view = 'in', googleOn = false, signupOff = false, busy = false;
function setView(v, focusField) {
  view = v; const c = V[v];
  $('#authTitle').textContent = c.title;
  $('#authTabs').hidden = !c.tabs || (signupOff && v === 'in');
  $$('#authTabs [role=tab]').forEach(t => { const on = t.dataset.auth === v; t.classList.toggle('on', on); t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1; });
  $('#tabUp').hidden = signupOff;
  $('#authForm').setAttribute('aria-labelledby', v === 'up' ? 'tabUp' : 'tabIn');
  $('#authIntro').textContent = c.intro;
  $('#authGoogleWrap').hidden = !(c.google && googleOn);
  $('#fldEmail').hidden = c.email === false;
  $('#fldPw').hidden = !c.pw; $('#authPw').autocomplete = c.pwAuto || 'off';
  $('#authPwLbl').textContent = v === 'newpw' ? 'Neues Passwort' : 'Passwort';
  $('#fldPw2').hidden = !c.pw2; $('#authPwHint').hidden = !c.pw2;
  $('#authSubmit').textContent = c.submit;
  $('#authForgot').hidden = v !== 'in';
  $('#authBack').hidden = v !== 'forgot';
  $('#authResend').hidden = true;
  say('');
  if (focusField) requestAnimationFrame(() => { const f = c.email === false ? $('#authPw') : $('#authEmail'); f.focus(); });
}
async function openAuth(v) {
  setView(v || 'in');
  $('#authPw').value = ''; $('#authPw2').value = '';
  if (!$('#authModal').hidden) { requestAnimationFrame(() => $('#authTitle').focus()); }
  openModal('#authModal');
  if (v === 'newpw') return;
  say('Anmeldedienst wird geladen …', '', true); setBusy(true);
  try {
    await loadSdk();
    const st = await loadSettings();
    googleOn = !!(st && st.external && st.external.google);
    signupOff = !!(st && st.disable_signup);
    setView(view);
  } catch (e) { say(friendly(e), 'err'); }
  finally { setBusy(false); }
}
function setBusy(b) {
  busy = b;
  ['#authSubmit', '#authGoogle', '#authForgot', '#authResend'].forEach(s => { $(s).disabled = b; });
}
const emailOk = e => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

/* Tabs: Pfeiltasten wie in der W3C-Vorlage */
$('#authTabs').addEventListener('click', e => { const t = e.target.closest('[role=tab]'); if (t && !busy) setView(t.dataset.auth); });
$('#authTabs').addEventListener('keydown', e => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key) || busy) return;
  e.preventDefault();
  const next = (e.key === 'ArrowLeft' || e.key === 'Home') ? 'in' : 'up';
  if (next === 'up' && signupOff) return;
  setView(next); $(next === 'up' ? '#tabUp' : '#tabIn').focus();
});
$('#authForgot').addEventListener('click', () => { const em = $('#authEmail').value; setView('forgot', true); $('#authEmail').value = em; });
$('#authBack').addEventListener('click', () => setView('in', true));

$('#authForm').addEventListener('submit', async e => {
  e.preventDefault(); if (busy) return;
  const email = $('#authEmail').value.trim(), pw = $('#authPw').value, pw2 = $('#authPw2').value;
  if (view !== 'newpw' && !emailOk(email)) { say('Bitte gib eine gültige E-Mail-Adresse ein.', 'err'); $('#authEmail').focus(); return; }
  if (V[view].pw && !pw) { say('Bitte gib dein Passwort ein.', 'err'); $('#authPw').focus(); return; }
  if (V[view].pw2) {
    if (pw.length < MIN_PW) { say(`Das Passwort braucht mindestens ${MIN_PW} Zeichen.`, 'err'); $('#authPw').focus(); return; }
    if (pw !== pw2) { say('Die beiden Passwörter stimmen nicht überein.', 'err'); $('#authPw2').focus(); return; }
  }
  setBusy(true);
  try {
    const cl = await loadSdk();
    if (view === 'in') {
      say('Anmeldung läuft …', '', true);
      const { data, error } = await cl.auth.signInWithPassword({ email, password: pw });
      if (error) { say(friendly(error), 'err'); if (error.code === 'email_not_confirmed' || /not confirmed/i.test(error.message)) $('#authResend').hidden = false; return; }
      welcomed = true; showUser(data.user); closeModal('#authModal'); toast('Angemeldet als ' + (data.user.email || email) + '.');
    } else if (view === 'up') {
      say('Konto wird erstellt …', '', true);
      const { data, error } = await cl.auth.signUp({ email, password: pw, options: { emailRedirectTo: RETURN } });
      if (error) { say(friendly(error), 'err'); return; }
      if (data.session) { welcomed = true; showUser(data.user); closeModal('#authModal'); toast('Konto erstellt – du bist angemeldet.'); return; }
      if (data.user && Array.isArray(data.user.identities) && !data.user.identities.length) { say(friendly({ code: 'user_already_exists' }), 'err'); return; }
      $('#authPw').value = ''; $('#authPw2').value = '';
      say(`Fast geschafft! Wir haben dir eine E-Mail an ${email} geschickt. Öffne den Link darin, um dein Konto zu bestätigen – danach bist du in Quillmark angemeldet. Schau notfalls auch im Spam-Ordner nach.`, 'ok');
      $('#authResend').hidden = false;
    } else if (view === 'forgot') {
      say('Link wird gesendet …', '', true);
      const { error } = await cl.auth.resetPasswordForEmail(email, { redirectTo: RETURN });
      if (error) { say(friendly(error), 'err'); return; }
      say(`Wenn es ein Konto mit ${email} gibt, ist jetzt eine E-Mail mit einem Link zum Zurücksetzen unterwegs. Öffne den Link auf diesem Gerät.`, 'ok');
    } else if (view === 'newpw') {
      say('Passwort wird gespeichert …', '', true);
      const { error } = await cl.auth.updateUser({ password: pw });
      if (error) { say(friendly(error), 'err'); return; }
      closeModal('#authModal'); toast('Neues Passwort gespeichert. Du bist angemeldet.');
    }
  } catch (err) { say(friendly(err), 'err'); }
  finally { setBusy(false); }
});
$('#authResend').addEventListener('click', async () => {
  const email = $('#authEmail').value.trim(); if (!emailOk(email) || busy) return;
  setBusy(true); say('E-Mail wird erneut gesendet …', '', true);
  try {
    const { error } = await (await loadSdk()).auth.resend({ type: 'signup', email, options: { emailRedirectTo: RETURN } });
    say(error ? friendly(error) : `Die Bestätigungs-E-Mail an ${email} ist erneut unterwegs.`, error ? 'err' : 'ok');
  } catch (err) { say(friendly(err), 'err'); }
  finally { setBusy(false); }
});
$('#authGoogle').addEventListener('click', async () => {
  if (busy) return;
  setBusy(true); say('Weiter zu Google …', '', true);
  try {
    const { error } = await (await loadSdk()).auth.signInWithOAuth({ provider: 'google', options: { redirectTo: RETURN } });
    if (error) { say(friendly(error), 'err'); setBusy(false); }
    // sonst leitet das SDK zu Google weiter; nach der Rückkehr stellt es die Sitzung her
  } catch (err) { say(friendly(err), 'err'); setBusy(false); }
});
btnAcc.addEventListener('click', () => openAuth('in'));

/* ---------- Profil-Menü ---------- */
function openMenu() {
  menu.hidden = false; btnProf.setAttribute('aria-expanded', 'true');
  requestAnimationFrame(() => $('#btnSignOut').focus());
}
function closeMenu(focusBack) {
  if (menu.hidden) return;
  menu.hidden = true; btnProf.setAttribute('aria-expanded', 'false');
  if (focusBack) btnProf.focus();
}
btnProf.addEventListener('click', () => (menu.hidden ? openMenu() : closeMenu(true)));
btnProf.addEventListener('keydown', e => { if ((e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') && menu.hidden) { e.preventDefault(); openMenu(); } });
menu.addEventListener('keydown', e => {
  if (e.key === 'Escape') { e.preventDefault(); closeMenu(true); }
  else if (e.key === 'Tab') closeMenu(false);
  else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) { e.preventDefault(); $('#btnSignOut').focus(); }
});
document.addEventListener('pointerdown', e => { if (!menu.hidden && !e.target.closest('.acct-wrap')) closeMenu(false); });
$('#btnSignOut').addEventListener('click', async () => {
  closeMenu(false);
  try { const cl = await loadSdk(); await cl.auth.signOut({ scope: 'local' }); }
  catch (e) { try { localStorage.removeItem(STORE); } catch (x) { /* egal */ } }
  showUser(null); welcomed = false;
  btnAcc.focus();
  toast('Abgemeldet. Deine Notizen und deine Handschrift bleiben auf diesem Gerät.', 4200);
});

/* ---------- Start: Sitzung wiederherstellen bzw. Rückkehr verarbeiten ---------- */
async function start() {
  if (ret.error) {                                   // z. B. abgelaufener E-Mail-Link oder Google abgebrochen
    try { history.replaceState(history.state, '', location.pathname); } catch (e) { /* egal */ }
    await openAuth(ret.type === 'recovery' ? 'forgot' : 'in');
    say(friendly({ code: ret.code || ret.error, message: ret.desc }), 'err');
    return;
  }
  if (!ret.token && !hasStoredSession()) return;    // Gast: nichts nachladen
  try {
    const cl = await loadSdk();
    const { data } = await cl.auth.getSession();
    if (data && data.session) {
      showUser(data.session.user); welcome(data.session);
      if (ret.token && ret.type === 'recovery' && ($('#authModal').hidden || view !== 'newpw')) openAuth('newpw');
    }
  } catch (e) { if (ret.token) toast(friendly(e), 6000); }
}
start();

A.auth = { configured: true, user: () => user, open: openAuth, signOutLocal: () => { try { localStorage.removeItem(STORE); } catch (e) { /* egal */ } showUser(null); } };
})();
