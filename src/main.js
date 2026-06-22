import './style.css';
window.__genealogy = genealogy;
import genealogy from './data/genealogy.json';
import { createGraph } from './viz/graph.js';
import { createKinshipTools, describeRelationship } from './lib/kinship.js';
import { createInbreedingChart } from './viz/chart.js';
import { createBirthplaceMap } from './viz/map.js';
import { STORIES, resolveStoryPeople } from './lib/stories.js';


function updateUrlForPerson(id) {
  const url = new URL(window.location);
  if (id) url.searchParams.set('personne', id);
  else url.searchParams.delete('personne');
  window.history.replaceState({}, '', url);
}

function getPersonIdFromUrl() {
  return new URL(window.location).searchParams.get('personne');
}

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
  updateUrlForPerson(person.id);
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

closeBtn.addEventListener('click', () => {
  detailPanel.classList.remove('visible');
  updateUrlForPerson(null);
});

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

// --- Ouverture directe via lien permanent (?personne=Qxxxxx dans l'URL) ---
const initialPersonId = getPersonIdFromUrl();
if (initialPersonId) {
  const person = genealogy.people.find(p => p.id === initialPersonId);
  if (person) {
    // Petite pause pour laisser le graphe s'afficher avant de recadrer dessus,
    // plus agréable visuellement qu'un saut instantané dès le premier rendu.
    setTimeout(() => {
      graph.focusOn(person.id);
      showDetail(person);
    }, 300);
  }
}

// --- Récits guidés ---
const storiesPanel = document.getElementById('stories-panel');
const storiesToggle = document.getElementById('stories-toggle');
const storiesClose = document.getElementById('stories-close');
const storiesListEl = document.getElementById('stories-list');
const storiesReaderEl = document.getElementById('stories-reader');
const storiesBackBtn = document.getElementById('stories-back');
const storiesStoryTitleEl = document.getElementById('stories-story-title');
const storiesProgressEl = document.getElementById('stories-progress');
const storiesStepTitleEl = document.getElementById('stories-step-title');
const storiesStepTextEl = document.getElementById('stories-step-text');
const storiesPrevBtn = document.getElementById('stories-prev');
const storiesNextBtn = document.getElementById('stories-next');

let currentStory = null;
let currentStepIndex = 0;

function renderStoriesList() {
  storiesListEl.innerHTML = STORIES.map(s => `
    <div class="story-card" data-id="${s.id}">
      <h3>${s.title}</h3>
      <p>${s.summary}</p>
    </div>
  `).join('');
  storiesListEl.querySelectorAll('.story-card').forEach(card => {
    card.addEventListener('click', () => openStory(card.dataset.id));
  });
}
renderStoriesList();

function openStory(id) {
  currentStory = STORIES.find(s => s.id === id);
  currentStepIndex = 0;
  storiesListEl.classList.add('hidden');
  storiesReaderEl.classList.remove('hidden');
  storiesStoryTitleEl.textContent = currentStory.title;
  renderStep();
}

function renderStep() {
  const step = currentStory.steps[currentStepIndex];
  storiesProgressEl.textContent = `Étape ${currentStepIndex + 1} / ${currentStory.steps.length}`;
  storiesStepTitleEl.textContent = step.title;
  storiesStepTextEl.textContent = step.text;
  storiesPrevBtn.disabled = currentStepIndex === 0;
  storiesNextBtn.textContent = currentStepIndex === currentStory.steps.length - 1 ? 'Terminer' : 'Suivant';

  const matched = resolveStoryPeople(step.people, genealogy.people);
  if (matched.length > 0) graph.highlightPath(matched.map(p => p.id));
}

storiesPrevBtn.addEventListener('click', () => {
  if (currentStepIndex > 0) { currentStepIndex--; renderStep(); }
});
storiesNextBtn.addEventListener('click', () => {
  if (currentStepIndex < currentStory.steps.length - 1) { currentStepIndex++; renderStep(); }
  else closeStoryReader();
});

function closeStoryReader() {
  storiesReaderEl.classList.add('hidden');
  storiesListEl.classList.remove('hidden');
  currentStory = null;
}
storiesBackBtn.addEventListener('click', closeStoryReader);

storiesToggle.addEventListener('click', () => storiesPanel.classList.add('visible'));
storiesClose.addEventListener('click', () => storiesPanel.classList.remove('visible'));

// --- Toggle panneau filtres ---
const filtersToggle = document.getElementById('filters-toggle');
const appEl = document.getElementById('app');

filtersToggle.addEventListener('click', () => {
  appEl.classList.toggle('filters-collapsed');
  filtersToggle.innerHTML = appEl.classList.contains('filters-collapsed') ? '&#8250;' : '&#8249;';
});