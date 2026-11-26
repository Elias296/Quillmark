/* ==========================================================================
   Quillmark – Meine Notizen (mehrere Lernzettel, Papierkorb) und Komplett-Backup
   Die geöffnete Notiz lebt wie bisher in S.draft; die Liste hält alle Notizen.
   ========================================================================== */
(function () {
'use strict';
const A = window.TWApp.APP;
const { $, S, K, LS, IDB, esc, toast, confirmDialog, openModal, closeModal, downloadBlob } = A;
const DAY = 864e5, TRASH_DAYS = 30;
const newId = () => 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const isEmpty = d => !String(d.text || '').trim() && !String(d.title || '').trim();
const IMG_RE = /!\[[^\]]*\]\(bild:([A-Za-z0-9_-]+)\)/g;

let N = LS.get(K.notes, null);
if (!N || !Array.isArray(N.list)) {                       // Umstieg: der bisherige Einzel-Entwurf wird die erste Notiz
  N = { active: null, list: [] };
  if (!S.draft.isSample && !isEmpty(S.draft)) { N.active = newId(); N.list.push(fromDraft(N.active)); }
}
N.list = N.list.filter(e => !(e.deleted && Date.now() - e.deleted > TRASH_DAYS * DAY));   // alter Papierkorb
persist();

function fromDraft(id) {
  const t = Date.now();
  return { id, title: S.draft.title || '', text: S.draft.text || '', imports: S.draft.imports || 0, created: t, updated: t, deleted: 0 };
}
function persist() { LS.set(K.notes, N); }
const live = () => N.list.filter(e => !e.deleted).sort((a, b) => b.updated - a.updated);
const trashed = () => N.list.filter(e => e.deleted).sort((a, b) => b.deleted - a.deleted);

/* Geöffnete Notiz in die Liste übernehmen (leere Notizen werden nicht aufgehoben, die Beispielnotiz nie) */
let lastKey = '';
function commit() {
  if (S.draft.isSample) return;
  const key = N.active + '\u0000' + S.draft.title + '\u0000' + S.draft.text;
  if (key === lastKey) return;
  lastKey = key;
  let e = N.active && N.list.find(x => x.id === N.active);
  if (isEmpty(S.draft)) { if (e) { N.list = N.list.filter(x => x !== e); persist(); } return; }
  if (!N.active) N.active = newId();
  if (!e) { e = fromDraft(N.active); N.list.push(e); }
  else if (e.title !== S.draft.title || e.text !== S.draft.text) e.updated = Date.now();
  e.title = S.draft.title || ''; e.text = S.draft.text || ''; e.imports = S.draft.imports || 0; e.deleted = 0;
  persist();
}
setInterval(commit, 1500);
addEventListener('pagehide', commit);
document.addEventListener('visibilitychange', () => { if (document.hidden) commit(); });

function load(e) {
  N.active = e ? e.id : newId(); persist();
  S.undo = null; LS.del(K.undo);                          // Rückgängig gilt nur innerhalb einer Notiz
  A.setDraft(e ? { title: e.title, text: e.text, isSample: false, imports: e.imports || 0 } : { title: '', text: '', isSample: false, imports: 0 });
  lastKey = '';
}
function openNote(id) {
  commit();
  const e = N.list.find(x => x.id === id && !x.deleted); if (!e) return;
  if (id !== N.active || S.draft.isSample) load(e);
  closeModal('#notesModal');
  toast(`„${label(e)}“ geöffnet.`);
}
function newNote() {
  commit();
  const fromSample = !!S.draft.isSample;
  load(null);
  closeModal('#notesModal');
  A.setMode('import'); requestAnimationFrame(() => $('#editor').focus());
  toast(fromSample ? 'Deine erste Notiz: Text schreiben, einfügen oder „Text aus Foto erkennen“.' : 'Neue Notiz angelegt. Die vorige findest du unter „Meine Notizen“.', 4200);
}
function trash(id) {
  commit();
  const e = N.list.find(x => x.id === id); if (!e) return;
  e.deleted = Date.now();
  if (id === N.active) load(live()[0] || null);
  persist(); render();
  toast(`„${label(e)}“ liegt im Papierkorb.`);
}
function restore(id) {
  const e = N.list.find(x => x.id === id); if (!e) return;
  e.deleted = 0; e.updated = Date.now(); persist(); render();
  toast(`„${label(e)}“ wiederhergestellt.`);
}
async function purge(ids, what) {
  if (!ids.length) return;
  if (!(await confirmDialog(what, 'Das lässt sich nicht rückgängig machen. Bilder, die nur in diesen Notizen vorkommen, werden ebenfalls gelöscht.', 'Endgültig löschen', true))) return;
  N.list = N.list.filter(e => !ids.includes(e.id)); persist(); gcImages(); render();
}
/* Bilder löschen, auf die keine Notiz mehr verweist */
function gcImages() {
  const refs = new Set(), add = t => { for (const m of String(t || '').matchAll(IMG_RE)) refs.add(m[1]); };
  N.list.forEach(e => add(e.text)); add(S.draft.text); if (S.undo) add(S.undo.text);
  let n = 0;
  for (const id of Object.keys(S.imgMeta || {})) if (!refs.has(id)) { delete S.imgMeta[id]; IDB.del('img:' + id); n++; }
  if (n) LS.quiet(K.images, S.imgMeta);
}
function wipe() { N = { active: null, list: [] }; lastKey = ''; persist(); }

/* ---------- Liste ---------- */
const label = e => (e.title || '').trim() || (e.text || '').trim().split('\n')[0].replace(/^#+\s*/, '').slice(0, 60) || 'Ohne Titel';
function when(t) {
  const d = new Date(t), now = new Date(), hm = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return 'heute, ' + hm;
  if (d.toDateString() === new Date(now - DAY).toDateString()) return 'gestern, ' + hm;
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ', ' + hm;
}
const words = t => { const s = String(t || '').trim(); return s ? s.split(/\s+/).length : 0; };
const BIN = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>';
function render() {
  commit();
  const L = live(), T = trashed(), act = S.draft.isSample ? null : N.active;
  $('#notesList').innerHTML = L.length ? L.map(e => `<li class="note-row${e.id === act ? ' on' : ''}">
      <button class="note-open" data-open="${e.id}"${e.id === act ? ' aria-current="true"' : ''}><b>${esc(label(e))}</b><small>${e.id === act ? 'Geöffnet · ' : ''}geändert ${when(e.updated)} · ${words(e.text).toLocaleString('de-DE')} Wörter</small></button>
      <button class="icon-btn" data-trash="${e.id}" aria-label="„${esc(label(e))}“ in den Papierkorb" title="In den Papierkorb">${BIN}</button></li>`).join('')
    : '<li class="note-empty">Noch keine eigenen Notizen. Tippe auf „Neue Notiz“.</li>';
  $('#trashSum').textContent = `Papierkorb (${T.length})`;
  $('#trashList').innerHTML = T.length ? T.map(e => `<li class="note-row">
      <span class="note-open"><b>${esc(label(e))}</b><small>gelöscht ${when(e.deleted)}</small></span>
      <button class="btn btn-sm" data-restore="${e.id}">Wiederherstellen</button>
      <button class="btn btn-sm btn-ghost" data-purge="${e.id}" aria-label="„${esc(label(e))}“ endgültig löschen">Löschen</button></li>`).join('')
    : '<li class="note-empty">Der Papierkorb ist leer.</li>';
  $('#trashEmpty').hidden = !T.length;
}
function keepFocus(fn) { return e => { fn(e); if (!$('#notesModal').hidden && !$('#notesModal').contains(document.activeElement)) $('#notesNew').focus(); }; }

$('#btnNotes').addEventListener('click', () => { render(); openModal('#notesModal'); });
$('#notesNew').addEventListener('click', newNote);
$('#notesList').addEventListener('click', keepFocus(e => {
  const o = e.target.closest('[data-open]'), t = e.target.closest('[data-trash]');
  if (t) trash(t.dataset.trash); else if (o) openNote(o.dataset.open);
}));
$('#trashList').addEventListener('click', keepFocus(e => {
  const r = e.target.closest('[data-restore]'), p = e.target.closest('[data-purge]');
  if (r) restore(r.dataset.restore);
  else if (p) { const x = N.list.find(n => n.id === p.dataset.purge); purge([p.dataset.purge], `„${x ? label(x) : 'Notiz'}“ endgültig löschen?`); }
}));
$('#trashEmpty').addEventListener('click', () => purge(trashed().map(e => e.id), `Papierkorb leeren (${trashed().length})?`));

/* ---------- Komplett-Backup ---------- */
async function saveBackup() {
  commit();
  const images = {};
  for (const [id, meta] of Object.entries(S.imgMeta || {})) {
    const data = await IDB.get('img:' + id).catch(() => null);
    if (typeof data === 'string') images[id] = { w: meta.w, h: meta.h, t: meta.t || 0, data };
  }
  const glyphs = (S.own && S.own.glyphs) || {};
  const data = { app: 'Quillmark', typ: 'backup', v: 1, erstellt: new Date().toISOString(), active: N.active, notes: N.list, settings: S.settings, own: { v: 1, glyphs }, images };
  downloadBlob(new Blob([JSON.stringify(data)], { type: 'application/json' }), `Quillmark-Backup-${new Date().toISOString().slice(0, 10)}.json`);
  toast(`Backup gespeichert: ${N.list.length} Notizen, ${Object.keys(images).length} Bilder, ${Object.keys(glyphs).length} eigene Zeichen.`, 4500);
}
function readBackup(data) {
  if (!data || data.app !== 'Quillmark' || data.typ !== 'backup' || !Array.isArray(data.notes)) throw new Error('Das ist keine Quillmark-Backup-Datei.');
  const num = v => (Number.isFinite(+v) && +v > 0 ? +v : 0);
  const notes = data.notes.filter(e => e && typeof e.id === 'string' && /^[\w-]{1,40}$/.test(e.id) && typeof e.text === 'string')
    .map(e => ({ id: e.id, title: String(e.title || '').slice(0, 300), text: e.text.slice(0, 500000), imports: num(e.imports), created: num(e.created) || Date.now(), updated: num(e.updated) || Date.now(), deleted: num(e.deleted) }));
  const images = {};
  for (const [id, m] of Object.entries(data.images || {})) {
    if (/^[A-Za-z0-9_-]{1,40}$/.test(id) && m && typeof m.data === 'string' && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(m.data) && num(m.w) && num(m.h)) images[id] = m;
  }
  const own = A.cleanGlyphs(data.own && data.own.glyphs);
  const settings = {};
  for (const [k, v] of Object.entries(data.settings || {})) if (k in TW.DEFAULT_SETTINGS && typeof v === typeof TW.DEFAULT_SETTINGS[k]) settings[k] = v;
  return { notes, images, own, settings, active: typeof data.active === 'string' ? data.active : null };
}
async function openBackup(file) {
  let B;
  try { B = readBackup(JSON.parse(await file.text())); } catch (err) { toast('Backup konnte nicht geöffnet werden: ' + (err instanceof SyntaxError ? 'Die Datei ist beschädigt.' : err.message), 6000); return; }
  const ni = Object.keys(B.images).length;
  const msg = `${B.notes.length} ${B.notes.length === 1 ? 'Notiz' : 'Notizen'} und ${ni} ${ni === 1 ? 'Bild' : 'Bilder'} werden hinzugefügt. Gibt es eine Notiz schon, gewinnt die neuere Fassung.` +
    (B.own.n ? `\nDeine eigene Handschrift wird durch die aus dem Backup ersetzt (${B.own.n} Zeichen).` : '') +
    (Object.keys(B.settings).length ? '\nDie Blatt- und Schrifteinstellungen werden aus dem Backup übernommen.' : '');
  if (!(await confirmDialog('Backup öffnen?', msg, 'Übernehmen'))) return;
  commit();
  let changedActive = false;
  for (const b of B.notes) {
    const e = N.list.find(x => x.id === b.id);
    if (!e) N.list.push(b);
    else if (b.updated > e.updated) { Object.assign(e, b); if (e.id === N.active) changedActive = true; }
  }
  for (const [id, m] of Object.entries(B.images)) {
    try { await IDB.set('img:' + id, m.data); S.imgMeta[id] = { w: +m.w, h: +m.h, t: +m.t || Date.now() }; } catch (e) { /* einzelnes Bild übersprungen */ }
  }
  LS.quiet(K.images, S.imgMeta);
  if (B.own.n) { S.own = { v: 1, glyphs: B.own.clean }; A.saveOwn(); }
  if (Object.keys(B.settings).length) { Object.assign(S.settings, B.settings); A.saveSettings(); }
  persist();
  const target = (S.draft.isSample || isEmpty(S.draft)) ? (live().find(e => e.id === B.active) || live()[0]) : (changedActive ? N.list.find(e => e.id === N.active) : null);
  if (target) load(target);
  A.refreshPanels(); A.relayout(true); render();
  toast(`Backup übernommen: ${B.notes.length} Notizen, ${ni} Bilder${B.own.n ? `, ${B.own.n} eigene Zeichen` : ''}.`, 4500);
}
$('#backupSave').addEventListener('click', () => saveBackup().catch(e => toast('Backup fehlgeschlagen: ' + ((e && e.message) || e), 6000)));
$('#backupOpen').addEventListener('click', () => $('#backupFile').click());
$('#backupFile').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) openBackup(f); });

A.notes = { newNote, openNote, wipe, commit, list: () => N };
})();
