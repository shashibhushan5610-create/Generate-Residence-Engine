from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Tuple, Dict, Any, Optional
import math

from setback_rules import PlotParameters, SetbackEngine
from far_rule_engine import FARInput, FARRuleEngine

app = FastAPI(title="Municipal Intelligence Engine — Geometry & FAR API", version="2.0")

# Allow the frontend dashboard to make requests to this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this to your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models for incoming JSON requests
class GeometryExceptionItem(BaseModel):
    type: str
    width: float
    length: float
    area: float
    height: float
    location: Optional[str] = None

class PlotRequest(BaseModel):
    plot_coordinates: List[Tuple[float, float]]
    front_edge_indices: List[int]
    plot_area_sqm: float
    building_height_m: float
    building_type: str
    zone_type: str = "Standard"
    proposed_road_widths_m: Dict[int, float]
    existing_road_widths_m: Optional[Dict[int, float]] = None
    is_corner_plot: bool
    is_old_approved_layout: bool = False
    ground_coverage_sqm: float = 0.0
    
    proposed_elements: Optional[List[GeometryExceptionItem]] = []
    open_space_area: Optional[float] = 0.0
    building_gap: Optional[float] = None

class FARRequest(BaseModel):
    plot_area: float
    net_plot_area: float
    road_width: float
    building_type: str = "residential_plotted"
    zone_type: str = "built_up"
    is_tod_zone: bool = False
    surrendered_area_for_road: float = 0.0
    green_building_rating: str = "none"
    circle_rate: float = 0.0
    proposed_extra_far_area: float = 0.0
    spatial_elements: Optional[List[Dict[str, Any]]] = []

@app.post("/api/v1/generate-envelope")
async def generate_envelope(request: PlotRequest):
    try:
        # 1. Map request data into the engine's dataclass
        params = PlotParameters(
            plot_coordinates=request.plot_coordinates,
            front_edge_indices=request.front_edge_indices,
            plot_area_sqm=request.plot_area_sqm,
            building_height_m=request.building_height_m,
            building_type=request.building_type,
            zone_type=request.zone_type,
            proposed_road_widths_m=request.proposed_road_widths_m,
            existing_road_widths_m=request.existing_road_widths_m,
            is_corner_plot=request.is_corner_plot,
            is_old_approved_layout=request.is_old_approved_layout,
            ground_coverage_sqm=request.ground_coverage_sqm
        )
        
        # 2. Run the Setback Engine constraints
        engine = SetbackEngine(params)
        poly, final_setbacks = engine.generate_buildable_envelope()
        
        # 3. Handle geometric exceptions (Module 5)
        exception_report = None
        if request.proposed_elements:
            exception_report = engine.validate_geometric_exceptions(
                proposed_elements=[item.dict() for item in request.proposed_elements],
                open_space_area=request.open_space_area,
                building_gap=request.building_gap
            )
        
        # 4. Format the response
        response_data = {
            "status": "success",
            "setbacks_applied": {
                "front": final_setbacks.front,
                "rear": final_setbacks.rear,
                "side1": final_setbacks.side1,
                "side2": final_setbacks.side2,
                "rear_construction_allowance": final_setbacks.rear_construction_allowance,
                "rear_buildable_area": final_setbacks.rear_buildable_area
            },
            "buildable_envelope_coords": list(poly.exterior.coords) if poly else []
        }
        
        if exception_report:
            response_data["exception_validation"] = exception_report
            
        return response_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/calculate-far")
async def calculate_far(request: FARRequest):
    """
    FAR Logic Compiler endpoint.
    Computes Base FAR, MFAR, PFAR/PPFAR charges, incentives, and consumed FAR.
    """
    try:
        inp = FARInput(
            plot_area=request.plot_area,
            net_plot_area=request.net_plot_area,
            road_width=request.road_width,
            building_type=request.building_type,
            zone_type=request.zone_type,
            is_tod_zone=request.is_tod_zone,
            surrendered_area_for_road=request.surrendered_area_for_road,
            green_building_rating=request.green_building_rating,
            circle_rate=request.circle_rate,
            proposed_extra_far_area=request.proposed_extra_far_area,
            spatial_elements=request.spatial_elements or [],
        )
        
        engine = FARRuleEngine(inp)
        report = engine.compute()
        
        return {"status": "success", "far_report": report}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    # Make sure this runs on port 8000 by default
    uvicorn.run("api:app", host="127.0.0.1", port=8000, reload=True)
