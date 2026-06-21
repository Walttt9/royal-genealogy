// scripts/fetch-data.js
// Récupère les données généalogiques des maisons royales depuis Wikidata
// et génère src/data/royals.json

import { writeFile } from 'node:fs/promises';

// Maisons royales à inclure (QID Wikidata).
// Pour en ajouter une : cherche "<nom de la maison> wikidata", ouvre la page
// wikidata.org/wiki/Qxxxxx correspondante, et copie le Qxxxxx.
const HOUSES = [
  { label: 'Habsbourg', qid: 'Q65968' },
  { label: 'Bourbon', qid: 'Q58389' },
  { label: 'Romanov', qid: 'Q112707' },
  { label: 'Hohenzollern', qid: 'Q83969' },
  { label: 'Wittelsbach', qid: 'Q131621' },
  { label: 'Hanovre', qid: 'Q157217' },
  { label: 'Windsor', qid: 'Q81589' },
  { label: 'Savoie', qid: 'Q200229' },
  { label: 'Oldenbourg', qid: 'Q155594' },
  { label: 'Orange-Nassau', qid: 'Q155483' },
  { label: 'Saxe-Cobourg-Gotha', qid: 'Q1753846' },
  { label: 'Bragance', qid: 'Q853342' },
  { label: 'Holstein-Gottorp-Romanov', qid: 'Q870568' },
];

const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';

function buildQuery(qids) {
  const values = qids.map(q => `wd:${q}`).join(' ');
  return `
    SELECT ?person ?personLabel ?house ?houseLabel
           ?father ?fatherLabel ?mother ?motherLabel
           ?spouse ?spouseLabel ?birth ?death ?image
           ?birthplace ?birthplaceLabel ?coord
    WHERE {
      VALUES ?house { ${values} }
      ?person wdt:P53 ?house .
      OPTIONAL { ?person wdt:P22 ?father. }
      OPTIONAL { ?person wdt:P25 ?mother. }
      OPTIONAL { ?person wdt:P26 ?spouse. }
      OPTIONAL { ?person wdt:P569 ?birth. }
      OPTIONAL { ?person wdt:P570 ?death. }
      OPTIONAL { ?person wdt:P18 ?image. }
      OPTIONAL {
        ?person wdt:P19 ?birthplace .
        ?birthplace wdt:P625 ?coord .
      }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en". }
    }
  `;
}

function qidFromUri(uri) {
  return uri ? uri.split('/').pop() : null;
}

async function fetchWikidata(qids) {
  const query = buildQuery(qids);
  const url = `${SPARQL_ENDPOINT}?query=${encodeURIComponent(query)}&format=json`;

  const res = await fetch(url, {
    headers: {
      'Accept': 'application/sparql-results+json',
      'User-Agent': 'RoyalGenealogyProject/1.0 (projet personnel)',
    },
  });

  if (!res.ok) {
    throw new Error(`Erreur Wikidata: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return data.results.bindings;
}


function parseWktPoint(wkt) {
  if (!wkt) return null;
  const match = /Point\(([-\d.]+)\s+([-\d.]+)\)/.exec(wkt);
  if (!match) return null;
  return { lon: parseFloat(match[1]), lat: parseFloat(match[2]) };
}

function groupByPerson(rows) {
  const people = new Map();

  for (const row of rows) {
    const id = qidFromUri(row.person.value);

    if (!people.has(id)) {
      people.set(id, {
        id,
        name: row.personLabel?.value ?? id,
        houses: new Set(),
        father: null,
        mother: null,
        spouses: new Set(),
        birth: row.birth?.value?.slice(0, 10) ?? null,
        death: row.death?.value?.slice(0, 10) ?? null,
        image: row.image?.value ?? null,
        birthplace: null,
      });
    }

    const person = people.get(id);

    if (row.houseLabel) person.houses.add(row.houseLabel.value);

    if (row.father) {
      person.father = { id: qidFromUri(row.father.value), name: row.fatherLabel?.value ?? null };
    }
    if (row.mother) {
      person.mother = { id: qidFromUri(row.mother.value), name: row.motherLabel?.value ?? null };
    }
    if (row.spouse) {
      person.spouses.add(JSON.stringify({
        id: qidFromUri(row.spouse.value),
        name: row.spouseLabel?.value ?? null,
      }
    ));
    }
    if (row.birthplace && row.coord) {
      person.birthplace = {
        id: qidFromUri(row.birthplace.value),
        name: row.birthplaceLabel?.value ?? null,
        coord: parseWktPoint(row.coord.value),
      };
    }
  }

  return Array.from(people.values()).map(p => ({
    ...p,
    houses: Array.from(p.houses),
    spouses: Array.from(p.spouses).map(s => JSON.parse(s)),
  }));
}

function addStubPersons(people) {
  const byId = new Map(people.map(p => [p.id, p]));
  const stubs = new Map();

  function ensureStub(ref) {
    if (!ref || !ref.id) return;
    if (byId.has(ref.id) || stubs.has(ref.id)) return;
    stubs.set(ref.id, {
      id: ref.id,
      name: ref.name ?? ref.id,
      houses: [],
      father: null,
      mother: null,
      spouses: [],
      birth: null,
      death: null,
      image: null,
    });
  }

  for (const p of people) {
    ensureStub(p.father);
    ensureStub(p.mother);
    for (const s of p.spouses) ensureStub(s);
  }

  return [...people, ...Array.from(stubs.values())];
}


async function main() {
  console.log(`Interrogation de Wikidata pour ${HOUSES.length} maison(s)...`);

  const rows = await fetchWikidata(HOUSES.map(h => h.qid));
  console.log(`${rows.length} lignes reçues, regroupement par individu...`);

  const people = groupByPerson(rows);
  console.log(`${people.length} individus uniques (membres directs des maisons suivies).`);

  const peopleWithStubs = addStubPersons(people);
  console.log(`${peopleWithStubs.length - people.length} individus "stub" ajoutés (conjoint·e·s extérieur·e·s aux maisons suivies).`);

  await writeFile(
    new URL('../src/data/royals.json', import.meta.url),
    JSON.stringify(peopleWithStubs, null, 2),
    'utf-8'
  );

  console.log('Fichier src/data/royals.json généré avec succès.');
}

main().catch(err => {
  console.error('Échec du script :', err);
  process.exit(1);
});