"""
Circulation Graph Generator

Creates corridor and circulation pathways connecting rooms.

Rules:
- Corridor width >= 1.0m
- Entry → foyer → living → dining → bedroom cluster
- All rooms must be reachable via circulation network
- Minimize total corridor length while maintaining accessibility
"""

import networkx as nx
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass
from shapely.geometry import LineString, Point, Polygon, MultiLineString
import math


@dataclass
class Corridor:
    """Represents a corridor/circulation path."""
    id: str
    start_room: str
    end_room: str
    line: LineString
    width: float = 1.0
    length: float = 0.0
    
    def __post_init__(self):
        self.length = self.line.length


@dataclass
class CirculationNode:
    """Node in circulation network (room or corridor junction)."""
    id: str
    node_type: str  # 'room' or 'junction'
    position: Tuple[float, float]
    room_name: Optional[str] = None


class CirculationGraph:
    """
    Generates optimal circulation network connecting all rooms.
    
    Creates:
    - Primary circulation path (entry sequence)
    - Secondary connections (bedroom clusters, service areas)
    - Corridor geometry with minimum width constraints
    """
    
    # Default circulation priorities and requirements
    CIRCULATION_SEQUENCE = [
        'Parking',
        'Foyer',
        'Living',
        'Dining',
        'Kitchen',
    ]
    
    BEDROOMS = ['MasterBedroom', 'Bedroom', 'Bedroom2', 'Bedroom3', 'Bedroom4']
    BATHROOMS = ['Bathroom']
    SERVICE_ROOMS = ['Utility', 'Store']
    
    MIN_CORRIDOR_WIDTH = 1.0
    
    def __init__(self):
        """Initialize circulation graph."""
        self.graph = nx.Graph()
        self.corridors: List[Corridor] = []
        self.primary_path: Optional[List[str]] = None
        self.room_positions: Dict[str, Tuple[float, float]] = {}
    
    def generate_circulation(
        self,
        room_placements: List,  # List of RoomPlacement objects
        buildable_polygon: Optional[Polygon] = None
    ) -> List[Corridor]:
        """
        Generate circulation paths for room layout.
        
        Args:
            room_placements: List of placed rooms with positions
            buildable_polygon: Buildable area for validation
            
        Returns:
            List of Corridor objects forming circulation network
        """
        self.room_positions = {}
        
        # Store room center positions
        for placement in room_placements:
            cx = placement.x + placement.width / 2
            cy = placement.y + placement.height / 2
            self.room_positions[placement.name] = (cx, cy)
        
        # Build circulation graph
        self._build_circulation_graph(room_placements)
        
        # Generate corridors
        self.corridors = self._generate_corridors()
        
        return self.corridors
    
    def _build_circulation_graph(self, room_placements: List):
        """Build the circulation network graph."""
        # Get room names
        room_names = [r.name for r in room_placements]
        
        # Add all rooms as nodes
        for room_name in room_names:
            self.graph.add_node(room_name, node_type='room')
        
        # Build primary circulation path
        self.primary_path = self._build_primary_path(room_names)
        
        if self.primary_path:
            # Connect primary path rooms
            for i in range(len(self.primary_path) - 1):
                room_a = self.primary_path[i]
                room_b = self.primary_path[i + 1]
                distance = self._room_distance(room_a, room_b)
                self.graph.add_edge(room_a, room_b, distance=distance, weight=distance)
        
        # Add secondary connections (bedrooms to bathrooms)
        self._add_bedroom_bathroom_connections(room_names)
        
        # Add service room connections (kitchen to utility)
        self._add_service_connections(room_names)
    
    def _build_primary_path(self, room_names: List[str]) -> List[str]:
        """
        Build primary entry sequence path.
        
        Follows: Entry → Foyer → Living → Dining → Kitchen
        """
        path = []
        
        for room_name in self.CIRCULATION_SEQUENCE:
            if room_name in room_names:
                path.append(room_name)
        
        return path if path else None
    
    def _add_bedroom_bathroom_connections(self, room_names: List[str]):
        """Connect bedrooms to bathrooms."""
        bedrooms = [r for r in room_names if any(b in r for b in self.BEDROOMS)]
        bathrooms = [r for r in room_names if any(b in r for b in self.BATHROOMS)]
        
        # Connect each bedroom to nearest bathroom
        for bedroom in bedrooms:
            if not bathrooms:
                continue
            
            nearest_bathroom = min(
                bathrooms,
                key=lambda b: self._room_distance(bedroom, b)
            )
            
            distance = self._room_distance(bedroom, nearest_bathroom)
            self.graph.add_edge(bedroom, nearest_bathroom, distance=distance, weight=distance)
    
    def _add_service_connections(self, room_names: List[str]):
        """Connect service rooms (utility, storage) to kitchen."""
        if 'Kitchen' not in room_names:
            return
        
        service_rooms = [r for r in room_names if any(s in r for s in self.SERVICE_ROOMS)]
        
        for service_room in service_rooms:
            distance = self._room_distance('Kitchen', service_room)
            self.graph.add_edge('Kitchen', service_room, distance=distance, weight=distance)
    
    def _room_distance(self, room_a: str, room_b: str) -> float:
        """Calculate distance between two rooms (center-to-center)."""
        if room_a not in self.room_positions or room_b not in self.room_positions:
            return 100.0  # Large distance for missing rooms
        
        pos_a = self.room_positions[room_a]
        pos_b = self.room_positions[room_b]
        
        dx = pos_a[0] - pos_b[0]
        dy = pos_a[1] - pos_b[1]
        
        return math.sqrt(dx * dx + dy * dy)
    
    def _generate_corridors(self) -> List[Corridor]:
        """
        Generate corridor LineStrings from circulation graph.
        """
        corridors = []
        corridor_id = 0
        
        visited_edges = set()
        
        for edge in self.graph.edges():
            # Create unique edge identifier (undirected)
            edge_key = tuple(sorted(edge))
            
            if edge_key in visited_edges:
                continue
            visited_edges.add(edge_key)
            
            room_a, room_b = edge
            
            # Get room positions
            if room_a not in self.room_positions or room_b not in self.room_positions:
                continue
            
            pos_a = self.room_positions[room_a]
            pos_b = self.room_positions[room_b]
            
            # Create corridor line
            corridor_line = LineString([pos_a, pos_b])
            
            corridor = Corridor(
                id=f'corridor_{corridor_id}',
                start_room=room_a,
                end_room=room_b,
                line=corridor_line,
                width=self.MIN_CORRIDOR_WIDTH
            )
            corridors.append(corridor)
            corridor_id += 1
        
        return corridors
    
    def get_accessibility_graph(self) -> nx.Graph:
        """
        Get the circulation graph as NetworkX graph.
        
        Useful for accessibility analysis and circulation optimization.
        """
        return self.graph.copy()
    
    def check_connectivity(self) -> bool:
        """Check if all rooms are connected via circulation."""
        if not self.graph.nodes():
            return False
        
        return nx.is_connected(self.graph)
    
    def get_unreachable_rooms(self) -> List[str]:
        """Get list of rooms not connected to main circulation."""
        if nx.is_connected(self.graph):
            return []
        
        # Get largest connected component
        largest_cc = max(nx.connected_components(self.graph), key=len)
        
        all_rooms = set(self.graph.nodes())
        unreachable = all_rooms - largest_cc
        
        return list(unreachable)
    
    def get_circulation_statistics(self) -> Dict:
        """Get statistics about circulation network."""
        if not self.corridors:
            return {
                'total_corridors': 0,
                'total_corridor_length': 0.0,
                'avg_corridor_length': 0.0,
                'connected': False,
                'unreachable_rooms': [],
            }
        
        total_length = sum(c.length for c in self.corridors)
        avg_length = total_length / len(self.corridors) if self.corridors else 0
        
        return {
            'total_corridors': len(self.corridors),
            'total_corridor_length': total_length,
            'avg_corridor_length': avg_length,
            'connected': self.check_connectivity(),
            'unreachable_rooms': self.get_unreachable_rooms(),
            'circulation_graph_edges': self.graph.number_of_edges(),
            'circulation_graph_nodes': self.graph.number_of_nodes(),
        }
    
    def generate_corridor_geometry(
        self,
        room_placements: List,
        offset: float = 0.1
    ) -> List[Polygon]:
        """
        Generate corridor polygons with given width.
        
        Args:
            room_placements: List of room placements
            offset: Distance to offset corridor edges from center line
            
        Returns:
            List of corridor polygons
        """
        corridors_geom = []
        
        for corridor in self.corridors:
            # Create buffered line to polygon
            corridor_poly = corridor.line.buffer(
                self.MIN_CORRIDOR_WIDTH / 2,
                cap_style=1,  # Round caps
                join_style=1  # Round joins
            )
            
            if not corridor_poly.is_empty:
                corridors_geom.append(corridor_poly)
        
        return corridors_geom
    
    def to_dict(self) -> Dict:
        """Export circulation network to dictionary."""
        return {
            'primary_path': self.primary_path,
            'corridors': [
                {
                    'id': c.id,
                    'from': c.start_room,
                    'to': c.end_room,
                    'length': c.length,
                    'width': c.width,
                    'coordinates': list(c.line.coords)
                }
                for c in self.corridors
            ],
            'statistics': self.get_circulation_statistics(),
            'room_positions': self.room_positions
        }


# Example usage
if __name__ == '__main__':
    from dataclasses import dataclass
    
    @dataclass
    class MockRoomPlacement:
        name: str
        x: float
        y: float
        width: float
        height: float
    
    print("=== Circulation Graph Example ===\n")
    
    # Create mock room placements
    placements = [
        MockRoomPlacement('Parking', 0, 0, 6, 3),
        MockRoomPlacement('Foyer', 6, 0, 2, 2),
        MockRoomPlacement('Living', 6, 2, 5, 4),
        MockRoomPlacement('Dining', 11, 2, 4, 3),
        MockRoomPlacement('Kitchen', 11, 5, 4, 3),
        MockRoomPlacement('MasterBedroom', 0, 3, 5, 4),
        MockRoomPlacement('Bedroom2', 5, 7, 4, 3),
        MockRoomPlacement('Bathroom', 9, 8, 2, 2),
        MockRoomPlacement('Utility', 15, 5, 2, 2),
    ]
    
    # Generate circulation
    circ = CirculationGraph()
    corridors = circ.generate_circulation(placements)
    
    print(f"Primary path: {circ.primary_path}")
    print(f"\nGenerated corridors:")
    for corridor in corridors:
        print(f"  {corridor.id}: {corridor.start_room} → {corridor.end_room} "
              f"({corridor.length:.1f}m)")
    
    print(f"\nCirculation statistics:")
    stats = circ.get_circulation_statistics()
    for key, value in stats.items():
        print(f"  {key}: {value}")
