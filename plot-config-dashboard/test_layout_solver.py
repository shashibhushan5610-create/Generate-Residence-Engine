import sys
import os

# Add the current directory to path so we can import layout_solver
sys.path.append(os.getcwd())

from layout_solver import GeometryLayoutSolver

def test_layout_generation():
    print("--- Testing Residential Layout Solver ---")
    
    # Test Case 1: Medium Plot (150 sqm)
    print("\nTest Case 1: Medium Plot (10m x 15m, 150 sqm)")
    solver = GeometryLayoutSolver(
        buildable_width=8.0, 
        buildable_depth=12.0, 
        rooms=["Living", "Master Bedroom", "Bedroom"],
        offset_x=1.0,
        offset_y=2.0,
        road_facing=["front"],
        plot_width=10.0,
        plot_area=150.0
    )
    result = solver.solve()
    
    rooms = result['rooms']
    room_names = [r['name'] for r in rooms]
    print(f"Generated Rooms: {room_names}")
    
    # Check for expanded program
    assert "Parking" in room_names, "Parking should be auto-generated for 10m width"
    assert "Foyer" in room_names, "Foyer should be auto-generated"
    assert "Kitchen" in room_names, "Kitchen should be auto-generated"
    assert "Dining" in room_names, "Dining should be auto-generated"
    
    # Check Coverage
    coverage = result['metadata']['stats']['coverage_percent']
    print(f"Coverage: {coverage:.2f}%")
    assert coverage > 80, f"Coverage {coverage}% is too low"

    # Check Zoning (simplified)
    # Living and Parking should be at the front (y=200 for offset_y=2.0m)
    parking = next(r for r in rooms if r['name'] == 'Parking')
    foyer = next(r for r in rooms if r['name'] == 'Foyer')
    living = next(r for r in rooms if r['name'] == 'Living')
    
    print(f"Parking Y: {parking['y']}, Foyer Y: {foyer['y']}, Living Y: {living['y']}")
    assert parking['y'] == 200, "Parking should be at the front"
    
    # Bedrooms should be at the rear
    master = next(r for r in rooms if r['name'] == 'Master bedroom')
    print(f"Master Bedroom Y: {master['y']}")
    assert master['y'] > parking['y'], "Bedroom should be behind front zone"

    print("\n✅ Test Case 1 Passed!")

    # Test Case 2: Small Plot (5m x 10m, 50 sqm)
    print("\nTest Case 2: Small Plot (5m x 10m, 50 sqm)")
    solver2 = GeometryLayoutSolver(
        buildable_width=4.0, 
        buildable_depth=6.0, 
        rooms=["Living", "Bedroom"],
        offset_x=0.5,
        offset_y=1.5,
        road_facing=["front"],
        plot_width=5.0,
        plot_area=50.0
    )
    result2 = solver2.solve()
    room_names2 = [r['name'] for r in result2['rooms']]
    print(f"Generated Rooms: {room_names2}")
    
    # Parking should NOT be auto-generated for 5m width
    assert "Parking" not in room_names2, "Parking should NOT be added for < 7m width"
    
    print("\n✅ Test Case 2 Passed!")

if __name__ == "__main__":
    try:
        test_layout_generation()
        print("\n🎉 ALL TESTS PASSED!")
    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ AN ERROR OCCURRED: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
