# Diagnostic polluants (prototype)

Application web hors ligne pour le diagnostic des polluants du bâtiment : préparation, repérage local par local, prélèvements avec étiquettes QR, résultats du laboratoire, stratégie par familles, synthèse rouge / bleu et rapport Word signé.

Prototype non officiel préparé pour Novacity. Aucune IA : saisie par listes de choix, règles écrites, textes types.

## Points de contrôle de l'expert
1. Préparation · 2. Fin de chaque local · 3. Fin de visite · 4. Résultats du labo · 5. Stratégie · 6. Rapport signé.
Chaque validation est horodatée dans un journal joint au rapport. Modifier une étape rouvre les suivantes.

## Cadre suisse pris en compte
- OTConst art. 3 et directive cantonale : canton et année seuil (GE et VD 1991, FR 1993, NE 1994).
- Directive CFST 6503 : code Suva vert / orange / rouge par famille amiantée, catégorie de chantier.
- FACH 2891 : degré d'urgence I à III pour l'amiante.
- FACH 2955 : libération des zones (contrôle visuel, mesure VDI 3492, seuil 1000 FAR/m³).
- OLED art. 16 : filière par famille, plan d'élimination ; PCB > 50 mg/kg et HAP > 1000 mg/kg en déchets spéciaux.
- OFSP : PCB dans l'air, 6 µg/m³ (journée) et 2 µg/m³ (longue durée).

## Utilisation
- Ouvrir l'adresse GitHub Pages sur le téléphone, puis « Ajouter à l'écran d'accueil ».
- Adresse : recherche au fil de la frappe dans le RegBL (EGID, année, niveaux, logements, canton).
- Quantités saisies à la main.
- Les données restent sur l'appareil (IndexedDB). Exporter les mandats (.json) pour les sauvegarder.
- Résultats du labo : import CSV `code ; analyse ; résultat ; valeur`.

## Fichiers
- `js/ref.js` : référentiel (polluants, matériaux, types de locaux, règles) à adapter.
- `js/store.js` : modèle de données et règles de stratégie.
- `demo/immeuble-test.json` : immeuble test complet (photos générées avec SD-Turbo, Stability AI).
- `js/report.js` : rapport Word (structure directive genevoise et cahier des charges ASCA).

Bibliothèques : [docx](https://github.com/dolanmiu/docx) (MIT), [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (MIT).
- jsQR (Apache 2.0) : lecture des QR codes des étiquettes (`js/vendor/jsqr.js`, `js/scan.js`).
