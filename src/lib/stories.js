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