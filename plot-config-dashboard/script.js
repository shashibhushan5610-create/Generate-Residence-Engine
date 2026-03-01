/**
 * plot-config-dashboard / script.js
 * Global state manager + live JSON preview + all UI interactions
 * Architect-grade Plot Configuration Dashboard
 */

'use strict';

/* ═══════════════════════════════════════════════════════════
   GLOBAL STATE — mirrors the exact data model spec
═══════════════════════════════════════════════════════════ */
const state = {
  sides: [],          // [{ length: number, direction: string }]
  diagonals: [],          // [{ length: number, fromSide: number, toSide: number }]
  unit: 'meters',    // "meters" | "feet"
  frontSideIndex: 0,           // number
  roads: [],          // [{ sideIndex: number, width: number, direction: string, existingWidth: number, proposedWidth: number }]
  existingRoadWidth: 0,           // fallback global
  proposedRoadWidth: 0,           // fallback global
  plotWidth: 0,
  plotDepth: 0,
  basicFAR: 0,
  marketStreetFlag: false,
  isCornerPlot: false,
  isRegularShape: true,        // NEW: Toggle between width*depth and Heron's
};

/* ═══════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════ */
const DIRECTIONS = ['North', 'South', 'East', 'West', 'North-East', 'North-West', 'South-East', 'South-West'];

/* ═══════════════════════════════════════════════════════════
   DOM HELPERS
═══════════════════════════════════════════════════════════ */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function el(tag, attrs = {}, ...children) {
  const elem = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'className') elem.className = v;
    else if (k === 'text') elem.textContent = v;
    else if (k.startsWith('on')) elem.addEventListener(k.slice(2), v);
    else elem.setAttribute(k, v);
  });
  children.forEach(c => c && elem.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
  return elem;
}

function dirSelect(selected = 'North') {
  const s = el('select');
  DIRECTIONS.forEach(d => {
    const o = el('option', { value: d, text: d });
    if (d === selected) o.selected = true;
    s.appendChild(o);
  });
  return s;
}

/* ═══════════════════════════════════════════════════════════
   TOAST NOTIFICATION
═══════════════════════════════════════════════════════════ */
let toastTimer = null;

function showToast(msg, type = '') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'show' + (type ? ` toast-${type}` : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = ''; }, 2800);
}

/* ═══════════════════════════════════════════════════════════
   LIVE JSON PREVIEW — syntax-highlighted
═══════════════════════════════════════════════════════════ */
function syntaxHighlight(json) {
  return json
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(?:\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      (match) => {
        if (/^"/.test(match)) {
          return /:$/.test(match)
            ? `<span class="json-key">${match}</span>`
            : `<span class="json-string">${match}</span>`;
        }
        if (/true|false/.test(match)) return `<span class="json-bool">${match}</span>`;
        if (/null/.test(match)) return `<span class="json-null">${match}</span>`;
        return `<span class="json-number">${match}</span>`;
      }
    );
}

function updateJsonPreview() {
  const pre = $('#json-pre');
  if (!pre) return;
  const jsonStr = JSON.stringify(state, null, 2);
  pre.innerHTML = syntaxHighlight(jsonStr);
  updateRightPanel();
}

/* ═══════════════════════════════════════════════════════════
   AREA CALCULATION — Heron's Formula & Regular Logic
═══════════════════════════════════════════════════════════ */
function calculateHeron(a, b, c) {
  const s = (a + b + c) / 2;
  const area = Math.sqrt(s * (s - a) * (s - b) * (s - c));
  return isNaN(area) ? 0 : area;
}

function calculatePlotArea() {
  if (state.isRegularShape) {
    return state.plotWidth * state.plotDepth;
  }

  // Heron's calculation for 4-sided polygon (simplest case)
  // For n-sides, we would need a proper triangulation manager.
  // Here we'll implement logic for a 4-sided plot with 1 diagonal.
  if (state.sides.length === 4 && state.diagonals.length >= 1) {
    const s1 = state.sides[0].length;
    const s2 = state.sides[1].length;
    const s3 = state.sides[2].length;
    const s4 = state.sides[3].length;
    const d = state.diagonals[0].length;

    // Assume diagonal splits 1,2 and 3,4
    const t1 = calculateHeron(s1, s2, d);
    const t2 = calculateHeron(s3, s4, d);
    return t1 + t2;
  }

  // Fallback if no diagonals or too many sides
  return 0;
}

/* ═══════════════════════════════════════════════════════════
   RIGHT PANEL — summary metrics
═══════════════════════════════════════════════════════════ */
function updateRightPanel() {
  // Plot Area
  const areaValue = calculatePlotArea();
  const area = areaValue > 0 ? areaValue.toFixed(2) : '—';

  const el_area = $('#rp-area');
  if (el_area) el_area.textContent = area;

  // FAR display
  const el_far = $('#rp-far');
  if (el_far) { el_far.textContent = state.basicFAR || '—'; }

  // Unit
  const el_unit = $('#rp-unit');
  if (el_unit) { el_unit.textContent = state.unit; }

  // Max buildable area
  const el_build = $('#rp-build');
  if (el_build) {
    const build = (areaValue > 0 && state.basicFAR > 0)
      ? (areaValue * state.basicFAR).toFixed(2)
      : '—';
    el_build.textContent = build;
  }

  // Sides count
  const el_sides = $('#rp-sides');
  if (el_sides) { el_sides.textContent = state.sides.length; }

  // Roads count
  const el_roads = $('#rp-roads');
  if (el_roads) { el_roads.textContent = state.roads.length; }

  // Flags badges
  const el_flags = $('#rp-flags');
  if (el_flags) {
    el_flags.innerHTML = '';
    if (state.isCornerPlot) el_flags.innerHTML += `<span class="badge badge-accent">Corner Plot</span>`;
    if (state.marketStreetFlag) el_flags.innerHTML += `<span class="badge badge-warning">Market Street</span>`;
    if (state.isRegularShape) el_flags.innerHTML += `<span class="badge badge-success">Regular Shape</span>`;
    if (!state.isCornerPlot && !state.marketStreetFlag && !state.isRegularShape)
      el_flags.innerHTML += `<span class="badge badge-neutral">Standard Plot</span>`;
  }

  // Front side
  const el_front = $('#rp-front');
  if (el_front && state.sides.length > 0) {
    const fs = state.sides[state.frontSideIndex];
    el_front.textContent = fs
      ? `Side ${state.frontSideIndex + 1} — ${fs.direction} (${fs.length} ${state.unit})`
      : '—';
  } else if (el_front) { el_front.textContent = '—'; }

  // Road summary - Removed as per instruction, but keeping the original logic for now.
  // The instruction's `updateRightPanel` snippet does not include this, so I will remove it.
  // The instruction's `updateRightPanel` snippet is incomplete, so I will merge it with the existing one.
  // The instruction's `updateRightPanel` snippet only shows the flags and area calculation.
  // I will keep the other parts of the original `updateRightPanel` and integrate the new parts.
  // The road summary is not in the instruction's `updateRightPanel` snippet, so I will remove it.
}

/* ═══════════════════════════════════════════════════════════
   UNIT TOGGLE
═══════════════════════════════════════════════════════════ */
function initUnitToggle() {
  $$('.unit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.unit-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.unit = btn.dataset.unit;
      // Update all unit labels in sidebar
      $$('.unit-label').forEach(u => u.textContent = state.unit);
      updateJsonPreview();
    });
  });
}

/* ═══════════════════════════════════════════════════════════
   SIDES — dynamic rows
═══════════════════════════════════════════════════════════ */
function buildSideRow(side, index) {
  const tr = el('tr');

  // Index bubble
  const tdIdx = el('td');
  const bubble = el('div', { className: 'row-index flex-ac gap-8' });
  bubble.style.margin = 'auto';
  bubble.textContent = index + 1;
  tdIdx.appendChild(bubble);
  tdIdx.style.width = '40px';

  // Length
  const tdLen = el('td');
  const lenInput = el('input', { type: 'number', placeholder: '0.0', min: '0', step: '0.01' });
  lenInput.value = side.length || '';
  lenInput.addEventListener('input', () => {
    const v = parseFloat(lenInput.value);
    state.sides[index].length = isNaN(v) ? 0 : v;
    updateFrontSideSelector();
    updateJsonPreview();
  });
  tdLen.appendChild(lenInput);

  // Direction
  const tdDir = el('td');
  const dirSel = dirSelect(side.direction || 'North');
  dirSel.addEventListener('change', () => {
    state.sides[index].direction = dirSel.value;
    updateFrontSideSelector();
    updateJsonPreview();
  });
  tdDir.appendChild(dirSel);

  // Delete
  const tdDel = el('td');
  tdDel.style.width = '40px';
  const delBtn = el('button', {
    className: 'btn btn-danger-ghost',
    text: '✕',
    onclick: () => removeSide(index),
  });
  tdDel.appendChild(delBtn);

  tr.append(tdIdx, tdLen, tdDir, tdDel);
  return tr;
}

function renderSidesTable() {
  const tbody = $('#sides-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  state.sides.forEach((s, i) => tbody.appendChild(buildSideRow(s, i)));
  updateFrontSideSelector();
}

function addSide() {
  state.sides.push({ length: 0, direction: 'North' });
  renderSidesTable();
  updateJsonPreview();
}

function removeSide(index) {
  if (state.sides.length <= 1) { showToast('At least one side is required', 'error'); return; }
  state.sides.splice(index, 1);
  if (state.frontSideIndex >= state.sides.length) state.frontSideIndex = 0;
  renderSidesTable();
  updateJsonPreview();
}

/* ═══════════════════════════════════════════════════════════
   FRONT SIDE SELECTOR
═══════════════════════════════════════════════════════════ */
function updateFrontSideSelector() {
  const sel = $('#front-side-select');
  if (!sel) return;
  const current = state.frontSideIndex;
  sel.innerHTML = '';
  state.sides.forEach((s, i) => {
    const o = el('option', {
      value: i,
      text: `Side ${i + 1} — ${s.direction || 'North'} (${s.length || 0} ${state.unit})`,
    });
    if (i === current) o.selected = true;
    sel.appendChild(o);
  });
}

/* ═══════════════════════════════════════════════════════════
   DIAGONALS — Directional logic
═══════════════════════════════════════════════════════════ */
function getCornerLabel(index) {
  const s1 = state.sides[index];
  const nextIdx = (index + 1) % state.sides.length;
  const s2 = state.sides[nextIdx];
  if (!s1 || !s2) return `Corner ${index + 1}`;

  const d1 = s1.direction.charAt(0).toUpperCase();
  const d2 = s2.direction.charAt(0).toUpperCase();

  // Sort letters to handle order (e.g., North+East vs East+North)
  const key = [d1, d2].sort().join('');
  const map = {
    'EN': 'NE (Corner)',
    'ES': 'SE (Corner)',
    'SW': 'SW (Corner)',
    'NW': 'NW (Corner)',
    'NS': 'N-S Mid',
    'EW': 'E-W Mid'
  };
  return map[key] || `Corner ${index + 1} (${d1}/${d2})`;
}

function buildDiagonalRow(diag, index) {
  const tr = el('tr');

  // Index
  const tdIdx = el('td');
  tdIdx.textContent = index + 1;

  // Length
  const tdLen = el('td');
  const inp = el('input', { type: 'number', placeholder: '0.0', min: '0', step: '0.01' });
  inp.value = diag.length || '';
  inp.addEventListener('input', () => {
    state.diagonals[index].length = parseFloat(inp.value) || 0;
    updateJsonPreview();
  });
  tdLen.appendChild(inp);

  // From Side (Corner definition)
  const tdFrom = el('td');
  const fromSel = el('select');
  state.sides.forEach((_, i) => {
    const label = getCornerLabel(i);
    const o = el('option', { value: i, text: label });
    if (i === diag.fromSideIndex) o.selected = true;
    fromSel.appendChild(o);
  });
  fromSel.addEventListener('change', () => {
    state.diagonals[index].fromSideIndex = parseInt(fromSel.value);
    updateJsonPreview();
  });
  tdFrom.appendChild(fromSel);

  // To Side (Corner definition)
  const tdTo = el('td');
  const toSel = el('select');
  state.sides.forEach((_, i) => {
    const label = getCornerLabel(i);
    const o = el('option', { value: i, text: label });
    if (i === diag.toSideIndex) o.selected = true;
    toSel.appendChild(o);
  });
  toSel.addEventListener('change', () => {
    state.diagonals[index].toSideIndex = parseInt(toSel.value);
    updateJsonPreview();
  });
  tdTo.appendChild(toSel);

  // Delete
  const tdDel = el('td');
  tdDel.appendChild(el('button', { className: 'btn btn-danger-ghost', text: '✕', onclick: () => removeDiagonal(index) }));

  tr.append(tdIdx, tdLen, tdFrom, tdTo, tdDel);
  return tr;
}

function renderDiagonals() {
  const wrap = $('#diagonals-tbody');
  if (!wrap) return;
  wrap.innerHTML = '';
  state.diagonals.forEach((d, i) => wrap.appendChild(buildDiagonalRow(d, i)));
}

function addDiagonal() {
  state.diagonals.push({ length: 0, fromSideIndex: 0, toSideIndex: 2 });
  renderDiagonals();
  updateJsonPreview();
}

function removeDiagonal(index) {
  state.diagonals.splice(index, 1);
  renderDiagonals();
  updateJsonPreview();
}

/* ═══════════════════════════════════════════════════════════
   ROADS — Improved side selection
═══════════════════════════════════════════════════════════ */
function buildRoadRow(road, index) {
  const tr = el('tr');

  const tdIdx = el('td');
  tdIdx.textContent = index + 1;

  // Side Selector
  const tdSide = el('td');
  const sideSel = el('select');
  state.sides.forEach((s, i) => {
    const o = el('option', { value: i, text: `Side ${i + 1} (${s.direction})` });
    if (i === road.sideIndex) o.selected = true;
    sideSel.appendChild(o);
  });
  sideSel.addEventListener('change', () => {
    state.roads[index].sideIndex = parseInt(sideSel.value);
    updateJsonPreview();
  });
  tdSide.appendChild(sideSel);

  // Widths
  const tdExisting = el('td');
  const exInp = el('input', { type: 'number', placeholder: 'Ex.', min: '0' });
  exInp.value = road.existingWidth || '';
  exInp.addEventListener('input', () => {
    state.roads[index].existingWidth = parseFloat(exInp.value) || 0;
    updateJsonPreview();
  });
  tdExisting.appendChild(exInp);

  const tdProposed = el('td');
  const prInp = el('input', { type: 'number', placeholder: 'Pr.', min: '0' });
  prInp.value = road.proposedWidth || '';
  prInp.addEventListener('input', () => {
    state.roads[index].proposedWidth = parseFloat(prInp.value) || 0;
    updateJsonPreview();
  });
  tdProposed.appendChild(prInp);

  const tdDel = el('td');
  tdDel.appendChild(el('button', { className: 'btn btn-danger-ghost', text: '✕', onclick: () => removeRoad(index) }));

  tr.append(tdIdx, tdSide, tdExisting, tdProposed, tdDel);
  return tr;
}

function renderRoadsTable() {
  const tbody = $('#roads-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  state.roads.forEach((r, i) => tbody.appendChild(buildRoadRow(r, i)));
}

function addRoad() {
  state.roads.push({ sideIndex: 0, existingWidth: 0, proposedWidth: 0 });
  renderRoadsTable();
  updateJsonPreview();
}

function removeRoad(index) {
  state.roads.splice(index, 1);
  renderRoadsTable();
  updateJsonPreview();
}

/* ═══════════════════════════════════════════════════════════
   NUMERIC FIELD HELPERS — bind field → state key
═══════════════════════════════════════════════════════════ */
function bindNumericField(inputId, stateKey) {
  const inp = $(`#${inputId}`);
  if (!inp) return;
  inp.value = state[stateKey] || '';
  inp.addEventListener('input', () => {
    const v = parseFloat(inp.value);
    state[stateKey] = isNaN(v) ? 0 : v;
    updateJsonPreview();
  });
}

function bindToggle(checkboxId, stateKey) {
  const inp = $(`#${checkboxId}`);
  if (!inp) return;
  inp.checked = state[stateKey];
  inp.addEventListener('change', () => {
    state[stateKey] = inp.checked;
    updateJsonPreview();
  });
}

/* ═══════════════════════════════════════════════════════════
   VALIDATION
═══════════════════════════════════════════════════════════ */
function runValidation() {
  const errors = [];

  if (state.sides.length === 0) {
    errors.push('At least one side is required.');
  } else {
    state.sides.forEach((s, i) => {
      if (!s.length || s.length <= 0) errors.push(`Side ${i + 1}: length must be > 0.`);
    });
  }

  if (state.isRegularShape) {
    if (state.plotWidth <= 0) errors.push('Plot Width must be > 0.');
    if (state.plotDepth <= 0) errors.push('Plot Depth must be > 0.');
  } else {
    // For irregular shapes, we might need more complex validation for diagonals and sides
    // For now, just check if area can be calculated
    if (calculatePlotArea() <= 0) errors.push('Irregular plot area cannot be calculated. Check sides and diagonals.');
  }

  if (state.basicFAR <= 0) errors.push('Basic FAR must be > 0.');
  // Existing and Proposed Road Widths are now per-road, so global checks are less relevant
  // if (state.existingRoadWidth < 0) errors.push('Existing Road Width cannot be negative.');
  // if (state.proposedRoadWidth < 0) errors.push('Proposed Road Width cannot be negative.');

  if (state.frontSideIndex >= state.sides.length || state.frontSideIndex < 0) {
    errors.push('Front Side Index is out of bounds.');
  }

  state.roads.forEach((r, i) => {
    if (r.sideIndex >= state.sides.length) errors.push(`Road ${i + 1}: references a side that does not exist.`);
    if (r.existingWidth < 0) errors.push(`Road ${i + 1}: existing width cannot be negative.`);
    if (r.proposedWidth < 0) errors.push(`Road ${i + 1}: proposed width cannot be negative.`);
  });

  state.diagonals.forEach((d, i) => {
    if (d.length <= 0) errors.push(`Diagonal ${i + 1}: length must be > 0.`);
    if (d.fromSideIndex >= state.sides.length || d.fromSideIndex < 0) errors.push(`Diagonal ${i + 1}: 'From Side' index is out of bounds.`);
    if (d.toSideIndex >= state.sides.length || d.toSideIndex < 0) errors.push(`Diagonal ${i + 1}: 'To Side' index is out of bounds.`);
    if (d.fromSideIndex === d.toSideIndex) errors.push(`Diagonal ${i + 1}: 'From Side' and 'To Side' cannot be the same.`);
  });

  return errors;
}

function handleValidate() {
  const errors = runValidation();
  const panel = $('#validation-result');
  if (!panel) return;

  if (errors.length === 0) {
    panel.className = 'show ok';
    panel.innerHTML = '✅ All fields are valid. Ready to generate layout.';
    showToast('✅ Validation passed', 'success');
  } else {
    panel.className = 'show fail';
    panel.innerHTML = `<strong>⚠ ${errors.length} issue(s) found:</strong>` +
      errors.map(e => `<div>• ${e}</div>`).join('');
    showToast(`⚠ ${errors.length} validation error(s)`, 'error');
  }
}

/* ═══════════════════════════════════════════════════════════
   SAVE DRAFT — downloads state as JSON
═══════════════════════════════════════════════════════════ */
function handleSaveDraft() {
  const json = JSON.stringify(state, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `plot-config-draft-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('📁 Draft saved as JSON', 'success');
}

/* ═══════════════════════════════════════════════════════════
   GENERATE LAYOUT — placeholder action (hook for geometry engine)
═══════════════════════════════════════════════════════════ */
function handleGenerateLayout() {
  const errors = runValidation();
  if (errors.length > 0) {
    showToast('⚠ Fix validation errors first', 'error');
    handleValidate();
    return;
  }
  // Dispatch custom event so the geometry engine can listen
  document.dispatchEvent(new CustomEvent('plot:generate', { detail: { ...state } }));
  showToast('🚀 Layout generation triggered — geometry engine connected', 'success');
}

/* ═══════════════════════════════════════════════════════════
   NAV HIGHLIGHT — scroll to section on click
═══════════════════════════════════════════════════════════ */
function initNavHighlight() {
  $$('.nav-item[data-section]').forEach(item => {
    item.addEventListener('click', () => {
      const target = $(`#${item.dataset.section}`);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      $$('.nav-item').forEach(n => n.classList.remove('active'));
      item.classList.add('active');
    });
  });
}

/* ═══════════════════════════════════════════════════════════
   INITIALISE & HELPERS
═══════════════════════════════════════════════════════════ */
function init() {
  /* seed defaults */
  state.sides.push({ length: 0, direction: 'North' });
  state.sides.push({ length: 0, direction: 'East' });
  state.sides.push({ length: 0, direction: 'South' });
  state.sides.push({ length: 0, direction: 'West' });

  renderSidesTable();
  renderDiagonals();
  renderRoadsTable();

  /* Regualar Shape Toggle */
  const regToggle = $('#regular-shape-toggle');
  if (regToggle) {
    regToggle.checked = state.isRegularShape;
    regToggle.addEventListener('change', () => {
      state.isRegularShape = regToggle.checked;
      const dimSection = $('#dim-inputs');
      if (dimSection) dimSection.style.opacity = state.isRegularShape ? '1' : '0.3';
      updateJsonPreview();
    });
  }

  /* front side selector */
  const frontSel = $('#front-side-select');
  if (frontSel) {
    frontSel.addEventListener('change', () => {
      state.frontSideIndex = parseInt(frontSel.value) || 0;
      updateJsonPreview();
    });
  }

  bindNumericField('plot-width', 'plotWidth');
  bindNumericField('plot-depth', 'plotDepth');
  bindNumericField('basic-far', 'basicFAR');
  bindToggle('corner-plot', 'isCornerPlot');
  bindToggle('market-street', 'marketStreetFlag');

  initUnitToggle();

  $('#add-side-btn').addEventListener('click', () => {
    state.sides.push({ length: 0, direction: 'North' });
    renderSidesTable();
    updateJsonPreview();
  });

  $('#add-diagonal-btn').addEventListener('click', addDiagonal);
  $('#add-road-btn').addEventListener('click', addRoad);

  $('#btn-validate').addEventListener('click', handleValidate);
  $('#btn-save').addEventListener('click', handleSaveDraft);

  const genBtn = $('#btn-generate');
  if (genBtn) genBtn.addEventListener('click', handleGenerateLayout);

  const navGenBtn = $('#nav-generate');
  if (navGenBtn) navGenBtn.addEventListener('click', handleGenerateLayout);

  initNavHighlight(); // Ensure nav highlight is initialized

  updateJsonPreview();
}

document.addEventListener('DOMContentLoaded', init);
