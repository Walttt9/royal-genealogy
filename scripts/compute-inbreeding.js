// scripts/compute-inbreeding.js
// Calcule les coefficients de consanguinité (méthode de Wright) à partir de
// src/data/royals.json et génère src/data/genealogy.json (fichier final
// utilisé par le site).

import { readFile, writeFile } from 'node:fs/promises';

const raw = await readFile(new URL('../src/data/royals.json', import.meta.url), 'utf-8');
const people = JSON.parse(raw);
const byId = new Map(people.map(p => [p.id, p]));

// --- Rang généalogique (génération depuis les ancêtres les plus anciens connus) ---
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

// --- Coefficient de parenté φ(A,B) — méthode récursive de Wright ---
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

  // On développe toujours l'individu le plus "récent" (rang le plus élevé)
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

// --- Coefficient de consanguinité propre à chaque individu (F = φ(père, mère)) ---
for (const person of people) {
  const fatherId = person.father?.id;
  const motherId = person.mother?.id;
  person.inbreedingCoefficient = (fatherId && motherId) ? kinship(fatherId, motherId) : 0;
}

// --- Coefficient de parenté pour chaque couple recensé ---
const seenPairs = new Set();
const couples = [];

for (const person of people) {
  for (const spouse of person.spouses) {
    const key = cacheKey(person.id, spouse.id);
    if (seenPairs.has(key)) continue;
    seenPairs.add(key);

    couples.push({
      idA: person.id,
      nameA: person.name,
      idB: spouse.id,
      nameB: spouse.name,
      kinshipCoefficient: kinship(person.id, spouse.id),
    });
  }
}

couples.sort((a, b) => b.kinshipCoefficient - a.kinshipCoefficient);

await writeFile(
  new URL('../src/data/genealogy.json', import.meta.url),
  JSON.stringify({ people, couples }, null, 2),
  'utf-8'
);

console.log(`${people.length} individus, ${couples.length} couples analysés.`);
console.log('\nTop 10 des couples les plus consanguins :');
for (const c of couples.slice(0, 10)) {
  console.log(`  φ=${c.kinshipCoefficient.toFixed(4)}  ${c.nameA} ⚭ ${c.nameB}`);
}
console.log('\nFichier src/data/genealogy.json généré avec succès.');