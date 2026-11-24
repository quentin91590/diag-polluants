/* Référentiel : polluants, matériaux suspects et types de locaux.
   À caler avec Novacity pendant le cadrage : ce fichier est fait pour être modifié sans toucher au reste. */

export const POL = {
  A: { n: 'Amiante', lab: 'Amiante' },
  PCB: { n: 'PCB', lab: 'PCB' },
  Pb: { n: 'Plomb', lab: 'Plomb' },
  HAP: { n: 'HAP', lab: 'HAP' },
  HBCD: { n: 'HBCD', lab: 'HBCD' }
};
export const POL_KEYS = Object.keys(POL);

/* Cantons : année de construction en dessous de laquelle le diagnostic est exigé avant travaux */
export const CANTONS = {
  GE: { n: 'Genève', seuil: 1991, ref: 'Directive SABRA, diagnostic avant travaux' },
  VD: { n: 'Vaud', seuil: 1991, ref: 'Art. 103a LATC et art. 3 OTConst' },
  FR: { n: 'Fribourg', seuil: 1993, ref: 'Aide à l’exécution cantonale' },
  NE: { n: 'Neuchâtel', seuil: 1994, ref: 'Loi sur les constructions (2014)' },
  CH: { n: 'Autre', seuil: 1990, ref: 'OTConst art. 3 (amiante interdit depuis 1990)' }
};

/* Polluants proposés selon l'année de construction et le canton (l'expert ajuste) */
export function polluantsProposes(annee, canton = 'GE') {
  const y = Number(annee) || 0, s = (CANTONS[canton] || CANTONS.CH).seuil;
  return {
    A: { on: !y || y < s, why: `Bâtiment construit avant ${s}` },
    PCB: { on: !y || y < 1986, why: 'Joints et mastics, surtout 1955 à 1975' },
    Pb: { on: !y || y < 2006, why: 'Peintures antérieures à 2006' },
    HAP: { on: !y || y < s, why: 'Colles noires, étanchéités bitumineuses' },
    HBCD: { on: !!y && y >= 1960 && y < 2016, why: 'Isolants en polystyrène (1960 à 2015)' }
  };
}

/* Matériaux : p = polluants recherchés, to = dernière année de pose typique, fc = fibrociment ou bitume de toiture (catégorie 2), fa = amiante faiblement aggloméré (code Suva rouge) */
export const MAT = {
  'sol-dalle': { n: 'Revêtement de sol en dalles vinyle', p: ['A'], to: 1990, v: ['Dalle vinyle 30 × 30', 'Dalle vinyle 25 × 25', 'Dalle thermoplastique'], hint: 'Prélever la dalle et la colle séparément si les couches se séparent.' },
  'sol-rouleau': { n: 'Revêtement de sol en rouleau (envers carton)', fa: true, p: ['A'], to: 1990, v: ['Lino / vinyle en rouleau', 'Cushion vinyl'], hint: 'L’envers en carton peut contenir de l’amiante faiblement aggloméré : vérifier l’état.' },
  'colle-sol': { n: 'Colle de revêtement de sol', p: ['A', 'HAP'], to: 1990, v: ['Colle noire', 'Colle beige', 'Colle grise'], hint: 'Sonder sous le revêtement : la colle noire peut contenir de l’amiante ou des HAP.' },
  'parquet-colle': { n: 'Colle de parquet', p: ['HAP', 'A'], to: 1990, v: ['Colle noire bitumineuse', 'Colle claire'], hint: 'Soulever une lame pour voir la colle.' },
  'colle-faience': { n: 'Colle de faïence ou de carrelage', p: ['A'], to: 1990, v: ['Colle grise', 'Colle blanche', 'Colle jaune'], hint: 'Prélever en déposant un carreau ou au niveau d’un carreau cassé.' },
  'joint-carrelage': { n: 'Mortier de joint de carrelage', p: ['A'], to: 1990, v: ['Joint gris', 'Joint blanc'] },
  'joint-sanitaire': { n: 'Joint souple sanitaire', p: ['PCB'], to: 1975, v: ['Joint élastique ancien', 'Joint silicone'], hint: 'Un joint refait après 1975 n’est pas suspect : le justifier.' },
  'enduit': { n: 'Enduit ou crépi intérieur', p: ['A'], to: 1990, v: ['Crépi rustique', 'Enduit lisse', 'Enduit projeté'] },
  'peinture': { n: 'Peinture murs et plafonds', p: ['Pb'], to: 2005, v: ['Peinture dispersion', 'Peinture à l’huile', 'Laque'], hint: 'Peinture antérieure à 2006 : peut être présumée contenir du plomb (directive genevoise).' },
  'peinture-boiseries': { n: 'Peinture des boiseries, radiateurs et métallerie', p: ['Pb', 'PCB'], to: 2005, v: ['Laque de boiserie', 'Peinture de radiateur', 'Minium (antirouille)'] },
  'faux-plafond': { n: 'Faux plafond (plaques)', p: ['A'], to: 1990, v: ['Plaques minérales', 'Plaques perforées'], hint: 'Ouvrir une plaque pour voir le plénum (flocage, calorifugeage).' },
  'flocage': { n: 'Flocage', fa: true, p: ['A'], to: 1990, v: ['Flocage fibreux', 'Flocage pâteux'], hint: 'Matériau friable : vérifier l’état et l’exposition.' },
  'calorifugeage': { n: 'Calorifugeage de conduites', fa: true, p: ['A'], to: 1990, v: ['Plâtre amianté', 'Carton ondulé', 'Coquille'], hint: 'Matériau souvent friable : noter l’état et les zones abîmées.' },
  'tresse': { n: 'Tresse ou joint de chaudière', p: ['A'], to: 1990, v: ['Tresse de porte de chaudière', 'Joint de foyer'] },
  'joint-bride': { n: 'Joint de bride', p: ['A'], to: 1990, v: ['Joint plat de bride'] },
  'conduit-fc': { n: 'Conduit en fibrociment', p: ['A'], to: 1990, fc: true, v: ['Conduit de ventilation', 'Conduit de fumée', 'Descente d’eaux'] },
  'plaque-fc': { n: 'Plaques en fibrociment', p: ['A'], to: 1990, fc: true, v: ['Plaque plane', 'Plaque ondulée', 'Bac à fleurs'] },
  'mastic-vitrage': { n: 'Mastic de vitrage', p: ['A', 'PCB'], to: 1990, v: ['Mastic dur', 'Mastic souple'] },
  'joint-fenetre': { n: 'Joint de fenêtre ou de façade (souple)', p: ['PCB', 'A'], to: 1975, v: ['Joint élastique de façade', 'Joint de dilatation'], hint: 'Joints posés entre 1955 et 1975 : PCB possibles.' },
  'appui-fenetre': { n: 'Tablette ou appui de fenêtre', p: ['A'], to: 1990, fc: true, v: ['Tablette fibrociment', 'Tablette pierre reconstituée'] },
  'carton-amiante': { n: 'Carton amianté (sous tablette, derrière tableau)', fa: true, p: ['A'], to: 1990, v: ['Carton gris'] },
  'tableau-elec': { n: 'Panneau de tableau électrique', p: ['A'], to: 1990, v: ['Panneau isolant', 'Arc-électrique'] },
  'condensateur': { n: 'Condensateurs (luminaires anciens)', p: ['PCB'], to: 1985, v: ['Ballast de tube fluorescent'] },
  'porte-cf': { n: 'Porte coupe-feu', p: ['A'], to: 1990, v: ['Âme de porte', 'Joint de porte'] },
  'crepi-facade': { n: 'Crépi de façade', p: ['A', 'Pb'], to: 1990, v: ['Crépi rustique', 'Crépi lisse'] },
  'etancheite': { n: 'Étanchéité bitumineuse', p: ['HAP', 'A'], to: 1990, fc: true, v: ['Lé de toiture', 'Étanchéité de terrasse', 'Barrière vapeur'] },
  'ardoise-fc': { n: 'Couverture en fibrociment', p: ['A'], to: 1990, fc: true, v: ['Ardoises fibrociment', 'Plaques ondulées'] },
  'isolant-ps': { n: 'Isolant en polystyrène', p: ['HBCD'], to: 2015, v: ['EPS (blanc)', 'XPS (coloré)'] },
  'autre': { n: 'Autre matériau', p: ['A'], to: 2100, v: [] }
};

export const TYPES = {
  'Salle de bain': ['sol-dalle', 'colle-sol', 'colle-faience', 'joint-carrelage', 'joint-sanitaire', 'conduit-fc', 'peinture', 'mastic-vitrage'],
  'Cuisine': ['sol-dalle', 'colle-sol', 'colle-faience', 'joint-carrelage', 'conduit-fc', 'peinture', 'mastic-vitrage'],
  'Séjour / chambre': ['sol-rouleau', 'colle-sol', 'parquet-colle', 'enduit', 'peinture', 'peinture-boiseries', 'mastic-vitrage', 'appui-fenetre'],
  'Hall / escalier': ['sol-dalle', 'colle-sol', 'faux-plafond', 'enduit', 'peinture', 'porte-cf', 'tableau-elec'],
  'Chaufferie': ['calorifugeage', 'tresse', 'joint-bride', 'conduit-fc', 'flocage', 'peinture-boiseries', 'porte-cf'],
  'Cave / sous-sol': ['calorifugeage', 'flocage', 'plaque-fc', 'peinture', 'isolant-ps'],
  'Local technique / électrique': ['tableau-elec', 'carton-amiante', 'condensateur', 'calorifugeage'],
  'Combles': ['isolant-ps', 'plaque-fc', 'calorifugeage'],
  'Façade': ['crepi-facade', 'joint-fenetre', 'mastic-vitrage', 'appui-fenetre', 'plaque-fc', 'isolant-ps'],
  'Toiture': ['ardoise-fc', 'etancheite', 'isolant-ps'],
  'Autre': ['enduit', 'peinture', 'sol-dalle']
};

/* Diagnostiqueurs proposés (liste à compléter) */
export const DIAGNOSTIQUEURS = ['Auditeur 1'];

export const NIVEAUX = ['Sous-sol', 'Rez', '1er', '2e', '3e', '4e', '5e', 'Combles', 'Extérieur'];
export const ZONES = ['Sol', 'Plafond', 'Paroi A', 'Paroi B', 'Paroi C', 'Paroi D', 'Installation', 'Autre'];
export const ETATS = ['Bon', 'Dégradé', 'Très dégradé'];
export const UNITES = ['m²', 'ml', 'u'];

export const DECISIONS = {
  mesure: ['Retrait avant travaux, entreprise reconnue Suva', 'Retrait avant travaux, mesures de protection Suva', 'Protection pendant les travaux', 'Maintien et contrôle', 'Aucune'],
  filiere: ['À définir', 'Déchets spéciaux', 'Déchets soumis à contrôle', 'Incinération (UVTD)', 'Décharge selon l’OLED', 'Non concerné']
};

/* Degré d'urgence pour l'amiante (FACH 2891 « Amiante dans les locaux ») */
export const URGENCE = {
  I: 'Assainissement immédiat',
  II: 'Réévaluer tous les 2 à 5 ans',
  III: 'Prendre note de la nécessité d’un assainissement'
};

/* Code couleur Suva (directive CFST 6503) */
export const SUVA = {
  vert: { n: 'Vert', t: 'Pas de danger immédiat' },
  orange: { n: 'Orange', t: 'Mesures de protection spécifiques' },
  rouge: { n: 'Rouge', t: 'Entreprise de désamiantage reconnue Suva' }
};

/* Valeurs de référence */
export const SEUILS = {
  liberation: 1000,  /* FAR/m³, mesure libératoire VDI 3492 */
  pcbAirJour: 6,     /* µg/m³, locaux occupés la journée (OFSP) */
  pcbAirLong: 2,     /* µg/m³, séjour de longue durée (OFSP) */
  pcbDechet: 50,     /* mg/kg : élément contaminé, déchets spéciaux */
  hapSpecial: 1000,  /* mg/kg : déchets spéciaux */
  hapControle: 250   /* mg/kg : déchets soumis à contrôle */
};

/* Règles de stratégie appliquées (affichées et reprises dans le rapport) */
export const REGLES = [
  'Un résultat positif s’applique à tous les matériaux de la même famille.',
  'Un résultat négatif ne couvre que des matériaux identiques, confirmés par l’expert.',
  'Un matériau suspect non prélevé est présumé pollué.',
  'Amiante : degré d’urgence I à III fixé par l’expert (FACH 2891).',
  'Amiante faiblement aggloméré : code Suva rouge, entreprise reconnue (CFST 6503).',
  'PCB au-delà de 50 mg/kg : élément contaminé, déchets spéciaux.',
  'HAP au-delà de 1000 mg/kg : déchets spéciaux ; de 250 à 1000 mg/kg : déchets soumis à contrôle.',
  'Filière des déchets fixée par l’expert selon l’OLED.'
];

/* Cadre réglementaire (affiché dans l'appli et repris dans le rapport) */
export const BASES = [
  ['OTConst art. 3', 'Identifier et évaluer les dangers avant les travaux'],
  ['OLED art. 16', 'Diagnostic des polluants et plan d’élimination des déchets'],
  ['Directive CFST 6503', 'Protection des travailleurs, désamiantage, libération des zones'],
  ['Cahier des charges ASCA', 'Méthode et structure du rapport'],
  ['FACH 2891', 'Degré d’urgence I à III (amiante dans les locaux)'],
  ['FACH 2955', 'Contrôle visuel et mesure libératoire (VDI 3492)'],
  ['OFSP, PCB', 'Valeurs indicatives dans l’air intérieur'],
  ['Directive cantonale', 'GE, VD, FR, NE : exigences propres']
];

export function checklistFor(type, annee, pol) {
  const y = Number(annee) || 0;
  return (TYPES[type] || TYPES['Autre']).filter(k => {
    const m = MAT[k];
    if (y && y > m.to) return false;
    return m.p.some(p => pol[p]);
  });
}
