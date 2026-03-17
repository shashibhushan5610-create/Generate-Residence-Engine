"""
Adjacency Graph Builder

Creates a directed graph of room relationships and proximity constraints.
Uses NetworkX to define which rooms should be adjacent and their relative positions.
"""

import networkx as nx
from typing import Dict, List, Tuple, Optional
from enum import Enum


class AdjacencyType(Enum):
    """Types of adjacency relationships."""
    MANDATORY = "mandatory"      # Rooms must be adjacent
    PREFERRED = "preferred"      # Rooms should be adjacent
    ACCEPTABLE = "acceptable"    # Rooms can be adjacent
    AVOID = "avoid"             # Rooms should not be adjacent


@staticmethod
def get_default_adjacencies() -> Dict[str, List[Tuple[str, AdjacencyType, float]]]:
    """
    Get default adjacency rules for standard room programs.
    
    Returns:
        Dictionary mapping room names to list of (target_room, adjacency_type, distance_weight)
    """
    return {
        # Entry sequence: public -> semi-private -> private
        'Foyer': [
            ('Living', AdjacencyType.MANDATORY, 0.1),
            ('Dining', AdjacencyType.PREFERRED, 0.3),
        ],
        
        'Living': [
            ('Foyer', AdjacencyType.MANDATORY, 0.1),
            ('Dining', AdjacencyType.PREFERRED, 0.2),
        ],
        
        'Dining': [
            ('Living', AdjacencyType.PREFERRED, 0.2),
            ('Kitchen', AdjacencyType.MANDATORY, 0.1),
            ('Foyer', AdjacencyType.ACCEPTABLE, 0.4),
        ],
        
        'Kitchen': [
            ('Dining', AdjacencyType.MANDATORY, 0.1),
            ('Utility', AdjacencyType.PREFERRED, 0.3),
            ('Store', AdjacencyType.ACCEPTABLE, 0.5),
        ],
        
        # Bedroom clusters
        'MasterBedroom': [
            ('Bathroom', AdjacencyType.PREFERRED, 0.2),
            ('Living', AdjacencyType.AVOID, 1.0),
        ],
        
        # Generic bedrooms
        'Bedroom': [
            ('Bathroom', AdjacencyType.PREFERRED, 0.2),
            ('Living', AdjacencyType.AVOID, 1.0),
        ],
        
        # Service rooms
        'Bathroom': [
            ('Bedroom', AdjacencyType.PREFERRED, 0.2),
            ('MasterBedroom', AdjacencyType.PREFERRED, 0.2),
            ('Kitchen', AdjacencyType.ACCEPTABLE, 0.5),
        ],
        
        'Utility': [
            ('Kitchen', AdjacencyType.PREFERRED, 0.3),
            ('Bathroom', AdjacencyType.ACCEPTABLE, 0.4),
            ('Store', AdjacencyType.PREFERRED, 0.2),
        ],
        
        'Store': [
            ('Utility', AdjacencyType.PREFERRED, 0.2),
            ('Foyer', AdjacencyType.ACCEPTABLE, 0.5),
        ],
        
        'Parking': [
            ('Foyer', AdjacencyType.MANDATORY, 0.1),
            ('Living', AdjacencyType.AVOID, 1.0),
        ],
        
        'Stair': [
            ('Foyer', AdjacencyType.MANDATORY, 0.2),
            ('Living', AdjacencyType.ACCEPTABLE, 0.5),
        ],
    }


class AdjacencyGraph:
    """
    Represents room adjacency constraints as a directed weighted graph.
    
    Nodes: Room names
    Edges: Adjacency relationships with weights (lower = stronger attraction)
    """
    
    def __init__(self, room_names: List[str]):
        """
        Initialize adjacency graph for given rooms.
        
        Args:
            room_names: List of room names in the program
        """
        self.room_names = room_names
        self.graph = nx.DiGraph()
        self.graph.add_nodes_from(room_names)
        self._default_adjacencies = get_default_adjacencies()
        self._populate_default_adjacencies()
    
    def _populate_default_adjacencies(self):
        """Populate graph with default adjacency rules for rooms in program."""
        for room_name in self.room_names:
            if room_name in self._default_adjacencies:
                for target_room, adj_type, distance_weight in self._default_adjacencies[room_name]:
                    # Only add edge if target room is in program
                    if target_room in self.room_names:
                        self.graph.add_edge(
                            room_name,
                            target_room,
                            adjacency_type=adj_type.value,
                            distance_weight=distance_weight
                        )
    
    def add_adjacency(
        self,
        room_a: str,
        room_b: str,
        adjacency_type: AdjacencyType,
        distance_weight: float = 0.5
    ):
        """
        Add or update adjacency constraint between two rooms.
        
        Args:
            room_a: Source room name
            room_b: Target room name
            adjacency_type: Type of adjacency
            distance_weight: Weight for distance penalty (0-1, lower = closer)
        """
        if room_a in self.room_names and room_b in self.room_names:
            self.graph.add_edge(
                room_a,
                room_b,
                adjacency_type=adjacency_type.value,
                distance_weight=distance_weight
            )
    
    def get_adjacency_weight(self, room_a: str, room_b: str) -> float:
        """
        Get distance weight between two rooms.
        
        Lower weight = stronger attraction (should be closer).
        Returns 1.0 if no adjacency defined.
        """
        if self.graph.has_edge(room_a, room_b):
            return self.graph[room_a][room_b]['distance_weight']
        return 1.0
    
    def get_adjacency_type(self, room_a: str, room_b: str) -> Optional[str]:
        """Get type of adjacency between two rooms."""
        if self.graph.has_edge(room_a, room_b):
            return self.graph[room_a][room_b]['adjacency_type']
        return None
    
    def get_must_adjacent(self) -> List[Tuple[str, str]]:
        """Get all mandatory adjacency pairs."""
        mandatory = []
        for room_a, room_b in self.graph.edges():
            if self.graph[room_a][room_b]['adjacency_type'] == AdjacencyType.MANDATORY.value:
                mandatory.append((room_a, room_b))
        return mandatory
    
    def get_preferred_adjacent(self) -> List[Tuple[str, str]]:
        """Get all preferred adjacency pairs."""
        preferred = []
        for room_a, room_b in self.graph.edges():
            if self.graph[room_a][room_b]['adjacency_type'] == AdjacencyType.PREFERRED.value:
                preferred.append((room_a, room_b))
        return preferred
    
    def get_avoid_adjacent(self) -> List[Tuple[str, str]]:
        """Get all adjacency pairs that should be avoided."""
        avoid = []
        for room_a, room_b in self.graph.edges():
            if self.graph[room_a][room_b]['adjacency_type'] == AdjacencyType.AVOID.value:
                avoid.append((room_a, room_b))
        return avoid
    
    def get_neighbors(self, room_name: str) -> List[str]:
        """Get all rooms adjacent to given room."""
        return list(self.graph.successors(room_name))
    
    def is_connected(self) -> bool:
        """Check if adjacency graph forms a connected structure."""
        # Create undirected version for connectivity check
        undirected = self.graph.to_undirected()
        return nx.is_connected(undirected)
    
    def get_connected_components(self) -> List[List[str]]:
        """Get connected components of the graph."""
        undirected = self.graph.to_undirected()
        components = list(nx.connected_components(undirected))
        return [list(comp) for comp in components]
    
    def get_dependency_order(self) -> Optional[List[str]]:
        """
        Get topological order of rooms for layout sequencing.
        Useful for placing rooms in dependency order.
        
        Returns None if graph has cycles.
        """
        try:
            return list(nx.topological_sort(self.graph))
        except nx.NetworkXError:
            return None
    
    def get_shortest_path(self, room_a: str, room_b: str) -> Optional[List[str]]:
        """
        Get shortest path between two rooms in adjacency graph.
        """
        try:
            return nx.shortest_path(self.graph.to_undirected(), room_a, room_b)
        except nx.NetworkXNoPath:
            return None
    
    def calculate_adjacency_score(
        self,
        room_distances: Dict[Tuple[str, str], float]
    ) -> float:
        """
        Calculate adjacency satisfaction score (0-1) for given room distances.
        
        Args:
            room_distances: Dictionary mapping (room_a, room_b) to distance in meters
            
        Returns:
            Score where 1.0 = perfect adjacency satisfaction
        """
        if not self.graph.edges():
            return 1.0
        
        total_penalty = 0.0
        edge_count = 0
        
        for room_a, room_b in self.graph.edges():
            if (room_a, room_b) in room_distances:
                distance = room_distances[(room_a, room_b)]
                weight = self.graph[room_a][room_b]['distance_weight']
                adj_type = self.graph[room_a][room_b]['adjacency_type']
                
                # Penalty scales with distance and weight
                # Mandatory adjacencies have high penalty for distance
                if adj_type == AdjacencyType.MANDATORY.value:
                    penalty = min(1.0, (distance / 10.0) * weight)
                elif adj_type == AdjacencyType.PREFERRED.value:
                    penalty = min(0.7, (distance / 15.0) * weight)
                elif adj_type == AdjacencyType.AVOID.value:
                    # Negative penalty (reward for distance)
                    penalty = -min(0.3, (distance / 20.0) * weight)
                else:
                    penalty = min(0.5, (distance / 20.0) * weight)
                
                total_penalty += penalty
                edge_count += 1
        
        if edge_count == 0:
            return 1.0
        
        avg_penalty = total_penalty / edge_count
        return max(0.0, 1.0 - avg_penalty)
    
    def to_dict(self) -> Dict:
        """Export graph structure to dictionary format."""
        return {
            'nodes': self.room_names,
            'edges': [
                {
                    'source': u,
                    'target': v,
                    'adjacency_type': self.graph[u][v]['adjacency_type'],
                    'distance_weight': self.graph[u][v]['distance_weight']
                }
                for u, v in self.graph.edges()
            ]
        }


# Example usage
if __name__ == '__main__':
    # Example with typical residential program
    rooms = [
        'Foyer', 'Living', 'Dining', 'Kitchen',
        'MasterBedroom', 'Bedroom2',
        'Bathroom', 'Utility', 'Parking'
    ]
    
    print("=== Adjacency Graph Example ===\n")
    
    graph = AdjacencyGraph(rooms)
    
    print("Mandatory adjacencies:")
    for room_a, room_b in graph.get_must_adjacent():
        print(f"  {room_a} -> {room_b}")
    
    print("\nPreferred adjacencies:")
    for room_a, room_b in graph.get_preferred_adjacent():
        print(f"  {room_a} -> {room_b}")
    
    print("\nAvoid adjacencies:")
    for room_a, room_b in graph.get_avoid_adjacent():
        print(f"  {room_a} -> {room_b}")
    
    print(f"\nGraph connectivity: {graph.is_connected()}")
    print(f"Connected components: {graph.get_connected_components()}")
    
    print("\nNeighbors of 'Living':")
    print(f"  {graph.get_neighbors('Living')}")
    
    # Test adjacency scoring
    print("\nAdjacency scoring example:")
    room_distances = {
        ('Foyer', 'Living'): 2.0,  # Close (good)
        ('Living', 'Dining'): 1.5,  # Very close (good)
        ('Dining', 'Kitchen'): 1.0,  # Adjacent (excellent)
        ('Living', 'MasterBedroom'): 12.0,  # Far (good for avoid)
    }
    score = graph.calculate_adjacency_score(room_distances)
    print(f"  Adjacency satisfaction: {score:.2%}")
