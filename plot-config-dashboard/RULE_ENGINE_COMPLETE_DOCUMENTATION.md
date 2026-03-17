# 📖 RULE_ENGINE_COMPLETE_DOCUMENTATION.md

## 1. Engine API Reference (`UPBylawRuleEngine`)

### `constructor(rulesData)`
Initializes the engine with the provided JSON rules.
- **Param**: `rulesData` (Object) — Loaded JSON from `Sample_Rules_Engine_Data.json`.

### `validateBuilding(proposal)`
The primary entry point for validation.
- **Param**: `proposal` (Object) — Building parameters.
- **Returns**: `result` (Object)
  - `isValid` (Boolean)
  - `summary` (Object): Counts of pass/fail/warn.
  - `errors` (Array): High-priority violations.
  - `warnings` (Array): Medium-priority concerns.
  - `passed` (Array): Rules that were successfully met.
  - `report` (Array): Flattened list of all applicable rules.

### `checkPermissibility(proposal)`
Checks if the building type is allowed in the given zone.
- **Returns**: `{ permitted: Boolean, message: String, type: 'prohibited'|'conditional'|'as_of_right' }`

---

## 2. JSON Rule Syntax

Rules are defined in the `rules` array.

### Condition Types
The `condition` block supports:
- **Simple**: `{ "field": "x", "operator": "==", "value": "y" }`
- **AND**: `{ "operator": "AND", "conditions": [ ... ] }`
- **OR**: `{ "operator": "OR", "conditions": [ ... ] }`

### Operator List
Operator | Meaning
---|---
`>=`, `<=`, `>`, `<` | Numerical comparison
`==`, `!=` | Value equality
`in` | Check if value exists in array
`not_in` | Check if value does NOT exist in array
`between` | Check if value is within `[min, max]` array

---

## 3. Calculation & Enrichment Logic

The engine automatically calculates the following if they are missing but their dependencies exist:

| Variable | Depends On |
|---|---|
| `FAR` | `totalFloorArea`, `netPlotArea` |
| `groundCoverage` | `footprintArea`, `plotArea` |
| `numberOfStoreys` | `proposedHeight` |
| `primaryRoadWidth` | `roads[]` |
| `netPlotArea` | `plotArea`, `roadWideningArea` |

---

## 4. Severity Guidelines

- **`error`**: Absolute regulatory showstopper. Plot cannot be approved.
- **`warning`**: Requires special permission from the MD or local body, or triggers a penalty.
- **`info`**: Guidance/Best practice. Does not affect compliance status.

---

## 5. Maintenance Guide

### Updating Bylaws
1. Open `Sample_Rules_Engine_Data.json`.
2. Locate the rule you want to change.
3. Update the `value` or `operator`.
4. Refresh the dashboard. No compilation needed.

### Adding New Jurisdictions
1. Create a duplicate of `Sample_Rules_Engine_Data.json`.
2. Update the `rules` content per the new municipality.
3. Call `new UPBylawRuleEngine(newRulesData)`.
