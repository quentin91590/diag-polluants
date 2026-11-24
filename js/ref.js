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

/* Polluants proposés selon l'année de construction (l'expert ajuste) */
export function polluantsProposes(annee) {
  const y = Number(annee) || 0;
  return {
    A: { on: !y || y < 1991, why: 'Bâtiment construit avant 1991' },
    PCB: { on: !y || y < 1976, why: 'Joints et mastics posés entre 1955 et 1975' },
    Pb: { on: !y || y < 2006, why: 'Peintures antérieures à 2006' },
    HAP: { on: !y || y < 1991, why: 'Colles noires, étanchéités bitumineuses' },
    HBCD: { on: !!y && y >= 1960 && y < 2016, why: 'Isolants en polystyrène (1960 à 2015)' }
  };
}

/* Matériaux : p = polluants recherchés, to = dernière année de pose typique, fc = fibrociment ou bitume de toiture (catégorie 2 CFST 6503) */
export const MAT = {
  'sol-dalle': { n: 'Revêtement de sol en dalles vinyle', p: ['A'], to: 1990, v: ['Dalle vinyle 30 × 30', 'Dalle vinyle 25 × 25', 'Dalle thermoplastique'], hint: 'Prélever la dalle et la colle séparément si les couches se séparent.' },
  'sol-rouleau': { n: 'Revêtement de sol en rouleau (envers carton)', p: ['A'], to: 1990, v: ['Lino / vinyle en rouleau', 'Cushion vinyl'], hint: 'L’envers en carton peut contenir de l’amiante faiblement aggloméré : vérifier l’état.' },
  'colle-sol': { n: 'Colle de revêtement de sol', p: ['A', 'HAP'], to: 1990, v: ['Colle noire', 'Colle beige', 'Colle grise'], hint: 'Sonder sous le revêtement : la colle noire peut contenir de l’amiante ou des HAP.' },
  'parquet-colle': { n: 'Colle de parquet', p: ['HAP', 'A'], to: 1990, v: ['Colle noire bitumineuse', 'Colle claire'], hint: 'Soulever une lame pour voir la colle.' },
  'colle-faience': { n: 'Colle de faïence ou de carrelage', p: ['A'], to: 1990, v: ['Colle grise', 'Colle blanche', 'Colle jaune'], hint: 'Prélever en déposant un carreau ou au niveau d’un carreau cassé.' },
  'joint-carrelage': { n: 'Mortier de joint de carrelage', p: ['A'], to: 1990, v: ['Joint gris', 'Joint blanc'] },
  'joint-sanitaire': { n: 'Joint souple sanitaire', p: ['PCB'], to: 1975, v: ['Joint élastique ancien', 'Joint silicone'], hint: 'Un joint refait après 1975 n’est pas suspect : le justifier.' },
  'enduit': { n: 'Enduit ou crépi intérieur', p: ['A'], to: 1990, v: ['Crépi rustique', 'Enduit lisse', 'Enduit projeté'] },
  'peinture': { n: 'Peinture murs et plafonds', p: ['Pb'], to: 2005, v: ['Peinture dispersion', 'Peinture à l’huile', 'Laque'], hint: 'Peinture antérieure à 2006 : peut être présumée contenir du plomb (directive genevoise).' },
  'peinture-boiseries': { n: 'Peinture des boiseries, radiateurs et métallerie', p: ['Pb', 'PCB'], to: 2005, v: ['Laque de boiserie', 'Peinture de radiateur', 'Minium (antirouille)'] },
  'faux-plafond': { n: 'Faux plafond (plaques)', p: ['A'], to: 1990, v: ['Plaques minérales', 'Plaques perforées'], hint: 'Ouvrir une plaque pour voir le plénum (flocage, calorifugeage).' },
  'flocage': { n: 'Flocage', p: ['A'], to: 1990, v: ['Flocage fibreux', 'Flocage pâteux'], hint: 'Matériau friable : vérifier l’état et l’exposition.' },
  'calorifugeage': { n: 'Calorifugeage de conduites', p: ['A'], to: 1990, v: ['Plâtre amianté', 'Carton ondulé', 'Coquille'], hint: 'Matériau souvent friable : noter l’état et les zones abîmées.' },
  'tresse': { n: 'Tresse ou joint de chaudière', p: ['A'], to: 1990, v: ['Tresse de porte de chaudière', 'Joint de foyer'] },
  'joint-bride': { n: 'Joint de bride', p: ['A'], to: 1990, v: ['Joint plat de bride'] },
  'conduit-fc': { n: 'Conduit en fibrociment', p: ['A'], to: 1990, fc: true, v: ['Conduit de ventilation', 'Conduit de fumée', 'Descente d’eaux'] },
  'plaque-fc': { n: 'Plaques en fibrociment', p: ['A'], to: 1990, fc: true, v: ['Plaque plane', 'Plaque ondulée', 'Bac à fleurs'] },
  'mastic-vitrage': { n: 'Mastic de vitrage', p: ['A', 'PCB'], to: 1990, v: ['Mastic dur', 'Mastic souple'] },
  'joint-fenetre': { n: 'Joint de fenêtre ou de façade (souple)', p: ['PCB', 'A'], to: 1975, v: ['Joint élastique de façade', 'Joint de dilatation'], hint: 'Joints posés entre 1955 et 1975 : PCB possibles.' },
  'appui-fenetre': { n: 'Tablette ou appui de fenêtre', p: ['A'], to: 1990, fc: true, v: ['Tablette fibrociment', 'Tablette pierre reconstituée'] },
  'carton-amiante': { n: 'Carton amianté (sous tablette, derrière tableau)', p: ['A'], to: 1990, v: ['Carton gris'] },
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

export const NIVEAUX = ['Sous-sol', 'Rez', '1er', '2e', '3e', '4e', '5e', 'Combles', 'Extérieur'];
export const ZONES = ['Sol', 'Plafond', 'Paroi A', 'Paroi B', 'Paroi C', 'Paroi D', 'Installation', 'Autre'];
export const ETATS = ['Bon', 'Dégradé', 'Très dégradé'];
export const UNITES = ['m²', 'ml', 'u'];

export const DECISIONS = {
  urgence: ['I', 'II', 'III', '–'],
  mesure: ['Retrait par entreprise spécialisée', 'Retrait avec protection', 'Protection pendant travaux', 'Maintien et contrôle', 'Aucune'],
  filiere: ['À définir', 'Déchets spéciaux', 'Décharge selon l’OLED', 'Selon la teneur mesurée', 'Non concerné']
};

/* Règles de stratégie appliquées (affichées et reprises dans le rapport) */
export const REGLES = [
  'Un résultat positif s’applique à tous les matériaux de la même famille.',
  'Un résultat négatif ne couvre que des matériaux identiques, confirmés par l’expert.',
  'Un matériau suspect non prélevé est présumé pollué.',
  'L’urgence est proposée selon l’état du matériau ; l’expert la fixe.',
  'Le niveau de protection du chantier suit la directive CFST 6503.',
  'La filière des déchets est fixée par l’expert selon l’OLED.'
];

export function checklistFor(type, annee, pol) {
  const y = Number(annee) || 0;
  return (TYPES[type] || TYPES['Autre']).filter(k => {
    const m = MAT[k];
    if (y && y > m.to) return false;
    return m.p.some(p => pol[p]);
  });
}
