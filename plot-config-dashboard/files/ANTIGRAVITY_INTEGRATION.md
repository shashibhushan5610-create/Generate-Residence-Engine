# ANTIGRAVITY LAYOUT ENGINE - INTEGRATION GUIDE

## Overview

This guide shows how to integrate the constraint-based layout engine into the Antigravity platform, replacing the existing grid-template system.

---

## Integration Architecture

```
Antigravity UI
    ↓
Web API Layer (REST/GraphQL)
    ↓
Layout Request Handler
    ↓
LayoutEngine Orchestrator
    ├─ program_generator
    ├─ adjacency_graph
    ├─ zoning_solver
    ├─ packing_solver
    ├─ circulation_graph
    └─ layout_engine
    ↓
Layout Output (JSON)
    ↓
Canvas Renderer / CAD Export
```

---

## Step 1: Set Up Backend Environment

### 1.1 Install Dependencies

```bash
# In your Antigravity backend directory
pip install networkx shapely ortools

# Or use requirements.txt
pip install -r requirements.txt
```

### 1.2 Copy Layout Engine Files

```bash
# Assume your project structure is:
# antigravity/
#   backend/
#     services/
#     models/
#     api/

# Copy layout engine to services:
cp program_generator.py antigravity/backend/services/
cp adjacency_graph.py antigravity/backend/services/
cp zoning_solver.py antigravity/backend/services/
cp packing_solver.py antigravity/backend/services/
cp circulation_graph.py antigravity/backend/services/
cp layout_engine.py antigravity/backend/services/
```

### 1.3 Project Structure

```
antigravity/
├── backend/
│   ├── services/
│   │   ├── __init__.py
│   │   ├── layout_service.py              ← NEW: Wrapper service
│   │   ├── program_generator.py           ← Copied
│   │   ├── adjacency_graph.py
│   │   ├── zoning_solver.py
│   │   ├── packing_solver.py
│   │   ├── circulation_graph.py
│   │   └── layout_engine.py
│   ├── api/
│   │   ├── routes/
│   │   │   └── layout_routes.py           ← NEW: API endpoints
│   │   └── schemas/
│   │       └── layout_schemas.py          ← NEW: Request/response schemas
│   ├── models/
│   │   ├── plot.py
│   │   └── layout.py                      ← NEW: Layout result model
│   ├── config.py
│   ├── app.py                             ← Main Flask/FastAPI app
│   └── requirements.txt
└── frontend/
    └── ...
```

---

## Step 2: Create Layout Service Wrapper

Create `backend/services/layout_service.py`:

```python
"""
Layout Service Wrapper

Provides high-level interface to layout engine for Antigravity platform.
Handles plot conversion, error management, and result formatting.
"""

from typing import Dict, List, Optional, Tuple
from dataclasses import asdict
import logging
from shapely.geometry import Polygon, box, shape as geom_shape

from .layout_engine import LayoutEngine, RoadDirection, LayoutOutput
from .program_generator import RoomProgramGenerator

logger = logging.getLogger(__name__)


class LayoutService:
    """
    High-level service for generating architectural layouts.
    
    Integrates with Antigravity platform:
    - Converts plot GeoJSON to Shapely polygons
    - Manages layout generation with error handling
    - Formats output for canvas rendering
    - Caches results for performance
    """
    
    def __init__(self):
        """Initialize layout service."""
        self.engine = LayoutEngine()
        self.program_gen = RoomProgramGenerator()
        self._cache = {}  # Simple cache for layouts
    
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
            
        Raises:
            ValueError: Invalid input parameters
            RuntimeError: Layout generation failed
        """
        try:
            # Convert GeoJSON to Shapely polygon
            if 'features' in plot_geojson:
                # FeatureCollection
                feature = plot_geojson['features'][0]
                geom = feature['geometry']
            else:
                # Direct geometry
                geom = plot_geojson
            
            plot_polygon = geom_shape(geom)
            
            # Validate polygon
            if not plot_polygon.is_valid:
                raise ValueError("Plot polygon is invalid (self-intersecting or degenerate)")
            
            if plot_polygon.area < 50.0:
                raise ValueError(f"Plot too small: {plot_polygon.area:.1f} sqm (minimum 50 sqm)")
            
            # Convert road direction string to enum
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
                'message': 'Failed to generate layout. Try adjusting parameters.'
            }
    
    def _format_layout_output(
        self,
        layout: LayoutOutput,
        variant_index: int
    ) -> Dict:
        """
        Format layout output for API response.
        
        Args:
            layout: LayoutOutput from engine
            variant_index: Index in variants list
            
        Returns:
            Formatted dict ready for API response
        """
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
        """
        Get preview of room program without full layout generation.
        
        Useful for UI to show what rooms will be generated.
        
        Args:
            plot_area: Total plot area in sqm
            plot_width: Width in meters
            plot_height: Height in meters
            num_bedrooms: Number of bedrooms
            
        Returns:
            Dict with room program details
        """
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
    
    def validate_plot(
        self,
        plot_geojson: Dict
    ) -> Dict:
        """
        Validate plot geometry before full layout generation.
        
        Args:
            plot_geojson: GeoJSON plot geometry
            
        Returns:
            Dict with validation results
        """
        try:
            geom = (plot_geojson['features'][0]['geometry'] 
                   if 'features' in plot_geojson 
                   else plot_geojson)
            
            polygon = geom_shape(geom)
            
            return {
                'status': 'success',
                'valid': polygon.is_valid,
                'area': polygon.area,
                'bounds': list(polygon.bounds),
                'warnings': self._get_plot_warnings(polygon)
            }
        
        except Exception as e:
            return {
                'status': 'error',
                'message': str(e)
            }
    
    def _get_plot_warnings(self, polygon: Polygon) -> List[str]:
        """Get warnings about plot geometry."""
        warnings = []
        
        if polygon.area < 50:
            warnings.append("Plot very small (< 50 sqm)")
        
        if polygon.area > 1000:
            warnings.append("Plot very large (> 1000 sqm) - may take longer to solve")
        
        minx, miny, maxx, maxy = polygon.bounds
        width = maxx - minx
        height = maxy - miny
        
        aspect = max(width, height) / min(width, height)
        if aspect > 3:
            warnings.append("Plot very elongated - may have layout challenges")
        
        return warnings


# Factory function for dependency injection
def get_layout_service() -> LayoutService:
    """Get or create layout service instance."""
    return LayoutService()
```

---

## Step 3: Create API Routes

Create `backend/api/routes/layout_routes.py`:

```python
"""
Layout API Routes

REST endpoints for layout generation integrated with Antigravity.
"""

from flask import Blueprint, request, jsonify
from typing import Dict
import logging

from ...services.layout_service import get_layout_service

logger = logging.getLogger(__name__)
layout_bp = Blueprint('layouts', __name__, url_prefix='/api/layouts')


@layout_bp.route('/validate', methods=['POST'])
def validate_plot():
    """
    Validate plot geometry before generation.
    
    POST /api/layouts/validate
    {
        "plot": {GeoJSON geometry}
    }
    
    Returns:
        {
            "status": "success",
            "valid": true,
            "area": 300.0,
            "bounds": [0, 0, 20, 15],
            "warnings": []
        }
    """
    try:
        data = request.json
        plot_geojson = data.get('plot')
        
        if not plot_geojson:
            return jsonify({'error': 'Missing plot parameter'}), 400
        
        service = get_layout_service()
        result = service.validate_plot(plot_geojson)
        
        return jsonify(result)
    
    except Exception as e:
        logger.error(f"Validation error: {e}")
        return jsonify({'error': 'Validation failed'}), 500


@layout_bp.route('/preview-program', methods=['POST'])
def preview_program():
    """
    Preview room program for given plot dimensions.
    
    POST /api/layouts/preview-program
    {
        "plot_area": 300,
        "plot_width": 20,
        "plot_height": 15,
        "num_bedrooms": 2
    }
    
    Returns:
        {
            "status": "success",
            "program": {
                "rooms": [...],
                "summary": {...}
            }
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
    Generate floor layouts for a plot.
    
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
    
    Returns:
        {
            "status": "success",
            "plot": {...},
            "variants": [
                {
                    "variant_id": "variant_0",
                    "rank": 1,
                    "metrics": {...},
                    "rooms": [...],
                    "corridors": [...],
                    "zones": [...]
                },
                ...
            ]
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


@layout_bp.route('/export/<variant_id>', methods=['GET'])
def export_layout(variant_id: str):
    """
    Export layout as DXF, IFC, or other format.
    
    GET /api/layouts/export/variant_0?format=dxf
    
    Returns:
        Binary file (DXF, IFC, etc.)
    """
    format_type = request.args.get('format', 'dxf').lower()
    
    # TODO: Implement format-specific export
    # For now, return placeholder
    
    return jsonify({'error': 'Export not yet implemented'}), 501


# Route registration
def register_layout_routes(app):
    """Register layout routes with Flask app."""
    app.register_blueprint(layout_bp)
```

---

## Step 4: Integrate with Main App

Update `backend/app.py`:

```python
"""
Antigravity Backend Application
"""

from flask import Flask
from flask_cors import CORS
import logging

from .api.routes.layout_routes import register_layout_routes
from .config import Config

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def create_app(config=None):
    """Create and configure Flask application."""
    
    app = Flask(__name__)
    
    # Load configuration
    app.config.from_object(config or Config)
    
    # Enable CORS for frontend
    CORS(app)
    
    # Register blueprints
    register_layout_routes(app)
    
    # TODO: Register other routes
    # from .api.routes.plot_routes import register_plot_routes
    # register_plot_routes(app)
    
    # Health check endpoint
    @app.route('/health', methods=['GET'])
    def health():
        return {'status': 'ok', 'service': 'antigravity-layout-api'}
    
    logger.info("Antigravity backend initialized")
    
    return app


if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, host='0.0.0.0', port=5000)
```

---

## Step 5: Create Request/Response Schemas

Create `backend/api/schemas/layout_schemas.py`:

```python
"""
Layout API Request/Response Schemas

Pydantic models for request validation and response serialization.
"""

from pydantic import BaseModel, Field, validator
from typing import List, Dict, Optional
from enum import Enum


class RoadDirectionEnum(str, Enum):
    """Road direction options."""
    NORTH = "NORTH"
    SOUTH = "SOUTH"
    EAST = "EAST"
    WEST = "WEST"


class PlotValidateRequest(BaseModel):
    """Request to validate plot geometry."""
    plot: Dict = Field(..., description="GeoJSON geometry")


class PlotValidateResponse(BaseModel):
    """Response from plot validation."""
    status: str
    valid: bool
    area: float
    bounds: List[float]
    warnings: List[str]


class ProgramPreviewRequest(BaseModel):
    """Request to preview room program."""
    plot_area: float = Field(200, ge=50, le=1000)
    plot_width: float = Field(15, ge=5)
    plot_height: float = Field(13.3, ge=5)
    num_bedrooms: int = Field(2, ge=1, le=4)


class RoomObject(BaseModel):
    """Room geometry object."""
    name: str
    x: float
    y: float
    width: float
    height: float
    area: float
    zone_type: Optional[str]


class CorridorObject(BaseModel):
    """Corridor geometry object."""
    id: str
    from_room: str = Field(..., alias='from')
    to_room: str = Field(..., alias='to')
    length: float
    width: float
    coordinates: List[List[float]]


class ZoneObject(BaseModel):
    """Zone geometry object."""
    type: str
    area: float
    bounds: List[float]
    preferred_rooms: List[str]


class MetricsObject(BaseModel):
    """Layout quality metrics."""
    total_placed_area: float
    room_count: int
    corridor_count: int
    quality_score: float
    area_utilization: float
    adjacency_satisfaction: float
    zone_preference_adherence: float


class LayoutVariant(BaseModel):
    """Single layout variant."""
    variant_id: str
    rank: int
    total_variants: int
    metrics: MetricsObject
    rooms: List[RoomObject]
    corridors: List[CorridorObject]
    zones: List[ZoneObject]
    circulation: Dict


class LayoutGenerateRequest(BaseModel):
    """Request to generate layouts."""
    plot: Dict = Field(..., description="GeoJSON geometry")
    road_direction: RoadDirectionEnum = Field(RoadDirectionEnum.SOUTH)
    num_bedrooms: int = Field(2, ge=1, le=4)
    include_parking: bool = Field(True)
    setback_front: float = Field(1.5, ge=0.5, le=5)
    setback_rear: float = Field(2.0, ge=0.5, le=5)
    setback_sides: float = Field(1.5, ge=0.5, le=5)
    variant_count: int = Field(3, ge=1, le=5)


class LayoutGenerateResponse(BaseModel):
    """Response from layout generation."""
    status: str
    plot: Optional[Dict]
    variants: Optional[List[LayoutVariant]]
    error: Optional[str]
    message: Optional[str]
```

---

## Step 6: Update Canvas Renderer

Update your canvas/rendering component to handle new layout format:

```javascript
// frontend/src/components/LayoutCanvas.jsx

import React, { useState } from 'react';

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

    const scale = Math.min(
      width / plotWidth,
      height / plotHeight
    ) * 0.9;

    const offsetX = (width - plotWidth * scale) / 2;
    const offsetY = (height - plotHeight * scale) / 2;

    // Helper function to transform coordinates
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
    ctx.lineWidth = variant.corridors[0]?.width * scale || 2;

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
              Variant {idx + 1} - Score: {(v.metrics.quality_score * 100).toFixed(0)}%
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

## Step 7: Create UI Component for Layout Generation

Create a React component for input:

```javascript
// frontend/src/components/LayoutGenerator.jsx

import React, { useState } from 'react';
import LayoutCanvas from './LayoutCanvas';

function LayoutGenerator({ plotGeojson }) {
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
          <label>Variants to Generate: {params.variant_count}</label>
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
          disabled={loading}
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
            <p>Configure parameters and click "Generate Layout" to create floor plans</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default LayoutGenerator;
```

---

## Step 8: Configuration

Update `backend/config.py`:

```python
"""
Antigravity Configuration
"""

import os
from datetime import timedelta

class Config:
    """Base configuration."""
    
    # Flask
    DEBUG = os.getenv('DEBUG', False)
    TESTING = os.getenv('TESTING', False)
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-key-change-in-production')
    
    # CORS
    CORS_ORIGINS = ["http://localhost:3000", "http://localhost:8080"]
    
    # Layout engine
    LAYOUT_ENGINE = {
        'time_limit_seconds': 30,
        'num_workers': 8,
        'grid_resolutions': [1.0, 0.5, 0.25]
    }
    
    # Caching
    CACHE_TYPE = 'simple'
    CACHE_DEFAULT_TIMEOUT = 300
    
    # Logging
    LOG_LEVEL = 'INFO'
    LOG_FILE = 'logs/antigravity.log'


class DevelopmentConfig(Config):
    """Development configuration."""
    DEBUG = True


class ProductionConfig(Config):
    """Production configuration."""
    DEBUG = False
    CORS_ORIGINS = ["https://antigravity.io"]


class TestingConfig(Config):
    """Testing configuration."""
    TESTING = True
    LAYOUT_ENGINE = {
        'time_limit_seconds': 5,  # Faster for tests
        'num_workers': 2,
        'grid_resolutions': [1.0]
    }
```

---

## Step 9: Database Models (Optional)

Create `backend/models/layout.py` to store layouts:

```python
"""
Layout Database Models
"""

from datetime import datetime
from enum import Enum
import json


class LayoutStatus(str, Enum):
    """Layout generation status."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class Layout:
    """
    Represents a generated floor layout.
    
    In production, use SQLAlchemy or your ORM of choice.
    This is simplified for example.
    """
    
    def __init__(
        self,
        plot_id: str,
        variant_data: dict,
        variant_rank: int,
        road_direction: str,
        num_bedrooms: int
    ):
        self.id = f"{plot_id}_{variant_rank}"
        self.plot_id = plot_id
        self.variant_rank = variant_rank
        self.road_direction = road_direction
        self.num_bedrooms = num_bedrooms
        self.status = LayoutStatus.COMPLETED
        self.created_at = datetime.utcnow()
        
        # Geometry data
        self.rooms = variant_data.get('rooms', [])
        self.corridors = variant_data.get('corridors', [])
        self.zones = variant_data.get('zones', [])
        self.metrics = variant_data.get('metrics', {})
    
    def to_dict(self):
        """Convert to dictionary for serialization."""
        return {
            'id': self.id,
            'plot_id': self.plot_id,
            'variant_rank': self.variant_rank,
            'road_direction': self.road_direction,
            'num_bedrooms': self.num_bedrooms,
            'status': self.status.value,
            'created_at': self.created_at.isoformat(),
            'rooms': self.rooms,
            'corridors': self.corridors,
            'zones': self.zones,
            'metrics': self.metrics
        }
```

---

## Step 10: Deployment

### Docker Setup

Create `Dockerfile`:

```dockerfile
FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Set environment
ENV PYTHONUNBUFFERED=1
ENV FLASK_ENV=production

# Run application
CMD ["python", "-m", "backend.app"]
```

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  backend:
    build: .
    ports:
      - "5000:5000"
    environment:
      DEBUG: 'False'
      FLASK_ENV: production
    volumes:
      - ./logs:/app/logs

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    depends_on:
      - backend
```

---

## Integration Checklist

### Backend
- [ ] Copy layout engine files to `backend/services/`
- [ ] Create `layout_service.py`
- [ ] Create API routes in `layout_routes.py`
- [ ] Add schemas to `layout_schemas.py`
- [ ] Register routes in `app.py`
- [ ] Update `requirements.txt` with dependencies
- [ ] Test API endpoints with Postman/curl
- [ ] Add database models (optional)

### Frontend
- [ ] Create `LayoutGenerator.jsx` component
- [ ] Create `LayoutCanvas.jsx` component
- [ ] Add routing to layout page
- [ ] Style components
- [ ] Test with backend API
- [ ] Add error handling UI
- [ ] Add loading indicators

### DevOps
- [ ] Create Dockerfile
- [ ] Create docker-compose.yml
- [ ] Set up CI/CD pipeline
- [ ] Configure logging
- [ ] Set up monitoring

### Testing
- [ ] Unit tests for services
- [ ] Integration tests for API
- [ ] UI component tests
- [ ] E2E tests

---

## Example Usage

### 1. Backend Test

```python
# test_layout_service.py

from backend.services.layout_service import LayoutService
from shapely.geometry import box

service = LayoutService()

# Test with simple rectangular plot
plot = box(0, 0, 20, 15)
plot_geojson = {
    'type': 'Polygon',
    'coordinates': [[[0,0], [20,0], [20,15], [0,15], [0,0]]]
}

result = service.generate_layout_from_geojson(
    plot_geojson=plot_geojson,
    road_direction='SOUTH',
    num_bedrooms=2,
    variant_count=3
)

print(f"Status: {result['status']}")
print(f"Variants: {len(result['variants'])}")
for variant in result['variants']:
    print(f"  Variant {variant['rank']}: {variant['metrics']['quality_score']:.1%}")
```

### 2. Frontend Test

```javascript
// Example in React component

const [plotGeojson] = useState({
  type: 'Polygon',
  coordinates: [[[0,0], [20,0], [20,15], [0,15], [0,0]]]
});

return <LayoutGenerator plotGeojson={plotGeojson} />;
```

### 3. API Test with curl

```bash
# Generate layout
curl -X POST http://localhost:5000/api/layouts/generate \
  -H "Content-Type: application/json" \
  -d '{
    "plot": {
      "type": "Polygon",
      "coordinates": [[[0,0], [20,0], [20,15], [0,15], [0,0]]]
    },
    "road_direction": "SOUTH",
    "num_bedrooms": 2,
    "include_parking": true,
    "variant_count": 3
  }'

# Validate plot
curl -X POST http://localhost:5000/api/layouts/validate \
  -H "Content-Type: application/json" \
  -d '{
    "plot": {
      "type": "Polygon",
      "coordinates": [[[0,0], [20,0], [20,15], [0,15], [0,0]]]
    }
  }'
```

---

## Troubleshooting Integration

### Issue: ImportError for layout modules

**Solution:**
```bash
# Ensure files are in correct directory
ls -la backend/services/layout_engine.py

# Add to __init__.py
echo "from .layout_engine import LayoutEngine" > backend/services/__init__.py
```

### Issue: OR-Tools installation fails

**Solution:**
```bash
# Install with specific version
pip install ortools==9.7.2996

# Or build from source
pip install --upgrade ortools --no-binary=ortools
```

### Issue: Solver times out

**Solution:**
```python
# Increase timeout in config.py
LAYOUT_ENGINE = {
    'time_limit_seconds': 60  # Increased from 30
}

# Or use coarser grid
solution = solver.solve(
    rooms, buildable, zones, graph,
    grid_resolution=1.0  # Faster
)
```

### Issue: Layout generation fails for large plots

**Solution:**
```python
# Use fewer variants
variant_count=1

# Reduce number of bedrooms
num_bedrooms=2

# Relax setbacks
setback_front=0.5
```

---

## Performance Optimization

### Caching Layouts

```python
# In layout_service.py

def _get_cache_key(self, params: Dict) -> str:
    """Generate cache key for layout parameters."""
    import hashlib
    key_str = json.dumps(params, sort_keys=True)
    return hashlib.md5(key_str.encode()).hexdigest()

def generate_layout_from_geojson(self, ...):
    cache_key = self._get_cache_key({...})
    
    if cache_key in self._cache:
        return self._cache[cache_key]
    
    # Generate...
    
    self._cache[cache_key] = result
    return result
```

### Async Generation

```python
# Use Celery for async tasks
from celery import shared_task

@shared_task
def generate_layout_async(plot_geojson, params):
    """Generate layout asynchronously."""
    service = LayoutService()
    return service.generate_layout_from_geojson(
        plot_geojson=plot_geojson,
        **params
    )

# In route
@layout_bp.route('/generate-async', methods=['POST'])
def generate_layout_async():
    data = request.json
    task = generate_layout_async.delay(
        data['plot'],
        data
    )
    return jsonify({'task_id': task.id})
```

---

## Next Steps

1. **Copy layout engine files** to your backend
2. **Create layout service wrapper** (`layout_service.py`)
3. **Add API routes** (`layout_routes.py`)
4. **Build frontend components** (generator, canvas)
5. **Test end-to-end** with sample plots
6. **Deploy** with Docker
7. **Monitor** and optimize solver performance
8. **Gather feedback** for customization

---

## Support Resources

- **Layout Engine Docs:** See `README.md`
- **Quick Reference:** See `QUICK_REFERENCE.md`
- **Implementation Guide:** See `IMPLEMENTATION_GUIDE.md`

---

**Happy integrating! 🎉**

This integration transforms Antigravity from a grid-template system into a state-of-the-art constraint-based architectural layout generator.
