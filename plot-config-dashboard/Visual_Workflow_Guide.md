# 🖼️ Visual_Workflow_Guide.md

This document provides visual representations of the UP Bylaw Rule Engine's internal logic and processing sequence.

## 1. High-Level System Flow
The engine behaves as a pure function: Input (Proposal + Rules) → Output (Report).

```mermaid
sequenceDiagram
    participant UI as Dashboard UI
    participant RE as UPBylawRuleEngine
    participant Data as Rules JSON

    UI->>RE: validateBuilding(proposal)
    RE->>Data: Read rules[ ]
    Note over RE: Phase 1: Enrich Derived Values
    Note over RE: Phase 2: Filter Applicable Rules
    loop Every Applicable Rule
        RE->>RE: Evaluate condition
        RE->>RE: Compare Parameter vs Value
        RE->>RE: Log Result (Pass/Fail)
    end
    RE->>UI: Return structured report
```

---

## 2. Rule Applicability Logic (Filter)
Before a rule is "executed", the engine checks if it applies to your building.

```mermaid
graph TD
    Start[Check Rule] --> BuildingType{Building Type Match?}
    BuildingType -->|No| Skip[Skip Rule]
    BuildingType -->|Yes| LandUse{Land Use Match?}
    LandUse -->|No| Skip
    LandUse -->|Yes| Condition{Custom Condition Met?}
    Condition -->|No| Skip
    Condition -->|Yes| Execute[Execute Evaluation]
```

---

## 3. The "Solar-Zoning" Integration
How the rule engine interacts with the zoning engine logic.

```mermaid
graph LR
    A[Geometry Dashboard] -->|State| B[Geometry Engine]
    B -->|Plot Vertices| C[Zoning Engine]
    C -->|Zone Assignments| D[Dashboard State]
    D -->|Proposal| E[Rule Engine]
    E -->|Validation| F[Compliance Dashboard]
```

---

## 4. Derived Value Dependencies
The engine "frightens" the data by calculating missing pieces automatically.

| Input Parameter | → | Derived Result | Formula |
|---|---|---|---|
| plotArea, proposedHeight | → | numberOfStoreys | `ceil(height / 3.5)` |
| footprintArea, plotArea | → | groundCoverage | `(fp / plot) * 100` |
| totalFloorArea, plotArea | → | FAR | `total / plot` |
| roads[ ] | → | primaryRoadWidth | `max(roads.width)` |
