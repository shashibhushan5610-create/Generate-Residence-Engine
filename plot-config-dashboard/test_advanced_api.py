import requests
import json

def test_generate_layout_advanced():
    url = "http://127.0.0.1:8000/api/v1/generate-layout-advanced"
    payload = {
        "vertices": [
            {"x": 0, "y": 0},
            {"x": 10, "y": 0},
            {"x": 10, "y": 20},
            {"x": 0, "y": 20}
        ],
        "road_direction": "South",
        "num_bedrooms": 3,
        "include_parking": True,
        "setbacks": {
            "front": 3.0,
            "rear": 1.5,
            "side": 1.5
        }
    }

    try:
        response = requests.post(url, json=payload)
        print(f"Status Code: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print("Status:", data.get("status"))
            variants = data.get("variants", [])
            print(f"Number of Variants: {len(variants)}")
            if variants:
                first_variant = variants[0]
                print(f"Variant 1 Rooms: {len(first_variant.get('rooms', []))}")
                print(f"Variant 1 Corridors: {len(first_variant.get('corridors', []))}")
                print(f"Variant 1 Score: {first_variant.get('score')}")
        else:
            print("Error:", response.text)
    except Exception as e:
        print(f"Request failed: {e}")

if __name__ == "__main__":
    # Note: This requires the FastAPI server to be running.
    # Since we can't easily run it in the background and test in one go here,
    # we will use this script as a reference or try to run it if the server is already up.
    print("Testing Advanced Layout API...")
    test_generate_layout_advanced()
