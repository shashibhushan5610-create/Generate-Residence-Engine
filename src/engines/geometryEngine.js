// geometryEngine.js — ES Module version

function solveAngle(a, b, c) {
  const val = (a * a + b * b - c * c) / (2 * a * b);
  if (val < -1 || val > 1) return 0;
  return Math.acos(val);
}

function generateVerticesFromDiagonals(sides, diagonals) {
  if (sides.length < 3) return [{ x: 0, y: 0 }];
  const vertices = [];
  vertices[0] = { x: 0, y: 0 };
  vertices[1] = { x: parseFloat(sides[0]), y: 0 };

  const angleV1 = solveAngle(sides[0], sides[1], diagonals[0] || 0);
  vertices[2] = {
    x: vertices[1].x + sides[1] * Math.cos(Math.PI - angleV1),
    y: vertices[1].y + sides[1] * Math.sin(Math.PI - angleV1),
  };

  for (let k = 1; k < sides.length - 2; k++) {
    const prevDiag = diagonals[k - 1];
    const currSide = sides[k + 1];
    const isLast = k === sides.length - 3;
    const currDiag = isLast ? sides[sides.length - 1] : (diagonals[k] || 0);
    const angleAtV0 = solveAngle(prevDiag, currDiag, currSide);
    const baseAngle = Math.atan2(
      vertices[k + 1].y - vertices[0].y,
      vertices[k + 1].x - vertices[0].x
    );
    vertices[k + 2] = {
      x: vertices[0].x + currDiag * Math.cos(baseAngle + angleAtV0),
      y: vertices[0].y + currDiag * Math.sin(baseAngle + angleAtV0),
    };
  }
  return vertices;
}

export function calculateArea(vertices) {
  if (vertices.length < 3) return 0;
  let area = 0;
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += vertices[i].x * vertices[j].y;
    area -= vertices[j].x * vertices[i].y;
  }
  return Math.abs(area) / 2;
}

function calculateClosureError(vertices, expectedLastSide) {
  if (vertices.length < 2) return 0;
  const first = vertices[0];
  const last = vertices[vertices.length - 1];
  const actualDist = Math.sqrt(
    Math.pow(last.x - first.x, 2) + Math.pow(last.y - first.y, 2)
  );
  return Math.abs(actualDist - (parseFloat(expectedLastSide) || 0));
}

function hasSelfIntersection(vertices) {
  const n = vertices.length;
  const lineIntersect = (p1, p2, p3, p4) => {
    const ccw = (A, B, C) =>
      (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x);
    if (
      (p1.x === p3.x && p1.y === p3.y) ||
      (p2.x === p3.x && p2.y === p3.y) ||
      (p1.x === p4.x && p1.y === p4.y) ||
      (p2.x === p4.x && p2.y === p4.y)
    )
      return false;
    return (
      ccw(p1, p3, p4) !== ccw(p2, p3, p4) &&
      ccw(p1, p2, p3) !== ccw(p1, p2, p4)
    );
  };
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 2; j < n - 1; j++) {
      if (i === 0 && j === n - 2) continue;
      if (
        lineIntersect(vertices[i], vertices[i + 1], vertices[j], vertices[j + 1])
      )
        return true;
    }
  }
  return false;
}

export function evaluateGeometry(stateData) {
  let vertices = [];
  let isClosed = false;
  let closureError = 0;

  if (stateData.type === 'regular') {
    const w = parseFloat(stateData.width) || 0;
    const h = parseFloat(stateData.height) || 0;
    vertices = [
      { x: 0, y: 0 },
      { x: w, y: 0 },
      { x: w, y: h },
      { x: 0, y: h },
    ];
    isClosed = true;
  } else {
    const sides = stateData.edges.map((e) => parseFloat(e.length) || 0);
    const diags = stateData.diagonals.map((d) => parseFloat(d.length) || 0);
    vertices = generateVerticesFromDiagonals(sides, diags);
    closureError = calculateClosureError(vertices, sides[sides.length - 1]);
    isClosed = closureError < 0.01;
  }

  const area = calculateArea(vertices);
  const isSelfIntersecting = hasSelfIntersection(vertices);

  let diagonalError = 0;
  if (
    stateData.type === 'irregular' &&
    stateData.edges.length === 4 &&
    stateData.diagonals.length >= 2
  ) {
    const d2Input = parseFloat(stateData.diagonals[1].length) || 0;
    if (d2Input > 0 && vertices.length >= 4) {
      const distV1V3 = Math.sqrt(
        Math.pow(vertices[3].x - vertices[1].x, 2) +
          Math.pow(vertices[3].y - vertices[1].y, 2)
      );
      diagonalError = Math.abs(distV1V3 - d2Input);
    }
  }

  return { vertices, area, isClosed, closureError, diagonalError, isSelfIntersecting };
}

export function calculateInsetPolygon(vertices, offsets) {
  if (vertices.length < 3) return [];
  const n = vertices.length;
  const lines = [];

  for (let i = 0; i < n; i++) {
    const v1 = vertices[i];
    const v2 = vertices[(i + 1) % n];
    const dx = v2.x - v1.x;
    const dy = v2.y - v1.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) continue;
    const nx = -dy / len;
    const ny = dx / len;
    const offset = offsets[i] || 0;
    lines.push({
      px: v1.x + nx * offset,
      py: v1.y + ny * offset,
      dx: dx / len,
      dy: dy / len,
    });
  }

  const insetVertices = [];
  for (let i = 0; i < lines.length; i++) {
    const l1 = lines[(i - 1 + lines.length) % lines.length];
    const l2 = lines[i];
    const det = l1.dx * (-l2.dy) - (-l2.dx) * l1.dy;
    if (Math.abs(det) < 1e-6) {
      insetVertices.push({ x: l2.px, y: l2.py });
    } else {
      const b1 = l2.px - l1.px;
      const b2 = l2.py - l1.py;
      const t1 = (b1 * (-l2.dy) - b2 * (-l2.dx)) / det;
      insetVertices.push({ x: l1.px + t1 * l1.dx, y: l1.py + t1 * l1.dy });
    }
  }
  return insetVertices;
}
