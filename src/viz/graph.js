import * as d3 from 'd3';

const CONSANGUINITY_THRESHOLD = 0.0625;
const LABEL_ZOOM_THRESHOLD = 2.2;
const OVERVIEW_ZOOM_THRESHOLD = 1.8;
const MAX_OVERVIEW_NODES = 280;   // nb de personnages affichés en vue d'ensemble (les plus connectés)
const MAX_DETAIL_NODES = 700;     // nb max affiché une fois zoomé sur une zone
const MAX_VISIBLE_LABELS = 110;

export function createGraph({ svgEl: canvasEl, data, onSelect }) {
  const { people, couples } = data;
  const byId = new Map(people.map(p => [p.id, p]));

  const cs = getComputedStyle(document.documentElement);
  const COLORS = {
    filiation: cs.getPropertyValue('--filiation').trim(),
    gold: cs.getPropertyValue('--gold').trim(),
    alliance: cs.getPropertyValue('--alliance').trim(),
    crimson: cs.getPropertyValue('--crimson-bright').trim(),
    bg: cs.getPropertyValue('--bg').trim(),
    bgElevated: cs.getPropertyValue('--bg-elevated').trim(),
    ivoryDim: cs.getPropertyValue('--ivory-dim').trim(),
  };

  // --- Estimation de l'année de naissance ---
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
    const motherYear = p.mother ? yearOf(p.mother.id, visited) : null;
    const y = fatherYear != null ? fatherYear + 28 : (motherYear != null ? motherYear + 26 : null);
    yearCache.set(id, y);
    return y;
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
    p._hidden = false;
  }

  // --- Liens ---
  const parentLinks = [];
  for (const p of people) {
    if (p.father && byId.has(p.father.id)) parentLinks.push({ source: p.father.id, target: p.id, type: 'parent' });
    if (p.mother && byId.has(p.mother.id)) parentLinks.push({ source: p.mother.id, target: p.id, type: 'parent' });
  }
  const spouseLinks = couples
    .filter(c => byId.has(c.idA) && byId.has(c.idB))
    .map(c => ({ source: c.idA, target: c.idB, type: 'spouse', kinship: c.kinshipCoefficient }));
  const allLinks = [...parentLinks, ...spouseLinks];

  // --- Degré de connexion (importance), calculé une seule fois en O(n) ---
  const degree = new Map();
  for (const l of allLinks) {
    const s = typeof l.source === 'object' ? l.source.id : l.source;
    const t = typeof l.target === 'object' ? l.target.id : l.target;
    degree.set(s, (degree.get(s) ?? 0) + 1);
    degree.set(t, (degree.get(t) ?? 0) + 1);
  }
  const peopleByDegree = [...people].sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0));

  // --- Palette par maison ---
  const houseNames = Array.from(new Set(people.flatMap(p => p.houses)))
    .sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));

  // Palette à 10 teintes réparties uniformément sur le cercle chromatique
  // (~36° d'écart entre chaque couleur), pour que deux maisons ne soient
  // jamais visuellement confondables, même en petit format.
  const houseColor = d3.scaleOrdinal()
    .domain(houseNames)
    .range(['#c9a35a', '#c9c15f', '#8fb35f', '#4fc9a0', '#5f93c9', '#6f7ec9', '#8a6ac9', '#b35fae', '#c9648f', '#c97a5a'])
    .unknown('#5a5650');

  // --- Préparation du canvas ---
  const width = canvasEl.clientWidth;
  const height = canvasEl.clientHeight;
  const dpr = window.devicePixelRatio || 1;
  canvasEl.width = width * dpr;
  canvasEl.height = height * dpr;
  const ctx = canvasEl.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.font = '9px Inter, sans-serif';

  const xScale = d3.scaleLinear()
    .domain([d3.min(people, d => d._year) - 10, d3.max(people, d => d._year) + 10])
    .range([60, width - 60]);

  for (const p of people) {
    p.x = xScale(p._year);
    p.y = height / 2 + jitterFromId(p.id, 'y', height / 3);
  }

  // --- Overlay de chargement ---
  const container = canvasEl.parentElement;
  const loadingEl = document.createElement('div');
  loadingEl.className = 'graph-loading';
  loadingEl.textContent = 'Calcul de la disposition… 0%';
  container.appendChild(loadingEl);

  // --- Simulation physique ---
  const simulation = d3.forceSimulation(people)
    .force('link', d3.forceLink(allLinks).id(d => d.id).distance(l => l.type === 'spouse' ? 24 : 50).strength(0.2))
    .force('charge', d3.forceManyBody().strength(-30).distanceMax(400))
    .force('x', d3.forceX(d => xScale(d._year)).strength(0.85))
    .force('y', d3.forceY(height / 2).strength(0.04))
    .force('collide', d3.forceCollide(9))
    .velocityDecay(0.5);

  function isAlliance(d) {
    return !d.source.houses.some(h => d.target.houses.includes(h));
  }

  const filiationLinks = allLinks.filter(d => d.type === 'parent');
  const spouseResolved = allLinks.filter(d => d.type === 'spouse');
  const consanguineLinks = spouseResolved.filter(d => d.kinship >= CONSANGUINITY_THRESHOLD);
  const allianceLinks = spouseResolved.filter(d => d.kinship < CONSANGUINITY_THRESHOLD && isAlliance(d));
  const unionLinks = spouseResolved.filter(d => d.kinship < CONSANGUINITY_THRESHOLD && !isAlliance(d));

  function sanitizePositions() {
    for (const p of people) {
      if (!Number.isFinite(p.x)) p.x = xScale(p._year);
      if (!Number.isFinite(p.y)) p.y = height / 2;
    }
  }

  // --- État d'interaction ---
  let transform = d3.zoomIdentity;
  let hoveredId = null;
  let selectedId = null;
  let neighborSet = null;
  let highlightActive = false;
  let nodeVisibleSet = new Set();
  let labelVisibleSet = new Set();
  let visTimer = null;
  let rafScheduled = false;
  let quadtree = null;
  const textWidth = new Map();
  function measureAllLabels() {
    ctx.font = '9px Inter, sans-serif';
    for (const p of people) textWidth.set(p.id, ctx.measureText(p.name).width);
  }
  measureAllLabels();

  // "Inter" charge de façon asynchrone (Google Fonts) ; si elle n'était pas encore
  // disponible lors de la mesure ci-dessus, le navigateur a utilisé une police de
  // secours aux dimensions différentes, faussant durablement le calcul anti-
  // chevauchement des labels. On remesure donc dès que la police annoncée est
  // réellement prête, et on recalcule l'affichage en conséquence.
  document.fonts.ready.then(() => {
    measureAllLabels();
    updateVisibility();
  });

  function scheduleDraw() {
    if (rafScheduled) return;
    rafScheduled = true;
    requestAnimationFrame(() => { rafScheduled = false; draw(); });
  }

  // --- Calcul du niveau de détail (quels nœuds/labels afficher) ---
  function updateVisibility() {
    let candidates;
    if (transform.k < OVERVIEW_ZOOM_THRESHOLD) {
      candidates = peopleByDegree.filter(p => !p._hidden).slice(0, MAX_OVERVIEW_NODES);
    } else {
      const [x0, y0] = transform.invert([0, 0]);
      const [x1, y1] = transform.invert([width, height]);
      const margin = 150;
      candidates = peopleByDegree
        .filter(p => !p._hidden && p.x >= x0 - margin && p.x <= x1 + margin && p.y >= y0 - margin && p.y <= y1 + margin)
        .slice(0, MAX_DETAIL_NODES);
    }

    // Une sélection ou un chemin de parenté actif reste toujours visible,
    // même hors du périmètre normal du niveau de détail.
    if (highlightActive && neighborSet) {
      const known = new Set(candidates.map(p => p.id));
      for (const p of peopleByDegree) {
        if (neighborSet.has(p.id) && !p._hidden && !known.has(p.id)) {
          candidates.push(p);
          known.add(p.id);
        }
      }
    }

    nodeVisibleSet = new Set(candidates.map(p => p.id));

    const gap = 6;
    const box = (p) => {
      const [sx, sy] = transform.apply([p.x, p.y]);
      const w = textWidth.get(p.id) ?? 40;
      return { left: sx, right: sx + 10 + w, top: sy - 7, bottom: sy + 7 };
    };
    const overlaps = (a, b) => !(a.right + gap < b.left || b.right + gap < a.left || a.bottom + gap < b.top || b.bottom + gap < a.top);

    const placed = [];
    const visibleLabels = new Set();
    for (const p of candidates) {
      if (transform.k < LABEL_ZOOM_THRESHOLD) break;
      const c = box(p);
      if (!placed.some(q => overlaps(c, q))) { placed.push(c); visibleLabels.add(p.id); }
    }
    labelVisibleSet = visibleLabels;
    scheduleDraw();
  }

  const zoom = d3.zoom()
    .scaleExtent([0.15, 14])
    .on('zoom', (e) => {
      transform = e.transform;
      clearTimeout(visTimer);
      visTimer = setTimeout(updateVisibility, 80);
      scheduleDraw();
    });
  d3.select(canvasEl).call(zoom);

  function pointerToGraph(clientX, clientY) {
    const rect = canvasEl.getBoundingClientRect();
    return transform.invert([clientX - rect.left, clientY - rect.top]);
  }

  function visibleNodeAt(gx, gy) {
    if (!quadtree) return null;
    const found = quadtree.find(gx, gy, 16 / transform.k);
    if (!found || found._hidden || !nodeVisibleSet.has(found.id)) return null;
    return found;
  }

  canvasEl.addEventListener('mousemove', (e) => {
    const [gx, gy] = pointerToGraph(e.clientX, e.clientY);
    const found = visibleNodeAt(gx, gy);
    const id = found ? found.id : null;
    if (id !== hoveredId) {
      hoveredId = id;
      canvasEl.style.cursor = id ? 'pointer' : 'default';
      scheduleDraw();
    }
  });

  canvasEl.addEventListener('click', (e) => {
    const [gx, gy] = pointerToGraph(e.clientX, e.clientY);
    const found = visibleNodeAt(gx, gy);
    if (found) {
      selectedId = found.id;
      neighborSet = neighborsOf(found.id);
      highlightActive = true;
      onSelect(found, neighborSet);
    } else {
      selectedId = null;
      neighborSet = null;
      highlightActive = false;
    }
    scheduleDraw();
  });

  function neighborsOf(id) {
    const ids = new Set([id]);
    for (const l of allLinks) {
      if (l.source.id === id) ids.add(l.target.id);
      if (l.target.id === id) ids.add(l.source.id);
    }
    return ids;
  }

  // --- Dessin ---
  const gridYears = d3.range(Math.ceil(xScale.domain()[0] / 50) * 50, xScale.domain()[1], 50);

  function drawGrid() {
    for (const y of gridYears) {
      const gx = xScale(y);
      ctx.globalAlpha = 0.06;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1 / transform.k;
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, height);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawSegment(links, color, width, dash, opacity) {
    if (links.length === 0) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width / transform.k;
    ctx.globalAlpha = opacity;
    ctx.setLineDash((dash || []).map(v => v / transform.k));
    ctx.beginPath();
    for (const d of links) { ctx.moveTo(d.source.x, d.source.y); ctx.lineTo(d.target.x, d.target.y); }
    ctx.stroke();
    ctx.restore();
  }

  function drawLinkGroup(links, color, width, dash, baseOpacity) {
    const visible = links.filter(d =>
      !d.source._hidden && !d.target._hidden &&
      nodeVisibleSet.has(d.source.id) && nodeVisibleSet.has(d.target.id)
    );
    if (highlightActive && neighborSet) {
      const related = visible.filter(d => neighborSet.has(d.source.id) && neighborSet.has(d.target.id));
      const rest = visible.filter(d => !(neighborSet.has(d.source.id) && neighborSet.has(d.target.id)));
      drawSegment(rest, color, width, dash, baseOpacity * 0.06);
      drawSegment(related, color, width, dash, 1);
    } else {
      drawSegment(visible, color, width, dash, baseOpacity);
    }
  }

  const NODE_SCREEN_RADIUS = 6; // taille constante à l'écran, quel que soit le zoom

  function drawNodes() {
    const r = NODE_SCREEN_RADIUS / transform.k;
    for (const p of people) {
      if (p._hidden || !nodeVisibleSet.has(p.id)) continue;
      const dimmed = highlightActive && !neighborSet.has(p.id);
      ctx.globalAlpha = dimmed ? 0.1 : 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = houseColor(p.houses[0] ?? 'Inconnue');
      ctx.fill();
      if (p.inbreedingCoefficient >= CONSANGUINITY_THRESHOLD) {
        ctx.lineWidth = 2 / transform.k;
        ctx.strokeStyle = COLORS.crimson;
        ctx.stroke();
      } else if (p.id === hoveredId) {
        ctx.lineWidth = 1.5 / transform.k;
        ctx.strokeStyle = COLORS.gold;
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawLabels() {
    ctx.font = '9px Inter, sans-serif';
    ctx.textBaseline = 'middle';
    for (const p of people) {
      if (p._hidden || !nodeVisibleSet.has(p.id)) continue;
      const isHovered = p.id === hoveredId;
      if (!isHovered && !labelVisibleSet.has(p.id)) continue;
      if (highlightActive && !neighborSet.has(p.id) && !isHovered) continue;
      const [sx, sy] = transform.apply([p.x, p.y]);
      const x = sx + 10, y = sy;
      ctx.globalAlpha = isHovered ? 1 : 0.85;
      ctx.lineWidth = 3;
      ctx.strokeStyle = COLORS.bg;
      ctx.strokeText(p.name, x, y);
      ctx.fillStyle = isHovered ? COLORS.gold : COLORS.ivoryDim;
      ctx.fillText(p.name, x, y);
    }
    ctx.globalAlpha = 1;
  }

  // Bande de dates fixe à l'écran — toujours dessinée en dernier, au-dessus de tout,
  // pour ne jamais être recouverte par les liens même très denses.
  function drawTimeAxis() {
    const barHeight = 26;
    ctx.fillStyle = COLORS.bgElevated;
    ctx.globalAlpha = 0.92;
    ctx.fillRect(0, 0, width, barHeight);
    ctx.globalAlpha = 1;
    ctx.font = '11px Inter, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLORS.ivoryDim;

    const minGap = 54; // espace minimal en pixels écran entre deux dates affichées
    let lastX = -Infinity;
    for (const y of gridYears) {
      const screenX = transform.applyX(xScale(y));
      if (screenX < -40 || screenX > width + 40) continue;
      if (screenX - lastX < minGap) continue; // saute cette date si trop proche de la précédente affichée
      ctx.fillText(String(y), screenX + 4, barHeight / 2);
      lastX = screenX;
    }
  }

  function draw() {
    ctx.save();
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, width, height);
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.k, transform.k);

    drawGrid();
    drawLinkGroup(filiationLinks, COLORS.filiation, 1, [3, 3], 0.4);
    drawLinkGroup(unionLinks, COLORS.gold, 2, null, 0.55);
    drawLinkGroup(allianceLinks, COLORS.alliance, 2.6, null, 0.85);
    drawLinkGroup(consanguineLinks, COLORS.crimson, 3, null, 0.95);
    drawNodes();

    ctx.restore();
    drawLabels();
    drawTimeAxis();
  }

  // --- Calcul de la simulation en arrière-plan, par petits paquets, pour ne
  // jamais bloquer le thread principal plus de quelques millisecondes d'affilée. ---
  function runSimulationAsync(onDone) {
    simulation.stop();
    const totalTicks = 300;
    const batchSize = 12;
    let i = 0;

    function step() {
      const end = Math.min(i + batchSize, totalTicks);
      for (; i < end; i++) { simulation.tick(); }
      sanitizePositions();
      loadingEl.textContent = `Calcul de la disposition… ${Math.round((i / totalTicks) * 100)}%`;
      if (i < totalTicks) {
        setTimeout(step, 0);
      } else {
        onDone();
      }
    }
    setTimeout(step, 0);
  }

  runSimulationAsync(() => {
    quadtree = d3.quadtree(people, d => d.x, d => d.y);
    updateVisibility();
    draw();
    loadingEl.remove();
  });

  function focusOn(id) {
    const d = people.find(p => p.id === id);
    if (!d) return;
    selectedId = id;
    neighborSet = neighborsOf(id);
    const t = d3.zoomIdentity.translate(width / 2, height / 2).scale(3).translate(-d.x, -d.y);
    d3.select(canvasEl).transition().duration(700).call(zoom.transform, t);
  }

  function setHouseFilter(activeHouses) {
    const allActive = activeHouses.size === 0;
    for (const p of people) {
      p._hidden = !(allActive || p.houses.some(h => activeHouses.has(h)));
    }
    updateVisibility();
  }

  // Met en évidence un chemin précis (suite d'identifiants) — utilisé par le
  // chercheur de lien de parenté — et cadre automatiquement la vue dessus.
  function highlightPath(ids) {
    highlightActive = true;
    selectedId = null;
    neighborSet = new Set(ids);

    const pts = people.filter(p => neighborSet.has(p.id));
    if (pts.length > 0) {
      const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minY = Math.min(...ys), maxY = Math.max(...ys);
      const pad = 100;
      const w = Math.max(maxX - minX, 1) + pad * 2;
      const h = Math.max(maxY - minY, 1) + pad * 2;
      const scale = Math.min(width / w, height / h, 4);
      const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
      const t = d3.zoomIdentity.translate(width / 2, height / 2).scale(scale).translate(-cx, -cy);
      d3.select(canvasEl).transition().duration(700).call(zoom.transform, t).on('end', updateVisibility);
    } else {
      updateVisibility();
    }
    scheduleDraw();
  }

  return { focusOn, setHouseFilter, highlightPath, houseNames, houseColor };
}