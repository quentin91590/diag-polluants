# Maquettes 3/4 des locaux

Une scène three.js par type de local (`scenes.html`). Chaque objet porte la clé du matériau (`MAT` dans `js/ref.js`).

1. `npm install three@0.160.0` dans ce dossier, puis `python3 -m http.server 8766`.
2. `python3 render_all.py masks` : image et silhouette de chaque matériau, dans `out/`.
3. `python3 export_scenes.py` : images recadrées et contours SVG dans `../../scenes/`.
