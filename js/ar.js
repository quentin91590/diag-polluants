/* Métré par caméra (WebXR, Chrome Android avec ARCore).
   mode 'l' : longueur (2 points) · mode 's' : surface rectangulaire (3 points : A, B, C ; surface = AB × BC) */
import { $, nf, buzz } from './util.js?v=19';

export async function arSupported() {
  try { return !!(navigator.xr && await navigator.xr.isSessionSupported('immersive-ar')); }
  catch (e) { return false; }
}

const mul = (a, b) => { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; };
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);

export function measure(mode) {
  return new Promise(async (resolve) => {
    const ov = $('#ar-ov'), svg = $('#ar-svg'), dots = $('#ar-dots'), ret = $('#ar-ret'), msg = $('#ar-msg'), read = $('#ar-read');
    const bPt = $('#ar-pt'), bOk = $('#ar-ok'), bUndo = $('#ar-undo'), bCancel = $('#ar-cancel');
    const need = mode === 's' ? 3 : 2;
    const pts = []; let curP = null; let result = null; let session;
    let state = 'start', since = performance.now(), frames = 0, found = false, err = '';
    const say = s => { if (msg.textContent !== s) msg.textContent = s; };
    const show = s => { if (read.textContent !== s) read.textContent = s; };
    $('#ar-mode').textContent = mode === 's' ? 'Surface (3 coins)' : 'Longueur (2 points)';
    say('Démarrage de la caméra…');
    show(''); svg.innerHTML = ''; dots.innerHTML = '';
    ret.className = 'ar-ret'; bPt.disabled = true; bOk.disabled = true;
    ov.hidden = false;
    const value = () => {
      if (pts.length < 2) return null;
      if (mode === 'l') return dist(pts[0], pts[1]);
      if (pts.length < 3) return null;
      return dist(pts[0], pts[1]) * dist(pts[1], pts[2]);
    };
    const refresh = () => {
      const full = pts.length >= need;
      bOk.disabled = !full;
      bPt.disabled = full || !curP;
      ret.classList.toggle('hit', !!curP && !full);
      if (err) { say('Erreur : ' + err); return; }
      if (full) { const v = value(); show(mode === 's' ? `${nf(v)} m²` : `${nf(v)} m`); say('Validez, ou « Retour » pour corriger.'); return; }
      show(pts.length && curP ? `${nf(dist(pts[pts.length - 1], curP))} m` : '');
      const waited = performance.now() - since > 5000;
      if (state === 'start') say('Démarrage de la caméra…');
      else if (state === 'track') say(waited ? 'Suivi perdu : plus de lumière, bougez lentement.' : 'Bougez le téléphone de gauche à droite.');
      else if (state === 'search') say(waited ? 'Aucune surface : allumez, visez un sol ou un mur texturé.' : 'Visez le sol ou le mur, bougez un peu.');
      else if (pts.length === 0) say('Surface trouvée. Touchez « Point ».');
      else say(mode === 's' && pts.length === 2 ? 'Visez le 3e coin, touchez « Point ».' : 'Visez le point suivant, touchez « Point ».');
    };
    const setState = s => { if (s !== state) { state = s; since = performance.now(); if (s === 'hit' && !found) { found = true; buzz(10); } } };
    const finish = async (v) => {
      result = v;
      try { if (session) await session.end(); else done(); } catch (e) { done(); }
    };
    let closed = false;
    const done = () => {
      if (closed) return; closed = true;
      clearInterval(tick);
      ov.hidden = true; svg.innerHTML = ''; dots.innerHTML = '';
      bPt.onclick = bOk.onclick = bUndo.onclick = bCancel.onclick = null;
      bPt.disabled = false;
      resolve(result);
    };
    bPt.onclick = () => { if (!curP || pts.length >= need) return; pts.push({ ...curP }); buzz(15); refresh(); };
    bUndo.onclick = () => { pts.pop(); refresh(); };
    bCancel.onclick = () => finish(null);
    bOk.onclick = () => { const v = value(); if (v != null) finish({ value: Math.round(v * 100) / 100, unit: mode === 's' ? 'm²' : 'ml', pts: pts.length }); };
    ov.addEventListener('beforexrselect', e => e.preventDefault());
    const tick = setInterval(() => {
      if (!frames && performance.now() - since > 4000 && !err) err = 'la caméra ne renvoie pas d’image.';
      refresh();
    }, 250);

    let ref, hts;
    try {
      session = await navigator.xr.requestSession('immersive-ar', { requiredFeatures: ['hit-test', 'local'], optionalFeatures: ['dom-overlay'], domOverlay: { root: ov } });
    } catch (e) {
      clearInterval(tick); ov.hidden = true; resolve({ error: 'La caméra n’a pas pu démarrer (ARCore requis).' }); return;
    }
    session.addEventListener('end', done);
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl', { xrCompatible: true });
      if (gl.makeXRCompatible) await gl.makeXRCompatible();
      session.updateRenderState({ baseLayer: new XRWebGLLayer(session, gl) });
      ref = await session.requestReferenceSpace('local');
      const viewer = await session.requestReferenceSpace('viewer');
      try { hts = await session.requestHitTestSource({ space: viewer, entityTypes: ['plane', 'point'] }); }
      catch (e) { hts = await session.requestHitTestSource({ space: viewer }); }

      const onFrame = (t, frame) => {
        session.requestAnimationFrame(onFrame);
        frames++;
        try {
          const layer = session.renderState.baseLayer;
          gl.bindFramebuffer(gl.FRAMEBUFFER, layer.framebuffer);
          gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
          const pose = frame.getViewerPose(ref);
          if (!pose) { curP = null; setState('track'); return; }
          const hits = frame.getHitTestResults(hts);
          const hp = hits.length ? hits[0].getPose(ref) : null;
          if (hp) { const p = hp.transform.position; curP = { x: p.x, y: p.y, z: p.z }; } else curP = null;
          setState(curP ? 'hit' : pose.emulatedPosition ? 'track' : 'search');
          const view = pose.views[0];
          const M = mul(view.projectionMatrix, view.transform.inverse.matrix);
          const proj = p => {
            const x = M[0] * p.x + M[4] * p.y + M[8] * p.z + M[12], y = M[1] * p.x + M[5] * p.y + M[9] * p.z + M[13], w = M[3] * p.x + M[7] * p.y + M[11] * p.z + M[15];
            if (w <= 0.01) return null;
            return { x: (x / w + 1) * 50, y: (1 - y / w) * 50 };
          };
          const sp = pts.map(proj);
          let lines = '', ds = '';
          for (let i = 1; i < sp.length; i++) if (sp[i - 1] && sp[i]) {
            lines += `<line x1="${sp[i - 1].x}" y1="${sp[i - 1].y}" x2="${sp[i].x}" y2="${sp[i].y}"/>`;
            ds += `<div class="ar-lbl" style="left:${(sp[i - 1].x + sp[i].x) / 2}%;top:${(sp[i - 1].y + sp[i].y) / 2}%">${nf(dist(pts[i - 1], pts[i]))} m</div>`;
          }
          if (pts.length && pts.length < need && curP) {
            const a = sp[sp.length - 1];
            if (a) lines += `<line class="pre" x1="${a.x}" y1="${a.y}" x2="50" y2="50"/>`;
          }
          sp.forEach(s => { if (s) ds += `<div class="ar-dot" style="left:${s.x}%;top:${s.y}%"></div>`; });
          svg.innerHTML = lines; dots.innerHTML = ds;
          refresh();
        } catch (e) { err = e.message || String(e); }
      };
      session.requestAnimationFrame(onFrame);
    } catch (e) { err = e.message || String(e); }
    refresh();
  });
}
