/**
 * smart-dimension-engine.js
 * Professional Plot Dimensioning Logic for AutoCAD-grade layouts.
 */
console.log("Loading SmartDimensionEngine...");
window.SmartDimensionEngine = (function () {
    const TOLERANCE = 0.001; // meters

    /**
     * Extracts segment data from vertices.
     */
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

            // Outward normal (assuming CCW vertices)
            const nx = -dy / (len || 1);
            const ny = dx / (len || 1);

            segments.push({
                index: i,
                p1, p2,
                len,
                angle,
                midpoint: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 },
                normal: { x: nx, y: ny },
                direction: { x: dx / (len || 1), y: dy / (len || 1) }
            });
        }
        return segments;
    }

    /**
     * Classifies the shape based on segments.
     */
    function classifyShape(segments) {
        if (segments.length !== 4) return 'IRREGULAR';

        const s0 = segments[0], s1 = segments[1], s2 = segments[2], s3 = segments[3];

        // Check parallel/equal opposite sides
        const opp1Parallel = Math.abs(s0.direction.x * s2.direction.x + s0.direction.y * s2.direction.y) > (1 - TOLERANCE);
        const opp1Equal = Math.abs(s0.len - s2.len) < TOLERANCE;

        const opp2Parallel = Math.abs(s1.direction.x * s3.direction.x + s1.direction.y * s3.direction.y) > (1 - TOLERANCE);
        const opp2Equal = Math.abs(s1.len - s3.len) < TOLERANCE;

        // Check perpendicular adjacent sides
        const adjPerp = Math.abs(s0.direction.x * s1.direction.x + s0.direction.y * s1.direction.y) < TOLERANCE;

        if (opp1Parallel && opp1Equal && opp2Parallel && opp2Equal && adjPerp) {
            const allEqual = Math.abs(s0.len - s1.len) < TOLERANCE;
            return allEqual ? 'SQUARE' : 'RECTANGLE';
        }

        return 'IRREGULAR';
    }

    /**
     * Decides which segments to dimension based on suppression logic.
     */
    function getPlotDimensions(vertices, frontIndex = 0) {
        const segments = extractSegments(vertices);
        const type = classifyShape(segments);

        if (type === 'IRREGULAR') {
            return segments.map(s => ({ ...s, label: `${s.len.toFixed(2)} M` }));
        }

        const toShow = [];
        if (type === 'RECTANGLE' || type === 'SQUARE') {
            // Group indices: (0, 2) and (1, 3) are opposite pairs
            const pairs = [[0, 2], [1, 3]];

            pairs.forEach(pair => {
                const i1 = pair[0], i2 = pair[1];
                const s1 = segments[i1], s2 = segments[i2];

                // If one is front, pick it
                if (i1 === frontIndex) { toShow.push(s1); return; }
                if (i2 === frontIndex) { toShow.push(s2); return; }

                // Otherwise, pick based on spatial position (Bottom/Right preference)
                // We use the midpoint coordinate for sorting
                // For "horizontal-like" segments (angle near 0 or 180), pick lowest Y
                // For "vertical-like" segments (angle near 90 or 270), pick highest X
                const isHorizontal = Math.abs(Math.sin(s1.angle)) < 0.707;
                if (isHorizontal) {
                    // Pick lowest Y
                    toShow.push(s1.midpoint.y < s2.midpoint.y ? s1 : s2);
                } else {
                    // Pick highest X
                    toShow.push(s1.midpoint.x > s2.midpoint.x ? s1 : s2);
                }
            });

            // Special case for Square: If only 1 selected (shouldn't happen with logic above), fix it.
            // Actually, the above logic always picks 2 (one from each opposite pair).
        }

        return toShow.map(s => ({ ...s, label: `${s.len.toFixed(2)} M` }));
    }

    /**
     * Generates dimensions for setbacks and road widening.
     */
    function getComplianceDimensions(vertices, setbacks, roads) {
        const segments = extractSegments(vertices);
        const dims = [];

        roads.forEach(road => {
            const sideW = (Math.max(0, (parseFloat(road.proposedWidth) || 0) - (parseFloat(road.width) || 0)) / 2);
            if (sideW > 0) {
                const s = segments[road.sideIndex];
                dims.push({
                    p1: s.midpoint,
                    p2: { x: s.midpoint.x + s.normal.x * sideW, y: s.midpoint.y + s.normal.y * sideW },
                    label: `${sideW.toFixed(2)} M W`,
                    color: '#ef4444',
                    isInternal: true
                });
            }
        });

        if (setbacks) {
            const n = segments.length;
            const roadIndices = roads.map(r => r.sideIndex);
            const frontIndex = roadIndices.length > 0 ? roadIndices[0] : 0;

            const setbackValues = [
                setbacks.front || 0,
                setbacks.side1 || 0,
                n >= 4 ? setbacks.rear || 0 : 0,
                n >= 4 ? setbacks.side2 || 0 : 0
            ];

            segments.forEach((s, i) => {
                // Determine which setback applies to this side index relative to front
                let sbVal = 0;
                if (i === frontIndex) sbVal = setbacks.front || 0;
                else if (i === (frontIndex + 1) % n) sbVal = setbacks.side1 || 0;
                else if (n >= 4 && i === (frontIndex + 2) % n) sbVal = setbacks.rear || 0;
                else if (n >= 4 && i === (frontIndex + 3) % n) sbVal = setbacks.side2 || 0;

                if (sbVal > 0) {
                    // Check if there's widening on this side too
                    const road = roads.find(r => r.sideIndex === i);
                    const sideW = road ? (Math.max(0, (parseFloat(road.proposedWidth) || 0) - (parseFloat(road.width) || 0)) / 2) : 0;

                    const startP = {
                        x: s.midpoint.x + s.normal.x * sideW,
                        y: s.midpoint.y + s.normal.y * sideW
                    };
                    dims.push({
                        p1: startP,
                        p2: { x: startP.x + s.normal.x * sbVal, y: startP.y + s.normal.y * sbVal },
                        label: `${sbVal.toFixed(2)} M SB`,
                        color: '#eab308',
                        isInternal: true
                    });
                }
            });
        }

        return dims;
    }

    return {
        getPlotDimensions,
        getComplianceDimensions
    };
})();
