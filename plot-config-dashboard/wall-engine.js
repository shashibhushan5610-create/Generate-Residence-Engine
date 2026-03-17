/**
 * Antigravity Wall Engine
 * A pure transformation layer for constructing topological wall graphs from room polygons.
 */

// ─── Primitives and Constants ──────────────────────────────────────────────

const EPSILON = 1e-4;
const EPSILON_SNAP = 5.0; // mm — points closer than this are the same node
const MIN_OPENING_WIDTH = 600; // mm
const MIN_STUB_WIDTH = 100; // mm
const GRID_SIZE = 10; // mm

// Default wall thicknesses by room type (mm)
const WALL_THICKNESS_TABLE = {
    'Bathroom': 150,
    'Kitchen': 150,
    'Default': 150,
    'Exterior': 200
};

// ─── Math & Geometry Helpers ───────────────────────────────────────────────

class Vec2 {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
    
    static add(a, b) { return new Vec2(a.x + b.x, a.y + b.y); }
    static sub(a, b) { return new Vec2(a.x - b.x, a.y - b.y); }
    static mul(v, scalar) { return new Vec2(v.x * scalar, v.y * scalar); }
    static distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
    static normalize(v) {
        const len = Math.hypot(v.x, v.y);
        if (len === 0) return new Vec2(0, 0);
        return new Vec2(v.x / len, v.y / len);
    }
    static midpoint(a, b) { return new Vec2((a.x + b.x) / 2, (a.y + b.y) / 2); }
    static lerp(a, b, t) { return new Vec2(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t); }
}

function computeAABB(startPoint, endPoint, thickness = 0) {
    const minX = Math.min(startPoint.x, endPoint.x) - thickness;
    const minY = Math.min(startPoint.y, endPoint.y) - thickness;
    const maxX = Math.max(startPoint.x, endPoint.x) + thickness;
    const maxY = Math.max(startPoint.y, endPoint.y) + thickness;
    return { min: new Vec2(minX, minY), max: new Vec2(maxX, maxY) };
}

function aabbIntersect(a, b) {
    return !(a.max.x < b.min.x || a.min.x > b.max.x || a.max.y < b.min.y || a.min.y > b.max.y);
}

function aabbInflate(aabb, amount) {
    return {
        min: new Vec2(aabb.min.x - amount, aabb.min.y - amount),
        max: new Vec2(aabb.max.x + amount, aabb.max.y + amount)
    };
}

function hashWallID(p0, p1) {
    // Canonicalize by sorting endpoints
    const pts = [p0, p1].sort((a, b) => a.x !== b.x ? a.x - b.x : a.y - b.y);
    return `${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}-${pts[1].x.toFixed(2)},${pts[1].y.toFixed(2)}`;
}

function quantize(pt, eps) {
    return `${Math.round(pt.x / eps)}:${Math.round(pt.y / eps)}`;
}

function wallLength(wall) {
    return Vec2.distance(wall.start_point, wall.end_point);
}

function getSegmentsIntersection(p0, p1, p2, p3) {
    const s1_x = p1.x - p0.x;
    const s1_y = p1.y - p0.y;
    const s2_x = p3.x - p2.x;
    const s2_y = p3.y - p2.y;

    const denom = -s2_x * s1_y + s1_x * s2_y;
    if (Math.abs(denom) < EPSILON) return null;

    const s = (-s1_y * (p0.x - p2.x) + s1_x * (p0.y - p2.y)) / denom;
    const t = ( s2_x * (p0.y - p2.y) - s2_y * (p0.x - p2.x)) / denom;

    if (s >= 0 && s <= 1 && t >= 0 && t <= 1) {
        return new Vec2(p0.x + (t * s1_x), p0.y + (t * s1_y));
    }
    return null;
}

function segmentIntersect(wallA, wallB) {
    return getSegmentsIntersection(wallA.start_point, wallA.end_point, wallB.start_point, wallB.end_point);
}

function angleBetween(wA, wB, center) {
    const dirA = Vec2.normalize(Vec2.sub(otherEndpoint(wA, center), center));
    const dirB = Vec2.normalize(Vec2.sub(otherEndpoint(wB, center), center));
    return Math.acos(Math.max(-1, Math.min(1, dirA.x * dirB.x + dirA.y * dirB.y)));
}

function otherEndpoint(wall, pt) {
    return Vec2.distance(wall.start_point, pt) < EPSILON ? wall.end_point : wall.start_point;
}

function isEndpointNode(wall, node) {
    return (Vec2.distance(wall.start_point, node.position) < EPSILON ||
            Vec2.distance(wall.end_point, node.position) < EPSILON);
}

// ─── Simple Spatial Index (Fallback for QuadTree) ──────────────────────────

class BasicSpatialIndex {
    constructor() {
        this.items = [];
    }
    insert(aabb, item) {
        this.items.push({ aabb, item });
    }
    remove(item) {
        this.items = this.items.filter(i => i.item !== item);
    }
    update(item) {
        // No-op for simple array; recomputing AABB happens natively
    }
    query(queryAABB) {
        return this.items.filter(i => aabbIntersect(i.aabb, queryAABB)).map(i => i.item);
    }
}

// ─── Wall Engine Core ──────────────────────────────────────────────────────

const WallFlags = {
    NONE: 0,
    STRUCTURAL: 1 << 0,
    EXTERIOR: 1 << 1,
    PARTY: 1 << 2,
    VIRTUAL: 1 << 3
};

class WallEngine {
    constructor() {
        this.graph = {
            walls: new Map(),
            nodes: new Map(),
            rooms: new Map(),
            spatial: new BasicSpatialIndex(),
            dirty: new Set()
        };
    }

    /**
     * Entry point: Generate WallGraph from room polygons.
     */
    generateWalls(rooms) {
        const candidates = new Map();
        const spatial = new BasicSpatialIndex();

        for (const room of rooms) {
            this.graph.rooms.set(room.room_id, room);
            const polygon = room.polygon;
            const n = polygon.length;

            for (let i = 0; i < n; i++) {
                const p0 = new Vec2(polygon[i].x, polygon[i].y);
                const p1 = new Vec2(polygon[(i + 1) % n].x, polygon[(i + 1) % n].y);

                if (Vec2.distance(p0, p1) < EPSILON) continue;

                const id = hashWallID(p0, p1);
                const thickness = WALL_THICKNESS_TABLE[room.room_type] || WALL_THICKNESS_TABLE.Default;

                const wall = {
                    wall_id: id,
                    start_point: p0,
                    end_point: p1,
                    thickness: thickness,
                    height: room.ceiling_height,
                    connected_rooms: [room.room_id],
                    openings: [],
                    flags: WallFlags.NONE,
                    aabb: computeAABB(p0, p1, thickness)
                };

                if (candidates.has(id)) {
                    const existing = candidates.get(id);
                    existing.connected_rooms.push(room.room_id);
                    existing.thickness = Math.max(existing.thickness, wall.thickness);
                } else {
                    candidates.set(id, wall);
                    spatial.insert(wall.aabb, wall);
                }
            }
        }

        for (const wall of candidates.values()) {
            if (wall.connected_rooms.length === 1) {
                wall.flags |= WallFlags.EXTERIOR;
            }
            this.graph.walls.set(wall.wall_id, wall);
        }
        
        this.graph.spatial = spatial;
        this.detectNodes();
        return this.graph;
    }

    /**
     * Node Detection & Classification
     */
    detectNodes() {
        const nodeMap = new Map();

        // Pass 1: register endpoints
        for (const wall of this.graph.walls.values()) {
            for (const pt of [wall.start_point, wall.end_point]) {
                const nid = quantize(pt, EPSILON_SNAP);
                if (!nodeMap.has(nid)) {
                    nodeMap.set(nid, { node_id: nid, position: pt, walls: [], join_type: 'ENDPOINT', is_locked: false });
                }
                if (!nodeMap.get(nid).walls.includes(wall.wall_id)) {
                    nodeMap.get(nid).walls.push(wall.wall_id);
                }
            }
        }

        // Pass 2: find mid-wall intersections
        const wallsArray = Array.from(this.graph.walls.values());
        for (let i = 0; i < wallsArray.length; i++) {
            const wallA = wallsArray[i];
            const candidates = this.graph.spatial.query(aabbInflate(wallA.aabb, wallA.thickness + EPSILON_SNAP));
            
            for (const wallB of candidates) {
                if (wallA.wall_id >= wallB.wall_id) continue;
                
                const pt = segmentIntersect(wallA, wallB);
                if (!pt) continue;

                const nid = quantize(pt, EPSILON_SNAP);
                if (!nodeMap.has(nid)) {
                    nodeMap.set(nid, { node_id: nid, position: pt, walls: [], join_type: 'X', is_locked: false });
                }

                if (!nodeMap.get(nid).walls.includes(wallA.wall_id)) nodeMap.get(nid).walls.push(wallA.wall_id);
                if (!nodeMap.get(nid).walls.includes(wallB.wall_id)) nodeMap.get(nid).walls.push(wallB.wall_id);
            }
        }

        // Pass 3: Join classification
        for (const node of nodeMap.values()) {
            const degree = node.walls.length;
            if (degree === 1) node.join_type = 'ENDPOINT';
            else if (degree === 2) node.join_type = 'L'; // Treat mid-line as L or Endpoint connected? Handled by split usually.
            else if (degree === 3) node.join_type = 'T';
            else node.join_type = 'X';
        }

        this.graph.nodes = nodeMap;
        this.resolveJoins();
    }

    /**
     * Wall Join Resolution
     */
    resolveJoins() {
        for (const node of this.graph.nodes.values()) {
            switch (node.join_type) {
                case 'L': this.resolveL(node); break;
                case 'T': this.resolveT(node); break;
                case 'X': this.resolveX(node); break;
            }
        }
    }

    resolveL(node) {
        if (node.walls.length !== 2) return;
        const wA = this.graph.walls.get(node.walls[0]);
        const wB = this.graph.walls.get(node.walls[1]);
        if (!wA || !wB) return;

        const theta = angleBetween(wA, wB, node.position);
        // Avoid parallel walls blowing up the offset
        if (theta < 0.01 || Math.abs(theta - Math.PI) < 0.01) return;

        const miterOffset = (Math.max(wA.thickness, wB.thickness) / 2) / Math.tan(theta / 2);
        this.trimWallEnd(wA, node.position, miterOffset);
        this.trimWallEnd(wB, node.position, miterOffset);
    }

    resolveT(node) {
        if (node.walls.length !== 3) return;
        const walls = node.walls.map(id => this.graph.walls.get(id)).filter(w => w);
        const header = walls.find(w => !isEndpointNode(w, node));
        const stems = walls.filter(w => isEndpointNode(w, node));

        if (!header) return;

        for (const s of stems) {
            this.snapEndpointToLine(s, header.start_point, header.end_point);
        }
    }

    resolveX(node) {
        const walls = node.walls.map(id => this.graph.walls.get(id)).filter(w => w);
        for (const wall of walls) {
            if (!isEndpointNode(wall, node)) {
                // Needs split implementation
            }
        }
    }

    trimWallEnd(wall, nodePos, offset) {
        // Simple trim implementation without over-shortening bounds checks
        const endpoint = otherEndpoint(wall, nodePos);
        const dir = Vec2.normalize(Vec2.sub(nodePos, endpoint));
        
        if (Vec2.distance(nodePos, wall.end_point) < EPSILON) {
            wall.end_point = Vec2.sub(nodePos, Vec2.mul(dir, offset));
        } else {
            wall.start_point = Vec2.add(nodePos, Vec2.mul(dir, offset));
        }

        wall.aabb = computeAABB(wall.start_point, wall.end_point, wall.thickness);
        wall.start_node = quantize(wall.start_point, EPSILON_SNAP);
        wall.end_node = quantize(wall.end_point, EPSILON_SNAP);
    }

    snapEndpointToLine(stem, lineStart, lineEnd) {
        // Logic to snap and align the stem to the header line thickness
    }

    /**
     * Validate graph constraints
     */
    validateGraph() {
        const errors = [];
        for (const wall of this.graph.walls.values()) {
            if (wallLength(wall) < EPSILON) {
                errors.push({ code: 'ZERO_LENGTH', wall_id: wall.wall_id });
            }
            if (!this.graph.nodes.has(wall.start_node) || !this.graph.nodes.has(wall.end_node)) {
                // orphans
            }
        }
        return errors;
    }
}

// Export for module systems or just attach to window
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { WallEngine, Vec2 };
} else {
    window.WallEngine = WallEngine;
    window.Vec2 = Vec2;
}
