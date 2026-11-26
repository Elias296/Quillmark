// Erzeugt Beispielfotos (Buchseiten etc.) zum Ausprobieren von Quillmark.
// node dev/tools/beispiele.js beispiele   (schreibt die JPEGs in den Ordner)
const frame = (inner, rot, w = 1100) => `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;width:1500px;height:1150px;display:grid;place-items:center;overflow:hidden;
 background:radial-gradient(ellipse at 40% 30%,#8a6a4c,#4a3524 75%,#2c1f15)}
.page{width:${w}px;padding:56px 70px;box-sizing:border-box;transform:rotate(${rot}deg);
 background:linear-gradient(170deg,#fbf8f0,#f1ebdd);color:#1d1b18;font:21px/1.55 Georgia,'Times New Roman',serif;
 box-shadow:0 30px 60px rgba(0,0,0,.45),0 4px 10px rgba(0,0,0,.3);position:relative}
.page::after{content:"";position:absolute;inset:0;background:linear-gradient(100deg,rgba(255,255,255,.18),transparent 40%,rgba(0,0,0,.05));pointer-events:none}
h1{font:700 34px/1.2 Helvetica,Arial,sans-serif;margin:0 0 6px;color:#14365f}
h2{font:700 24px/1.3 Helvetica,Arial,sans-serif;margin:22px 0 6px;color:#14365f}
.kap{font:600 15px Helvetica,Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#a0461c}
p{margin:0 0 12px;text-align:justify;hyphens:auto}
.box{border-left:5px solid #a0461c;background:rgba(160,70,28,.07);padding:10px 16px;margin:14px 0}
table{border-collapse:collapse;width:100%;font:22px/1.4 Helvetica,Arial,sans-serif}
td,th{border-bottom:1px solid #c9bfa9;padding:9px 10px;text-align:left}th{color:#14365f;font-size:17px;text-transform:uppercase;letter-spacing:.08em}
ol{margin:6px 0 0;padding-left:30px}li{margin:0 0 12px}
.nr{position:absolute;bottom:22px;right:40px;font:15px Helvetica,Arial,sans-serif;color:#7a7263}
</style></head><body><div class="page">${inner}</div></body></html>`;

const pages = {
 '1_buchseite_fotosynthese': frame(`<div class="kap">Kapitel 4 · Stoffwechsel der Pflanzen</div><h1>Die Fotosynthese</h1>
<p>Grüne Pflanzen können ihre Nährstoffe selbst herstellen. Dazu nutzen sie die Energie des Sonnenlichts. Dieser Vorgang heißt Fotosynthese und findet in den Chloroplasten der Blattzellen statt.</p>
<p>Der grüne Farbstoff Chlorophyll nimmt das Licht auf. Aus Kohlenstoffdioxid aus der Luft und Wasser aus dem Boden bildet die Pflanze Traubenzucker (Glucose). Als Nebenprodukt entsteht Sauerstoff, der über die Spaltöffnungen an die Luft abgegeben wird.</p>
<div class="box"><b>Merke:</b> Kohlenstoffdioxid + Wasser → Glucose + Sauerstoff. Die nötige Energie liefert das Licht.</div>
<h2>Bedeutung für uns</h2>
<p>Fast alle Lebewesen sind auf die Fotosynthese angewiesen. Sie liefert den Sauerstoff, den wir atmen, und bildet die Grundlage aller Nahrungsketten.</p><div class="nr">84</div>`, -1.2),
 '2_vokabeln_englisch': frame(`<div class="kap">Unit 3 · At the market</div><h1>Vocabulary</h1>
<table><tr><th>English</th><th>Deutsch</th></tr>
<tr><td>the vegetables</td><td>das Gemüse</td></tr><tr><td>cheap</td><td>billig, günstig</td></tr>
<tr><td>expensive</td><td>teuer</td></tr><tr><td>to bargain</td><td>handeln, feilschen</td></tr>
<tr><td>the change</td><td>das Wechselgeld</td></tr><tr><td>a pound of apples</td><td>ein Pfund Äpfel</td></tr>
<tr><td>the customer</td><td>der Kunde, die Kundin</td></tr><tr><td>fresh</td><td>frisch</td></tr></table><div class="nr">51</div>`, 0.9, 1000),
 '3_mathe_aufgaben': frame(`<div class="kap">Training · Grundrechenarten</div><h1>Übungen</h1>
<ol><li>345 + 678 =</li><li>1200 - 457 =</li><li>24 × 15 =</li><li>144 : 12 =</li>
<li>Lena kauft 3 Hefte zu je 1,50 € und einen Stift für 2,20 €. Wie viel bezahlt sie insgesamt?</li>
<li>Ein Zug fährt 240 km in 3 Stunden. Wie schnell fährt er im Durchschnitt?</li>
<li>Erkläre in einem Satz, warum 0,5 und 1/2 dieselbe Zahl sind.</li></ol><div class="nr">112</div>`, -0.8, 1000),
 '4_geschichte_quelle': frame(`<div class="kap">Kapitel 7 · Das Mittelalter</div><h1>Leben auf der Burg</h1>
<p>Eine Burg war Wohnsitz, Verwaltungszentrum und Festung zugleich. Hohe Mauern, ein tiefer Graben und die Zugbrücke schützten die Bewohner vor Angreifern.</p>
<p>Im Bergfried, dem höchsten Turm, konnten sich die Menschen bei einer Belagerung zurückziehen. Der Burgherr wohnte im Palas, dem Wohngebäude. Zur Burg gehörten außerdem Ställe, Werkstätten, ein Brunnen und oft eine Kapelle.</p>
<h2>Aufgaben</h2><ol><li>Nenne drei Teile einer Burg und ihre Aufgabe.</li><li>Erkläre, warum der Brunnen bei einer Belagerung besonders wichtig war.</li></ol><div class="nr">146</div>`, 1.1),
};
const vulkan = `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0">
<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="900" viewBox="0 0 1400 900" font-family="Helvetica,Arial,sans-serif">
<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9cc7e8"/><stop offset="1" stop-color="#e9f2f8"/></linearGradient>
<linearGradient id="berg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6b5446"/><stop offset="1" stop-color="#3d2f27"/></linearGradient>
<linearGradient id="mag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb02e"/><stop offset="1" stop-color="#d4380d"/></linearGradient></defs>
<rect width="1400" height="900" fill="url(#sky)"/><rect y="640" width="1400" height="260" fill="#8a7a62"/>
<path d="M260 640 L610 240 L790 240 L1140 640 Z" fill="url(#berg)"/>
<path d="M690 840 C 660 700 700 520 690 250 L710 250 C 700 520 740 700 710 840 Z" fill="url(#mag)"/>
<ellipse cx="700" cy="845" rx="230" ry="45" fill="url(#mag)"/>
<path d="M610 240 Q700 170 790 240 Z" fill="#d4380d"/>
<g fill="#6f6f6f" opacity=".85"><circle cx="700" cy="150" r="55"/><circle cx="650" cy="110" r="45"/><circle cx="760" cy="95" r="60"/><circle cx="710" cy="45" r="50"/></g>
<path d="M610 240 C 560 330 540 420 500 470 L520 480 C 570 420 600 330 640 250 Z" fill="#ff7a1a"/>
<g font-size="30" font-weight="700" fill="#1d1b18">
<line x1="830" y1="130" x2="1010" y2="130" stroke="#1d1b18" stroke-width="3"/><text x="1020" y="140">Aschewolke</text>
<line x1="790" y1="240" x2="1010" y2="240" stroke="#1d1b18" stroke-width="3"/><text x="1020" y="250">Krater</text>
<line x1="710" y1="450" x2="1010" y2="450" stroke="#1d1b18" stroke-width="3"/><text x="1020" y="460">Schlot</text>
<line x1="530" y1="470" x2="300" y2="470" stroke="#1d1b18" stroke-width="3"/><text x="110" y="480">Lavastrom</text>
<line x1="930" y1="845" x2="1010" y2="845" stroke="#1d1b18" stroke-width="3"/><text x="1020" y="855">Magmakammer</text></g>
<text x="40" y="60" font-size="40" font-weight="700" fill="#14365f">Aufbau eines Vulkans</text></svg></body></html>`;
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1500, height: 1150 } });
  for (const [n, h] of Object.entries(pages)) { await pg.setContent(h); await pg.screenshot({ path: `${out}/${n}.jpg`, type: 'jpeg', quality: 88 }); }
  await pg.setViewportSize({ width: 1400, height: 900 }); await pg.setContent(vulkan);
  await pg.screenshot({ path: `${out}/5_bild_vulkan.jpg`, type: 'jpeg', quality: 90 });
  await b.close();
})();
