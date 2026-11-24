/* Lecture de QR code : caméra arrière (BarcodeDetector si présent, sinon jsQR), ou photo si la caméra est refusée. */
import { buzz } from './util.js?v=116';

let libP = null;
const loadLib = () => libP ||= new Promise((ok, ko) => {
  if (window.jsQR) return ok(window.jsQR);
  const s = document.createElement('script');
  s.src = 'js/vendor/jsqr.js?v=116';
  s.onload = () => ok(window.jsQR); s.onerror = () => ko(new Error('Lecteur QR indisponible'));
  document.head.appendChild(s);
});

function decodeCanvas(jsQR, ctx, w, h) {
  const d = ctx.getImageData(0, 0, w, h);
  const r = jsQR(d.data, w, h, { inversionAttempts: 'attemptBoth' });
  return r ? r.data : null;
}

async function fromFile(file) {
  const jsQR = await loadLib();
  const bm = await createImageBitmap(file);
  const k = Math.min(1, 1200 / Math.max(bm.width, bm.height));
  const c = document.createElement('canvas'); c.width = Math.round(bm.width * k); c.height = Math.round(bm.height * k);
  const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(bm, 0, 0, c.width, c.height);
  return decodeCanvas(jsQR, ctx, c.width, c.height);
}

export function scanQR(title = 'Scanner une étiquette') {
  return new Promise(async (resolve) => {
    const ov = document.createElement('div');
    ov.className = 'scan-ov';
    ov.innerHTML = `
      <video playsinline muted autoplay></video>
      <div class="scan-frame"><i></i><i></i><i></i><i></i></div>
      <div class="scan-top"><b>${title}</b><span class="scan-msg">Ouverture de la caméra…</span></div>
      <div class="scan-bot"><button type="button" class="scan-b" data-a="photo">Photo</button><button type="button" class="scan-b pri" data-a="cancel">Annuler</button></div>
      <input type="file" accept="image/*" capture="environment" hidden>`;
    document.body.appendChild(ov);
    const vid = ov.querySelector('video'), msg = ov.querySelector('.scan-msg'), inp = ov.querySelector('input');
    let stream = null, stop = false;
    const close = v => {
      stop = true;
      if (stream) stream.getTracks().forEach(t => t.stop());
      ov.classList.add('out'); setTimeout(() => ov.remove(), 200);
      resolve(v);
    };
    ov.querySelector('[data-a=cancel]').onclick = () => close(null);
    ov.querySelector('[data-a=photo]').onclick = () => inp.click();
    inp.onchange = async () => {
      const f = inp.files[0]; inp.value = ''; if (!f) return;
      msg.textContent = 'Lecture de la photo…';
      try { const t = await fromFile(f); if (t) { buzz(30); close(t); } else msg.textContent = 'Aucun QR code lisible sur cette photo.'; }
      catch (e) { msg.textContent = e.message; }
    };

    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    } catch (e) {
      msg.textContent = 'Caméra indisponible : touchez « Photo ».';
      ov.classList.add('nocam');
      return;
    }
    if (stop) { stream.getTracks().forEach(t => t.stop()); return; }
    vid.srcObject = stream;
    await vid.play().catch(() => {});
    msg.textContent = 'Visez le QR code du sachet.';

    let det = null;
    try { if ('BarcodeDetector' in window && (await BarcodeDetector.getSupportedFormats()).includes('qr_code')) det = new BarcodeDetector({ formats: ['qr_code'] }); } catch (e) { det = null; }
    let jsQR = null;
    if (!det) { try { jsQR = await loadLib(); } catch (e) { msg.textContent = e.message; return; } }
    const c = document.createElement('canvas'), ctx = c.getContext('2d', { willReadFrequently: true });

    const tick = async () => {
      if (stop) return;
      try {
        if (vid.readyState >= 2 && vid.videoWidth) {
          let t = null;
          if (det) { const r = await det.detect(vid); t = r.length ? r[0].rawValue : null; }
          else {
            const k = Math.min(1, 640 / Math.max(vid.videoWidth, vid.videoHeight));
            c.width = Math.round(vid.videoWidth * k); c.height = Math.round(vid.videoHeight * k);
            ctx.drawImage(vid, 0, 0, c.width, c.height);
            t = decodeCanvas(jsQR, ctx, c.width, c.height);
          }
          if (t) { buzz(30); close(t); return; }
        }
      } catch (e) { /* image suivante */ }
      setTimeout(tick, 120);
    };
    tick();
  });
}
