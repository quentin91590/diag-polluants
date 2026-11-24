import json, numpy as np
from PIL import Image
from skimage import measure
meta = json.load(open('out/meta.json'))
OUT = '/home/claude/diag-polluants/scenes/'
for slug, info in meta.items():
    im = Image.open(f'out/{slug}.png').convert('RGB'); a = np.asarray(im).astype(int)
    bg = a[3, 3]; diff = np.abs(a - bg).sum(2) > 10
    ys, xs = np.where(diff); m = 28
    x0, y0 = max(0, xs.min() - m), max(0, ys.min() - m); x1, y1 = min(a.shape[1], xs.max() + m), min(a.shape[0], ys.max() + m)
    im.crop((x0, y0, x1, y1)).save(OUT + slug + '.jpg', 'JPEG', quality=86, optimize=True, progressive=True)
    regions = {}
    for tag in info['tags']:
        mk = np.asarray(Image.open(f'out/{slug}__{tag}.png').convert('L')) > 128
        mk = np.pad(mk, 1); parts = []; top = None; area_tot = 0
        for c in measure.find_contours(mk.astype(float), 0.5):
            if len(c) < 6: continue
            y, x = c[:, 0] - 1 - y0, c[:, 1] - 1 - x0
            area = 0.5 * abs(np.dot(x, np.roll(y, 1)) - np.dot(y, np.roll(x, 1)))
            if area < 60: continue
            area_tot += area
            p = measure.approximate_polygon(np.c_[x, y], tolerance=1.0)
            parts.append('M' + 'L'.join(f'{px:.0f},{py:.0f}' for px, py in p) + 'Z')
            i = int(np.argmin(y))
            if top is None or y[i] < top[1]: top = [round(float(x[i])), round(float(y[i]))]
        if parts: regions[tag] = {'d': ''.join(parts), 'top': top, 'big': tag in info['big']}
        else: print('  région vide', slug, tag)
    labels = [[round(x - x0), round(y - y0)] for x, y in info['labels']] if info['labels'] else None
    json.dump({'w': int(x1 - x0), 'h': int(y1 - y0), 'regions': regions, 'labels': labels}, open(OUT + slug + '.json', 'w'), separators=(',', ':'))
    print(slug, x1 - x0, 'x', y1 - y0, len(regions), 'régions')
