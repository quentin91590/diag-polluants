import { $, $$, esc, fd, fdt, nf, parseNum, download, toast, buzz, sheet, confirmSheet, ripple, shrink, blobToB64, b64ToBlob, qrSvg, uid, nowIso } from './util.js';
import { put, get, del, photosOf } from './db.js';
import { POL, POL_KEYS, MAT, TYPES, NIVEAUX, ZONES, ETATS, UNITES, DECISIONS, REGLES, polluantsProposes, CANTONS, URGENCE, SUVA, SEUILS, BASES } from './ref.js';
import * as S from './store.js';
import { arSupported, measure } from './ar.js';

const view = $('#view');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let AR = false; arSupported().then(v => { AR = v; });
let lastDepth = 0, lastHash = '';
const urls = new Map();

/* ---------- Navigation ---------- */
const routes = [
  [/^#\/?$/, home], [/^#\/m\/([^/]+)$/, dash], [/^#\/m\/([^/]+)\/prep$/, prep], [/^#\/m\/([^/]+)\/locaux$/, locaux],
  [/^#\/m\/([^/]+)\/l\/([^/]+)$/, local], [/^#\/m\/([^/]+)\/l\/([^/]+)\/i\/([^/]+)$/, item], [/^#\/m\/([^/]+)\/fin$/, fin],
  [/^#\/m\/([^/]+)\/labo$/, labo], [/^#\/m\/([^/]+)\/etiquettes$/, etiquettes], [/^#\/m\/([^/]+)\/strat$/, strat],
  [/^#\/m\/([^/]+)\/synth$/, synth], [/^#\/m\/([^/]+)\/rapport$/, rapport], [/^#\/m\/([^/]+)\/mesures$/, mesures]
];
const depth = h => h.split('/').filter(Boolean).length;
function parent(h) {
  const p = h.split('/');
  if (p.includes('i')) return p.slice(0, p.indexOf('i')).join('/');
  if (p.includes('l')) return p.slice(0, 3).join('/') + '/locaux';
  if (p.length > 3) return p.slice(0, 3).join('/');
  return '#/';
}
const go = h => { location.hash = h; };
async function route(still) {
  const h = location.hash || '#/';
  const d = depth(h);
  document.documentElement.dataset.dir = d >= lastDepth ? 'fwd' : 'back';
  lastDepth = d;
  const same = h === lastHash; lastHash = h;
  const run = async () => {
    view.classList.toggle('still', !!still || same);
    $('#back').hidden = h === '#/' || h === '#';
    for (const [re, fn] of routes) { const mm = h.match(re); if (mm) { try { await fn(...mm.slice(1)); } catch (e) { console.error(e); view.innerHTML = `<div class="card"><h2>Oups</h2><p class="muted">${esc(e.message)}</p><a class="btn" href="#/">Accueil</a></div>`; } return; } }
    go('#/');
  };
  if (!still && !same && document.startViewTransition && !reduced) { const vt = document.startViewTransition(run); vt.ready.catch(() => {}); vt.finished.catch(() => {}); await vt.updateCallbackDone.catch(() => {}); }
  else await run();
  if (!still && !same) window.scrollTo(0, 0);
}
const refresh = () => route(true);
addEventListener('hashchange', () => route());
$('#back').onclick = () => go(parent(location.hash));
document.addEventListener('pointerdown', ripple);
const net = () => { $('#net').hidden = navigator.onLine; };
addEventListener('online', net); addEventListener('offline', net); net();
const APP_V = '1.3';
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  const had = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(r => r.update()).catch(() => {});
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (had && !reloaded) { reloaded = true; location.reload(); } });
}

function head(title, sub) { $('#title').textContent = title; $('#subtitle').textContent = sub || ''; document.title = title === 'Diagnostic polluants' ? title : title + ' · Diagnostic polluants'; }
function stagger() { $$('#view > *').forEach((e, i) => e.style.setProperty('--i', i)); }
function bind(acts = {}, fields) {
  view.onclick = e => { const b = e.target.closest('[data-act]'); if (b && !b.disabled && acts[b.dataset.act]) { e.preventDefault(); acts[b.dataset.act](b, e); } };
  const h = e => { const f = e.target.closest('[data-f]'); if (!f || !fields) return; if (e.type === 'input' && (f.tagName === 'SELECT' || f.type === 'checkbox')) return; fields(f.dataset.f, f, e.type); };
  view.oninput = h; view.onchange = h;
}
function readonly(m) {
  if (!m.rapport.signe) return;
  view.insertAdjacentHTML('afterbegin', `<div class="note">Version ${m.version} signée : lecture seule.</div>`);
  $$('input,select,textarea,button:not([data-keep])', view).forEach(e => { e.disabled = true; });
}
const chips = (name, opts, val, cls = () => '') => `<div class="chips" role="group">${opts.map(o => `<button type="button" class="chip ${cls(o)} ${o === val ? 'on' : ''}" data-act="${name}" data-v="${esc(o)}" aria-pressed="${o === val}">${esc(o)}</button>`).join('')}</div>`;
const cpBox = (n, title, checks, done, btn) => `<section class="cp"><h3>Point de contrôle ${n} · ${esc(title)}</h3><ul>${checks.map(c => `<li class="${c.ok ? 'ok' : c.block === false ? 'warn' : 'ko'}"><i></i><span>${esc(c.txt)}</span></li>`).join('')}</ul>${done ? stampHtml(done) : btn}</section>`;
const stampHtml = d => `<div class="stamp"><svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true"><circle cx="17" cy="17" r="15" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="M10 17.5l4.5 4.5L24 12.5" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Validé par ${esc(d.by)} · ${fdt(d.at)}</span></div>`;
async function mand(id) { const m = await S.load(id); if (!m) { go('#/'); throw new Error('Mandat introuvable'); } return m; }
const save = m => S.save(m);
async function photoUrl(id) {
  if (urls.has(id)) return urls.get(id);
  const r = await get('photos', id); if (!r) return '';
  const u = URL.createObjectURL(r.blob); urls.set(id, u); return u;
}

/* ---------- Accueil ---------- */
async function home() {
  head('Diagnostic polluants', `Prototype pour Novacity · v${APP_V}`);
  const ms = await S.list();
  view.innerHTML = `
  <div class="hero"><p class="kick">Mandats</p><h1>Diagnostics</h1></div>
  ${ms.length ? `<div class="list">${ms.map(m => { const st = S.stage(m); return `<a class="li" href="#/m/${m.id}"><div class="tx"><b>${esc(S.adresse(m) || 'Nouveau mandat')}</b><span>${esc(m.info.typeDiag)} · ${esc(st.txt)}</span></div><span class="pill ${st.n === 7 ? 'ok' : ''}">${st.n}/7</span><svg class="chev" width="18" height="18" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></a>`; }).join('')}</div>`
    : `<div class="card"><h2>Aucun mandat</h2><p class="muted">Créez votre premier diagnostic.</p></div>`}
  <p class="note">Données enregistrées sur cet appareil. Exportez vos mandats pour les sauvegarder.</p>
  <div class="actions"><button class="btn" data-act="imp" type="button">Importer</button><button class="btn pri" data-act="new" type="button">Nouveau mandat</button></div>
  <input type="file" id="impf" accept=".json,application/json" hidden>`;
  stagger();
  bind({
    new: async () => { const m = S.newMandat(); S.setCurrent(m); await save(m); go(`#/m/${m.id}/prep`); },
    imp: () => $('#impf').click()
  });
  $('#impf').onchange = async e => { const f = e.target.files[0]; if (f) await importJson(f); };
}

/* ---------- Tableau de bord du mandat ---------- */
async function dash(id) {
  const m = await mand(id);
  head(S.adresse(m) || 'Nouveau mandat', `${m.info.typeDiag} · V${m.version}`);
  const nl = m.locaux.length, nv = m.locaux.filter(l => l.cp).length;
  const st = [
    { t: 'Préparation', s: m.cp[1] ? 'Validée' : 'À faire', h: 'prep', done: !!m.cp[1], lock: 0 },
    { t: 'Repérage', s: `${nv}/${nl} locaux validés`, h: 'locaux', done: nl > 0 && nv === nl, lock: m.cp[1] ? 0 : 1, p: nl ? nv / nl : 0 },
    { t: 'Fin de visite', s: m.cp[3] ? 'Validée' : 'Contrôle avant labo', h: 'fin', done: !!m.cp[3], lock: m.cp[1] ? 0 : 1 },
    { t: 'Laboratoire', s: `${m.samples.length} échantillon(s)${m.cp[4] ? ' · validé' : ''}`, h: 'labo', done: !!m.cp[4], lock: m.cp[3] ? 0 : 3 },
    { t: 'Stratégie', s: `${m.families.length} famille(s)${m.cp[5] ? ' · validée' : ''}`, h: 'strat', done: !!m.cp[5], lock: m.cp[4] ? 0 : 4 },
    { t: 'Synthèse', s: 'Tableau rouge / bleu', h: 'synth', done: !!m.cp[5], lock: m.cp[5] ? 0 : 5 },
    { t: 'Rapport', s: m.rapport.signe ? `Signé · V${m.version}` : 'Word et signature', h: 'rapport', done: !!m.rapport.signe, lock: m.cp[5] ? 0 : 5 }
  ];
  view.innerHTML = `
  <div class="steps">${st.map((s, i) => `<a class="li step ${s.done ? 'done' : ''} ${s.lock ? 'lock' : ''}" href="${s.lock ? '#' : `#/m/${id}/${s.h}`}" ${s.lock ? `data-act="lock" data-n="${s.lock}"` : ''}><span class="dot">${s.done ? '✓' : i + 1}</span><div class="tx"><b>${s.t}</b><span>${esc(s.s)}</span>${s.p != null && nl ? `<div class="prog"><i style="width:${Math.round(s.p * 100)}%"></i></div>` : ''}</div><svg class="chev" width="18" height="18" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></a>`).join('')}</div>
  <a class="li" href="#/m/${id}/mesures"><div class="tx"><b>Mesures</b><span>Libération des zones · PCB dans l’air</span></div><span class="pill">${m.mesures.zones.length + m.mesures.pcb.length}</span></a>
  <details class="card"><summary><b>Cadre réglementaire</b></summary><div class="list">${BASES.map(([k, v]) => `<div class="small"><b>${esc(k)}</b> · ${esc(v)}</div>`).join('')}</div></details>
  <div class="row"><a class="btn sm soft" href="#/m/${id}/etiquettes">Étiquettes</a><button class="btn sm soft" data-act="exp" data-keep type="button">Exporter</button><button class="btn sm danger" data-act="delm" data-keep type="button">Supprimer</button></div>`;
  stagger();
  bind({
    lock: b => toast(`Validez d’abord le point de contrôle ${b.dataset.n}.`),
    exp: () => exportJson(m),
    delm: async () => { if (await confirmSheet('Supprimer le mandat ?', 'Toutes ses données et photos seront effacées de cet appareil.', 'Supprimer', true)) { await S.remove(m.id); toast('Mandat supprimé'); go('#/'); } }
  });
}

/* ---------- Préparation (PC 1) ---------- */
async function prep(id) {
  const m = await mand(id); const I = m.info;
  head('Préparation', S.adresse(m) || 'Nouveau mandat');
  const prop = polluantsProposes(I.annee, I.canton);
  const C = CANTONS[I.canton] || CANTONS.CH;
  const oblig = I.annee ? Number(I.annee) < C.seuil : null;
  const checks = [
    { ok: !!(I.adresse || (I.rue && I.commune)), txt: 'Adresse' }, { ok: !!I.annee, txt: 'Année de construction' },
    { ok: !!I.travaux.trim(), txt: 'Travaux annoncés' }, { ok: POL_KEYS.some(k => m.pol[k]), txt: 'Polluants recherchés' },
    { ok: !!I.diagnostiqueur.trim(), txt: 'Diagnostiqueur' }
  ];
  const f = (k, lab, type = 'text', extra = '') => `<label class="f"><span>${lab}</span><input class="in" data-f="${k}" type="${type}" value="${esc(I[k])}" ${extra}></label>`;
  view.innerHTML = `
  <section class="card"><h2>Bâtiment</h2>
    <div class="f"><span>Canton</span>${chips('canton', Object.keys(CANTONS).map(k => CANTONS[k].n), C.n)}</div>
    <label class="f"><span>Adresse</span><input class="in" data-f="adresse" id="adr" type="search" autocomplete="off" placeholder="Tapez l’adresse (ex. Rue de Veyrier 13 Carouge)" value="${esc(I.adresse || S.adresse(m))}"></label>
    <div class="sug" id="sug" hidden></div>
    <div class="grid2">${f('egid', 'EGID', 'text', 'inputmode="numeric"')}${f('annee', 'Année de construction', 'text', 'inputmode="numeric"')}</div>
    <div class="grid2">${f('niveaux', 'Niveaux')}${f('logements', 'Logements', 'text', 'inputmode="numeric"')}</div>
    ${oblig === null ? '' : `<p class="${oblig ? 'warnbox' : 'note'}">${oblig ? `Diagnostic exigé : construit avant ${C.seuil} (${esc(C.ref)}).` : `Construit en ${esc(I.annee)} ou après ${C.seuil} : diagnostic non exigé par le canton.`}</p>`}
  </section>
  <section class="card"><h2>Mandat</h2>
    <div class="f"><span>Type de diagnostic</span>${chips('type', ['Avant travaux', 'Utilisation normale', 'Après travaux'], I.typeDiag)}</div>
    <label class="f"><span>Travaux annoncés</span><textarea class="in" data-f="travaux" rows="3">${esc(I.travaux)}</textarea></label>
    ${f('proprietaire', 'Mandant')}
    <div class="grid2">${f('diagnostiqueur', 'Diagnostiqueur')}${f('dateVisite', 'Date de visite', 'date')}</div>
    <label class="check"><input type="checkbox" data-f="volume200" ${I.volume200 ? 'checked' : ''}><span>Plus de 200 m³ de déchets de chantier<br><span class="small muted">Plan d’élimination obligatoire (OLED art. 16)</span></span></label>
  </section>
  <section class="card"><div class="row between"><h2>Polluants</h2><button class="btn sm ghost" data-act="prop" type="button">Proposer</button></div>
    ${POL_KEYS.map(k => `<label class="check"><input type="checkbox" data-f="pol:${k}" ${m.pol[k] ? 'checked' : ''}><span><b>${POL[k].n}</b><br><span class="small muted">${esc(prop[k].why)}</span></span></label>`).join('')}
  </section>
  ${cpBox(1, 'Préparation', checks, m.cp[1], `<button class="btn pri wide" data-act="ok" type="button" ${checks.every(c => c.ok) ? '' : 'disabled'}>Valider</button>`)}
  ${m.cp[1] ? `<div class="actions"><a class="btn pri" href="#/m/${id}/locaux">Repérage</a></div>` : ''}`;
  stagger(); readonly(m);
  let t;
  bind({
    type: async b => { I.typeDiag = b.dataset.v; await save(m); refresh(); },
    canton: async b => { I.canton = Object.keys(CANTONS).find(k => CANTONS[k].n === b.dataset.v) || 'CH'; S.reopenFrom(m, 1, 'canton modifié'); await save(m); refresh(); },
    prop: async () => { const p = polluantsProposes(I.annee, I.canton); POL_KEYS.forEach(k => { m.pol[k] = p[k].on; }); S.reopenFrom(m, 1, 'polluants modifiés'); await save(m); refresh(); toast('Polluants proposés'); },
    pick: async b => {
      $('#sug').hidden = true;
      $('#adr').value = b.dataset.label;
      I.adresse = b.dataset.label;
      try { await regbl(m, b.dataset.fid); toast('RegBL : bâtiment trouvé'); }
      catch (e) { toast(e.message || 'RegBL indisponible'); }
      await save(m); refresh();
    },
    ok: async () => { S.validate(m, 1, 'Préparation validée'); buzz(25); await save(m); refresh(); toast('Préparation validée'); }
  }, async (k, el, ev) => {
    if (k.startsWith('pol:')) { m.pol[k.slice(4)] = el.checked; S.reopenFrom(m, 1, 'polluants modifiés'); await save(m); refresh(); return; }
    if (k === 'volume200') { I.volume200 = el.checked; await save(m); refresh(); return; }
    if (k === 'adresse') { I.adresse = el.value; if (ev === 'input') suggest(el.value); else await save(m); return; }
    I[k] = el.value;
    if (k === 'annee' && ev === 'change') { S.reopenFrom(m, 1, 'année modifiée'); }
    clearTimeout(t); t = setTimeout(async () => { await save(m); if (ev === 'change') refresh(); }, 250);
  });
}

let sugT, sugN = 0;
function suggest(q) {
  clearTimeout(sugT);
  const box = $('#sug');
  if (!box) return;
  if (q.trim().length < 3) { box.hidden = true; return; }
  sugT = setTimeout(async () => {
    const n = ++sugN;
    try {
      const r = await fetch(`https://api3.geo.admin.ch/rest/services/ech/SearchServer?searchText=${encodeURIComponent(q)}&type=locations&origins=address&limit=6`).then(r => r.json());
      if (n !== sugN || !$('#sug')) return;
      const res = (r.results || []).filter(x => x.attrs && x.attrs.featureId);
      box.innerHTML = res.length ? res.map(x => { const label = x.attrs.label.replace(/<[^>]*>/g, ''); return `<button type="button" data-act="pick" data-fid="${esc(x.attrs.featureId)}" data-label="${esc(label)}">${esc(label)}</button>`; }).join('') : '<p class="small muted">Aucune adresse trouvée</p>';
      box.hidden = false;
    } catch (e) { box.innerHTML = '<p class="small muted">Recherche indisponible (hors ligne ?)</p>'; box.hidden = false; }
  }, 280);
}
async function regbl(m, fid) {
  const g = await fetch(`https://api3.geo.admin.ch/rest/services/ech/MapServer/ch.bfs.gebaeude_wohnungs_register/${encodeURIComponent(fid)}?returnGeometry=false&lang=fr`).then(r => r.json());
  const at = (g.feature && (g.feature.attributes || g.feature.properties)) || {};
  m.info.egid = String(at.egid || String(fid).split('_')[0]);
  if (at.strname) m.info.rue = [at.strname, at.deinr].filter(Boolean).join(' ');
  if (at.dplz4) m.info.npa = String(at.dplz4);
  if (at.ggdename) m.info.commune = at.ggdename;
  if (at.gdekt) m.info.canton = CANTONS[at.gdekt] ? at.gdekt : 'CH';
  if (at.gbauj && String(at.gbauj) !== m.info.annee) { m.info.annee = String(at.gbauj); S.reopenFrom(m, 1, 'année modifiée'); }
  if (at.gastw) m.info.niveaux = String(at.gastw);
  if (at.ganzwhg) m.info.logements = String(at.ganzwhg);
  if (!at.gbauj) throw new Error('Année de construction absente du RegBL : à saisir');
}

/* ---------- Locaux ---------- */
async function locaux(id) {
  const m = await mand(id);
  if (!m.cp[1]) { toast('Validez la préparation'); go(`#/m/${id}/prep`); return; }
  head('Repérage', S.adresse(m));
  const by = {};
  m.locaux.forEach(l => (by[l.niveau] ||= []).push(l));
  const order = [...NIVEAUX, ...Object.keys(by).filter(n => !NIVEAUX.includes(n))].filter(n => by[n]);
  view.innerHTML = `
  ${m.locaux.length ? order.map(n => `<p class="grp">${esc(n)}</p><div class="list">${by[n].map(l => { const s = S.localStats(l); return `<a class="li" href="#/m/${id}/l/${l.id}"><div class="tx"><b>${esc(l.nom)}</b><span>${l.id} · ${esc(l.type)} · ${s.done}/${s.n}</span></div><span class="pill ${l.cp ? 'ok' : ''}">${l.cp ? 'Validé' : 'En cours'}</span></a>`; }).join('')}</div>`).join('')
    : `<div class="card"><h2>Aucun local</h2><p class="muted">Ajoutez le premier local visité.</p></div>`}
  ${m.locaux.length ? `<a class="li" href="#/m/${id}/fin"><div class="tx"><b>Fin de visite</b><span>Point de contrôle 3</span></div><span class="pill ${m.cp[3] ? 'ok' : ''}">${m.cp[3] ? 'Validée' : 'À faire'}</span></a>` : ''}
  <div class="actions"><button class="btn pri" data-act="add" type="button">Ajouter un local</button></div>`;
  stagger(); readonly(m);
  bind({ add: () => addLocalSheet(m) });
}

async function addLocalSheet(m) {
  let niv = m.locaux.length ? m.locaux[m.locaux.length - 1].niveau : 'Rez', type = 'Salle de bain', src = '';
  const draw = sh => {
    sh.innerHTML = `<h2>Nouveau local</h2>
      <div class="f"><span>Niveau</span>${chips('niv', NIVEAUX, niv)}</div>
      <label class="f"><span>Nom</span><input class="in" id="lnom" placeholder="Ex. Log. 2.1 salle de bain" value="${esc(sh.dataset.nom || '')}"></label>
      <div class="f"><span>Type</span>${chips('typ', Object.keys(TYPES), type)}</div>
      ${m.locaux.length ? `<label class="f"><span>Copier la liste d’un local identique</span><select class="in" id="lsrc"><option value="">Non</option>${m.locaux.map(l => `<option value="${l.id}" ${l.id === src ? 'selected' : ''}>${l.id} · ${esc(l.nom)}</option>`).join('')}</select></label>` : ''}
      <div class="row"><button class="btn grow" data-close="0" type="button">Annuler</button><button class="btn pri grow" id="lok" type="button">Créer</button></div>`;
  };
  await sheet('', (sh, close) => {
    draw(sh);
    sh.addEventListener('click', e => {
      const b = e.target.closest('[data-act]');
      sh.dataset.nom = $('#lnom', sh).value; src = $('#lsrc', sh)?.value || '';
      if (b?.dataset.act === 'niv') { niv = b.dataset.v; draw(sh); }
      if (b?.dataset.act === 'typ') { type = b.dataset.v; draw(sh); }
      if (e.target.id === 'lok') {
        const nom = $('#lnom', sh).value.trim() || type;
        const s = src && S.findLocal(m, src);
        const l = s ? S.duplicateLocal(m, s, { niveau: niv, nom }) : S.addLocal(m, { niveau: niv, nom, type });
        save(m).then(() => { close('1'); buzz(); go(`#/m/${m.id}/l/${l.id}`); });
      }
    });
  });
}

/* ---------- Local (PC 2) ---------- */
const STA = { todo: ['À vérifier', ''], prel: ['Prélevé', 'prel'], pres: ['Présumé', 'pres'], nonsusp: ['Non suspect', 'nonsusp'], abs: ['Absent', 'abs'] };
function touchLocal(m, l, why) {
  if (l.cp) { l.cp = null; S.log(m, 2, l.id, 'Rouvert : ' + why); }
  S.reopenFrom(m, 3, why);
}
async function local(id, lid) {
  const m = await mand(id); const l = S.findLocal(m, lid);
  if (!l) { go(`#/m/${id}/locaux`); return; }
  head(l.nom, `${l.niveau} · ${l.id} · ${l.type}`);
  const checks = S.localChecks(l);
  const ok = checks.filter(c => c.block).every(c => c.ok);
  const next = l.items.find(i => i.status === 'todo');
  view.innerHTML = `
  <p class="note">Paroi A = porte d’entrée, puis B, C, D dans le sens horaire.</p>
  <div class="list">${l.items.map(it => { const [t, c] = STA[it.status]; const pl = it.status === 'pres' ? it.presPol : it.pols; return `<a class="li" href="#/m/${id}/l/${lid}/i/${it.id}"><div class="tx"><b>${esc(it.variante || it.nom)}</b><span>${pl.map(p => `<i class="pol">${POL[p].n}</i>`).join('')}${it.zone ? ' ' + esc(it.zone) : ''}${it.qty ? ` · ${esc(it.qty)} ${it.unit}` : ''}</span></div><span class="pill ${c}">${t}${it.samples.length ? ' ' + it.samples.join(', ') : ''}</span></a>`; }).join('')}</div>
  <button class="btn soft" data-act="addm" type="button">Ajouter un matériau</button>
  ${cpBox(2, 'Fin du local', checks, l.cp, `<button class="btn pri wide" data-act="ok" type="button" ${ok ? '' : 'disabled'}>Valider le local</button>`)}
  <button class="btn sm danger" data-act="dell" type="button">Supprimer le local</button>
  <div class="actions">${next ? `<a class="btn pri" href="#/m/${id}/l/${lid}/i/${next.id}">Point suivant</a>` : `<a class="btn" href="#/m/${id}/locaux">Locaux</a>`}</div>`;
  stagger(); readonly(m);
  bind({
    ok: async () => { l.cp = { at: nowIso(), by: S.expert(m) }; S.log(m, 2, l.id, `Local validé (${l.items.length} points)`); buzz(25); await save(m); toast('Local validé'); refresh(); },
    addm: async () => {
      const v = await sheet(`<h2>Ajouter un matériau</h2><div class="list">${Object.entries(MAT).map(([k, x]) => `<button class="li" data-close="${k}" type="button"><div class="tx"><b>${esc(x.n)}</b><span>${x.p.map(p => POL[p].n).join(', ')}</span></div></button>`).join('')}</div><button class="btn" data-close="" type="button">Annuler</button>`);
      if (!v) return;
      const it = S.newItem(m, v); l.items.push(it); touchLocal(m, l, 'matériau ajouté'); await save(m); go(`#/m/${id}/l/${lid}/i/${it.id}`);
    },
    dell: async () => {
      if (!await confirmSheet('Supprimer ce local ?', `${l.nom} et ses ${l.items.length} points.`, 'Supprimer', true)) return;
      for (const it of l.items) for (const p of it.photos) await del('photos', p.id);
      const codes = l.items.flatMap(i => i.samples);
      m.samples = m.samples.filter(s => !codes.includes(s.code)); codes.forEach(c => delete m.results[c]);
      m.locaux = m.locaux.filter(x => x !== l); S.cleanFamilies(m); S.reopenFrom(m, 3, 'local supprimé');
      await save(m); go(`#/m/${id}/locaux`);
    }
  });
}

/* ---------- Fiche matériau ---------- */
async function item(id, lid, iid) {
  const m = await mand(id); const l = S.findLocal(m, lid); const it = l && l.items.find(i => i.id === iid);
  if (!it) { go(`#/m/${id}/l/${lid}`); return; }
  const mat = MAT[it.key] || MAT.autre;
  head(it.variante || it.nom, `${l.nom} · ${l.id}`);
  const ph = [...it.photos];
  const slots = [{ k: 'large', t: 'Vue large' }, { k: 'proche', t: 'Vue rapprochée' }];
  const phHtml = async () => {
    let h = '';
    for (const s of slots) { const p = ph.find(x => x.kind === s.k); h += p ? `<div class="ph has" data-act="phv" data-id="${p.id}"><img src="${await photoUrl(p.id)}" alt="${s.t}"><span class="lab">${s.t}</span></div>` : `<div class="ph" data-act="shot" data-k="${s.k}">+ ${s.t}</div>`; }
    for (const p of ph.filter(x => x.kind === 'autre')) h += `<div class="ph has" data-act="phv" data-id="${p.id}"><img src="${await photoUrl(p.id)}" alt="Photo"><span class="lab">Détail</span></div>`;
    return h + `<div class="ph" data-act="shot" data-k="autre">+ Photo</div>`;
  };
  const polsM = POL_KEYS.filter(k => m.pol[k] || it.pols.includes(k));
  const fams = m.families.filter(f => f.id !== '').sort((a, b) => (b.key === it.key) - (a.key === it.key));
  const sampleTags = it.samples.map(c => { const s = m.samples.find(s => s.code === c); return `<div class="tagl"><div><b>${c}</b><span>${l.id} · ${esc(it.zone || '—')}</span><span>${s ? s.analyses.map(p => POL[p].n).join(', ') : ''} · ${fd(s?.at)}</span></div><div class="qr">${qrSvg(`${c} ${l.id} ${S.adresse(m)}`)}</div></div>`; }).join('');
  view.innerHTML = `
  <div class="hero"><p class="kick">${esc(l.nom)} · ${l.id}</p><h1>${esc(it.nom)}</h1><p>${it.pols.map(p => `<i class="pol">${POL[p].n}</i>`).join('')}</p>${mat.hint ? `<p class="note">${esc(mat.hint)}</p>` : ''}</div>
  <section class="card"><h3>Photos</h3><div class="photos" id="phs">${await phHtml()}</div><input type="file" id="cam" accept="image/*" capture="environment" hidden></section>
  <section class="card"><h3>Matériau</h3>${mat.v.length ? chips('var', [...mat.v, 'Autre'], mat.v.includes(it.variante) ? it.variante : (it.variante ? 'Autre' : '')) : ''}
    <input class="in" data-f="precision" placeholder="Précision (couleur, format…)" value="${esc(it.precision)}"></section>
  <section class="card"><h3>Localisation</h3>${chips('zone', ZONES, it.zone)}<input class="in" data-f="detail" placeholder="Détail (devant la fenêtre…)" value="${esc(it.detail)}"></section>
  <section class="card"><h3>Quantité</h3><div class="qty"><input class="in" data-f="qty" inputmode="decimal" placeholder="0" value="${esc(it.qty)}"><select class="in" data-f="unit">${UNITES.map(u => `<option ${u === it.unit ? 'selected' : ''}>${u}</option>`).join('')}</select></div>
    ${AR ? `<div class="grid2"><button class="btn soft" data-act="ar" data-mode="l" type="button">Mesurer une longueur</button><button class="btn soft" data-act="ar" data-mode="s" type="button">Mesurer une surface</button></div>` : `<p class="small muted">Mesure caméra : Chrome sur Android.</p>`}</section>
  <section class="card"><h3>État</h3>${chips('etat', ETATS, it.etat)}</section>
  <section class="card"><h3>Décision</h3>
    <div class="chips"><button type="button" class="chip c-tag ${it.status === 'prel' ? 'on' : ''}" data-act="st" data-v="prel">Prélever</button><button type="button" class="chip c-pos ${it.status === 'pres' ? 'on' : ''}" data-act="st" data-v="pres">Présumer</button><button type="button" class="chip c-neg ${it.status === 'nonsusp' ? 'on' : ''}" data-act="st" data-v="nonsusp">Non suspect</button><button type="button" class="chip c-abs ${it.status === 'abs' ? 'on' : ''}" data-act="st" data-v="abs">Absent</button></div>
    ${it.status === 'prel' ? `${it.samples.length ? sampleTags : `<div class="f"><span>Analyses</span>${polsM.map(p => `<label class="check"><input type="checkbox" data-f="an:${p}" ${it.pols.includes(p) ? 'checked' : ''}><span>${POL[p].n}</span></label>`).join('')}</div><button class="btn pri" data-act="sample" type="button">Créer le prélèvement</button>`}` : ''}
    ${it.status === 'pres' ? `<div class="f"><span>Polluants présumés</span>${polsM.map(p => `<label class="check"><input type="checkbox" data-f="pp:${p}" ${it.presPol.includes(p) ? 'checked' : ''}><span>${POL[p].n}</span></label>`).join('')}</div>` : ''}
    ${it.status === 'nonsusp' ? `<label class="f"><span>Justification</span><textarea class="in" data-f="justif" rows="2" placeholder="Ex. joints refaits en 2015 (facture)">${esc(it.justif)}</textarea></label>` : ''}
    ${it.status === 'abs' ? `<p class="small muted">Vérifié, absent du local.</p>` : ''}
    ${it.status === 'prel' || it.status === 'pres' ? `<label class="f"><span>Famille (matériau identique)</span><select class="in" data-f="fam"><option value="">Choisir…</option>${fams.map(f => `<option value="${f.id}" ${f.id === it.fam ? 'selected' : ''}>${f.id} · ${esc(f.nom)}</option>`).join('')}<option value="+">Nouvelle famille</option></select></label>` : ''}
  </section>
  <section class="card"><h3>Note</h3><textarea class="in" data-f="note" rows="2">${esc(it.note)}</textarea></section>
  <div class="actions"><a class="btn" href="#/m/${id}/l/${lid}">Local</a><button class="btn pri" data-act="next" data-keep type="button">Suivant</button></div>`;
  stagger(); readonly(m);
  let shotKind = 'large';
  const changed = why => touchLocal(m, l, why);
  bind({
    shot: b => { shotKind = b.dataset.k; $('#cam').click(); },
    phv: async b => {
      const u = await photoUrl(b.dataset.id);
      const v = await sheet(`<img src="${u}" alt="Photo" style="width:100%;border-radius:14px"><div class="row"><button class="btn grow" data-close="" type="button">Fermer</button>${m.rapport.signe ? '' : '<button class="btn danger grow" data-close="del" type="button">Supprimer</button>'}</div>`);
      if (v === 'del') { it.photos = it.photos.filter(p => p.id !== b.dataset.id); await del('photos', b.dataset.id); changed('photo supprimée'); await save(m); refresh(); }
    },
    var: async b => { it.variante = b.dataset.v === 'Autre' ? '' : b.dataset.v; if (b.dataset.v === 'Autre') $('[data-f=precision]').focus(); changed('matériau modifié'); await save(m); refresh(); },
    zone: async b => { it.zone = b.dataset.v; changed('localisation modifiée'); await save(m); refresh(); },
    etat: async b => { it.etat = b.dataset.v; changed('état modifié'); await save(m); refresh(); },
    st: async b => {
      const v = b.dataset.v;
      if (v === it.status) return;
      if (it.samples.length && v !== 'prel') {
        if (!await confirmSheet('Supprimer le prélèvement ?', `${it.samples.join(', ')} sera retiré.`, 'Supprimer', true)) return;
        m.samples = m.samples.filter(s => !it.samples.includes(s.code)); it.samples.forEach(c => delete m.results[c]); it.samples = [];
      }
      it.status = v;
      if (v === 'pres' && !it.presPol.length) it.presPol = [...it.pols];
      if (v === 'prel' || v === 'pres') { if (!it.fam) { const same = m.families.find(f => f.key === it.key && (f.nom === (it.variante || it.nom))); it.fam = same ? same.id : S.newFamily(m, it).id; } }
      else { it.fam = ''; S.cleanFamilies(m); }
      buzz(); changed('décision modifiée'); await save(m); refresh();
    },
    sample: async () => {
      const an = it.pols.filter(p => polsM.includes(p));
      if (!an.length) { toast('Choisissez une analyse'); return; }
      const c = S.newSample(m, it, an); buzz(30); changed('prélèvement créé'); await save(m); toast(`Prélèvement ${c} créé`); refresh();
    },
    ar: async b => {
      const r = await measure(b.dataset.mode);
      if (!r) return;
      if (r.error) { toast(r.error); return; }
      const val = String(r.value).replace('.', ',');
      let v = '1';
      if (it.qty && parseNum(it.qty)) v = await sheet(`<h2>${val} ${r.unit}</h2><p class="muted">Quantité actuelle : ${esc(it.qty)} ${it.unit}</p><div class="row"><button class="btn grow" data-close="add" type="button">Ajouter</button><button class="btn pri grow" data-close="1" type="button">Remplacer</button></div>`);
      if (!v) return;
      it.qty = v === 'add' ? String(Math.round((parseNum(it.qty) + r.value) * 100) / 100).replace('.', ',') : val;
      it.unit = r.unit; it.note = (it.note ? it.note + '\n' : '') + `Mesure caméra : ${val} ${r.unit}`;
      changed('quantité mesurée'); await save(m); toast('Quantité enregistrée'); refresh();
    },
    next: () => { const n = l.items.find(i => i.status === 'todo' && i !== it); go(n ? `#/m/${id}/l/${lid}/i/${n.id}` : `#/m/${id}/l/${lid}`); }
  }, async (k, el, ev) => {
    if (k.startsWith('an:')) { const p = k.slice(3); it.pols = el.checked ? [...new Set([...it.pols, p])] : it.pols.filter(x => x !== p); await save(m); return; }
    if (k.startsWith('pp:')) { const p = k.slice(3); it.presPol = el.checked ? [...new Set([...it.presPol, p])] : it.presPol.filter(x => x !== p); changed('présomption modifiée'); await save(m); return; }
    if (k === 'fam') {
      if (el.value === '+') { it.fam = S.newFamily(m, it).id; } else it.fam = el.value;
      S.cleanFamilies(m); changed('famille modifiée'); await save(m); refresh(); return;
    }
    if (k === 'unit') { it.unit = el.value; changed('unité modifiée'); await save(m); return; }
    it[k] = el.value;
    if (ev === 'change') { changed(k + ' modifié'); await save(m); }
  });
  $('#cam').onchange = async e => {
    const file = e.target.files[0]; e.target.value = '';
    if (!file) return;
    const blob = await shrink(file);
    const pid = uid();
    await put('photos', { id: pid, mid: m.id, blob });
    if (shotKind !== 'autre') it.photos = it.photos.filter(p => p.kind !== shotKind);
    it.photos.push({ id: pid, kind: shotKind });
    changed('photo ajoutée'); await save(m); buzz(); refresh();
  };
}

/* ---------- Fin de visite (PC 3) ---------- */
async function fin(id) {
  const m = await mand(id);
  head('Fin de visite', S.adresse(m));
  const its = S.allItems(m).map(x => x.it);
  const nv = m.locaux.filter(l => l.cp).length;
  const todo = its.filter(i => i.status === 'todo').length;
  const n = k => its.filter(i => i.status === k).length;
  m.fin ||= { etiquettes: false, absences: false };
  const checks = [
    { ok: m.locaux.length > 0 && nv === m.locaux.length, txt: `${nv}/${m.locaux.length} locaux validés` },
    { ok: !todo, txt: todo ? `${todo} point(s) à vérifier` : 'Aucun point en attente' },
    { ok: m.fin.etiquettes, txt: `${m.samples.length} étiquettes = ${m.samples.length} sachets` },
    { ok: m.fin.absences, txt: `${n('abs')} absence(s) confirmée(s)` }
  ];
  view.innerHTML = `
  <section class="card"><div class="grid2">
    ${[['Points', its.length], ['Prélèvements', m.samples.length], ['Présumés', n('pres')], ['Non suspects', n('nonsusp')]].map(([k, v]) => `<div><p class="small muted">${k}</p><p style="font-size:26px;font-weight:650;color:var(--nc)">${v}</p></div>`).join('')}
  </div></section>
  <section class="card"><h3>À cocher par l’expert</h3>
    <label class="check"><input type="checkbox" data-f="etiquettes" ${m.fin.etiquettes ? 'checked' : ''}><span>Étiquettes et sachets concordent</span></label>
    <label class="check"><input type="checkbox" data-f="absences" ${m.fin.absences ? 'checked' : ''}><span>Absences confirmées</span></label></section>
  ${cpBox(3, 'Fin de visite', checks, m.cp[3], `<button class="btn pri wide" data-act="ok" type="button" ${checks.every(c => c.ok) ? '' : 'disabled'}>Valider</button>`)}
  ${m.cp[3] ? `<div class="actions"><a class="btn pri" href="#/m/${id}/labo">Laboratoire</a></div>` : ''}`;
  stagger(); readonly(m);
  bind({ ok: async () => { S.validate(m, 3, `Visite validée : ${m.samples.length} échantillons`); buzz(25); await save(m); toast('Visite validée'); refresh(); } },
    async (k, el) => { m.fin[k] = el.checked; S.reopenFrom(m, 3, 'contrôle de fin modifié'); await save(m); refresh(); });
}

/* ---------- Laboratoire (PC 4) ---------- */
function sampleCtx(m, s) { const x = S.allItems(m).find(x => x.it.id === s.item); return x ? `${x.l.id} · ${x.it.variante || x.it.nom}` : '—'; }
async function labo(id) {
  const m = await mand(id);
  if (!m.cp[3]) { toast('Validez la fin de visite'); go(`#/m/${id}/fin`); return; }
  head('Laboratoire', S.adresse(m));
  const miss = S.resultsComplete(m);
  const checks = [{ ok: !miss, txt: miss ? `${miss} résultat(s) manquant(s)` : 'Résultats complets' }, { ok: !m.unmatched.length, txt: m.unmatched.length ? `${m.unmatched.length} code(s) inconnu(s)` : 'Codes rattachés' }];
  view.innerHTML = `
  <section class="card"><div class="row between"><h2>${m.samples.length} échantillons</h2><div class="row"><a class="btn sm soft" href="#/m/${id}/etiquettes">Étiquettes</a><button class="btn sm soft" data-act="bord" data-keep type="button">Bordereau</button></div></div>
    <button class="btn" data-act="imp" type="button">Importer les résultats (CSV)</button><p class="small muted">Colonnes : code ; analyse ; résultat ; valeur</p><input type="file" id="csv" accept=".csv,.txt,text/csv" hidden></section>
  ${m.unmatched.length ? `<section class="card"><h3>Codes inconnus</h3>${m.unmatched.map((u, i) => `<div class="row"><span class="pill wait">${esc(u.code)}</span><span class="small grow">${esc(POL[u.p]?.n || u.p)} · ${u.r === 'det' ? 'Détecté' : 'Non détecté'} ${esc(u.v || '')}</span><select class="in" style="max-width:150px" data-f="map:${i}"><option value="">Rattacher à…</option>${m.samples.filter(s => s.analyses.includes(u.p)).map(s => `<option value="${s.code}">${s.code}</option>`).join('')}</select><button class="btn sm ghost" data-act="drop" data-i="${i}" type="button">Ignorer</button></div>`).join('')}</section>` : ''}
  ${m.samples.map(s => `<section class="card"><div class="row between"><b>${s.code}</b><span class="small muted">${esc(sampleCtx(m, s))}</span></div>
    ${s.analyses.map(p => { const r = m.results[s.code]?.[p] || {}; return `<div class="f"><span>${POL[p].n}</span><div class="row"><div class="chips grow"><button type="button" class="chip c-neg ${r.r === 'nd' ? 'on' : ''}" data-act="res" data-c="${s.code}" data-p="${p}" data-v="nd">Non détecté</button><button type="button" class="chip c-pos ${r.r === 'det' ? 'on' : ''}" data-act="res" data-c="${s.code}" data-p="${p}" data-v="det">Détecté</button></div></div><input class="in" data-f="val:${s.code}:${p}" placeholder="Valeur ou type (ex. chrysotile)" value="${esc(r.v || '')}"></div>`; }).join('')}
  </section>`).join('')}
  ${cpBox(4, 'Résultats du labo', checks, m.cp[4], `<button class="btn pri wide" data-act="ok" type="button" ${checks.every(c => c.ok) ? '' : 'disabled'}>Valider</button>`)}
  ${m.cp[4] ? `<div class="actions"><a class="btn pri" href="#/m/${id}/strat">Stratégie</a></div>` : ''}`;
  stagger(); readonly(m);
  const setRes = (c, p, k, v) => { m.results[c] ||= {}; m.results[c][p] ||= {}; m.results[c][p][k] = v; S.reopenFrom(m, 4, 'résultat modifié'); };
  bind({
    res: async b => { setRes(b.dataset.c, b.dataset.p, 'r', b.dataset.v); S.log(m, 4, b.dataset.c, `${POL[b.dataset.p].n} : ${b.dataset.v === 'det' ? 'détecté' : 'non détecté'} (saisie)`); await save(m); refresh(); },
    imp: () => $('#csv').click(),
    drop: async b => { m.unmatched.splice(+b.dataset.i, 1); await save(m); refresh(); },
    bord: () => {
      const rows = [['code', 'local', 'materiau', 'analyses'], ...m.samples.map(s => [s.code, ...sampleCtx(m, s).split(' · '), s.analyses.map(p => POL[p].n).join('+')])];
      download(new Blob(['﻿' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')], { type: 'text/csv' }), `bordereau_${(S.adresse(m) || 'mandat').replace(/[^\w-]+/g, '_')}.csv`);
    },
    ok: async () => { S.validate(m, 4, 'Résultats du laboratoire validés'); buzz(25); await save(m); toast('Résultats validés'); refresh(); }
  }, async (k, el, ev) => {
    if (k.startsWith('val:')) { const [, c, p] = k.split(':'); m.results[c] ||= {}; m.results[c][p] ||= {}; m.results[c][p].v = el.value; if (ev === 'change') { S.reopenFrom(m, 4, 'valeur modifiée'); await save(m); } return; }
    if (k.startsWith('map:') && el.value) {
      const u = m.unmatched[+k.slice(4)]; setRes(el.value, u.p, 'r', u.r); setRes(el.value, u.p, 'v', u.v);
      S.log(m, 4, el.value, `Code ${u.code} rattaché par l’expert`); m.unmatched.splice(+k.slice(4), 1); await save(m); refresh();
    }
  });
  $('#csv').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (f) { const n = importCsv(m, await f.text()); await save(m); toast(`${n.ok} résultat(s) importé(s)${n.ko ? ` · ${n.ko} inconnu(s)` : ''}`); refresh(); } };
}
function importCsv(m, txt) {
  const lines = txt.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
  const sep = (lines[0].match(/;/g) || []).length ? ';' : (lines[0].match(/\t/g) || []).length ? '\t' : ',';
  const polOf = s => /amiant|asbest/i.test(s) ? 'A' : /pcb/i.test(s) ? 'PCB' : /plomb|\bpb\b|lead/i.test(s) ? 'Pb' : /hap|pak|pah/i.test(s) ? 'HAP' : /hbcd/i.test(s) ? 'HBCD' : '';
  const resOf = s => /non|n\.?d\.?|absent|n[ée]gatif|negative|not|<|aucun/i.test(s) ? 'nd' : /d[ée]tect|positif|pr[ée]sent|oui|chrysotile|amosite|crocidolite|actinolite|tr[ée]molite|anthophyllite|\d/i.test(s) ? 'det' : '';
  let ok = 0, ko = 0;
  for (const line of lines) {
    const c = line.split(sep).map(x => x.trim().replace(/^"|"$/g, ''));
    if (/^code$/i.test(c[0])) continue;
    const code = (c[0] || '').toUpperCase().replace(/\s/g, ''); const p = polOf(c[1] || ''); const r = resOf(c[2] || ''); const v = c[3] || (r === 'det' && !/d[ée]tect/i.test(c[2]) ? c[2] : '');
    if (!code || !p || !r) continue;
    const s = m.samples.find(s => s.code === code && s.analyses.includes(p));
    if (s) { m.results[code] ||= {}; m.results[code][p] = { r, v }; ok++; }
    else { m.unmatched.push({ code, p, r, v }); ko++; }
  }
  S.reopenFrom(m, 4, 'import de résultats');
  S.log(m, 4, 'Import CSV', `${ok} résultat(s) importé(s), ${ko} code(s) inconnu(s)`);
  return { ok, ko };
}

/* ---------- Étiquettes ---------- */
async function etiquettes(id) {
  const m = await mand(id);
  head('Étiquettes', `${m.samples.length} échantillons`);
  const its = S.allItems(m);
  view.innerHTML = `
  ${m.samples.length ? `<div class="labels">${m.samples.map(s => { const x = its.find(x => x.it.id === s.item); return `<div class="lab-p"><div class="qr">${qrSvg(`${s.code} ${x ? x.l.id : ''} ${S.adresse(m)}`)}</div><div><b>${s.code}</b><span>${x ? `${esc(x.l.niveau)} · ${esc(x.l.nom)} (${x.l.id})` : ''}</span><span>${x ? esc([x.it.zone, x.it.variante || x.it.nom].filter(Boolean).join(' · ')) : ''}</span><span>${s.analyses.map(p => POL[p].n).join(', ')} · ${fd(s.at)}</span></div></div>`; }).join('')}</div>` : `<div class="card"><p class="muted">Aucun prélèvement.</p></div>`}
  <div class="actions noprint"><button class="btn pri" data-act="print" data-keep type="button">Imprimer</button></div>`;
  stagger();
  bind({ print: () => window.print() });
}

/* ---------- Stratégie (PC 5) ---------- */
function famReady(f, i) {
  if (Object.values(i.st).some(v => v.s === 'conf' || v.s === 'wait')) return false;
  if (!i.polluee) return true;
  if (!f.dec.mesure || !f.dec.filiere || f.dec.filiere === 'À définir') return false;
  if (S.isAmiante(i) && (!f.dec.urgence || !f.dec.suva)) return false;
  return true;
}
async function strat(id) {
  const m = await mand(id);
  if (!m.cp[4]) { toast('Validez les résultats du labo'); go(`#/m/${id}/labo`); return; }
  head('Stratégie', `${m.families.length} familles`);
  const F = m.families.map(f => ({ f, i: S.famInfo(m, f) }));
  const nOk = F.filter(x => x.f.dec.ok).length;
  const conf = F.filter(x => Object.values(x.i.st).some(v => v.s === 'conf')).length;
  const checks = [{ ok: nOk === F.length && F.length > 0, txt: `${nOk}/${F.length} familles validées` }, { ok: !conf, txt: conf ? `${conf} identité(s) à confirmer` : 'Identités confirmées' }];
  view.innerHTML = `
  <details class="card"><summary><b>Règles appliquées</b></summary><ol class="small">${REGLES.map(r => `<li>${esc(r)}</li>`).join('')}</ol></details>
  ${F.map(({ f, i }) => {
    const hasConf = Object.values(i.st).some(v => v.s === 'conf');
    const am = S.isAmiante(i);
    const fp = S.filiereProposee(f, i);
    const sp = S.suvaPropose(f);
    return `<section class="card fam ${f.dec.ok ? 'ok' : ''}">
      <div class="hd"><div><b>${f.id} · ${esc(f.nom)}</b><p class="small muted">${i.locs.length} local(aux) · ${Object.entries(i.qty).map(([u, q]) => `${nf(q)} ${u}`).join(' + ') || 'quantité ?'}${i.pire ? ' · état ' + i.pire.toLowerCase() : ''}</p></div>${f.dec.ok ? '<span class="pill ok">Validée</span>' : ''}</div>
      <div class="pls">${Object.entries(i.st).map(([p, v]) => `<span class="pill ${v.s}">${POL[p].n} : ${S.STLAB[v.s]}${v.s === 'pos' && v.ext ? ` (${v.det} analysé, ${v.ext} étendu)` : ''}${v.vmax != null ? ` · ${nf(v.vmax)}` : ''}</span>`).join('')}</div>
      <p class="small muted">${i.locs.map(l => `${esc(l.niveau)} · ${esc(l.nom)}`).join(' / ')}</p>
      ${hasConf || f.dec.identite != null ? `<div class="f"><span>Non détecté : matériaux identiques ?</span><div class="chips"><button type="button" class="chip c-neg ${f.dec.identite === true ? 'on' : ''}" data-act="ident" data-f2="${f.id}" data-v="1">Oui, étendre</button><button type="button" class="chip c-pos ${f.dec.identite === false ? 'on' : ''}" data-act="ident" data-f2="${f.id}" data-v="0">Non, présumer</button></div></div>` : ''}
      ${am ? `<div class="f"><span>Urgence (FACH 2891)</span><div class="chips">${Object.keys(URGENCE).map(u => `<button type="button" class="chip ${f.dec.urgence === u ? 'on' : ''}" data-act="urg" data-f2="${f.id}" data-v="${u}">${u}</button>`).join('')}</div>${f.dec.urgence ? `<p class="small muted">${esc(URGENCE[f.dec.urgence])}</p>` : ''}</div>
        <div class="f"><span>Code Suva (CFST 6503)${sp ? ` · proposé : ${SUVA[sp].n.toLowerCase()}` : ''}</span><div class="chips">${Object.entries(SUVA).map(([k, v]) => `<button type="button" class="chip ${k === 'rouge' ? 'c-pos' : ''} ${f.dec.suva === k ? 'on' : ''}" data-act="suva" data-f2="${f.id}" data-v="${k}">${v.n}</button>`).join('')}</div>${f.dec.suva ? `<p class="small muted">${esc(SUVA[f.dec.suva].t)}</p>` : ''}</div>` : ''}
      ${i.polluee ? `<label class="f"><span>Mesure</span><select class="in" data-f="mesure:${f.id}"><option value="">Choisir…</option>${DECISIONS.mesure.map(x => `<option ${x === f.dec.mesure ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
        <label class="f"><span>Filière des déchets (OLED)${fp ? ` · proposée : ${esc(fp.f)}` : ''}</span><select class="in" data-f="filiere:${f.id}">${DECISIONS.filiere.map(x => `<option ${x === f.dec.filiere ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>${fp ? `<span class="small muted">${esc(fp.why)}</span>` : ''}</label>
        ${am ? `<label class="check"><input type="checkbox" data-f="fc:${f.id}" ${f.fc ? 'checked' : ''}><span>Fibrociment ou bitume de toiture</span></label>` : ''}` : ''}
      <label class="f"><span>Remarque</span><input class="in" data-f="rem:${f.id}" value="${esc(f.dec.remarque)}"></label>
      <button class="btn ${f.dec.ok ? '' : 'soft'}" data-act="fok" data-f2="${f.id}" type="button" ${f.dec.ok || famReady(f, i) ? '' : 'disabled'}>${f.dec.ok ? 'Annuler la validation' : 'Valider la famille'}</button>
    </section>`;
  }).join('')}
  ${!F.length ? '<div class="card"><p class="muted">Aucune famille : aucun matériau prélevé ou présumé.</p></div>' : ''}
  ${cpBox(5, 'Stratégie', F.length ? checks : [{ ok: true, txt: 'Aucune famille' }], m.cp[5], `<button class="btn pri wide" data-act="ok" type="button" ${(!F.length || checks.every(c => c.ok)) ? '' : 'disabled'}>Valider</button>`)}
  ${m.cp[5] ? `<div class="actions"><a class="btn" href="#/m/${id}/synth">Synthèse</a><a class="btn pri" href="#/m/${id}/rapport">Rapport</a></div>` : ''}`;
  stagger(); readonly(m);
  const fam = id2 => m.families.find(f => f.id === id2);
  const dirty = (f, why) => { if (f.dec.ok) { f.dec.ok = null; S.log(m, 5, f.id, 'Rouverte : ' + why); } S.reopenFrom(m, 5, why); };
  bind({
    ident: async b => { const f = fam(b.dataset.f2); f.dec.identite = b.dataset.v === '1'; dirty(f, 'identité modifiée'); S.log(m, 5, f.id, f.dec.identite ? 'Non détecté étendu aux matériaux identiques' : 'Traité comme présumé'); await save(m); refresh(); },
    urg: async b => { const f = fam(b.dataset.f2); f.dec.urgence = b.dataset.v; dirty(f, 'urgence modifiée'); await save(m); refresh(); },
    suva: async b => {
      const f = fam(b.dataset.f2); f.dec.suva = b.dataset.v;
      if (b.dataset.v === 'rouge' && !f.dec.mesure) f.dec.mesure = DECISIONS.mesure[0];
      if (b.dataset.v === 'orange' && !f.dec.mesure) f.dec.mesure = DECISIONS.mesure[1];
      dirty(f, 'code Suva modifié'); await save(m); refresh();
    },
    fok: async b => {
      const f = fam(b.dataset.f2);
      if (f.dec.ok) { f.dec.ok = null; S.reopenFrom(m, 5, 'famille rouverte'); }
      else { f.dec.ok = { at: nowIso(), by: S.expert(m) }; S.log(m, 5, f.id, ['Décision validée', f.dec.urgence && 'urgence ' + f.dec.urgence, f.dec.suva && 'code ' + SUVA[f.dec.suva].n.toLowerCase(), f.dec.mesure, f.dec.filiere].filter(Boolean).join(' · ')); buzz(); }
      await save(m); refresh();
    },
    ok: async () => { S.validate(m, 5, 'Stratégie validée'); buzz(25); await save(m); toast('Stratégie validée'); refresh(); }
  }, async (k, el, ev) => {
    const [what, fid] = k.split(':'); const f = fam(fid); if (!f) return;
    if (what === 'fc') { f.fc = el.checked; dirty(f, 'type de matériau modifié'); await save(m); refresh(); return; }
    if (what === 'rem') { f.dec.remarque = el.value; if (ev === 'change') await save(m); return; }
    f.dec[what] = el.value; dirty(f, what + ' modifiée'); await save(m); refresh();
  });
}

/* ---------- Mesures : libération des zones (FACH 2955) et PCB dans l'air (OFSP) ---------- */
async function mesures(id) {
  const m = await mand(id);
  head('Mesures', S.adresse(m));
  const Z = m.mesures.zones, P = m.mesures.pcb;
  const zv = z => !z.visuel ? 'À contrôler' : z.visuel === 'nc' ? 'Contrôle visuel non conforme' : z.conf && (z.far === '' || z.far == null) ? 'Mesure VDI 3492 manquante' : z.conf && Number(z.far) >= SEUILS.liberation ? `≥ ${SEUILS.liberation} FAR/m³ : non libérable` : 'Libérable';
  const zok = z => zv(z) === 'Libérable';
  const pv = q => q.val === '' || q.val == null ? null : Number(String(q.val).replace(',', '.')) > (q.occ === 'long' ? SEUILS.pcbAirLong : SEUILS.pcbAirJour);
  view.innerHTML = `
  <section class="card"><div class="row between"><h2>Libération des zones</h2><button class="btn sm soft" data-act="addz" type="button">Ajouter</button></div>
    <p class="small muted">Après désamiantage : contrôle visuel et, sous confinement, mesure libératoire VDI 3492 (FACH 2955, CFST 6503). Seuil : ${SEUILS.liberation} FAR/m³.</p>
    ${Z.map((z, k) => `<div class="card flat">
      <div class="row between"><input class="in grow" data-f="z:${k}:nom" value="${esc(z.nom)}" placeholder="Zone (ex. 1er, salle de bain 1.1)"><button class="btn sm ghost" data-act="delz" data-k="${k}" type="button">Retirer</button></div>
      <label class="check"><input type="checkbox" data-f="z:${k}:conf" ${z.conf ? 'checked' : ''}><span>Zone sous confinement</span></label>
      <div class="f"><span>Contrôle visuel</span><div class="chips"><button type="button" class="chip c-neg ${z.visuel === 'ok' ? 'on' : ''}" data-act="vis" data-k="${k}" data-v="ok">Conforme</button><button type="button" class="chip c-pos ${z.visuel === 'nc' ? 'on' : ''}" data-act="vis" data-k="${k}" data-v="nc">Non conforme</button></div></div>
      ${z.conf ? `<label class="f"><span>Mesure VDI 3492 (FAR/m³)</span><input class="in" inputmode="decimal" data-f="z:${k}:far" value="${esc(z.far ?? '')}"></label>` : ''}
      <div class="row between"><span class="pill ${zok(z) ? 'neg' : z.visuel ? 'pos' : ''}">${esc(zv(z))}</span>${z.ok ? stampHtml(z.ok) : `<button class="btn sm pri" data-act="zok" data-k="${k}" type="button" ${zok(z) ? '' : 'disabled'}>Libérer</button>`}</div>
    </div>`).join('') || '<p class="muted">Aucune zone.</p>'}
  </section>
  <section class="card"><div class="row between"><h2>PCB dans l’air</h2><button class="btn sm soft" data-act="addp" type="button">Ajouter</button></div>
    <p class="small muted">Valeurs indicatives OFSP : ${SEUILS.pcbAirJour} µg/m³ (locaux occupés la journée), ${SEUILS.pcbAirLong} µg/m³ (séjour de longue durée).</p>
    ${P.map((q, k) => `<div class="card flat">
      <div class="row between"><input class="in grow" data-f="p:${k}:loc" value="${esc(q.loc)}" placeholder="Local mesuré"><button class="btn sm ghost" data-act="delp" data-k="${k}" type="button">Retirer</button></div>
      <div class="chips"><button type="button" class="chip ${q.occ !== 'long' ? 'on' : ''}" data-act="occ" data-k="${k}" data-v="jour">Journée (${SEUILS.pcbAirJour})</button><button type="button" class="chip ${q.occ === 'long' ? 'on' : ''}" data-act="occ" data-k="${k}" data-v="long">Longue durée (${SEUILS.pcbAirLong})</button></div>
      <label class="f"><span>Moyenne mesurée (µg/m³)</span><input class="in" inputmode="decimal" data-f="p:${k}:val" value="${esc(q.val ?? '')}"></label>
      ${pv(q) === null ? '' : `<span class="pill ${pv(q) ? 'pos' : 'neg'}">${pv(q) ? 'Dépassement de la valeur indicative' : 'Sous la valeur indicative'}</span>`}
    </div>`).join('') || '<p class="muted">Aucune mesure.</p>'}
  </section>`;
  stagger(); readonly(m);
  bind({
    addz: async () => { Z.push({ nom: '', conf: true, visuel: '', far: '', ok: null }); await save(m); refresh(); },
    delz: async b => { Z.splice(+b.dataset.k, 1); await save(m); refresh(); },
    vis: async b => { const z = Z[+b.dataset.k]; z.visuel = b.dataset.v; z.ok = null; await save(m); refresh(); },
    zok: async b => { const z = Z[+b.dataset.k]; z.ok = { at: nowIso(), by: S.expert(m) }; S.log(m, 0, z.nom || 'Zone', `Zone libérée${z.conf ? ` · ${z.far} FAR/m³` : ''} · contrôle visuel conforme`); buzz(25); await save(m); refresh(); },
    addp: async () => { P.push({ loc: '', occ: 'jour', val: '' }); await save(m); refresh(); },
    delp: async b => { P.splice(+b.dataset.k, 1); await save(m); refresh(); },
    occ: async b => { P[+b.dataset.k].occ = b.dataset.v; await save(m); refresh(); }
  }, async (k, el, ev) => {
    const [t, i, f] = k.split(':'); const o = (t === 'z' ? Z : P)[+i]; if (!o) return;
    o[f] = el.type === 'checkbox' ? el.checked : el.value;
    if (t === 'z' && f !== 'nom') o.ok = null;
    if (ev === 'change') { if (t === 'p' && f === 'val') S.log(m, 0, o.loc || 'PCB air', `PCB air : ${o.val} µg/m³ (${o.occ === 'long' ? 'longue durée' : 'journée'})`); await save(m); refresh(); }
  });
}

/* ---------- Synthèse ---------- */
async function synth(id) {
  const m = await mand(id);
  if (!m.cp[5]) { toast('Validez la stratégie'); go(`#/m/${id}/strat`); return; }
  head('Synthèse', S.adresse(m));
  const rows = S.synthRows(m);
  const auto = S.cfstAuto(m), lvl = S.cfstLevel(m);
  const tot = {}; rows.forEach(r => { if (r.cls === 'pos') tot[r.polluant] = (tot[r.polluant] || 0) + 1; });
  view.innerHTML = `
  <div class="chips">${POL_KEYS.filter(k => m.pol[k]).map(k => `<span class="pill ${tot[POL[k].n] ? 'pos' : 'neg'}">${POL[k].n} · ${tot[POL[k].n] ? tot[POL[k].n] + ' élément(s)' : 'absent'}</span>`).join('')}</div>
  <div class="scroll card" style="padding:0"><table class="t"><thead><tr><th>Niveau</th><th>Élément</th><th>Polluant</th><th>Statut</th><th>Quantité</th><th>Urg.</th><th>Suva</th><th>Mesure</th><th>Filière</th></tr></thead><tbody>
  ${rows.map(r => `<tr class="${r.cls}"><td class="nw">${esc(r.niveaux)}</td><td>${esc(r.element)} <span class="small muted">${r.fam}</span></td><td>${esc(r.polluant)}</td><td>${esc(r.statut)}</td><td class="n">${esc(r.qty)}</td><td>${esc(r.urgence)}</td><td>${esc(r.suva)}</td><td>${esc(r.mesure)}</td><td>${esc(r.filiere)}</td></tr>`).join('') || '<tr><td colspan="9">Aucun élément.</td></tr>'}
  </tbody></table></div>
  <p class="small muted">Rouge : présent ou présumé · bleu : absent après analyse.</p>
  <section class="card"><h3>Protection CFST 6503</h3><p><b>Catégorie ${lvl}</b> · ${esc(S.CFST_TXT[lvl])}</p>
    <label class="f"><span>Catégorie (calculée : ${auto})</span><select class="in" data-f="cfst"><option value="">Automatique</option>${[1, 2, 3].map(n => `<option value="${n}" ${String(m.cfst.override) === String(n) ? 'selected' : ''}>Catégorie ${n}</option>`).join('')}</select></label></section>
  <section class="card"><h3>Plan d’élimination (OLED art. 16)</h3>${m.info.volume200 ? '<p class="warnbox">Plus de 200 m³ de déchets : plan d’élimination obligatoire.</p>' : ''}
    ${Object.entries(S.planElimination(m)).map(([k, v]) => `<div class="row between"><span><b>${esc(k)}</b> <span class="small muted">${v.fams.join(', ')}</span></span><span>${Object.entries(v.qty).map(([u, q]) => `${nf(q)} ${u}`).join(' + ') || '—'}</span></div>`).join('') || '<p class="muted">Aucun déchet pollué.</p>'}</section>
  <div class="actions"><button class="btn" data-act="csv" data-keep type="button">Exporter</button><a class="btn pri" href="#/m/${id}/rapport">Rapport</a></div>`;
  stagger(); readonly(m);
  bind({
    csv: () => {
      const h = ['Niveau', 'Locaux', 'Élément', 'Famille', 'Polluant', 'Statut', 'Quantité', 'Urgence', 'Code Suva', 'Mesure', 'Filière'];
      const data = rows.map(r => [r.niveaux, r.locaux, r.element, r.fam, r.polluant, r.statut, r.qty, r.urgence, r.suva, r.mesure, r.filiere]);
      download(new Blob(['﻿' + [h, ...data].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')], { type: 'text/csv' }), 'synthese.csv');
    }
  }, async (k, el) => { m.cfst.override = el.value; S.log(m, 5, 'CFST 6503', el.value ? `Catégorie fixée à ${el.value} par l’expert` : 'Catégorie automatique'); S.reopenFrom(m, 6, 'catégorie modifiée'); await save(m); refresh(); });
}

/* ---------- Rapport (PC 6) ---------- */
async function rapport(id) {
  const m = await mand(id);
  if (!m.cp[5]) { toast('Validez la stratégie'); go(`#/m/${id}/strat`); return; }
  head('Rapport', `V${m.version}`);
  if (!m.rapport.conclusion) { m.rapport.conclusion = S.conclusionType(m); await save(m); }
  const checks = [{ ok: !!m.cp[5], txt: 'Stratégie validée' }, { ok: m.rapport.relu, txt: 'Rapport relu' }, { ok: !!m.rapport.signe, txt: 'Signature' }];
  const signed = m.rapport.signe;
  view.innerHTML = `
  <section class="card"><div class="row between"><h3>Conclusion</h3><button class="btn sm ghost" data-act="type" type="button">Texte type</button></div><textarea class="in" data-f="conclusion" rows="8">${esc(m.rapport.conclusion)}</textarea></section>
  <section class="card"><h3>Situations à risque</h3><textarea class="in" data-f="risques" rows="2" placeholder="Aucune">${esc(m.rapport.risques)}</textarea></section>
  <button class="btn pri" data-act="word" data-keep type="button">Générer le Word</button>
  <section class="cp"><h3>Point de contrôle 6 · Rapport</h3><ul>${checks.map(c => `<li class="${c.ok ? 'ok' : 'ko'}"><i></i><span>${c.txt}</span></li>`).join('')}</ul>
    <label class="check"><input type="checkbox" data-f="relu" ${m.rapport.relu ? 'checked' : ''}><span>J’ai relu le rapport</span></label>
    ${signed ? `${stampHtml(signed)}<button class="btn" data-act="reopen" data-keep type="button">Rouvrir (version ${m.version + 1})</button>` : `<label class="f"><span>Signataire</span><input class="in" data-f="signataire" value="${esc(m.rapport.signataire || S.expert(m))}"></label><button class="btn pri wide" data-act="sign" type="button" ${m.rapport.relu ? '' : 'disabled'}>Signer et figer</button>`}
  </section>
  <section class="card"><h3>Journal</h3><div class="list">${m.journal.slice().reverse().slice(0, 40).map(j => `<div class="small"><b>${fdt(j.at)}</b> · ${j.cp ? 'PC ' + j.cp + ' · ' : ''}${esc(j.cible)} · ${esc(j.txt)}</div>`).join('')}</div></section>`;
  stagger(); readonly(m);
  bind({
    type: async () => { m.rapport.conclusion = S.conclusionType(m); await save(m); refresh(); toast('Texte type inséré'); },
    word: async b => {
      b.disabled = true; b.textContent = 'Génération…';
      try { const { buildDocx } = await import('./report.js'); const blob = await buildDocx(m); download(blob, `Diagnostic_${(S.adresse(m) || 'mandat').replace(/[^\w-]+/g, '_')}_V${m.version}.docx`); toast('Rapport généré'); }
      catch (e) { console.error(e); toast('Erreur : ' + e.message); }
      b.disabled = false; b.textContent = 'Générer le Word';
    },
    sign: async () => {
      const by = (m.rapport.signataire || S.expert(m)).trim();
      m.rapport.signe = { at: nowIso(), by }; m.cp[6] = { at: m.rapport.signe.at, by };
      S.log(m, 6, 'Rapport', `Version ${m.version} signée et figée`); buzz([20, 40, 20]); await save(m); toast('Rapport signé'); refresh();
    },
    reopen: async () => {
      if (!await confirmSheet(`Créer la version ${m.version + 1} ?`, 'La version signée reste dans le journal. Le rapport repasse en brouillon.')) return;
      m.version += 1; m.rapport.signe = null; m.rapport.relu = false; delete m.cp[6];
      S.log(m, 6, 'Rapport', `Version ${m.version} ouverte`); await save(m); refresh();
    }
  }, async (k, el, ev) => {
    if (k === 'relu') { m.rapport.relu = el.checked; await save(m); refresh(); return; }
    m.rapport[k] = el.value; if (ev === 'change') await save(m);
  });
}

/* ---------- Export / import ---------- */
async function exportJson(m) {
  const ps = await photosOf(m.id);
  const photos = [];
  for (const p of ps) photos.push({ id: p.id, b64: await blobToB64(p.blob) });
  download(new Blob([JSON.stringify({ format: 'diagpol-1', mandat: m, photos })], { type: 'application/json' }), `mandat_${(S.adresse(m) || m.id).replace(/[^\w-]+/g, '_')}.json`);
  toast('Mandat exporté');
}
async function importJson(file) {
  try {
    const d = JSON.parse(await file.text());
    if (d.format !== 'diagpol-1' || !d.mandat) throw new Error('Fichier non reconnu');
    let m = d.mandat;
    const exists = await get('mandats', m.id);
    if (exists && !await confirmSheet('Mandat déjà présent', 'Remplacer la version de cet appareil ?', 'Remplacer', true)) return;
    for (const p of d.photos || []) await put('photos', { id: p.id, mid: m.id, blob: b64ToBlob(p.b64) });
    await put('mandats', m); S.setCurrent(null);
    toast('Mandat importé'); go(`#/m/${m.id}`);
  } catch (e) { toast(e.message); }
}

route();
