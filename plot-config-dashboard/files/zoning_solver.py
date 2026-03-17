"""
Zoning Layer Solver

Divides the buildable polygon into functional zones:
- Front zone (public): parking, foyer, living
- Middle zone (semi-private): dining, kitchen
- Rear zone (private): bedrooms
- Service zone: bathrooms, utility, storage

Zones rotate based on road direction to optimize layout orientation.
"""

from dataclasses import dataclass
from typing import List, Dict, Tuple, Optional
from enum import Enum
import math
from shapely.geometry import Polygon, Point, box


class RoadDirection(Enum):
    """Cardinal directions for plot road frontage."""
    NORTH = 0
    EAST = 90
    SOUTH = 180
    WEST = 270


class ZoneType(Enum):
    """Functional zone categories."""
    FRONT = "front"           # Public entrance zone
    MIDDLE = "middle"         # Semi-private kitchen/dining
    REAR = "rear"             # Private bedroom zone
    SERVICE = "service"       # Service zone (bathrooms, utility)


@dataclass
class Zone:
    """Represents a spatial zone within the buildable area."""
    zone_type: ZoneType
    polygon: Polygon
    preferred_rooms: List[str]
    min_width: float
    min_height: float
    area: float = 0.0
    
    def __post_init__(self):
        self.area = self.polygon.area


class ZoningSolver:
    """
    Divides buildable polygon into functional zones based on road orientation.
    
    The zoning strategy adapts to road direction:
    - Road North → Front zone on north edge
    - Road South → Front zone on south edge
    - Road East → Front zone on east edge
    - Road West → Front zone on west edge
    """
    
    # Room-to-zone mapping
    ROOM_ZONE_MAPPING = {
        # Front zone (entry side)
        'Foyer': ZoneType.FRONT,
        'Living': ZoneType.FRONT,
        'Parking': ZoneType.FRONT,
        
        # Middle zone (transition)
        'Dining': ZoneType.MIDDLE,
        'Kitchen': ZoneType.MIDDLE,
        
        # Rear zone (private)
        'MasterBedroom': ZoneType.REAR,
        'Bedroom': ZoneType.REAR,
        'Bedroom2': ZoneType.REAR,
        'Bedroom3': ZoneType.REAR,
        'Bedroom4': ZoneType.REAR,
        
        # Service zone
        'Bathroom': ZoneType.SERVICE,
        'Utility': ZoneType.SERVICE,
        'Store': ZoneType.SERVICE,
        'Stair': ZoneType.SERVICE,
    }
    
    def __init__(self):
        """Initialize zoning solver."""
        self.zones: List[Zone] = []
        self.road_direction: RoadDirection = RoadDirection.SOUTH
        self.buildable_polygon: Optional[Polygon] = None
    
    def solve_zones(
        self,
        buildable_polygon: Polygon,
        road_direction: RoadDirection,
        rooms: List[str]
    ) -> List[Zone]:
        """
        Divide buildable polygon into zones based on road direction.
        
        Args:
            buildable_polygon: The buildable area polygon
            road_direction: Direction of the primary road/frontage
            rooms: List of rooms in the program (for zone sizing)
            
        Returns:
            List of Zone objects
        """
        self.buildable_polygon = buildable_polygon
        self.road_direction = road_direction
        self.zones = []
        
        # Get bounds
        minx, miny, maxx, maxy = buildable_polygon.bounds
        width = maxx - minx
        height = maxy - miny
        
        # Determine zone depths based on polygon dimensions and room count
        front_depth = self._calculate_front_zone_depth(width, height, rooms)
        rear_depth = self._calculate_rear_zone_depth(width, height, rooms)
        
        # Create zones based on road direction
        zones = self._create_oriented_zones(
            buildable_polygon,
            road_direction,
            front_depth,
            rear_depth
        )
        
        # Clip zones to buildable polygon
        zones = [self._clip_zone_to_polygon(z, buildable_polygon) for z in zones]
        
        # Filter valid zones
        self.zones = [z for z in zones if z.polygon.area > 1.0]
        
        return self.zones
    
    def _calculate_front_zone_depth(
        self,
        width: float,
        height: float,
        rooms: List[str]
    ) -> float:
        """Calculate appropriate front zone depth."""
        # Front zone should accommodate parking (2.5m) + foyer + entry to living
        has_parking = 'Parking' in rooms
        base_depth = 5.0 if has_parking else 3.5
        
        # Scale slightly with plot dimensions
        scale_factor = min(width, height) / 10.0
        return base_depth * (0.8 + scale_factor * 0.2)
    
    def _calculate_rear_zone_depth(
        self,
        width: float,
        height: float,
        rooms: List[str]
    ) -> float:
        """Calculate appropriate rear zone depth."""
        # Rear zone for bedrooms
        bedroom_count = sum(1 for r in rooms if 'Bedroom' in r)
        base_depth = 5.0 + (bedroom_count - 1) * 2.0
        
        return min(base_depth, height * 0.4)
    
    def _create_oriented_zones(
        self,
        buildable_polygon: Polygon,
        road_direction: RoadDirection,
        front_depth: float,
        rear_depth: float
    ) -> List[Zone]:
        """
        Create zones oriented according to road direction.
        """
        minx, miny, maxx, maxy = buildable_polygon.bounds
        width = maxx - minx
        height = maxy - miny
        
        zones = []
        
        if road_direction == RoadDirection.SOUTH:
            # Front zone at south (bottom)
            front_poly = box(minx, miny, maxx, miny + front_depth)
            zones.append(Zone(
                zone_type=ZoneType.FRONT,
                polygon=front_poly,
                preferred_rooms=['Parking', 'Foyer', 'Living'],
                min_width=width,
                min_height=front_depth
            ))
            
            # Rear zone at north
            rear_poly = box(minx, maxy - rear_depth, maxx, maxy)
            zones.append(Zone(
                zone_type=ZoneType.REAR,
                polygon=rear_poly,
                preferred_rooms=['MasterBedroom', 'Bedroom', 'Bedroom2'],
                min_width=width,
                min_height=rear_depth
            ))
            
            # Middle zone in between
            middle_height = height - front_depth - rear_depth
            if middle_height > 2.0:
                middle_poly = box(minx, miny + front_depth, maxx, maxy - rear_depth)
                zones.append(Zone(
                    zone_type=ZoneType.MIDDLE,
                    polygon=middle_poly,
                    preferred_rooms=['Dining', 'Kitchen'],
                    min_width=width,
                    min_height=middle_height
                ))
            
            # Service zone distributed
            zones.append(Zone(
                zone_type=ZoneType.SERVICE,
                polygon=box(maxx - 3.0, miny, maxx, maxy),
                preferred_rooms=['Bathroom', 'Utility', 'Store'],
                min_width=3.0,
                min_height=height
            ))
        
        elif road_direction == RoadDirection.NORTH:
            # Front zone at north (top)
            front_poly = box(minx, maxy - front_depth, maxx, maxy)
            zones.append(Zone(
                zone_type=ZoneType.FRONT,
                polygon=front_poly,
                preferred_rooms=['Parking', 'Foyer', 'Living'],
                min_width=width,
                min_height=front_depth
            ))
            
            # Rear zone at south
            rear_poly = box(minx, miny, maxx, miny + rear_depth)
            zones.append(Zone(
                zone_type=ZoneType.REAR,
                polygon=rear_poly,
                preferred_rooms=['MasterBedroom', 'Bedroom', 'Bedroom2'],
                min_width=width,
                min_height=rear_depth
            ))
            
            # Middle zone
            middle_height = height - front_depth - rear_depth
            if middle_height > 2.0:
                middle_poly = box(minx, miny + rear_depth, maxx, maxy - front_depth)
                zones.append(Zone(
                    zone_type=ZoneType.MIDDLE,
                    polygon=middle_poly,
                    preferred_rooms=['Dining', 'Kitchen'],
                    min_width=width,
                    min_height=middle_height
                ))
            
            # Service zone
            zones.append(Zone(
                zone_type=ZoneType.SERVICE,
                polygon=box(maxx - 3.0, miny, maxx, maxy),
                preferred_rooms=['Bathroom', 'Utility', 'Store'],
                min_width=3.0,
                min_height=height
            ))
        
        elif road_direction == RoadDirection.EAST:
            # Front zone at east (right)
            front_poly = box(maxx - front_depth, miny, maxx, maxy)
            zones.append(Zone(
                zone_type=ZoneType.FRONT,
                polygon=front_poly,
                preferred_rooms=['Parking', 'Foyer', 'Living'],
                min_width=front_depth,
                min_height=height
            ))
            
            # Rear zone at west
            rear_poly = box(minx, miny, minx + rear_depth, maxy)
            zones.append(Zone(
                zone_type=ZoneType.REAR,
                polygon=rear_poly,
                preferred_rooms=['MasterBedroom', 'Bedroom', 'Bedroom2'],
                min_width=rear_depth,
                min_height=height
            ))
            
            # Middle zone
            middle_width = width - front_depth - rear_depth
            if middle_width > 2.0:
                middle_poly = box(minx + rear_depth, miny, maxx - front_depth, maxy)
                zones.append(Zone(
                    zone_type=ZoneType.MIDDLE,
                    polygon=middle_poly,
                    preferred_rooms=['Dining', 'Kitchen'],
                    min_width=middle_width,
                    min_height=height
                ))
            
            # Service zone
            zones.append(Zone(
                zone_type=ZoneType.SERVICE,
                polygon=box(minx, maxy - 3.0, maxx, maxy),
                preferred_rooms=['Bathroom', 'Utility', 'Store'],
                min_width=width,
                min_height=3.0
            ))
        
        elif road_direction == RoadDirection.WEST:
            # Front zone at west (left)
            front_poly = box(minx, miny, minx + front_depth, maxy)
            zones.append(Zone(
                zone_type=ZoneType.FRONT,
                polygon=front_poly,
                preferred_rooms=['Parking', 'Foyer', 'Living'],
                min_width=front_depth,
                min_height=height
            ))
            
            # Rear zone at east
            rear_poly = box(maxx - rear_depth, miny, maxx, maxy)
            zones.append(Zone(
                zone_type=ZoneType.REAR,
                polygon=rear_poly,
                preferred_rooms=['MasterBedroom', 'Bedroom', 'Bedroom2'],
                min_width=rear_depth,
                min_height=height
            ))
            
            # Middle zone
            middle_width = width - front_depth - rear_depth
            if middle_width > 2.0:
                middle_poly = box(minx + front_depth, miny, maxx - rear_depth, maxy)
                zones.append(Zone(
                    zone_type=ZoneType.MIDDLE,
                    polygon=middle_poly,
                    preferred_rooms=['Dining', 'Kitchen'],
                    min_width=middle_width,
                    min_height=height
                ))
            
            # Service zone
            zones.append(Zone(
                zone_type=ZoneType.SERVICE,
                polygon=box(minx, maxy - 3.0, maxx, maxy),
                preferred_rooms=['Bathroom', 'Utility', 'Store'],
                min_width=width,
                min_height=3.0
            ))
        
        return zones
    
    def _clip_zone_to_polygon(
        self,
        zone: Zone,
        buildable_polygon: Polygon
    ) -> Zone:
        """Clip zone polygon to fit within buildable polygon."""
        clipped = zone.polygon.intersection(buildable_polygon)
        
        if clipped.is_empty or clipped.area < 1.0:
            return zone
        
        if clipped.geom_type == 'Polygon':
            zone.polygon = clipped
        elif clipped.geom_type == 'MultiPolygon':
            # Use largest polygon
            zone.polygon = max(clipped.geoms, key=lambda p: p.area)
        
        return zone
    
    def get_room_zone(self, room_name: str) -> Optional[ZoneType]:
        """Get preferred zone for a room."""
        for zone_name, zone_type in self.ROOM_ZONE_MAPPING.items():
            if room_name.startswith(zone_name):
                return zone_type
        return None
    
    def get_zone_for_room(self, room_name: str) -> Optional[Zone]:
        """Find the zone that should contain a specific room."""
        preferred_zone = self.get_room_zone(room_name)
        
        if preferred_zone is None:
            return self.zones[0] if self.zones else None
        
        for zone in self.zones:
            if zone.zone_type == preferred_zone:
                return zone
        
        return None
    
    def to_dict(self) -> Dict:
        """Export zones to dictionary format."""
        return {
            'road_direction': self.road_direction.name,
            'zones': [
                {
                    'type': z.zone_type.value,
                    'area': z.area,
                    'bounds': list(z.polygon.bounds),
                    'preferred_rooms': z.preferred_rooms,
                    'coordinates': list(z.polygon.exterior.coords)
                }
                for z in self.zones
            ]
        }


# Example usage
if __name__ == '__main__':
    from shapely.geometry import box
    
    print("=== Zoning Solver Example ===\n")
    
    # Create a 20x15m buildable area
    buildable = box(0, 0, 20, 15)
    rooms = ['Parking', 'Foyer', 'Living', 'Dining', 'Kitchen',
             'MasterBedroom', 'Bedroom2', 'Bathroom', 'Utility']
    
    solver = ZoningSolver()
    
    # Test with South road
    print("Road Direction: SOUTH")
    zones_south = solver.solve_zones(buildable, RoadDirection.SOUTH, rooms)
    for zone in zones_south:
        print(f"  {zone.zone_type.value}: {zone.area:.1f} sqm, preferred: {zone.preferred_rooms}")
    
    print("\n" + "="*50 + "\n")
    
    # Test with North road
    print("Road Direction: NORTH")
    zones_north = solver.solve_zones(buildable, RoadDirection.NORTH, rooms)
    for zone in zones_north:
        print(f"  {zone.zone_type.value}: {zone.area:.1f} sqm, preferred: {zone.preferred_rooms}")
    
    print("\n" + "="*50 + "\n")
    
    # Test with East road
    print("Road Direction: EAST")
    zones_east = solver.solve_zones(buildable, RoadDirection.EAST, rooms)
    for zone in zones_east:
        print(f"  {zone.zone_type.value}: {zone.area:.1f} sqm, preferred: {zone.preferred_rooms}")
