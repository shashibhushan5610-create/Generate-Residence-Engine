// ui-controller.js
console.log("Loading UI Controller v2.0...");

/* --- Commented out to use global SmartDimensionEngine from smart-dimension-engine.js ---
const SmartDimensionEngine = (function () {
    const TOLERANCE = 0.001;

    function extractSegments(vertices) {
        if (!vertices || vertices.length < 2) return [];
        const segments = [];
        for (let i = 0; i < vertices.length; i++) {
            const p1 = vertices[i];
            const p2 = vertices[(i + 1) % vertices.length];
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx);
            const nx = -dy / (len || 1);
            const ny = dx / (len || 1);
            segments.push({
                index: i, p1, p2, len, angle,
                midpoint: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 },
                normal: { x: nx, y: ny },
                direction: { x: dx / (len || 1), y: dy / (len || 1) }
            });
        }
        return segments;
    }

    function classifyShape(segments) {
        if (segments.length !== 4) return 'IRREGULAR';
        const s0 = segments[0], s1 = segments[1], s2 = segments[2], s3 = segments[3];
        const opp1Parallel = Math.abs(s0.direction.x * s2.direction.x + s0.direction.y * s2.direction.y) > (1 - TOLERANCE);
        const opp1Equal = Math.abs(s0.len - s2.len) < TOLERANCE;
        const opp2Parallel = Math.abs(s1.direction.x * s3.direction.x + s1.direction.y * s3.direction.y) > (1 - TOLERANCE);
        const opp2Equal = Math.abs(s1.len - s3.len) < TOLERANCE;
        const adjPerp = Math.abs(s0.direction.x * s1.direction.x + s0.direction.y * s1.direction.y) < TOLERANCE;
        if (opp1Parallel && opp1Equal && opp2Parallel && opp2Equal && adjPerp) {
            return Math.abs(s0.len - s1.len) < TOLERANCE ? 'SQUARE' : 'RECTANGLE';
        }
        return 'IRREGULAR';
    }

    function getPlotDimensions(vertices, frontIndex = 0) {
        const segments = extractSegments(vertices);
        const type = classifyShape(segments);
        if (type === 'IRREGULAR') return segments.map(s => ({ ...s, label: `${s.len.toFixed(2)} M` }));
        const toShow = [];
        const pairs = [[0, 2], [1, 3]];
        pairs.forEach(pair => {
            const i1 = pair[0], i2 = pair[1], s1 = segments[i1], s2 = segments[i2];
            if (i1 === frontIndex) { toShow.push(s1); return; }
            if (i2 === frontIndex) { toShow.push(s2); return; }
            const isHorizontal = Math.abs(Math.sin(s1.angle)) < 0.707;
            if (isHorizontal) toShow.push(s1.midpoint.y < s2.midpoint.y ? s1 : s2);
            else toShow.push(s1.midpoint.x > s2.midpoint.x ? s1 : s2);
        });
        return toShow.map(s => ({ ...s, label: `${s.len.toFixed(2)} M` }));
    }

    function getComplianceDimensions(vertices, setbacks, roads) {
        const segments = extractSegments(vertices);
        const dims = [];
        roads.forEach(road => {
            const sideW = (Math.max(0, (parseFloat(road.proposedWidth) || 0) - (parseFloat(road.width) || 0)) / 2);
            if (sideW > 0) {
                const s = segments[road.sideIndex];
                dims.push({
                    p1: s.midpoint, p2: { x: s.midpoint.x + s.normal.x * sideW, y: s.midpoint.y + s.normal.y * sideW },
                    label: `${sideW.toFixed(2)} M W`, color: '#ef4444'
                });
            }
        });
        if (setbacks) {
            const n = segments.length;
            const frontIndex = roads.length > 0 ? roads[0].sideIndex : 0;
            segments.forEach((s, i) => {
                let sbVal = 0;
                if (i === frontIndex) sbVal = setbacks.front || 0;
                else if (i === (frontIndex + 1) % n) sbVal = setbacks.side1 || 0;
                else if (n >= 4 && i === (frontIndex + 2) % n) sbVal = setbacks.rear || 0;
                else if (n >= 4 && i === (frontIndex + 3) % n) sbVal = setbacks.side2 || 0;
                if (sbVal > 0) {
                    const road = roads.find(r => r.sideIndex === i);
                    const sideW = road ? (Math.max(0, (parseFloat(road.proposedWidth) || 0) - (parseFloat(road.width) || 0)) / 2) : 0;
                    const sp = { x: s.midpoint.x + s.normal.x * sideW, y: s.midpoint.y + s.normal.y * sideW };
                    dims.push({
                        p1: sp, p2: { x: sp.x + s.normal.x * sbVal, y: sp.y + s.normal.y * sbVal },
                        label: `${sbVal.toFixed(2)} M SB`, color: '#eab308'
                    });
                }
            });
        }
        return dims;
    }
    return { getPlotDimensions, getComplianceDimensions };
})();
*/

// --- State ---
const state = {
    type: 'regular', // 'regular' or 'irregular'
    width: 10,
    height: 20,
    edges: [],
    diagonals: [],
    roads: [],
    geometry: {},
    compliance: {},
    authorityId: '',
    landUse: 'Residential',
    developmentType: 'plotted_single',
    proposedHeight: 12.5,
    isCornerPlot: false,
    farReport: null,
    totalUnits: 1,
    manualOverride: false,
    overrides: {
        frontSetback: null,
        maxFAR: null
    },
    showDimensions: true,
    serverEnvelope: null,
    serverValidation: null
};

// --- DOM Elements ---
let canvas;
let ctx;
let container;
let hudArea;
let hudPerim;
let hudError;
let hudStatus;
let hudCompliance;

// Canvas Pan & Zoom State
let zoomLevel = 1;
let panX = 0;
let panY = 0;
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;

// --- Initialization ---
function init() {
    console.log("Initializing Dashboard v2.0...");
    canvas = document.getElementById('geometry-canvas');
    ctx = canvas.getContext('2d');
    container = document.getElementById('canvas-container');

    hudArea = document.getElementById('hud-area');
    hudPerim = document.getElementById('hud-perim');
    hudStatus = document.getElementById('hud-status');
    hudError = document.getElementById('hud-error');
    hudCompliance = document.getElementById('hud-compliance');

    setupTheme();
    setupAccordions();
    setupCanvas();
    bindEvents();

    // Load Authorities
    if (window.RuleEngine && window.RuleEngine.loadAuthorities) {
        window.RuleEngine.loadAuthorities().then(authData => {
            const selectAuth = document.getElementById('select-authority');
            if (authData && selectAuth) {
                Object.keys(authData).forEach(key => {
                    if (key === 'UP_2025') {
                        const opt = document.createElement('option');
                        opt.value = key;
                        opt.textContent = authData[key].name;
                        selectAuth.appendChild(opt);
                    }
                });
                // Default to 2025 Bye-laws
                state.authorityId = 'UP_2025';
                selectAuth.value = 'UP_2025';
            }
            updateAll(); // Update after loading rules
        });
    }

    // Default irregular state (4 sides, 1 diagonal)
    state.edges = [
        { length: 15 }, { length: 25 }, { length: 15 }, { length: 25 }
    ];
    state.diagonals = [
        { length: 29.15 } // approx sqrt(15^2 + 25^2)
    ];

    updateAll();
}

// --- Setup Functions ---
function setupTheme() {
    const btn = document.getElementById('btn-theme-toggle');
    if (!btn) return;
    btn.onclick = () => {
        const html = document.documentElement;
        const current = html.getAttribute('data-theme');
        html.setAttribute('data-theme', current === 'dark' ? 'light' : 'dark');
        drawCanvas();
    };

    const btnDims = document.getElementById('btn-toggle-dims');
    if (btnDims) {
        btnDims.onclick = () => {
            state.showDimensions = !state.showDimensions;
            btnDims.textContent = `📏 Show Dims: ${state.showDimensions ? 'ON' : 'OFF'}`;
            btnDims.className = state.showDimensions ? 'btn btn-outline active' : 'btn btn-outline';
            drawCanvas();
        };
    }
}

function setupAccordions() {
    const headers = document.querySelectorAll('.step-header');
    headers.forEach(header => {
        header.onclick = () => {
            const container = header.parentElement;
            const isActive = container.classList.contains('active');

            // Close all others
            document.querySelectorAll('.step-container').forEach(c => c.classList.remove('active'));

            if (!isActive) {
                container.classList.add('active');
            }
        };
    });
}

function setupCanvas() {
    const resize = () => {
        const rect = container.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        drawCanvas();
    };
    window.addEventListener('resize', resize);
    resize();

    // Pan & Zoom Interactions
    canvas.addEventListener('mousedown', (e) => {
        isDragging = true;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        canvas.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - lastMouseX;
        const dy = e.clientY - lastMouseY;
        panX += dx;
        panY += dy;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        drawCanvas();
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
        canvas.style.cursor = 'crosshair';
    });

    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();

        // Determine zoom center
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Zoom intensity
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;

        // Adjust pan to zoom towards mouse cursor
        panX = mouseX - (mouseX - panX) * zoomFactor;
        panY = mouseY - (mouseY - panY) * zoomFactor;

        zoomLevel *= zoomFactor;

        // Clamping zoom
        zoomLevel = Math.max(0.1, Math.min(zoomLevel, 10));

        drawCanvas();
    }, { passive: false });
}

/**
 * Master update function.
 * @param {boolean} partial If true, only recalculates logic and redraws canvas (prevents sidebar re-render/focus loss).
 */
function updateAll(partial = false) {
    console.log("updateAll called, partial:", partial);
    if (!window.GeometryEngine) {
        console.error("GeometryEngine not found!");
        return;
    }

    // 1. Evaluate Geometry 
    state.geometry = window.GeometryEngine.evaluateGeometry(state);
    console.log("Geometry evaluated:", state.geometry);

    // 2. Calculate Surrendered Area (Road Widening Impact)
    state.surrenderedArea = 0;
    state.roads.forEach(road => {
        const exW = parseFloat(road.width) || 0;
        const prW = parseFloat(road.proposedWidth) || exW;
        if (prW > exW) {
            const sideWidening = (prW - exW) / 2;
            let edgeLen = 0;
            if (state.type === 'regular') {
                edgeLen = (road.sideIndex % 2 === 0) ? state.width : state.height;
            } else if (state.edges[road.sideIndex]) {
                edgeLen = state.edges[road.sideIndex].length;
            }
            state.surrenderedArea += edgeLen * sideWidening;
        }
    });
    state.remainingArea = (state.geometry.area || 0) - state.surrenderedArea;

    // 3. Evaluate Compliance Rules
    if (state.authorityId && window.RuleEngine) {
        const activeRoads = state.roads.map(r => ({
            width: Math.max(parseFloat(r.width) || 0, parseFloat(r.proposedWidth) || 0),
            isProposed: (parseFloat(r.proposedWidth) > parseFloat(r.width))
        }));

        state.compliance = window.RuleEngine.calculateRules(state.authorityId, state.landUse, state.geometry.area, activeRoads, {
            developmentType: state.developmentType,
            proposedHeight: parseFloat(state.proposedHeight),
            isCornerPlot: state.isCornerPlot,
            totalUnits: parseInt(state.totalUnits)
        });

        if (state.manualOverride) {
            if (state.overrides.frontSetback !== null) state.compliance.setbacks.front = state.overrides.frontSetback;
            if (state.overrides.maxFAR !== null) {
                state.compliance.maxFAR = state.overrides.maxFAR;
                state.compliance.maxBuiltUpArea = state.geometry.area * state.compliance.maxFAR;
            }
        }
    } else {
        state.compliance = {};
    }

    // 4. UI Sync
    updateHUD();
    updateOutputConsole();
    updateDiagnostics();

    // Only re-render sidebar structure if not a partial (typing) update
    if (!partial) {
        renderSideInputs();
        renderDiagonalInputs();
        renderRoadInputs();
    }

    drawCanvas();
    fetchBackendEnvelope();
}

/**
 * Fetches the definitive geometric envelope from the Python Microservice.
 */
async function fetchBackendEnvelope() {
    if (!state.geometry.isClosed || state.geometry.isSelfIntersecting) {
        state.serverEnvelope = null;
        state.serverValidation = null;
        return;
    }

    const frontEdges = state.roads.map(r => r.sideIndex);
    if (frontEdges.length === 0) frontEdges.push(0);

    let bType = state.landUse;
    if (bType === "Residential") bType = "Residential Plotted"; // Match Python expected string

    const reqData = {
        plot_coordinates: state.geometry.vertices.map(v => [v.x, v.y]),
        front_edge_indices: frontEdges,
        plot_area_sqm: state.geometry.area || 0,
        building_height_m: parseFloat(state.proposedHeight) || 12.5,
        building_type: bType,
        zone_type: state.authorityId === 'UP_2025' ? 'Standard' : 'Standard',
        proposed_road_widths_m: {},
        existing_road_widths_m: {},
        is_corner_plot: state.isCornerPlot,
        is_old_approved_layout: false,
        ground_coverage_sqm: 0.0,
        proposed_elements: [],
        open_space_area: state.geometry.area || 0
    };

    state.roads.forEach(r => {
        reqData.proposed_road_widths_m[r.sideIndex] = parseFloat(r.proposedWidth) || parseFloat(r.width) || 0;
        reqData.existing_road_widths_m[r.sideIndex] = parseFloat(r.width) || 0;
    });

    try {
        const res = await fetch('http://127.0.0.1:8000/api/v1/generate-envelope', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reqData)
        });
        if (res.ok) {
            const data = await res.json();
            if (data.status === 'success' && data.buildable_envelope_coords.length > 2) {
                state.serverEnvelope = data.buildable_envelope_coords.map(c => ({ x: c[0], y: c[1] }));
                state.serverValidation = data.exception_validation || null;

                // Override local compliance setbacks with server definitive ones
                if (!state.compliance) state.compliance = {};
                state.compliance.setbacks = data.setbacks_applied;

                // Only redraw if we got valid server coordinates to prevent infinite loops
                drawCanvas();
            } else {
                state.serverEnvelope = null;
            }
        }
    } catch (err) {
        console.warn("Backend API not reachable. Using local JS approximations.", err);
    }

    // Also fetch FAR report
    fetchFARReport();
}

/**
 * Fetches the FAR compliance report from the Python FAR Rule Engine.
 */
async function fetchFARReport() {
    if (!state.geometry.isClosed || state.geometry.isSelfIntersecting) {
        state.farReport = null;
        return;
    }

    const plotArea = state.geometry.area || 0;
    let wideningArea = 0;
    let maxRoadWidth = 0;
    state.roads.forEach(r => {
        const v1 = state.geometry.vertices[r.sideIndex];
        const v2 = state.geometry.vertices[(r.sideIndex + 1) % state.geometry.vertices.length];
        if (v1 && v2) {
            const edgeLen = Math.sqrt((v2.x - v1.x) ** 2 + (v2.y - v1.y) ** 2);
            const ww = Math.max(0, (parseFloat(r.proposedWidth) || 0) - (parseFloat(r.width) || 0)) / 2;
            wideningArea += edgeLen * ww;
        }
        const pw = parseFloat(r.proposedWidth) || parseFloat(r.width) || 0;
        if (pw > maxRoadWidth) maxRoadWidth = pw;
    });

    let bType = state.landUse;
    if (bType === 'Residential') bType = 'residential_plotted';
    else if (bType === 'Commercial') bType = 'commercial';
    else if (bType === 'Group Housing') bType = 'group_housing';
    else if (bType === 'Industrial') bType = 'industrial';
    else bType = 'residential_plotted';

    const reqData = {
        plot_area: plotArea,
        net_plot_area: plotArea - wideningArea,
        road_width: maxRoadWidth || 9.0,
        building_type: bType,
        zone_type: 'built_up',
        is_tod_zone: false,
        surrendered_area_for_road: wideningArea,
        green_building_rating: 'none',
        circle_rate: 0,
        proposed_extra_far_area: 0,
        spatial_elements: [],
    };

    try {
        const res = await fetch('http://127.0.0.1:8000/api/v1/calculate-far', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reqData)
        });
        if (res.ok) {
            const data = await res.json();
            if (data.status === 'success') {
                state.farReport = data.far_report;
                drawCanvas();
            }
        }
    } catch (err) {
        console.warn("FAR API not reachable.", err);
    }
}

function updateHUD() {
    if (!hudArea) return;

    const origArea = state.geometry.area || 0;
    const surrArea = state.surrenderedArea || 0;
    const remArea = state.remainingArea || 0;

    hudArea.innerHTML = `
        <div style="font-size: 1.2rem; font-weight: bold; color: var(--text-color);">${remArea.toFixed(2)}</div>
        ${surrArea > 0 ? `<div style="font-size: 0.7rem; color: #ef4444;">(Net) - ${surrArea.toFixed(2)} Surrendered</div>` : ''}
    `;

    let perim = 0;
    if (state.type === 'regular') {
        const wVal = parseFloat(state.width) || 0;
        const hVal = parseFloat(state.height) || 0;
        perim = (wVal + hVal) * 2;
    } else {
        perim = state.edges.reduce((sum, e) => sum + (parseFloat(e.length) || 0), 0);
    }
    hudPerim.textContent = perim.toFixed(2);

    hudError.textContent = state.geometry.closureError ? state.geometry.closureError.toFixed(3) : '0.000';

    if (state.geometry.isSelfIntersecting) {
        hudStatus.textContent = 'Invalid (Intersect)';
        hudStatus.className = 'metric-value status-error';
    } else if (state.geometry.isClosed) {
        hudStatus.textContent = 'Valid';
        hudStatus.className = 'metric-value status-good';
    } else {
        hudStatus.textContent = 'Open Shape';
        hudStatus.className = 'metric-value status-error';
    }

    if (state.compliance && state.compliance.maxFAR) {
        hudCompliance.style.display = 'block';
        const c = state.compliance;
        hudCompliance.innerHTML = `
            <div class="metric-row"><span class="metric-label">Max FAR</span><span class="metric-value status-good">${c.maxFAR}</span></div>
            ${c.maxPurchasableFAR ? `<div class="metric-row"><span class="metric-label">Max Purch. FAR</span><span class="metric-value">${c.maxPurchasableFAR}</span></div>` : ''}
            <div class="metric-row" style="border-top: 1px dotted var(--border-color); margin-top: 4px; padding-top: 4px;">
                <span class="metric-label">Gross Area</span><span class="metric-value" style="font-size:0.8rem">${origArea.toFixed(2)}</span>
            </div>
            <div class="metric-row"><span class="metric-label">Front SB / Max H</span><span class="metric-value">${c.setbacks?.front}m / ${c.maxHeight}m</span></div>
            ${c.parkingRequired ? `<div class="metric-row"><span class="metric-label">Parking (ECS)</span><span class="metric-value status-warn">${c.parkingRequired} Units</span></div>` : ''}
            ${c.basementRule ? `<div class="metric-row"><span class="metric-label">Basement</span><span class="metric-value" style="font-size:0.7rem">${c.basementRule}</span></div>` : ''}
        `;
    } else {
        hudCompliance.style.display = 'none';
    }
}

// --- Render Functions ---
function renderSideInputs() {
    const cont = document.getElementById('sides-container');
    if (!cont) return;
    cont.innerHTML = '';
    state.edges.forEach((edge, i) => {
        const div = document.createElement('div');
        div.className = 'list-item-header';
        div.style.marginBottom = '0.5rem';
        div.innerHTML = `
            <div style="display:flex; gap:0.5rem; align-items:center; width:100%">
                <span style="font-size:0.75rem; width:40px">S${i + 1}</span>
                <input type="number" step="0.1" value="${edge.length}" oninput="window.updateEdge(${i}, this.value)" style="flex:1; padding: 0.2rem">
                ${state.edges.length > 3 ? `<button class="btn-remove" onclick="window.removeEdge(${i})">&times;</button>` : ''}
            </div>
        `;
        cont.appendChild(div);
    });
}

function renderDiagonalInputs() {
    const cont = document.getElementById('diagonals-container');
    if (!cont) return;
    cont.innerHTML = '';

    let needed = Math.max(0, state.edges.length - 3);
    // Support redundant second diagonal for 4-sided plots (D1: V0-V2, D2: V1-V3)
    if (state.edges.length === 4) needed = 2;
    console.log("needed diagonals:", needed, "current edges:", state.edges.length);

    while (state.diagonals.length < needed) state.diagonals.push({ length: 0 });
    while (state.diagonals.length > needed) state.diagonals.pop();

    state.diagonals.forEach((diag, i) => {
        const label = (state.edges.length === 4) ? (i === 0 ? "D1 (V0-V2)" : "D2 (V1-V3)") : `D${i + 1}`;
        const div = document.createElement('div');
        div.className = 'list-item-header';
        div.style.marginBottom = '0.5rem';
        div.innerHTML = `
            <div style="display:flex; gap:0.5rem; align-items:center; width:100%">
                <span style="font-size:0.7rem; width:70px">${label}</span>
                <input type="number" step="0.1" value="${diag.length}" oninput="window.updateDiag(${i}, this.value)" style="flex:1; padding: 0.2rem">
            </div>
        `;
        cont.appendChild(div);
    });

    if (needed === 0) cont.innerHTML = '<div style="font-size:0.75rem; color:var(--text-muted)">Triangle (No diagonals needed)</div>';
}

function renderRoadInputs() {
    const cont = document.getElementById('roads-container');
    if (!cont) return;
    cont.innerHTML = '';
    state.roads.forEach((road, i) => {
        let sideOpts = '';
        const limit = state.type === 'regular' ? 4 : state.edges.length;
        for (let j = 0; j < limit; j++) {
            sideOpts += `<option value="${j}" ${road.sideIndex === j ? 'selected' : ''}>Side ${j + 1}</option>`;
        }

        const div = document.createElement('div');
        div.className = 'list-item';
        div.style.padding = '0.5rem';
        div.style.border = '1px solid var(--border-color)';
        div.style.borderRadius = '4px';
        div.style.marginBottom = '0.5rem';
        div.innerHTML = `
            <div class="list-item-header" style="justify-content: space-between; display:flex;">
                <span style="font-weight:600; font-size:0.8rem">Road ${i + 1}</span>
                <button class="btn-remove" onclick="window.removeRoad(${i})">&times;</button>
            </div>
            <div class="form-group" style="margin: 0.5rem 0">
                <label style="font-size:0.7rem">Attached To</label>
                <select onchange="window.updateRoad(${i}, 'sideIndex', this.value)" style="width:100%; padding:0.2rem">${sideOpts}</select>
            </div>
            <div class="input-row" style="display:flex; gap:0.5rem">
                <div style="flex:1">
                    <label style="font-size:0.7rem">Exist. (m)</label>
                    <input type="number" value="${road.width}" oninput="window.updateRoad(${i}, 'width', this.value)" style="width:100%; padding:0.2rem">
                </div>
                <div style="flex:1">
                    <label style="font-size:0.7rem">Prop. (m)</label>
                    <input type="number" value="${road.proposedWidth || road.width}" oninput="window.updateRoad(${i}, 'proposedWidth', this.value)" style="width:100%; padding:0.2rem">
                </div>
            </div>
        `;
        cont.appendChild(div);
    });
}

function updateDiagnostics() {
    const panel = document.getElementById('diagnostics-panel');
    if (!panel) return;
    panel.innerHTML = '';
    const add = (txt, st) => {
        const d = document.createElement('div');
        d.className = `diag-item diag-${st}`;
        d.innerHTML = `<div class="diag-icon"></div> ${txt}`;
        panel.appendChild(d);
    };

    if (state.geometry.isClosed) add('Geometry Closed', 'pass');
    else add('Geometry Open/Impossible', 'fail');

    if (state.geometry.isSelfIntersecting) add('Self-Intersection', 'fail');

    if (state.geometry.diagonalError > 0.05) {
        add(`Diag. Inconsistency: ${state.geometry.diagonalError.toFixed(2)}m`, 'warn');
    }

    state.roads.forEach(r => {
        const exW = parseFloat(r.width) || 0;
        const prW = parseFloat(r.proposedWidth) || exW;
        if (prW > exW) {
            add(`Side ${r.sideIndex + 1} Widening: ${(prW - exW).toFixed(1)}m (Surrender Required)`, 'warn');
            add('Affidavit & Land Surrender Required before permit.', 'warn');
            add('NON-COMPOUNDABLE: Construction in widening zone.', 'fail');
        }
    });
}

function updateOutputConsole() {
    const geomPre = document.getElementById('out-geom');
    const compPre = document.getElementById('out-comp');
    if (geomPre) geomPre.textContent = JSON.stringify(state.geometry, null, 2);
    if (compPre) compPre.textContent = JSON.stringify(state.compliance, null, 2);
}
/**
 * Professional Dimension Drafting Helper
 */
function drawDimension(ctx, p1, p2, text, options = {}, toScr) {
    const {
        offset = 25,
        color = '#94a3b8',
        fontSize = 11,
        arrowSize = 6,
        extLine = true
    } = options;

    const s1 = toScr(p1.x, p1.y);
    const s2 = toScr(p2.x, p2.y);

    const dx = s2.x - s1.x;
    const dy = s2.y - s1.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 5) return;

    const nx = -dy / len;
    const ny = dx / len;

    const d1 = { x: s1.x + nx * offset, y: s1.y + ny * offset };
    const d2 = { x: s2.x + nx * offset, y: s2.y + ny * offset };

    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1.2;
    ctx.font = `600 ${fontSize}px Inter`;
    ctx.textAlign = 'center';

    // Extension Lines
    if (extLine) {
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(s1.x + nx * (offset * 0.1), s1.y + ny * (offset * 0.1));
        ctx.lineTo(s1.x + nx * (offset * 1.15), s1.y + ny * (offset * 1.15));
        ctx.moveTo(s2.x + nx * (offset * 0.1), s2.y + ny * (offset * 0.1));
        ctx.lineTo(s2.x + nx * (offset * 1.15), s2.y + ny * (offset * 1.15));
        ctx.stroke();
        ctx.globalAlpha = 1.0;
    }

    // Dimension Line
    ctx.beginPath();
    ctx.moveTo(d1.x, d1.y);
    ctx.lineTo(d2.x, d2.y);
    ctx.stroke();

    // Professional Tick/Arrow
    const angle = Math.atan2(dy, dx);
    const drawTick = (pt, ang) => {
        ctx.save();
        ctx.translate(pt.x, pt.y);
        ctx.rotate(ang + Math.PI / 4);
        ctx.beginPath();
        ctx.moveTo(-arrowSize, 0); ctx.lineTo(arrowSize, 0);
        ctx.stroke();
        ctx.restore();
    };
    drawTick(d1, angle);
    drawTick(d2, angle);

    // Text
    ctx.save();
    ctx.translate((d1.x + d2.x) / 2, (d1.y + d2.y) / 2);
    let textAngle = angle;
    if (textAngle > Math.PI / 2 || textAngle < -Math.PI / 2) textAngle += Math.PI;
    ctx.rotate(textAngle);
    ctx.fillText(text, 0, -6);
    ctx.restore();

    ctx.restore();
}

/**
 * Renders an architectural Area Chart Table on the canvas.
 */
function drawAreaChart(ctx, isDark) {
    const x = 30;
    const y = canvas.height - 380;
    const rowHeight = 24;
    const col1Width = 40;
    const col2Width = 260;
    const col3Width = 100;
    const totalWidth = col1Width + col2Width + col3Width;

    // Calculate dynamic values from state
    const plotArea = state.geometry.area || 0;
    let wideningArea = 0;
    state.roads.forEach(r => {
        const side = state.geometry.vertices.length;
        const v1 = state.geometry.vertices[r.sideIndex];
        const v2 = state.geometry.vertices[(r.sideIndex + 1) % side];
        if (v1 && v2) {
            const edgeLen = Math.sqrt((v2.x - v1.x) ** 2 + (v2.y - v1.y) ** 2);
            const wWidth = Math.max(0, (parseFloat(r.proposedWidth) || 0) - (parseFloat(r.width) || 0)) / 2;
            wideningArea += edgeLen * wWidth;
        }
    });

    const netArea = plotArea - wideningArea;

    // Get buildable vertices to calculate ground coverage
    const setbacksArr = new Array(state.geometry.vertices.length).fill(0);
    const fIdx = state.roads.length > 0 ? state.roads[0].sideIndex : 0;
    const cS = state.compliance?.setbacks || {};
    setbacksArr[fIdx] = cS.front || 0;
    setbacksArr[(fIdx + 1) % setbacksArr.length] = cS.side1 || 0;
    if (setbacksArr.length >= 4) {
        setbacksArr[(fIdx + 2) % setbacksArr.length] = cS.rear || 0;
        setbacksArr[(fIdx + 3) % setbacksArr.length] = cS.side2 || 0;
    }
    const offsets = state.geometry.vertices.map((v, i) => {
        const road = state.roads.find(r => r.sideIndex === i);
        const sw = road ? (Math.max(0, (parseFloat(road.proposedWidth) || 0) - (parseFloat(road.width) || 0)) / 2) : 0;
        return sw + setbacksArr[i];
    });
    const buildable = state.serverEnvelope || (window.GeometryEngine ? window.GeometryEngine.calculateInsetPolygon(state.geometry.vertices, offsets) : []);
    const coverageArea = (window.GeometryEngine && buildable.length > 2) ? window.GeometryEngine.calculateArea(buildable) : 0;

    // Use FAR report from server if available, else fallback
    const fr = state.farReport;
    const baseFarArea = fr ? fr.base_far.area : netArea * 1.75;
    const mfarArea = fr ? fr.max_permissible_far.final_mfar_area : netArea * 2.50;
    const compFar = fr ? fr.incentives.compensatory_far_area : 0;
    const greenBonus = fr ? fr.incentives.green_bonus_area : 0;
    const baseFarRatio = fr ? fr.base_far.ratio : 1.75;

    const rows = [
        ['S.No', 'PARTICULARS', 'AREA SQ.MT.'],
        ['1', 'TOTAL AREA OF PLOT', plotArea.toFixed(2)],
        ['2', 'ROAD WIDENING AREA', wideningArea.toFixed(2)],
        ['3', 'NET PLOT AREA', netArea.toFixed(2)],
        ['4', `PERMISSIBLE FAR @ ${baseFarRatio.toFixed(2)}`, baseFarArea.toFixed(2)],
        ['5', 'MAX FAR (MFAR) AREA', (mfarArea === Infinity ? 'UR' : mfarArea.toFixed(2))],
        ['6', 'COMPENSATORY FAR', compFar.toFixed(2)],
        ['7', 'GREEN BONUS FAR', greenBonus.toFixed(2)],
        ['8', 'COVERED AREA (GF)', coverageArea.toFixed(2)],
        ['9', 'COVERED AREA (1ST FL)', coverageArea.toFixed(2)],
        ['10', 'COVERED AREA (2ND FL)', (coverageArea * 0.9).toFixed(2)],
        ['11', 'COVERED AREA (3RD FL)', (coverageArea * 0.9).toFixed(2)],
    ];

    ctx.save();
    ctx.translate(x, y);

    // Title Block
    ctx.fillStyle = isDark ? '#1e293b' : '#f8fafc';
    ctx.fillRect(0, -36, totalWidth, 36);
    ctx.strokeStyle = isDark ? '#475569' : '#000';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(0, -36, totalWidth, 36);

    ctx.fillStyle = isDark ? '#fff' : '#000';
    ctx.font = 'bold 15px Inter';
    ctx.textAlign = 'left';
    ctx.fillText("AREA CHART:-", 12, -12);

    // Data Rows
    ctx.font = '500 11px Inter';
    rows.forEach((row, i) => {
        const ry = i * rowHeight;

        // Header styling
        if (i === 0) {
            ctx.fillStyle = isDark ? 'rgba(51, 65, 85, 0.5)' : '#f1f5f9';
            ctx.fillRect(0, ry, totalWidth, rowHeight);
        }

        // Draw Cells
        ctx.strokeStyle = isDark ? 'rgba(71, 85, 105, 0.8)' : '#000';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, ry, col1Width, rowHeight);
        ctx.strokeRect(col1Width, ry, col2Width, rowHeight);
        ctx.strokeRect(col1Width + col2Width, ry, col3Width, rowHeight);

        // Text
        ctx.fillStyle = isDark ? '#cbd5e1' : '#000';
        ctx.textAlign = 'center';
        ctx.fillText(row[0], col1Width / 2, ry + 16);
        ctx.textAlign = 'left';
        ctx.fillText(row[1], col1Width + 10, ry + 16);
        ctx.textAlign = 'right';
        ctx.font = (i === 0) ? 'bold 11px Inter' : '500 11px Inter';
        ctx.fillText(row[2], totalWidth - 10, ry + 16);
    });

    ctx.restore();
}


// --- Canvas Drawing ---
function drawCanvas() {
    if (!ctx || !container) return;
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const drawColor = isDark ? '#f8fafc' : '#0f172a';
    const wideningColor = 'rgba(239, 68, 68, 0.25)';

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Grid Background (Drafting Grade)
    const gridSize = 50 * zoomLevel;
    ctx.beginPath();
    ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
    ctx.lineWidth = 0.5;
    for (let x = panX % gridSize; x < w; x += gridSize) {
        ctx.moveTo(x, 0); ctx.lineTo(x, h);
    }
    for (let y = panY % gridSize; y < h; y += gridSize) {
        ctx.moveTo(0, y); ctx.lineTo(w, y);
    }
    ctx.stroke();

    if (!state.geometry.vertices || state.geometry.vertices.length === 0) return;

    // Bounds & Scale
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    state.geometry.vertices.forEach(v => {
        minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
        minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
    });

    const pad = 40;
    const baseScale = Math.min((w - pad * 2) / (maxX - minX || 1), (h - pad * 2) / (maxY - minY || 1));
    const scale = baseScale * zoomLevel;

    const toScr = (x, y) => ({
        x: x * scale + w / 2 - ((minX + maxX) / 2) * scale + panX,
        y: -y * scale + h / 2 + ((minY + maxY) / 2) * scale + panY
    });

    // Drafting Crosshairs (Centered)
    const plotCenter = toScr((minX + maxX) / 2, (minY + maxY) / 2);
    ctx.beginPath();
    ctx.strokeStyle = isDark ? 'rgba(56, 189, 248, 0.15)' : 'rgba(14, 165, 233, 0.15)';
    ctx.lineWidth = 1;
    ctx.setLineDash([10, 5]);
    ctx.moveTo(plotCenter.x, 0); ctx.lineTo(plotCenter.x, h);
    ctx.moveTo(0, plotCenter.y); ctx.lineTo(w, plotCenter.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // 1. Road Width Visualization — Clipped to plot polygon
    // Build plot clip path
    const plotClipPath = new Path2D();
    const cp0 = toScr(state.geometry.vertices[0].x, state.geometry.vertices[0].y);
    plotClipPath.moveTo(cp0.x, cp0.y);
    for (let ci = 1; ci < state.geometry.vertices.length; ci++) {
        const cpt = toScr(state.geometry.vertices[ci].x, state.geometry.vertices[ci].y);
        plotClipPath.lineTo(cpt.x, cpt.y);
    }
    plotClipPath.closePath();

    state.roads.forEach(road => {
        if (parseFloat(road.proposedWidth) > 0) {
            const v1 = state.geometry.vertices[road.sideIndex];
            const v2 = state.geometry.vertices[(road.sideIndex + 1) % state.geometry.vertices.length];
            if (!v1 || !v2) return;

            const s1 = toScr(v1.x, v1.y);
            const s2 = toScr(v2.x, v2.y);

            const dx = v2.x - v1.x, dy = v2.y - v1.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            const in_nx = -dy / len, in_ny = dx / len;
            const out_nx = dy / len, out_ny = -dx / len;

            const exW = parseFloat(road.width) || 0;
            const prW = parseFloat(road.proposedWidth) || exW;
            const sideWidening = (prW - exW) > 0 ? (prW - exW) / 2 : 0;

            // Existing Road Shading (outside plot — no clip needed)
            const eFar1 = toScr(v1.x + out_nx * exW, v1.y + out_ny * exW);
            const eFar2 = toScr(v2.x + out_nx * exW, v2.y + out_ny * exW);
            ctx.fillStyle = 'rgba(34, 197, 94, 0.15)';
            ctx.beginPath();
            ctx.moveTo(s1.x, s1.y); ctx.lineTo(s2.x, s2.y); ctx.lineTo(eFar2.x, eFar2.y); ctx.lineTo(eFar1.x, eFar1.y);
            ctx.fill();

            // Road Widening Hatch — Clipped inside plot polygon only
            if (sideWidening > 0) {
                ctx.save();
                ctx.clip(plotClipPath);
                const wIn1 = toScr(v1.x + in_nx * sideWidening, v1.y + in_ny * sideWidening);
                const wIn2 = toScr(v2.x + in_nx * sideWidening, v2.y + in_ny * sideWidening);
                ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
                ctx.beginPath();
                ctx.moveTo(s1.x, s1.y); ctx.lineTo(s2.x, s2.y); ctx.lineTo(wIn2.x, wIn2.y); ctx.lineTo(wIn1.x, wIn1.y);
                ctx.fill();
                // Cross-hatch lines for widening
                ctx.strokeStyle = 'rgba(239, 68, 68, 0.35)';
                ctx.lineWidth = 0.8;
                const edgeAngle = Math.atan2(s2.y - s1.y, s2.x - s1.x);
                const hatchSpacing = 8;
                const hatchLen = Math.sqrt((wIn2.x - s2.x) ** 2 + (wIn2.y - s2.y) ** 2) + Math.sqrt((s2.x - s1.x) ** 2 + (s2.y - s1.y) ** 2);
                for (let ht = -hatchLen; ht < hatchLen * 2; ht += hatchSpacing) {
                    const hx = s1.x + Math.cos(edgeAngle) * ht;
                    const hy = s1.y + Math.sin(edgeAngle) * ht;
                    ctx.beginPath();
                    ctx.moveTo(hx, hy);
                    ctx.lineTo(hx + (wIn1.x - s1.x) * 1.5, hy + (wIn1.y - s1.y) * 1.5);
                    ctx.stroke();
                }
                ctx.restore();
            }
        }
    });

    // 2. Plot Outline & Side Dimensions
    ctx.beginPath();
    const pStart = toScr(state.geometry.vertices[0].x, state.geometry.vertices[0].y);
    ctx.moveTo(pStart.x, pStart.y);
    for (let i = 1; i < state.geometry.vertices.length; i++) {
        const pt = toScr(state.geometry.vertices[i].x, state.geometry.vertices[i].y);
        ctx.lineTo(pt.x, pt.y);
    }
    if (state.geometry.isClosed) ctx.closePath();
    ctx.strokeStyle = state.geometry.isSelfIntersecting ? '#ef4444' : drawColor;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // 2. Smart Dimensions — Show ALL sides for irregular plots
    if (state.showDimensions) {
        const frontIdx = state.roads.length > 0 ? state.roads[0].sideIndex : 0;
        const engine = SmartDimensionEngine;
        const verts = state.geometry.vertices;

        if (state.type === 'irregular') {
            // Show every single side dimension for irregular plots
            for (let si = 0; si < verts.length; si++) {
                const p1 = verts[si];
                const p2 = verts[(si + 1) % verts.length];
                const edgeLen = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
                drawDimension(ctx, p1, p2, `${edgeLen.toFixed(2)} M`, {
                    offset: 35,
                    color: isDark ? '#60a5fa' : '#2563eb'
                }, toScr);
            }
        } else {
            const plotDims = engine.getPlotDimensions(verts, frontIdx);
            plotDims.forEach(d => {
                drawDimension(ctx, d.p1, d.p2, d.label, {
                    offset: 35,
                    color: isDark ? '#60a5fa' : '#2563eb'
                }, toScr);
            });
        }

        if (state.geometry.isClosed && !state.geometry.isSelfIntersecting && state.compliance) {
            const compDims = engine.getComplianceDimensions(
                verts,
                state.compliance.setbacks,
                state.roads
            );
            compDims.forEach(d => {
                drawDimension(ctx, d.p1, d.p2, d.label, {
                    offset: 0,
                    color: d.color,
                    fontSize: 9,
                    extLine: false
                }, toScr);
            });
        }
    }


    // 3. Compliance & Buildable Area with Setback Hatching
    if (state.geometry.isClosed && !state.geometry.isSelfIntersecting && state.compliance && state.compliance.setbacks) {
        const nSides = state.geometry.vertices.length;
        const setbacksArr = new Array(nSides).fill(0);
        const fIdx = state.roads.length > 0 ? state.roads[0].sideIndex : 0;
        const cS = state.compliance.setbacks;
        setbacksArr[fIdx % nSides] = cS.front || 0;
        setbacksArr[(fIdx + 1) % nSides] = cS.side1 || 0;
        if (nSides >= 4) {
            setbacksArr[(fIdx + 2) % nSides] = cS.rear || 0;
            setbacksArr[(fIdx + 3) % nSides] = cS.side2 || 0;
        }

        const effectiveOffsets = state.geometry.vertices.map((v, i) => {
            const road = state.roads.find(r => r.sideIndex === i);
            const sideW = road ? (Math.max(0, (parseFloat(road.proposedWidth) || 0) - (parseFloat(road.width) || 0)) / 2) : 0;
            return sideW + setbacksArr[i];
        });

        // Use definitive Server Envelope if running, otherwise fallback to local basic approximation
        const buildableVertices = state.serverEnvelope || window.GeometryEngine.calculateInsetPolygon(state.geometry.vertices, effectiveOffsets);
        const buildableArea = window.GeometryEngine.calculateArea(buildableVertices);

        if (buildableVertices.length > 2) {
            // --- Setback Hatching ---
            // Draw hatched area between plot outline and buildable envelope
            ctx.save();
            // Create a path that is the plot outline minus the buildable area (the setback band)
            ctx.beginPath();
            // Outer path (plot) — clockwise
            const pv0 = toScr(state.geometry.vertices[0].x, state.geometry.vertices[0].y);
            ctx.moveTo(pv0.x, pv0.y);
            for (let pi = 1; pi < state.geometry.vertices.length; pi++) {
                const pvt = toScr(state.geometry.vertices[pi].x, state.geometry.vertices[pi].y);
                ctx.lineTo(pvt.x, pvt.y);
            }
            ctx.closePath();
            // Inner path (buildable) — counter-clockwise to cut out
            const bv0 = toScr(buildableVertices[buildableVertices.length - 1].x, buildableVertices[buildableVertices.length - 1].y);
            ctx.moveTo(bv0.x, bv0.y);
            for (let bi = buildableVertices.length - 2; bi >= 0; bi--) {
                const bvt = toScr(buildableVertices[bi].x, buildableVertices[bi].y);
                ctx.lineTo(bvt.x, bvt.y);
            }
            ctx.closePath();
            ctx.fillStyle = 'rgba(234, 179, 8, 0.08)';
            ctx.fill();
            // Diagonal hatch lines in the setback band
            ctx.clip();
            ctx.strokeStyle = 'rgba(234, 179, 8, 0.3)';
            ctx.lineWidth = 0.6;
            const hatchStep = 10;
            for (let hl = -h; hl < w + h; hl += hatchStep) {
                ctx.beginPath();
                ctx.moveTo(hl, 0);
                ctx.lineTo(hl + h, h);
                ctx.stroke();
            }
            ctx.restore();

            // --- Setback dimension labels on each edge ---
            const verts = state.geometry.vertices;
            for (let si = 0; si < nSides; si++) {
                const sbVal = setbacksArr[si];
                if (sbVal <= 0) continue;
                const ev1 = verts[si];
                const ev2 = verts[(si + 1) % nSides];
                const emx = (ev1.x + ev2.x) / 2;
                const emy = (ev1.y + ev2.y) / 2;
                const edx = ev2.x - ev1.x, edy = ev2.y - ev1.y;
                const elen = Math.sqrt(edx * edx + edy * edy);
                const enx = -edy / elen, eny = edx / elen;
                // Place text at setback midpoint
                const road = state.roads.find(r => r.sideIndex === si);
                const sideW = road ? (Math.max(0, (parseFloat(road.proposedWidth) || 0) - (parseFloat(road.width) || 0)) / 2) : 0;
                const textDist = sideW + sbVal / 2;
                const labelPt = toScr(emx + enx * textDist, emy + eny * textDist);
                ctx.save();
                ctx.fillStyle = '#eab308';
                ctx.font = 'bold 10px Inter';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const textAngle = Math.atan2(-(ev2.y - ev1.y) * scale, (ev2.x - ev1.x) * scale);
                let ta = textAngle;
                if (ta > Math.PI / 2 || ta < -Math.PI / 2) ta += Math.PI;
                ctx.translate(labelPt.x, labelPt.y);
                ctx.rotate(ta);
                ctx.fillText(`Setback ${sbVal.toFixed(1)}m`, 0, 0);
                ctx.restore();
            }

            // --- Buildable Envelope Outline ---
            ctx.beginPath();
            const startPt = toScr(buildableVertices[0].x, buildableVertices[0].y);
            ctx.moveTo(startPt.x, startPt.y);
            buildableVertices.forEach(v => {
                const pt = toScr(v.x, v.y);
                ctx.lineTo(pt.x, pt.y);
            });
            ctx.closePath();
            ctx.strokeStyle = '#eab308';
            ctx.lineWidth = 2.5;
            ctx.stroke();
            ctx.fillStyle = 'rgba(234, 179, 8, 0.15)';
            ctx.fill();

            // Buildable Area Label
            let cx = 0, cy = 0;
            buildableVertices.forEach(v1 => { cx += v1.x; cy += v1.y; });
            const centerScr = toScr(cx / buildableVertices.length, cy / buildableVertices.length);
            ctx.fillStyle = '#eab308'; ctx.font = 'bold 12px Inter'; ctx.textAlign = 'center';
            ctx.fillText(`BUILDABLE AREA: ${buildableArea.toFixed(2)} sqm`, centerScr.x, centerScr.y);
        }
    }

    // 5. Diagonals with annotations
    if (state.type === 'irregular') {
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.2)';
        ctx.lineWidth = 1;

        state.diagonals.forEach((d, i) => {
            let dp1, dp2, diagLabel;
            if (state.edges.length === 4 && i === 1) {
                dp1 = state.geometry.vertices[1];
                dp2 = state.geometry.vertices[3];
                diagLabel = `D2: ${d.length.toFixed(2)}m`;
            } else {
                dp1 = state.geometry.vertices[0];
                dp2 = state.geometry.vertices[i + 2];
                diagLabel = state.edges.length === 4 ? `D1: ${d.length.toFixed(2)}m` : `D${i + 1}: ${d.length.toFixed(2)}m`;
            }
            if (dp1 && dp2) {
                const ds1 = toScr(dp1.x, dp1.y);
                const ds2 = toScr(dp2.x, dp2.y);
                ctx.beginPath(); ctx.moveTo(ds1.x, ds1.y); ctx.lineTo(ds2.x, ds2.y); ctx.stroke();

                // Diagonal annotation text
                ctx.save();
                ctx.setLineDash([]);
                const dmx = (ds1.x + ds2.x) / 2;
                const dmy = (ds1.y + ds2.y) / 2;
                const dAngle = Math.atan2(ds2.y - ds1.y, ds2.x - ds1.x);
                let dtAngle = dAngle;
                if (dtAngle > Math.PI / 2 || dtAngle < -Math.PI / 2) dtAngle += Math.PI;
                ctx.translate(dmx, dmy);
                ctx.rotate(dtAngle);
                ctx.fillStyle = isDark ? 'rgba(168, 162, 158, 0.9)' : 'rgba(87, 83, 78, 0.9)';
                ctx.font = '600 9px Inter';
                ctx.textAlign = 'center';
                ctx.fillText(diagLabel, 0, -6);
                ctx.restore();
            }
        });
        ctx.setLineDash([]);
    }

    // 6. Nodes
    state.geometry.vertices.forEach((v, i) => {
        const pt = toScr(v.x, v.y);
        ctx.fillStyle = '#3b82f6';
        ctx.beginPath(); ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = drawColor; ctx.font = '9px Inter';
        ctx.fillText(`V${i}`, pt.x + 5, pt.y - 5);
    });

    // 7. Area Chart Table
    drawAreaChart(ctx, isDark);
}

// --- Global Handlers ---
window.updateEdge = (i, val) => { state.edges[i].length = parseFloat(val) || 0; updateAll(true); };
window.removeEdge = (i) => { state.edges.splice(i, 1); updateAll(); };
window.updateDiag = (i, val) => { state.diagonals[i].length = parseFloat(val) || 0; updateAll(true); };
window.updateRoad = (i, field, val) => {
    state.roads[i][field] = field === 'sideIndex' ? parseInt(val) : parseFloat(val);
    updateAll(field !== 'sideIndex'); // Partial update if only changing width
};
window.removeRoad = (i) => { state.roads.splice(i, 1); updateAll(); };

function bindEvents() {
    const toggle = (mode) => {
        state.type = mode;
        const regBtn = document.getElementById('btn-mode-regular');
        const irrBtn = document.getElementById('btn-mode-irregular');
        if (regBtn) regBtn.classList.toggle('active', mode === 'regular');
        if (irrBtn) irrBtn.classList.toggle('active', mode === 'irregular');

        const regIn = document.getElementById('regular-inputs');
        const irrIn = document.getElementById('irregular-inputs');
        if (regIn) regIn.style.display = mode === 'regular' ? 'block' : 'none';
        if (irrIn) irrIn.style.display = mode === 'irregular' ? 'block' : 'none';

        updateAll();
    };

    const rBtn = document.getElementById('btn-mode-regular');
    const iBtn = document.getElementById('btn-mode-irregular');
    if (rBtn) rBtn.onclick = () => toggle('regular');
    if (iBtn) iBtn.onclick = () => toggle('irregular');

    const rw = document.getElementById('input-reg-width');
    const rh = document.getElementById('input-reg-height');
    if (rw) rw.oninput = (e) => { state.width = e.target.value; updateAll(true); };
    if (rh) rh.oninput = (e) => { state.height = e.target.value; updateAll(true); };

    const addSide = document.getElementById('btn-add-side');
    if (addSide) addSide.onclick = () => { state.edges.push({ length: 15 }); updateAll(); };

    const addDiag = document.getElementById('btn-add-diag');
    if (addDiag) addDiag.onclick = () => { state.diagonals.push({ length: 20 }); updateAll(); };

    const addRoad = document.getElementById('btn-add-road');
    if (addRoad) addRoad.onclick = () => { state.roads.push({ sideIndex: 0, width: 9, proposedWidth: 12 }); updateAll(); };

    const selAuth = document.getElementById('select-authority');
    if (selAuth) selAuth.onchange = (e) => {
        state.authorityId = e.target.value;
        const compPanel = document.getElementById('compliance-type-selector');
        if (compPanel) {
            // Show advanced inputs for comprehensive rule engines
            const authData = window.AUTHORITIES_DATA?.authorities?.[state.authorityId];
            compPanel.style.display = (authData?.type === 'comprehensive') ? 'block' : 'none';
        }
        updateAll();
    };

    const selDev = document.getElementById('select-dev-type');
    if (selDev) selDev.onchange = (e) => { state.developmentType = e.target.value; updateAll(); };

    const inH = document.getElementById('input-prop-height');
    if (inH) inH.oninput = (e) => { state.proposedHeight = e.target.value; updateAll(); };

    const inU = document.getElementById('input-total-units');
    if (inU) inU.oninput = (e) => { state.totalUnits = e.target.value; updateAll(); };

    const chkC = document.getElementById('check-corner-plot');
    if (chkC) chkC.onchange = (e) => { state.isCornerPlot = e.target.checked; updateAll(); };

    const selLand = document.getElementById('select-land-use');
    if (selLand) selLand.onchange = (e) => { state.landUse = e.target.value; updateAll(); };

    const togOv = document.getElementById('toggle-override');
    if (togOv) togOv.onchange = (e) => {
        state.manualOverride = e.target.checked;
        const ovCont = document.getElementById('override-container');
        if (ovCont) ovCont.style.display = state.manualOverride ? 'block' : 'none';
        updateAll();
    };

    const expDxf = document.getElementById('btn-export-dxf');
    if (expDxf) expDxf.onclick = () => {
        if (!window.DXFExporter) return;
        const dxf = window.DXFExporter.exportToDXF(state.geometry, state.compliance, state.roads);
        const blob = new Blob([dxf], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'plot.dxf'; a.click();
    };

    // Tab toggling for output
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.onclick = () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const targetId = tab.getAttribute('data-target');
            document.getElementById('out-geom').style.display = targetId === 'out-geom' ? 'block' : 'none';
            document.getElementById('out-comp').style.display = targetId === 'out-comp' ? 'block' : 'none';
        };
    });

    // Layout Persistence
    const btnSave = document.getElementById('btn-save-layout');
    if (btnSave) {
        btnSave.onclick = () => {
            const nameInput = document.getElementById('input-layout-name');
            const name = nameInput ? nameInput.value.trim() : '';
            if (!name) { alert('Please enter a name for the layout'); return; }
            saveLayout(name);
            nameInput.value = '';
        };
    }
    updateSavedList();
}

function saveLayout(name) {
    const saved = JSON.parse(localStorage.getItem('plot_layouts') || '{}');
    saved[name] = {
        type: state.type,
        width: state.width,
        height: state.height,
        edges: JSON.parse(JSON.stringify(state.edges)),
        diagonals: JSON.parse(JSON.stringify(state.diagonals)),
        roads: JSON.parse(JSON.stringify(state.roads)),
        authorityId: state.authorityId,
        landUse: state.landUse,
        developmentType: state.developmentType,
        proposedHeight: state.proposedHeight,
        totalUnits: state.totalUnits,
        isCornerPlot: state.isCornerPlot
    };
    localStorage.setItem('plot_layouts', JSON.stringify(saved));
    updateSavedList();
}

function loadLayout(name) {
    const saved = JSON.parse(localStorage.getItem('plot_layouts') || '{}');
    const layout = saved[name];
    if (!layout) return;

    Object.assign(state, layout);

    // Explicitly update DOM values to reflect state
    const selAuth = document.getElementById('select-authority');
    if (selAuth) selAuth.value = state.authorityId;

    const selLand = document.getElementById('select-land-use');
    if (selLand) selLand.value = state.landUse;

    const selDev = document.getElementById('select-dev-type');
    if (selDev) selDev.value = state.developmentType;

    const inH = document.getElementById('input-prop-height');
    if (inH) inH.value = state.proposedHeight;

    const inU = document.getElementById('input-total-units');
    if (inU) inU.value = state.totalUnits;

    const chkC = document.getElementById('check-corner-plot');
    if (chkC) chkC.checked = state.isCornerPlot;

    const regW = document.getElementById('input-reg-width');
    if (regW) regW.value = state.width;

    const regH = document.getElementById('input-reg-height');
    if (regH) regH.value = state.height;

    updateAll();
}

function deleteLayout(name) {
    const saved = JSON.parse(localStorage.getItem('plot_layouts') || '{}');
    delete saved[name];
    localStorage.setItem('plot_layouts', JSON.stringify(saved));
    updateSavedList();
}

function updateSavedList() {
    const listCont = document.getElementById('saved-layouts-list');
    if (!listCont) return;

    const saved = JSON.parse(localStorage.getItem('plot_layouts') || '{}');
    const keys = Object.keys(saved);

    // Keep the label
    listCont.innerHTML = '<label>Load Saved Layouts</label>';

    if (keys.length === 0) {
        const msg = document.createElement('div');
        msg.style.fontSize = '0.8rem';
        msg.style.color = 'var(--text-muted)';
        msg.textContent = 'No layouts saved yet.';
        listCont.appendChild(msg);
        return;
    }

    keys.forEach(key => {
        const item = document.createElement('div');
        item.className = 'saved-layout-item';
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        item.style.alignItems = 'center';
        item.style.padding = '0.5rem';
        item.style.marginBottom = '0.3rem';
        item.style.background = 'rgba(255,255,255,0.05)';
        item.style.borderRadius = '4px';
        item.style.fontSize = '0.85rem';

        const nameSpan = document.createElement('span');
        nameSpan.textContent = key;
        nameSpan.style.cursor = 'pointer';
        nameSpan.style.flex = '1';
        nameSpan.onclick = () => loadLayout(key);

        const actions = document.createElement('div');
        actions.style.display = 'flex';
        actions.style.gap = '0.5rem';

        const loadBtn = document.createElement('button');
        loadBtn.textContent = 'Load';
        loadBtn.className = 'btn btn-outline';
        loadBtn.style.padding = '2px 8px';
        loadBtn.style.fontSize = '0.7rem';
        loadBtn.onclick = () => loadLayout(key);

        const delBtn = document.createElement('button');
        delBtn.textContent = '×';
        delBtn.className = 'btn btn-outline';
        delBtn.style.padding = '2px 8px';
        delBtn.style.fontSize = '0.8rem';
        delBtn.style.borderColor = '#f87171';
        delBtn.style.color = '#f87171';
        delBtn.onclick = (e) => { e.stopPropagation(); deleteLayout(key); };

        actions.appendChild(loadBtn);
        actions.appendChild(delBtn);
        item.appendChild(nameSpan);
        item.appendChild(actions);
        listCont.appendChild(item);
    });
}

// Start
document.addEventListener('DOMContentLoaded', init);
