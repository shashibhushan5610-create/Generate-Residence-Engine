from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from typing import List, Tuple, Dict, Any, Optional
import math
import os
import sys
import webbrowser

from setback_rules import PlotParameters, SetbackEngine
from far_rule_engine import FARInput, FARRuleEngine
from layout_solver import GeometryLayoutSolver
from layout_schemas import AdvancedLayoutRequest
from advanced_layout_service import layout_service
from zoning_solver import ZoningSolver, RoadDirection

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


class LayoutRequest(BaseModel):
    plot: Dict[str, Any]
    setbacks: Dict[str, Any]
    rooms: List[str]
    road_facing: Optional[List[str]] = ["front"]
    ruleset: str = "residential_zoning_rules.json"

@app.post("/api/v1/generate-layout")
async def generate_layout(request: LayoutRequest):
    """
    Geometry Layout Solver endpoint.
    Calculates buildable area from setbacks and invokes the subdivision solver.
    """
    try:
        plot_w = float(request.plot.get('width', 10.0))
        plot_d = float(request.plot.get('depth', 20.0))
        plot_area = float(request.plot.get('area', plot_w * plot_d))
        
        sb = request.setbacks
        side1 = float(sb.get('side1', 0.0) or sb.get('left', 0.0) or 0.0)
        side2 = float(sb.get('side2', 0.0) or sb.get('right', 0.0) or 0.0)
        front = float(sb.get('front', 0.0))
        rear = float(sb.get('rear', 0.0))

        buildable_w = max(2.0, plot_w - side1 - side2)
        buildable_d = max(2.0, plot_d - front - rear)

        # Pass setbacks as offsets to ensure rooms are drawn inside the buildable envelope
        solver = GeometryLayoutSolver(
            buildable_w, 
            buildable_d, 
            request.rooms, 
            offset_x=side1, 
            offset_y=front,
            road_facing=request.road_facing,
            plot_width=plot_w,
            plot_area=plot_area
        )
        layout_data = solver.solve()

        return layout_data
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Error in generate_layout: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/generate-layout-advanced")
async def generate_layout_advanced(request: AdvancedLayoutRequest):
    """
    Advanced Constraint-Based Layout Solver endpoint.
    Uses OR-Tools and rule-based zoning for realistic residential layouts.
    """
    try:
        # Convert Pydantic model to dict for service
        plot_data = request.dict()
        
        # Invoke advanced layout service
        variants = layout_service.generate_advanced_layout(plot_data)
        
        return {
            "status": "success",
            "variants": variants
        }
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Error in generate_layout_advanced: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Zoning Solver Endpoint ──────────────────────────────────────────────────

class ZonesRequest(BaseModel):
    buildable_vertices:       List[Tuple[float, float]]
    road_direction:           str           = "South"
    secondary_road_direction: Optional[str] = None   # For corner plots
    rooms:                    Optional[List[str]] = None


@app.post("/api/v1/generate-zones")
async def generate_zones(request: ZonesRequest):
    """
    ZoningSolver v2 endpoint.
    Divides the buildable polygon into functional zones aligned with the
    LayoutEngine pipeline (PUBLIC→front, SEMI_PRIVATE→middle, PRIVATE→rear, SERVICE→strip).
    Supports corner plots via secondary_road_direction.
    """
    try:
        from shapely.geometry import Polygon
        poly = Polygon(request.buildable_vertices)
        if not poly.is_valid or poly.area < 2.0:
            raise ValueError("Invalid or too-small buildable polygon.")

        dir_map = {
            "north": RoadDirection.NORTH, "south": RoadDirection.SOUTH,
            "east":  RoadDirection.EAST,  "west":  RoadDirection.WEST,
        }
        road_dir = dir_map.get(request.road_direction.lower(), RoadDirection.SOUTH)
        sec_dir  = dir_map.get((request.secondary_road_direction or "").lower())

        rooms = request.rooms or [
            "Parking", "Foyer", "Living", "Dining", "Kitchen",
            "MasterBedroom", "Bedroom2", "MasterBath", "Bathroom2", "Utility"
        ]

        solver = ZoningSolver()
        solver.solve_zones(poly, road_dir, rooms, secondary_road_direction=sec_dir)
        return {"status": "success", **solver.to_dict()}

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ─── Static File Serving ──────────────────────────────────────────────────────

# Mount current directory to serve HTML/JS/CSS at the root
if getattr(sys, 'frozen', False):
    # PyInstaller extracts to a temp folder (sys._MEIPASS)
    frontend_dir = sys._MEIPASS
else:
    frontend_dir = os.path.dirname(os.path.abspath(__file__))

# We mount this last so it doesn't intercept the /api routes
app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="static")


if __name__ == "__main__":
    import uvicorn
    import socket
    
    def is_port_in_use(port):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            return s.connect_ex(('localhost', port)) == 0

    # Diagnostics log
    log_path = os.path.join(os.getcwd(), "debug_log.txt")
    
    try:
        with open(log_path, "w") as f:
            f.write("Starting ArchitectOS Dashboard...\n")
            
        # Check if running as a bundled executable
        is_frozen = getattr(sys, 'frozen', False)
        
        # Check port
        target_port = 8000
        if is_port_in_use(target_port):
            print(f"WARNING: Port {target_port} is already in use!")
            with open(log_path, "a") as f:
                f.write(f"ERROR: Port {target_port} is already in use.\n")
            # Try 8001 as fallback
            target_port = 8001
            
        # Automatically open the browser to the dashboard
        url = f"http://127.0.0.1:{target_port}"
        if not is_frozen and not os.environ.get("UVICORN_RELOAD"):
            webbrowser.open(url)
        elif is_frozen:
            webbrowser.open(url)
            
        print("\n" + "="*60)
        print("ArchitectOS Plot Configuration Dashboard")
        print(f"Server running at: {url}")
        print("="*60 + "\n")
        
        with open(log_path, "a") as f:
            f.write(f"Server starting on {url}... is_frozen={is_frozen}\n")
        
        # Run the server. Pass the app object directly.
        uvicorn.run(app, host="127.0.0.1", port=target_port, log_level="info")
        
    except Exception as e:
        import traceback
        error_msg = traceback.format_exc()
        print(f"CRITICAL ERROR DURING STARTUP:\n{error_msg}")
        with open(log_path, "a") as f:
            f.write(f"CRITICAL ERROR:\n{error_msg}\n")
        input("Press Enter to close...") # Keep console open for user to read error
