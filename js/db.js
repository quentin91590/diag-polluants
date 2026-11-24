/* Stockage local (IndexedDB) : les mandats et leurs photos restent sur l'appareil */
let dbp;
function db() {
  return dbp ??= new Promise((ok, ko) => {
    const r = indexedDB.open('diagpol', 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      d.createObjectStore('mandats', { keyPath: 'id' });
      const p = d.createObjectStore('photos', { keyPath: 'id' });
      p.createIndex('mid', 'mid');
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  });
}
async function tx(store, mode, fn) {
  const d = await db();
  return new Promise((ok, ko) => {
    const t = d.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => ok(req ? req.result : undefined);
    t.onerror = () => ko(t.error);
    t.onabort = () => ko(t.error);
  });
}
export const getAll = store => tx(store, 'readonly', s => s.getAll());
export const get = (store, key) => tx(store, 'readonly', s => s.get(key));
export const put = (store, val) => tx(store, 'readwrite', s => s.put(val));
export const del = (store, key) => tx(store, 'readwrite', s => s.delete(key));
export const photosOf = mid => tx('photos', 'readonly', s => s.index('mid').getAll(mid));
export async function delPhotosOf(mid) {
  const ps = await photosOf(mid);
  for (const p of ps) await del('photos', p.id);
}
