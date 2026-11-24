import { get, put, getAll, del, delPhotosOf } from './db.js?v=118';
import { uid, nowIso, pad } from './util.js?v=118';
import { MAT, POL, checklistFor, POL_KEYS, SEUILS, SUVA, DIAGNOSTIQUEURS } from './ref.js?v=118';

let cur = null;

export async function list() {
  const all = await getAll('mandats');
  return all.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}
export async function load(id) {
  if (cur && cur.id === id) return cur;
  cur = await get('mandats', id);
  if (cur) cur = migrate(cur);
  return cur;
}
export async function save(m = cur) {
  m.updatedAt = nowIso();
  await put('mandats', JSON.parse(JSON.stringify(m)));
}
export async function remove(id) {
  await del('mandats', id); await delPhotosOf(id);
  if (cur && cur.id === id) cur = null;
}
export function setCurrent(m) { cur = m; }
const ANCIEN = 'Nans Gallier', NOUVEAU = DIAGNOSTIQUEURS[0];
function migrate(m) {
  const j = JSON.stringify(m);
  if (j.includes(ANCIEN)) m = JSON.parse(j.split(ANCIEN).join(NOUVEAU));
  m.info.canton ||= 'GE';
  if (m.info.volume200 == null) m.info.volume200 = false;
  m.mesures ||= { zones: [], pcb: [] };
  m.families.forEach(f => { if (f.dec.suva == null) f.dec.suva = ''; });
  return m;
}

export function lastDiag() { try { const d = localStorage.getItem('diagpol-diag'); return d && d !== ANCIEN ? d : DIAGNOSTIQUEURS[0]; } catch (e) { return DIAGNOSTIQUEURS[0]; } }
export function setLastDiag(n) { try { localStorage.setItem('diagpol-diag', n); } catch (e) { /* rien */ } }
export function newMandat() {
  return {
    id: uid(), createdAt: nowIso(), updatedAt: nowIso(), version: 1, locked: false,
    info: { canton: 'GE', volume200: false, adresse: '', rue: '', npa: '', commune: '', egid: '', annee: '', niveaux: '', logements: '', typeDiag: 'Avant travaux', travaux: '', proprietaire: '', diagnostiqueur: lastDiag(), dateVisite: new Date().toISOString().slice(0, 10) },
    pol: { A: true, PCB: true, Pb: true, HAP: true, HBCD: false },
    cp: {}, locaux: [], samples: [], results: {}, unmatched: [], families: [],
    cfst: { override: '' }, rapport: { conclusion: '', risques: '', relu: false, signe: null },
    seq: { l: 0, s: 0, f: 0 }, journal: [], mesures: { zones: [], pcb: [] }
  };
}

export const adresse = m => m.info.adresse || [m.info.rue, [m.info.npa, m.info.commune].filter(Boolean).join(' ')].filter(Boolean).join(', ');
export const expert = m => m.info.diagnostiqueur || 'Expert';

export function log(m, cp, cible, txt) {
  m.journal.push({ at: nowIso(), by: expert(m), cp, cible, txt });
}

/* Points de contrôle : valider, et rouvrir en cascade quand on modifie en amont */
export function validate(m, n, note) {
  m.cp[n] = { at: nowIso(), by: expert(m), note: note || '' };
  log(m, n, 'Mandat', note || 'Point de contrôle validé');
}
export function reopenFrom(m, n, why) {
  let any = false;
  for (let k = n; k <= 6; k++) if (m.cp[k]) { delete m.cp[k]; any = true; }
  if (n <= 6 && m.rapport.signe) { m.rapport.signe = null; any = true; }
  if (any) log(m, n, 'Mandat', 'Rouvert : ' + why);
}

export function addLocal(m, { niveau, nom, type }) {
  m.seq.l += 1;
  const id = 'L-' + pad(m.seq.l);
  const items = checklistFor(type, m.info.annee, m.pol).map(k => newItem(m, k));
  const l = { id, niveau, nom, type, items, cp: null };
  m.locaux.push(l);
  reopenFrom(m, 3, 'local ajouté');
  return l;
}
export function newItem(m, key, nom) {
  const mat = MAT[key] || MAT.autre;
  return { id: uid(), key, nom: nom || mat.n, pols: mat.p.filter(p => m.pol[p]), status: 'todo', variante: '', precision: '', zone: '', detail: '', qty: '', unit: 'm²', etat: '', photos: [], justif: '', presPol: [], fam: '', samples: [], note: '' };
}
export function duplicateLocal(m, src, { niveau, nom }) {
  m.seq.l += 1;
  const id = 'L-' + pad(m.seq.l);
  const items = src.items.filter(i => i.status !== 'abs' || true).map(i => ({ ...newItem(m, i.key, i.nom), variante: i.variante, zone: i.zone, fam: '' }));
  const l = { id, niveau, nom, type: src.type, items, cp: null };
  m.locaux.push(l);
  reopenFrom(m, 3, 'local ajouté');
  return l;
}

export const allItems = m => m.locaux.flatMap(l => l.items.map(it => ({ l, it })));
export const findLocal = (m, lid) => m.locaux.find(l => l.id === lid);
export const itemsOfFam = (m, fid) => allItems(m).filter(x => x.it.fam === fid);

export function newSample(m, item, analyses) {
  m.seq.s += 1;
  const code = 'E-' + pad(m.seq.s);
  m.samples.push({ code, item: item.id, analyses: [...analyses], at: nowIso() });
  item.samples.push(code);
  return code;
}
export function newFamily(m, item) {
  m.seq.f += 1;
  const f = { id: 'F-' + pad(m.seq.f, 2), key: item.key, nom: item.variante || item.nom, fc: !!(MAT[item.key] || {}).fc, dec: { identite: null, urgence: '', suva: '', mesure: '', filiere: 'À définir', remarque: '', ok: null } };
  m.families.push(f);
  return f;
}
export function cleanFamilies(m) {
  const used = new Set(allItems(m).map(x => x.it.fam).filter(Boolean));
  m.families = m.families.filter(f => used.has(f.id));
}

/* Avancement d'un local */
export function localStats(l) {
  const n = l.items.length, done = l.items.filter(i => i.status !== 'todo').length;
  return { n, done };
}
export function localChecks(l) {
  const todo = l.items.filter(i => i.status === 'todo');
  const noJustif = l.items.filter(i => i.status === 'nonsusp' && !i.justif.trim());
  const noSample = l.items.filter(i => i.status === 'prel' && !i.samples.length);
  const fewPhotos = l.items.filter(i => i.status === 'prel' && i.photos.length < 2);
  const noQty = l.items.filter(i => (i.status === 'prel' || i.status === 'pres') && !i.qty);
  const noFam = l.items.filter(i => (i.status === 'prel' || i.status === 'pres') && !i.fam);
  return [
    { ok: !todo.length, txt: todo.length ? `${todo.length} point(s) à vérifier` : 'Tous les points traités', block: true },
    { ok: !noSample.length, txt: noSample.length ? `${noSample.length} prélèvement(s) sans code` : 'Codes de prélèvement', block: true },
    { ok: !noJustif.length, txt: noJustif.length ? `${noJustif.length} non-suspect(s) sans justification` : 'Non-suspects justifiés', block: true },
    { ok: !noFam.length, txt: noFam.length ? `${noFam.length} matériau(x) sans famille` : 'Familles attribuées', block: true },
    { ok: !fewPhotos.length, txt: fewPhotos.length ? `${fewPhotos.length} prélèvement(s) avec moins de 2 photos` : '2 photos par prélèvement', block: false },
    { ok: !noQty.length, txt: noQty.length ? `${noQty.length} quantité(s) manquante(s)` : 'Quantités renseignées', block: false }
  ];
}

/* Résultats d'une famille, polluant par polluant */
export function famInfo(m, f) {
  const xs = itemsOfFam(m, f.id);
  const pols = new Set();
  xs.forEach(x => (x.it.status === 'pres' ? x.it.presPol : x.it.pols).forEach(p => m.pol[p] && pols.add(p)));
  xs.forEach(x => x.it.samples.forEach(c => { const s = m.samples.find(s => s.code === c); s && s.analyses.forEach(p => pols.add(p)); }));
  const st = {};
  for (const p of POL_KEYS.filter(k => pols.has(k))) {
    let det = 0, nd = 0, wait = 0, pres = 0;
    for (const x of xs) {
      for (const c of x.it.samples) {
        const s = m.samples.find(s => s.code === c);
        if (!s || !s.analyses.includes(p)) continue;
        const r = m.results[c]?.[p];
        if (!r || !r.r) wait++; else if (r.r === 'det') det++; else nd++;
      }
      if (x.it.status === 'pres' && x.it.presPol.includes(p)) pres++;
    }
    let vmax = null;
    for (const x of xs) for (const c of x.it.samples) { const r = m.results[c]?.[p]; const v = r && r.v ? parseFloat(String(r.v).replace(/['’\s]/g, '').replace(',', '.')) : NaN; if (!isNaN(v)) vmax = Math.max(vmax ?? v, v); }
    let s;
    if (det) s = 'pos';
    else if (wait) s = 'wait';
    else if (nd) s = f.dec.identite === true ? 'neg' : f.dec.identite === false ? 'pres' : 'conf';
    else if (pres) s = 'pres';
    else s = 'none';
    st[p] = { s, det, nd, wait, pres, vmax, ext: Math.max(0, xs.length - (det + nd)) };
  }
  const qty = {};
  xs.forEach(x => { const q = parseFloat(String(x.it.qty).replace(',', '.')); if (!isNaN(q)) qty[x.it.unit] = (qty[x.it.unit] || 0) + q; });
  const locs = [...new Map(xs.map(x => [x.l.id, x.l])).values()];
  const etats = xs.map(x => x.it.etat).filter(Boolean);
  const pire = etats.includes('Très dégradé') ? 'Très dégradé' : etats.includes('Dégradé') ? 'Dégradé' : etats.length ? 'Bon' : '';
  const polluee = Object.values(st).some(v => v.s === 'pos' || v.s === 'pres');
  return { xs, st, qty, locs, pire, polluee };
}
export const STLAB = { pos: 'Présent', neg: 'Absent (analysé)', conf: 'Non détecté, à confirmer', pres: 'Présumé', wait: 'Attente labo', none: '—' };
export const isAmiante = i => !!(i.st.A && (i.st.A.s === 'pos' || i.st.A.s === 'pres'));
export const suvaPropose = f => ((MAT[f.key] || {}).fa ? 'rouge' : '');

/* Filière proposée selon les teneurs mesurées (l'expert décide) */
export function filiereProposee(f, i) {
  const pcb = i.st.PCB, hap = i.st.HAP;
  if (pcb && pcb.s === 'pos' && pcb.vmax != null && pcb.vmax > SEUILS.pcbDechet) return { f: 'Déchets spéciaux', why: `PCB ${pcb.vmax} mg/kg > ${SEUILS.pcbDechet}` };
  if (hap && hap.s === 'pos' && hap.vmax != null && hap.vmax > SEUILS.hapSpecial) return { f: 'Déchets spéciaux', why: `HAP ${hap.vmax} mg/kg > ${SEUILS.hapSpecial}` };
  if (hap && hap.s === 'pos' && hap.vmax != null && hap.vmax > SEUILS.hapControle) return { f: 'Déchets soumis à contrôle', why: `HAP ${hap.vmax} mg/kg entre ${SEUILS.hapControle} et ${SEUILS.hapSpecial}` };
  if (isAmiante(i) && (MAT[f.key] || {}).fa) return { f: 'Déchets spéciaux', why: 'Amiante faiblement aggloméré' };
  return null;
}

/* Plan d'élimination (OLED art. 16) : quantités par filière */
export function planElimination(m) {
  const by = {};
  for (const f of m.families) {
    const i = famInfo(m, f);
    if (!i.polluee) continue;
    const k = f.dec.filiere || 'À définir';
    by[k] ||= { qty: {}, fams: [] };
    by[k].fams.push(f.id);
    for (const [u, q] of Object.entries(i.qty)) by[k].qty[u] = (by[k].qty[u] || 0) + q;
  }
  return by;
}

export function resultsComplete(m) {
  let missing = 0;
  for (const s of m.samples) for (const p of s.analyses) if (!m.results[s.code]?.[p]?.r) missing++;
  return missing;
}

/* Niveau de protection CFST 6503 (directive genevoise : 1 sans amiante, 2 fibrociment ou bitume de toiture, 3 amiante) */
export function cfstAuto(m) {
  const fams = m.families.map(f => ({ f, i: famInfo(m, f) })).filter(x => x.i.st.A && (x.i.st.A.s === 'pos' || x.i.st.A.s === 'pres'));
  if (!fams.length) return 1;
  return fams.every(x => x.f.fc) ? 2 : 3;
}
export const CFST_TXT = {
  1: 'Chantier sans amiante : aucune mesure de protection particulière liée à l’amiante.',
  2: 'Chantier avec fibrociment amianté ou bitume de toiture amianté : les éléments démontables peuvent être retirés par une entreprise non spécialisée, sans exposer les personnes ni contaminer l’environnement.',
  3: 'Chantier avec amiante : les éléments amiantés devront être retirés par une entreprise de désamiantage spécialisée reconnue avant le début des travaux.'
};
export const cfstLevel = m => Number(m.cfst.override) || cfstAuto(m);

export function conclusionType(m) {
  const fams = m.families.map(f => ({ f, i: famInfo(m, f) }));
  const parPol = {};
  for (const { f, i } of fams) for (const [p, v] of Object.entries(i.st)) if (v.s === 'pos' || v.s === 'pres') (parPol[p] ||= []).push(f.nom.toLowerCase());
  const lignes = Object.entries(parPol).map(([p, ns]) => `${POL[p].n} : ${[...new Set(ns)].join(', ')}`);
  const lvl = cfstLevel(m);
  if (!lignes.length) return 'Aucun matériau contenant les polluants recherchés n’a été identifié dans le périmètre des travaux. Si des matériaux suspects devaient être découverts pendant les travaux, ils devront être signalés et faire l’objet d’un diagnostic complémentaire avant d’être touchés.';
  return `Les matériaux suivants, présents ou présumés pollués, ont été identifiés dans le périmètre des travaux : ${lignes.join(' ; ')}. ` +
    (lvl === 3 ? 'Les matériaux amiantés devront être retirés avant le début des travaux, conformément à la directive CFST 6503 ; les travaux classés rouge devront être confiés à une entreprise de désamiantage reconnue par la Suva. ' : lvl === 2 ? 'Les éléments en fibrociment amianté devront être démontés sans être cassés ni découpés, sans exposer les personnes ni contaminer l’environnement. ' : '') +
    'Les autres matériaux pollués devront être traités selon les mesures et les filières indiquées dans le tableau de synthèse. Si des matériaux suspects non repérés devaient être découverts pendant les travaux, ceux-ci devront être interrompus localement et le diagnostiqueur consulté.';
}

/* Étape atteinte, pour la liste des mandats */
export function stage(m) {
  if (m.rapport.signe) return { n: 7, txt: `Rapport signé · V${m.version}` };
  if (m.cp[5]) return { n: 6, txt: 'Synthèse et rapport' };
  if (m.cp[4]) return { n: 5, txt: 'Stratégie' };
  if (m.cp[3]) return { n: 4, txt: 'Laboratoire' };
  if (m.cp[1]) return { n: 2, txt: 'Repérage' };
  return { n: 1, txt: 'Préparation' };
}

/* Lignes du tableau de synthèse (une par famille et par polluant) */
export function synthRows(m) {
  const rows = [];
  const ord = ['Sous-sol', 'Rez', '1er', '2e', '3e', '4e', '5e', 'Combles', 'Extérieur'];
  for (const f of m.families) {
    const i = famInfo(m, f);
    const niveaux = [...new Set(i.locs.map(l => l.niveau))].sort((a, b) => (ord.indexOf(a) + 99 * (ord.indexOf(a) < 0)) - (ord.indexOf(b) + 99 * (ord.indexOf(b) < 0)));
    const qty = Object.entries(i.qty).map(([u, q]) => `${Math.round(q * 100) / 100} ${u}`.replace('.', ',')).join(' + ') || '—';
    for (const [p, v] of Object.entries(i.st)) {
      if (v.s === 'none') continue;
      const statut = v.s === 'pos' ? (v.ext ? `Analysé (${v.det}), étendu (${v.ext})` : 'Analysé') : STLAB[v.s];
      const pol = v.s === 'pos' || v.s === 'pres';
      rows.push({
        cls: pol ? 'pos' : v.s === 'neg' ? 'neg' : '', fam: f.id, niveaux: niveaux.join(', '), locaux: i.locs.map(l => `${l.nom} (${l.id})`).join(', '),
        element: f.nom, polluant: POL[p].n, statut, qty,
        urgence: pol && p === 'A' ? (f.dec.urgence || '') : '–', suva: pol && p === 'A' && f.dec.suva ? SUVA[f.dec.suva].n : '–',
        mesure: pol ? (f.dec.mesure || '') : 'Aucune', filiere: pol ? (f.dec.filiere || '') : '—'
      });
    }
  }
  return rows;
}
