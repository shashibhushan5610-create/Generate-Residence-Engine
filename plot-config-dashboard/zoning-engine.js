// zoning-engine.js  v3.0
// Dynamic Spatial Zoning Generation Engine
// Produces 5 distinct architectural zoning strategies with:
//   - Sub-zone polygon clipping (Service / Social / Private / Threshold / Outdoor)
//   - Dashed circulation arrow paths
//   - Color coding per architectural brief
//   - Zone schedule metadata & pros/cons per strategy

window.ZoningEngine = (function () {

    // ─── Color Palette (per brief spec) ────────────────────────────────────────
    const COLORS = {
        social: { fill: 'rgba(234,179,8,0.28)', stroke: 'rgba(234,179,8,0.85)', dark_fill: 'rgba(251,191,36,0.25)', dark_stroke: 'rgba(251,191,36,0.85)', label: '#92400e', labelDk: '#fcd34d' },
        private: { fill: 'rgba(59,130,246,0.25)', stroke: 'rgba(59,130,246,0.85)', dark_fill: 'rgba(96,165,250,0.22)', dark_stroke: 'rgba(96,165,250,0.85)', label: '#1e40af', labelDk: '#93c5fd' },
        threshold: { fill: 'rgba(244,114,182,0.28)', stroke: 'rgba(244,114,182,0.85)', dark_fill: 'rgba(249,168,212,0.22)', dark_stroke: 'rgba(249,168,212,0.8)', label: '#9d174d', labelDk: '#f9a8d4' },
        service: { fill: 'rgba(249,115,22,0.25)', stroke: 'rgba(249,115,22,0.85)', dark_fill: 'rgba(251,146,60,0.22)', dark_stroke: 'rgba(251,146,60,0.85)', label: '#7c2d12', labelDk: '#fdba74' },
        outdoor: { fill: 'rgba(34,197,94,0.25)', stroke: 'rgba(34,197,94,0.85)', dark_fill: 'rgba(74,222,128,0.22)', dark_stroke: 'rgba(74,222,128,0.85)', label: '#14532d', labelDk: '#86efac' },
        master: { fill: 'rgba(167,139,250,0.28)', stroke: 'rgba(167,139,250,0.85)', dark_fill: 'rgba(196,181,253,0.22)', dark_stroke: 'rgba(196,181,253,0.8)', label: '#5b21b6', labelDk: '#c4b5fd' },
        systems: { fill: 'rgba(71,85,105,0.4)', stroke: 'rgba(51,65,85,0.9)', dark_fill: 'rgba(51,65,85,0.5)', dark_stroke: 'rgba(30,41,59,0.9)', label: '#0f172a', labelDk: '#cbd5e1' }
    };

    // ─── BHK Unit Configurations ─────────────────────────────────────────────
    const UNIT_CONFIGS = {
        '1BHK': {
            label: '1BHK Studio/Compact',
            areaRange: [0, 250],
            distribution: { Living: 0.25, Bedroom: 0.15, Kitchen: 0.08, Bath: 0.10, Circulation: 0.12, Balcony: 0.08, Core: 0.22 },
            minSizes: { master: 12, living: 20, kitchen: 4.5, bath: 3, entry: 2.25, balcony: 3 }
        },
        '2BHK': {
            label: '2BHK Standard',
            areaRange: [250, 400],
            distribution: { Living: 0.22, Bedrooms: 0.28, Kitchen: 0.10, Bath: 0.12, Circulation: 0.13, Balcony: 0.10, Core: 0.15 },
            minSizes: { master: 16, secondary: 10.5, living: 25, dining: 12, kitchen: 7, bath: 3, balcony: 6 }
        },
        '3BHK': {
            label: '3BHK Family',
            areaRange: [400, 600],
            distribution: { Living: 0.20, Bedrooms: 0.35, Kitchen: 0.12, Bath: 0.14, Circulation: 0.12, Balcony: 0.12, Core: 0.15 },
            minSizes: { master: 20, secondary: 14, living: 30, dining: 16, kitchen: 10, bath: 4.5, office: 7.5, balcony: 10 }
        },
        '4BHK+': {
            label: '4BHK+ Luxury Suite',
            areaRange: [600, Infinity],
            distribution: { Living: 0.18, Bedrooms: 0.40, Kitchen: 0.12, Bath: 0.16, Circulation: 0.10, Balcony: 0.15, Core: 0.09 },
            minSizes: { master: 30, spa_bath: 10.5, living: 40, kitchen: 15, office: 12, balcony: 20 }
        }
    };

    const SYSTEMS = {
        staircase: { w: 2.5, h: 3.5, label: 'STAIRCASE BLOCK', hatch: true },
        duct_kitchen: { w: 0.3, h: 0.3, label: 'K-SHAFT' },
        duct_bath: { w: 0.2, h: 0.2, label: 'B-SHAFT' },
        mech_shaft: { w: 0.5, h: 0.5, label: 'MEP CORE' }
    };

    function determineUnitType(area) {
        if (area <= 250) return '1BHK';
        if (area <= 400) return '2BHK';
        if (area <= 600) return '3BHK';
        return '4BHK+';
    }

    // Exposed for backwards compat (old code references ZONE_STYLES)
    const ZONE_STYLES = {
        public: { fill: COLORS.threshold.fill, fillDark: COLORS.threshold.dark_fill, stroke: COLORS.threshold.stroke, strokeDark: COLORS.threshold.dark_stroke, label: 'ENTRY / FOYER', sublabel: 'Entry · Lobby · Parking', labelColor: COLORS.threshold.label, labelDark: COLORS.threshold.labelDk },
        semiPublic: { fill: COLORS.social.fill, fillDark: COLORS.social.dark_fill, stroke: COLORS.social.stroke, strokeDark: COLORS.social.dark_stroke, label: 'SOCIAL ZONE', sublabel: 'Living · Dining · Family', labelColor: COLORS.social.label, labelDark: COLORS.social.labelDk },
        private: { fill: COLORS.private.fill, fillDark: COLORS.private.dark_fill, stroke: COLORS.private.stroke, strokeDark: COLORS.private.dark_stroke, label: 'PRIVATE ZONE', sublabel: 'Bedrooms · Study · Bath', labelColor: COLORS.private.label, labelDark: COLORS.private.labelDk },
    };

    const PRESETS = {
        auto: { public: 0.22, semiPublic: 0.30, private: 0.48 },
        compact: { public: 0.18, semiPublic: 0.25, private: 0.57 },
        open_plan: { public: 0.28, semiPublic: 0.34, private: 0.38 },
        l_shape: { public: 0.32, semiPublic: 0.28, private: 0.40 },
        solar: { public: 0.22, semiPublic: 0.30, private: 0.48 },
    };

    // ─── Strategy Metadata ────────────────────────────────────────────────────
    const STRATEGY_META = {
        auto: {
            name: 'Option 1 — Centralized Hub',
            icon: '🎯',
            concept: 'Core block in center, zones radiating symmetrically for maximum efficiency.',
            pros: ['Most efficient circulation', 'Equal access to all zones', 'Perfect for apartment stacks'],
            cons: ['Center placement can block views', 'Less linear flexibility'],
            scores: { circulation: 5, social: 4, privacy: 4, wayfinding: 5, outdoor: 4 },
        },
        compact: {
            name: 'Option 2 — Corner-Pinned',
            icon: '📌',
            concept: 'Core anchored at one corner to maximize clear floor plate area.',
            pros: ['Maximizes usable floor area', 'Excellent for linear plots', 'Clear open social zones'],
            cons: ['Unequal travel distances', 'Longer corridors in deep plots'],
            scores: { circulation: 3, social: 5, privacy: 4, wayfinding: 4, outdoor: 4 },
        },
        open_plan: {
            name: 'Option 3 — Service Segregation',
            icon: '🔄',
            concept: 'Service core at back; social zones at front for clean guest/service separation.',
            pros: ['Clean functional separation', 'Service zones hidden from view', 'Luxury feel'],
            cons: ['Requires significant building depth', 'Back access can be awkward'],
            scores: { circulation: 4, social: 3, privacy: 5, wayfinding: 4, outdoor: 5 },
        },
        l_shape: {
            name: 'Option 4 — Privacy Split',
            icon: '📂',
            concept: 'Living and bedroom wings separated by a central service core.',
            pros: ['Maximum privacy for sleeping zones', 'Excellent acoustic separation', 'Dual-aspect exposure'],
            cons: ['Double corridor length', 'Visual division of floor plate'],
            scores: { circulation: 3, social: 4, privacy: 5, wayfinding: 4, outdoor: 4 },
        },
        solar: {
            name: 'Option 5 — Open-Plan Soft Zoning',
            icon: '💨',
            concept: 'Minimal walls, mobility-driven spaces with an integrated MEP core.',
            pros: ['Maximum spatial flexibility', 'Sense of spaciousness', 'Modern lifestyle orientation'],
            cons: ['Acoustic issues', 'Cooking odors in sleeping areas'],
            scores: { circulation: 4, social: 5, privacy: 2, wayfinding: 3, outdoor: 4 },
        },
    };

    // ─── Core System Geometry ────────────────────────────────────────────────
    function createRectAt(center, w, h, angle = 0) {
        const cos = Math.cos(angle), sin = Math.sin(angle);
        const hw = w / 2, hh = h / 2;
        const pts = [
            { x: -hw, y: -hh }, { x: hw, y: -hh }, { x: hw, y: hh }, { x: -hw, y: hh }
        ];
        return pts.map(p => ({
            x: center.x + p.x * cos - p.y * sin,
            y: center.y + p.x * sin + p.y * cos
        }));
    }

    function createCoreBlock(axes, strategy) {
        const { depthAxis, widthAxis, dMin, dMax, wMin, wMax, totalDepth, totalWidth } = axes;

        // Convert projected coordinates (w, d) back to absolute (x, y) space
        const getPoint = (w, d) => ({
            x: w * widthAxis.x + d * depthAxis.x,
            y: w * widthAxis.y + d * depthAxis.y
        });

        const angle = Math.atan2(depthAxis.y, depthAxis.x) - Math.PI / 2;

        let cw = (wMin + wMax) / 2;
        let cd = (dMin + dMax) / 2;

        if (strategy === 'compact') { // Corner Pinned
            cw = wMin + SYSTEMS.staircase.w / 2 + 1.5;
            cd = dMin + SYSTEMS.staircase.h / 2 + 1.5;
        } else if (strategy === 'open_plan') { // Back Core
            cw = (wMin + wMax) / 2;
            cd = dMax - SYSTEMS.staircase.h / 2 - 1.5;
        }

        const coreCenter = getPoint(cw, cd);
        const kDuctCenter = getPoint(cw + SYSTEMS.staircase.w / 2 + 0.6, cd);
        const bDuctCenter = getPoint(cw - SYSTEMS.staircase.w / 2 - 0.6, cd);

        return {
            stairs: createRectAt(coreCenter, SYSTEMS.staircase.w, SYSTEMS.staircase.h, angle),
            kitchen_duct: createRectAt(kDuctCenter, 1.2, 0.8, angle),
            bath_duct: createRectAt(bDuctCenter, 1.2, 0.8, angle),
        };
    }

    // ─── Sutherland-Hodgman Polygon Clipping ──────────────────────────────────
    function clipPolygonByHalfPlane(polygon, ax, ay, bx, by) {
        if (!polygon || polygon.length === 0) return [];
        const result = [];
        const n = polygon.length;
        const inside = (px, py) => (bx - ax) * (py - ay) - (by - ay) * (px - ax) >= 0;
        const intersect = (p1, p2) => {
            const dx1 = p2.x - p1.x, dy1 = p2.y - p1.y;
            const dx2 = bx - ax, dy2 = by - ay;
            const denom = dx1 * dy2 - dy1 * dx2;
            if (Math.abs(denom) < 1e-10) return p1;
            const t = ((ax - p1.x) * dy2 - (ay - p1.y) * dx2) / denom;
            return { x: p1.x + t * dx1, y: p1.y + t * dy1 };
        };
        for (let i = 0; i < n; i++) {
            const curr = polygon[i], prev = polygon[(i - 1 + n) % n];
            const currIn = inside(curr.x, curr.y), prevIn = inside(prev.x, prev.y);
            if (currIn) { if (!prevIn) result.push(intersect(prev, curr)); result.push(curr); }
            else if (prevIn) result.push(intersect(prev, curr));
        }
        return result;
    }

    function clipPolygonToBand(polygon, axis, minT, maxT) {
        if (!polygon || polygon.length < 3) return [];
        const perp = { x: -axis.y, y: axis.x };
        const p1x = axis.x * minT, p1y = axis.y * minT;
        let clipped = clipPolygonByHalfPlane(polygon, p1x, p1y, p1x - perp.x, p1y - perp.y);
        const p2x = axis.x * maxT, p2y = axis.y * maxT;
        clipped = clipPolygonByHalfPlane(clipped, p2x, p2y, p2x + perp.x, p2y + perp.y);
        return clipped;
    }

    // Clip polygon to one side (perpendicular band from axis side)
    function clipPolygonToSide(polygon, axis, minT, maxT) {
        // axis here is the perpendicular (width) axis
        return clipPolygonToBand(polygon, axis, minT, maxT);
    }

    // ─── Geometry Helpers ─────────────────────────────────────────────────────
    function polygonCentroid(poly) {
        if (!poly || poly.length === 0) return { x: 0, y: 0 };
        let cx = 0, cy = 0;
        poly.forEach(v => { cx += v.x; cy += v.y; });
        return { x: cx / poly.length, y: cy / poly.length };
    }
    function projectPointsOnAxis(vertices, axis) {
        return vertices.map(v => v.x * axis.x + v.y * axis.y);
    }
    function normalize(v) {
        const len = Math.sqrt(v.x * v.x + v.y * v.y);
        if (len < 1e-10) return { x: 0, y: 0 };
        return { x: v.x / len, y: v.y / len };
    }
    function polygonArea(poly) {
        if (!poly || poly.length < 3) return 0;
        let a = 0;
        for (let i = 0; i < poly.length; i++) {
            const j = (i + 1) % poly.length;
            a += poly[i].x * poly[j].y - poly[j].x * poly[i].y;
        }
        return Math.abs(a) / 2;
    }

    // ─── Depth/Width Axis Setup ───────────────────────────────────────────────
    function buildAxes(buildableVertices, frontEdgeIndex, plotVertices, northRotation = 0) {
        const n = plotVertices.length;
        const fe1 = plotVertices[frontEdgeIndex % n];
        const fe2 = plotVertices[(frontEdgeIndex + 1) % n];
        const edgeDir = normalize({ x: fe2.x - fe1.x, y: fe2.y - fe1.y });
        const inward = { x: -edgeDir.y, y: edgeDir.x };
        const plotCentroid = polygonCentroid(plotVertices);
        const edgeMid = { x: (fe1.x + fe2.x) / 2, y: (fe1.y + fe2.y) / 2 };
        const toCentroid = { x: plotCentroid.x - edgeMid.x, y: plotCentroid.y - edgeMid.y };
        const dot = toCentroid.x * inward.x + toCentroid.y * inward.y;
        let depthAxis = dot >= 0 ? inward : { x: -inward.x, y: -inward.y };

        if (northRotation !== 0) {
            const r = (northRotation * Math.PI) / 180;
            const cos = Math.cos(r), sin = Math.sin(r);
            depthAxis = normalize({ x: depthAxis.x * cos - depthAxis.y * sin, y: depthAxis.x * sin + depthAxis.y * cos });
        }
        const widthAxis = { x: -depthAxis.y, y: depthAxis.x };

        const dProj = projectPointsOnAxis(buildableVertices, depthAxis);
        const wProj = projectPointsOnAxis(buildableVertices, widthAxis);
        return {
            depthAxis, widthAxis,
            dMin: Math.min(...dProj), dMax: Math.max(...dProj),
            wMin: Math.min(...wProj), wMax: Math.max(...wProj),
            totalDepth: Math.max(...dProj) - Math.min(...dProj),
            totalWidth: Math.max(...wProj) - Math.min(...wProj),
        };
    }

    // ─── Circulation Path Helpers ─────────────────────────────────────────────
    // Returns an array of { from:{x,y}, to:{x,y}, label } path segments
    function buildCirculationPaths(zones, strategy) {
        const paths = [];
        const getCentroid = (arr) => {
            if (!arr || arr.length === 0) return null;
            return polygonCentroid(arr);
        };
        const threshold = getCentroid(zones.threshold);
        const social = getCentroid(zones.social);
        const private_ = getCentroid(zones.private);
        const service = getCentroid(zones.service);
        const outdoor = getCentroid(zones.outdoor);

        if (threshold && social) paths.push({ from: threshold, to: social, label: 'PRIMARY', dashed: [8, 5] });
        if (social && private_) paths.push({ from: social, to: private_, label: 'PRIVATE', dashed: [6, 4] });
        if (social && service) paths.push({ from: social, to: service, label: 'SERVICE', dashed: [4, 6] });
        if (outdoor && social) paths.push({ from: outdoor, to: social, label: 'OUTDOOR', dashed: [5, 5] });

        return paths.filter(p => p.from && p.to);
    }

    // ─── Strategy Computers ───────────────────────────────────────────────────

    // OPTION 1 — CENTRALIZED HUB (auto/computeCentralizedHub)
    function computeCentralizedHub(bv, axes, preset, options = {}) {
        const { floorType = 'ground' } = options;
        const { depthAxis, widthAxis, dMin, dMax, wMin, wMax, totalDepth, totalWidth } = axes;
        const core = createCoreBlock(axes, 'auto');

        const d0 = dMin, d1 = dMin + totalDepth * 0.20, d2 = dMin + totalDepth * 0.75, d3 = dMax;
        const w1 = wMin + totalWidth * 0.35, w2 = wMin + totalWidth * 0.65;

        const threshold = clipPolygonToBand(bv, depthAxis, d0, d1);
        const midFull = clipPolygonToBand(bv, depthAxis, d1, d2);
        const social = clipPolygonToSide(midFull, widthAxis, w1, w2);
        const private_ = clipPolygonToSide(midFull, widthAxis, wMin, w1);
        const master = clipPolygonToSide(midFull, widthAxis, w2, wMax);
        const service = clipPolygonToBand(bv, depthAxis, d2, d3);

        const labels = [
            { zone: threshold, text: floorType === 'ground' ? 'PORTICO / ENTRY' : 'ENTRY FOYER', type: 'threshold' },
            { zone: social, text: 'LIVING HUB', type: 'social' },
            { zone: private_, text: 'BEDROOM 1', type: 'private' },
            { zone: master, text: 'MASTER SUITE', type: 'master' },
            { zone: service, text: 'SERVICE WING', type: 'service' }
        ];

        return {
            zones: { threshold, social, private: private_, service, outdoor: null, master },
            systems: core,
            circulation: [
                { from: polygonCentroid(threshold), to: polygonCentroid(social), label: 'ENTRY' },
                { from: polygonCentroid(social), to: polygonCentroid(private_), label: 'PRIVATE' },
                { from: polygonCentroid(social), to: polygonCentroid(master), label: 'MASTER' },
                { from: polygonCentroid(social), to: polygonCentroid(service), label: 'SERVICE' }
            ],
            labels,
            floorPlan: { type: 'Centralized Hub', efficiency: '92%' }
        };
    }

    // OPTION 2 — CORNER-PINNED (compact/computeCornerPinned)
    function computeCornerPinned(bv, axes, preset, options = {}) {
        const { floorType = 'ground' } = options;
        const { depthAxis, widthAxis, dMin, dMax, wMin, wMax, totalDepth, totalWidth } = axes;
        const core = createCoreBlock(axes, 'compact');

        const d0 = dMin, d1 = dMin + totalDepth * 0.25, d2 = dMax;
        const w0 = wMin, w1 = wMin + totalWidth * 0.45, w2 = wMax;

        const social = clipPolygonToBand(clipPolygonToSide(bv, widthAxis, w1, w2), depthAxis, d0, d1);
        const kitchen = clipPolygonToBand(clipPolygonToSide(bv, widthAxis, w0, w1), depthAxis, d0, d1);
        const private_ = clipPolygonToBand(clipPolygonToSide(bv, widthAxis, w0, w1), depthAxis, d1, d2);
        const master = clipPolygonToBand(clipPolygonToSide(bv, widthAxis, w1, w2), depthAxis, d1, d2);
        const outdoor = floorType === 'ground' ? null : clipPolygonToSide(social, widthAxis, w2 - 3, w2);

        return {
            zones: { threshold: kitchen, social, private: private_, service: kitchen, outdoor, master },
            systems: core,
            circulation: [
                { from: polygonCentroid(core.stairs), to: polygonCentroid(social), label: 'ENTRY' },
                { from: social, to: master, label: 'MASTER' },
                { from: social, to: private_, label: 'PRIVATE' }
            ],
            labels: [
                { zone: social, text: 'OPEN LIVING', type: 'social' },
                { zone: master, text: 'MASTER SUITE', type: 'master' },
                { zone: private_, text: 'BEDROOM 2', type: 'private' },
                { zone: kitchen, text: 'SERVICE CORE', type: 'service' }
            ]
        };
    }

    // OPTION 3 — SERVICE SEGREGATION (open_plan/computeServiceSegregation)
    function computeServiceSegregation(bv, axes, preset, options = {}) {
        const { floorType = 'ground' } = options;
        const { depthAxis, widthAxis, dMin, dMax, wMin, wMax, totalDepth, totalWidth } = axes;
        const core = createCoreBlock(axes, 'open_plan');

        const dSvc = dMax - totalDepth * 0.25;
        const dEntry = dMin + totalDepth * 0.15;

        const threshold = clipPolygonToBand(bv, depthAxis, dMin, dEntry);
        const social = clipPolygonToBand(bv, depthAxis, dEntry, dSvc);
        const service = clipPolygonToBand(bv, depthAxis, dSvc, dMax);
        const private_ = clipPolygonToSide(social, widthAxis, wMin, wMin + totalWidth * 0.4);
        const socialFinal = clipPolygonToSide(social, widthAxis, wMin + totalWidth * 0.4, wMax);

        return {
            zones: { threshold, social: socialFinal, private: private_, service, outdoor: null, master: null },
            systems: core,
            circulation: [
                { from: polygonCentroid(threshold), to: socialFinal, label: 'GUEST' },
                { from: socialFinal, to: service, label: 'SERVICE' },
                { from: socialFinal, to: private_, label: 'PRIVATE' }
            ],
            labels: [
                { zone: threshold, text: 'FRONT FOYER', type: 'threshold' },
                { zone: socialFinal, text: 'SOCIAL LOUNGE', type: 'social' },
                { zone: private_, text: 'GUEST SUITE', type: 'private' },
                { zone: service, text: 'BACK SERVICE CORE', type: 'service' }
            ]
        };
    }

    // OPTION 4 — PRIVACY SPLIT (l_shape/computePrivacySplit)
    function computePrivacySplit(bv, axes, preset, options = {}) {
        const { floorType = 'ground' } = options;
        const { depthAxis, widthAxis, dMin, dMax, wMin, wMax, totalDepth, totalWidth } = axes;
        const core = createCoreBlock(axes, 'auto');

        const wSplit = wMin + totalWidth * 0.45;
        const dEntry = dMin + totalDepth * 0.20;

        const leftWing = clipPolygonToSide(bv, widthAxis, wMin, wSplit);
        const rightWing = clipPolygonToSide(bv, widthAxis, wSplit, wMax);

        const threshold = clipPolygonToBand(bv, depthAxis, dMin, dEntry);
        const social = clipPolygonToBand(rightWing, depthAxis, dEntry, dMax);
        const private_ = clipPolygonToBand(leftWing, depthAxis, dEntry, dMax);

        return {
            zones: { threshold, social, private: private_, service: null, outdoor: null, master: null },
            systems: core,
            circulation: [
                { from: polygonCentroid(threshold), to: social, label: 'LIVING' },
                { from: social, to: private_, label: 'SLEEPING' }
            ],
            labels: [
                { zone: threshold, text: 'GRAND FOYER', type: 'threshold' },
                { zone: social, text: 'SOCIAL WING', type: 'social' },
                { zone: private_, text: 'PRIVATE WING', type: 'private' }
            ]
        };
    }

    // OPTION 5 — OPEN-PLAN SOFT ZONING (solar/computeOpenPlanSoft)
    function computeOpenPlanSoft(bv, axes, preset, options = {}) {
        const { floorType = 'ground' } = options;
        const { depthAxis, widthAxis, dMin, dMax, wMin, wMax, totalDepth, totalWidth } = axes;
        const core = createCoreBlock(axes, 'auto');

        const dFront = dMin + totalDepth * 0.4;
        const wSvc = wMin + totalWidth * 0.25;

        const mainSocial = clipPolygonToBand(bv, depthAxis, dMin, dFront);
        const privateBack = clipPolygonToBand(bv, depthAxis, dFront, dMax);
        const serviceStrip = clipPolygonToSide(privateBack, widthAxis, wMin, wSvc);
        const masterBack = clipPolygonToSide(privateBack, widthAxis, wSvc, wMax);

        return {
            zones: { threshold: mainSocial, social: mainSocial, private: masterBack, service: serviceStrip, outdoor: null, master: null },
            systems: core,
            circulation: [
                { from: mainSocial, to: masterBack, label: 'FLOW' },
                { from: masterBack, to: serviceStrip, label: 'SERVICE' }
            ],
            labels: [
                { zone: mainSocial, text: 'OPEN LIVING/DINING', type: 'social' },
                { zone: masterBack, text: 'LOFT SPACE', type: 'master' },
                { zone: serviceStrip, text: 'COMPACT KITCHEN', type: 'service' }
            ]
        };
    }

    // ─── Core Public API ──────────────────────────────────────────────────────
    function computeZones(buildableVertices, frontEdgeIndex, plotVertices, options = {}) {
        if (!buildableVertices || buildableVertices.length < 3) return null;

        const axes = buildAxes(buildableVertices, frontEdgeIndex, plotVertices, options.northRotation || 0);
        let strategyFn = computeCentralizedHub;

        const strategy = options.strategy || 'auto';
        if (strategy === 'compact') strategyFn = computeCornerPinned;
        else if (strategy === 'open_plan') strategyFn = computeServiceSegregation;
        else if (strategy === 'l_shape') strategyFn = computePrivacySplit;
        else if (strategy === 'solar') strategyFn = computeOpenPlanSoft;

        const preset = PRESETS[strategy] || PRESETS.auto;

        try {
            return strategyFn(buildableVertices, axes, preset, options);
        } catch (e) {
            console.error("Zoning Engine Error:", e);
            return null;
        }
    }

    return { computeZones, ZONE_STYLES, PRESETS, STRATEGY_META, COLORS };
})();
