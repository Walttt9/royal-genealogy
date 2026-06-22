// scripts/precompute-layout.js
// Calcule une fois pour toutes la disposition (positions x/y) du graphe
// généalogique, pour que le site n'ait plus aucune simulation physique
// à faire au chargement côté visiteur — juste une lecture directe.

import { readFile, writeFile } from 'node:fs/promises';
import * as d3 from 'd3';

const REF_WIDTH = 1600;
const REF_HEIGHT = 900;
const TICKS = 400; // pas de contrainte de temps ici, on peut converger longuement

const raw = await readFile(new URL('../src/data/genealogy.json', import.meta.url), 'utf-8');
const { people, couples } = JSON.parse(raw);
const byId = new Map(people.map(p => [p.id, p]));

// Index bidirectionnel des couples, pour pouvoir estimer l'année d'un "stub"
// (personne sans date connue) à partir de celle de son époux/épouse plutôt
// que de la placer au hasard sur toute la frise chronologique.
const spouseOf = new Map();
for (const c of couples) {
  if (!byId.has(c.idA) || !byId.has(c.idB)) continue;
  if (!spouseOf.has(c.idA)) spouseOf.set(c.idA, []);
  spouseOf.get(c.idA).push(c.idB);
  if (!spouseOf.has(c.idB)) spouseOf.set(c.idB, []);
  spouseOf.get(c.idB).push(c.idA);
}

// Index des enfants par parent, pour estimer l'année d'un "stub" qui n'a
// ni date, ni parents, ni conjoint exploitable — mais dont les enfants,
// eux, sont des personnes documentées rattachées à une maison suivie.
const childrenOf = new Map();
for (const p of people) {
  if (p.father && byId.has(p.father.id)) {
    if (!childrenOf.has(p.father.id)) childrenOf.set(p.father.id, []);
    childrenOf.get(p.father.id).push(p.id);
  }
  if (p.mother && byId.has(p.mother.id)) {
    if (!childrenOf.has(p.mother.id)) childrenOf.set(p.mother.id, []);
    childrenOf.get(p.mother.id).push(p.id);
  }
}

// --- Estimation de l'année de naissance (identique à la logique utilisée jusqu'ici côté site) ---
const yearCache = new Map();
function yearOf(id, visited = new Set()) {
  if (yearCache.has(id)) return yearCache.get(id);
  if (visited.has(id)) return null;
  visited.add(id);
  const p = byId.get(id);
  if (!p) return null;
  if (p.birth) {
    const y = parseInt(p.birth.slice(0, 4), 10);
    yearCache.set(id, y);
    return y;
  }
  const fatherYear = p.father ? yearOf(p.father.id, visited) : null;
  if (fatherYear != null) { yearCache.set(id, fatherYear + 28); return fatherYear + 28; }
  const motherYear = p.mother ? yearOf(p.mother.id, visited) : null;
  if (motherYear != null) { yearCache.set(id, motherYear + 26); return motherYear + 26; }
  // Aucune date, aucun parent connu (cas typique des "stubs") : on tente
  // l'année du conjoint, bien plus pertinente qu'une position aléatoire.
  for (const spouseId of spouseOf.get(id) ?? []) {
    const spouseYear = yearOf(spouseId, visited);
    if (spouseYear != null) { yearCache.set(id, spouseYear); return spouseYear; }
  }
  // Toujours rien : on tente l'année d'un enfant connu, moins 28 ans —
  // cas des stubs dont le mariage lui-même n'a jamais été capté (le
  // conjoint extérieur n'apparaissant que comme "père"/"mère" d'une
  // personne principale, jamais comme conjoint d'une personne principale).
  for (const childId of childrenOf.get(id) ?? []) {
    const childYear = yearOf(childId, visited);
    if (childYear != null) { const y = childYear - 28; yearCache.set(id, y); return y; }
  }
  return null;
}

const knownYears = people.map(p => yearOf(p.id)).filter(y => y != null);
const fallbackYear = d3.median(knownYears) ?? 1600;

function jitterFromId(id, seed, range) {
  let hash = 0;
  const key = id + seed;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return (Math.abs(hash) % (range * 2 + 1)) - range;
}

const [domainMin, domainMax] = [d3.min(knownYears) ?? 1500, d3.max(knownYears) ?? 1900];
const spread = (domainMax - domainMin) / 2;

for (const p of people) {
  const known = yearOf(p.id);
  p._year = known ?? (fallbackYear + jitterFromId(p.id, 'year', spread));
}

// --- Liens (identiques à ceux utilisés par le graphe) ---
const parentLinks = [];
for (const p of people) {
  if (p.father && byId.has(p.father.id)) parentLinks.push({ source: p.father.id, target: p.id, type: 'parent' });
  if (p.mother && byId.has(p.mother.id)) parentLinks.push({ source: p.mother.id, target: p.id, type: 'parent' });
}
const spouseLinks = couples
  .filter(c => byId.has(c.idA) && byId.has(c.idB))
  .map(c => ({ source: c.idA, target: c.idB, type: 'spouse', kinship: c.kinshipCoefficient }));
const allLinks = [...parentLinks, ...spouseLinks];

const xDomain = [d3.min(people, d => d._year) - 10, d3.max(people, d => d._year) + 10];
const xScale = d3.scaleLinear().domain(xDomain).range([60, REF_WIDTH - 60]);

for (const p of people) {
  p.x = xScale(p._year);
  p.y = REF_HEIGHT / 2 + jitterFromId(p.id, 'y', REF_HEIGHT / 3);
}

function sanitizePositions() {
  for (const p of people) {
    if (!Number.isFinite(p.x)) p.x = xScale(p._year);
    if (!Number.isFinite(p.y)) p.y = REF_HEIGHT / 2;
  }
}

const simulation = d3.forceSimulation(people)
  .force('link', d3.forceLink(allLinks).id(d => d.id).distance(l => l.type === 'spouse' ? 24 : 50).strength(0.2))
  .force('charge', d3.forceManyBody().strength(-30).distanceMax(400))
  .force('x', d3.forceX(d => xScale(d._year)).strength(0.85))
  .force('y', d3.forceY(REF_HEIGHT / 2).strength(0.04))
  .force('collide', d3.forceCollide(9))
  .velocityDecay(0.5);

simulation.stop();
console.log(`Calcul de la disposition (${TICKS} étapes)...`);
for (let i = 0; i < TICKS; i++) {
  simulation.tick();
  sanitizePositions();
  if (i % 100 === 0) console.log(`  étape ${i}/${TICKS}`);
}

// Positions finales arrondies ; _year n'a plus besoin d'être conservé dans le
// fichier final, c'était un détail d'implémentation interne au calcul.
for (const p of people) {
  p.x = Math.round(p.x * 100) / 100;
  p.y = Math.round(p.y * 100) / 100;
  delete p._year;
}

await writeFile(
  new URL('../src/data/genealogy.json', import.meta.url),
  JSON.stringify({ people, couples, layoutMeta: { refWidth: REF_WIDTH, refHeight: REF_HEIGHT, xDomain } }, null, 2),
  'utf-8'
);

console.log('Disposition précalculée et enregistrée dans genealogy.json.');