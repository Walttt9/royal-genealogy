// src/lib/kinship.js
// Outils de calcul généalogique réutilisables : coefficient de parenté
// (méthode de Wright) et recherche du chemin de parenté entre deux personnes.

export function createKinshipTools(people) {
  const byId = new Map(people.map(p => [p.id, p]));

  // --- Rang généalogique (pour orienter la récursion du calcul de parenté) ---
  const rankCache = new Map();
  function rank(id) {
    if (!id) return -1;
    if (rankCache.has(id)) return rankCache.get(id);
    const person = byId.get(id);
    if (!person) { rankCache.set(id, 0); return 0; }
    const fatherId = person.father?.id;
    const motherId = person.mother?.id;
    const r = 1 + Math.max(fatherId ? rank(fatherId) : -1, motherId ? rank(motherId) : -1);
    rankCache.set(id, r);
    return r;
  }

  // --- Coefficient de parenté φ(A,B), méthode récursive de Wright ---
  const kinshipCache = new Map();
  function cacheKey(a, b) { return a < b ? `${a}|${b}` : `${b}|${a}`; }

  function kinship(idA, idB) {
    if (!idA || !idB) return 0;

    if (idA === idB) {
      const key = `${idA}|self`;
      if (kinshipCache.has(key)) return kinshipCache.get(key);
      const person = byId.get(idA);
      const fatherId = person?.father?.id;
      const motherId = person?.mother?.id;
      const F = (fatherId && motherId) ? kinship(fatherId, motherId) : 0;
      const result = (1 + F) / 2;
      kinshipCache.set(key, result);
      return result;
    }

    const key = cacheKey(idA, idB);
    if (kinshipCache.has(key)) return kinshipCache.get(key);

    const [olderId, youngerId] = rank(idA) <= rank(idB) ? [idA, idB] : [idB, idA];
    const youngerPerson = byId.get(youngerId);
    const fatherId = youngerPerson?.father?.id;
    const motherId = youngerPerson?.mother?.id;

    let result;
    if (!fatherId && !motherId) {
      result = 0;
    } else {
      const kFather = fatherId ? kinship(olderId, fatherId) : 0;
      const kMother = motherId ? kinship(olderId, motherId) : 0;
      result = (kFather + kMother) / 2;
    }
    kinshipCache.set(key, result);
    return result;
  }

  // --- Index des ancêtres d'une personne, avec distance et "chemin de retour" ---
  function buildAncestryIndex(startId) {
    const dist = new Map([[startId, 0]]);
    const prev = new Map(); // ancêtreId -> enfant qui y mène (pour reconstruire le chemin)
    const queue = [startId];
    while (queue.length) {
      const id = queue.shift();
      const d = dist.get(id);
      const person = byId.get(id);
      if (!person) continue;
      for (const ref of [person.father, person.mother]) {
        if (!ref || !byId.has(ref.id)) continue;
        if (!dist.has(ref.id)) {
          dist.set(ref.id, d + 1);
          prev.set(ref.id, id);
          queue.push(ref.id);
        }
      }
    }
    return { dist, prev };
  }

  function pathBetween(prev, startId, ancestorId) {
    const path = [ancestorId];
    let cur = ancestorId;
    while (cur !== startId) {
      cur = prev.get(cur);
      path.push(cur);
    }
    return path.reverse(); // [startId, ..., ancestorId]
  }

  // --- Recherche du lien de parenté entre deux personnes ---
  function findRelationship(idA, idB) {
    const { dist: distA, prev: prevA } = buildAncestryIndex(idA);
    const { dist: distB, prev: prevB } = buildAncestryIndex(idB);

    let minSum = Infinity;
    let commonAncestors = [];
    for (const [id, dA] of distA) {
      if (!distB.has(id)) continue;
      const dB = distB.get(id);
      const sum = dA + dB;
      if (sum < minSum) { minSum = sum; commonAncestors = [{ id, dA, dB }]; }
      else if (sum === minSum) { commonAncestors.push({ id, dA, dB }); }
    }

    if (commonAncestors.length === 0) {
      return { found: false };
    }

    const paths = commonAncestors.map(({ id }) => {
      const pathA = pathBetween(prevA, idA, id);
      const pathB = pathBetween(prevB, idB, id);
      return [...pathA, ...pathB.slice(0, -1).reverse()];
    });

    const { dA, dB } = commonAncestors[0];

    return {
      found: true,
      dA,
      dB,
      multiplePaths: commonAncestors.length > 1,
      commonAncestorIds: commonAncestors.map(c => c.id),
      paths,
      coefficient: kinship(idA, idB),
    };
  }

  return { kinship, findRelationship };
}

// --- Traduction du lien en français courant ---
export function describeRelationship(dA, dB) {
  if (dA === 0 && dB === 0) return 'la même personne';
  if (dA === 0) return describeDirectLine(dB);
  if (dB === 0) return describeDirectLine(dA);
  if (dA === 1 && dB === 1) return 'frère et sœur';
  if ((dA === 1 && dB === 2) || (dA === 2 && dB === 1)) return 'oncle/tante et neveu/nièce';
  if (dA === 2 && dB === 2) return 'cousins germains';

  const degree = Math.min(dA, dB) - 1;
  const removed = Math.abs(dA - dB);
  const degreeLabel = degree === 1 ? 'germains' : degree === 2 ? 'issus de germains' : `au ${degree}ème degré`;
  const removedLabel = removed === 0 ? '' : `, à ${removed} génération${removed > 1 ? 's' : ''} près`;
  return `cousins ${degreeLabel}${removedLabel}`;
}

function describeDirectLine(d) {
  const labels = ['', 'parent / enfant', 'grand-parent / petit-enfant', 'arrière-grand-parent / arrière-petit-enfant'];
  return labels[d] ?? `ancêtre direct (${d} générations d'écart)`;
}