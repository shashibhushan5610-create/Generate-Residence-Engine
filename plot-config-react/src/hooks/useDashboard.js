import { useState, useMemo, useCallback } from 'react';
import { evaluateGeometry, calculateArea } from '../engines/geometryEngine.js';
import { calculateRules, getAuthorities, getLandUses } from '../engines/ruleEngine.js';

const defaultEdges = [
  { id: 1, length: '10' },
  { id: 2, length: '15' },
  { id: 3, length: '10' },
];
const defaultDiagonals = [{ id: 1, length: '18' }];

export function useDashboard() {
  // Geometry
  const [geoMode, setGeoMode] = useState('regular');
  const [regWidth, setRegWidth] = useState('10');
  const [regHeight, setRegHeight] = useState('20');
  const [edges, setEdges] = useState(defaultEdges);
  const [diagonals, setDiagonals] = useState(defaultDiagonals);

  // Dragged vertex overrides — null means use computed vertices
  // Shape: { vertices: [{x,y}] } | null
  const [dragOverride, setDragOverride] = useState(null);

  // Roads
  const [roads, setRoads] = useState([
    { id: 1, sideIndex: 0, width: 9, proposedWidth: 12 },
  ]);

  // Compliance
  const [authorityId, setAuthorityId] = useState('');
  const [landUse, setLandUse] = useState('Residential');
  const [isCornerPlot, setIsCornerPlot] = useState(false);

  // UI
  const [showDims, setShowDims] = useState(true);
  const [theme, setTheme] = useState('dark');
  const [activeOutputTab, setActiveOutputTab] = useState('geom');

  // ── Derived: Geometry ──
  const geoResult = useMemo(() => {
    if (dragOverride) {
      // Use dragged positions directly
      const verts = dragOverride.vertices;
      const area = calculateArea(verts);
      return {
        vertices: verts,
        area,
        isClosed: true,
        closureError: 0,
        diagonalError: 0,
        isSelfIntersecting: false,
      };
    }
    const stateData =
      geoMode === 'regular'
        ? { type: 'regular', width: regWidth, height: regHeight }
        : { type: 'irregular', edges, diagonals };
    return evaluateGeometry(stateData);
  }, [geoMode, regWidth, regHeight, edges, diagonals, dragOverride]);

  // ── Derived: Compliance ──
  const complianceResult = useMemo(() => {
    if (!authorityId || !landUse) return null;
    return calculateRules(authorityId, landUse, geoResult.area, roads, { isCornerPlot });
  }, [authorityId, landUse, geoResult.area, roads, isCornerPlot]);

  // ── Authorities & land uses ──
  const authorities = useMemo(() => getAuthorities(), []);
  const landUses = useMemo(
    () => (authorityId ? getLandUses(authorityId) : []),
    [authorityId]
  );

  // ── Vertex drag (from canvas) ──
  // On drag: update override vertices live
  // On drag end: commit back to inputs (regular → width/height, irregular → keep override)
  const handleVertexDrag = useCallback((idx, newPos) => {
    setDragOverride(prev => {
      const base = prev?.vertices ?? geoResult.vertices;
      const updated = base.map((v, i) => i === idx ? { x: Math.max(0, newPos.x), y: Math.max(0, newPos.y) } : v);
      return { vertices: updated };
    });
  }, [geoResult.vertices]);

  const handleVertexDragEnd = useCallback(() => {
    if (!dragOverride) return;
    if (geoMode === 'regular') {
      // Commit back: infer width/height from dragged vertices
      const verts = dragOverride.vertices;
      const xs = verts.map(v => v.x), ys = verts.map(v => v.y);
      setRegWidth((Math.max(...xs) - Math.min(...xs)).toFixed(2));
      setRegHeight((Math.max(...ys) - Math.min(...ys)).toFixed(2));
      setDragOverride(null);
    }
    // For irregular, keep override in place (edge lengths would need complex re-solve)
  }, [dragOverride, geoMode]);

  // Reset drag override when mode or inputs change from sidebar
  const wrappedSetGeoMode = useCallback((m) => { setGeoMode(m); setDragOverride(null); }, []);
  const wrappedSetRegWidth = useCallback((v) => { setRegWidth(v); setDragOverride(null); }, []);
  const wrappedSetRegHeight = useCallback((v) => { setRegHeight(v); setDragOverride(null); }, []);

  // ── Road helpers ──
  function addRoad() {
    setRoads(prev => [...prev, { id: Date.now(), sideIndex: 0, width: 9, proposedWidth: 9 }]);
  }
  function removeRoad(id) {
    setRoads(prev => prev.filter(r => r.id !== id));
  }
  function updateRoad(id, field, value) {
    setRoads(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  }

  // ── Edge helpers ──
  function addEdge() {
    setEdges(prev => [...prev, { id: Date.now(), length: '0' }]);
    setDragOverride(null);
  }
  function removeEdge(id) {
    setEdges(prev => prev.filter(e => e.id !== id));
    setDragOverride(null);
  }
  function updateEdge(id, value) {
    setEdges(prev => prev.map(e => e.id === id ? { ...e, length: value } : e));
    setDragOverride(null);
  }

  // ── Diagonal helpers ──
  function addDiagonal() {
    setDiagonals(prev => [...prev, { id: Date.now(), length: '0' }]);
  }
  function removeDiagonal(id) {
    setDiagonals(prev => prev.filter(d => d.id !== id));
  }
  function updateDiagonal(id, value) {
    setDiagonals(prev => prev.map(d => d.id === id ? { ...d, length: value } : d));
  }

  // ── Authority change ──
  function handleAuthorityChange(id) {
    setAuthorityId(id);
    const uses = id ? getLandUses(id) : [];
    setLandUse(uses.length > 0 ? uses[0] : 'Residential');
  }

  return {
    // geometry
    geoMode, setGeoMode: wrappedSetGeoMode,
    regWidth, setRegWidth: wrappedSetRegWidth,
    regHeight, setRegHeight: wrappedSetRegHeight,
    edges, addEdge, removeEdge, updateEdge,
    diagonals, addDiagonal, removeDiagonal, updateDiagonal,
    geoResult,
    // vertex drag
    handleVertexDrag, handleVertexDragEnd,
    // roads
    roads, addRoad, removeRoad, updateRoad,
    // compliance
    authorityId, handleAuthorityChange,
    landUse, setLandUse,
    isCornerPlot, setIsCornerPlot,
    complianceResult,
    authorities, landUses,
    // ui
    showDims, setShowDims,
    theme, setTheme,
    activeOutputTab, setActiveOutputTab,
  };
}
