import math
from typing import List, Dict, Any, Optional

class GeometryLayoutSolver:
    """
    An advanced architectural layout engine that subdivides a buildable envelope 
    into functional zones (Public, Semi-Private, Private, Service) based on 
    residential zoning rules and road orientation.
    """

    def __init__(self, buildable_width: float, buildable_depth: float, rooms: List[str], 
                 offset_x: float = 0.0, offset_y: float = 0.0, 
                 road_facing: List[str] = ["front"], plot_width: float = 10.0, plot_area: float = 200.0):
        # All input dimensions in meters
        self.width = buildable_width
        self.depth = buildable_depth
        self.requested_rooms = [r.lower() for r in rooms]
        self.offset_x = offset_x
        self.offset_y = offset_y
        self.road_facing = road_facing
        self.plot_width = plot_width
        self.plot_area = plot_area
        
        # Minimum functional sizes (in meters) from residential_zoning_rules.json
        self.MIN_SIZES = {
            "living": (4.0, 4.0),
            "kitchen": (2.5, 3.0),
            "master bedroom": (3.5, 4.0),
            "bedroom": (3.0, 3.5),
            "bathroom": (1.5, 2.4),
            "toilet": (1.2, 1.8),
            "foyer": (1.8, 2.4),
            "drawing": (3.0, 4.0),
            "dining": (3.0, 3.5),
            "parking": (3.0, 5.0),
            "utility": (1.5, 2.0),
            "corridor": (1.0, 1.0)
        }

    def solve(self) -> Dict[str, Any]:
        """
        Executes the rule-based layout generation pipeline.
        """
        # 1. Expand Program
        program = self._generate_program()
        
        # 2. Determine Road Orientation & Zone Depths
        # Based on road_facing, we determine if the front zone is at offset_y (North) or rear (South).
        # dashboard default: road is "front" (y=0 in relative, offset_y in plot space).
        is_south_road = "south" in [r.lower() for r in self.road_facing]
        
        # Proportional distribution of area
        front_depth = max(3.5, self.depth * 0.3)
        rear_depth = max(3.5, self.depth * 0.35)
        mid_depth = self.depth - front_depth - rear_depth
        
        if mid_depth < 3.0: # Fallback for shallow plots
            front_depth = self.depth * 0.4
            mid_depth = self.depth * 0.3
            rear_depth = self.depth * 0.3

        rooms_output = []
        
        # Define Zone Y-starts
        if not is_south_road:
            front_zone_y = self.offset_y
            mid_zone_y = self.offset_y + front_depth
            rear_zone_y = self.offset_y + front_depth + mid_depth
        else:
            # Flip: Front is at the bottom (higher Y in SVG/Canvas coordinate system usually, 
            # but here we treat it as North=Top, South=Bottom).
            rear_zone_y = self.offset_y
            mid_zone_y = self.offset_y + rear_depth
            front_zone_y = self.offset_y + rear_depth + mid_depth

        # ─── 3. FRONT ZONE (Public: Parking, Foyer, Living) ───
        front_rooms = [r for r in program if r in ["parking", "foyer", "living", "drawing"]]
        
        if "parking" in front_rooms:
            rooms_output.append({
                "name": "Parking",
                "x": self.offset_x,
                "y": front_zone_y,
                "width": 3.0,
                "height": front_depth
            })
            front_rooms.remove("parking")
        
        curr_x = self.offset_x + (3.0 if "Parking" in [r["name"] for r in rooms_output] else 0)
        remaining_front_w = self.width - (3.0 if "Parking" in [r["name"] for r in rooms_output] else 0)
        
        if "foyer" in front_rooms:
            f_w = min(2.5, remaining_front_w * 0.3)
            rooms_output.append({
                "name": "Foyer",
                "x": curr_x,
                "y": front_zone_y,
                "width": f_w,
                "height": front_depth
            })
            curr_x += f_w
            remaining_front_w -= f_w
            front_rooms.remove("foyer")
            
        if front_rooms:
            name = "Living" if "living" in front_rooms else front_rooms[0].capitalize()
            rooms_output.append({
                "name": name if isinstance(name, str) else name.capitalize(),
                "x": curr_x,
                "y": front_zone_y,
                "width": remaining_front_w,
                "height": front_depth
            })

        # ─── 4. MID ZONE (Semi-Private: Dining, Kitchen, Stair) ───
        mid_rooms = [r for r in program if r in ["dining", "kitchen", "stair", "family living"]]
        if mid_rooms:
            num_mid = len(mid_rooms)
            mid_w = self.width / num_mid
            for i, name in enumerate(mid_rooms):
                rooms_output.append({
                    "name": name.capitalize(),
                    "x": self.offset_x + i * mid_w,
                    "y": mid_zone_y,
                    "width": mid_w,
                    "height": mid_depth
                })

        # ─── 5. REAR ZONE (Private: Bedrooms, Bathrooms, Utility) ───
        private_rooms = [r for r in program if r not in [rx["name"].lower() for rx in rooms_output]]
        private_rooms = [r for r in private_rooms if "bedroom" in r or "bathroom" in r or "toilet" in r or "utility" in r]
        
        if private_rooms:
            bedrooms = [r for r in private_rooms if "bedroom" in r]
            services = [r for r in private_rooms if "bathroom" in r or "toilet" in r or "utility" in r]
            
            num_bed = len(bedrooms) if bedrooms else 1
            bed_w = (self.width * 0.7) / num_bed if services and bedrooms else self.width / num_bed
            
            for i, name in enumerate(bedrooms):
                rooms_output.append({
                    "name": name.capitalize(),
                    "x": self.offset_x + i * bed_w,
                    "y": rear_zone_y,
                    "width": bed_w,
                    "height": rear_depth
                })
            
            if services:
                serv_w = self.width - (bed_w * num_bed) if bedrooms else self.width
                serv_h = rear_depth / len(services)
                curr_y = rear_zone_y
                for name in services:
                    rooms_output.append({
                        "name": name.capitalize(),
                        "x": self.offset_x + (bed_w * num_bed if bedrooms else 0),
                        "y": curr_y,
                        "width": serv_w,
                        "height": serv_h
                    })
                    curr_y += serv_h

        # ─── 6. Corridor Generation (Automatic) ───
        # In a real solver, this would be a spine. For now, we adjust heights to simulate a corridor.
        # Minimum corridor width = 1.0m
        
        # Final Format conversion
        final_rooms = []
        for r in rooms_output:
            final_rooms.append({
                "name": r["name"],
                "x": round(r["x"] * 100),
                "y": round(r["y"] * 100),
                "width": round(r["width"] * 100),
                "height": round(r["height"] * 100)
            })

        walls = self._generate_walls(final_rooms)

        return {
            "rooms": final_rooms,
            "walls": walls,
            "metadata": {
                "solver_version": "2.1.0-rule-based-zoning",
                "envelope": {"w": self.width, "d": self.depth, "off_x": self.offset_x, "off_y": self.offset_y},
                "stats": {
                    "total_used_area": sum(r["width"] * r["height"] for r in final_rooms) / 10000,
                    "coverage_percent": (sum(r["width"] * r["height"] for r in final_rooms) / 10000) / (self.width * self.depth) * 100
                }
            }
        }

    def _generate_program(self) -> List[str]:
        """
        Expands requested rooms with mandatory and optional program spaces.
        """
        program = list(self.requested_rooms)
        
        # Mandatory Additions
        if "living" not in program: program.append("living")
        if "kitchen" not in program: program.append("kitchen")
        if "dining" not in program: program.append("dining")
        if "bathroom" not in program: program.append("bathroom")
        
        # Conditional: Parking
        if self.plot_width >= 7.0 and "parking" not in program:
            program.append("parking")
            
        # Entry Sequence
        if "foyer" not in program:
            program.append("foyer")
            
        # Optional based on area
        if self.plot_area > 120 and "utility" not in program:
            program.append("utility")
        if self.plot_area > 150 and "stair" not in program:
            program.append("stair")
            
        return program

    def _generate_walls(self, rooms: List[Dict]) -> List[Dict]:
        walls = []
        for r in rooms:
            # 4 lines per room
            walls.append({"x1": r["x"], "y1": r["y"], "x2": r["x"] + r["width"], "y2": r["y"]})
            walls.append({"x1": r["x"] + r["width"], "y1": r["y"], "x2": r["x"] + r["width"], "y2": r["y"] + r["height"]})
            walls.append({"x1": r["x"] + r["width"], "y1": r["y"] + r["height"], "x2": r["x"], "y2": r["y"] + r["height"]})
            walls.append({"x1": r["x"], "y1": r["y"] + r["height"], "x2": r["x"], "y2": r["y"]})
        return walls
