// dimensionEngine.js — ES Module version
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
      index: i,
      p1, p2, len, angle,
      midpoint: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 },
      normal: { x: nx, y: ny },
      direction: { x: dx / (len || 1), y: dy / (len || 1) },
    });
  }
  return segments;
}

function classifyShape(segments) {
  if (segments.length !== 4) return 'IRREGULAR';
  const s0 = segments[0], s1 = segments[1], s2 = segments[2], s3 = segments[3];
  const opp1Parallel =
    Math.abs(s0.direction.x * s2.direction.x + s0.direction.y * s2.direction.y) > 1 - TOLERANCE;
  const opp1Equal = Math.abs(s0.len - s2.len) < TOLERANCE;
  const opp2Parallel =
    Math.abs(s1.direction.x * s3.direction.x + s1.direction.y * s3.direction.y) > 1 - TOLERANCE;
  const opp2Equal = Math.abs(s1.len - s3.len) < TOLERANCE;
  const adjPerp =
    Math.abs(s0.direction.x * s1.direction.x + s0.direction.y * s1.direction.y) < TOLERANCE;
  if (opp1Parallel && opp1Equal && opp2Parallel && opp2Equal && adjPerp) {
    const allEqual = Math.abs(s0.len - s1.len) < TOLERANCE;
    return allEqual ? 'SQUARE' : 'RECTANGLE';
  }
  return 'IRREGULAR';
}

export function getPlotDimensions(vertices, frontIndex = 0) {
  const segments = extractSegments(vertices);
  const type = classifyShape(segments);

  if (type === 'IRREGULAR') {
    return segments.map((s) => ({ ...s, label: `${s.len.toFixed(2)} M` }));
  }

  const toShow = [];
  if (type === 'RECTANGLE' || type === 'SQUARE') {
    const pairs = [[0, 2], [1, 3]];
    pairs.forEach((pair) => {
      const [i1, i2] = pair;
      const seg1 = segments[i1], seg2 = segments[i2];
      if (i1 === frontIndex) { toShow.push(seg1); return; }
      if (i2 === frontIndex) { toShow.push(seg2); return; }
      const isHorizontal = Math.abs(Math.sin(seg1.angle)) < 0.707;
      if (isHorizontal) {
        toShow.push(seg1.midpoint.y < seg2.midpoint.y ? seg1 : seg2);
      } else {
        toShow.push(seg1.midpoint.x > seg2.midpoint.x ? seg1 : seg2);
      }
    });
  }

  return toShow.map((s) => ({ ...s, label: `${s.len.toFixed(2)} M` }));
}

export function getComplianceDimensions(vertices, setbacks, roads) {
  const segments = extractSegments(vertices);
  const dims = [];
  const n = segments.length;

  roads.forEach((road) => {
    const sideW = Math.max(
      0,
      ((parseFloat(road.proposedWidth) || 0) - (parseFloat(road.width) || 0)) / 2
    );
    if (sideW > 0) {
      const s = segments[road.sideIndex];
      if (!s) return;
      dims.push({
        p1: s.midpoint,
        p2: { x: s.midpoint.x + s.normal.x * sideW, y: s.midpoint.y + s.normal.y * sideW },
        label: `${sideW.toFixed(2)} M W`,
        color: '#ef4444',
        isInternal: true,
      });
    }
  });

  if (setbacks) {
    const roadIndices = roads.map((r) => r.sideIndex);
    const frontIndex = roadIndices.length > 0 ? roadIndices[0] : 0;

    segments.forEach((s, i) => {
      let sbVal = 0;
      if (i === frontIndex) sbVal = setbacks.front || 0;
      else if (i === (frontIndex + 1) % n) sbVal = setbacks.side1 || 0;
      else if (n >= 4 && i === (frontIndex + 2) % n) sbVal = setbacks.rear || 0;
      else if (n >= 4 && i === (frontIndex + 3) % n) sbVal = setbacks.side2 || 0;

      if (sbVal > 0) {
        const road = roads.find((r) => r.sideIndex === i);
        const sideW = road
          ? Math.max(0, ((parseFloat(road.proposedWidth) || 0) - (parseFloat(road.width) || 0)) / 2)
          : 0;
        const startP = {
          x: s.midpoint.x + s.normal.x * sideW,
          y: s.midpoint.y + s.normal.y * sideW,
        };
        dims.push({
          p1: startP,
          p2: { x: startP.x + s.normal.x * sbVal, y: startP.y + s.normal.y * sbVal },
          label: `${sbVal.toFixed(2)} M SB`,
          color: '#eab308',
          isInternal: true,
        });
      }
    });
  }

  return dims;
}
