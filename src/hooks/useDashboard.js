import { useState, useMemo, useCallback } from 'react';
import { evaluateGeometry, calculateArea, calculateInsetPolygon } from '../engines/geometryEngine.js';
import { calculateRules, getAuthorities, getLandUses } from '../engines/ruleEngine.js';
import { computeZones, STRATEGY_META } from '../engines/zoningEngine.js';
import { UPBylawRuleEngine } from '../engines/upBylawEngine.js';
import { UP_BYLAW_RULES } from '../data/rulesData.js';

const defaultEdges = [
  { id: 1, length: '10' },
  { id: 2, length: '15' },
  { id: 3, length: '10' },
];
const defaultDiagonals = [{ id: 1, length: '18' }];

export const SPACES = [
  { id: 'parking',    name: 'Car Parking',     cat: 'Parking',  zone: 'front',  rec: 14.0, min: 9,   max: 25 },
  { id: 'foyer',      name: 'Foyer / Entry',   cat: 'Entry',    zone: 'front',  rec: 5.0,  min: 3,   max: 10 },
  { id: 'living',     name: 'Living Room',     cat: 'Living',   zone: 'front',  rec: 18.0, min: 12,  max: 30 },
  { id: 'pooja',      name: 'Pooja Room',      cat: 'Entry',    zone: 'front',  rec: 4.0,  min: 2,   max: 8  },
  { id: 'dining',     name: 'Dining Room',     cat: 'Living',   zone: 'middle', rec: 12.0, min: 8,   max: 20 },
  { id: 'stair',      name: 'Staircase',       cat: 'Stair',    zone: 'middle', rec: 6.0,  min: 4,   max: 10 },
  { id: 'toilet1',    name: 'Toilet (Common)', cat: 'Bath',     zone: 'middle', rec: 3.5,  min: 2.5, max: 6  },
  { id: 'kitchen',    name: 'Kitchen',         cat: 'Kitchen',  zone: 'rear',   rec: 10.0, min: 7,   max: 18 },
  { id: 'utility',    name: 'Utility / Store', cat: 'Kitchen',  zone: 'rear',   rec: 4.5,  min: 2,   max: 8  },
  { id: 'master_bed', name: 'Master Bedroom',  cat: 'Bedroom',  zone: 'rear',   rec: 16.0, min: 12,  max: 25 },
  { id: 'master_bath',name: 'Master Bathroom', cat: 'Bath',     zone: 'rear',   rec: 5.0,  min: 3.5, max: 9  },
  { id: 'bed2',       name: 'Bedroom 2',       cat: 'Bedroom',  zone: 'rear',   rec: 12.0, min: 9,   max: 20 },
  { id: 'bath2',      name: 'Bathroom 2',      cat: 'Bath',     zone: 'rear',   rec: 4.0,  min: 3,   max: 7  },
  { id: 'bed3',       name: 'Bedroom 3',       cat: 'Bedroom',  zone: 'rear',   rec: 11.0, min: 9,   max: 18 },
];

export const CATEGORY_COLORS = {
  Parking: '#8b949e', Entry: '#f78166', Living: '#ffa657',
  Kitchen: '#a3e635', Bedroom: '#79c0ff', Bath: '#d2a8ff', Stair: '#f8d618',
};

export function useDashboard() {
  // Geometry
  const [geoMode, setGeoMode] = useState('regular');
  const [regWidth, setRegWidth] = useState('10');
  const [regHeight, setRegHeight] = useState('20');
  const [edges, setEdges] = useState(defaultEdges);
  const [diagonals, setDiagonals] = useState(defaultDiagonals);
  const [dragOverride, setDragOverride] = useState(null);

  // Setbacks & building params (new)
  const [sbFront, setSbFront] = useState('1.5');
  const [sbRear, setSbRear] = useState('1.0');
  const [sbLeft, setSbLeft] = useState('0.9');
  const [sbRight, setSbRight] = useState('0.9');
  const [floors, setFloors] = useState('1');
  const [maxH, setMaxH] = useState('10');

  // Roads
  const [roads, setRoads] = useState([
    { id: 1, sideIndex: 0, width: 9, proposedWidth: 12 },
  ]);

  // Compliance
  const [authorityId, setAuthorityId] = useState('');
  const [landUse, setLandUse] = useState('Residential');
  const [isCornerPlot, setIsCornerPlot] = useState(false);
  const [developmentType, setDevelopmentType] = useState('plotted_single');
  const [proposedHeight, setProposedHeight] = useState('12.5');
  const [totalUnits, setTotalUnits] = useState('1');

  // UI
  const [showDims, setShowDims] = useState(true);
  const [showZones, setShowZones] = useState(false);
  const [showWalls, setShowWalls] = useState(false);
  const [northAngle, setNorthAngle] = useState(0);
  const [theme, setTheme] = useState('dark');
  const [activeOutputTab, setActiveOutputTab] = useState('geom');

  // Zoning
  const [zoningMode, setZoningMode] = useState('auto');
  const [floorLevel, setFloorLevel] = useState('ground');
  const [selectedSpaces, setSelectedSpaces] = useState(new Set());
  const [userAreas, setUserAreas] = useState(new Map());

  // ── Derived: Geometry ──
  const geoResult = useMemo(() => {
    if (dragOverride) {
      const verts = dragOverride.vertices;
      const area = calculateArea(verts);
      return { vertices: verts, area, isClosed: true, closureError: 0, diagonalError: 0, isSelfIntersecting: false };
    }
    const stateData = geoMode === 'regular'
      ? { type: 'regular', width: regWidth, height: regHeight }
      : { type: 'irregular', edges, diagonals };
    return evaluateGeometry(stateData);
  }, [geoMode, regWidth, regHeight, edges, diagonals, dragOverride]);

  // ── Derived: Buildable area ──
  const buildableInfo = useMemo(() => {
    const W = parseFloat(regWidth) || 0;
    const D = parseFloat(regHeight) || 0;
    const sf = parseFloat(sbFront) || 0, sr = parseFloat(sbRear) || 0;
    const sl = parseFloat(sbLeft) || 0, srr = parseFloat(sbRight) || 0;
    const bw = Math.max(0, W - sl - srr);
    const bd = Math.max(0, D - sf - sr);
    const buildableArea = bw * bd;
    const fl = parseInt(floors) || 1;
    const grossArea = buildableArea * fl;
    const plotArea = geoResult.area || (W * D);
    const far = plotArea > 0 ? (grossArea / plotArea) : 0;
    const ecs = Math.floor(buildableArea / 75);
    return { buildableArea, grossArea, far, ecs, bw, bd };
  }, [regWidth, regHeight, sbFront, sbRear, sbLeft, sbRight, floors, geoResult.area]);

  // ── Derived: Buildable polygon for zoning ──
  const buildableVertices = useMemo(() => {
    if (!geoResult.isClosed || !geoResult.vertices?.length) return [];
    const offsets = [
      parseFloat(sbFront) || 0, parseFloat(sbRight) || 0,
      parseFloat(sbRear) || 0, parseFloat(sbLeft) || 0,
    ];
    const allSame = offsets.every(o => o === offsets[0]);
    if (allSame && offsets[0] > 0) {
      return calculateInsetPolygon(geoResult.vertices, offsets[0]) || [];
    }
    const verts = geoResult.vertices;
    const n = verts.length;
    if (n === 4) {
      // Axis-aligned rect: apply individual setbacks
      const minX = Math.min(...verts.map(v => v.x));
      const maxX = Math.max(...verts.map(v => v.x));
      const minY = Math.min(...verts.map(v => v.y));
      const maxY = Math.max(...verts.map(v => v.y));
      const sf = parseFloat(sbFront) || 0, sr = parseFloat(sbRear) || 0;
      const sl = parseFloat(sbLeft) || 0, srr = parseFloat(sbRight) || 0;
      return [
        { x: minX + sl, y: minY + sf },
        { x: maxX - srr, y: minY + sf },
        { x: maxX - srr, y: maxY - sr },
        { x: minX + sl, y: maxY - sr },
      ];
    }
    const minOff = Math.min(...offsets.filter(o => o > 0));
    return minOff > 0 ? (calculateInsetPolygon(verts, minOff) || []) : verts;
  }, [geoResult, sbFront, sbRear, sbLeft, sbRight]);

  // ── Derived: Compliance ──
  const complianceResult = useMemo(() => {
    if (!authorityId || !landUse) return null;
    return calculateRules(authorityId, landUse, geoResult.area, roads, {
      isCornerPlot, developmentType,
      proposedHeight: parseFloat(proposedHeight) || 0,
      totalUnits: parseInt(totalUnits) || 1,
    });
  }, [authorityId, landUse, geoResult.area, roads, isCornerPlot, developmentType, proposedHeight, totalUnits]);

  // ── Derived: UP Bylaw Engine result ──
  const bylawResult = useMemo(() => {
    try {
      const engine = new UPBylawRuleEngine(UP_BYLAW_RULES);
      const proposal = UPBylawRuleEngine.createProposal({
        building_type: developmentType === 'plotted_single' ? 'single_unit' : 'multi_unit',
        land_use: landUse,
        plotArea: geoResult.area,
        proposedHeight: parseFloat(proposedHeight) || 0,
        primaryRoadWidth: roads.length > 0 ? Math.max(...roads.map(r => parseFloat(r.proposedWidth) || 0)) : 0,
        roads,
        numberOfStoreys: parseInt(floors) || 1,
      });
      return engine.validateBuilding(proposal);
    } catch (e) {
      return null;
    }
  }, [geoResult.area, landUse, developmentType, proposedHeight, roads, floors]);

  // ── Derived: Zoning result ──
  const zoningResult = useMemo(() => {
    if (!showZones || buildableVertices.length < 3) return null;
    const frontEdge = roads.length > 0 ? roads[0].sideIndex : 0;
    return computeZones(buildableVertices, frontEdge, geoResult.vertices, {
      strategy: zoningMode, northRotation: northAngle, floorType: floorLevel,
    });
  }, [showZones, buildableVertices, geoResult.vertices, roads, zoningMode, northAngle, floorLevel]);

  // ── Derived: Space utilisation ──
  const spaceUtilisation = useMemo(() => {
    const avail = buildableInfo.grossArea;
    let used = 0;
    selectedSpaces.forEach(id => {
      const sp = SPACES.find(s => s.id === id);
      if (sp) used += userAreas.get(id) ?? sp.rec;
    });
    const pct = avail > 0 ? Math.min((used / avail) * 100, 130) : 0;
    return { used, avail, pct };
  }, [selectedSpaces, userAreas, buildableInfo.grossArea]);

  // ── Authorities & land uses ──
  const authorities = useMemo(() => getAuthorities(), []);
  const landUses = useMemo(() => (authorityId ? getLandUses(authorityId) : []), [authorityId]);

  // ── Vertex drag ──
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
      const verts = dragOverride.vertices;
      const xs = verts.map(v => v.x), ys = verts.map(v => v.y);
      setRegWidth((Math.max(...xs) - Math.min(...xs)).toFixed(2));
      setRegHeight((Math.max(...ys) - Math.min(...ys)).toFixed(2));
      setDragOverride(null);
    }
  }, [dragOverride, geoMode]);

  const wrappedSetGeoMode = useCallback((m) => { setGeoMode(m); setDragOverride(null); }, []);
  const wrappedSetRegWidth = useCallback((v) => { setRegWidth(v); setDragOverride(null); }, []);
  const wrappedSetRegHeight = useCallback((v) => { setRegHeight(v); setDragOverride(null); }, []);

  // ── Road helpers ──
  function addRoad() { setRoads(prev => [...prev, { id: Date.now(), sideIndex: 0, width: 9, proposedWidth: 9 }]); }
  function removeRoad(id) { setRoads(prev => prev.filter(r => r.id !== id)); }
  function updateRoad(id, field, value) { setRoads(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r)); }

  // ── Edge helpers ──
  function addEdge() { setEdges(prev => [...prev, { id: Date.now(), length: '0' }]); setDragOverride(null); }
  function removeEdge(id) { setEdges(prev => prev.filter(e => e.id !== id)); setDragOverride(null); }
  function updateEdge(id, value) { setEdges(prev => prev.map(e => e.id === id ? { ...e, length: value } : e)); setDragOverride(null); }

  // ── Diagonal helpers ──
  function addDiagonal() { setDiagonals(prev => [...prev, { id: Date.now(), length: '0' }]); }
  function removeDiagonal(id) { setDiagonals(prev => prev.filter(d => d.id !== id)); }
  function updateDiagonal(id, value) { setDiagonals(prev => prev.map(d => d.id === id ? { ...d, length: value } : d)); }

  // ── Authority change ──
  function handleAuthorityChange(id) {
    setAuthorityId(id);
    const uses = id ? getLandUses(id) : [];
    setLandUse(uses.length > 0 ? uses[0] : 'Residential');
  }

  // ── Space selection ──
  function toggleSpace(id) {
    setSelectedSpaces(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function setSpaceArea(id, area) {
    setUserAreas(prev => { const m = new Map(prev); m.set(id, area); return m; });
  }
  function resetSpaceArea(id) {
    setUserAreas(prev => { const m = new Map(prev); m.delete(id); return m; });
  }

  return {
    // geometry
    geoMode, setGeoMode: wrappedSetGeoMode,
    regWidth, setRegWidth: wrappedSetRegWidth,
    regHeight, setRegHeight: wrappedSetRegHeight,
    edges, addEdge, removeEdge, updateEdge,
    diagonals, addDiagonal, removeDiagonal, updateDiagonal,
    geoResult, buildableVertices,
    // vertex drag
    handleVertexDrag, handleVertexDragEnd,
    // setbacks & building params
    sbFront, setSbFront, sbRear, setSbRear,
    sbLeft, setSbLeft, sbRight, setSbRight,
    floors, setFloors, maxH, setMaxH,
    buildableInfo,
    // roads
    roads, addRoad, removeRoad, updateRoad,
    // compliance
    authorityId, handleAuthorityChange,
    landUse, setLandUse,
    isCornerPlot, setIsCornerPlot,
    developmentType, setDevelopmentType,
    proposedHeight, setProposedHeight,
    totalUnits, setTotalUnits,
    complianceResult, bylawResult,
    authorities, landUses,
    // zoning
    zoningMode, setZoningMode,
    floorLevel, setFloorLevel,
    selectedSpaces, toggleSpace,
    userAreas, setSpaceArea, resetSpaceArea,
    zoningResult, spaceUtilisation,
    STRATEGY_META,
    // ui
    showDims, setShowDims,
    showZones, setShowZones,
    showWalls, setShowWalls,
    northAngle, setNorthAngle,
    theme, setTheme,
    activeOutputTab, setActiveOutputTab,
  };
}
