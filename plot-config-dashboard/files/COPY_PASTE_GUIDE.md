# ANTIGRAVITY INTEGRATION - COPY & PASTE GUIDE

## Overview

This guide shows **exactly** what to copy and paste into your Antigravity project to get the layout engine working.

---

## What You're Adding

```
OLD Antigravity:
  ├── backend/
  │   ├── services/
  │   │   └── plot_service.py
  │   ├── api/
  │   │   └── routes/
  │   │       └── plot_routes.py
  │   └── app.py
  └── frontend/
      └── components/

NEW Antigravity (with layout engine):
  ├── backend/
  │   ├── services/
  │   │   ├── plot_service.py          (old)
  │   │   ├── layout_service.py        ← NEW: Copy this
  │   │   ├── program_generator.py     ← COPY from deliverables
  │   │   ├── adjacency_graph.py       ← COPY from deliverables
  │   │   ├── zoning_solver.py         ← COPY from deliverables
  │   │   ├── packing_solver.py        ← COPY from deliverables
  │   │   ├── circulation_graph.py     ← COPY from deliverables
  │   │   └── layout_engine.py         ← COPY from deliverables
  │   ├── api/
  │   │   ├── routes/
  │   │   │   ├── plot_routes.py       (old)
  │   │   │   └── layout_routes.py     ← NEW: Copy this
  │   │   └── schemas/
  │   │       └── layout_schemas.py    ← NEW: Copy this
  │   ├── app.py                       ← MODIFY (add 2 lines)
  │   └── requirements.txt             ← MODIFY (add 3 lines)
  └── frontend/
      └── components/
          ├── LayoutGenerator.jsx      ← NEW: Copy this
          └── LayoutCanvas.jsx         ← NEW: Copy this
```

---

## Step-by-Step Copy & Paste

### STEP 1: Copy 6 Core Python Files

Copy these 6 files from the deliverables to your `backend/services/` directory:

```bash
# In terminal:
cp program_generator.py /path/to/antigravity/backend/services/
cp adjacency_graph.py /path/to/antigravity/backend/services/
cp zoning_solver.py /path/to/antigravity/backend/services/
cp packing_solver.py /path/to/antigravity/backend/services/
cp circulation_graph.py /path/to/antigravity/backend/services/
cp layout_engine.py /path/to/antigravity/backend/services/
```

**Result:**
```
antigravity/backend/services/
├── program_generator.py
├── adjacency_graph.py
├── zoning_solver.py
├── packing_solver.py
├── circulation_graph.py
└── layout_engine.py
```

---

### STEP 2: Create `layout_service.py`

Create a new file: `backend/services/layout_service.py`

**Copy & paste this entire content:**

```python
"""
Layout Service Wrapper

Provides high-level interface to layout engine for Antigravity platform.
"""

from typing import Dict, List, Optional
import logging
from shapely.geometry import Polygon, shape as geom_shape

from .layout_engine import LayoutEngine, RoadDirection, LayoutOutput
from .program_generator import RoomProgramGenerator

logger = logging.getLogger(__name__)


class LayoutService:
    """High-level service for generating architectural layouts."""
    
    def __init__(self):
        """Initialize layout service."""
        self.engine = LayoutEngine()
        self.program_gen = RoomProgramGenerator()
    
    def generate_layout_from_geojson(
        self,
        plot_geojson: Dict,
        road_direction: str,
        num_bedrooms: int = 2,
        include_parking: bool = True,
        setback_front: float = 1.5,
        setback_rear: float = 2.0,
        setback_sides: float = 1.5,
        variant_count: int = 3
    ) -> Dict:
        """
        Generate layout from GeoJSON plot geometry.
        
        Args:
            plot_geojson: GeoJSON FeatureCollection or Geometry
            road_direction: "NORTH", "SOUTH", "EAST", or "WEST"
            num_bedrooms: Number of bedrooms (2-4)
            include_parking: Include parking space
            setback_*: Property line setbacks in meters
            variant_count: Number of variants to generate (1-5)
            
        Returns:
            Dict with layout results including rooms, corridors, metrics
        """
        try:
            # Convert GeoJSON to Shapely polygon
            if isinstance(plot_geojson, dict) and 'features' in plot_geojson:
                # FeatureCollection
                feature = plot_geojson['features'][0]
                geom = feature['geometry']
            elif isinstance(plot_geojson, dict) and 'type' in plot_geojson:
                # Direct geometry
                geom = plot_geojson
            else:
                raise ValueError("Invalid GeoJSON format")
            
            plot_polygon = geom_shape(geom)
            
            # Validate polygon
            if not plot_polygon.is_valid:
                raise ValueError("Plot polygon is invalid")
            
            if plot_polygon.area < 50.0:
                raise ValueError(f"Plot too small: {plot_polygon.area:.1f} sqm")
            
            # Convert road direction
            try:
                road_enum = RoadDirection[road_direction.upper()]
            except KeyError:
                raise ValueError(f"Invalid road direction: {road_direction}")
            
            # Validate parameters
            num_bedrooms = max(1, min(4, num_bedrooms))
            variant_count = max(1, min(5, variant_count))
            
            # Generate layouts
            logger.info(f"Generating layout for {plot_polygon.area:.1f} sqm plot")
            
            layouts = self.engine.generate_layout(
                plot_polygon=plot_polygon,
                road_direction=road_enum,
                num_bedrooms=num_bedrooms,
                include_parking=include_parking,
                setback_front=setback_front,
                setback_rear=setback_rear,
                setback_sides=setback_sides,
                variant_count=variant_count
            )
            
            logger.info(f"Generated {len(layouts)} layout variants")
            
            # Convert to output format
            results = {
                'status': 'success',
                'plot': {
                    'area': plot_polygon.area,
                    'bounds': list(plot_polygon.bounds),
                    'coordinates': list(plot_polygon.exterior.coords)
                },
                'variants': [
                    self._format_layout_output(layout, idx)
                    for idx, layout in enumerate(layouts)
                ]
            }
            
            return results
        
        except ValueError as e:
            logger.warning(f"Validation error: {e}")
            return {
                'status': 'error',
                'error': 'validation_error',
                'message': str(e)
            }
        
        except Exception as e:
            logger.error(f"Layout generation failed: {e}", exc_info=True)
            return {
                'status': 'error',
                'error': 'generation_failed',
                'message': 'Failed to generate layout'
            }
    
    def _format_layout_output(self, layout: LayoutOutput, variant_index: int) -> Dict:
        """Format layout output for API response."""
        return {
            'variant_id': f'variant_{variant_index}',
            'rank': layout.variant_rank,
            'total_variants': layout.variant_count,
            'metrics': layout.metrics,
            'rooms': layout.rooms,
            'corridors': layout.corridors,
            'zones': layout.zones,
            'circulation': layout.circulation_stats
        }
    
    def get_program_preview(
        self,
        plot_area: float,
        plot_width: float,
        plot_height: float,
        num_bedrooms: int = 2
    ) -> Dict:
        """Get preview of room program without full layout generation."""
        try:
            program = self.program_gen.generate_program(
                plot_area=plot_area,
                plot_width=plot_width,
                plot_height=plot_height,
                num_bedrooms=num_bedrooms,
                has_parking=plot_width >= 6.5
            )
            
            summary = self.program_gen.get_program_summary(program)
            
            return {
                'status': 'success',
                'program': {
                    'rooms': [r.to_dict() for r in program],
                    'summary': summary
                }
            }
        
        except Exception as e:
            logger.error(f"Program preview failed: {e}")
            return {
                'status': 'error',
                'message': str(e)
            }


def get_layout_service() -> LayoutService:
    """Get or create layout service instance."""
    return LayoutService()
```

---

### STEP 3: Create `layout_routes.py`

Create a new file: `backend/api/routes/layout_routes.py`

**Copy & paste this entire content:**

```python
"""
Layout API Routes - REST endpoints for layout generation
"""

from flask import Blueprint, request, jsonify
import logging

from ...services.layout_service import get_layout_service

logger = logging.getLogger(__name__)
layout_bp = Blueprint('layouts', __name__, url_prefix='/api/layouts')


@layout_bp.route('/validate', methods=['POST'])
def validate_plot():
    """
    POST /api/layouts/validate
    {
        "plot": {GeoJSON geometry}
    }
    """
    try:
        data = request.json
        plot_geojson = data.get('plot')
        
        if not plot_geojson:
            return jsonify({'error': 'Missing plot parameter'}), 400
        
        from shapely.geometry import shape as geom_shape
        
        geom = (plot_geojson['features'][0]['geometry'] 
                if 'features' in plot_geojson 
                else plot_geojson)
        
        polygon = geom_shape(geom)
        
        warnings = []
        if polygon.area < 50:
            warnings.append("Plot very small (< 50 sqm)")
        
        return jsonify({
            'status': 'success',
            'valid': polygon.is_valid,
            'area': polygon.area,
            'bounds': list(polygon.bounds),
            'warnings': warnings
        })
    
    except Exception as e:
        logger.error(f"Validation error: {e}")
        return jsonify({'error': 'Validation failed'}), 500


@layout_bp.route('/preview-program', methods=['POST'])
def preview_program():
    """
    POST /api/layouts/preview-program
    {
        "plot_area": 300,
        "plot_width": 20,
        "plot_height": 15,
        "num_bedrooms": 2
    }
    """
    try:
        data = request.json
        
        service = get_layout_service()
        result = service.get_program_preview(
            plot_area=data.get('plot_area', 200),
            plot_width=data.get('plot_width', 15),
            plot_height=data.get('plot_height', 13.3),
            num_bedrooms=data.get('num_bedrooms', 2)
        )
        
        return jsonify(result)
    
    except Exception as e:
        logger.error(f"Program preview error: {e}")
        return jsonify({'error': 'Preview failed'}), 500


@layout_bp.route('/generate', methods=['POST'])
def generate_layout():
    """
    POST /api/layouts/generate
    {
        "plot": {GeoJSON geometry},
        "road_direction": "SOUTH",
        "num_bedrooms": 2,
        "include_parking": true,
        "setback_front": 1.5,
        "setback_rear": 2.0,
        "setback_sides": 1.5,
        "variant_count": 3
    }
    """
    try:
        data = request.json
        plot_geojson = data.get('plot')
        
        if not plot_geojson:
            return jsonify({'error': 'Missing plot parameter'}), 400
        
        service = get_layout_service()
        
        result = service.generate_layout_from_geojson(
            plot_geojson=plot_geojson,
            road_direction=data.get('road_direction', 'SOUTH'),
            num_bedrooms=data.get('num_bedrooms', 2),
            include_parking=data.get('include_parking', True),
            setback_front=data.get('setback_front', 1.5),
            setback_rear=data.get('setback_rear', 2.0),
            setback_sides=data.get('setback_sides', 1.5),
            variant_count=data.get('variant_count', 3)
        )
        
        return jsonify(result)
    
    except Exception as e:
        logger.error(f"Generation error: {e}")
        return jsonify({'error': 'Generation failed'}), 500


def register_layout_routes(app):
    """Register layout routes with Flask app."""
    app.register_blueprint(layout_bp)
```

---

### STEP 4: Update `app.py`

Find your main Flask app file (usually `backend/app.py` or `backend/__init__.py`)

**Find this line:**
```python
# Flask app initialization
app = Flask(__name__)
```

**Add these 2 lines after all other blueprint registrations:**
```python
# Register layout routes
from .api.routes.layout_routes import register_layout_routes
register_layout_routes(app)
```

**Full example:**
```python
from flask import Flask
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Your existing route registrations
# from .api.routes.plot_routes import register_plot_routes
# register_plot_routes(app)

# ADD THESE 2 LINES:
from .api.routes.layout_routes import register_layout_routes
register_layout_routes(app)

@app.route('/health', methods=['GET'])
def health():
    return {'status': 'ok'}

if __name__ == '__main__':
    app.run(debug=True)
```

---

### STEP 5: Update `requirements.txt`

Find your `backend/requirements.txt` file

**Add these 3 lines at the end:**
```
networkx>=2.6
shapely>=2.0
ortools>=9.7
```

**Then install:**
```bash
pip install -r requirements.txt
```

---

### STEP 6: Test Backend (5 minutes)

**Test with curl:**

```bash
# Test 1: Validate plot
curl -X POST http://localhost:5000/api/layouts/validate \
  -H "Content-Type: application/json" \
  -d '{
    "plot": {
      "type": "Polygon",
      "coordinates": [[[0,0], [20,0], [20,15], [0,15], [0,0]]]
    }
  }'

# Expected response:
# {"status": "success", "valid": true, "area": 300.0, ...}

# Test 2: Generate layout
curl -X POST http://localhost:5000/api/layouts/generate \
  -H "Content-Type: application/json" \
  -d '{
    "plot": {
      "type": "Polygon",
      "coordinates": [[[0,0], [20,0], [20,15], [0,15], [0,0]]]
    },
    "road_direction": "SOUTH",
    "num_bedrooms": 2,
    "variant_count": 2
  }'

# Expected response:
# {"status": "success", "plot": {...}, "variants": [...]}
```

If both work ✅, your backend is ready!

---

### STEP 7: Create Frontend Component - `LayoutGenerator.jsx`

Create a new file: `frontend/src/components/LayoutGenerator.jsx`

**Copy & paste this entire content:**

```javascript
import React, { useState } from 'react';
import LayoutCanvas from './LayoutCanvas';
import './LayoutGenerator.css';

function LayoutGenerator({ plotGeojson, onLayoutUpdate }) {
  const [loading, setLoading] = useState(false);
  const [layoutData, setLayoutData] = useState(null);
  const [error, setError] = useState(null);
  const [params, setParams] = useState({
    road_direction: 'SOUTH',
    num_bedrooms: 2,
    include_parking: true,
    setback_front: 1.5,
    setback_rear: 2.0,
    setback_sides: 1.5,
    variant_count: 3
  });

  const handleParamChange = (key, value) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/layouts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plot: plotGeojson,
          ...params
        })
      });

      const data = await response.json();

      if (data.status === 'error') {
        setError(data.message || 'Layout generation failed');
      } else {
        setLayoutData(data);
        if (onLayoutUpdate) {
          onLayoutUpdate(data);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="layout-generator">
      <div className="sidebar">
        <h2>Layout Parameters</h2>

        <div className="form-group">
          <label>Road Direction</label>
          <select
            value={params.road_direction}
            onChange={e => handleParamChange('road_direction', e.target.value)}
          >
            <option value="NORTH">North</option>
            <option value="SOUTH">South</option>
            <option value="EAST">East</option>
            <option value="WEST">West</option>
          </select>
        </div>

        <div className="form-group">
          <label>Bedrooms: {params.num_bedrooms}</label>
          <input
            type="range"
            min="1"
            max="4"
            value={params.num_bedrooms}
            onChange={e => handleParamChange('num_bedrooms', parseInt(e.target.value))}
          />
        </div>

        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={params.include_parking}
              onChange={e => handleParamChange('include_parking', e.target.checked)}
            />
            Include Parking
          </label>
        </div>

        <div className="form-group">
          <label>Variants: {params.variant_count}</label>
          <input
            type="range"
            min="1"
            max="5"
            value={params.variant_count}
            onChange={e => handleParamChange('variant_count', parseInt(e.target.value))}
          />
        </div>

        <div className="form-group">
          <h4>Setbacks (m)</h4>
          <label>
            Front: {params.setback_front.toFixed(1)}m
            <input
              type="range"
              min="0.5"
              max="5"
              step="0.5"
              value={params.setback_front}
              onChange={e => handleParamChange('setback_front', parseFloat(e.target.value))}
            />
          </label>
          <label>
            Rear: {params.setback_rear.toFixed(1)}m
            <input
              type="range"
              min="0.5"
              max="5"
              step="0.5"
              value={params.setback_rear}
              onChange={e => handleParamChange('setback_rear', parseFloat(e.target.value))}
            />
          </label>
          <label>
            Sides: {params.setback_sides.toFixed(1)}m
            <input
              type="range"
              min="0.5"
              max="5"
              step="0.5"
              value={params.setback_sides}
              onChange={e => handleParamChange('setback_sides', parseFloat(e.target.value))}
            />
          </label>
        </div>

        <button
          className="btn-primary"
          onClick={handleGenerate}
          disabled={loading || !plotGeojson}
        >
          {loading ? 'Generating...' : 'Generate Layout'}
        </button>

        {error && <div className="error-message">{error}</div>}
      </div>

      <div className="main-content">
        {layoutData ? (
          <LayoutCanvas layoutData={layoutData} />
        ) : (
          <div className="placeholder">
            <p>Configure parameters and click "Generate Layout"</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default LayoutGenerator;
```

---

### STEP 8: Create Frontend Component - `LayoutCanvas.jsx`

Create a new file: `frontend/src/components/LayoutCanvas.jsx`

**Copy & paste this entire content:**

```javascript
import React, { useState } from 'react';
import './LayoutCanvas.css';

function LayoutCanvas({ layoutData }) {
  const [selectedVariant, setSelectedVariant] = useState(0);
  const canvas = React.useRef(null);

  const variant = layoutData.variants[selectedVariant];

  React.useEffect(() => {
    if (!canvas.current || !variant) return;

    const ctx = canvas.current.getContext('2d');
    const { width, height } = canvas.current;

    // Clear canvas
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);

    // Get bounds for scaling
    const bounds = layoutData.plot.bounds;
    const plotWidth = bounds[2] - bounds[0];
    const plotHeight = bounds[3] - bounds[1];

    const scale = Math.min(width / plotWidth, height / plotHeight) * 0.9;

    const offsetX = (width - plotWidth * scale) / 2;
    const offsetY = (height - plotHeight * scale) / 2;

    // Transform coordinates
    const transform = (x, y) => [
      offsetX + (x - bounds[0]) * scale,
      offsetY + (y - bounds[1]) * scale
    ];

    // Draw zones
    variant.zones.forEach(zone => {
      ctx.fillStyle = getZoneColor(zone.type);
      ctx.globalAlpha = 0.1;

      const [x1, y1] = transform(zone.bounds[0], zone.bounds[1]);
      const [x2, y2] = transform(zone.bounds[2], zone.bounds[3]);

      ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
      ctx.globalAlpha = 1.0;
    });

    // Draw corridors
    ctx.strokeStyle = '#999';
    ctx.lineWidth = 2;

    variant.corridors.forEach(corridor => {
      ctx.beginPath();
      const [x1, y1] = transform(
        corridor.coordinates[0][0],
        corridor.coordinates[0][1]
      );
      ctx.moveTo(x1, y1);

      corridor.coordinates.forEach((coord, i) => {
        if (i === 0) return;
        const [x, y] = transform(coord[0], coord[1]);
        ctx.lineTo(x, y);
      });

      ctx.stroke();
    });

    // Draw rooms
    variant.rooms.forEach(room => {
      const [x, y] = transform(room.x, room.y);
      const w = room.width * scale;
      const h = room.height * scale;

      // Room rectangle
      ctx.fillStyle = getRoomColor(room.zone_type);
      ctx.fillRect(x, y, w, h);

      // Room border
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);

      // Room label
      ctx.fillStyle = '#000';
      ctx.font = '12px Arial';
      ctx.fillText(room.name, x + 5, y + 20);
      ctx.fillText(`${room.area.toFixed(1)}m²`, x + 5, y + 35);
    });

    // Draw plot boundary
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    const [x1, y1] = transform(bounds[0], bounds[1]);
    const [x2, y2] = transform(bounds[2], bounds[3]);
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

  }, [variant, layoutData]);

  const getRoomColor = (zoneType) => {
    const colors = {
      public: '#FFB6C1',
      semi_private: '#FFD700',
      private: '#87CEEB',
      service: '#D3D3D3',
      parking: '#A9A9A9'
    };
    return colors[zoneType] || '#E0E0E0';
  };

  const getZoneColor = (type) => {
    const colors = {
      front: '#FF6B6B',
      middle: '#FFA500',
      rear: '#4CAF50',
      service: '#9C27B0'
    };
    return colors[type] || '#999';
  };

  return (
    <div className="layout-canvas-container">
      <div className="controls">
        <h2>Layout Variants</h2>
        <div className="variant-selector">
          {layoutData.variants.map((v, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedVariant(idx)}
              className={selectedVariant === idx ? 'active' : ''}
            >
              Variant {idx + 1} - {(v.metrics.quality_score * 100).toFixed(0)}%
            </button>
          ))}
        </div>
      </div>

      <canvas
        ref={canvas}
        width={800}
        height={600}
        className="layout-canvas"
      />

      {variant && (
        <div className="metrics">
          <h3>Metrics</h3>
          <div className="metric-grid">
            <div className="metric">
              <span>Quality Score</span>
              <strong>{(variant.metrics.quality_score * 100).toFixed(0)}%</strong>
            </div>
            <div className="metric">
              <span>Area Utilization</span>
              <strong>{(variant.metrics.area_utilization * 100).toFixed(0)}%</strong>
            </div>
            <div className="metric">
              <span>Rooms Placed</span>
              <strong>{variant.metrics.room_count}</strong>
            </div>
            <div className="metric">
              <span>Total Area</span>
              <strong>{variant.metrics.total_placed_area.toFixed(1)} m²</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LayoutCanvas;
```

---

### STEP 9: Create CSS for Components

Create a new file: `frontend/src/components/LayoutGenerator.css`

**Copy & paste:**

```css
.layout-generator {
  display: flex;
  height: calc(100vh - 100px);
  gap: 20px;
  padding: 20px;
  background: #f5f5f5;
}

.sidebar {
  width: 300px;
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  overflow-y: auto;
}

.sidebar h2 {
  margin: 0 0 20px 0;
  font-size: 18px;
}

.sidebar h4 {
  margin: 15px 0 10px 0;
  font-size: 14px;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  font-size: 14px;
}

.form-group select,
.form-group input[type="range"] {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.form-group input[type="checkbox"] {
  margin-right: 8px;
  cursor: pointer;
}

.btn-primary {
  width: 100%;
  padding: 12px;
  background: #2196F3;
  color: white;
  border: none;
  border-radius: 4px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.3s;
}

.btn-primary:hover:not(:disabled) {
  background: #1976D2;
}

.btn-primary:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.error-message {
  margin-top: 15px;
  padding: 10px;
  background: #ffebee;
  color: #c62828;
  border-radius: 4px;
  font-size: 14px;
}

.main-content {
  flex: 1;
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  display: flex;
  flex-direction: column;
}

.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #999;
  font-size: 16px;
}
```

Create a new file: `frontend/src/components/LayoutCanvas.css`

**Copy & paste:**

```css
.layout-canvas-container {
  display: flex;
  flex-direction: column;
  gap: 15px;
  height: 100%;
}

.controls {
  padding: 15px;
  background: #f9f9f9;
  border-radius: 4px;
}

.controls h2 {
  margin: 0 0 10px 0;
  font-size: 16px;
}

.variant-selector {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.variant-selector button {
  padding: 8px 16px;
  background: #e0e0e0;
  border: 2px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.variant-selector button:hover {
  background: #d0d0d0;
}

.variant-selector button.active {
  background: #2196F3;
  color: white;
  border-color: #1976D2;
}

.layout-canvas {
  flex: 1;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  cursor: pointer;
}

.metrics {
  padding: 15px;
  background: #f9f9f9;
  border-radius: 4px;
}

.metrics h3 {
  margin: 0 0 10px 0;
  font-size: 14px;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.metric {
  padding: 10px;
  background: white;
  border-radius: 4px;
  text-align: center;
  border: 1px solid #e0e0e0;
}

.metric span {
  display: block;
  font-size: 12px;
  color: #666;
  margin-bottom: 5px;
}

.metric strong {
  display: block;
  font-size: 16px;
  color: #2196F3;
}

@media (max-width: 1200px) {
  .metric-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
```

---

### STEP 10: Add Component to Your Page

In your main layout/page component (e.g., `frontend/src/pages/DesignPage.jsx`):

**Add this import:**
```javascript
import LayoutGenerator from '../components/LayoutGenerator';
```

**Add this where you want the layout generator to appear:**
```javascript
<LayoutGenerator 
  plotGeojson={yourPlotGeoJSON}
  onLayoutUpdate={(data) => console.log('Layout generated:', data)}
/>
```

**Example full page:**
```javascript
import React, { useState } from 'react';
import LayoutGenerator from '../components/LayoutGenerator';

function DesignPage() {
  // You should get this from your plot data
  const [plotGeojson] = useState({
    type: 'Polygon',
    coordinates: [[[0,0], [20,0], [20,15], [0,15], [0,0]]]
  });

  return (
    <div className="design-page">
      <h1>Design Floor Plan</h1>
      <LayoutGenerator plotGeojson={plotGeojson} />
    </div>
  );
}

export default DesignPage;
```

---

## Verify Everything Works

### Test 1: Backend API (Terminal)

```bash
# Start your Flask app
python -m backend.app

# In another terminal, test:
curl -X POST http://localhost:5000/api/layouts/generate \
  -H "Content-Type: application/json" \
  -d '{
    "plot": {
      "type": "Polygon",
      "coordinates": [[[0,0], [20,0], [20,15], [0,15], [0,0]]]
    },
    "road_direction": "SOUTH",
    "num_bedrooms": 2,
    "variant_count": 2
  }'

# You should get JSON back with room layouts
```

### Test 2: Frontend Integration

1. Start your React app: `npm start`
2. Navigate to the Design page
3. Click "Generate Layout"
4. You should see the layout rendered in the canvas

---

## Checklist

```
Backend Setup:
☑ Copy 6 Python files to backend/services/
☑ Create layout_service.py
☑ Create layout_routes.py
☑ Update app.py (add 2 lines)
☑ Update requirements.txt (add 3 lines)
☑ Run: pip install -r requirements.txt
☑ Test with curl

Frontend Setup:
☑ Create LayoutGenerator.jsx
☑ Create LayoutCanvas.jsx
☑ Create LayoutGenerator.css
☑ Create LayoutCanvas.css
☑ Import in your main page
☑ Test in browser

Total time: 1-2 hours
```

---

## Common Issues & Fixes

### "ModuleNotFoundError: No module named 'networkx'"
**Fix:** Run `pip install -r requirements.txt`

### "No module named 'layout_engine'"
**Fix:** Make sure all 6 Python files are in `backend/services/`

### API returns 404
**Fix:** Make sure you registered the blueprint in app.py (Step 4)

### Frontend shows error
**Fix:** Check browser console for exact error, usually a missing file or incorrect import path

### Solver times out
**Fix:** Reduce variant_count in UI or increase time limit in code

---

## That's It! 🎉

You now have a fully integrated constraint-based layout engine in Antigravity.

**Next steps:**
1. Customize room programs for your needs
2. Add more layout variants
3. Export layouts to DXF/IFC
4. Gather user feedback

---

For more advanced customization, see:
- `QUICK_REFERENCE.md` - Common tasks
- `IMPLEMENTATION_GUIDE.md` - Advanced features
- Module docstrings - API details
