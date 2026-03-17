import { useRef, useEffect, useState, useCallback } from 'react';
import { Stage, Layer, Line, Circle, Text, Arrow, Group } from 'react-konva';
import { calculateInsetPolygon } from '../engines/geometryEngine.js';
import { getPlotDimensions, getComplianceDimensions } from '../engines/dimensionEngine.js';

const THEME = {
  dark: {
    bg: '#0f172a',
    grid: 'rgba(255,255,255,0.05)',
    plotFill: 'rgba(59,130,246,0.12)',
    plotStroke: '#3b82f6',
    buildFill: 'rgba(34,197,94,0.15)',
    buildStroke: '#22c55e',
    roadFill: 'rgba(239,68,68,0.18)',
    roadStroke: '#ef4444',
    dimStroke: '#eab308',
    dimText: '#fbbf24',
    sbStroke: '#a78bfa',
    sbText: '#c4b5fd',
    vertex: '#60a5fa',
    vertexActive: '#f59e0b',
    hudBg: 'rgba(15,23,42,0.88)',
    hudText: '#e2e8f0',
    hudMuted: '#94a3b8',
  },
  light: {
    bg: '#f1f5f9',
    grid: 'rgba(0,0,0,0.05)',
    plotFill: 'rgba(59,130,246,0.07)',
    plotStroke: '#2563eb',
    buildFill: 'rgba(22,163,74,0.08)',
    buildStroke: '#16a34a',
    roadFill: 'rgba(220,38,38,0.1)',
    roadStroke: '#dc2626',
    dimStroke: '#ca8a04',
    dimText: '#92400e',
    sbStroke: '#7c3aed',
    sbText: '#5b21b6',
    vertex: '#2563eb',
    vertexActive: '#d97706',
    hudBg: 'rgba(255,255,255,0.92)',
    hudText: '#0f172a',
    hudMuted: '#64748b',
  },
};

const ZOOM_SCALE = 1.15;
const MIN_ZOOM = 0.05;
const MAX_ZOOM = 50;

function flatPts(pts) {
  return pts.flatMap((p) => [p.x, p.y]);
}

function buildOffsets(vertices, complianceResult, roads) {
  const n = vertices.length;
  const offsets = new Array(n).fill(0);
  if (complianceResult?.setbacks) {
    const fIndex = roads.length > 0 ? roads[0].sideIndex : 0;
    offsets[fIndex % n] = complianceResult.setbacks.front || 0;
    offsets[(fIndex + 1) % n] = complianceResult.setbacks.side1 || 0;
    if (n >= 4) {
      offsets[(fIndex + 2) % n] = complianceResult.setbacks.rear || 0;
      offsets[(fIndex + 3) % n] = complianceResult.setbacks.side2 || 0;
    }
  }
  roads.forEach((road) => {
    const sideW = Math.max(
      0,
      ((parseFloat(road.proposedWidth) || 0) - (parseFloat(road.width) || 0)) / 2
    );
    if (road.sideIndex < n) offsets[road.sideIndex] += sideW;
  });
  return offsets;
}

// Compute initial fit-to-view transform (stage x/y/scale)
function fitTransform(vertices, width, height, padding = 80) {
  if (!vertices || vertices.length === 0) return { x: 0, y: 0, scale: 1 };
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  vertices.forEach((v) => {
    minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
    minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
  });
  const plotW = maxX - minX || 1;
  const plotH = maxY - minY || 1;
  const scale = Math.min((width - padding * 2) / plotW, (height - padding * 2) / plotH);
  // Konva Y-axis is top-down; our world is bottom-up, so flip Y
  const stageX = (width - plotW * scale) / 2 - minX * scale;
  const stageY = (height + plotH * scale) / 2 + minY * scale; // flipped
  return { x: stageX, y: stageY, scale };
}

// Convert world {x,y} → stage coords (Konva handles the rest via stage transform)
// In our world Y is up; Konva Y is down. We negate Y here.
function w2s(v) {
  return { x: v.x, y: -v.y };
}

function DimLine({ p1, p2, label, offsetPx = 24, color, textColor, fontSize = 10, stageScale }) {
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.5) return null;

  // Scale offset inversely so dims stay visually consistent at any zoom
  const scaledOff = offsetPx / stageScale;
  const nx = -dy / len, ny = dx / len;
  const d1 = { x: p1.x + nx * scaledOff, y: p1.y + ny * scaledOff };
  const d2 = { x: p2.x + nx * scaledOff, y: p2.y + ny * scaledOff };
  const mid = { x: (d1.x + d2.x) / 2, y: (d1.y + d2.y) / 2 };
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const scaledFont = fontSize / stageScale;
  const scaledStroke = 1 / stageScale;
  const arrowSize = 6 / stageScale;

  return (
    <Group>
      <Line points={[p1.x, p1.y, d1.x, d1.y]} stroke={color} strokeWidth={scaledStroke} opacity={0.6} />
      <Line points={[p2.x, p2.y, d2.x, d2.y]} stroke={color} strokeWidth={scaledStroke} opacity={0.6} />
      <Arrow
        points={[d2.x, d2.y, d1.x, d1.y]}
        stroke={color} strokeWidth={scaledStroke} fill={color}
        pointerLength={arrowSize} pointerWidth={arrowSize * 0.7}
        pointerAtBeginning
      />
      <Text
        text={label}
        x={mid.x} y={mid.y - scaledFont * 1.4}
        fontSize={scaledFont}
        fill={textColor}
        fontFamily="Inter, system-ui, sans-serif"
        fontStyle="bold"
        align="center"
        offsetX={(label.length * scaledFont * 0.3)}
        rotation={angle > 90 || angle < -90 ? angle + 180 : angle}
      />
    </Group>
  );
}

function SetbackDim({ p1, p2, label, color, textColor, stageScale }) {
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.2) return null;
  const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  const scaledFont = 9 / stageScale;
  const scaledStroke = 1.5 / stageScale;
  const arrowSize = 5 / stageScale;

  return (
    <Group>
      <Arrow
        points={[p1.x, p1.y, p2.x, p2.y]}
        stroke={color} strokeWidth={scaledStroke} fill={color}
        pointerLength={arrowSize} pointerWidth={arrowSize * 0.8}
        dash={[4 / stageScale, 3 / stageScale]}
      />
      <Text
        text={label}
        x={mid.x + 2 / stageScale} y={mid.y - scaledFont}
        fontSize={scaledFont}
        fill={textColor}
        fontFamily="Inter, system-ui, sans-serif"
        fontStyle="bold"
      />
    </Group>
  );
}

const ZONE_COLORS = {
  threshold: { fill: 'rgba(244,114,182,0.28)', stroke: 'rgba(244,114,182,0.85)' },
  social:    { fill: 'rgba(234,179,8,0.28)',   stroke: 'rgba(234,179,8,0.85)'   },
  private:   { fill: 'rgba(59,130,246,0.25)',  stroke: 'rgba(59,130,246,0.85)'  },
  service:   { fill: 'rgba(249,115,22,0.25)',  stroke: 'rgba(249,115,22,0.85)'  },
  outdoor:   { fill: 'rgba(34,197,94,0.25)',   stroke: 'rgba(34,197,94,0.85)'   },
  master:    { fill: 'rgba(167,139,250,0.28)', stroke: 'rgba(167,139,250,0.85)' },
};

export default function CanvasView({
  geoResult, buildableVertices, complianceResult, roads, showDims,
  showZones, showWalls, zoningResult, northAngle, theme,
  onVertexDrag, onVertexDragEnd,
}) {
  const containerRef = useRef(null);
  const stageRef = useRef(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [stageScale, setStageScale] = useState(1);
  const [fitted, setFitted] = useState(false);
  const C = THEME[theme] || THEME.dark;

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSize({ width: Math.floor(width), height: Math.floor(height) });
      setFitted(false); // trigger re-fit
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Auto fit when vertices or size change
  useEffect(() => {
    if (fitted) return;
    const { vertices } = geoResult;
    if (!vertices || vertices.length < 2) return;
    const ft = fitTransform(vertices, size.width, size.height);
    setStageScale(ft.scale);
    setStagePos({ x: ft.x, y: ft.y });
    setFitted(true);
  }, [geoResult.vertices, size, fitted]);

  // Re-fit when geometry changes significantly
  useEffect(() => { setFitted(false); }, [geoResult.vertices?.length]);

  // ── Scroll to zoom ──
  const handleWheel = useCallback((e) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };
    const direction = e.evt.deltaY < 0 ? 1 : -1;
    const newScale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, oldScale * (direction > 0 ? ZOOM_SCALE : 1 / ZOOM_SCALE)));
    setStageScale(newScale);
    setStagePos({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  }, []);

  // Fit button
  const handleFit = useCallback(() => setFitted(false), []);

  const { vertices, area, isClosed, isSelfIntersecting, closureError } = geoResult;
  const hasVerts = vertices && vertices.length >= 2;

  // Convert world vertices to stage coords (flip Y)
  const sVerts = hasVerts ? vertices.map(w2s) : [];

  // Buildable envelope
  let buildVerts = [];
  if (isClosed && !isSelfIntersecting && complianceResult?.setbacks) {
    const offsets = buildOffsets(vertices, complianceResult, roads);
    buildVerts = calculateInsetPolygon(vertices, offsets).map(w2s);
  }

  // Road widening strips
  const roadStrips = hasVerts ? roads.flatMap((road, i) => {
    const sideW = Math.max(
      0,
      ((parseFloat(road.proposedWidth) || 0) - (parseFloat(road.width) || 0)) / 2
    );
    if (sideW <= 0) return [];
    const v1 = vertices[road.sideIndex];
    const v2 = vertices[(road.sideIndex + 1) % vertices.length];
    if (!v1 || !v2) return [];
    const dx = v2.x - v1.x, dy = v2.y - v1.y, len = Math.sqrt(dx * dx + dy * dy);
    const nx = -dy / len, ny = dx / len;
    return [{
      pts: [v1, v2,
        { x: v2.x + nx * sideW, y: v2.y + ny * sideW },
        { x: v1.x + nx * sideW, y: v1.y + ny * sideW },
      ].map(w2s),
      mid: w2s({ x: (v1.x + v2.x) / 2, y: (v1.y + v2.y) / 2 }),
      label: `Road ${i + 1} (${road.proposedWidth}m)`,
    }];
  }) : [];

  // Dimension data
  let plotDims = [];
  let compDims = [];
  if (showDims && hasVerts) {
    const frontIdx = roads.length > 0 ? roads[0].sideIndex : 0;
    plotDims = getPlotDimensions(vertices, frontIdx).map(d => ({
      p1: w2s(d.p1), p2: w2s(d.p2), label: d.label,
    }));
    if (isClosed && complianceResult?.setbacks) {
      compDims = getComplianceDimensions(vertices, complianceResult.setbacks, roads).map(d => ({
        p1: w2s(d.p1), p2: w2s(d.p2), label: d.label, color: d.color,
      }));
    }
  }

  // Grid in world space
  const gridLines = [];
  if (hasVerts) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    vertices.forEach(v => {
      minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
      minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
    });
    const pad = Math.max(maxX - minX, maxY - minY) * 0.5;
    const gridStep = Math.pow(10, Math.floor(Math.log10((maxX - minX) / 5 || 1)));
    for (let x = Math.floor((minX - pad) / gridStep) * gridStep; x <= maxX + pad; x += gridStep) {
      gridLines.push(
        <Line key={`gx${x}`} points={[x, -(minY - pad), x, -(maxY + pad)]} stroke={C.grid} strokeWidth={0.5 / stageScale} />
      );
    }
    for (let y = Math.floor((minY - pad) / gridStep) * gridStep; y <= maxY + pad; y += gridStep) {
      gridLines.push(
        <Line key={`gy${y}`} points={[minX - pad, -y, maxX + pad, -y]} stroke={C.grid} strokeWidth={0.5 / stageScale} />
      );
    }
  }

  // Vertex drag
  const handleVertexDragMove = useCallback((idx, e) => {
    if (!onVertexDrag) return;
    const sx = e.target.x(), sy = e.target.y();
    onVertexDrag(idx, { x: sx, y: -sy }); // un-flip Y
  }, [onVertexDrag]);

  const handleVertexDragEndLocal = useCallback(() => {
    if (onVertexDragEnd) onVertexDragEnd();
  }, [onVertexDragEnd]);

  return (
    <div ref={containerRef} style={{ flex: 1, position: 'relative', background: C.bg }}>
      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        scaleX={stageScale}
        scaleY={stageScale}
        x={stagePos.x}
        y={stagePos.y}
        draggable
        onDragEnd={(e) => setStagePos({ x: e.target.x(), y: e.target.y() })}
        onWheel={handleWheel}
      >
        {/* Grid */}
        <Layer>{gridLines}</Layer>

        {/* Road strips */}
        <Layer>
          {roadStrips.map((rs, i) => (
            <Group key={i}>
              <Line
                points={flatPts(rs.pts)} closed
                fill={C.roadFill} stroke={C.roadStroke}
                strokeWidth={1 / stageScale} dash={[4 / stageScale, 4 / stageScale]}
              />
              <Text
                text={rs.label}
                x={rs.mid.x} y={rs.mid.y - 14 / stageScale}
                fontSize={10 / stageScale}
                fill={C.roadStroke}
                fontFamily="Inter, system-ui, sans-serif"
                fontStyle="bold"
                offsetX={(rs.label.length * 3) / stageScale}
              />
            </Group>
          ))}
        </Layer>

        {/* Buildable envelope */}
        <Layer>
          {buildVerts.length > 2 && (
            <Line
              points={flatPts(buildVerts)} closed
              fill={C.buildFill} stroke={C.buildStroke}
              strokeWidth={1.5 / stageScale} dash={[7 / stageScale, 4 / stageScale]}
            />
          )}
        </Layer>

        {/* Plot boundary */}
        <Layer>
          {sVerts.length >= 2 && (
            <Line
              points={flatPts(sVerts)}
              closed={isClosed}
              fill={C.plotFill}
              stroke={isSelfIntersecting ? '#ef4444' : C.plotStroke}
              strokeWidth={2 / stageScale}
            />
          )}
        </Layer>

        {/* Zones overlay */}
        {showZones && zoningResult && (
          <Layer>
            {Object.entries(zoningResult.zones).map(([key, poly]) => {
              if (!poly || poly.length < 3) return null;
              const zc = ZONE_COLORS[key] || { fill: 'rgba(100,116,139,0.2)', stroke: 'rgba(100,116,139,0.6)' };
              const sPts = poly.map(w2s);
              const centroid = sPts.reduce((a, p) => ({ x: a.x + p.x / sPts.length, y: a.y + p.y / sPts.length }), { x: 0, y: 0 });
              return (
                <Group key={key}>
                  <Line
                    points={flatPts(sPts)} closed
                    fill={zc.fill} stroke={zc.stroke}
                    strokeWidth={1.5 / stageScale}
                  />
                  <Text
                    text={key.toUpperCase()}
                    x={centroid.x} y={centroid.y}
                    fontSize={9 / stageScale}
                    fill={zc.stroke}
                    fontFamily="Inter, system-ui, sans-serif"
                    fontStyle="bold"
                    offsetX={key.length * 2.8 / stageScale}
                    offsetY={4.5 / stageScale}
                  />
                </Group>
              );
            })}
          </Layer>
        )}

        {/* Dimension lines */}
        <Layer>
          {plotDims.map((d, i) => (
            <DimLine key={i} p1={d.p1} p2={d.p2} label={d.label}
              offsetPx={28} color={C.dimStroke} textColor={C.dimText}
              fontSize={10} stageScale={stageScale}
            />
          ))}
          {compDims.map((d, i) => (
            <SetbackDim key={i} p1={d.p1} p2={d.p2} label={d.label}
              color={C.sbStroke} textColor={C.sbText} stageScale={stageScale}
            />
          ))}
        </Layer>

        {/* Draggable vertices */}
        <Layer>
          {sVerts.map((p, i) => (
            <Circle
              key={i}
              x={p.x} y={p.y}
              radius={5 / stageScale}
              fill={C.vertex}
              stroke={C.bg}
              strokeWidth={1.5 / stageScale}
              draggable={!!onVertexDrag}
              onDragMove={(e) => handleVertexDragMove(i, e)}
              onDragEnd={handleVertexDragEndLocal}
              onMouseEnter={(e) => {
                e.target.fill(C.vertexActive);
                e.target.getLayer().batchDraw();
                containerRef.current.style.cursor = 'grab';
              }}
              onMouseLeave={(e) => {
                e.target.fill(C.vertex);
                e.target.getLayer().batchDraw();
                containerRef.current.style.cursor = 'default';
              }}
            />
          ))}
        </Layer>
      </Stage>

      {/* Zoom controls */}
      <div className="zoom-controls">
        <button className="zoom-btn" onClick={() => {
          setStageScale(s => Math.min(MAX_ZOOM, s * ZOOM_SCALE));
        }} title="Zoom in">+</button>
        <button className="zoom-btn" onClick={handleFit} title="Fit to view">⊡</button>
        <button className="zoom-btn" onClick={() => {
          setStageScale(s => Math.max(MIN_ZOOM, s / ZOOM_SCALE));
        }} title="Zoom out">−</button>
        <span className="zoom-label">{Math.round(stageScale * 100)}%</span>
      </div>

      {/* HUD overlay */}
      <div className="canvas-hud">
        <div className="hud-row">
          <span>Area</span>
          <span>{area.toFixed(2)} m²</span>
        </div>
        <div className="hud-row">
          <span>Status</span>
          <span className={isSelfIntersecting ? 'hud-error' : isClosed ? 'hud-ok' : 'hud-warn'}>
            {isSelfIntersecting ? 'Self-intersecting' : isClosed ? 'Closed' : 'Open'}
          </span>
        </div>
        {closureError > 0.01 && (
          <div className="hud-row">
            <span>Closure err</span>
            <span className="hud-error">{closureError.toFixed(3)} m</span>
          </div>
        )}
        {complianceResult && !complianceResult.error && (
          <>
            <div className="hud-row"><span>FAR</span><span>{complianceResult.maxFAR}</span></div>
            <div className="hud-row"><span>Max Built-up</span><span>{complianceResult.maxBuiltUpArea} m²</span></div>
            <div className="hud-row">
              <span>Compliance</span>
              <span className={complianceResult.status === 'Passed' ? 'hud-ok' : 'hud-error'}>
                {complianceResult.status}
              </span>
            </div>
          </>
        )}
        <div className="hud-hint">Scroll to zoom · Drag to pan</div>
      </div>
    </div>
  );
}
