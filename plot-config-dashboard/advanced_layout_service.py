"""
Advanced Layout Service

Wrapper service that connects the Antigravity platform with the 
advanced constraint-based layout engine.
"""

from typing import Dict, List, Optional
import json
from shapely.geometry import Polygon, box

from layout_engine import LayoutEngine, LayoutOutput
from zoning_solver import RoadDirection


class AdvancedLayoutService:
    """
    Service layer for handling advanced layout requests.
    
    Responsibilities:
    - Translate API requests to LayoutEngine inputs
    - Orchestrate the layout generation process
    - Format output for frontend consumption
    """
    
    def __init__(self):
        self.engine = LayoutEngine()
    
    def generate_advanced_layout(
        self,
        plot_data: Dict
    ) -> List[Dict]:
        """
        Main entry point for advanced layout generation.
        
        Args:
            plot_data: Dictionary containing plot geometry and requirements
            
        Returns:
            List of generated layout variants as dictionaries
        """
        # 1. Parse Input
        plot_vertices = plot_data.get('vertices', [])
        if not plot_vertices:
            raise ValueError("No plot vertices provided")
            
        # Create Polygon from vertices
        plot_polygon = Polygon([(v['x'], v['y']) for v in plot_vertices])
        
        # Extract road info
        road_direction_str = plot_data.get('road_direction', 'South')
        road_direction = self._parse_road_direction(road_direction_str)
        
        # Extract requirements
        num_bedrooms = plot_data.get('num_bedrooms', 2)
        include_parking = plot_data.get('include_parking', True)
        
        # Extract setbacks
        setbacks = plot_data.get('setbacks', {})
        front_sb = setbacks.get('front', 1.5)
        rear_sb = setbacks.get('rear', 2.0)
        side_sb = setbacks.get('side', 1.5)
        
        # 2. Execute Layout Engine
        try:
            layout_outputs = self.engine.generate_layout(
                plot_polygon=plot_polygon,
                road_direction=road_direction,
                num_bedrooms=num_bedrooms,
                include_parking=include_parking,
                setback_front=front_sb,
                setback_rear=rear_sb,
                setback_sides=side_sb,
                variant_count=3
            )
            
            # 3. Format Response
            return [l.to_dict() for l in layout_outputs]
            
        except Exception as e:
            # Log error and re-raise or return error info
            print(f"Layout generation failed: {e}")
            raise RuntimeError(f"Advanced layout generation failed: {str(e)}")
            
    def _parse_road_direction(self, direction_str: str) -> RoadDirection:
        """Map string direction to RoadDirection enum."""
        mapping = {
            'North': RoadDirection.NORTH,
            'South': RoadDirection.SOUTH,
            'East': RoadDirection.EAST,
            'West': RoadDirection.WEST
        }
        return mapping.get(direction_str, RoadDirection.SOUTH)


# Singleton instance
layout_service = AdvancedLayoutService()
