"""
Room Program Generator

Dynamically generates a list of rooms and their required areas based on:
- Total plot area
- Plot dimensions
- Number of bedrooms
- Parking requirements
- Zoning rules

Provides scaling logic to fit the program into the buildable area.
"""

from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass, field
from enum import Enum
import math


class RoomZone(Enum):
    """Functional zones for rooms."""
    PUBLIC = "public"          # Foyer, Living, Guest Room
    SEMI_PRIVATE = "semi-private" # Dining, Kitchen
    PRIVATE = "private"       # Bedrooms, Bathrooms
    SERVICE = "service"       # Utility, Store, Parking
    CIRCULATION = "circulation" # Passage, Stairs


@dataclass
class Room:
    """Represents a room requirement in the program."""
    name: str
    min_area: float
    target_area: float
    max_area: float
    min_width: float = 3.0
    min_height: float = 3.0
    zone: RoomZone = RoomZone.PRIVATE
    preferred_aspect_ratio: Tuple[float, float] = (0.8, 1.25)
    priority: int = 1  # 1 (highest) to 5 (lowest)
    
    def to_dict(self) -> Dict:
        """Export to dictionary."""
        return {
            'name': self.name,
            'min_area': self.min_area,
            'target_area': self.target_area,
            'max_area': self.max_area,
            'min_width': self.min_width,
            'min_height': self.min_height,
            'zone': self.zone.value,
            'priority': self.priority
        }


class RoomProgramGenerator:
    """
    Generates architectural room programs based on plot characteristics.
    """
    
    # Area constants (sqm)
    MIN_LIVING_AREA = 16.0
    MIN_MASTER_BEDROOM = 14.0
    MIN_BEDROOM = 11.0
    MIN_KITCHEN = 8.0
    MIN_DINING = 12.0
    MIN_BATHROOM = 4.5
    MIN_PARKING = 15.0  # (3m x 5m)
    
    def __init__(self):
        """Initialize program generator."""
        pass
        
    def generate_program(
        self,
        plot_area: float,
        plot_width: float,
        plot_height: float,
        num_bedrooms: int = 2,
        has_parking: bool = True
    ) -> List[Room]:
        """
        Produce a list of room requirements.
        
        Args:
            plot_area: Total plot area in sqm
            plot_width: Plot width in meters
            plot_height: Plot depth in meters
            num_bedrooms: Target bedroom count
            has_parking: Whether to include car porch
            
        Returns:
            List of Room objects
        """
        program = []
        
        # 1. Core Public Spaces
        program.append(Room(
            name='Foyer',
            min_area=4.0, target_area=6.0, max_area=10.0,
            min_width=1.5, min_height=2.0,
            zone=RoomZone.PUBLIC, priority=2
        ))
        
        living_target = max(self.MIN_LIVING_AREA, plot_area * 0.15)
        program.append(Room(
            name='Living',
            min_area=self.MIN_LIVING_AREA, 
            target_area=living_target,
            max_area=living_target * 1.5,
            min_width=3.6, min_height=4.0,
            zone=RoomZone.PUBLIC, priority=1
        ))
        
        # 2. Semi-Private Spaces
        dining_target = max(self.MIN_DINING, plot_area * 0.1)
        program.append(Room(
            name='Dining',
            min_area=self.MIN_DINING,
            target_area=dining_target,
            max_area=dining_target * 1.3,
            min_width=3.0, min_height=3.6,
            zone=RoomZone.SEMI_PRIVATE, priority=1
        ))
        
        program.append(Room(
            name='Kitchen',
            min_area=self.MIN_KITCHEN,
            target_area=max(self.MIN_KITCHEN, plot_area * 0.08),
            max_area=20.0,
            min_width=2.4, min_height=3.0,
            zone=RoomZone.SEMI_PRIVATE, priority=1
        ))
        
        # 3. Private Spaces (Bedrooms)
        # Master Bedroom
        program.append(Room(
            name='MasterBedroom',
            min_area=self.MIN_MASTER_BEDROOM,
            target_area=max(self.MIN_MASTER_BEDROOM, plot_area * 0.12),
            max_area=30.0,
            min_width=3.6, min_height=3.6,
            zone=RoomZone.PRIVATE, priority=1
        ))
        
        # Additional Bedrooms
        for i in range(2, num_bedrooms + 1):
            program.append(Room(
                name=f'Bedroom{i}',
                min_area=self.MIN_BEDROOM,
                target_area=max(self.MIN_BEDROOM, plot_area * 0.09),
                max_area=18.0,
                min_width=3.0, min_height=3.3,
                zone=RoomZone.PRIVATE, priority=2
            ))
            
        # Bathrooms (Target 1 bath per 1.5 bedrooms)
        num_baths = math.ceil(num_bedrooms / 1.5)
        for i in range(1, num_baths + 1):
            is_master = (i == 1)
            name = 'MasterBath' if is_master else f'Bathroom{i}'
            program.append(Room(
                name=name,
                min_area=self.MIN_BATHROOM,
                target_area=6.0,
                max_area=9.0,
                min_width=1.5, min_height=2.4,
                zone=RoomZone.PRIVATE, priority=2
            ))
            
        # 4. Service Spaces
        if has_parking:
            program.append(Room(
                name='Parking',
                min_area=self.MIN_PARKING,
                target_area=20.0,
                max_area=35.0,
                min_width=3.0, min_height=5.0,
                zone=RoomZone.SERVICE, priority=1
            ))
            
        program.append(Room(
            name='Utility',
            min_area=4.0, target_area=6.0, max_area=10.0,
            min_width=1.5, min_height=2.0,
            zone=RoomZone.SERVICE, priority=3
        ))
        
        return program
    
    def scale_room_areas(
        self,
        program: List[Room],
        buildable_area: float,
        efficiency_factor: float = 0.85
    ) -> List[Room]:
        """
        Scale room target areas to fit within building footprint.
        
        Args:
            program: Initial list of rooms
            buildable_area: Total buildable area in sqm
            efficiency_factor: Ratio of carpet area to built-up area (0.7-0.9)
            
        Returns:
            Program with adjusted target areas
        """
        active_area = buildable_area * efficiency_factor
        current_target_sum = sum(r.target_area for r in program)
        current_min_sum = sum(r.min_area for r in program)
        
        if active_area < current_min_sum:
            # Drop low priority rooms if total min area exceeds buildable
            program = sorted(program, key=lambda x: x.priority)
            reduced_program = []
            running_min = 0.0
            for room in program:
                if running_min + room.min_area <= active_area:
                    reduced_program.append(room)
                    running_min += room.min_area
            program = reduced_program
            active_area = max(active_area, running_min) # Tight fit
            
        # Scale targets
        scale = active_area / sum(r.target_area for r in program)
        
        for room in program:
            # New target should be between min and max
            new_target = room.target_area * scale
            room.target_area = max(room.min_area, min(room.max_area, new_target))
            
        return program

    def get_zone_summary(self, program: List[Room]) -> Dict[str, float]:
        """Calculate area distribution across zones."""
        summary = {}
        for room in program:
            zone_name = room.zone.value
            summary[zone_name] = summary.get(zone_name, 0.0) + room.target_area
        return summary


# Example usage
if __name__ == '__main__':
    gen = RoomProgramGenerator()
    
    # Scenario: 150sqm plot, 3 bedrooms
    print("Example: 150sqm Plot, 3 Bedrooms")
    print("-" * 30)
    
    initial_program = gen.generate_program(150.0, 10.0, 15.0, num_bedrooms=3)
    
    # Assume 120sqm buildable area
    scaled_program = gen.scale_room_areas(initial_program, 120.0)
    
    total_area = 0.0
    for room in scaled_program:
        print(f"{room.name:15} | Zone: {room.zone.value:12} | Area: {room.target_area:5.1f} sqm")
        total_area += room.target_area
        
    print("-" * 30)
    print(f"Total Carpet Area: {total_area:.1f} sqm")
    
    zones = gen.get_zone_summary(scaled_program)
    print("\nZone Distribution:")
    for zone, area in zones.items():
        print(f"  {zone:12}: {area:5.1f} sqm ({area/total_area:>4.1%})")
