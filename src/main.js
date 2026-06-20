import './style.css';
import genealogy from './data/genealogy.json';
import { createGraph } from './viz/graph.js';
import { createKinshipTools, describeRelationship } from './lib/kinship.js';
import { createInbreedingChart } from './viz/chart.js';
import { createBirthplaceMap } from './viz/map.js';

const svgEl = document.getElementById('graph');
const houseListEl = document.getElementById('house-list');
const detailPanel = document.getElementById('detail-panel');
const detailContent = document.getElementById('detail-content');
const closeBtn = document.getElementById('close-panel');

const graph = createGraph({
  svgEl,
  data: genealogy,
  onSelect: (person) => showDetail(person),
});

const kinshipTools = createKinshipTools(genealogy.people);

// --- Filtres par maison ---
const activeHouses = new Set();
for (const house of graph.houseNames) {
  const label = document.createElement('label');
  label.className = 'house-filter';
  label.innerHTML = `<input type="checkbox" value="${house}" /><span class="dot" style="background:${graph.houseColor(house)}"></span>${house}`;
  label.querySelector('input').addEventListener('change', (e) => {
    if (e.target.checked) activeHouses.add(house); else activeHouses.delete(house);
    graph.setHouseFilter(activeHouses);
  });
  houseListEl.appendChild(label);
}

// --- Outil de recherche réutilisable (autocomplétion) ---
function highlightMatch(name, query) {
  const idx = name.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return name;
  return `${name.slice(0, idx)}<mark>${name.slice(idx, idx + query.length)}</mark>${name.slice(idx + query.length)}`;
}

function attachAutocomplete(inputEl, resultsEl, onSelect) {
  let results = [];
  let activeIndex = -1;

  function render(query) {
    const q = query.trim().toLowerCase();
    if (q.length < 2) { close(); return; }
    results = genealogy.people
      .filter(p => p.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.toLowerCase().indexOf(q) - b.name.toLowerCase().indexOf(q))
      .slice(0, 8);
    activeIndex = -1;
    resultsEl.innerHTML = results.length === 0
      ? `<li class="search-empty">Aucun résultat pour « ${query} »</li>`
      : results.map((p, i) => `
          <li class="search-result" data-index="${i}">
            <span class="name">${highlightMatch(p.name, query)}</span>
            <span class="meta">${p.houses.join(', ') || 'Maison inconnue'}${p.birth ? ' · né(e) en ' + p.birth.slice(0, 4) : ''}</span>
          </li>`).join('');
    resultsEl.classList.add('visible');
  }

  function close() {
    resultsEl.classList.remove('visible');
    resultsEl.innerHTML = '';
    results = [];
    activeIndex = -1;
  }

  function pick(person) {
    inputEl.value = person.name;
    close();
    onSelect(person);
  }

  function updateActive() {
    resultsEl.querySelectorAll('.search-result').forEach((el, i) => el.classList.toggle('active', i === activeIndex));
    resultsEl.querySelector('.active')?.scrollIntoView({ block: 'nearest' });
  }

  inputEl.addEventListener('input', (e) => render(e.target.value));
  inputEl.addEventListener('keydown', (e) => {
    if (results.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); activeIndex = (activeIndex + 1) % results.length; updateActive(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); activeIndex = (activeIndex - 1 + results.length) % results.length; updateActive(); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(results[activeIndex] ?? results[0]); }
    else if (e.key === 'Escape') close();
  });
  resultsEl.addEventListener('click', (e) => {
    const li = e.target.closest('.search-result');
    if (!li) return;
    const person = results[Number(li.dataset.index)];
    if (person) pick(person);
  });
  document.addEventListener('click', (e) => { if (!inputEl.parentElement.contains(e.target)) close(); });
}

// --- Recherche principale (barre du haut) ---
attachAutocomplete(
  document.getElementById('search'),
  document.getElementById('search-results'),
  (person) => graph.focusOn(person.id)
);

// --- Panneau de détail ---
const MOIS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

function formatDateFR(isoDate) {
  if (!isoDate) return '?';
  const [year, month, day] = isoDate.split('-');
  if (!month || !day) return year;
  const m = parseInt(month, 10);
  const d = parseInt(day, 10);
  return `${d} ${MOIS_FR[m - 1] ?? month} ${year}`;
}

function showDetail(person) {
  detailContent.innerHTML = `
    <h2>${person.name}</h2>
    <p class="dates">${formatDateFR(person.birth)} — ${formatDateFR(person.death)}</p>
    <p class="houses">${person.houses.join(', ')}</p>
    ${person.inbreedingCoefficient > 0 ? `<p class="inbreeding">Coefficient de consanguinité : ${person.inbreedingCoefficient.toFixed(4)}</p>` : ''}
    ${person.father ? `<p>Père : ${person.father.name ?? '?'}</p>` : ''}
    ${person.mother ? `<p>Mère : ${person.mother.name ?? '?'}</p>` : ''}
    ${person.spouses.length ? `<p>Conjoint·e·s : ${person.spouses.map(s => s.name).join(', ')}</p>` : ''}
  `;
  detailPanel.classList.add('visible');
}

closeBtn.addEventListener('click', () => detailPanel.classList.remove('visible'));

// --- Lien de parenté entre deux personnes ---
const kinshipToggle = document.getElementById('kinship-toggle');
const kinshipPanel = document.getElementById('kinship-panel');
const kinshipCloseBtn = document.getElementById('kinship-close');
const kinshipResultEl = document.getElementById('kinship-result');

let kinshipA = null;
let kinshipB = null;

attachAutocomplete(
  document.getElementById('kinship-a'),
  document.getElementById('kinship-a-results'),
  (person) => { kinshipA = person; computeRelationship(); }
);
attachAutocomplete(
  document.getElementById('kinship-b'),
  document.getElementById('kinship-b-results'),
  (person) => { kinshipB = person; computeRelationship(); }
);

kinshipToggle.addEventListener('click', () => kinshipPanel.classList.toggle('visible'));
kinshipCloseBtn.addEventListener('click', () => kinshipPanel.classList.remove('visible'));

function computeRelationship() {
  if (!kinshipA || !kinshipB) return;

  if (kinshipA.id === kinshipB.id) {
    kinshipResultEl.innerHTML = `<p>C'est la même personne.</p>`;
    return;
  }

  const rel = kinshipTools.findRelationship(kinshipA.id, kinshipB.id);

  if (!rel.found) {
    kinshipResultEl.innerHTML = `
      <p>Aucun ancêtre commun connu entre <strong>${kinshipA.name}</strong> et <strong>${kinshipB.name}</strong> dans nos données — la généalogie disponible ne remonte probablement pas assez loin pour ces deux personnes.</p>
    `;
    return;
  }

  const ancestor = genealogy.people.find(p => p.id === rel.commonAncestorIds[0]);
  const relLabel = describeRelationship(rel.dA, rel.dB);
  const multiNote = rel.multiplePaths
    ? `<p class="kinship-note">Plusieurs ancêtres communs partagés à cette même distance — signe probable d'alliances répétées entre leurs familles.</p>`
    : '';
  const coefNote = rel.coefficient > 0
    ? `<p class="kinship-coef">Coefficient de parenté : ${rel.coefficient.toFixed(4)}</p>`
    : '';

  kinshipResultEl.innerHTML = `
    <p><strong>${kinshipA.name}</strong> et <strong>${kinshipB.name}</strong> : <span class="kinship-label">${relLabel}</span></p>
    <p>Ancêtre commun le plus proche : ${ancestor?.name ?? '?'}</p>
    ${multiNote}
    ${coefNote}
  `;

  const allPathIds = new Set(rel.paths.flat());
  graph.highlightPath(Array.from(allPathIds));
}

// --- Graphique d'évolution de la consanguinité ---
const chartOverlay = document.getElementById('chart-overlay');
const chartToggle = document.getElementById('chart-toggle');
const chartClose = document.getElementById('chart-close');
const chartContainer = document.getElementById('chart-container');
const chartLegend = document.getElementById('chart-legend');
let chartInstance = null;

chartToggle.addEventListener('click', () => {
  chartOverlay.classList.add('visible');
  if (!chartInstance) {
    chartInstance = createInbreedingChart({
      container: chartContainer,
      legendContainer: chartLegend,
      people: genealogy.people,
      houseColor: graph.houseColor,
      houseNames: graph.houseNames,
      onSelectPerson: (id) => {
        chartOverlay.classList.remove('visible');
        graph.focusOn(id);
      },
    });
  }
});

chartClose.addEventListener('click', () => chartOverlay.classList.remove('visible'));
chartOverlay.addEventListener('click', (e) => { if (e.target === chartOverlay) chartOverlay.classList.remove('visible'); });


// --- Carte des lieux de naissance ---
const mapOverlay = document.getElementById('map-overlay');
const mapToggle = document.getElementById('map-toggle');
const mapClose = document.getElementById('map-close');
const mapContainer = document.getElementById('map-container');
const mapLegend = document.getElementById('map-legend');
const mapSliderBar = document.getElementById('map-slider-bar');
let mapInstance = null;

mapToggle.addEventListener('click', () => {
  mapOverlay.classList.add('visible');
  if (!mapInstance) {
    mapInstance = createBirthplaceMap({
      container: mapContainer,
      legendContainer: mapLegend,
      sliderContainer: mapSliderBar,
      people: genealogy.people,
      houseColor: graph.houseColor,
      houseNames: graph.houseNames,
      onSelectPerson: (id) => {
        mapOverlay.classList.remove('visible');
        graph.focusOn(id);
      },
    });
  }
});

mapClose.addEventListener('click', () => mapOverlay.classList.remove('visible'));
mapOverlay.addEventListener('click', (e) => { if (e.target === mapOverlay) mapOverlay.classList.remove('visible'); });