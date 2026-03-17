"""
Layout API Schemas

Pydantic models for the advanced layout generation API.
"""

from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any


class Vertex(BaseModel):
    """X, Y coordinate pair."""
    x: float
    y: float


class Setbacks(BaseModel):
    """Setback distances in meters."""
    front: float = 1.5
    rear: float = 2.0
    side: float = 1.5


class AdvancedLayoutRequest(BaseModel):
    """Request schema for advanced layout generation."""
    vertices: List[Vertex] = Field(..., description="Plot boundary vertices")
    road_direction: str = Field("South", description="Road frontage (North, South, East, West)")
    num_bedrooms: int = Field(2, ge=1, le=5, description="Target number of bedrooms")
    include_parking: bool = Field(True, description="Whether to include a car porch")
    setbacks: Setbacks = Field(default_factory=Setbacks)
    plot_area: Optional[float] = None


class RoomPlacementSchema(BaseModel):
    """Geometric placement of a room."""
    name: str
    x: float
    y: float
    width: float
    height: float
    area: float
    zone_type: Optional[str]


class CorridorSchema(BaseModel):
    """Geometric definition of a corridor."""
    id: str
    from_room: str = Field(..., alias="from")
    to_room: str = Field(..., alias="to")
    length: float
    width: float
    coordinates: List[List[float]]


class AdvancedLayoutResponse(BaseModel):
    """Response schema for a single layout variant."""
    rooms: List[RoomPlacementSchema]
    corridors: List[CorridorSchema]
    zones: List[Dict[str, Any]]
    circulation_stats: Dict[str, Any]
    metrics: Dict[str, Any]
    variant_rank: int
    variant_count: int


class MultiLayoutResponse(BaseModel):
    """Wrapper for multiple layout variants."""
    status: str = "success"
    variants: List[AdvancedLayoutResponse]
