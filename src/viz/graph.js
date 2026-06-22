import * as d3 from 'd3';

const CONSANGUINITY_THRESHOLD = 0.0625;
const LABEL_ZOOM_THRESHOLD = 2.2;
const OVERVIEW_ZOOM_THRESHOLD = 1.8;
const MAX_OVERVIEW_NODES = 280;
const MAX_DETAIL_NODES = 700;

export function createGraph({ svgEl: canvasEl, data, onSelect }) {
  const { people, couples, layoutMeta } = data;
  const byId = new Map(people.map(p => [p.id, p]));

  // Cadre de référence dans lequel les positions x/y ont été précalculées
  // (voir scripts/precompute-layout.js). On adapte ensuite ce cadre fixe à
  // la taille réelle de l'écran via une transformation de zoom initiale,
  // plutôt que de recalculer quoi que ce soit.
  const refWidth = layoutMeta?.refWidth ?? 1600;
  const refHeight = layoutMeta?.refHeight ?? 900;
  const xDomain = layoutMeta?.xDomain ?? [1000, 2000];

  // Filet de sécurité : si une position venait à manquer (donnée corrompue),
  // on la place au centre plutôt que de planter le rendu.
  for (const p of people) {
    if (!Number.isFinite(p.x)) p.x = refWidth / 2;
    if (!Number.isFinite(p.y)) p.y = refHeight / 2;
    p._hidden = false;
  }

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

  // --- Résolution des liens vers de vraies références d'objets (id -> personne) ---
  for (const l of allLinks) {
    if (typeof l.source !== 'object') l.source = byId.get(l.source);
    if (typeof l.target !== 'object') l.target = byId.get(l.target);
  }

  // --- Palette par maison ---
  const houseNames = Array.from(new Set(people.flatMap(p => p.houses)))
    .sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
  const houseColor = d3.scaleOrdinal()
    .domain(houseNames)
    .range(['#c9a35a', '#c9c15f', '#8fb35f', '#4fc9a0', '#5f93c9', '#6f7ec9', '#8a6ac9', '#b35fae', '#c9648f', '#c97a5a', '#7ec9c2', '#c9a05f', '#e8856a', '#a0c97e', '#6ac9b5'])
    .unknown('#5a5650');

  // --- Préparation du canvas ---
  const dpr = window.devicePixelRatio || 1;
  let width = canvasEl.clientWidth;
  let height = canvasEl.clientHeight;
  canvasEl.width = width * dpr;
  canvasEl.height = height * dpr;
  const ctx = canvasEl.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.font = '9px Inter, sans-serif';

  const xScale = d3.scaleLinear().domain(xDomain).range([60, refWidth - 60]);

  const root = canvasEl.parentElement; // pour un éventuel usage futur (non utilisé pour l'instant)

  const quadtree = d3.quadtree(people, d => d.x, d => d.y);
  const textWidth = new Map();
  for (const p of people) textWidth.set(p.id, ctx.measureText(p.name).width);

  function isAlliance(d) {
    return !d.source.houses.some(h => d.target.houses.includes(h));
  }
  function resizeCanvas() {
    const newWidth = canvasEl.clientWidth;
    const newHeight = canvasEl.clientHeight;
    if (newWidth === 0 || newHeight === 0) return;
    width = newWidth;
    height = newHeight;
    canvasEl.width = newWidth * dpr;
    canvasEl.height = newHeight * dpr;
    ctx.scale(dpr, dpr);
    updateVisibility();
    draw();
  }

  const resizeObserver = new ResizeObserver(() => resizeCanvas());
  resizeObserver.observe(canvasEl);
  const filiationLinks = allLinks.filter(d => d.type === 'parent');
  const spouseResolved = allLinks.filter(d => d.type === 'spouse');
  const consanguineLinks = spouseResolved.filter(d => d.kinship >= CONSANGUINITY_THRESHOLD);
  const allianceLinks = spouseResolved.filter(d => d.kinship < CONSANGUINITY_THRESHOLD && isAlliance(d));
  const unionLinks = spouseResolved.filter(d => d.kinship < CONSANGUINITY_THRESHOLD && !isAlliance(d));

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

  function scheduleDraw() {
    if (rafScheduled) return;
    rafScheduled = true;
    requestAnimationFrame(() => { rafScheduled = false; draw(); });
  }

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
    .scaleExtent([0.1, 14])
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

  const gridYears = d3.range(Math.ceil(xDomain[0] / 50) * 50, xDomain[1], 50);

  function drawGrid() {
    for (const y of gridYears) {
      const gx = xScale(y);
      ctx.globalAlpha = 0.06;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1 / transform.k;
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, refHeight);
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

  function drawNodes() {
    const NODE_SCREEN_RADIUS = 6;
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

  function drawTimeAxis() {
    const barHeight = 26;
    ctx.fillStyle = COLORS.bgElevated;
    ctx.globalAlpha = 0.92;
    ctx.fillRect(0, 0, width, barHeight);
    ctx.globalAlpha = 1;
    ctx.font = '11px Inter, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLORS.ivoryDim;

    const minGap = 54;
    let lastX = -Infinity;
    for (const y of gridYears) {
      const screenX = transform.applyX(xScale(y));
      if (screenX < -40 || screenX > width + 40) continue;
      if (screenX - lastX < minGap) continue;
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

  // --- Cadrage initial : on adapte le cadre de référence précalculé
  // (refWidth × refHeight) à la taille réelle de l'écran du visiteur,
  // sans aucun calcul de simulation — juste une mise à l'échelle. ---
  const fitScale = Math.min(width / refWidth, height / refHeight);
  const initialTransform = d3.zoomIdentity
    .translate((width - refWidth * fitScale) / 2, (height - refHeight * fitScale) / 2)
    .scale(fitScale);

  d3.select(canvasEl).call(zoom.transform, initialTransform);
  updateVisibility();
  draw();

  document.fonts.ready.then(() => {
    ctx.font = '9px Inter, sans-serif';
    for (const p of people) textWidth.set(p.id, ctx.measureText(p.name).width);
    updateVisibility();
  });

  function focusOn(id) {
    const d = people.find(p => p.id === id);
    if (!d) return;
    selectedId = id;
    neighborSet = neighborsOf(id);
    highlightActive = true;
    const t = d3.zoomIdentity.translate(width / 2, height / 2).scale(3).translate(-d.x, -d.y);
    d3.select(canvasEl).transition().duration(700).call(zoom.transform, t).on('end', updateVisibility);
  }

  function setHouseFilter(activeHouses) {
    const allActive = activeHouses.size === 0;
    for (const p of people) {
      p._hidden = !(allActive || p.houses.some(h => activeHouses.has(h)));
    }
    updateVisibility();
  }

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