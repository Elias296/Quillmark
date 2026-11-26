// Browser-Test: Handy-Layout, Einstieg, Dialog-Fokus, Löschen, Meine Notizen & Komplett-Backup.
// node dev/tools/e2e-notes.js [screenshot-ordner]   (lokaler Server auf Port 8765)
const { chromium } = require('playwright'); const path = require('path'), os = require('os');
const out = process.argv[2] || os.tmpdir();
let fails = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };
const URL = 'http://127.0.0.1:8765/index.html';
(async () => {
  const b = await chromium.launch(); const errs = [];
  const watch = pg => { pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); }); };

  // ---------- 1. Handy-Layout
  for (const w of [390, 320]) {
    const pg = await b.newPage({ viewport: { width: w, height: 740 }, isMobile: true, hasTouch: true }); watch(pg);
    await pg.goto(URL); await pg.waitForTimeout(300);
    const r = await pg.evaluate(() => {
      const W = innerWidth, inside = el => { const q = el.getBoundingClientRect(); return q.left >= -1 && q.right <= W + 1; };
      const labs = [...document.querySelectorAll('#modeSeg .t-short')].map(e => e.getBoundingClientRect().width > 10 && getComputedStyle(e).display !== 'none');
      const nav = document.querySelector('.rail').getBoundingClientRect();
      return { labs: labs.every(Boolean) && labs.length === 4, bottom: nav.bottom > innerHeight - 30 && nav.width > W * 0.9, exp: inside(document.querySelector('#btnExport')), sw: document.documentElement.scrollWidth <= W };
    });
    ok(r.labs && r.bottom, `${w} px: beschriftete Navigation unten`);
    ok(r.exp && r.sw, `${w} px: Exportknopf sichtbar, kein seitliches Scrollen`);
    await pg.click('#modeSeg [data-mode=chat]'); await pg.waitForTimeout(200);
    const cw = await pg.evaluate(() => document.querySelector('#chatInput').getBoundingClientRect().width);
    ok(cw >= 100, `${w} px: Chatfeld breit genug (${Math.round(cw)} px)`);
    await pg.click('#viewSeg [data-view=stage]'); await pg.waitForTimeout(250);
    const pill = await pg.evaluate(() => { const q = document.querySelector('.pill').getBoundingClientRect(), n = document.querySelector('.rail').getBoundingClientRect(); return q.left >= 0 && q.right <= innerWidth && q.bottom <= n.top; });
    ok(pill, `${w} px: Zoom- und Seitenleiste vollständig sichtbar`);
    await pg.screenshot({ path: path.join(out, `handy_${w}.png`) });
    await pg.close();
  }

  // ---------- 2. Einstieg
  const ctx = await b.newContext({ viewport: { width: 1180, height: 820 }, acceptDownloads: true });
  const pg = await ctx.newPage(); watch(pg);
  const ev = (f, a) => pg.evaluate(f, a);
  await pg.goto(URL); await pg.waitForTimeout(300);
  ok(await ev(() => { const n = document.querySelector('#btnNew'); return n.textContent === 'Eigene Notiz starten' && n.classList.contains('btn-primary') && !document.querySelector('#btnExport').classList.contains('btn-primary'); }), 'Erster Besuch: „Eigene Notiz starten“ hervorgehoben, Export zurückhaltend');
  ok(await ev(() => /Text aus Foto erkennen/.test(document.querySelector('#btnPick').textContent) && /Bild aufs Blatt setzen/.test(document.querySelector('#btnImg').textContent)), 'Bildaktionen heißen „Text aus Foto erkennen“ und „Bild aufs Blatt setzen“');
  await pg.click('#btnExport'); await pg.waitForTimeout(600);
  ok(await ev(() => !document.querySelector('#exportModal').hidden && document.querySelector('#exportResult').hidden && !document.querySelector('#exDownload').getAttribute('href') && document.querySelector('#exTech').hidden), 'Export-Dialog erzeugt nichts ungefragt');
  await pg.click('#exGn'); await pg.waitForSelector('#exportResult:not([hidden])', { timeout: 20000 });
  ok(await ev(() => { const t = document.querySelector('#exTech'); return !t.hidden && !t.open && /von \d+ bestanden/.test(document.querySelector('#exTechSum').textContent) && /\.goodnotes$/.test(document.querySelector('#exDownload').download); }), 'Goodnotes gewählt: Datei fertig, technische Prüfung eingeklappt');
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(100);
  ok(await ev(() => document.querySelector('#exportModal').hidden), 'Escape schließt den Export-Dialog');

  // ---------- 3. Dialog-Fokus
  await pg.focus('#btnSettings'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(150);
  ok(await ev(() => document.querySelector('#settingsModal').contains(document.activeElement) && document.querySelector('.app').inert), 'Einstellungen: Fokus springt in den Dialog, Hintergrund inaktiv');
  let inside = true;
  for (let i = 0; i < 25; i++) { await pg.keyboard.press('Tab'); inside = inside && await ev(() => document.querySelector('#settingsModal').contains(document.activeElement)); }
  await pg.keyboard.press('Shift+Tab'); inside = inside && await ev(() => document.querySelector('#settingsModal').contains(document.activeElement));
  ok(inside, 'Tab und Shift+Tab bleiben im Dialog');
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(100);
  ok(await ev(() => document.querySelector('#settingsModal').hidden && document.activeElement.id === 'btnSettings' && !document.querySelector('.app').inert), 'Schließen: Fokus zurück aufs Zahnrad');
  await pg.click('#btnSettings'); await pg.click('#delDraft'); await pg.waitForTimeout(100);
  ok(await ev(() => document.activeElement.id === 'confirmNo'), 'Lösch-Rückfrage: Fokus auf „Abbrechen“');
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(100);
  ok(await ev(() => document.querySelector('#confirmModal').hidden && document.activeElement.id === 'delDraft'), 'Rückfrage geschlossen: Fokus zurück auf den Löschknopf');
  await pg.click('#settingsModal [data-close]');

  // ---------- 4. Löschen nimmt auch den geöffneten Chat mit
  await pg.click('#modeSeg [data-mode=chat]');
  await pg.fill('#chatInput', '12 + 30 ='); await pg.click('#chatSend'); await pg.waitForTimeout(100);
  await pg.click('#btnSettings'); await pg.click('#delDraft'); await pg.click('#confirmYes'); await pg.waitForTimeout(150); await pg.click('#settingsModal [data-close]');
  await pg.fill('#chatInput', '1 + 1 ='); await pg.click('#chatSend'); await pg.waitForTimeout(100);
  const ch = await ev(() => JSON.parse(localStorage.getItem('tintenwerk.chat.v1') || '[]').map(m => m.text));
  ok(ch.length === 2 && !ch.some(t => /42/.test(t)), 'Nach „Alle Notizen löschen“ kommt der alte Chat nicht zurück: ' + JSON.stringify(ch));
  await pg.click('#chatClear'); await pg.click('#confirmYes');

  // ---------- 5. Meine Notizen
  await pg.click('#modeSeg [data-mode=import]');
  const JPG = await ev(() => { const c = document.createElement('canvas'); c.width = 60; c.height = 40; const x = c.getContext('2d'); x.fillStyle = '#c0392b'; x.fillRect(0, 0, 60, 40); return c.toDataURL('image/jpeg', 0.8); });
  await ev(async j => { const A = TWApp.APP; await A.IDB.set('img:imgbio1', j); await A.IDB.set('img:imgweg1', j); A.S.imgMeta.imgbio1 = { w: 60, h: 40, t: 1 }; A.S.imgMeta.imgweg1 = { w: 60, h: 40, t: 1 }; A.LS.set(A.K.images, A.S.imgMeta); }, JPG);
  await pg.fill('#noteTitle', 'Bio'); await pg.fill('#editor', 'Fotosynthese braucht Licht.\n![Bild](bild:imgbio1)');
  await ev(() => TWApp.APP.notes.commit());
  await pg.click('#btnNew'); await pg.waitForTimeout(100);
  ok(await ev(() => TWApp.S.draft.text === '' && TWApp.APP.notes.list().list.length === 1), '„Neue Notiz“ leert nichts: die vorige Notiz bleibt in der Liste');
  await pg.fill('#noteTitle', 'Mathe'); await pg.fill('#editor', 'Satz des Pythagoras: a² + b² = c²');
  await pg.click('#btnNotes'); await pg.waitForTimeout(100);
  const rows = await ev(() => [...document.querySelectorAll('#notesList .note-open b')].map(e => e.textContent));
  ok(rows.join('|') === 'Mathe|Bio' && await ev(() => /Geöffnet · geändert heute/.test(document.querySelector('#notesList .note-row.on small').textContent)), 'Liste: Titel, Änderungsdatum, geöffnete Notiz markiert: ' + rows.join('|'));
  ok(await ev(() => document.querySelector('#notesModal').contains(document.activeElement)), 'Notizen-Dialog: Fokus im Dialog');
  await pg.screenshot({ path: path.join(out, 'notizen.png') });
  await pg.click('#notesList [data-open]:not([aria-current])'); await pg.waitForTimeout(150);
  ok(await ev(() => TWApp.S.draft.title === 'Bio' && /Fotosynthese/.test(document.querySelector('#editor').value) && document.querySelector('#notesModal').hidden), 'Andere Notiz öffnen');
  await pg.click('#btnNotes'); await pg.click('#notesList .note-row:not(.on) [data-trash]'); await pg.waitForTimeout(100);
  ok(await ev(() => document.querySelectorAll('#notesList .note-row').length === 1 && /\(1\)/.test(document.querySelector('#trashSum').textContent)), 'In den Papierkorb gelegt');
  await pg.click('#trashSum'); await pg.click('#trashList [data-restore]'); await pg.waitForTimeout(100);
  ok(await ev(() => document.querySelectorAll('#notesList .note-row').length === 2), 'Aus dem Papierkorb wiederhergestellt');
  await pg.click('#notesList .note-row.on [data-trash]'); await pg.waitForTimeout(100);
  ok(await ev(() => TWApp.S.draft.title === 'Mathe'), 'Geöffnete Notiz gelöscht: nächste Notiz wird geöffnet');
  await pg.click('#trashList [data-purge]'); await pg.click('#confirmYes'); await pg.waitForTimeout(200);
  const gc = await ev(async () => ({ n: TWApp.APP.notes.list().list.length, bio: !!TWApp.S.imgMeta.imgbio1, weg: !!TWApp.S.imgMeta.imgweg1, idb: !!(await TWApp.APP.IDB.get('img:imgbio1')) }));
  ok(gc.n === 1 && !gc.bio && !gc.weg && !gc.idb, 'Endgültig gelöscht, nicht mehr benutzte Bilder aufgeräumt: ' + JSON.stringify(gc));
  await pg.click('#notesModal [data-close]');

  // ---------- 6. Komplett-Backup
  await ev(async j => { const A = TWApp.APP; await A.IDB.set('img:imgmat1', j); A.S.imgMeta.imgmat1 = { w: 60, h: 40, t: 2 }; A.LS.set(A.K.images, A.S.imgMeta); }, JPG);
  await pg.fill('#editor', 'Satz des Pythagoras: a² + b² = c²\n![Bild](bild:imgmat1)');
  await pg.click('#btnNew'); await pg.fill('#noteTitle', 'Englisch'); await pg.fill('#editor', 'the customer – der Kunde');
  await ev(() => { const A = TWApp.APP; A.S.own.glyphs = { 'ä': { s: [[0, 0, 0, 10, 30, 0, 20, 0, 0]], w: 40 } }; A.saveOwn(); A.S.settings.paper = 'kariert'; A.saveSettings(); });
  await pg.click('#btnNotes');
  const [dl] = await Promise.all([pg.waitForEvent('download'), pg.click('#backupSave')]);
  const file = path.join(out, 'quillmark-backup-test.json'); await dl.saveAs(file);
  const bk = JSON.parse(require('fs').readFileSync(file, 'utf8'));
  ok(bk.typ === 'backup' && bk.notes.length === 2 && bk.images.imgmat1 && bk.own.glyphs['ä'] && bk.settings.paper === 'kariert', `Backup enthält Notizen, Bild, Handschrift und Blatteinstellungen (${dl.suggestedFilename()})`);
  await pg.click('#notesModal [data-close]');
  await pg.click('#btnSettings'); await pg.click('#delDraft'); await pg.click('#confirmYes'); await pg.waitForTimeout(150); await pg.click('#settingsModal [data-close]');
  await ev(() => { const A = TWApp.APP; A.S.own.glyphs = {}; A.saveOwn(); A.S.settings.paper = 'liniert'; A.saveSettings(); });
  ok(await ev(() => TWApp.APP.notes.list().list.length === 0 && !TWApp.S.imgMeta.imgmat1), 'Vor dem Wiederherstellen ist alles gelöscht');
  await pg.click('#btnNotes'); await pg.setInputFiles('#backupFile', file); await pg.waitForSelector('#confirmModal:not([hidden])'); await pg.click('#confirmYes'); await pg.waitForTimeout(400);
  const rs = await ev(async () => ({ notes: TWApp.APP.notes.list().list.map(e => e.title).sort().join('|'), img: !!(await TWApp.APP.IDB.get('img:imgmat1')), meta: !!TWApp.S.imgMeta.imgmat1, own: !!TWApp.S.own.glyphs['ä'], paper: TWApp.S.settings.paper, open: TWApp.S.draft.title }));
  ok(rs.notes === 'Englisch|Mathe' && rs.img && rs.meta && rs.own && rs.paper === 'kariert' && rs.open, 'Backup wieder geöffnet: ' + JSON.stringify(rs));
  await pg.click('#notesModal [data-close]');
  await pg.reload(); await pg.waitForTimeout(300);
  ok(await ev(() => TWApp.APP.notes.list().list.length === 2 && !TWApp.S.draft.isSample), 'Notizen bleiben nach dem Neuladen erhalten');

  ok(!errs.length, 'Keine Seitenfehler ' + JSON.stringify(errs));
  await b.close(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('E2E FAIL', e); process.exit(1); });
