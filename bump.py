"""Met à jour le numéro de version partout (imports, index.html, service worker). Usage : python3 bump.py 1.7"""
import re, sys, pathlib
v = sys.argv[1]; tag = v.replace('.', '')
root = pathlib.Path(__file__).parent
for f in (root / 'js').glob('*.js'):
    s = f.read_text(encoding='utf-8')
    s = re.sub(r"(from '\./[a-z]+\.js)(\?v=\d+)?'", rf"\1?v={tag}'", s)
    s = re.sub(r"(import\('\./[a-z]+\.js)(\?v=\d+)?'\)", rf"\1?v={tag}')", s)
    s = re.sub(r"const APP_V = '[^']+';", f"const APP_V = '{v}';", s)
    f.write_text(s, encoding='utf-8')
h = root / 'index.html'; s = h.read_text(encoding='utf-8')
s = re.sub(r'href="css/app\.css(\?v=\d+)?"', f'href="css/app.css?v={tag}"', s)
s = re.sub(r'src="js/app\.js(\?v=\d+)?"', f'src="js/app.js?v={tag}"', s)
s = re.sub(r'src="js/vendor/qrcode\.js(\?v=\d+)?"', f'src="js/vendor/qrcode.js?v={tag}"', s)
h.write_text(s, encoding='utf-8')
w = root / 'sw.js'; s = w.read_text(encoding='utf-8')
s = re.sub(r"const V = 'diagpol-v[^']+';", f"const V = 'diagpol-{tag}';", s)
s = re.sub(r"const T = '[^']*';", f"const T = '?v={tag}';", s)
w.write_text(s, encoding='utf-8')
print('version', v)
