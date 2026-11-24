export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const nowIso = () => new Date().toISOString();
export const fdt = iso => iso ? new Date(iso).toLocaleString('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
export const fd = iso => iso ? new Date(iso).toLocaleDateString('fr-CH') : '';
export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
export const pad = (n, l = 3) => String(n).padStart(l, '0');
export const parseNum = s => { if (s == null || s === '') return null; const v = parseFloat(String(s).replace(/['’\s]/g, '').replace(',', '.')); return isNaN(v) ? null : v; };
export const nf = (n, d = 2) => (n == null || isNaN(n)) ? '' : Number(n).toLocaleString('fr-CH', { maximumFractionDigits: d });
export const NB = ' ';

export function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}

let toastT;
export function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2400);
}

export function buzz(ms = 12) { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { /* rien */ } }

/* Feuille modale : renvoie une promesse résolue avec la valeur du bouton choisi (ou null) */
export function sheet(html, onMount) {
  return new Promise(res => {
    const bg = $('#sheet-bg'), sh = $('#sheet');
    sh.innerHTML = html; bg.hidden = false; sh.hidden = false;
    requestAnimationFrame(() => { bg.classList.add('on'); sh.classList.add('on'); });
    const close = v => {
      bg.classList.remove('on'); sh.classList.remove('on');
      setTimeout(() => { bg.hidden = true; sh.hidden = true; sh.innerHTML = ''; }, 320);
      bg.onclick = null; res(v);
    };
    bg.onclick = () => close(null);
    sh.onclick = e => { const b = e.target.closest('[data-close]'); if (b) close(b.dataset.close); };
    if (onMount) onMount(sh, close);
  });
}

export async function confirmSheet(title, text, okLabel = 'Confirmer', danger = false) {
  const v = await sheet(`<h2>${esc(title)}</h2><p class="muted">${esc(text)}</p><div class="row"><button class="btn grow" data-close="0" type="button">Annuler</button><button class="btn ${danger ? 'danger' : 'pri'} grow" data-close="1" type="button">${esc(okLabel)}</button></div>`);
  return v === '1';
}

/* Effet d'onde au toucher */
export function ripple(e) {
  const b = e.target.closest('.btn,.chip,.li');
  if (!b) return;
  const r = b.getBoundingClientRect(), s = Math.max(r.width, r.height) * 2;
  const i = document.createElement('span'); i.className = 'rip';
  i.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX - r.left - s / 2}px;top:${e.clientY - r.top - s / 2}px`;
  if (getComputedStyle(b).position === 'static') b.style.position = 'relative';
  b.appendChild(i); setTimeout(() => i.remove(), 600);
}

/* Réduction d'une photo prise avec l'appareil */
export async function shrink(file, max = 1600, q = 0.78) {
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch (e) { bmp = await createImageBitmap(file); }
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise(ok => c.toBlob(b => ok(b), 'image/jpeg', q));
}

export const blobToB64 = b => new Promise(ok => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.readAsDataURL(b); });
export const b64ToBlob = (s, type = 'image/jpeg') => { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type }); };

export function qrSvg(text) {
  if (typeof window.qrcode !== 'function') return '';
  const q = window.qrcode(0, 'M'); q.addData(text); q.make();
  return q.createSvgTag({ cellSize: 4, margin: 1, scalable: true });
}
