// ui-controller.js — ArchitectOS Dashboard v3.0
console.log("Loading UI Controller v3.0...");

// ─── SPACES CATALOG ───────────────────────────────────────────────────────────
const SPACES = [
  // Entry / Front zone
  { id:'parking',     name:'Car Parking',    cat:'Parking',  zone:'front',  rec:14.0, min:9,   max:25  },
  { id:'foyer',       name:'Foyer / Entry',  cat:'Entry',    zone:'front',  rec:5.0,  min:3,   max:10  },
  { id:'living',      name:'Living Room',    cat:'Living',   zone:'front',  rec:18.0, min:12,  max:30  },
  { id:'pooja',       name:'Pooja Room',     cat:'Entry',    zone:'front',  rec:4.0,  min:2,   max:8   },
  // Middle zone
  { id:'dining',      name:'Dining Room',    cat:'Living',   zone:'middle', rec:12.0, min:8,   max:20  },
  { id:'stair',       name:'Staircase',      cat:'Stair',    zone:'middle', rec:6.0,  min:4,   max:10  },
  { id:'toilet1',     name:'Toilet (Common)',cat:'Bath',     zone:'middle', rec:3.5,  min:2.5, max:6   },
  // Kitchen zone (rear-ish)
  { id:'kitchen',     name:'Kitchen',        cat:'Kitchen',  zone:'rear',   rec:10.0, min:7,   max:18  },
  { id:'utility',     name:'Utility / Store',cat:'Kitchen',  zone:'rear',   rec:4.5,  min:2,   max:8   },
  // Rear / Bedroom zone
  { id:'master_bed',  name:'Master Bedroom', cat:'Bedroom',  zone:'rear',   rec:16.0, min:12,  max:25  },
  { id:'master_bath', name:'Master Bathroom',cat:'Bath',     zone:'rear',   rec:5.0,  min:3.5, max:9   },
  { id:'bed2',        name:'Bedroom 2',      cat:'Bedroom',  zone:'rear',   rec:12.0, min:9,   max:20  },
  { id:'bath2',       name:'Bathroom 2',     cat:'Bath',     zone:'rear',   rec:4.0,  min:3,   max:7   },
  { id:'bed3',        name:'Bedroom 3',      cat:'Bedroom',  zone:'rear',   rec:11.0, min:9,   max:18  },
];

const CATEGORY_COLORS = {
  'Parking': '#8b949e',
  'Entry':   '#f78166',
  'Living':  '#ffa657',
  'Kitchen': '#a3e635',
  'Bedroom': '#79c0ff',
  'Bath':    '#d2a8ff',
  'Stair':   '#f8d618',
};

const ZONE_FILL = {
  front:   'rgba(247,129,102,0.18)',
  middle:  'rgba(255,166,87,0.18)',
  rear:    'rgba(121,192,255,0.18)',
  service: 'rgba(210,168,255,0.18)',
};

// ─── STATE ────────────────────────────────────────────────────────────────────
const state = {
  // geometry (new driver inputs)
  plotW: 10, plotD: 20,
  sbFront: 1.5, sbRear: 1.0, sbLeft: 0.9, sbRight: 0.9,
  floors: 1, maxH: 10,

  // legacy irregular support
  type: 'regular',
  width: 10, height: 20,
  edges: [], diagonals: [],

  roads: [],
  geometry: {}, compliance: {},
  authorityId: '',
  landUse: 'Residential', developmentType: 'plotted_single',
  proposedHeight: 12.5, isCornerPlot: false,
  farReport: null, totalUnits: 1,
  manualOverride: false,
  overrides: { frontSetback: null, maxFAR: null },

  // toggles
  showDimensions: true, showZones: false, showWalls: false,
  northAngle: 0,
  numBedrooms: 2, includeParking: true,

  // backend
  serverEnvelope: null, serverValidation: null,
  backendLayout: null, backendVariants: [], activeVariantIndex: 0,
  solverZones: null,

  // zoning intelligence
  selected: new Set(),
  userAreas: new Map(),
  zoneRects: [],   // [{space, zone, x,y,w,h, screenRect}]

  zoningMode: 'auto',
  floorLevel: 'ground',
};

// ─── DOM refs ─────────────────────────────────────────────────────────────────
let canvas, ctx, container;
let hudArea, hudStatus;
let zoomLevel = 1, panX = 0, panY = 0;
let isDragging = false, lastMouseX = 0, lastMouseY = 0;
let layoutDebounceTimer = null;

// ─── INIT ─────────────────────────────────────────────────────────────────────
function init() {
  console.log("Initializing Dashboard v3.0...");
  canvas    = document.getElementById('geometry-canvas');
  ctx       = canvas.getContext('2d');
  container = document.getElementById('canvas-container');
  hudArea   = document.getElementById('hud-area');
  hudStatus = document.getElementById('hud-status');

  setupAccordions();
  setupCanvas();
  setupTheme();
  setupSpaceList();
  bindEvents();
  bindGeometryInputs();

  // Load Authorities
  if (window.RuleEngine?.loadAuthorities) {
    window.RuleEngine.loadAuthorities().then(authData => {
      const sel = document.getElementById('select-authority');
      if (authData && sel) {
        Object.keys(authData).forEach(k => {
          if (k === 'UP_2025') {
            const o = document.createElement('option');
            o.value = k; o.textContent = authData[k].name; sel.appendChild(o);
          }
        });
        state.authorityId = 'UP_2025'; sel.value = 'UP_2025';
      }
      updateAll();
    });
  }

  state.edges = [{length:15},{length:25},{length:15},{length:25}];
  state.diagonals = [{length:29.15}];
  updateAll();
  setTimeout(runUPBylawEngine, 800);
}

// ─── ACCORDIONS ───────────────────────────────────────────────────────────────
function setupAccordions() {
  document.querySelectorAll('.step-header').forEach(h => {
    h.onclick = () => {
      const c = h.parentElement;
      const isOpen = c.classList.contains('active');
      document.querySelectorAll('.step-container').forEach(x => x.classList.remove('active'));
      if (!isOpen) c.classList.add('active');
    };
  });
}

// ─── GEOMETRY INPUTS binding ──────────────────────────────────────────────────
function bindGeometryInputs() {
  const bind = (id, key, parse) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.oninput = () => { state[key] = parse(el.value); syncLegacyState(); updateAll(true); };
  };
  bind('input-plot-w',    'plotW',   parseFloat);
  bind('input-plot-d',    'plotD',   parseFloat);
  bind('input-sb-front',  'sbFront', parseFloat);
  bind('input-sb-rear',   'sbRear',  parseFloat);
  bind('input-sb-left',   'sbLeft',  parseFloat);
  bind('input-sb-right',  'sbRight', parseFloat);
  bind('input-floors',    'floors',  parseInt);
  bind('input-max-h',     'maxH',    parseFloat);

  // sync authority selects
  const selAuth = document.getElementById('select-authority');
  if (selAuth) selAuth.onchange = () => { state.authorityId = selAuth.value; updateAll(); };
  const selLU = document.getElementById('select-land-use');
  if (selLU) selLU.onchange = () => { state.landUse = selLU.value; updateAll(); };
  const selDT = document.getElementById('select-dev-type');
  if (selDT) selDT.onchange = () => { state.developmentType = selDT.value; updateAll(); };
  const selIP = document.getElementById('input-prop-height');
  if (selIP) selIP.oninput = () => { state.proposedHeight = parseFloat(selIP.value)||12; updateAll(true); };
  const selTU = document.getElementById('input-total-units');
  if (selTU) selTU.oninput = () => { state.totalUnits = parseInt(selTU.value)||1; updateAll(true); };

  // road access side
  const selRA = document.getElementById('select-road-access');
  if (selRA) selRA.onchange = () => updateAll(true);

  const chkCorner = document.getElementById('check-corner-plot');
  if (chkCorner) chkCorner.onchange = () => { state.isCornerPlot = chkCorner.checked; updateAll(); };
}

// Keep legacy width/height in sync with new plotW/plotD
function syncLegacyState() {
  state.width  = state.plotW || state.width;
  state.height = state.plotD || state.height;
}

// ─── SPACE SELECTOR LIST ──────────────────────────────────────────────────────
function setupSpaceList() {
  const container = document.getElementById('space-category-list');
  if (!container) return;
  container.innerHTML = '';

  const cats = [...new Set(SPACES.map(s => s.cat))];
  cats.forEach(cat => {
    const spaces = SPACES.filter(s => s.cat === cat);
    const color  = CATEGORY_COLORS[cat] || '#8b949e';
    const wrap   = document.createElement('div');
    wrap.className = 'space-category';
    wrap.innerHTML = `
      <div class="space-category-header">
        <span class="space-category-label">
          <span class="cat-dot" style="background:${color};"></span>${cat}
        </span>
        <span style="font-size:9px;color:var(--text-muted);font-family:var(--font-mono);">${spaces.length} spaces</span>
      </div>`;

    spaces.forEach(sp => {
      const row = document.createElement('div');
      row.className = 'space-row';
      row.id = `space-row-${sp.id}`;
      const checked = state.selected.has(sp.id);
      const area    = state.userAreas.get(sp.id) ?? sp.rec;
      row.innerHTML = `
        <div class="space-check ${checked?'checked':''}" data-id="${sp.id}" tabindex="0" role="checkbox" aria-checked="${checked}"></div>
        <span class="space-name" data-id="${sp.id}">${sp.name}</span>
        <input class="space-area-input" type="number" step="0.5" min="${sp.min}" max="${sp.max}" value="${area.toFixed(1)}" data-id="${sp.id}" aria-label="${sp.name} area">
        <span class="space-unit">m²</span>
        <button class="space-restore" data-id="${sp.id}" title="Restore recommended value">↺</button>`;
      wrap.appendChild(row);
    });
    container.appendChild(wrap);
  });

  // Event delegation
  container.addEventListener('click', e => {
    const id = e.target.dataset.id || e.target.closest('[data-id]')?.dataset.id;
    if (!id) return;
    if (e.target.classList.contains('space-check') || e.target.classList.contains('space-name')) {
      toggleSpace(id);
    }
    if (e.target.classList.contains('space-restore')) {
      const sp = SPACES.find(s => s.id === id);
      if (sp) {
        state.userAreas.delete(id);
        const inp = container.querySelector(`input[data-id="${id}"]`);
        if (inp) inp.value = sp.rec.toFixed(1);
        updateUtilisation(); drawCanvas();
      }
    }
  });

  container.addEventListener('input', e => {
    if (e.target.classList.contains('space-area-input')) {
      const id  = e.target.dataset.id;
      const val = parseFloat(e.target.value);
      if (id && !isNaN(val)) { state.userAreas.set(id, val); updateUtilisation(); drawCanvas(); }
    }
  });

  container.addEventListener('keydown', e => {
    if ((e.key === ' ' || e.key === 'Enter') && e.target.classList.contains('space-check')) {
      e.preventDefault(); toggleSpace(e.target.dataset.id);
    }
  });
}

function toggleSpace(id) {
  if (state.selected.has(id)) { state.selected.delete(id); }
  else { state.selected.add(id); }
  const row   = document.getElementById(`space-row-${id}`);
  const check = row?.querySelector('.space-check');
  const isOn  = state.selected.has(id);
  if (check) { check.classList.toggle('checked', isOn); check.setAttribute('aria-checked', isOn); }
  updateUtilisation();
  if (state.showZones) drawCanvas();
}

function updateUtilisation() {
  const bw = Math.max(0, (state.plotW||10) - (state.sbLeft||0) - (state.sbRight||0));
  const bd = Math.max(0, (state.plotD||20) - (state.sbFront||0) - (state.sbRear||0));
  const avail = bw * bd * (state.floors || 1);

  let used = 0;
  state.selected.forEach(id => {
    const sp = SPACES.find(s => s.id === id);
    if (sp) used += state.userAreas.get(id) ?? sp.rec;
  });

  const pct = avail > 0 ? Math.min((used / avail) * 100, 130) : 0;
  const bar = document.getElementById('util-bar');
  if (bar) {
    bar.style.width = Math.min(pct, 100) + '%';
    bar.className = 'util-bar' + (pct > 100 ? ' error' : pct > 85 ? ' warn' : '');
  }
  const pctEl = document.getElementById('util-pct');
  if (pctEl) pctEl.textContent = pct.toFixed(0) + '%';
  const usedEl = document.getElementById('util-used');
  if (usedEl) usedEl.textContent = used.toFixed(1) + ' m² used';
  const availEl = document.getElementById('util-avail');
  if (availEl) availEl.textContent = 'of ' + avail.toFixed(1) + ' m² available';

  // Zone KV
  const bkv = (bw * bd).toFixed(1);
  const gkv = (bw * bd * (state.floors||1)).toFixed(1);
  const fkv = (avail / ((state.plotW||10) * (state.plotD||20))).toFixed(2);
  const eks = Math.floor(bw * bd / 75);
  const el = id => document.getElementById(id);
  if (el('zkv-buildable')) el('zkv-buildable').innerHTML = bkv + '<span class="kv-unit">m²</span>';
  if (el('zkv-gross'))     el('zkv-gross').innerHTML     = gkv + '<span class="kv-unit">m²</span>';
  if (el('zkv-far'))       el('zkv-far').textContent     = fkv;
  if (el('zkv-parking'))   el('zkv-parking').textContent  = eks;
}

// ─── ZONING INTELLIGENCE ENGINE ────────────────────────────────────────────────
function computeZoningLayout(toScr, scale) {
  state.zoneRects = [];
  if (!state.showZones || state.selected.size === 0) return;

  const bw = Math.max(1, (state.plotW||10) - (state.sbLeft||0) - (state.sbRight||0));
  const bd = Math.max(1, (state.plotD||20) - (state.sbFront||0) - (state.sbRear||0));
  const ox = (state.sbLeft||0);    // buildable origin x in model space
  const oy = (state.sbFront||0);   // buildable origin y in model space

  // Road direction: default South (bottom) = front is near y=0
  const selRA = document.getElementById('select-road-access');
  const roadSide = selRA ? parseInt(selRA.value) : 0;

  // Group selected spaces by zone
  const byZone = { front:[], middle:[], rear:[] };
  state.selected.forEach(id => {
    const sp = SPACES.find(s => s.id === id);
    if (sp) (byZone[sp.zone] || byZone.rear).push(sp);
  });

  // Give each zone a depth proportional to total area
  const totalSel = [...state.selected].reduce((s, id) => {
    const sp = SPACES.find(x => x.id === id);
    return s + (state.userAreas.get(id) ?? (sp?.rec || 0));
  }, 0);

  function zoneDepth(zoneSpaces) {
    const a = zoneSpaces.reduce((s, sp) => s + (state.userAreas.get(sp.id) ?? sp.rec), 0);
    return totalSel > 0 ? (a / totalSel) * bd : 0;
  }

  const dFront  = zoneDepth(byZone.front);
  const dMiddle = zoneDepth(byZone.middle);
  const dRear   = zoneDepth(byZone.rear);

  // Place zones vertically (road side = bottom → front is at y=oy, grows up)
  // y axis is inverted in canvas (toScr flips y)
  let curY = oy;

  function layoutStrip(spaces, y0, depth, zoneKey) {
    if (spaces.length === 0 || depth < 0.01) return;
    const totalA = spaces.reduce((s, sp) => s + (state.userAreas.get(sp.id) ?? sp.rec), 0);
    let curX = ox;
    spaces.forEach(sp => {
      const a = state.userAreas.get(sp.id) ?? sp.rec;
      const w = totalA > 0 ? (a / totalA) * bw : bw / spaces.length;
      state.zoneRects.push({ space: sp, zone: zoneKey, mx: curX, my: y0, mw: w, mh: depth });
      curX += w;
    });
  }

  // Road at bottom → front zone lowest y
  layoutStrip(byZone.front,  curY, dFront, 'front');   curY += dFront;
  layoutStrip(byZone.middle, curY, dMiddle, 'middle'); curY += dMiddle;
  layoutStrip(byZone.rear,   curY, dRear, 'rear');
}

// ─── UPDATE ALL ───────────────────────────────────────────────────────────────
function updateAll(debouncedLayout = false) {
  syncLegacyState();
  if (state.type === 'regular') computeRegularGeometry();
  else computeIrregularGeometry();
  computeCompliance();
  updateKVCards();
  updateStatusBar();
  updateDiagnostics();
  updateOutputConsole();
  updateUtilisation();
  drawCanvas();
  if (debouncedLayout && state.showZones) {
    clearTimeout(layoutDebounceTimer);
    layoutDebounceTimer = setTimeout(generateLayout, 600);
  }
}

function computeRegularGeometry() {
  const W = parseFloat(document.getElementById('input-reg-width')?.value) || state.plotW || 10;
  const H = parseFloat(document.getElementById('input-reg-height')?.value) || state.plotD || 20;
  state.plotW = W; state.plotD = H;
  state.width = W; state.height = H;
  const verts = [{x:0,y:0},{x:W,y:0},{x:W,y:H},{x:0,y:H}];
  state.geometry = {
    vertices: verts,
    area: W * H,
    isClosed: true,
    isSelfIntersecting: false,
    diagonalError: 0,
  };
}

function computeIrregularGeometry() {
  if (!window.GeometryEngine) return;
  const result = window.GeometryEngine.solve(state.edges.map(e=>e.length), state.diagonals.map(d=>d.length));
  state.geometry = result || {};
}

function computeCompliance() {
  if (!state.geometry?.isClosed || !window.RuleEngine || !state.authorityId) {
    state.compliance = {};
    return;
  }
  try {
    const rules = window.RuleEngine.getAuthority?.(state.authorityId);
    if (!rules) return;
    const area     = state.geometry.area || 0;
    const frontRW  = state.roads.length > 0 ? parseFloat(state.roads[0].proposedWidth||0) : 0;
    const result   = window.RuleEngine.calculateCompliance?.({
      area, roads: state.roads, landUse: state.landUse,
      developmentType: state.developmentType, authority: state.authorityId,
      proposedHeight: state.proposedHeight, totalUnits: state.totalUnits,
      isCornerPlot: state.isCornerPlot, authorityRules: rules
    });
    state.compliance = result || {};
  } catch(e) { console.warn('Compliance error:', e); }
}

function updateKVCards() {
  const g = state.geometry;
  const c = state.compliance;
  const plotArea = g?.area || (state.plotW * state.plotD);
  const bw = Math.max(0, state.plotW - state.sbLeft - state.sbRight);
  const bd = Math.max(0, state.plotD - state.sbFront - state.sbRear);
  const buildable = bw * bd;
  const gross  = buildable * (state.floors || 1);
  const far    = plotArea > 0 ? (gross / plotArea).toFixed(2) : '—';
  const ecs    = Math.floor(buildable / 75);

  const el = id => document.getElementById(id);
  if (el('kv-area'))     el('kv-area').innerHTML     = plotArea.toFixed(2) + '<span class="kv-unit">m²</span>';
  if (el('kv-status'))   el('kv-status').textContent  = g?.isClosed ? 'Closed ✓' : 'Open';
  if (el('kv-far'))      el('kv-far').textContent     = far;
  if (el('kv-gross'))    el('kv-gross').innerHTML     = gross.toFixed(2) + '<span class="kv-unit">m²</span>';
  if (el('kv-coverage')) el('kv-coverage').innerHTML  = buildable.toFixed(2) + '<span class="kv-unit">m²</span>';
  if (el('kv-parking'))  el('kv-parking').innerHTML   = ecs + '<span class="kv-unit">ECS</span>';
  if (el('kv-basement')) el('kv-basement').textContent = buildable > 0 ? 'Permissible' : '—';

  const mfar = c?.maxFAR || '—';
  if (el('kv-mfar'))     el('kv-mfar').textContent = typeof mfar === 'number' ? mfar.toFixed(2) : mfar;

  // hud
  if (hudArea)   hudArea.textContent   = plotArea.toFixed(2) + ' m²';
  if (hudStatus) hudStatus.textContent = g?.isClosed ? (g.isSelfIntersecting ? 'Self-intersecting' : 'Closed') : 'Open';
}

function updateStatusBar() {
  const plotArea = state.geometry?.area || (state.plotW * state.plotD);
  const bw = Math.max(0, state.plotW - state.sbLeft - state.sbRight);
  const bd = Math.max(0, state.plotD - state.sbFront - state.sbRear);
  const buildable = bw * bd;
  const far = plotArea > 0 ? (buildable * (state.floors||1) / plotArea).toFixed(2) : '—';
  const ecs = Math.floor(buildable / 75);

  const el = id => document.getElementById(id);
  if (el('sb-area'))      el('sb-area').textContent      = plotArea.toFixed(2) + ' m²';
  if (el('sb-buildable')) el('sb-buildable').textContent = buildable.toFixed(2) + ' m²';
  if (el('sb-far'))       el('sb-far').textContent       = far;
  if (el('sb-ecs'))       el('sb-ecs').textContent       = ecs;
  if (el('sb-zoom'))      el('sb-zoom').textContent      = Math.round(zoomLevel * 100) + '%';
}
