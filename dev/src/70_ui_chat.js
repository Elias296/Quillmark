/* ==========================================================================
   Quillmark – Chat mit Tizian (Fragen, Lernzettel mit Skizzen, Aufgaben) und Bilder im Lernzettel
   ========================================================================== */
(function () {
'use strict';
const A = window.TWApp.APP, AI = window.TWApp.AI;
const { $, $$, S, K, LS, IDB, esc, toast, confirmDialog } = A;

/* ---------- Bilder in den Notiztext einfügen ---------- */
function newId() { return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3); }
async function insertImage(file) {
  const r = await A.cropOne(file, 0, 1, 'image');
  A.closeModal('#cropModal');
  if (r.action !== 'ok' || !r.canvas) return;
  const url = r.canvas.toDataURL('image/jpeg', 0.85), id = newId();
  try { await IDB.set('img:' + id, url); }
  catch (e) { toast('Das Bild konnte nicht gespeichert werden (Speicher voll?).', 5000); return; }
  S.imgMeta[id] = { w: r.canvas.width, h: r.canvas.height, t: Date.now() };
  LS.quiet(K.images, S.imgMeta);
  const ed = $('#editor'), pos = ed.selectionStart != null ? ed.selectionEnd : ed.value.length;
  const before = ed.value.slice(0, pos), after = ed.value.slice(pos);
  const ins = (before && !before.endsWith('\n') ? '\n' : '') + `![Bild](bild:${id})` + (after.startsWith('\n') ? '' : '\n');
  ed.value = before + ins + after;
  ed.dispatchEvent(new Event('input'));
  toast('Bild eingefügt. Es erscheint auf dem Blatt an dieser Stelle.');
}
$('#btnImg').addEventListener('click', () => $('#imgFile').click());
$('#imgFile').addEventListener('change', async e => {
  const f = (e.target.files || [])[0]; e.target.value = '';
  if (f) { try { await insertImage(f); } catch (err) { toast('Bild konnte nicht gelesen werden.', 4000); } }
});

/* ---------- Chat ---------- */
const CHAT_SYS = 'Du heißt Tizian und bist der Lern-Assistent in der App Quillmark. Antworte auf Deutsch (außer bei Fragen in einer anderen Sprache), freundlich, klar und eher kurz. ' +
  'Erfinde keine Fakten; wenn du etwas nicht weißt, sag es. Erledige Aufgaben vollständig. ' +
  'Wenn du einen Lernzettel schreibst, nutze dieses Format, weil die App es als Handschrift auf ein Blatt zeichnet: erste Zeile „# Titel“, Abschnitte mit „## …“, ' +
  'Stichpunkte mit „- “, wichtige Begriffe **fett**. Skizzen stehen jeweils allein in einer Zeile: Ablauf als [[Schritt 1 -> Schritt 2 -> Schritt 3]] ' +
  'oder Mindmap als [[Thema: Punkt, Punkt, Punkt]] (höchstens 6 Punkte, je 1–3 Wörter). Verwende kein LaTeX und keine Tabellen mit Strichen.';
/* Rechenweg nur, wenn danach gefragt wird */
const WAY_RE = /rechenweg|lösungsweg|lösungsschritt|schritt für schritt|erklär|zeig.{0,20}(?:weg|wie|schritt)|wie (?:kommt|rechnet|geht|komme|rechne)|warum|begründ/i;
const waySys = way => way
  ? ' Der Nutzer möchte den Rechen- bzw. Lösungsweg sehen: zeige ihn kurz und verständlich.'
  : ' Bei Rechnungen und Aufgaben nenne nur das Ergebnis bzw. die Lösung – ohne Rechenweg, Zwischenschritte oder Erklärung, außer der Nutzer bittet ausdrücklich darum.';
const ACTIONS = {
  lernzettel: { label: 'Lernzettel', need: 'topic' },
  zusammenfassen: { label: 'Zusammenfassen', need: 'note' },
  quiz: { label: 'Quiz', need: 'note' },
  aufgaben: { label: 'Aufgaben lösen', need: 'note' }
};
let chat = (LS.get(K.chat, []) || []).filter(m => m && m.text).slice(-60);
let busy = false, pending = null;
const log = $('#chatLog'), input = $('#chatInput');
const save = () => LS.quiet(K.chat, chat.slice(-60));
const noteText = () => (S.draft.isSample ? '' : S.draft.text.trim());

function cleanChat(t) {
  return String(t || '').replace(/<think>[\s\S]*?(<\/think>|$)/g, '').replace(/\\\(|\\\)|\\\[|\\\]|\$\$?/g, '')
    .replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, '$1/$2').replace(/\\(?:cdot|times)/g, '·').replace(/^\s+/, '');
}
const isSheet = t => /^\s*#\s/m.test(t) || /\[\[.+\]\]/.test(t);

function bubble(m, i) {
  const who = m.role === 'user' ? 'me' : 'ai';
  const body = esc(m.text).replace(/\[\[([^\]]+)\]\]/g, '<span class="sk">✎ Skizze: $1</span>')
    .replace(/^#{1,3}\s+(.+)$/gm, '<b class="h">$1</b>').replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>');
  const acts = m.role === 'assistant' && !m.pending && m.text
    ? `<div class="msg-acts"><button class="btn btn-sm ${isSheet(m.text) ? 'btn-primary' : ''}" data-take="${i}">${isSheet(m.text) ? 'Als Lernzettel übernehmen' : 'Als Notiz'}</button><button class="btn btn-sm" data-append="${i}">Anhängen</button><button class="btn btn-sm btn-ghost" data-copy="${i}">Kopieren</button></div>` : '';
  return `<div class="msg ${who}${m.note ? ' sys' : ''}"><div class="bub">${body || '<span class="spin dark"></span>'}</div>${m.by ? `<div class="by">${esc(m.by)}</div>` : ''}${acts}</div>`;
}
function render(scroll) {
  log.innerHTML = chat.length ? chat.map(bubble).join('') : `<div class="chat-empty"><b>Frag Tizian etwas</b><span>„Erkläre mir die Zellatmung“, „Mach mir einen Lernzettel über Vulkane mit Skizze“ oder „Löse: 3x + 5 = 20“. Antworten kannst du mit einem Tipp aufs Blatt übernehmen.</span></div>`;
  if (scroll !== false) log.scrollTop = log.scrollHeight;
}
function status() {
  const b = $('#chatState'), srv = AI.srv && AI.srv.on && AI.loaded === 'server';
  if (AI.state === 'ready') { b.className = 'badge ok'; b.innerHTML = `<i></i>${srv ? (AI.srvPrivate && AI.srvPrivate() ? 'Eigener Rechner' : 'Server') : 'bereit'}`; }
  else if (AI.state === 'loading') { b.className = 'badge'; b.innerHTML = '<i></i>lädt …'; }
  else { b.className = 'badge off'; b.innerHTML = '<i></i>nicht geladen'; }
  $('#chatSend').textContent = busy ? 'Stopp' : 'Senden';
  $('#chatSend').classList.toggle('btn-danger', busy); $('#chatSend').classList.toggle('btn-primary', !busy);
}
document.addEventListener('tw-ai-state', () => {
  status();
  if (AI.state === 'ready' && pending) { const p = pending; pending = null; ask(p.text, p.prompt); }
  if (AI.state === 'idle' && pending && !AI.running) { pending = null; dropPlaceholder(); }
});
function dropPlaceholder() { if (chat.length && chat[chat.length - 1].pending) { chat.pop(); render(); } }

function history(limit) {
  return chat.filter(m => !m.pending && !m.note).slice(-limit).map(m => ({ role: m.role, content: m.text.slice(0, 2500) }));
}
/* Eine Anfrage an Tizian: text = sichtbare Nachricht, prompt = was das Modell bekommt (Standard: text) */
async function ask(text, prompt) {
  if (busy) return;
  // „Was ist 5+5?“, „wie viel ist 12 * 3“, „5+5“ → exakter Rechner
  const q = text.trim().replace(/^(?:was|wie ?viel)\s+(?:ist|sind|ergibt|ergeben|macht|gibt)\s+/i, '').replace(/\s*[?!.]+$/, '');
  const calc = TW.solver.calcTask(text) || (/^[\d\s.,+\-−–×xX·*÷:/()]+$/.test(q) && /\d\s*[-+−–×xX·*÷:/]\s*[\d(]/.test(q) ? TW.solver.calcTask(q + ' =') : null);
  if (calc && !prompt) {                                 // reine Rechenzeilen: exakter Rechner, ohne KI
    const res = calc.length === 1 && !/=\s*[._\s?…□]*$/.test(text.trim()) ? calc[0].replace(/^.*=\s*/, '') : calc.join('\n');   // Frage „Was ist 5+5?“ → nur „10“
    chat.push({ role: 'user', text }, { role: 'assistant', text: res, by: 'Rechner' }); save(); render(); return;
  }
  if (AI.state !== 'ready') {
    const srv = AI.srv && AI.srv.on;
    if (!AI.gpu && !srv) {
      chat.push({ role: 'user', text }, { role: 'assistant', note: true, text: 'Tizian läuft auf diesem Gerät nicht lokal. Richte unter „Text & KI → Tizian → Server statt lokal“ deinen Laptop oder einen Server ein.' });
      save(); render(); return;
    }
    chat.push({ role: 'user', text }, { role: 'assistant', text: '', pending: true }); render();
    pending = { text, prompt, queued: true };
    if (AI.state !== 'loading') $('#btnLoadModel').click();
    return;
  }
  busy = true; status();
  if (!(chat.length && chat[chat.length - 1].pending)) chat.push({ role: 'user', text }, { role: 'assistant', text: '', pending: true });
  else if (chat[chat.length - 2] && chat[chat.length - 2].text !== text) chat.splice(chat.length - 1, 0, { role: 'user', text });
  const msg = chat[chat.length - 1]; render();
  const ctx = $('#chatCtx').checked && noteText() ? `\n\nAktueller Notiztext (zur Orientierung):\n${noteText().slice(0, 3000)}` : '';
  const hist = history(9);
  if (hist.length && hist[hist.length - 1].role === 'user') hist.pop();          // die aktuelle Frage kommt gleich (ggf. als ausführlicher Auftrag)
  const msgs = [{ role: 'system', content: CHAT_SYS + waySys(WAY_RE.test(text)) + ctx }, ...hist, { role: 'user', content: prompt || text }];
  let cur = '';
  AI.running = true;
  try {
    const r = await AI.generate(msgs, { max_new_tokens: 900, do_sample: false, repetition_penalty: 1.05 }, x => {
      cur += x; msg.text = cleanChat(cur); const b = log.lastElementChild && log.lastElementChild.querySelector('.bub');
      if (b) { b.textContent = msg.text; log.scrollTop = log.scrollHeight; }
    });
    msg.text = cleanChat(r.text || cur).trim() + (r.interrupted ? ' …' : '');
    if (!msg.text) msg.text = '(keine Antwort)';
  } catch (e) {
    msg.text = 'Fehler: ' + ((e && e.message) || e); msg.note = true;
  }
  delete msg.pending; AI.running = false; busy = false;
  save(); render(); status();
}
function send() {
  if (busy) { AI.interrupt(); return; }
  const t = input.value.trim(); if (!t) return;
  input.value = ''; autoGrow();
  ask(t);
}
$('#chatSend').addEventListener('click', send);
input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); } });
function autoGrow() { input.style.height = 'auto'; input.style.height = Math.min(160, input.scrollHeight) + 'px'; }
input.addEventListener('input', autoGrow);

/* Schnell-Aktionen */
$('#chatChips').addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b || busy) return;
  const act = b.dataset.act, note = noteText(), extra = input.value.trim();
  if (act === 'aufgaben') {
    const t = extra || note;
    if (!t) { toast('Schreib die Aufgaben ins Eingabefeld oder in den Notiztext.'); return; }
    input.value = ''; autoGrow();
    ask(extra ? `Löse diese Aufgaben:\n${extra}` : 'Löse die Aufgaben aus meinem Notiztext.', `Löse die folgenden Aufgaben vollständig. Nummeriere die Lösungen wie die Aufgaben, ${WAY_RE.test(extra || '') ? 'zeige bei Rechnungen kurz den Rechenweg und schreibe am Ende jeweils „Ergebnis: …“' : 'gib zu jeder Aufgabe nur die Lösung bzw. das Ergebnis an, ohne Rechenweg'}.\n\n${t.slice(0, 4000)}`);
    return;
  }
  if (act === 'lernzettel') {
    const src = extra || note;
    if (!src) { toast('Schreib ein Thema ins Eingabefeld (z. B. „Vulkane“) oder fülle den Notiztext.'); input.focus(); return; }
    input.value = ''; autoGrow();
    const fromText = !extra && note;
    ask(fromText ? 'Mach einen Lernzettel aus meinem Notiztext – mit Skizze.' : `Mach einen Lernzettel über: ${extra} – mit Skizze.`,
      (fromText ? `Erstelle einen übersichtlichen Lernzettel aus diesem Text:\n${note.slice(0, 4000)}\n\n` : `Erstelle einen übersichtlichen Lernzettel über: ${extra}\n\n`) +
      'Halte dich genau an das Lernzettel-Format (# Titel, ## Abschnitte, - Stichpunkte, **fett**) und füge genau 1–2 Skizzen ein: einen Ablauf [[A -> B -> C]] und/oder eine Mindmap [[Thema: a, b, c]]. Höchstens etwa 25 Zeilen.');
    return;
  }
  if (!note) { toast('Der Notiztext ist leer oder noch die Beispielnotiz.'); return; }
  if (act === 'zusammenfassen') ask('Fasse meinen Notiztext zusammen.', `Fasse diesen Text in 5–8 Stichpunkten zusammen (Format „- …“), behalte alle Zahlen und Fachbegriffe:\n\n${note.slice(0, 5000)}`);
  if (act === 'quiz') ask('Stell mir Quizfragen zu meinem Notiztext.', `Erstelle 5 Quizfragen zu diesem Text. Format: „1. Frage“ und darunter „Antwort: …“. Nur Fakten aus dem Text:\n\n${note.slice(0, 5000)}`);
});

/* Antworten übernehmen */
log.addEventListener('click', async e => {
  const t = e.target.closest('[data-take],[data-append],[data-copy]'); if (!t) return;
  const i = +(t.dataset.take || t.dataset.append || t.dataset.copy), m = chat[i]; if (!m) return;
  if (t.dataset.copy !== undefined) { try { await navigator.clipboard.writeText(m.text); toast('Kopiert.'); } catch (err) { toast('Kopieren nicht möglich.'); } return; }
  const text = m.text.replace(/\s+…$/, '').trim();
  if (t.dataset.append !== undefined) {
    if (S.draft.isSample || !S.draft.text.trim()) { toast('Anhängen geht nur an eine eigene Notiz. Nimm „Als Notiz“.'); return; }
    A.snapshot('Chat-Antwort angehängt');
    A.setDraft({ title: S.draft.title, text: S.draft.text.replace(/\s+$/, '') + '\n\n' + text, isSample: false, imports: (S.draft.imports || 0) + 1 });
    toast('An die Notiz angehängt.'); return;
  }
  const has = S.draft.text.trim() && !S.draft.isSample;
  if (has && !(await confirmDialog('Aktuelle Notiz ersetzen?', 'Die Antwort wird als neue Notiz übernommen. Mit dem Rückgängig-Pfeil kannst du die bisherige Notiz einmal wiederherstellen.', 'Ersetzen'))) return;
  const h = /^\s*#\s+(.+)$/m.exec(text);
  A.snapshot('Chat-Antwort als Notiz');
  A.setDraft({ title: h ? h[1].trim() : 'Notiz von Tizian', text, isSample: false, imports: 1 });
  toast(isSheet(text) ? 'Lernzettel aufs Blatt übernommen.' : 'Als Notiz übernommen.');
  if (window.matchMedia('(max-width:900px)').matches) A.setView('stage');
});
$('#chatClear').addEventListener('click', async () => {
  if (!chat.length || busy) return;
  if (!(await confirmDialog('Chat leeren?', 'Alle Nachrichten werden auf diesem Gerät gelöscht.', 'Leeren', true))) return;
  chat = []; save(); render();
});

/* Foto anhängen: Texterkennung, Text landet im Eingabefeld */
$('#chatAttach').addEventListener('click', () => $('#chatFile').click());
$('#chatFile').addEventListener('change', e => { const f = Array.from(e.target.files || []); e.target.value = ''; if (f.length) A.runImport(f, 'chat'); });
A.chatAttach = text => {
  A.setMode('chat');
  input.value = (input.value.trim() ? input.value.trim() + '\n\n' : '') + text;
  autoGrow(); input.focus();
  toast('Text aus dem Bild steht im Eingabefeld. Ergänze deine Frage und tippe „Senden“.', 4500);
};
window.TWApp.chat = { ask, get: () => chat };

render(); status();
})();
