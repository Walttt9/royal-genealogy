import * as d3 from 'd3';

export function createInbreedingChart({ container, legendContainer, people, houseColor, houseNames, onSelectPerson }) {
  const dataset = people
    .filter(p => p.birth && p.inbreedingCoefficient > 0)
    .map(p => ({
      id: p.id,
      name: p.name,
      year: parseInt(p.birth.slice(0, 4), 10),
      coef: p.inbreedingCoefficient,
      house: p.houses[0] ?? 'Inconnue',
    }))
    .filter(d => Number.isFinite(d.year));

  const byHouse = d3.group(dataset, d => d.house);
  const houseGroups = new Map(); // rempli plus tard, mais référencé dès maintenant par la légende
  const hidden = new Set();

  // --- Légende construite EN PREMIER, pour que sa hauteur réelle soit déjà
  // prise en compte quand on mesure l'espace disponible pour le graphique. ---
  for (const house of houseNames) {
    if (!byHouse.has(house)) continue;
    const item = document.createElement('div');
    item.className = 'chart-legend-item';
    item.innerHTML = `<span class="dot" style="background:${houseColor(house)}"></span>${house}`;
    item.addEventListener('click', () => {
      if (hidden.has(house)) hidden.delete(house); else hidden.add(house);
      item.classList.toggle('dimmed', hidden.has(house));
      houseGroups.get(house)?.style('display', hidden.has(house) ? 'none' : null);
    });
    legendContainer.appendChild(item);
  }

  // --- Mesure de l'espace, seulement maintenant que la légende existe réellement ---
  const width = container.clientWidth;
  const height = container.clientHeight;
  const margin = { top: 20, right: 24, bottom: 36, left: 50 };

  const svg = d3.select(container).append('svg')
    .attr('class', 'chart-svg')
    .attr('width', width)
    .attr('height', height);

  const x = d3.scaleLinear()
    .domain(d3.extent(dataset, d => d.year)).nice()
    .range([margin.left, width - margin.right]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(dataset, d => d.coef) * 1.1]).nice()
    .range([height - margin.bottom, margin.top]);

  svg.append('g')
    .attr('transform', `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(10).tickFormat(d3.format('d')));

  svg.append('g')
    .attr('transform', `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).ticks(6));

  const binSize = 50;
  const lineGen = d3.line()
    .x(d => x(d[0] + binSize / 2))
    .y(d => y(d[1]))
    .curve(d3.curveMonotoneX);

  for (const [house, points] of byHouse) {
    const binned = d3.rollups(points, v => d3.mean(v, d => d.coef), d => Math.floor(d.year / binSize) * binSize)
      .filter(([, v]) => v != null)
      .sort((a, b) => a[0] - b[0]);

    const g = svg.append('g').attr('class', 'house-group');
    houseGroups.set(house, g);

    if (binned.length >= 2) {
      g.append('path')
        .datum(binned)
        .attr('class', 'trend-line')
        .attr('fill', 'none')
        .attr('stroke', houseColor(house))
        .attr('stroke-width', 2)
        .attr('opacity', 0.85)
        .attr('d', lineGen);
    }

    g.selectAll('circle')
      .data(points)
      .join('circle')
      .attr('cx', d => x(d.year))
      .attr('cy', d => y(d.coef))
      .attr('r', 3.5)
      .attr('fill', houseColor(house))
      .attr('opacity', 0.7)
      .style('cursor', 'pointer')
      .on('click', (event, d) => onSelectPerson(d.id))
      .append('title')
      .text(d => `${d.name} (${d.year}) — φ=${d.coef.toFixed(4)}`);
  }

  return {
    destroy() {
      svg.remove();
      legendContainer.innerHTML = '';
    },
  };
}