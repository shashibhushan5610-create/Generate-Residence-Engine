"""
Room Program Generator

Dynamically generates room requirements based on plot size and characteristics.
Returns structured room objects with dimensional and zoning constraints.
"""

from dataclasses import dataclass, asdict
from typing import List, Dict, Tuple
from enum import Enum


class RoomZone(Enum):
    """Room zoning classifications for layout logic."""
    PUBLIC = "public"          # Living, dining, foyer
    SEMI_PRIVATE = "semi_private"  # Kitchen
    PRIVATE = "private"        # Bedrooms
    SERVICE = "service"        # Bathrooms, utility, storage
    PARKING = "parking"        # Parking area


@dataclass
class Room:
    """Represents a room with dimensional and zoning constraints."""
    name: str
    min_area: float
    max_area: float = None
    preferred_aspect_ratio: Tuple[float, float] = None  # (min, max)
    min_width: float = 2.5
    min_height: float = 2.5
    zone: RoomZone = None
    mandatory: bool = True
    description: str = ""
    
    def __post_init__(self):
        if self.max_area is None:
            self.max_area = self.min_area * 2.0
        if self.preferred_aspect_ratio is None:
            self.preferred_aspect_ratio = (0.8, 1.5)
    
    def to_dict(self) -> Dict:
        """Convert room to dictionary, converting enums to strings."""
        data = asdict(self)
        data['zone'] = self.zone.value if self.zone else None
        data['preferred_aspect_ratio'] = list(self.preferred_aspect_ratio)
        return data


class RoomProgramGenerator:
    """
    Generates dynamic room programs based on plot characteristics.
    
    The program adapts room count, sizes, and organization based on:
    - Plot area
    - Plot width (affects parking availability)
    - Aspect ratio
    """
    
    # Base room specifications
    BASE_ROOMS = {
        'Living': Room(
            name='Living',
            min_area=20.0,
            max_area=45.0,
            preferred_aspect_ratio=(0.9, 1.4),
            zone=RoomZone.PUBLIC,
            description='Main living space'
        ),
        'Dining': Room(
            name='Dining',
            min_area=12.0,
            max_area=25.0,
            preferred_aspect_ratio=(1.0, 1.5),
            zone=RoomZone.SEMI_PRIVATE,
            description='Dining area'
        ),
        'Kitchen': Room(
            name='Kitchen',
            min_area=10.0,
            max_area=20.0,
            preferred_aspect_ratio=(0.8, 1.3),
            zone=RoomZone.SEMI_PRIVATE,
            description='Kitchen'
        ),
        'Foyer': Room(
            name='Foyer',
            min_area=4.0,
            max_area=8.0,
            preferred_aspect_ratio=(0.8, 1.2),
            zone=RoomZone.PUBLIC,
            description='Entry vestibule'
        ),
        'MasterBedroom': Room(
            name='MasterBedroom',
            min_area=15.0,
            max_area=30.0,
            preferred_aspect_ratio=(1.0, 1.6),
            zone=RoomZone.PRIVATE,
            description='Master bedroom'
        ),
        'Bedroom': Room(
            name='Bedroom',
            min_area=10.0,
            max_area=20.0,
            preferred_aspect_ratio=(0.9, 1.5),
            zone=RoomZone.PRIVATE,
            description='Secondary bedroom'
        ),
        'Bathroom': Room(
            name='Bathroom',
            min_area=4.5,
            max_area=9.0,
            preferred_aspect_ratio=(0.8, 1.2),
            zone=RoomZone.SERVICE,
            description='Bathroom'
        ),
        'Parking': Room(
            name='Parking',
            min_area=12.0,
            max_area=18.0,
            preferred_aspect_ratio=(1.5, 3.0),
            min_width=2.5,
            min_height=5.0,
            zone=RoomZone.PARKING,
            mandatory=False,
            description='Parking space'
        ),
        'Utility': Room(
            name='Utility',
            min_area=4.0,
            max_area=8.0,
            preferred_aspect_ratio=(0.8, 1.2),
            zone=RoomZone.SERVICE,
            mandatory=False,
            description='Utility/laundry room'
        ),
        'Store': Room(
            name='Store',
            min_area=3.0,
            max_area=6.0,
            preferred_aspect_ratio=(0.7, 1.2),
            zone=RoomZone.SERVICE,
            mandatory=False,
            description='Storage closet'
        ),
        'Stair': Room(
            name='Stair',
            min_area=3.5,
            max_area=6.0,
            preferred_aspect_ratio=(1.0, 1.3),
            zone=RoomZone.PUBLIC,
            mandatory=False,
            description='Staircase'
        ),
    }
    
    def generate_program(
        self,
        plot_area: float,
        plot_width: float,
        plot_height: float,
        num_bedrooms: int = 2,
        has_parking: bool = True
    ) -> List[Room]:
        """
        Generate room program dynamically based on plot characteristics.
        
        Args:
            plot_area: Total plot area in sqm
            plot_width: Width of plot in meters
            plot_height: Height of plot in meters
            num_bedrooms: Number of bedrooms to include
            has_parking: Whether to include parking
            
        Returns:
            List of Room objects for this program
        """
        program = []
        
        # Always include mandatory public/semi-private rooms
        program.append(self.BASE_ROOMS['Foyer'])
        program.append(self.BASE_ROOMS['Living'])
        program.append(self.BASE_ROOMS['Dining'])
        program.append(self.BASE_ROOMS['Kitchen'])
        
        # Add master bedroom
        program.append(self.BASE_ROOMS['MasterBedroom'])
        
        # Add secondary bedrooms based on count
        for i in range(num_bedrooms - 1):
            bedroom = Room(
                name=f'Bedroom{i+2}',
                min_area=10.0,
                max_area=20.0,
                preferred_aspect_ratio=(0.9, 1.5),
                zone=RoomZone.PRIVATE,
                description=f'Secondary bedroom {i+2}'
            )
            program.append(bedroom)
        
        # Bathrooms scale with bedrooms (1 per 2 bedrooms)
        num_bathrooms = max(1, (num_bedrooms // 2) + 1)
        for i in range(num_bathrooms):
            bathroom = Room(
                name=f'Bathroom{i+1}' if i > 0 else 'Bathroom',
                min_area=4.5,
                max_area=9.0,
                preferred_aspect_ratio=(0.8, 1.2),
                zone=RoomZone.SERVICE,
                description=f'Bathroom {i+1}'
            )
            program.append(bathroom)
        
        # Conditional rooms based on plot size and dimensions
        
        # Parking: requires minimum plot width and area
        if has_parking and plot_width >= 6.5:
            program.append(self.BASE_ROOMS['Parking'])
        
        # Utility room for larger plots
        if plot_area > 120.0:
            program.append(self.BASE_ROOMS['Utility'])
        
        # Storage for larger plots
        if plot_area > 150.0:
            program.append(self.BASE_ROOMS['Store'])
        
        # Stair for multi-story layouts (placeholder for future)
        if plot_area > 180.0:
            program.append(self.BASE_ROOMS['Stair'])
        
        return program
    
    def scale_room_areas(
        self,
        program: List[Room],
        buildable_area: float
    ) -> List[Room]:
        """
        Scale room areas to fit buildable area while maintaining proportions.
        
        Args:
            program: List of rooms to scale
            buildable_area: Available area for construction
            
        Returns:
            Updated program with scaled areas
        """
        total_min_area = sum(r.min_area for r in program)
        
        if total_min_area == 0 or buildable_area == 0:
            return program
        
        # Target 75-85% area utilization
        target_utilization = min(0.85, buildable_area * 0.8 / total_min_area)
        
        scaled_program = []
        for room in program:
            scaled_room = Room(
                name=room.name,
                min_area=room.min_area * target_utilization,
                max_area=room.max_area * target_utilization,
                preferred_aspect_ratio=room.preferred_aspect_ratio,
                min_width=room.min_width,
                min_height=room.min_height,
                zone=room.zone,
                mandatory=room.mandatory,
                description=room.description
            )
            scaled_program.append(scaled_room)
        
        return scaled_program
    
    def get_program_summary(self, program: List[Room]) -> Dict:
        """Get summary statistics of room program."""
        total_area = sum(r.min_area for r in program)
        public_rooms = [r for r in program if r.zone == RoomZone.PUBLIC]
        private_rooms = [r for r in program if r.zone == RoomZone.PRIVATE]
        service_rooms = [r for r in program if r.zone == RoomZone.SERVICE]
        
        return {
            'total_rooms': len(program),
            'total_area': total_area,
            'public_rooms': len(public_rooms),
            'private_rooms': len(private_rooms),
            'service_rooms': len(service_rooms),
            'room_list': [r.name for r in program]
        }


# Example usage
if __name__ == '__main__':
    gen = RoomProgramGenerator()
    
    # Example 1: Small plot (80 sqm)
    print("=== Small Plot (80 sqm) ===")
    program_small = gen.generate_program(
        plot_area=80.0,
        plot_width=8.0,
        plot_height=10.0,
        num_bedrooms=2,
        has_parking=False
    )
    print(f"Rooms: {[r.name for r in program_small]}")
    print(f"Summary: {gen.get_program_summary(program_small)}\n")
    
    # Example 2: Medium plot (200 sqm)
    print("=== Medium Plot (200 sqm) ===")
    program_med = gen.generate_program(
        plot_area=200.0,
        plot_width=12.0,
        plot_height=16.7,
        num_bedrooms=3,
        has_parking=True
    )
    print(f"Rooms: {[r.name for r in program_med]}")
    print(f"Summary: {gen.get_program_summary(program_med)}\n")
    
    # Example 3: Large plot (350 sqm)
    print("=== Large Plot (350 sqm) ===")
    program_large = gen.generate_program(
        plot_area=350.0,
        plot_width=20.0,
        plot_height=17.5,
        num_bedrooms=4,
        has_parking=True
    )
    print(f"Rooms: {[r.name for r in program_large]}")
    print(f"Summary: {gen.get_program_summary(program_large)}\n")
    
    # Example 4: Scaled program
    print("=== Scaled Program (200 sqm with 150 sqm available) ===")
    scaled = gen.scale_room_areas(program_med, buildable_area=150.0)
    print(f"Original total: {sum(r.min_area for r in program_med):.1f} sqm")
    print(f"Scaled total: {sum(r.min_area for r in scaled):.1f} sqm")
