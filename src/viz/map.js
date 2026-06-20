import * as d3 from 'd3';
import { feature } from 'topojson-client';

const WINDOW_YEARS = 30;

// Rectangle approximatif couvrant l'Europe (utilisé uniquement pour calculer
// le cadrage initial — pas affiché lui-même).
const EUROPE_BOUNDS = {
  type: 'Feature',
  geometry: {
    type: 'Polygon',
    coordinates: [[[-25, 34], [50, 34], [50, 71], [-25, 71], [-25, 34]]],
  },
};

export function createBirthplaceMap({ container, legendContainer, sliderContainer, people, houseColor, houseNames, onSelectPerson }) {
  const dataset = people
    .filter(p => p.birthplace?.coord && p.birth)
    .map(p => ({
      id: p.id,
      name: p.name,
      year: parseInt(p.birth.slice(0, 4), 10),
      lon: p.birthplace.coord.lon,
      lat: p.birthplace.coord.lat,
      place: p.birthplace.name,
      house: p.houses[0] ?? 'Inconnue',
    }))
    .filter(d => Number.isFinite(d.year) && Number.isFinite(d.lon) && Number.isFinite(d.lat));

  const width = container.clientWidth;
  const height = container.clientHeight;

  const svg = d3.select(container).append('svg')
    .attr('class', 'map-svg')
    .attr('width', width)
    .attr('height', height);

  const projection = d3.geoMercator();
  projection.fitExtent([[20, 20], [width - 20, height - 20]], EUROPE_BOUNDS);
  const path = d3.geoPath(projection);

  // Tout le contenu (fond de carte + points) passe par ce groupe racine,
  // c'est lui qui reçoit la transformation de zoom/déplacement.
  const root = svg.append('g').attr('class', 'map-root');
  const mapLayer = root.append('g').attr('class', 'map-base');
  const pointLayer = root.append('g').attr('class', 'map-points');

  d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json').then((topology) => {
    const countries = feature(topology, topology.objects.countries).features;
    mapLayer.selectAll('path')
      .data(countries)
      .join('path')
      .attr('d', path)
      .attr('class', 'map-country');
  });

  // --- Groupement par maison (légende interactive) ---
  const byHouse = d3.group(dataset, d => d.house);
  const houseGroups = new Map();
  const hiddenHouses = new Set();

  for (const house of houseNames) {
    if (!byHouse.has(house)) continue;
    const item = document.createElement('div');
    item.className = 'chart-legend-item';
    item.innerHTML = `<span class="dot" style="background:${houseColor(house)}"></span>${house}`;
    item.addEventListener('click', () => {
      if (hiddenHouses.has(house)) hiddenHouses.delete(house); else hiddenHouses.add(house);
      item.classList.toggle('dimmed', hiddenHouses.has(house));
      houseGroups.get(house)?.style('display', hiddenHouses.has(house) ? 'none' : null);
    });
    legendContainer.appendChild(item);
  }

  for (const [house, points] of byHouse) {
    const g = pointLayer.append('g').attr('class', 'house-group');
    houseGroups.set(house, g);

    const sel = g.selectAll('circle')
      .data(points, d => d.id)
      .join('circle')
      .attr('cx', d => projection([d.lon, d.lat])[0])
      .attr('cy', d => projection([d.lon, d.lat])[1])
      .attr('fill', houseColor(house))
      .style('cursor', 'pointer')
      .on('click', (event, d) => onSelectPerson(d.id));

    sel.append('title').text(d => `${d.name} — ${d.place ?? 'lieu inconnu'} (${d.year})`);
  }

  // --- État du filtre temporel + du zoom, combinés pour calculer taille/opacité ---
  let currentK = 1;
  let isFiltered = false;
  let currentYear = null;

  function baseRadius(d) {
    if (!isFiltered) return 3;
    return Math.abs(d.year - currentYear) <= WINDOW_YEARS ? 4.5 : 2;
  }
  function baseOpacity(d) {
    if (!isFiltered) return 0.75;
    return Math.abs(d.year - currentYear) <= WINDOW_YEARS ? 0.85 : 0.05;
  }

  function refreshPoints(animate) {
    const sel = pointLayer.selectAll('circle');
    const target = animate ? sel.transition().duration(250) : sel;
    target.attr('r', d => baseRadius(d) / currentK).attr('opacity', baseOpacity);
  }
  refreshPoints(false);

  // --- Zoom / déplacement, avec tailles gardées constantes à l'écran ---
  const zoomBehavior = d3.zoom()
    .scaleExtent([1, 10])
    .translateExtent([[0, 0], [width, height]])
    .on('zoom', (e) => {
      currentK = e.transform.k;
      root.attr('transform', e.transform);
      mapLayer.selectAll('path').attr('stroke-width', 0.6 / currentK);
      refreshPoints(false);
    });
  svg.call(zoomBehavior);

  // --- Curseur temporel ---
  const [minYear, maxYear] = d3.extent(dataset, d => d.year);

  const label = document.createElement('div');
  label.className = 'map-slider-label';

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'map-slider';
  slider.min = String(minYear ?? 1000);
  slider.max = String(maxYear ?? 2000);
  slider.value = String(Math.round(((minYear ?? 1000) + (maxYear ?? 2000)) / 2));

  const allBtn = document.createElement('button');
  allBtn.type = 'button';
  allBtn.className = 'map-slider-allbtn';
  allBtn.textContent = 'Toute la période';

  function refreshLabel(year) {
    label.textContent = isFiltered ? `Autour de ${year} (± ${WINDOW_YEARS} ans)` : 'Toute la période';
  }

  slider.addEventListener('input', () => {
    isFiltered = true;
    currentYear = Number(slider.value);
    refreshLabel(currentYear);
    refreshPoints(true);
  });

  allBtn.addEventListener('click', () => {
    isFiltered = false;
    refreshLabel(slider.value);
    refreshPoints(true);
  });

  refreshLabel(slider.value);
  sliderContainer.appendChild(label);
  sliderContainer.appendChild(slider);
  sliderContainer.appendChild(allBtn);

  return {
    destroy() {
      svg.remove();
      legendContainer.innerHTML = '';
      sliderContainer.innerHTML = '';
    },
  };
}