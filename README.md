# Diagnostic polluants (prototype)

Application web hors ligne pour le diagnostic des polluants du bâtiment : préparation, repérage local par local, prélèvements avec étiquettes QR, résultats du laboratoire, stratégie par familles, synthèse rouge / bleu et rapport Word signé.

Prototype non officiel préparé pour Novacity. Aucune IA : saisie par listes de choix, règles écrites, textes types.

## Points de contrôle de l'expert
1. Préparation · 2. Fin de chaque local · 3. Fin de visite · 4. Résultats du labo · 5. Stratégie · 6. Rapport signé.
Chaque validation est horodatée dans un journal joint au rapport. Modifier une étape rouvre les suivantes.

## Utilisation
- Ouvrir l'adresse GitHub Pages sur le téléphone, puis « Ajouter à l'écran d'accueil ».
- Mesure par caméra : Chrome sur Android avec ARCore (WebXR). Ailleurs, saisie manuelle.
- Les données restent sur l'appareil (IndexedDB). Exporter les mandats (.json) pour les sauvegarder.
- Résultats du labo : import CSV `code ; analyse ; résultat ; valeur`.

## Fichiers
- `js/ref.js` : référentiel (polluants, matériaux, types de locaux, règles) à adapter.
- `js/store.js` : modèle de données et règles de stratégie.
- `js/report.js` : rapport Word (structure directive genevoise et cahier des charges ASCA).
- `js/ar.js` : métré par caméra.

Bibliothèques : [docx](https://github.com/dolanmiu/docx) (MIT), [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (MIT).
