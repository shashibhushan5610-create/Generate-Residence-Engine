import math
from dataclasses import dataclass
from typing import List, Tuple, Dict, Any

try:
    from shapely.geometry import Polygon, LineString
except ImportError:
    print("Warning: Shapely library not found. Geometric insets will not work. Install with: pip install shapely")
    Polygon = None


@dataclass
class PlotParameters:
    plot_coordinates: List[Tuple[float, float]]  # CCW ordered vertices
    front_edge_indices: List[int]  # Indices of edges abutting roads
    plot_area_sqm: float
    building_height_m: float
    building_type: str  # "Residential Plotted", "Group Housing", "Commercial", "Industrial"
    zone_type: str  # e.g., "Bazaar Street", "Standard"
    proposed_road_widths_m: Dict[int, float]  # Edge index -> Road Width
    is_corner_plot: bool
    is_old_approved_layout: bool = False
    ground_coverage_sqm: float = 0.0
    existing_road_widths_m: Dict[int, float] = None


@dataclass
class SetbackValues:
    front: float = 0.0
    rear: float = 0.0
    side1: float = 0.0  # Side abutting secondary road on corner plots
    side2: float = 0.0
    rear_construction_allowance: bool = False  # 40% rear setback area usable
    rear_buildable_area: float = 0.0  # Actual sqm allowed in rear setback


class SetbackEngine:

    def __init__(self, params: PlotParameters):
        self.params = params

    def _calculate_base_setbacks(self) -> SetbackValues:
        """MODULE 2: TYPOLOGY & AREA-BASED SETBACKS (Buildings <=15m)"""
        s = SetbackValues()
        p = self.params
        area = p.plot_area_sqm
        typology = p.building_type

        if typology == "Residential Plotted":
            if area < 150:
                s.front, s.rear, s.side1, s.side2 = 1.0, 0.0, 0.0, 0.0
            elif 150 <= area < 300:
                s.front, s.rear, s.side1, s.side2 = 3.0, 1.5, 0.0, 0.0
            elif 300 <= area < 500:
                s.front, s.rear, s.side1, s.side2 = 3.0, 3.0, 0.0, 0.0
            elif 500 <= area < 1200: # Semi-Detached
                s.front, s.rear, s.side1, s.side2 = 4.5, 4.5, 1.5, 0.0
                # UP 2025: Allow 40% of rear setback area for construction
                # (except on stilt floors)
                s.rear_construction_allowance = True
            else: # Detached >= 1200
                s.front, s.rear, s.side1, s.side2 = 6.0, 6.0, 1.5, 1.5

        elif typology == "Group Housing":
            s.front, s.rear, s.side1, s.side2 = 5.0, 5.0, 5.0, 5.0

        elif typology == "Commercial":
            if area < 100:
                s.front, s.rear, s.side1, s.side2 = 1.5, 0.0, 0.0, 0.0
            elif 100 <= area < 300:
                s.front, s.rear, s.side1, s.side2 = 3.0, 0.0, 0.0, 0.0
            elif 300 <= area < 1000:
                s.front, s.rear, s.side1, s.side2 = 4.5, 3.0, 1.5, 1.5
            elif 1000 <= area < 3000:
                s.front, s.rear, s.side1, s.side2 = 6.0, 3.0, 3.0, 3.0
            else:
                s.front, s.rear, s.side1, s.side2 = 12.0, 6.0, 6.0, 6.0
                
            # Exemption for ground coverage
            if p.ground_coverage_sqm <= 500 and not p.is_corner_plot:
                # Assuming light/ventilation checks pass (handled externally)
                s.rear, s.side1, s.side2 = 0.0, 0.0, 0.0

        elif typology == "Industrial":
            if area < 150:
                s.front, s.rear, s.side1, s.side2 = 2.0, 0.0, 0.0, 0.0
            elif 150 <= area < 300:
                s.front, s.rear, s.side1, s.side2 = 2.0, 1.0, 0.0, 0.0
            elif 300 <= area < 500:
                s.front, s.rear, s.side1, s.side2 = 3.0, 2.0, 0.0, 0.0
            elif 500 <= area < 1000:
                s.front, s.rear, s.side1, s.side2 = 3.0, 2.5, 1.5, 0.0
            elif 1000 <= area < 2000:
                s.front, s.rear, s.side1, s.side2 = 4.5, 3.0, 3.0, 0.0
            elif 2000 <= area < 6000:
                s.front, s.rear, s.side1, s.side2 = 6.0, 4.5, 4.5, 4.5
            else:
                s.front, s.rear, s.side1, s.side2 = 7.5, 6.0, 4.5, 4.5

        return s

    def _apply_corner_interrupt(self, s: SetbackValues) -> SetbackValues:
        """MODULE 4: CORNER PLOT LOGIC INTERRUPT"""
        p = self.params
        if not p.is_corner_plot:
            return s

        # Action: Force secondary road side setback to equal Front_Setback.
        front_idx = p.front_edge_indices[0] if p.front_edge_indices else 0
        n = len(p.plot_coordinates)
        if n > 0 and p.plot_coordinates[0] == p.plot_coordinates[-1]:
            n -= 1 # adjust for closed polygon
            
        secondary_idx = None
        if p.proposed_road_widths_m:
            for idx in p.proposed_road_widths_m.keys():
                if int(idx) != front_idx:
                    secondary_idx = int(idx)
                    break
                    
        if secondary_idx is not None and n > 0:
            if secondary_idx == (front_idx + 1) % n:
                s.side1 = max(s.side1, s.front)
            elif secondary_idx == (front_idx - 1) % n or secondary_idx == (front_idx + n - 1) % n:
                s.side2 = max(s.side2, s.front)
            else:
                s.rear = max(s.rear, s.front)
        else:
            s.side1 = max(s.side1, s.front)  # Fallback
        # Old Layout Exception
        if p.is_old_approved_layout and p.plot_area_sqm <= 500:
            if s.side1 < 1.5:
                 s.side1 = 1.5
            if s.side2 < 1.5:
                 s.side2 = 1.5
                 
        # Commercial Ground Floor Exception is revoked simply by setting side1,
        # but if side2 was 0 in base Commercial, and it's a corner, the logic already 
        # checked `not p.is_corner_plot` in Module 2.

        return s

    def _apply_road_width_override(self, s: SetbackValues) -> SetbackValues:
        """MODULE 3: ROAD-WIDTH OVERRIDE (Bazaar Streets)"""
        p = self.params
        if p.zone_type != "Bazaar Street":
            return s

        # Assume the primary road is the max width in the dict
        if not p.proposed_road_widths_m:
            return s
            
        primary_road_width = max(p.proposed_road_widths_m.values())

        if 12 <= primary_road_width < 18:
            s.front = 3.0
        elif 18 <= primary_road_width < 24:
            s.front = 4.5
        elif 24 <= primary_road_width < 36:
            s.front = 6.0
        elif 36 <= primary_road_width < 76:
            s.front = 7.5
        elif primary_road_width >= 76:
            s.front = 9.0

        return s

    def _apply_height_master_override(self, s: SetbackValues) -> SetbackValues:
        """MODULE 1: HEIGHT-BASED MASTER OVERRIDE (High-Rise Safety Envelope)"""
        p = self.params
        h = p.building_height_m
        
        # Determine strict threshold
        # Plotted multi-units with stilts have a 17.5m threshold, standard residential is 15.0m
        threshold = 17.5 if (p.building_type == "Residential Plotted" and "stilt" in p.zone_type.lower()) else 15.0

        if h <= threshold:
            return s # Area-based rules apply

        # Voids area-based, applies uniform safety envelope
        if 15.0 <= h < 17.5:
             s.front = s.rear = s.side1 = s.side2 = 5.0
        elif 17.5 <= h < 21.0:
             s.front = s.rear = s.side1 = s.side2 = 6.0
        elif 21.0 <= h < 27.0:
             s.front = s.rear = s.side1 = s.side2 = 7.0
        elif 27.0 <= h < 33.0:
             s.front = s.rear = s.side1 = s.side2 = 8.0
        elif 33.0 <= h < 39.0:
             s.front = s.rear = s.side1 = s.side2 = 9.0
        elif 39.0 <= h < 45.0:
             s.front = s.rear = s.side1 = s.side2 = 10.0
        elif 45.0 <= h < 51.0:
             s.front = s.rear = s.side1 = s.side2 = 11.0
        elif h >= 51.0:
             s.front = 15.0
             s.rear = s.side1 = s.side2 = 12.0
             
        # Optional: Ground floor stepped logic would be handled by a layered envelope generator 
        # (returning a 3D volume or multiple 2D slices). For now, returning the max required setback.

        return s

    def validate_geometric_exceptions(self, proposed_elements: List[Dict[str, Any]], open_space_area: float, building_gap: float = None) -> Dict[str, Any]:
        """
        MODULE 5: Validates projections against the UP 2025 Exception limits.
        proposed_elements: list of dicts with type, width, length, area, height
        """
        report = {"status": "Passed", "far_additions": 0.0, "violations": []}
        total_balcony_area = 0.0
        
        # For dynamic setback proportional checks, use base 3.0m if not provided
        # In a full flow, you'd pass the actual calculated setback for that side
        default_setback = 3.0 

        for elem in proposed_elements:
            if elem['type'] == 'balcony':
                total_balcony_area += elem['area']
                
                if elem['width'] > (default_setback / 2): 
                    report["violations"].append(f"Balcony width ({elem['width']}m) exceeds 50% of setback.")
                
                if self.params.building_type == "Group Housing" and building_gap:
                    if building_gap < 6.0:
                        report["violations"].append("Balconies prohibited: Blocks closer than 6m.")
                    elif 6.0 <= building_gap < 9.0 and elem['width'] > 1.5:
                        report["violations"].append(f"Balcony width ({elem['width']}m) capped at 1.5m due to 6-9m block gap.")
                
                if elem['width'] > 2.0:
                    extra_area = (elem['width'] - 2.0) * elem['length']
                    report["far_additions"] += extra_area * 0.25 
                    report["violations"].append("Warning: Balcony > 2.0m triggers FAR penalty.")

            elif elem['type'] == 'portico':
                if elem['width'] > 4.0 or elem['length'] > 8.0:
                    report["violations"].append("Portico exceeds 4x8m limit.")

            elif elem['type'] == 'pergola':
                if elem['area'] > 6.0 or elem['height'] > 2.3:
                    report["violations"].append("Pergola exceeds 6sqm area or 2.3m height limit.")
            
            elif elem['type'] == 'sunshade':
                if elem['width'] > 0.75:
                    report["violations"].append("Sunshade projection exceeds 0.75m limit.")

            elif elem['type'] == 'locked_garage' and elem.get('location') == 'rear_setback':
                report["far_additions"] += elem['area'] 

        if total_balcony_area > (open_space_area * 0.25):
            report["violations"].append(f"Total balcony area ({total_balcony_area}sqm) exceeds 25% of open space ({open_space_area * 0.25}sqm).")

        if len(report["violations"]) > 0:
            report["status"] = "Failed"

        return report  

    def generate_buildable_envelope(self) -> Tuple[Any, SetbackValues]:
        """
        Main geometric constraint solver.
        Returns the Shapely Polygon of the buildable area and the final SetbackValues.
        """
        # Execute Hierarchical Logic Flow
        s = self._calculate_base_setbacks()
        s = self._apply_corner_interrupt(s)
        s = self._apply_road_width_override(s)
        s = self._apply_height_master_override(s)
        
        # Calculate 40% rear setback construction allowance if applicable
        if s.rear_construction_allowance and s.rear > 0:
            # Estimate rear edge length from plot coordinates
            n_coords = len(self.params.plot_coordinates)
            front_idx = self.params.front_edge_indices[0] if self.params.front_edge_indices else 0
            rear_idx = (front_idx + 2) % n_coords
            if rear_idx < n_coords and (rear_idx + 1) < n_coords:
                import math as _m
                rp1 = self.params.plot_coordinates[rear_idx]
                rp2 = self.params.plot_coordinates[(rear_idx + 1) % n_coords]
                rear_edge_len = _m.hypot(rp2[0] - rp1[0], rp2[1] - rp1[1])
            else:
                rear_edge_len = 0
            rear_setback_total_area = s.rear * rear_edge_len
            s.rear_buildable_area = round(rear_setback_total_area * 0.40, 2)  # 40% allowed
        
        if not Polygon:
            return None, s

        # Generate Geometry using Shapely
        # Ensure coordinates are closed 
        coords = self.params.plot_coordinates
        if coords[0] != coords[-1]:
            coords.append(coords[0])
            
        plot_poly = Polygon(coords)
        if not plot_poly.is_valid:
            return None, s
            
        # Standard approach for offset: Use Shapely's buffer with negative distance
        # NOTE: A naive buffer applies uniform setback. 
        # For non-uniform (Front != Rear != Side1 != Side2), we calculate inward parallel lines 
        # and intersect their interior half-planes.
        
        is_uniform = (s.front == s.rear == s.side1 == s.side2)
        has_widening = False
        if self.params.existing_road_widths_m:
            for k, ex_w in self.params.existing_road_widths_m.items():
                pr_w = self.params.proposed_road_widths_m.get(k, ex_w)
                if pr_w > ex_w:
                    has_widening = True
                    break
                    
        # For this standalone module, if setbacks are uniform (e.g., High-Rises) and no widening, we buffer:
        if is_uniform and s.front > 0 and not has_widening:
            buildable_poly = plot_poly.buffer(-s.front, join_style=2)
            return buildable_poly, s
            
        # Non-uniform setbacks require custom parallel shifts:
        # 1. Map edges to indices
        # 2. Shift each edge line segment inwards by the corresponding setback
        # 3. Re-calculate intersections of adjacent shifted lines
        
        n = len(coords) - 1
        shifted_lines = []
        
        for i in range(n):
            p1 = coords[i]
            p2 = coords[(i+1)%n]
            
            # Identify setback required for this edge
            # Build a proper per-edge setback map based on position relative to front
            front_idx = self.params.front_edge_indices[0] if self.params.front_edge_indices else 0
            
            # Check if this edge has a road (is in proposed_road_widths_m)
            has_road = (i in self.params.proposed_road_widths_m) or (str(i) in self.params.proposed_road_widths_m)
            
            if i in self.params.front_edge_indices:
                offset_dist = s.front
            elif has_road and self.params.is_corner_plot:
                # Corner plot: secondary road edge gets front-equivalent setback
                offset_dist = s.front
            elif i == (front_idx + 1) % n:
                offset_dist = s.side1
            elif i == (front_idx + 2) % n:
                offset_dist = s.rear
            else:
                offset_dist = s.side2
                
            widening = 0.0
            if self.params.existing_road_widths_m:
                ex_w = self.params.existing_road_widths_m.get(i, self.params.existing_road_widths_m.get(str(i), None))
                if ex_w is not None:
                    pr_w = self.params.proposed_road_widths_m.get(i, self.params.proposed_road_widths_m.get(str(i), ex_w))
                    widening = max(0.0, (pr_w - ex_w) / 2.0)
                
            offset_dist += widening
                
            # Vector math for inward shift (assuming CCW coordinates)
            dx = p2[0] - p1[0]
            dy = p2[1] - p1[1]
            length = math.hypot(dx, dy)
            if length == 0: continue
            
            nx = -dy / length
            ny = dx / length
            
            sp1 = (p1[0] + nx * offset_dist, p1[1] + ny * offset_dist)
            sp2 = (p2[0] + nx * offset_dist, p2[1] + ny * offset_dist)
            shifted_lines.append({"sp1": sp1, "sp2": sp2, "dx": dx, "dy": dy})
        
        # Intersect shifted lines to find new vertices
        buildable_coords = []
        for i in range(len(shifted_lines)):
            l1 = shifted_lines[i-1]
            l2 = shifted_lines[i]
            
            det = l1['dx'] * (-l2['dy']) - (-l2['dx']) * l1['dy']
            if abs(det) < 1e-6:
                buildable_coords.append(l2['sp1']) # parallel
            else:
                b1 = l2['sp1'][0] - l1['sp1'][0]
                b2 = l2['sp1'][1] - l1['sp1'][1]
                t1 = (b1 * (-l2['dy']) - b2 * (-l2['dx'])) / det
                ix = l1['sp1'][0] + t1 * l1['dx']
                iy = l1['sp1'][1] + t1 * l1['dy']
                buildable_coords.append((ix, iy))
                    
        if len(buildable_coords) > 2:
            buildable_poly = Polygon(buildable_coords)
            if buildable_poly.is_valid:
                return buildable_poly, s
                
        return plot_poly, s # Registration fallback


# Example Usage & Test Case Runner
if __name__ == "__main__":
    
    # Test Case 1: Standard Detached Residential Plot (1200 sqm, <15m height)
    rect_coords = [(0, 0), (30, 0), (30, 40), (0, 40)]
    params1 = PlotParameters(
        plot_coordinates=rect_coords,
        front_edge_indices=[0], # Southern edge is front
        plot_area_sqm=1200.0,
        building_height_m=12.0,
        building_type="Residential Plotted",
        zone_type="Standard",
        proposed_road_widths_m={0: 9.0},
        is_corner_plot=False
    )
    
    engine1 = SetbackEngine(params1)
    poly1, final_setbacks1 = engine1.generate_buildable_envelope()
    
    print("--- Test 1: Detached Residential (1200 sqm) ---")
    print(f"Calculated Setbacks: {final_setbacks1}")
    if poly1:
        print(f"Original Area: {params1.plot_area_sqm}")
        print(f"Buildable Polygon Area: {poly1.area}")
        print(f"Expected Buildable Area: (30 - 6 - 6) * (40 - 1.5 - 1.5) = {18 * 37} = 666")
    
    # Test Case 2: High-Rise Master Override (50m height)
    params2 = PlotParameters(
        plot_coordinates=rect_coords,
        front_edge_indices=[0],
        plot_area_sqm=1200.0,
        building_height_m=50.0, 
        building_type="Residential Plotted",
        zone_type="Standard",
        proposed_road_widths_m={0: 24.0},
        is_corner_plot=False
    )
    
    engine2 = SetbackEngine(params2)
    poly2, final_setbacks2 = engine2.generate_buildable_envelope()
    
    print("\\n--- Test 2: High-Rise Override (50m, 1200sqm) ---")
    print(f"Calculated Setbacks: {final_setbacks2}")
    if poly2:
        print(f"Expected Buildable Area: (30 - 11 - 11) * (40 - 11 - 11) = {8 * 18} = 144")
        print(f"Buildable Polygon Area: {poly2.area}")
        
    # Test Case 3: Geometric Exception Validation
    print("\\n--- Test 3: Module 5 Geometric Validation ---")
    props = [
        {"type": "balcony", "width": 2.5, "length": 4.0, "area": 10.0, "height": 3.0},
        {"type": "portico", "width": 5.0, "length": 6.0, "area": 30.0, "height": 3.0} # Too wide
    ]
    report = engine1.validate_geometric_exceptions(props, open_space_area=100.0)
    print(f"Report: {report}")
