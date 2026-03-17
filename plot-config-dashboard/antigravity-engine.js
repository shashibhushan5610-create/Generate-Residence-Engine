class GeometryEngine {
    static distance(p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    static angle(p1, p2) {
        return Math.atan2(p2.y - p1.y, p2.x - p1.x);
    }

    static lineIntersection(p1, p2, p3, p4) {
        const x1 = p1.x, y1 = p1.y;
        const x2 = p2.x, y2 = p2.y;
        const x3 = p3.x, y3 = p3.y;
        const x4 = p4.x, y4 = p4.y;

        const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
        if (Math.abs(denom) < 1e-10) return null;

        const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
        const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
            return {
                x: x1 + t * (x2 - x1),
                y: y1 + t * (y2 - y1),
                t: t,
                u: u
            };
        }
        return null;
    }

    static pointInsidePolygon(point, polygon) {
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].x, yi = polygon[i].y;
            const xj = polygon[j].x, yj = polygon[j].y;

            const intersect = ((yi > point.y) !== (yj > point.y)) &&
                (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    static polygonArea(polygon) {
        let area = 0;
        for (let i = 0; i < polygon.length; i++) {
            const j = (i + 1) % polygon.length;
            area += polygon[i].x * polygon[j].y;
            area -= polygon[j].x * polygon[i].y;
        }
        return Math.abs(area) / 2;
    }

    static polygonCentroid(polygon) {
        let cx = 0, cy = 0;
        const area = this.polygonArea(polygon);
        if (area === 0) {
            cx = polygon.reduce((sum, p) => sum + p.x, 0) / polygon.length;
            cy = polygon.reduce((sum, p) => sum + p.y, 0) / polygon.length;
            return { x: cx, y: cy };
        }

        for (let i = 0; i < polygon.length; i++) {
            const j = (i + 1) % polygon.length;
            const cross = polygon[i].x * polygon[j].y - polygon[j].x * polygon[i].y;
            cx += (polygon[i].x + polygon[j].x) * cross;
            cy += (polygon[i].y + polygon[j].y) * cross;
        }
        return { x: cx / (6 * area), y: cy / (6 * area) };
    }

    static polygonOffset(polygon, offset) {
        const result = [];
        const n = polygon.length;

        for (let i = 0; i < n; i++) {
            const prev = polygon[(i - 1 + n) % n];
            const curr = polygon[i];
            const next = polygon[(i + 1) % n];

            const angle1 = this.angle(prev, curr);
            const angle2 = this.angle(curr, next);
            const bisector = (angle1 + angle2) / 2;

            const dist1 = this.distance(prev, curr);
            const dist2 = this.distance(curr, next);

            if (dist1 > 0 && dist2 > 0) {
                const sina = Math.sin((angle2 - angle1) / 2);
                const offsetDistance = Math.abs(offset / sina);

                const nx = curr.x + offsetDistance * Math.cos(bisector);
                const ny = curr.y + offsetDistance * Math.sin(bisector);
                result.push({ x: nx, y: ny });
            }
        }

        return result.length >= 3 ? result : polygon;
    }

    static lineSegmentDistance(p, p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const t = Math.max(0, Math.min(1, ((p.x - p1.x) * dx + (p.y - p1.y) * dy) / (dx * dx + dy * dy)));
        const closest = { x: p1.x + t * dx, y: p1.y + t * dy };
        return this.distance(p, closest);
    }
}

class WallSystem {
    constructor() {
        this.walls = [];
        this.wallId = 0;
    }

    createWall(x1, y1, x2, y2, thickness = 300) {
        const wall = {
            id: `wall_${this.wallId++}`,
            x1, y1, x2, y2,
            thickness,
            openings: []
        };
        this.walls.push(wall);
        return wall;
    }

    offsetWallForThickness(wall) {
        const offset = wall.thickness / 2;
        const angle = GeometryEngine.angle({ x: wall.x1, y: wall.y1 }, { x: wall.x2, y: wall.y2 });
        const perp = angle + Math.PI / 2;

        return {
            inner: [
                { x: wall.x1 + offset * Math.cos(perp), y: wall.y1 + offset * Math.sin(perp) },
                { x: wall.x2 + offset * Math.cos(perp), y: wall.y2 + offset * Math.sin(perp) }
            ],
            outer: [
                { x: wall.x1 - offset * Math.cos(perp), y: wall.y1 - offset * Math.sin(perp) },
                { x: wall.x2 - offset * Math.cos(perp), y: wall.y2 - offset * Math.sin(perp) }
            ]
        };
    }

    detectWallIntersection(wall1, wall2) {
        if (wall1.id === wall2.id) return null;

        return GeometryEngine.lineIntersection(
            { x: wall1.x1, y: wall1.y1 },
            { x: wall1.x2, y: wall1.y2 },
            { x: wall2.x1, y: wall2.y1 },
            { x: wall2.x2, y: wall2.y2 }
        );
    }

    splitWallAtOpening(wallId, opening) {
        const wall = this.walls.find(w => w.id === wallId);
        if (!wall) return;

        const existingOpening = wall.openings.find(o =>
            Math.abs(o.startDist - opening.startDist) < 10
        );

        if (!existingOpening) {
            wall.openings.push(opening);
            wall.openings.sort((a, b) => a.startDist - b.startDist);
        }
    }

    getWallLength(wall) {
        return GeometryEngine.distance({ x: wall.x1, y: wall.y1 }, { x: wall.x2, y: wall.y2 });
    }
}

class OpeningsEngine {
    constructor(wallSystem) {
        this.wallSystem = wallSystem;
        this.doors = [];
        this.windows = [];
        this.doorId = 0;
        this.windowId = 0;
    }

    placeDoor(wallId, width = 900, offset = 0) {
        const wall = this.wallSystem.walls.find(w => w.id === wallId);
        if (!wall) return null;

        const length = this.wallSystem.getWallLength(wall);
        const startDist = Math.min(offset, length - width);

        const door = {
            id: `door_${this.doorId++}`,
            wallId,
            width,
            startDist,
            type: 'swing',
            swingAngle: 90
        };

        this.doors.push(door);
        this.wallSystem.splitWallAtOpening(wallId, { type: 'door', ...door });
        return door;
    }

    placeWindow(wallId, width = 1200, offset = 0) {
        const wall = this.wallSystem.walls.find(w => w.id === wallId);
        if (!wall) return null;

        const length = this.wallSystem.getWallLength(wall);
        const startDist = Math.min(offset, length - width);

        const window = {
            id: `window_${this.windowId++}`,
            wallId,
            width,
            startDist,
            sillHeight: 1000,
            headHeight: 2100
        };

        this.windows.push(window);
        this.wallSystem.splitWallAtOpening(wallId, { type: 'window', ...window });
        return window;
    }

    getDoorGeometry(door) {
        const wall = this.wallSystem.walls.find(w => w.id === door.wallId);
        if (!wall) return null;

        const length = this.wallSystem.getWallLength(wall);
        const t = door.startDist / length;
        const startX = wall.x1 + t * (wall.x2 - wall.x1);
        const startY = wall.y1 + t * (wall.y2 - wall.y1);

        const angle = GeometryEngine.angle({ x: wall.x1, y: wall.y1 }, { x: wall.x2, y: wall.y2 });
        const endX = startX + door.width * Math.cos(angle);
        const endY = startY + door.width * Math.sin(angle);

        return { startX, startY, endX, endY, angle };
    }

    getWindowGeometry(window) {
        const wall = this.wallSystem.walls.find(w => w.id === window.wallId);
        if (!wall) return null;

        const length = this.wallSystem.getWallLength(wall);
        const t = window.startDist / length;
        const startX = wall.x1 + t * (wall.x2 - wall.x1);
        const startY = wall.y1 + t * (wall.y2 - wall.y1);

        const angle = GeometryEngine.angle({ x: wall.x1, y: wall.y1 }, { x: wall.x2, y: wall.y2 });
        const endX = startX + window.width * Math.cos(angle);
        const endY = startY + window.width * Math.sin(angle);

        return { startX, startY, endX, endY, angle };
    }
}

class RoomDetectionEngine {
    constructor(wallSystem) {
        this.wallSystem = wallSystem;
        this.rooms = [];
        this.roomId = 0;
    }

    detectRooms() {
        const edges = this.extractEdges();
        const cycles = this.findCycles(edges);
        this.rooms = [];

        cycles.forEach(cycle => {
            if (cycle.length >= 3) {
                const polygon = this.cycleToPolygon(cycle);
                const area = GeometryEngine.polygonArea(polygon);

                if (area > 100000) {
                    const centroid = GeometryEngine.polygonCentroid(polygon);
                    this.rooms.push({
                        id: `room_${this.roomId++}`,
                        polygon,
                        area,
                        centroid,
                        perimeter: this.calculatePerimeter(polygon)
                    });
                }
            }
        });

        return this.rooms;
    }

    extractEdges() {
        const edges = [];
        this.wallSystem.walls.forEach(wall => {
            edges.push({
                id: `e_${wall.id}_fwd`,
                wallId: wall.id,
                p1: { x: wall.x1, y: wall.y1 },
                p2: { x: wall.x2, y: wall.y2 }
            });
            edges.push({
                id: `e_${wall.id}_rev`,
                wallId: wall.id,
                p1: { x: wall.x2, y: wall.y2 },
                p2: { x: wall.x1, y: wall.y1 }
            });
        });
        return edges;
    }

    findCycles(edges, maxDepth = 50) {
        const cycles = [];
        const visited = new Set();

        edges.forEach(startEdge => {
            const key = `${startEdge.p1.x},${startEdge.p1.y}`;
            if (visited.has(key)) return;

            const path = this.dfs(startEdge, edges, [], visited, maxDepth);
            if (path.length >= 3) {
                cycles.push(path);
            }
        });

        return cycles.filter((c, i) => cycles.findIndex(o => this.cyclesEqual(c, o)) === i);
    }

    dfs(current, edges, path, visited, depth) {
        if (depth <= 0) return [];

        path = [...path, current];

        if (path.length > 2) {
            const next = this.findNextEdge(current, edges);
            if (next && this.pointsClose(next.p1, path[0].p1)) {
                return path;
            }
        }

        const next = this.findNextEdge(current, edges);
        if (next && !path.some(e => e.id === next.id)) {
            const result = this.dfs(next, edges, path, visited, depth - 1);
            if (result.length > 0) return result;
        }

        return [];
    }

    findNextEdge(edge, edges) {
        const candidates = edges.filter(e =>
            this.pointsClose(e.p1, edge.p2) && e.id !== edge.id
        );

        if (candidates.length === 0) return null;

        const angle = GeometryEngine.angle(edge.p1, edge.p2);
        return candidates.reduce((best, e) => {
            const nextAngle = GeometryEngine.angle(e.p1, e.p2);
            const angleDiff = Math.abs(nextAngle - angle);
            const bestAngleDiff = Math.abs(GeometryEngine.angle(best.p1, best.p2) - angle);
            return angleDiff < bestAngleDiff ? e : best;
        });
    }

    pointsClose(p1, p2, tolerance = 50) {
        return Math.abs(p1.x - p2.x) < tolerance && Math.abs(p1.y - p2.y) < tolerance;
    }

    cycleToPolygon(cycle) {
        return cycle.map(e => ({ x: e.p1.x, y: e.p1.y }));
    }

    cyclesEqual(c1, c2) {
        if (c1.length !== c2.length) return false;
        return c1.every((e, i) => e.id === c2[i].id);
    }

    calculatePerimeter(polygon) {
        let perimeter = 0;
        for (let i = 0; i < polygon.length; i++) {
            const j = (i + 1) % polygon.length;
            perimeter += GeometryEngine.distance(polygon[i], polygon[j]);
        }
        return perimeter;
    }
}

class AdjacencyGraphEngine {
    constructor(roomDetectionEngine) {
        this.roomDetectionEngine = roomDetectionEngine;
        this.graph = null;
    }

    generateGraph() {
        const rooms = this.roomDetectionEngine.rooms;
        const nodes = rooms.map(r => ({ id: r.id, data: r }));
        const edges = [];

        for (let i = 0; i < rooms.length; i++) {
            for (let j = i + 1; j < rooms.length; j++) {
                if (this.roomsAdjacent(rooms[i], rooms[j])) {
                    edges.push({
                        source: rooms[i].id,
                        target: rooms[j].id,
                        weight: 1
                    });
                }
            }
        }

        this.graph = { nodes, edges };
        return this.graph;
    }

    roomsAdjacent(room1, room2) {
        const tolerance = 150;

        for (let i = 0; i < room1.polygon.length; i++) {
            const j = (i + 1) % room1.polygon.length;
            const edge1 = [room1.polygon[i], room1.polygon[j]];

            for (let k = 0; k < room2.polygon.length; k++) {
                const l = (k + 1) % room2.polygon.length;
                const edge2 = [room2.polygon[k], room2.polygon[l]];

                if (this.edgesAdjacent(edge1, edge2, tolerance)) {
                    return true;
                }
            }
        }

        return false;
    }

    edgesAdjacent(edge1, edge2, tolerance) {
        const d1 = GeometryEngine.lineSegmentDistance(edge1[0], edge2[0], edge2[1]);
        const d2 = GeometryEngine.lineSegmentDistance(edge1[1], edge2[0], edge2[1]);
        return d1 < tolerance && d2 < tolerance;
    }

    getAdjacentRooms(roomId) {
        if (!this.graph) return [];
        return this.graph.edges
            .filter(e => e.source === roomId || e.target === roomId)
            .map(e => e.source === roomId ? e.target : e.source);
    }
}

class NBCRulesEngine {
    constructor() {
        this.rules = {
            bedroom: { minArea: 9000000, minWidth: 3000 },
            kitchen: { minArea: 5000000, minWidth: 2500 },
            toilet: { minArea: 2000000, minWidth: 1200 },
            living: { minArea: 12000000, minWidth: 4000 },
            corridor: { minWidth: 900 },
            door: { minWidth: 800, maxWidth: 900 },
            window: { minWidth: 800, maxWidth: 2000 }
        };
    }

    validateRoom(room, type) {
        const rule = this.rules[type];
        if (!rule) return { valid: true, violations: [] };

        const violations = [];

        if (rule.minArea && room.area < rule.minArea) {
            violations.push(`Area ${room.area} mm² < minimum ${rule.minArea} mm²`);
        }

        if (rule.minWidth) {
            const width = Math.sqrt(room.area / 2);
            if (width < rule.minWidth) {
                violations.push(`Minimum dimension ${width} mm < required ${rule.minWidth} mm`);
            }
        }

        return {
            valid: violations.length === 0,
            violations
        };
    }

    adjustRoomSizes(rooms) {
        return rooms.map(room => {
            const violations = this.validateRoom(room, room.type);
            if (!violations.valid) {
                const scaleFactor = Math.sqrt(this.rules[room.type].minArea / room.area);
                const scaled = room.polygon.map(p => ({
                    x: room.centroid.x + (p.x - room.centroid.x) * scaleFactor,
                    y: room.centroid.y + (p.y - room.centroid.y) * scaleFactor
                }));
                return {
                    ...room,
                    polygon: scaled,
                    area: GeometryEngine.polygonArea(scaled)
                };
            }
            return room;
        });
    }
}

class VastuEngine {
    constructor() {
        this.preferences = {
            kitchen: { preferredQuadrant: 'SE', weight: 0.7 },
            bedroom: { preferredQuadrant: 'SW', weight: 0.6 },
            living: { preferredQuadrant: 'NE', weight: 0.5 },
            entrance: { preferredDirections: ['N', 'E'], weight: 0.4 }
        };
    }

    getQuadrant(centroid, bounds) {
        const centerX = (bounds.minX + bounds.maxX) / 2;
        const centerY = (bounds.minY + bounds.maxY) / 2;

        const isNorth = centroid.y < centerY;
        const isEast = centroid.x > centerX;

        if (isNorth && isEast) return 'NE';
        if (isNorth && !isEast) return 'NW';
        if (!isNorth && isEast) return 'SE';
        return 'SW';
    }

    scoreLayout(rooms, bounds) {
        let score = 0;

        rooms.forEach(room => {
            if (!room.type) return;

            const pref = this.preferences[room.type];
            if (!pref) return;

            const quadrant = this.getQuadrant(room.centroid, bounds);
            if (quadrant === pref.preferredQuadrant) {
                score += pref.weight * 100;
            }
        });

        return score;
    }

    biasZoning(zoneCenter, roomType) {
        const pref = this.preferences[roomType];
        if (!pref) return zoneCenter;

        const bias = {
            'NE': { x: 0.7, y: 0.3 },
            'NW': { x: 0.3, y: 0.3 },
            'SE': { x: 0.7, y: 0.7 },
            'SW': { x: 0.3, y: 0.7 }
        };

        const b = bias[pref.preferredQuadrant];
        return {
            x: zoneCenter.x + (b.x - 0.5) * 2000,
            y: zoneCenter.y + (b.y - 0.5) * 2000
        };
    }
}

class LayoutGenerator {
    constructor(wallSystem, openingsEngine, nbcRules, vastuEngine) {
        this.wallSystem = wallSystem;
        this.openingsEngine = openingsEngine;
        this.nbcRules = nbcRules;
        this.vastuEngine = vastuEngine;
    }

    generateLayout(config) {
        const {
            plotWidth = 12000,
            plotDepth = 9000,
            setbacks = { front: 3000, rear: 1500, left: 900, right: 900 },
            rooms = ['living', 'kitchen', 'bedroom', 'toilet'],
            enableVastu = false
        } = config;

        const bounds = {
            minX: setbacks.left,
            minY: setbacks.front,
            maxX: plotWidth - setbacks.right,
            maxY: plotDepth - setbacks.rear
        };

        this.generateBoundaryWalls(bounds);
        this.generateRoomLayout(bounds, rooms, enableVastu);

        return {
            walls: this.wallSystem.walls,
            doors: this.openingsEngine.doors,
            windows: this.openingsEngine.windows,
            bounds
        };
    }

    generateBoundaryWalls(bounds) {
        this.wallSystem.createWall(bounds.minX, bounds.minY, bounds.maxX, bounds.minY, 300);
        this.wallSystem.createWall(bounds.maxX, bounds.minY, bounds.maxX, bounds.maxY, 300);
        this.wallSystem.createWall(bounds.maxX, bounds.maxY, bounds.minX, bounds.maxY, 300);
        this.wallSystem.createWall(bounds.minX, bounds.maxY, bounds.minX, bounds.minY, 300);
    }

    generateRoomLayout(bounds, roomTypes, enableVastu) {
        const width = bounds.maxX - bounds.minX;
        const height = bounds.maxY - bounds.minY;

        const cols = Math.ceil(Math.sqrt(roomTypes.length));
        const rows = Math.ceil(roomTypes.length / cols);

        const cellWidth = width / cols;
        const cellHeight = height / rows;

        roomTypes.forEach((type, idx) => {
            const row = Math.floor(idx / cols);
            const col = idx % cols;

            let cellX = bounds.minX + col * cellWidth;
            let cellY = bounds.minY + row * cellHeight;

            if (enableVastu) {
                const center = { x: cellX + cellWidth / 2, y: cellY + cellHeight / 2 };
                const biased = this.vastuEngine.biasZoning(center, type);
                cellX = Math.max(bounds.minX, Math.min(bounds.maxX - cellWidth, biased.x - cellWidth / 2));
                cellY = Math.max(bounds.minY, Math.min(bounds.maxY - cellHeight, biased.y - cellHeight / 2));
            }

            const x2 = cellX + cellWidth;
            const y2 = cellY + cellHeight;

            this.wallSystem.createWall(cellX, cellY, x2, cellY, 300);
            this.wallSystem.createWall(x2, cellY, x2, y2, 300);
            this.wallSystem.createWall(x2, y2, cellX, y2, 300);
            this.wallSystem.createWall(cellX, y2, cellX, cellY, 300);

            if (col < cols - 1) {
                this.wallSystem.createWall(x2, cellY, x2, y2, 300);
            }

            if (type !== 'toilet') {
                const wallIdx = this.wallSystem.walls.length - 4;
                const wall = this.wallSystem.walls[wallIdx];
                this.openingsEngine.placeDoor(wall.id, 900, cellWidth * 0.2);
            }

            if (type === 'kitchen' || type === 'living') {
                const wallIdx = this.wallSystem.walls.length - 3;
                if (wallIdx >= 0 && this.wallSystem.walls[wallIdx]) {
                    this.openingsEngine.placeWindow(this.wallSystem.walls[wallIdx].id, 1500, cellWidth * 0.3);
                }
            }
        });
    }
}

class CirculationGenerator {
    constructor(wallSystem, roomDetectionEngine) {
        this.wallSystem = wallSystem;
        this.roomDetectionEngine = roomDetectionEngine;
        this.corridors = [];
    }

    generateCirculation(minWidth = 900) {
        const rooms = this.roomDetectionEngine.rooms;
        if (rooms.length < 2) return [];

        const visited = new Set();
        const circulation = [];

        for (let i = 0; i < rooms.length; i++) {
            for (let j = i + 1; j < rooms.length; j++) {
                const path = this.findPath(rooms[i], rooms[j], minWidth);
                if (path && !visited.has(`${i}-${j}`)) {
                    circulation.push(path);
                    visited.add(`${i}-${j}`);
                }
            }
        }

        this.corridors = circulation;
        return circulation;
    }

    findPath(room1, room2, minWidth) {
        const c1 = room1.centroid;
        const c2 = room2.centroid;

        const distance = GeometryEngine.distance(c1, c2);
        if (distance === 0) return null;

        return {
            id: `corr_${Math.random().toString(36).substr(2, 9)}`,
            x1: c1.x,
            y1: c1.y,
            x2: c2.x,
            y2: c2.y,
            width: minWidth,
            connects: [room1.id, room2.id]
        };
    }
}

class RenderingEngine {
    constructor(containerId) {
        this.stage = new Konva.Stage({
            container: containerId,
            width: window.innerWidth,
            height: window.innerHeight
        });

        this.layer = new Konva.Layer();
        this.stage.add(this.layer);

        this.scale = 0.1;
        this.panX = 0;
        this.panY = 0;

        this.setupControls();
    }

    setupControls() {
        this.stage.on('wheel', (e) => {
            e.evt.preventDefault();
            const oldScale = this.scale;
            const pointer = this.stage.getPointerPosition();

            this.scale *= e.evt.deltaY > 0 ? 0.9 : 1.1;
            this.scale = Math.max(0.01, Math.min(10, this.scale));

            this.redraw();
        });

        let isPanning = false;
        this.stage.on('mousedown', () => { isPanning = true; });
        this.stage.on('mouseup', () => { isPanning = false; });
        this.stage.on('mousemove', (e) => {
            if (isPanning) {
                const pointer = this.stage.getPointerPosition();
                this.panX += pointer.x;
                this.panY += pointer.y;
            }
        });
    }

    renderFloorPlan(wallSystem, openingsEngine, rooms = [], corridors = []) {
        this.layer.destroyChildren();

        this.renderWalls(wallSystem);
        this.renderDoors(openingsEngine);
        this.renderWindows(openingsEngine);
        this.renderRooms(rooms);
        this.renderCorridors(corridors);

        this.layer.draw();
    }

    renderWalls(wallSystem) {
        wallSystem.walls.forEach(wall => {
            const line = new Konva.Line({
                points: [
                    this.transform(wall.x1),
                    this.transform(wall.y1),
                    this.transform(wall.x2),
                    this.transform(wall.y2)
                ],
                stroke: '#333',
                strokeWidth: Math.max(2, wall.thickness * this.scale),
                lineCap: 'round',
                lineJoin: 'round'
            });
            this.layer.add(line);
        });
    }

    renderDoors(openingsEngine) {
        openingsEngine.doors.forEach(door => {
            const geom = openingsEngine.getDoorGeometry(door);
            if (!geom) return;

            const startAngle = 0;
            const endAngle = door.swingAngle * (Math.PI / 180);

            const arc = new Konva.Arc({
                x: this.transform(geom.startX),
                y: this.transform(geom.startY),
                innerRadius: 0,
                outerRadius: door.width * this.scale,
                angle: door.swingAngle,
                rotation: geom.angle * (180 / Math.PI),
                fill: 'rgba(255, 200, 100, 0.3)',
                stroke: '#ff8800',
                strokeWidth: 2
            });

            this.layer.add(arc);
        });
    }

    renderWindows(openingsEngine) {
        openingsEngine.windows.forEach(window => {
            const geom = openingsEngine.getWindowGeometry(window);
            if (!geom) return;

            const rect = new Konva.Rect({
                x: this.transform(geom.startX) - 5,
                y: this.transform(geom.startY) - 5,
                width: window.width * this.scale,
                height: 10,
                fill: '#87CEEB',
                stroke: '#4682B4',
                strokeWidth: 2
            });

            this.layer.add(rect);
        });
    }

    renderRooms(rooms) {
        rooms.forEach((room, idx) => {
            const points = [];
            room.polygon.forEach(p => {
                points.push(this.transform(p.x));
                points.push(this.transform(p.y));
            });

            const colors = ['#FFE4B5', '#B0E0E6', '#98FB98', '#FFB6C1', '#F0E68C', '#DDA0DD'];
            const polygon = new Konva.Line({
                points: points,
                closed: true,
                fill: colors[idx % colors.length],
                stroke: '#666',
                strokeWidth: 1,
                opacity: 0.6
            });

            this.layer.add(polygon);

            const label = new Konva.Text({
                x: this.transform(room.centroid.x),
                y: this.transform(room.centroid.y),
                text: `${Math.round(room.area / 1000000)}m²`,
                fontSize: 12,
                fontFamily: 'Arial',
                fill: '#000',
                align: 'center'
            });

            this.layer.add(label);
        });
    }

    renderCorridors(corridors) {
        corridors.forEach(corr => {
            const line = new Konva.Line({
                points: [
                    this.transform(corr.x1),
                    this.transform(corr.y1),
                    this.transform(corr.x2),
                    this.transform(corr.y2)
                ],
                stroke: '#999',
                strokeWidth: Math.max(1, corr.width * this.scale),
                dash: [5, 5],
                opacity: 0.5
            });

            this.layer.add(line);
        });
    }

    transform(value) {
        return value * this.scale + this.panX;
    }

    redraw() {
        this.layer.draw();
    }

    exportJSON() {
        return JSON.stringify({
            walls: [],
            doors: [],
            windows: [],
            rooms: []
        }, null, 2);
    }

    exportSVG() {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', this.stage.width());
        svg.setAttribute('height', this.stage.height());

        const shapes = this.layer.getChildren();
        shapes.forEach(shape => {
            if (shape instanceof Konva.Line) {
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                const points = shape.points();
                if (points.length >= 4) {
                    line.setAttribute('x1', points[0]);
                    line.setAttribute('y1', points[1]);
                    line.setAttribute('x2', points[2]);
                    line.setAttribute('y2', points[3]);
                    line.setAttribute('stroke', shape.stroke());
                    line.setAttribute('stroke-width', shape.strokeWidth());
                    svg.appendChild(line);
                }
            }
        });

        return new XMLSerializer().serializeToString(svg);
    }

    exportDXF() {
        let dxf = 'SECTION\n2\nHEADER\n0\nENDSEC\n';
        dxf += '0\nSECTION\n2\nENTITIES\n';

        const shapes = this.layer.getChildren();
        shapes.forEach((shape, idx) => {
            if (shape instanceof Konva.Line) {
                const points = shape.points();
                if (points.length >= 4) {
                    dxf += `0\nLINE\n8\nLAYER0\n10\n${points[0]}\n20\n${points[1]}\n30\n0\n`;
                    dxf += `11\n${points[2]}\n21\n${points[3]}\n31\n0\n`;
                }
            }
        });

        dxf += '0\nENDSEC\n0\nEOF';
        return dxf;
    }
}

class AntigravityEngine {
    constructor() {
        this.wallSystem = new WallSystem();
        this.openingsEngine = new OpeningsEngine(this.wallSystem);
        this.roomDetectionEngine = new RoomDetectionEngine(this.wallSystem);
        this.adjacencyGraphEngine = new AdjacencyGraphEngine(this.roomDetectionEngine);
        this.nbcRules = new NBCRulesEngine();
        this.vastuEngine = new VastuEngine();
        this.layoutGenerator = new LayoutGenerator(
            this.wallSystem,
            this.openingsEngine,
            this.nbcRules,
            this.vastuEngine
        );
        this.circulationGenerator = new CirculationGenerator(
            this.wallSystem,
            this.roomDetectionEngine
        );
        this.renderer = null;
    }

    generateFloorPlan(config) {
        this.wallSystem = new WallSystem();
        this.openingsEngine = new OpeningsEngine(this.wallSystem);
        this.roomDetectionEngine = new RoomDetectionEngine(this.wallSystem);
        this.adjacencyGraphEngine = new AdjacencyGraphEngine(this.roomDetectionEngine);
        this.layoutGenerator = new LayoutGenerator(
            this.wallSystem,
            this.openingsEngine,
            this.nbcRules,
            this.vastuEngine
        );
        this.circulationGenerator = new CirculationGenerator(
            this.wallSystem,
            this.roomDetectionEngine
        );

        const layout = this.layoutGenerator.generateLayout(config);
        const rooms = this.roomDetectionEngine.detectRooms();
        const graph = this.adjacencyGraphEngine.generateGraph();
        const corridors = this.circulationGenerator.generateCirculation();

        const validatedRooms = this.nbcRules.adjustRoomSizes(rooms);

        return {
            walls: layout.walls,
            doors: layout.doors,
            windows: layout.windows,
            rooms: validatedRooms,
            adjacencyGraph: graph,
            circulation: corridors,
            bounds: layout.bounds
        };
    }

    render(containerId, floorPlan) {
        if (!this.renderer) {
            if (typeof Konva === 'undefined') {
                console.error('Konva is not loaded. Please include Konva.js script.');
                return;
            }
            this.renderer = new RenderingEngine(containerId);
        }

        this.renderer.renderFloorPlan(
            this.wallSystem,
            this.openingsEngine,
            floorPlan.rooms,
            floorPlan.circulation
        );
    }

    exportJSON(floorPlan) {
        return JSON.stringify(floorPlan, null, 2);
    }

    exportSVG() {
        return this.renderer ? this.renderer.exportSVG() : '';
    }

    exportDXF() {
        return this.renderer ? this.renderer.exportDXF() : '';
    }
}

window.Antigravity = new AntigravityEngine();
