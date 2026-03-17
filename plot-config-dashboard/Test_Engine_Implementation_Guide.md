# 🧪 Test_Engine_Implementation_Guide.md

The `TestEngine_Interactive_Component.jsx` is a high-fidelity React component designed to verify the Rule Engine's logic against 10 specific UP Bylaw test scenarios.

## 🚀 Setup Instructions

### 1. Requirements
Ensure you have the following installed in your React project:
- `lucide-react` (for icons)
- `Tailwind CSS` (for styling)

### 2. Integration
Import the component into your main App or a dedicated Testing page:
```jsx
import UPRuleTestEngine from './components/UPRuleTestEngine';

function App() {
  return <UPRuleTestEngine />;
}
```

---

## 📊 Test Case Definitions

The engine includes 10 predefined test cases covering common architectural scenarios:

| ID | Name | Objective | Expected Result |
|---|---|---|---|
| 1 | Valid Single Unit | Baseline Pass | COMPLIANT |
| 2 | Height Violation | Test Height cap (15m) | VIOLATION |
| 3 | Plot Size Failure | Test Min Area (30sqm) | VIOLATION |
| 4 | Group Housing Pass | Test Multi-Unit wide road | COMPLIANT |
| 5 | Road Access Fail | Test Multi-Unit min road | VIOLATION |
| 6 | FAR Over Limit | Test FAR multiplier | VIOLATION |
| 7 | Wide Road Bonus | Test Conditional height | COMPLIANT |
| 8 | Commercial Pass | Test shop-front logic | COMPLIANT |
| 9 | Multi-Violation | Test logic aggregation | VIOLATION |
| 10| Minimum Bound | Test lower-limit boundary | COMPLIANT |

---

## 🛠️ Customization

### Adding New Test Cases
To add a 11th test case, open `TestEngine_Interactive_Component.jsx` and add an object to the `TEST_CASES` array:
```javascript
{ 
  id: 11, 
  name: "New Scenario", 
  type: "single_unit", 
  area: 500, 
  height: 10, 
  road: 12, 
  expected: "Pass", 
  desc: "Custom description here." 
}
```

### Connecting to Real Engine
The current component uses a "Mock Result" for demonstration. To connect it to your production `UPBylawRuleEngine.js`:
1. Import the engine class.
2. Replace the `useMemo` result calculation with:
```javascript
const actualResult = engine.validateBuilding(activeTest);
```

---

## 🎨 Design System
- **Theme**: Slate/Indigo Dark Theme.
- **Components**: Frameless SVG for plot visualization.
- **Icons**: Lucide-React for semantic status indicators.
- **Responsiveness**: Flex-box based layout for high-density information display.
