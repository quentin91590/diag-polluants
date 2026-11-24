/* Génération du rapport Word (.docx) — structure : directive genevoise et cahier des charges ASCA */
import { famInfo, synthRows, adresse, cfstLevel, CFST_TXT, STLAB, allItems, expert, planElimination, isAmiante } from './store.js?v=110';
import { POL, REGLES, MAT, BASES, CANTONS, URGENCE, SUVA, SEUILS } from './ref.js?v=110';
import { fd, fdt } from './util.js?v=110';
import { get } from './db.js?v=110';

function loadDocx() {
  if (window.docx) return Promise.resolve();
  return new Promise((ok, ko) => {
    const s = document.createElement('script'); s.src = 'js/vendor/docx.iife.js';
    s.onload = () => ok(); s.onerror = () => ko(new Error('Bibliothèque Word introuvable'));
    document.head.appendChild(s);
  });
}

export async function buildDocx(m) {
  await loadDocx();
  const D = window.docx;
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, ShadingType, ImageRun, AlignmentType, Footer, PageNumber } = D;
  const V = '4E4184', RED = 'FDECEE', BLUE = 'E8F2FC';
  const run = (text, o = {}) => new TextRun({ text: String(text ?? ''), ...o });
  const P = (text, o = {}) => new Paragraph({ spacing: { after: 120 }, ...o, children: [run(text, o.run || {})] });
  const H1 = t => new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 280, after: 140 }, children: [run(t, { color: V, bold: true, size: 30 })] });
  const H2 = t => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 }, children: [run(t, { color: V, bold: true, size: 24 })] });
  const cell = (t, fill, head) => new TableCell({
    shading: fill ? { type: ShadingType.CLEAR, color: 'auto', fill } : undefined,
    margins: { top: 60, bottom: 60, left: 90, right: 90 },
    children: [new Paragraph({ children: [run(t, { size: 18, bold: !!head, color: head ? 'FFFFFF' : undefined })] })]
  });
  const table = (heads, rows, fills = []) => new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({ tableHeader: true, children: heads.map(h => cell(h, V, true)) }), ...rows.map((r, i) => new TableRow({ children: r.map(c => cell(c, fills[i])) }))]
  });
  const kv = rows => new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: rows.map(([k, v]) => new TableRow({ children: [cell(k, 'F3F1FA'), cell(v)] })) });

  const polRech = Object.entries(m.pol).filter(([, v]) => v).map(([k]) => POL[k].n);
  const lvl = cfstLevel(m);
  const sr = synthRows(m);
  const fams = m.families.map(f => ({ f, i: famInfo(m, f) }));
  const ch = [];

  /* Page de garde */
  ch.push(new Paragraph({ spacing: { after: 80 }, children: [run('Rapport de diagnostic', { color: V, bold: true, size: 22 })] }));
  ch.push(new Paragraph({ spacing: { after: 120 }, children: [run(`Diagnostic des polluants ${m.info.typeDiag.toLowerCase()}`, { bold: true, size: 40 })] }));
  ch.push(P(`${polRech.join(', ')} · selon le cahier des charges ASCA et la directive cantonale`, { run: { color: '6B6979' } }));
  ch.push(kv([
    ['Adresse', adresse(m)], ['Canton', (CANTONS[m.info.canton] || CANTONS.CH).n], ['EGID', m.info.egid || '—'], ['Année de construction', m.info.annee || '—'],
    ['Type de diagnostic', m.info.typeDiag], ['Date de visite', fd(m.info.dateVisite)], ['Mandant', m.info.proprietaire || '—'],
    ['Diagnostiqueur', expert(m)], ['Polluants recherchés', polRech.join(', ')], ['Version', String(m.version)],
    ['Niveau de protection CFST 6503', `Catégorie ${lvl}`]
  ]));

  ch.push(H1('Bases réglementaires'));
  BASES.forEach(([k, v]) => ch.push(new Paragraph({ bullet: { level: 0 }, children: [run(k + ' : ', { bold: true }), run(v)] })));
  ch.push(P(`Exigence cantonale : ${(CANTONS[m.info.canton] || CANTONS.CH).ref}.`, { run: { size: 18, color: '6B6979' } }));

  ch.push(H1('1. Nature des travaux annoncés'));
  ch.push(P(m.info.travaux || '—'));

  ch.push(H1('2. Périmètre du diagnostic'));
  ch.push(P(`${m.locaux.length} locaux examinés :`));
  ch.push(table(['Local', 'Niveau', 'Nom', 'Type'], m.locaux.map(l => [l.id, l.niveau, l.nom, l.type])));

  ch.push(H1('3. Méthode et stratégie d’échantillonnage'));
  ch.push(P('Repérage visuel local par local, sondages et prélèvements selon la liste des matériaux suspects de chaque type de local. Les matériaux identiques sont regroupés en familles. Localisation : niveau, local, paroi (A = porte d’entrée, puis B, C, D dans le sens horaire), sol ou plafond.'));
  REGLES.forEach(r => ch.push(new Paragraph({ bullet: { level: 0 }, children: [run(r)] })));

  ch.push(H1('4. Matériaux identifiés et localisation'));
  if (sr.length) ch.push(table(['Niveau', 'Élément', 'Polluant', 'Statut', 'Quantité', 'Urgence', 'Code Suva'], sr.map(r => [r.niveaux, `${r.element} (${r.fam})`, r.polluant, r.statut, r.qty, r.urgence, r.suva]), sr.map(r => r.cls === 'pos' ? RED : r.cls === 'neg' ? BLUE : undefined)));
  else ch.push(P('Aucun matériau suspect retenu.'));
  ch.push(P('Rouge : polluant présent ou présumé. Bleu : absent après analyse.', { run: { size: 18, color: '6B6979' } }));

  ch.push(H1('5. Zones à assainir avant travaux'));
  const zones = fams.filter(x => x.i.polluee);
  if (zones.length) zones.forEach(({ f, i }) => ch.push(new Paragraph({ bullet: { level: 0 }, children: [run(`${f.nom} (${f.id}) : `, { bold: true }), run([`${i.locs.map(l => `${l.niveau} · ${l.nom}`).join(', ')}`, f.dec.mesure, isAmiante(i) && f.dec.urgence ? `urgence ${f.dec.urgence} (${URGENCE[f.dec.urgence]})` : '', isAmiante(i) && f.dec.suva ? `code Suva ${SUVA[f.dec.suva].n.toLowerCase()} (${SUVA[f.dec.suva].t})` : '', f.dec.filiere && f.dec.filiere !== 'À définir' ? 'filière : ' + f.dec.filiere : ''].filter(Boolean).join(' · '))] })));
  else ch.push(P('Aucune.'));

  ch.push(H1('6. Niveau de protection CFST 6503'));
  ch.push(P(`Catégorie ${lvl}. ${CFST_TXT[lvl]}`));

  ch.push(H1('7. Situations à risque nécessitant des mesures immédiates'));
  const urg = fams.filter(x => x.i.polluee && x.f.dec.urgence === 'I');
  if (urg.length) urg.forEach(({ f, i }) => ch.push(new Paragraph({ bullet: { level: 0 }, children: [run(`${f.nom} (${f.id}) · ${i.locs.map(l => l.nom).join(', ')} : mesures immédiates obligatoires.`)] })));
  if (m.rapport.risques) ch.push(P(m.rapport.risques));
  if (!urg.length && !m.rapport.risques) ch.push(P('Aucune.'));

  ch.push(H1('8. Plan d’élimination des déchets (OLED art. 16)'));
  if (m.info.volume200) ch.push(P('Plus de 200 m³ de déchets de chantier : plan d’élimination obligatoire.', { run: { bold: true } }));
  const pe = Object.entries(planElimination(m));
  ch.push(pe.length ? table(['Filière', 'Familles', 'Quantités'], pe.map(([k, v]) => [k, v.fams.join(', '), Object.entries(v.qty).map(([u, q]) => `${Math.round(q * 100) / 100} ${u}`.replace('.', ',')).join(' + ') || '—'])) : P('Aucun déchet pollué.'));

  ch.push(H1('9. Conclusion'));
  String(m.rapport.conclusion || '').split(/\n+/).filter(Boolean).forEach(t => ch.push(P(t)));
  ch.push(P(m.rapport.signe ? `Établi et signé par ${m.rapport.signe.by}, le ${fdt(m.rapport.signe.at)}.` : `Établi par ${expert(m)}. Version non signée.`, { run: { bold: true } }));

  /* Annexes */
  ch.push(H1('Annexe A · Tableau des matériaux'));
  const its = allItems(m);
  const STA = { prel: 'Prélevé', pres: 'Présumé', nonsusp: 'Non suspect', abs: 'Absent', todo: 'À vérifier' };
  const fillOf = x => {
    if (!x.it.fam) return undefined;
    const f = m.families.find(f => f.id === x.it.fam); if (!f) return undefined;
    const i = famInfo(m, f); return i.polluee ? RED : Object.values(i.st).some(v => v.s === 'neg') ? BLUE : undefined;
  };
  ch.push(table(['Local', 'Matériau', 'Localisation', 'Polluants', 'Décision', 'Quantité'],
    its.map(x => [`${x.l.niveau} · ${x.l.nom}`, x.it.variante || x.it.nom, [x.it.zone, x.it.detail].filter(Boolean).join(', ') || '—', (x.it.status === 'pres' ? x.it.presPol : x.it.pols).map(p => POL[p].n).join(', '), `${STA[x.it.status]}${x.it.samples.length ? ' ' + x.it.samples.join(', ') : ''}${x.it.status === 'nonsusp' && x.it.justif ? ' : ' + x.it.justif : ''}`, x.it.qty ? `${x.it.qty} ${x.it.unit}` : '—']),
    its.map(fillOf)));

  ch.push(H1('Annexe B · Échantillons et résultats du laboratoire'));
  const rowsB = [];
  for (const s of m.samples) {
    const x = its.find(x => x.it.id === s.item);
    for (const p of s.analyses) { const r = m.results[s.code]?.[p]; rowsB.push([s.code, x ? `${x.l.id} · ${x.it.variante || x.it.nom}` : '—', POL[p].n, r?.r === 'det' ? 'Détecté' : r?.r === 'nd' ? 'Non détecté' : '—', r?.v || '']); }
  }
  ch.push(rowsB.length ? table(['Code', 'Matériau', 'Analyse', 'Résultat', 'Valeur'], rowsB, rowsB.map(r => r[3] === 'Détecté' ? RED : r[3] === 'Non détecté' ? BLUE : undefined)) : P('Aucun échantillon.'));

  ch.push(H1('Annexe C · Photos'));
  let nPh = 0;
  for (const x of its.filter(x => x.it.photos.length && x.it.status !== 'abs')) {
    ch.push(H2(`${x.l.id} · ${x.l.nom} · ${x.it.variante || x.it.nom}${x.it.samples.length ? ' · ' + x.it.samples.join(', ') : ''}`));
    const runs = [];
    for (const ph of x.it.photos.slice(0, 2)) {
      const rec = await get('photos', ph.id); if (!rec) continue;
      const buf = await rec.blob.arrayBuffer();
      let w = 240, h = 180;
      try { const b = await createImageBitmap(rec.blob); h = Math.round(240 * b.height / b.width); } catch (e) { /* format par défaut */ }
      runs.push(new ImageRun({ type: 'jpg', data: buf, transformation: { width: w, height: h } }), run('  '));
      nPh++;
    }
    ch.push(new Paragraph({ children: runs }));
  }
  if (!nPh) ch.push(P('Aucune photo.'));

  const Z = (m.mesures && m.mesures.zones) || [], PA = (m.mesures && m.mesures.pcb) || [];
  if (Z.length || PA.length) {
    ch.push(H1('Annexe D · Mesures'));
    if (Z.length) { ch.push(H2(`Libération des zones (FACH 2955, seuil ${SEUILS.liberation} FAR/m³)`)); ch.push(table(['Zone', 'Confinement', 'Contrôle visuel', 'VDI 3492 (FAR/m³)', 'Libération'], Z.map(z => [z.nom || '—', z.conf ? 'Oui' : 'Non', z.visuel === 'ok' ? 'Conforme' : z.visuel === 'nc' ? 'Non conforme' : '—', z.conf ? String(z.far ?? '—') : '—', z.ok ? `${z.ok.by}, ${fdt(z.ok.at)}` : 'Non libérée']))); }
    if (PA.length) { ch.push(H2(`PCB dans l’air (OFSP : ${SEUILS.pcbAirJour} µg/m³ journée, ${SEUILS.pcbAirLong} µg/m³ longue durée)`)); ch.push(table(['Local', 'Occupation', 'Moyenne (µg/m³)', 'Évaluation'], PA.map(q => { const v = parseFloat(String(q.val).replace(',', '.')); const lim = q.occ === 'long' ? SEUILS.pcbAirLong : SEUILS.pcbAirJour; return [q.loc || '—', q.occ === 'long' ? 'Longue durée' : 'Journée', String(q.val ?? '—'), isNaN(v) ? '—' : v > lim ? 'Dépassement' : 'Sous la valeur indicative']; }))); }
  }

  ch.push(H1('Annexe E · Journal des validations'));
  ch.push(table(['Date', 'Point', 'Par', 'Objet', 'Détail'], m.journal.map(j => [fdt(j.at), j.cp ? `PC ${j.cp}` : '', j.by, j.cible, j.txt])));

  const doc = new Document({
    creator: expert(m), title: `Diagnostic des polluants · ${adresse(m)}`,
    styles: { default: { document: { run: { font: 'Arial', size: 21 } } } },
    sections: [{
      properties: { page: { margin: { top: 1000, bottom: 1000, left: 1100, right: 1100 } } },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ size: 16, color: '6B6979', children: [`${adresse(m)} · V${m.version} · page `, PageNumber.CURRENT, ' / ', PageNumber.TOTAL_PAGES] })] })] }) },
      children: ch
    }]
  });
  return Packer.toBlob(doc);
}
