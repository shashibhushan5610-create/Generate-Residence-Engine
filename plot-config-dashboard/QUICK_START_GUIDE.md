# 🚀 QUICK_START_GUIDE.md

Get the UP Bylaw Rule Engine integrated into your project in under 5 minutes.

## 🛠️ Installation

### 1. Copy the Files
Download and copy the following files into your project directory:
- `Rule_Engine_Implementation.js` (The Engine)
- `Sample_Rules_Engine_Data.json` (The Rule Data)

### 2. Basic Setup (Browser)
```html
<!-- Load rules data first -->
<script>
  fetch('Sample_Rules_Engine_Data.json')
    .then(r => r.json())
    .then(data => { window.BYLAW_RULES = data; });
</script>

<!-- Load the engine -->
<script src="Rule_Engine_Implementation.js"></script>
```

---

## 💻 Usage Examples

### Initialize the Engine
```javascript
const Engine = window.UPBylawRuleEngine;
const rules  = window.BYLAW_RULES;

const engine = new Engine(rules);
```

### Create a Building Proposal
The proposal object contains your building's parameters.
```javascript
const proposal = Engine.createProposal({
  building_type: 'single_unit', // 'single_unit', 'multi_unit', 'commercial'
  plotArea: 450,                // in sqm
  primaryRoadWidth: 12.0,       // in metres
  proposedHeight: 14.5          // in metres
});
```

### Validate and Get Results
```javascript
const result = engine.validateBuilding(proposal);

if (result.isValid) {
  console.log("✓ Compliant with UP Bylaws");
} else {
  console.log("✖ Non-Compliant:");
  result.errors.forEach(err => console.log(`- ${err.message}`));
}
```

---

## 📅 Common Implementation Patterns

### Pattern A: React Component
```javascript
useEffect(() => {
  const engine = new UPBylawRuleEngine(rulesData);
  const res = engine.validateBuilding(currentProposal);
  setValidationResult(res);
}, [currentProposal]);
```

### Pattern B: Node.js Backend
```javascript
const UPBylawRuleEngine = require('./Rule_Engine_Implementation');
const rulesData = require('./Sample_Rules_Engine_Data.json');

app.post('/validate', (req, res) => {
  const engine = new UPBylawRuleEngine(rulesData);
  const result = engine.validateBuilding(req.body);
  res.json(result);
});
```

---

## ❓ FAQ & Troubleshooting

**Q: Why are so many rules showing as "skipped"?**
A: A rule is skipped if the required field (e.g., `parkingECS`) is missing from the proposal. Ensure you are providing all fields listed in `Sample_Rules_Engine_Data.json`.

**Q: How do I add a new rule?**
A: Open `Sample_Rules_Engine_Data.json`, find the `rules` array, and add a new object following the existing schema. No code changes required!
