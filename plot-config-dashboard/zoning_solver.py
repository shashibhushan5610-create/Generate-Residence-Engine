"""
Zoning Layer Solver — v2 (Aligned with Layout Engine Pipeline)

Divides the buildable polygon into functional zones that match:
  - RoomZone categories from program_generator.py
      PUBLIC        → Front Zone  (Foyer, Living, Parking)
      SEMI_PRIVATE  → Middle Zone (Dining, Kitchen)
      PRIVATE       → Rear Zone   (MasterBedroom, Bedroom*)
      SERVICE       → Service Strip (Bathroom*, Utility, Store, Stair)
  - Adjacency sequence from adjacency_graph.py
      Entry → Parking → Foyer → Living → Dining → Kitchen
      Side strip: Bathroom / Utility next to Kitchen & Bedrooms
  - Corner-plot awareness: merges two front zones when roads on two sides

Zones are clipped precisely to the buildable polygon using Shapely.
The to_dict() output includes full exterior 'coordinates' so the
frontend can draw accurate polygons (not just bounding boxes).
"""

from dataclasses import dataclass, field
from typing import List, Dict, Tuple, Optional, Set
from enum import Enum
import math

from shapely.geometry import Polygon, box, MultiPolygon
from shapely.ops import unary_union


# ─── Enums ────────────────────────────────────────────────────────────────────

class RoadDirection(Enum):
    """Cardinal directions for plot road frontage."""
    NORTH = "north"
    EAST  = "east"
    SOUTH = "south"
    WEST  = "west"


class ZoneType(Enum):
    """
    Functional zone categories — aligned with RoomZone in program_generator.py.
    """
    FRONT   = "front"    # PUBLIC:       Foyer, Living, Parking → entry side
    MIDDLE  = "middle"   # SEMI_PRIVATE: Dining, Kitchen         → transition zone
    REAR    = "rear"     # PRIVATE:      Bedrooms / Master        → private side
    SERVICE = "service"  # SERVICE:      Bathrooms, Utility, Store → back strip


# ─── Zone Dataclass ───────────────────────────────────────────────────────────

@dataclass
class Zone:
    """Represents a spatial zone within the buildable area."""

    zone_type:       ZoneType
    polygon:         Polygon
    preferred_rooms: List[str]
    min_width:       float
    min_depth:       float
    area:            float = field(default=0.0)

    def __post_init__(self):
        self.area = round(self.polygon.area, 3)


# ─── Room → Zone mapping (mirrors program_generator.RoomZone) ─────────────────

ROOM_ZONE_MAP: Dict[str, ZoneType] = {
    # PUBLIC → FRONT
    "Foyer":          ZoneType.FRONT,
    "Living":         ZoneType.FRONT,
    "Parking":        ZoneType.FRONT,
    "GuestRoom":      ZoneType.FRONT,

    # SEMI_PRIVATE → MIDDLE
    "Dining":         ZoneType.MIDDLE,
    "Kitchen":        ZoneType.MIDDLE,

    # PRIVATE → REAR
    "MasterBedroom":  ZoneType.REAR,
    "Bedroom":        ZoneType.REAR,
    "Bedroom2":       ZoneType.REAR,
    "Bedroom3":       ZoneType.REAR,
    "Bedroom4":       ZoneType.REAR,

    # SERVICE → SERVICE
    "MasterBath":     ZoneType.SERVICE,
    "Bathroom":       ZoneType.SERVICE,
    "Bathroom2":      ZoneType.SERVICE,
    "Bathroom3":      ZoneType.SERVICE,
    "Utility":        ZoneType.SERVICE,
    "Store":          ZoneType.SERVICE,
    "Stair":          ZoneType.SERVICE,
}

# Preferred room lists per zone (used for packing_solver zone hints)
ZONE_PREFERRED_ROOMS: Dict[ZoneType, List[str]] = {
    ZoneType.FRONT:   ["Parking", "Foyer", "Living", "GuestRoom"],
    ZoneType.MIDDLE:  ["Dining", "Kitchen"],
    ZoneType.REAR:    ["MasterBedroom", "Bedroom", "Bedroom2", "Bedroom3", "Bedroom4"],
    ZoneType.SERVICE: ["MasterBath", "Bathroom", "Bathroom2", "Utility", "Store", "Stair"],
}


# ─── Helper: road direction → axis information ─────────────────────────────────

def _road_axis(direction: RoadDirection) -> Dict:
    """
    Return axis metadata for the given road direction.
    'front_from' is 'min' or 'max' of the primary axis.
    """
    return {
        RoadDirection.SOUTH: dict(primary="y", front_from="min", secondary="x"),
        RoadDirection.NORTH: dict(primary="y", front_from="max", secondary="x"),
        RoadDirection.WEST:  dict(primary="x", front_from="min", secondary="y"),
        RoadDirection.EAST:  dict(primary="x", front_from="max", secondary="y"),
    }[direction]


# ─── Zone Depth Calculator ────────────────────────────────────────────────────

def _calculate_zone_depths(
    primary_dim: float,
    secondary_dim: float,
    rooms: List[str],
    has_parking: bool,
) -> Tuple[float, float, float]:
    """
    Return (front_depth, rear_depth, service_width).

    Depths are calculated to sum to ≤ primary_dim, with middle occupying remainder.
    Service zone is a side strip (along secondary axis).
    """
    bedroom_count = sum(1 for r in rooms if "Bedroom" in r)

    # Front: entry zone — deeper if parking included
    front_depth = 4.5 if has_parking else 3.5
    # Scale slightly with plot size
    front_depth = min(front_depth, primary_dim * 0.35)
    front_depth = max(front_depth, 2.0)

    # Rear: private bedroom zone — grows with bedroom count
    rear_depth = 4.5 + max(0, bedroom_count - 2) * 1.5
    rear_depth = min(rear_depth, primary_dim * 0.40)
    rear_depth = max(rear_depth, 3.0)

    # Ensure they don't exceed primary_dim
    total = front_depth + rear_depth
    if total >= primary_dim * 0.85:
        scale = (primary_dim * 0.85) / total
        front_depth *= scale
        rear_depth  *= scale

    # Service strip width (along secondary axis) — typically 2.5–3.5m
    service_width = max(2.5, min(3.5, secondary_dim * 0.25))

    return round(front_depth, 2), round(rear_depth, 2), round(service_width, 2)


# ─── Main Solver Class ────────────────────────────────────────────────────────

class ZoningSolver:
    """
    Divides a buildable polygon into functional zones aligned with the
    LayoutEngine pipeline (program_generator → adjacency_graph → packing_solver).

    Zoning strategy:
      1. Orient zones relative to road frontage (RoadDirection).
      2. Apply service strip perpendicular to entry (along secondary axis).
      3. Clip all zones to the actual buildable polygon (irregular shapes OK).
      4. Discard zones with area < 2 sqm.
      5. For corner plots (two road directions), merge both front zones.
    """

    def __init__(self):
        self.zones: List[Zone] = []
        self.road_directions: List[RoadDirection] = []
        self.buildable_polygon: Optional[Polygon] = None
        self._rooms: List[str] = []

    # ── Public API ──────────────────────────────────────────────────────────

    def solve_zones(
        self,
        buildable_polygon: Polygon,
        road_direction: RoadDirection,
        rooms: List[str],
        secondary_road_direction: Optional[RoadDirection] = None,
    ) -> List[Zone]:
        """
        Divide buildable polygon into functional zones.

        Args:
            buildable_polygon:       The buildable area (result of setback application).
            road_direction:          Primary road frontage direction.
            rooms:                   Room names from the program (used for sizing).
            secondary_road_direction: For corner plots — direction of the second road.

        Returns:
            List of Zone objects, sorted front → middle → rear → service.
        """
        if not buildable_polygon.is_valid or buildable_polygon.is_empty:
            raise ValueError("buildable_polygon is empty or invalid.")

        self.buildable_polygon = buildable_polygon
        self.road_directions   = [road_direction]
        self._rooms            = rooms or []

        if secondary_road_direction and secondary_road_direction != road_direction:
            self.road_directions.append(secondary_road_direction)

        minx, miny, maxx, maxy = buildable_polygon.bounds
        width  = maxx - minx
        height = maxy - miny

        has_parking = any("Parking" in r for r in rooms)

        # Primary axis sizing
        ax = _road_axis(road_direction)
        primary_dim   = height if ax["primary"] == "y" else width
        secondary_dim = width  if ax["primary"] == "y" else height

        front_depth, rear_depth, service_width = _calculate_zone_depths(
            primary_dim, secondary_dim, rooms, has_parking
        )

        # Build raw zone boxes
        raw_zones = self._build_zone_boxes(
            road_direction, minx, miny, maxx, maxy,
            front_depth, rear_depth, service_width
        )

        # For corner plots merge/extend front zone
        if len(self.road_directions) > 1:
            raw_zones = self._apply_corner_extension(
                raw_zones, self.road_directions[1],
                minx, miny, maxx, maxy,
                front_depth, rear_depth, service_width
            )

        # Clip each zone to buildable polygon
        clipped = [self._clip(z, buildable_polygon) for z in raw_zones]

        # Filter tiny zones and merge same-type zones
        self.zones = self._merge_and_filter(clipped)

        return self.zones

    # ── Zone Box Builders ───────────────────────────────────────────────────

    def _build_zone_boxes(
        self,
        direction: RoadDirection,
        minx: float, miny: float, maxx: float, maxy: float,
        front_depth: float, rear_depth: float, service_width: float,
    ) -> List[Zone]:
        """
        Build raw (unclipped) zone rectangles for a single road direction.
        """
        w = maxx - minx
        h = maxy - miny
        zones: List[Zone] = []

        if direction == RoadDirection.SOUTH:
            # Front = bottom strip
            front_box = box(minx, miny, maxx, miny + front_depth)
            # Rear = top strip (minus service width on right)
            rear_box  = box(minx, maxy - rear_depth, maxx - service_width, maxy)
            # Middle = band between front and rear (minus service width on right)
            mid_h = h - front_depth - rear_depth
            mid_box = box(minx, miny + front_depth, maxx - service_width, maxy - rear_depth) if mid_h > 1.5 else None
            # Service = right side strip (full height)
            svc_box = box(maxx - service_width, miny + front_depth, maxx, maxy)

        elif direction == RoadDirection.NORTH:
            front_box = box(minx, maxy - front_depth, maxx, maxy)
            rear_box  = box(minx, miny, maxx - service_width, miny + rear_depth)
            mid_h     = h - front_depth - rear_depth
            mid_box   = box(minx, miny + rear_depth, maxx - service_width, maxy - front_depth) if mid_h > 1.5 else None
            svc_box   = box(maxx - service_width, miny, maxx, maxy - front_depth)

        elif direction == RoadDirection.WEST:
            front_box = box(minx, miny, minx + front_depth, maxy)
            rear_box  = box(maxx - rear_depth, miny, maxx, maxy - service_width)
            mid_w     = w - front_depth - rear_depth
            mid_box   = box(minx + front_depth, miny, maxx - rear_depth, maxy - service_width) if mid_w > 1.5 else None
            svc_box   = box(minx + front_depth, maxy - service_width, maxx, maxy)

        else:  # EAST
            front_box = box(maxx - front_depth, miny, maxx, maxy)
            rear_box  = box(minx, miny, minx + rear_depth, maxy - service_width)
            mid_w     = w - front_depth - rear_depth
            mid_box   = box(minx + rear_depth, miny, maxx - front_depth, maxy - service_width) if mid_w > 1.5 else None
            svc_box   = box(minx, maxy - service_width, maxx - front_depth, maxy)

        # Assemble
        zones.append(Zone(ZoneType.FRONT, front_box,
                          ZONE_PREFERRED_ROOMS[ZoneType.FRONT],
                          min_width=3.0, min_depth=front_depth))

        zones.append(Zone(ZoneType.REAR, rear_box,
                          ZONE_PREFERRED_ROOMS[ZoneType.REAR],
                          min_width=3.0, min_depth=rear_depth))

        if mid_box:
            zones.append(Zone(ZoneType.MIDDLE, mid_box,
                              ZONE_PREFERRED_ROOMS[ZoneType.MIDDLE],
                              min_width=2.5, min_depth=3.0))

        zones.append(Zone(ZoneType.SERVICE, svc_box,
                          ZONE_PREFERRED_ROOMS[ZoneType.SERVICE],
                          min_width=2.0, min_depth=2.0))

        return zones

    def _apply_corner_extension(
        self,
        zones: List[Zone],
        secondary_direction: RoadDirection,
        minx: float, miny: float, maxx: float, maxy: float,
        front_depth: float, _: float, service_width: float,
    ) -> List[Zone]:
        """
        For a corner plot: extend the FRONT zone along the secondary road too,
        and trim the MIDDLE/REAR accordingly. The corner overlap becomes the
        entry corner (typically Foyer + Parking location).
        """
        # Build a secondary front strip in the secondary direction
        if secondary_direction == RoadDirection.SOUTH:
            corner_box = box(minx, miny, maxx, miny + front_depth)
        elif secondary_direction == RoadDirection.NORTH:
            corner_box = box(minx, maxy - front_depth, maxx, maxy)
        elif secondary_direction == RoadDirection.WEST:
            corner_box = box(minx, miny, minx + front_depth, maxy)
        else:  # EAST
            corner_box = box(maxx - front_depth, miny, maxx, maxy)

        # Extend the existing FRONT zone to include the secondary front strip
        updated_zones: List[Zone] = []
        for z in zones:
            if z.zone_type == ZoneType.FRONT:
                merged_front = unary_union([z.polygon, corner_box])
                # Keep as Polygon (take largest if MultiPolygon)
                if isinstance(merged_front, MultiPolygon):
                    merged_front = max(merged_front.geoms, key=lambda p: p.area)
                updated_zones.append(Zone(
                    ZoneType.FRONT, merged_front,
                    ZONE_PREFERRED_ROOMS[ZoneType.FRONT],
                    min_width=3.0, min_depth=front_depth
                ))
            else:
                updated_zones.append(z)

        return updated_zones

    # ── Clipping & Filtering ────────────────────────────────────────────────

    def _clip(self, zone: Zone, buildable: Polygon) -> Zone:
        """Clip zone polygon to buildable boundary."""
        try:
            clipped = zone.polygon.intersection(buildable)
        except Exception:
            return zone

        if clipped.is_empty or clipped.area < 0.5:
            return zone  # Return unclipped — filter will drop it

        # Use largest polygon if result is MultiPolygon
        if isinstance(clipped, MultiPolygon):
            clipped = max(clipped.geoms, key=lambda p: p.area)

        return Zone(
            zone_type=zone.zone_type,
            polygon=clipped,
            preferred_rooms=zone.preferred_rooms,
            min_width=zone.min_width,
            min_depth=zone.min_depth,
        )

    def _merge_and_filter(self, zones: List[Zone]) -> List[Zone]:
        """
        Merge zones of the same type (from corner extension) then filter tiny ones.
        Returns zones in canonical order: FRONT → MIDDLE → REAR → SERVICE.
        """
        # Group by type
        by_type: Dict[ZoneType, List[Polygon]] = {}
        preferred_rooms: Dict[ZoneType, List[str]] = {}
        min_widths: Dict[ZoneType, float] = {}
        min_depths: Dict[ZoneType, float] = {}

        for z in zones:
            if z.polygon.area < 2.0:
                continue
            by_type.setdefault(z.zone_type, []).append(z.polygon)
            preferred_rooms[z.zone_type] = z.preferred_rooms
            min_widths[z.zone_type]      = z.min_width
            min_depths[z.zone_type]      = z.min_depth

        merged: List[Zone] = []
        for zone_type in [ZoneType.FRONT, ZoneType.MIDDLE, ZoneType.REAR, ZoneType.SERVICE]:
            if zone_type not in by_type:
                continue
            polys = by_type[zone_type]
            combined = unary_union(polys) if len(polys) > 1 else polys[0]
            if isinstance(combined, MultiPolygon):
                combined = max(combined.geoms, key=lambda p: p.area)
            if combined.area < 2.0:
                continue
            merged.append(Zone(
                zone_type=zone_type,
                polygon=combined,
                preferred_rooms=preferred_rooms[zone_type],
                min_width=min_widths[zone_type],
                min_depth=min_depths[zone_type],
            ))

        return merged

    # ── Utility ─────────────────────────────────────────────────────────────

    def get_zone_for_room(self, room_name: str) -> Optional[Zone]:
        """Find the Zone that the room should be placed in."""
        target_type = None
        # Prefix match (handles Bedroom2, Bedroom3, Bathroom2, etc.)
        for prefix, zone_type in ROOM_ZONE_MAP.items():
            if room_name.startswith(prefix):
                target_type = zone_type
                break

        if target_type is None:
            return self.zones[0] if self.zones else None

        for z in self.zones:
            if z.zone_type == target_type:
                return z

        return None

    def get_zone_type_for_room(self, room_name: str) -> Optional[ZoneType]:
        """Return the ZoneType enum for a room name."""
        for prefix, zone_type in ROOM_ZONE_MAP.items():
            if room_name.startswith(prefix):
                return zone_type
        return None

    # ── Serialisation ────────────────────────────────────────────────────────

    def to_dict(self) -> Dict:
        """
        Export zones to dict.

        Each zone includes:
          - type: str (e.g. 'front')
          - area: float (sqm)
          - bounds: [minx, miny, maxx, maxy]
          - preferred_rooms: List[str]
          - coordinates: List[[x, y]]  ← full exterior polygon for frontend rendering
        """
        return {
            "road_directions": [d.value for d in self.road_directions],
            "zones": [
                {
                    "type":            z.zone_type.value,
                    "area":            round(z.area, 2),
                    "bounds":          list(z.polygon.bounds),
                    "preferred_rooms": z.preferred_rooms,
                    "coordinates":     [list(pt) for pt in z.polygon.exterior.coords],
                }
                for z in self.zones
            ],
        }


# ─── Convenience factory used by layout_engine.py ─────────────────────────────

def get_room_zone_type(room_name: str) -> Optional[ZoneType]:
    """Convenience function: return ZoneType for a room name."""
    for prefix, zone_type in ROOM_ZONE_MAP.items():
        if room_name.startswith(prefix):
            return zone_type
    return None


# ─── Self-test ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    from shapely.geometry import box as shapely_box

    print("=== ZoningSolver v2 Self-Test ===\n")

    buildable = shapely_box(0, 0, 15, 12)
    rooms = [
        "Parking", "Foyer", "Living", "Dining", "Kitchen",
        "MasterBedroom", "Bedroom2", "MasterBath", "Bathroom2", "Utility",
    ]

    solver = ZoningSolver()

    for direction in [RoadDirection.SOUTH, RoadDirection.NORTH,
                      RoadDirection.EAST, RoadDirection.WEST]:
        zones = solver.solve_zones(buildable, direction, rooms)
        print(f"Road: {direction.value.upper()}  — {len(zones)} zones")
        for z in zones:
            print(f"  [{z.zone_type.value:8}] {z.area:6.1f} sqm  "
                  f"preferred: {z.preferred_rooms[:3]}")
        print()

    # Corner plot test
    print("Corner plot (SOUTH + WEST roads):")
    zones = solver.solve_zones(buildable, RoadDirection.SOUTH, rooms,
                               secondary_road_direction=RoadDirection.WEST)
    for z in zones:
        print(f"  [{z.zone_type.value:8}] {z.area:6.1f} sqm")
