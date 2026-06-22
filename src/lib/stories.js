// src/lib/stories.js
// Recits guides : quelques cas de consanguinite royale racontes pas a pas,
// avec la camera du graphe qui se deplace automatiquement sur les personnes
// concernees a chaque etape.
//
// Note : les noms ci-dessous sont les libelles attendus tels qu'issus de
// Wikidata. Si l'orthographe exacte differe legerement dans tes donnees,
// resolveStoryPeople() tente une correspondance approchee, et signale dans
// la console toute personne introuvable -- a verifier et ajuster au besoin.

export const STORIES = [
  {
    id: "charles-ii",
    title: "L'extinction des Habsbourg d'Espagne",
    summary: "Quatre generations de mariages consanguins, jusqu'a l'incapacite physique et la mort sans descendance de Charles II.",
    steps: [
      {
        title: "Un premier mariage entre cousins",
        text: "En 1548, Maximilien, futur empereur, epouse sa cousine germaine Marie d'Espagne, fille de Charles Quint. Une union dictee par la diplomatie : garder le pouvoir habsbourgeois uni entre les branches autrichienne et espagnole de la famille.",
        people: ["Maximilien II du Saint-Empire", "Marie d'Autriche"],
      },
      {
        title: "La pratique se repete",
        text: "Deux generations plus tard, Philippe III d'Espagne epouse a son tour sa cousine, Marguerite d'Autriche-Styrie. Le schema se reproduit presque a l'identique a chaque generation.",
        people: ["Philippe III d'Espagne", "Marguerite d'Autriche-Styrie"],
      },
      {
        title: "Un oncle epouse sa niece",
        text: "Philippe IV d'Espagne va plus loin : il epouse sa propre niece, Marie-Anne d'Autriche, fille de sa soeur. Leur fils, Charles II, herite d'un patrimoine genetique parmi les plus consanguins jamais documentes dans une famille royale europeenne.",
        people: ["Philippe IV d'Espagne", "Marie-Anne d'Autriche"],
      },
      {
        title: "Charles II, l'aboutissement",
        text: "Charles II souffre de multiples handicaps physiques et d'infertilite, documentes par les medecins de l'epoque. Surnomme \u00ab l'Ensorcele \u00bb, il meurt en 1700 sans descendance, mettant fin a la branche espagnole des Habsbourg et declenchant la guerre de Succession d'Espagne.",
        people: ["Charles II d'Espagne"],
      },
    ],
  },
  {
    id: "victoria-hemophilia",
    title: "L'hemophilie de la reine Victoria",
    summary: "Comment une mutation genetique chez une seule reine s'est propagee jusqu'aux trones d'Espagne et de Russie.",
    steps: [
      {
        title: "Un mariage entre cousins germains",
        text: "En 1840, la reine Victoria epouse son cousin germain, le prince Albert de Saxe-Cobourg-Gotha. Rien dans cette union, en apparence, ne laisse presager ce qui va suivre.",
        people: ["Victoria", "Albert de Saxe-Cobourg-Gotha"],
      },
      {
        title: "Une mutation inattendue",
        text: "Victoria est porteuse d'une mutation genetique a l'origine de l'hemophilie, une maladie alors mal comprise. Son fils Leopold, duc d'Albany, en est atteint ; plusieurs de ses filles, sans symptomes elles-memes, en sont porteuses.",
        people: ["Léopold de Saxe-Cobourg-Gotha"],
      },
      {
        title: "Vers le trone d'Espagne",
        text: "Une petite-fille de Victoria, Victoria-Eugenie de Battenberg, epouse le roi Alphonse XIII d'Espagne. Deux de leurs fils heritent de la maladie, fragilisant durablement la perception de la monarchie espagnole.",
        people: ["Alphonse XIII d'Espagne", "Victoire-Eugénie de Battenberg"],
      },
      {
        title: "Vers le trone de Russie",
        text: "Une autre lignee descendant de Victoria mene au tsarevitch Alexis de Russie, fils unique de Nicolas II. Sa maladie, tenue secrete, ouvre la porte a l'influence de Raspoutine a la cour -- un facteur parmi ceux qui contribueront a la chute des Romanov.",
        people: ["Nicolas II de Russie", "Alix de Hesse-Darmstadt", "Alexis Nikolaïevitch de Russie"],
      },
    ],
  },
  {
    id: "francois-ferdinand",
    title: "François-Ferdinand et l'attentat de Sarajevo",
    summary: "L'archiduc héritier d'Autriche-Hongrie, sa femme morganatique Sophie Chotek, et l'assassinat qui déclencha la Première Guerre mondiale.",
    steps: [
      {
        title: "Un héritier inattendu",
        text: "François-Ferdinand n'était pas destiné au trône. C'est le suicide de l'archiduc Rodolphe en 1889, puis la mort de son propre père en 1896, qui font de lui l'héritier de l'empire austro-hongrois. Il est le neveu de l'empereur François-Joseph Ier.",
        people: ["François-Ferdinand d'Autriche", "François-Joseph Ier d'Autriche"],
      },
      {
        title: "Un mariage morganatique",
        text: "En 1900, François-Ferdinand épouse Sophie Chotek, une comtesse tchèque jugée de rang insuffisant pour la famille impériale. L'empereur n'approuve l'union qu'à condition que leurs enfants renoncent à tout droit au trône — un mariage dit morganatique, qui exclut la descendance de la succession.",
        people: ["François-Ferdinand d'Autriche", "Sophie Chotek"],
      },
      {
        title: "L'attentat de Sarajevo",
        text: "Le 28 juin 1914, François-Ferdinand et Sophie sont assassinés à Sarajevo par Gavrilo Princip, un nationaliste serbe de Bosnie. Leur mort déclenche, par le jeu des alliances européennes, la Première Guerre mondiale — le conflit le plus meurtrier qu'ait connu l'Europe jusqu'alors.",
        people: ["François-Ferdinand d'Autriche", "Sophie Chotek"],
      },
    ],
  },
  {
    id: "isabelle-ii",
    title: "Isabelle II et le cas le plus consanguin d'Espagne",
    summary: "Le mariage le plus consanguin de toute notre base de données : deux cousins issus de germains, unis par calcul dynastique, dont la descendance régna jusqu'au XXe siècle.",
    steps: [
      {
        title: "Une union calculée",
        text: "En 1846, la reine Isabelle II d'Espagne épouse son cousin François d'Assise de Bourbon. Tous deux descendent de Charles IV d'Espagne — lui par son père, elle par sa mère. Avec un coefficient de parenté de 0,235, c'est l'union la plus consanguine de toute notre base de données, dépassant même les cas les plus extrêmes des Habsbourg.",
        people: ["Isabelle II d'Espagne", "François d'Assise de Bourbon"],
      },
      {
        title: "Un mariage politique avant tout",
        text: "Ce mariage était avant tout le résultat de manœuvres diplomatiques entre les puissances européennes, chacune cherchant à placer un candidat favorable sur le trône d'Espagne. La consanguinité n'était pas un frein — elle était même perçue comme une garantie de stabilité dynastique.",
        people: ["Isabelle II d'Espagne", "François d'Assise de Bourbon"],
      },
      {
        title: "Une descendance qui régna",
        text: "Malgré les doutes sur la paternité de certains enfants — François d'Assise et Isabelle II vivaient quasi séparés — leur fils Alphonse XII monta sur le trône en 1875, fondant la lignée qui règne encore aujourd'hui en Espagne avec Felipe VI.",
        people: ["Isabelle II d'Espagne", "Alphonse XII d'Espagne"],
      },
    ],
  },
  {
    id: "bragance",
    title: "Les mariages consanguins de la maison de Bragance",
    summary: "Au XVIIIe siècle, la famille royale portugaise pousse la consanguinité à l'extrême : une reine épouse son propre oncle, et leur fille réitère le même schéma.",
    steps: [
      {
        title: "Une reine épouse son oncle",
        text: "En 1760, Marie Ire de Portugal épouse Pierre III de Portugal — son propre oncle paternel, frère de son père le roi José Ier. Cette union, bénie par l'Église sous dispense papale, produit un coefficient de parenté de 0,144 — équivalent à celui d'un mariage entre demi-frère et demi-sœur.",
        people: ["Marie Ire de Portugal", "Pierre III de Portugal"],
      },
      {
        title: "Le schéma se répète à la génération suivante",
        text: "Leur fille Marie-Bénédicte de Portugal épouse à son tour un cousin très proche : l'Infant José, Prince du Brésil, fils aîné de Marie Ire et donc son propre frère aîné. Avec un coefficient de 0,201, c'est l'union la plus consanguine de toute la maison de Bragance — et l'une des plus extrêmes de notre base de données.",
        people: ["Marie-Bénédicte de Portugal", "Infant José, Prince du Brésil"],
      },
      {
        title: "Une tradition dynastique assumée",
        text: "Ces unions n'étaient pas des accidents — elles reflétaient une stratégie délibérée de la cour portugaise pour concentrer le pouvoir et les héritages au sein de la famille royale, à l'image de ce que pratiquaient simultanément les Habsbourg en Espagne et les Bourbon en France.",
        people: ["Marie Ire de Portugal", "Marie-Bénédicte de Portugal"],
      },
    ],
  },
  {
    id: "trois-cousins-1914",
    title: "Les trois cousins de 1914",
    summary: "Wilhelm II, George V et Nicolas II étaient tous petits-fils de la reine Victoria. Ils s'appelaient Willy, Georgie et Nicky — et finirent par s'envoyer leurs armées.",
    steps: [
      {
        title: "Une grand-mère pour toute l'Europe",
        text: "La reine Victoria (1819–1901) eut neuf enfants, mariés dans presque toutes les cours d'Europe. Ses petits-fils Guillaume II d'Allemagne, George V de Grande-Bretagne et Nicolas II de Russie se retrouvèrent simultanément à la tête des trois plus grandes puissances du continent.",
        people: ["Victoria", "Guillaume II", "George V", "Nicolas II de Russie"],
      },
      {
        title: "Willy, Georgie et Nicky",
        text: "Les trois cousins s'écrivirent pendant des décennies des lettres affectueuses signées de leurs surnoms de famille. En juillet 1914, Wilhelm II et Nicolas II échangèrent encore des télégrammes personnels pour tenter d'éviter la guerre — en vain. La mobilisation générale était déjà lancée.",
        people: ["Guillaume II", "Nicolas II de Russie"],
      },
      {
        title: "La fin des trois dynasties",
        text: "La Première Guerre mondiale emporta les trois : Nicolas II fut fusillé avec sa famille en 1918, Wilhelm II abdiqua et mourut en exil, George V survécut mais dut changer le nom de sa maison de Saxe-Cobourg-Gotha en Windsor en 1917 — trop allemand pour un pays en guerre contre l'Allemagne.",
        people: ["Guillaume II", "George V", "Nicolas II de Russie"],
      },
    ],
  },
  {
    id: "charles-ii-genetique",
    title: "Charles II d'Espagne sous le regard de la génétique",
    summary: "En 2009, des généticiens ont calculé que Charles II avait un coefficient de consanguinité supérieur à celui d'un enfant issu d'un mariage entre frère et sœur. Comment en est-on arrivé là ?",
    steps: [
      {
        title: "Six générations de mariages consanguins",
        text: "Charles II d'Espagne (1661–1700) était l'aboutissement de six générations de mariages entre cousins, oncles et nièces au sein de la branche espagnole des Habsbourg. Son coefficient de consanguinité, calculé par Álvarez et al. en 2009, atteignait 0,254 — légèrement supérieur à celui d'un enfant issu d'un mariage entre frère et sœur (0,25).",
        people: ["Philippe IV d'Espagne", "Marie-Anne d'Autriche"],
      },
      {
        title: "Un corps qui trahit la généalogie",
        text: "Les médecins de l'époque notèrent chez Charles II une mâchoire proéminente au point de l'empêcher de mâcher correctement, une langue trop grande pour sa bouche, des jambes si faibles qu'il ne put marcher avant quatre ans, et une stérilité complète malgré deux mariages. Ces traits correspondent aux effets documentés d'une dépression génomique par consanguinité.",
        people: ["Philippe IV d'Espagne", "Marie-Anne d'Autriche"],
      },
      {
        title: "L'extinction d'une lignée",
        text: "Mort sans descendance en 1700, Charles II légua son trône à Philippe d'Anjou, petit-fils de Louis XIV — fondant ainsi la branche espagnole des Bourbon. La branche espagnole des Habsbourg, qui avait régné sur le plus grand empire du monde pendant deux siècles, s'éteignait ainsi directement par les conséquences de sa propre stratégie matrimoniale.",
        people: ["Charles Quint", "Philippe IV d'Espagne"],
      },
    ],
  },
  {
    id: "hawaii-kamehameha",
    title: "La consanguinité sacrée à Hawaï",
    summary: "Bien avant les Habsbourg, la famille royale hawaiienne pratiquait des unions entre frères et sœurs pour concentrer le mana — une logique radicalement différente, mais aux mêmes conséquences biologiques.",
    steps: [
      {
        title: "Le mana et la pureté du sang",
        text: "Dans la tradition hawaiienne, le mana — le pouvoir spirituel — se transmettait par le sang. Plus un chef descendait d'unions entre membres de haut rang, plus son mana était puissant. Les unions entre frères et sœurs issus des deux parents les plus sacrés étaient donc non seulement acceptées, mais recherchées comme la forme d'union la plus prestigieuse possible.",
        image: "hawaii-1.jpg",
        imageCaption: "Habitants des îles Sandwich, Louis Choris, v. 1816 (domaine public)",
        people: [],
      },
      {
        title: "Kamehameha I et ses épouses",
        text: "Kamehameha Ier, qui unifia les îles hawaiiennes entre 1795 et 1810, eut de nombreuses femmes. Sa femme de rang le plus élevé, Keōpūolani, était elle-même issue d'une union entre demi-frère et demi-sœur. Leurs enfants héritèrent d'un mana considéré comme si puissant que même leur père devait s'incliner devant eux — un cas unique dans l'histoire des monarchies.",
        image: "hawaii-2.jpg",
        imageCaption: "Kamehameha Ier, roi des îles Sandwich, Louis Choris, 1816 (domaine public)",
        people: [],
      },
      {
        title: "L'extinction de la lignée",
        text: "La maison de Kamehameha s'éteignit en 1872 avec la mort de Kamehameha V, sans descendant légitime — une extinction frappante similaire à celle des Habsbourg d'Espagne, bien que dans un contexte culturel radicalement différent. La même logique de concentration dynastique du pouvoir par le sang aboutit, dans les deux cas, à la disparition de la lignée.",
        image: "hawaii-3.jpg",
        imageCaption: "Kamehameha V, dernier roi de la maison de Kamehameha (domaine public)",
        people: [],
      },
    ],
  },
];

export function resolveStoryPeople(names, people) {
  function candidatesFor(name) {
    const exact = people.filter(p => p.name === name);
    if (exact.length > 0) return exact;
    return people.filter(p => p.name.includes(name) || name.includes(p.name));
  }

  function areLinked(a, b) {
    if (a.father?.id === b.id || a.mother?.id === b.id) return true;
    if (b.father?.id === a.id || b.mother?.id === a.id) return true;
    if (a.spouses?.some(s => s.id === b.id)) return true;
    if (b.spouses?.some(s => s.id === a.id)) return true;
    return false;
  }

  const lists = names.map(name => ({ name, candidates: candidatesFor(name) }));
  for (const l of lists) {
    if (l.candidates.length === 0) console.warn(`Récit : personne introuvable dans les données — "${l.name}"`);
  }
  const usable = lists.filter(l => l.candidates.length > 0);
  if (usable.length === 0) return [];

  // Recherche exhaustive de la combinaison la plus cohérente généalogiquement
  // parmi tous les homonymes possibles (peu de candidats par nom, donc cette
  // recherche reste instantanée même par force brute).
  let bestCombo = usable.map(l => l.candidates[0]);
  let bestScore = -1;

  function search(index, combo) {
    if (index === usable.length) {
      let score = 0;
      for (let i = 0; i < combo.length; i++) {
        for (let j = i + 1; j < combo.length; j++) {
          if (areLinked(combo[i], combo[j])) score++;
        }
      }
      if (score > bestScore) { bestScore = score; bestCombo = [...combo]; }
      return;
    }
    for (const candidate of usable[index].candidates) {
      search(index + 1, [...combo, candidate]);
    }
  }
  search(0, []);

  return bestCombo;
}