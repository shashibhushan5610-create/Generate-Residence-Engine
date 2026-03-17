import json
import os

part1_path = r"g:\architectOS\genrate engine\plot-config-dashboard\part1.json"
part2_path = r"g:\architectOS\genrate engine\plot-config-dashboard\part2.json"
output_path = r"g:\architectOS\genrate engine\plot-config-dashboard\residential_zoning_rules.json"

with open(part1_path, 'r', encoding='utf-8') as f:
    d1 = json.load(f)

with open(part2_path, 'r', encoding='utf-8') as f:
    d2 = json.load(f)

# Merge the two dictionaries
d1.update(d2)

with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(d1, f, indent=2)

print(f"Successfully generated {output_path}")

# Clean up
os.remove(part1_path)
os.remove(part2_path)
os.remove(__file__)
