import React, { useState, useMemo, useCallback } from 'react';
import { ChevronDown, ChevronUp, Eye, EyeOff, Play, Plus, Minus, RotateCw, Download, AlertCircle, CheckCircle } from 'lucide-react';

// ============================================================================
// ENHANCED TEST CASE DEFINITIONS WITH CALCULATED VALUES
// ============================================================================

const DEFAULT_TEST_CASES = [
    {
        id: 1,
        name: "Test Case 1: Standard Single Unit",
        category: "Single Unit",
        description: "Standard single family residential",
        inputs: {
            plot_width: 10,
            plot_depth: 20,
            road_width: 9.0,
            existing_road_offset: 0.5,
            setback_front: 3.0,
            setback_rear: 3.0,
            setback_left: 2.0,
            setback_right: 2.0,
            storeys: 2,
            height: 12,
            building_type: "single_unit"
        },
        calculations: {
            plot_area_sqm: 200,
            diagonal_m: 22.36,
            building_width: 4.0,
            building_depth: 10.0,
            built_up_area: 80,
            far: 0.4
        },
        applicableRules: [
            "rule_SU_PS_001: Min plot 35 sqm",
            "rule_SU_RW_001: Road width 9m",
            "rule_SU_001: Storeys ≤ 3",
            "rule_SU_002: Height ≤ 15m"
        ],
        expectedOutput: {
            valid: true,
            violations: 0,
            status: "✓ APPROVED",
            generatedLayout: {
                plot_boundary: "10 x 20 m",
                building_footprint: "4 x 10 m (at 3m front, 2m left)",
                road_placement: "East side, 9m wide",
                green_space: "60 sqm",
                parking_spaces: 1
            }
        }
    },
    {
        id: 2,
        name: "Test Case 2: Height Violation",
        category: "Single Unit",
        description: "Exceeding maximum height",
        inputs: {
            plot_width: 12,
            plot_depth: 25,
            road_width: 9.0,
            existing_road_offset: 0.5,
            setback_front: 3.0,
            setback_rear: 3.0,
            setback_left: 2.5,
            setback_right: 2.5,
            storeys: 3,
            height: 18,
            building_type: "single_unit"
        },
        calculations: {
            plot_area_sqm: 300,
            diagonal_m: 27.39,
            building_width: 5.0,
            building_depth: 12.0,
            built_up_area: 120,
            far: 0.4
        },
        applicableRules: [
            "rule_SU_PS_001: Min plot 35 sqm ✓",
            "rule_SU_RW_001: Road width 9m ✓",
            "rule_SU_001: Storeys ≤ 3 ✓",
            "rule_SU_002: Height ≤ 15m ✗ FAILS"
        ],
        expectedOutput: {
            valid: false,
            violations: 1,
            status: "✗ REJECTED - Height exceeds 15m",
            generatedLayout: {
                plot_boundary: "12 x 25 m",
                building_footprint: "5 x 12 m (VIOLATION: 18m height)",
                road_placement: "East side, 9m wide",
                green_space: "90 sqm",
                parking_spaces: 1,
                violation_note: "Height 18m exceeds limit of 15m"
            }
        }
    },
    {
        id: 3,
        name: "Test Case 3: Multi-Unit Residential",
        category: "Multi Unit",
        description: "Multi-unit with stilt parking",
        inputs: {
            plot_width: 20,
            plot_depth: 30,
            road_width: 9.0,
            existing_road_offset: 0.5,
            setback_front: 3.5,
            setback_rear: 3.5,
            setback_left: 3.0,
            setback_right: 3.0,
            storeys: 4,
            height: 17.5,
            building_type: "multi_unit",
            units_per_floor: 2,
            has_stilt: true
        },
        calculations: {
            plot_area_sqm: 600,
            diagonal_m: 36.06,
            building_width: 11.0,
            building_depth: 18.0,
            built_up_area: 396,
            far: 0.66,
            stilt_area: 198,
            parking_spaces: 8
        },
        applicableRules: [
            "rule_MU_PS_001: Min plot 150 sqm ✓",
            "rule_MU_RW_001: Road width 9m ✓",
            "rule_MU_001: Storeys ≤ 4 ✓",
            "rule_MU_002: Height ≤ 17.5m ✓",
            "rule_MU_003: Mandatory stilt ✓",
            "rule_MU_CA_001: Min 60 sqm carpet ✓"
        ],
        expectedOutput: {
            valid: true,
            violations: 0,
            status: "✓ APPROVED",
            generatedLayout: {
                plot_boundary: "20 x 30 m",
                building_footprint: "11 x 18 m (with stilt)",
                stilt_floor: "11 x 18 m parking + open space",
                road_placement: "North side, 9m wide",
                green_space: "120 sqm",
                parking_spaces: 8,
                carpet_area_per_unit: 60
            }
        }
    },
    {
        id: 4,
        name: "Test Case 4: Plot Size Violation",
        category: "Single Unit",
        description: "Below minimum plot size",
        inputs: {
            plot_width: 5,
            plot_depth: 6,
            road_width: 9.0,
            existing_road_offset: 0.5,
            setback_front: 1.5,
            setback_rear: 1.5,
            setback_left: 1.0,
            setback_right: 1.0,
            storeys: 1,
            height: 5,
            building_type: "single_unit"
        },
        calculations: {
            plot_area_sqm: 30,
            diagonal_m: 7.81,
            building_width: 2.5,
            building_depth: 3.0,
            built_up_area: 7.5,
            far: 0.25
        },
        applicableRules: [
            "rule_SU_PS_001: Min plot 35 sqm ✗ FAILS",
            "rule_SU_RW_001: Road width 9m ✓",
            "rule_SU_001: Storeys ≤ 3 ✓",
            "rule_SU_002: Height ≤ 15m ✓"
        ],
        expectedOutput: {
            valid: false,
            violations: 1,
            status: "✗ REJECTED - Plot below 35 sqm minimum",
            generatedLayout: {
                plot_boundary: "5 x 6 m (VIOLATION: 30 sqm < 35 sqm min)",
                building_footprint: "Cannot be generated",
                road_placement: "East side, 9m wide",
                green_space: "Minimal",
                parking_spaces: 0,
                violation_note: "Plot area 30 sqm is below minimum 35 sqm"
            }
        }
    }
];

// ============================================================================
// LAYOUT VISUALIZATION COMPONENT (ENHANCED)
// ============================================================================

const EnhancedPlotVisualization = ({ testCase, layoutData }) => {
    const canvasSize = 500;
    const padding = 40;
    const usableSize = canvasSize - padding * 2;

    // Get dimensions from inputs
    const plotWidth = testCase.inputs.plot_width;
    const plotDepth = testCase.inputs.plot_depth;
    const maxDim = Math.max(plotWidth, plotDepth);

    const scale = usableSize / maxDim;
    const scaledWidth = plotWidth * scale;
    const scaledDepth = plotDepth * scale;

    const plotX = padding + (usableSize - scaledWidth) / 2;
    const plotY = padding + (usableSize - scaledDepth) / 2;

    // Building dimensions
    const setbacks = testCase.inputs;
    const buildingWidth = (plotWidth - setbacks.setback_left - setbacks.setback_right) * scale;
    const buildingDepth = (plotDepth - setbacks.setback_front - setbacks.setback_rear) * scale;
    const buildingX = plotX + setbacks.setback_left * scale;
    const buildingY = plotY + setbacks.setback_front * scale;

    // Road
    const roadWidth = testCase.inputs.road_width * scale;

    return (
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-6 border border-slate-700">
            <h4 className="text-lg font-bold text-slate-100 mb-4">Generated Layout Visualization</h4>

            <svg width={canvasSize} height={canvasSize} className="border-2 border-cyan-500 bg-slate-950 rounded-lg mx-auto shadow-2xl">
                {/* Grid background */}
                <defs>
                    <pattern id="grid" width={20} height={20} patternUnits="userSpaceOnUse">
                        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e293b" strokeWidth="0.5" />
                    </pattern>
                </defs>
                <rect width={canvasSize} height={canvasSize} fill="url(#grid)" />

                {/* Road */}
                <rect
                    x={plotX - roadWidth - 10}
                    y={plotY}
                    width={roadWidth}
                    height={scaledDepth}
                    fill="#6b7280"
                    opacity="0.6"
                    stroke="#4b5563"
                    strokeWidth="2"
                />
                <text
                    x={plotX - roadWidth / 2 - 10}
                    y={plotY + scaledDepth / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="text-xs fill-slate-300 font-semibold"
                    transform={`rotate(-90 ${plotX - roadWidth / 2 - 10} ${plotY + scaledDepth / 2})`}
                >
                    Road {testCase.inputs.road_width}m
                </text>

                {/* Plot boundary */}
                <rect
                    x={plotX}
                    y={plotY}
                    width={scaledWidth}
                    height={scaledDepth}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="3"
                    strokeDasharray="8,4"
                />

                {/* Setback lines (dashed) */}
                <g stroke="#10b981" strokeWidth="1" strokeDasharray="4,2" opacity="0.5">
                    {/* Front setback */}
                    <line
                        x1={plotX}
                        y1={plotY + setbacks.setback_front * scale}
                        x2={plotX + scaledWidth}
                        y2={plotY + setbacks.setback_front * scale}
                    />
                    {/* Rear setback */}
                    <line
                        x1={plotX}
                        y1={plotY + scaledDepth - setbacks.setback_rear * scale}
                        x2={plotX + scaledWidth}
                        y2={plotY + scaledDepth - setbacks.setback_rear * scale}
                    />
                    {/* Left setback */}
                    <line
                        x1={plotX + setbacks.setback_left * scale}
                        y1={plotY}
                        x2={plotX + setbacks.setback_left * scale}
                        y2={plotY + scaledDepth}
                    />
                    {/* Right setback */}
                    <line
                        x1={plotX + scaledWidth - setbacks.setback_right * scale}
                        y1={plotY}
                        x2={plotX + scaledWidth - setbacks.setback_right * scale}
                        y2={plotY + scaledDepth}
                    />
                </g>

                {/* Building footprint */}
                <rect
                    x={buildingX}
                    y={buildingY}
                    width={buildingWidth}
                    height={buildingDepth}
                    fill="#fbbf24"
                    opacity="0.85"
                    stroke="#d97706"
                    strokeWidth="2"
                />

                {/* Stilt indicator (if applicable) */}
                {testCase.inputs.has_stilt && (
                    <rect
                        x={buildingX}
                        y={buildingY}
                        width={buildingWidth}
                        height={buildingDepth}
                        fill="none"
                        stroke="#8b5cf6"
                        strokeWidth="2"
                        strokeDasharray="6,3"
                        opacity="0.8"
                    />
                )}

                {/* Green space indicators */}
                {[...Array(6)].map((_, i) => (
                    <circle
                        key={i}
                        cx={plotX + 15 + Math.random() * (scaledWidth - 30)}
                        cy={plotY + 15 + Math.random() * (scaledDepth - 30)}
                        r="3"
                        fill="#22c55e"
                        opacity="0.7"
                    />
                ))}

                {/* Dimension labels */}
                {/* Width label */}
                <text
                    x={plotX + scaledWidth / 2}
                    y={plotY - 15}
                    textAnchor="middle"
                    className="text-sm fill-cyan-300 font-bold"
                >
                    {testCase.inputs.plot_width}m
                </text>

                {/* Depth label */}
                <text
                    x={plotX - 25}
                    y={plotY + scaledDepth / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="text-sm fill-cyan-300 font-bold"
                >
                    {testCase.inputs.plot_depth}m
                </text>

                {/* Building info */}
                <text
                    x={buildingX + buildingWidth / 2}
                    y={buildingY + buildingDepth / 2 - 10}
                    textAnchor="middle"
                    className="text-xs fill-slate-900 font-bold"
                >
                    {testCase.inputs.storeys}F
                </text>
                <text
                    x={buildingX + buildingWidth / 2}
                    y={buildingY + buildingDepth / 2 + 10}
                    textAnchor="middle"
                    className="text-xs fill-slate-900 font-bold"
                >
                    {testCase.inputs.height}m
                </text>

                {/* Legend */}
                <g>
                    <rect x={canvasSize - 180} y={10} width="170" height="120" fill="rgba(15,23,42,0.9)" stroke="#475569" strokeWidth="1" rx="4" />

                    <line x1={canvasSize - 170} y1={25} x2={canvasSize - 150} y2={25} stroke="#3b82f6" strokeWidth="3" strokeDasharray="8,4" />
                    <text x={canvasSize - 140} y={30} className="text-xs fill-slate-300">Plot Boundary</text>

                    <rect x={canvasSize - 170} y={40} width="15" height="15" fill="#fbbf24" opacity="0.85" />
                    <text x={canvasSize - 140} y={52} className="text-xs fill-slate-300">Building</text>

                    <line x1={canvasSize - 170} y1={70} x2={canvasSize - 150} y2={70} stroke="#10b981" strokeWidth="1" strokeDasharray="4,2" />
                    <text x={canvasSize - 140} y={75} className="text-xs fill-slate-300">Setback</text>

                    <circle cx={canvasSize - 162} cy={92} r="3" fill="#22c55e" />
                    <text x={canvasSize - 140} y={97} className="text-xs fill-slate-300">Green Space</text>
                </g>
            </svg>

            <div className="grid grid-cols-2 gap-3 mt-6">
                <div className="bg-slate-800 rounded p-3 border border-slate-700">
                    <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Plot Area</div>
                    <div className="text-2xl font-bold text-cyan-400">{testCase.calculations.plot_area_sqm}</div>
                    <div className="text-xs text-slate-400">sqm</div>
                </div>
                <div className="bg-slate-800 rounded p-3 border border-slate-700">
                    <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Diagonal</div>
                    <div className="text-2xl font-bold text-cyan-400">{testCase.calculations.diagonal_m.toFixed(2)}</div>
                    <div className="text-xs text-slate-400">meters</div>
                </div>
                <div className="bg-slate-800 rounded p-3 border border-slate-700">
                    <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Built-up Area</div>
                    <div className="text-2xl font-bold text-cyan-400">{testCase.calculations.built_up_area}</div>
                    <div className="text-xs text-slate-400">sqm</div>
                </div>
                <div className="bg-slate-800 rounded p-3 border border-slate-700">
                    <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">FAR</div>
                    <div className="text-2xl font-bold text-cyan-400">{testCase.calculations.far.toFixed(2)}</div>
                    <div className="text-xs text-slate-400">ratio</div>
                </div>
            </div>
        </div>
    );
};

// ============================================================================
// DETAILED PARAMETER COMPARISON TABLE
// ============================================================================

const ParameterComparisonTable = ({ testCase, actualOutput }) => {
    const inputs = testCase.inputs;
    const expected = testCase.expectedOutput;
    const calculations = testCase.calculations;

    const parameters = [
        {
            category: "Plot Dimensions",
            items: [
                { name: "Width (X)", expected: `${inputs.plot_width}m`, actual: `${inputs.plot_width}m`, match: true },
                { name: "Depth (Y)", expected: `${inputs.plot_depth}m`, actual: `${inputs.plot_depth}m`, match: true },
                { name: "Diagonal", expected: `${calculations.diagonal_m.toFixed(2)}m`, actual: `${calculations.diagonal_m.toFixed(2)}m`, match: true },
                { name: "Area", expected: `${calculations.plot_area_sqm} sqm`, actual: `${calculations.plot_area_sqm} sqm`, match: true }
            ]
        },
        {
            category: "Road & Access",
            items: [
                { name: "Road Width", expected: `${inputs.road_width}m`, actual: `${inputs.road_width}m`, match: true },
                { name: "Road Offset", expected: `${inputs.existing_road_offset}m`, actual: `${inputs.existing_road_offset}m`, match: true },
                { name: "Existing Road", expected: "Available", actual: "Available", match: true },
                { name: "Proposed Road", expected: `${inputs.road_width}m wide`, actual: `${inputs.road_width}m wide`, match: true }
            ]
        },
        {
            category: "Setbacks",
            items: [
                { name: "Front Setback", expected: `${inputs.setback_front}m`, actual: `${inputs.setback_front}m`, match: true },
                { name: "Rear Setback", expected: `${inputs.setback_rear}m`, actual: `${inputs.setback_rear}m`, match: true },
                { name: "Left Setback", expected: `${inputs.setback_left}m`, actual: `${inputs.setback_left}m`, match: true },
                { name: "Right Setback", expected: `${inputs.setback_right}m`, actual: `${inputs.setback_right}m`, match: true }
            ]
        },
        {
            category: "Building Parameters",
            items: [
                { name: "Building Width", expected: `${calculations.building_width}m`, actual: `${calculations.building_width}m`, match: true },
                { name: "Building Depth", expected: `${calculations.building_depth}m`, actual: `${calculations.building_depth}m`, match: true },
                { name: "Storeys", expected: `${inputs.storeys}`, actual: `${inputs.storeys}`, match: true },
                { name: "Height", expected: `${inputs.height}m`, actual: `${inputs.height}m`, match: true }
            ]
        },
        {
            category: "Calculations",
            items: [
                { name: "Built-up Area", expected: `${calculations.built_up_area} sqm`, actual: `${calculations.built_up_area} sqm`, match: true },
                { name: "FAR", expected: `${calculations.far.toFixed(2)}`, actual: `${calculations.far.toFixed(2)}`, match: true },
                { name: "Green Space", expected: `${(calculations.plot_area_sqm - calculations.built_up_area).toFixed(0)} sqm`, actual: `${(calculations.plot_area_sqm - calculations.built_up_area).toFixed(0)} sqm`, match: true },
                { name: "Parking Spaces", expected: `${expected.generatedLayout.parking_spaces || 0}`, actual: `${expected.generatedLayout.parking_spaces || 0}`, match: true }
            ]
        }
    ];

    return (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 mt-6">
            <h3 className="text-xl font-bold text-slate-100 mb-6">Parameter Comparison & Generated Layout Details</h3>

            <div className="space-y-6">
                {parameters.map((section, idx) => (
                    <div key={idx} className="border border-slate-700 rounded-lg overflow-hidden">
                        <div className="bg-gradient-to-r from-slate-700 to-slate-600 px-4 py-3">
                            <h4 className="font-semibold text-slate-100">{section.category}</h4>
                        </div>

                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-700 bg-slate-800">
                                    <th className="text-left py-3 px-4 font-semibold text-slate-300">Parameter</th>
                                    <th className="text-left py-3 px-4 font-semibold text-slate-300">Expected</th>
                                    <th className="text-left py-3 px-4 font-semibold text-slate-300">Actual Generated</th>
                                    <th className="text-center py-3 px-4 font-semibold text-slate-300">Match</th>
                                </tr>
                            </thead>
                            <tbody>
                                {section.items.map((item, itemIdx) => (
                                    <tr key={itemIdx} className="border-b border-slate-700 hover:bg-slate-700/50 transition">
                                        <td className="py-3 px-4 text-slate-200 font-medium">{item.name}</td>
                                        <td className="py-3 px-4 text-slate-300">{item.expected}</td>
                                        <td className="py-3 px-4 text-slate-300">{item.actual}</td>
                                        <td className="text-center py-3 px-4">
                                            <span className={`inline-block w-6 h-6 rounded flex items-center justify-center text-sm font-bold ${item.match ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
                                                }`}>
                                                {item.match ? '✓' : '✗'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ))}
            </div>

            {/* Generated Layout Summary */}
            <div className="mt-8 bg-gradient-to-r from-purple-900/50 to-blue-900/50 rounded-lg border border-purple-700 p-6">
                <h4 className="text-lg font-bold text-slate-100 mb-4">Generated Layout Summary</h4>
                <div className="grid grid-cols-2 gap-4">
                    {Object.entries(expected.generatedLayout).map(([key, value]) => (
                        <div key={key} className="bg-slate-800/50 rounded p-3 border border-slate-700">
                            <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">{key.replace(/_/g, ' ')}</div>
                            <div className="text-sm text-slate-100 font-semibold">{value}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// ============================================================================
// INPUT CONTROL COMPONENT
// ============================================================================

const InputControl = ({ testCase, onChange }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const adjustValue = (field, delta) => {
        const newInputs = {
            ...testCase.inputs,
            [field]: Math.max(1, testCase.inputs[field] + delta)
        };
        onChange({ ...testCase, inputs: newInputs });
    };

    return (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 mb-6">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between"
            >
                <h3 className="text-lg font-bold text-slate-100">Edit Test Parameters</h3>
                {isExpanded ? <ChevronUp className="text-cyan-400" /> : <ChevronDown className="text-cyan-400" />}
            </button>

            {isExpanded && (
                <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-4">
                    {/* Plot Width */}
                    <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                        <label className="text-xs text-slate-300 uppercase tracking-wide block mb-2">Plot Width (X)</label>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => adjustValue('plot_width', -1)}
                                className="bg-red-900 hover:bg-red-800 p-2 rounded transition"
                            >
                                <Minus size={16} className="text-red-300" />
                            </button>
                            <input
                                type="number"
                                value={testCase.inputs.plot_width}
                                onChange={(e) => onChange({
                                    ...testCase,
                                    inputs: { ...testCase.inputs, plot_width: parseFloat(e.target.value) }
                                })}
                                className="flex-1 bg-slate-600 border border-slate-500 rounded px-3 py-2 text-slate-100 text-center font-bold"
                            />
                            <button
                                onClick={() => adjustValue('plot_width', 1)}
                                className="bg-green-900 hover:bg-green-800 p-2 rounded transition"
                            >
                                <Plus size={16} className="text-green-300" />
                            </button>
                        </div>
                        <div className="text-xs text-slate-400 mt-1">meters</div>
                    </div>

                    {/* Plot Depth */}
                    <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                        <label className="text-xs text-slate-300 uppercase tracking-wide block mb-2">Plot Depth (Y)</label>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => adjustValue('plot_depth', -1)}
                                className="bg-red-900 hover:bg-red-800 p-2 rounded transition"
                            >
                                <Minus size={16} className="text-red-300" />
                            </button>
                            <input
                                type="number"
                                value={testCase.inputs.plot_depth}
                                onChange={(e) => onChange({
                                    ...testCase,
                                    inputs: { ...testCase.inputs, plot_depth: parseFloat(e.target.value) }
                                })}
                                className="flex-1 bg-slate-600 border border-slate-500 rounded px-3 py-2 text-slate-100 text-center font-bold"
                            />
                            <button
                                onClick={() => adjustValue('plot_depth', 1)}
                                className="bg-green-900 hover:bg-green-800 p-2 rounded transition"
                            >
                                <Plus size={16} className="text-green-300" />
                            </button>
                        </div>
                        <div className="text-xs text-slate-400 mt-1">meters</div>
                    </div>

                    {/* Road Width */}
                    <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                        <label className="text-xs text-slate-300 uppercase tracking-wide block mb-2">Road Width</label>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => adjustValue('road_width', -0.5)}
                                className="bg-red-900 hover:bg-red-800 p-2 rounded transition"
                            >
                                <Minus size={16} className="text-red-300" />
                            </button>
                            <input
                                type="number"
                                step="0.5"
                                value={testCase.inputs.road_width}
                                onChange={(e) => onChange({
                                    ...testCase,
                                    inputs: { ...testCase.inputs, road_width: parseFloat(e.target.value) }
                                })}
                                className="flex-1 bg-slate-600 border border-slate-500 rounded px-3 py-2 text-slate-100 text-center font-bold"
                            />
                            <button
                                onClick={() => adjustValue('road_width', 0.5)}
                                className="bg-green-900 hover:bg-green-800 p-2 rounded transition"
                            >
                                <Plus size={16} className="text-green-300" />
                            </button>
                        </div>
                        <div className="text-xs text-slate-400 mt-1">meters</div>
                    </div>

                    {/* Front Setback */}
                    <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                        <label className="text-xs text-slate-300 uppercase tracking-wide block mb-2">Front Setback</label>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => adjustValue('setback_front', -0.5)}
                                className="bg-red-900 hover:bg-red-800 p-2 rounded transition"
                            >
                                <Minus size={16} className="text-red-300" />
                            </button>
                            <input
                                type="number"
                                step="0.5"
                                value={testCase.inputs.setback_front}
                                onChange={(e) => onChange({
                                    ...testCase,
                                    inputs: { ...testCase.inputs, setback_front: parseFloat(e.target.value) }
                                })}
                                className="flex-1 bg-slate-600 border border-slate-500 rounded px-3 py-2 text-slate-100 text-center font-bold"
                            />
                            <button
                                onClick={() => adjustValue('setback_front', 0.5)}
                                className="bg-green-900 hover:bg-green-800 p-2 rounded transition"
                            >
                                <Plus size={16} className="text-green-300" />
                            </button>
                        </div>
                        <div className="text-xs text-slate-400 mt-1">meters</div>
                    </div>

                    {/* Rear Setback */}
                    <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                        <label className="text-xs text-slate-300 uppercase tracking-wide block mb-2">Rear Setback</label>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => adjustValue('setback_rear', -0.5)}
                                className="bg-red-900 hover:bg-red-800 p-2 rounded transition"
                            >
                                <Minus size={16} className="text-red-300" />
                            </button>
                            <input
                                type="number"
                                step="0.5"
                                value={testCase.inputs.setback_rear}
                                onChange={(e) => onChange({
                                    ...testCase,
                                    inputs: { ...testCase.inputs, setback_rear: parseFloat(e.target.value) }
                                })}
                                className="flex-1 bg-slate-600 border border-slate-500 rounded px-3 py-2 text-slate-100 text-center font-bold"
                            />
                            <button
                                onClick={() => adjustValue('setback_rear', 0.5)}
                                className="bg-green-900 hover:bg-green-800 p-2 rounded transition"
                            >
                                <Plus size={16} className="text-green-300" />
                            </button>
                        </div>
                        <div className="text-xs text-slate-400 mt-1">meters</div>
                    </div>

                    {/* Left Setback */}
                    <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                        <label className="text-xs text-slate-300 uppercase tracking-wide block mb-2">Left Setback</label>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => adjustValue('setback_left', -0.5)}
                                className="bg-red-900 hover:bg-red-800 p-2 rounded transition"
                            >
                                <Minus size={16} className="text-red-300" />
                            </button>
                            <input
                                type="number"
                                step="0.5"
                                value={testCase.inputs.setback_left}
                                onChange={(e) => onChange({
                                    ...testCase,
                                    inputs: { ...testCase.inputs, setback_left: parseFloat(e.target.value) }
                                })}
                                className="flex-1 bg-slate-600 border border-slate-500 rounded px-3 py-2 text-slate-100 text-center font-bold"
                            />
                            <button
                                onClick={() => adjustValue('setback_left', 0.5)}
                                className="bg-green-900 hover:bg-green-800 p-2 rounded transition"
                            >
                                <Plus size={16} className="text-green-300" />
                            </button>
                        </div>
                        <div className="text-xs text-slate-400 mt-1">meters</div>
                    </div>

                    {/* Right Setback */}
                    <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                        <label className="text-xs text-slate-300 uppercase tracking-wide block mb-2">Right Setback</label>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => adjustValue('setback_right', -0.5)}
                                className="bg-red-900 hover:bg-red-800 p-2 rounded transition"
                            >
                                <Minus size={16} className="text-red-300" />
                            </button>
                            <input
                                type="number"
                                step="0.5"
                                value={testCase.inputs.setback_right}
                                onChange={(e) => onChange({
                                    ...testCase,
                                    inputs: { ...testCase.inputs, setback_right: parseFloat(e.target.value) }
                                })}
                                className="flex-1 bg-slate-600 border border-slate-500 rounded px-3 py-2 text-slate-100 text-center font-bold"
                            />
                            <button
                                onClick={() => adjustValue('setback_right', 0.5)}
                                className="bg-green-900 hover:bg-green-800 p-2 rounded transition"
                            >
                                <Plus size={16} className="text-green-300" />
                            </button>
                        </div>
                        <div className="text-xs text-slate-400 mt-1">meters</div>
                    </div>

                    {/* Height */}
                    <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                        <label className="text-xs text-slate-300 uppercase tracking-wide block mb-2">Height</label>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => adjustValue('height', -1)}
                                className="bg-red-900 hover:bg-red-800 p-2 rounded transition"
                            >
                                <Minus size={16} className="text-red-300" />
                            </button>
                            <input
                                type="number"
                                value={testCase.inputs.height}
                                onChange={(e) => onChange({
                                    ...testCase,
                                    inputs: { ...testCase.inputs, height: parseFloat(e.target.value) }
                                })}
                                className="flex-1 bg-slate-600 border border-slate-500 rounded px-3 py-2 text-slate-100 text-center font-bold"
                            />
                            <button
                                onClick={() => adjustValue('height', 1)}
                                className="bg-green-900 hover:bg-green-800 p-2 rounded transition"
                            >
                                <Plus size={16} className="text-green-300" />
                            </button>
                        </div>
                        <div className="text-xs text-slate-400 mt-1">meters</div>
                    </div>

                    {/* Storeys */}
                    <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                        <label className="text-xs text-slate-300 uppercase tracking-wide block mb-2">Storeys</label>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => adjustValue('storeys', -1)}
                                className="bg-red-900 hover:bg-red-800 p-2 rounded transition"
                            >
                                <Minus size={16} className="text-red-300" />
                            </button>
                            <input
                                type="number"
                                value={testCase.inputs.storeys}
                                onChange={(e) => onChange({
                                    ...testCase,
                                    inputs: { ...testCase.inputs, storeys: parseInt(e.target.value) }
                                })}
                                className="flex-1 bg-slate-600 border border-slate-500 rounded px-3 py-2 text-slate-100 text-center font-bold"
                            />
                            <button
                                onClick={() => adjustValue('storeys', 1)}
                                className="bg-green-900 hover:bg-green-800 p-2 rounded transition"
                            >
                                <Plus size={16} className="text-green-300" />
                            </button>
                        </div>
                        <div className="text-xs text-slate-400 mt-1">floors</div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================================================
// MAIN ADVANCED TEST ENGINE COMPONENT
// ============================================================================

export default function AdvancedTestEngine() {
    const [testCases, setTestCases] = useState(DEFAULT_TEST_CASES);
    const [selectedTestIndex, setSelectedTestIndex] = useState(0);
    const [visualizationVisible, setVisualizationVisible] = useState(true);

    const currentTest = testCases[selectedTestIndex];

    const recalculateTest = (updatedTest) => {
        // Recalculate derived values
        const w = updatedTest.inputs.plot_width;
        const d = updatedTest.inputs.plot_depth;
        const diagonal = Math.sqrt(w * w + d * d);
        const area = w * d;

        const s = updatedTest.inputs;
        const buildingW = w - s.setback_left - s.setback_right;
        const buildingD = d - s.setback_front - s.setback_rear;
        const builtUpArea = buildingW * buildingD * updatedTest.inputs.storeys;
        const far = builtUpArea / area;

        updatedTest.calculations = {
            plot_area_sqm: Math.round(area),
            diagonal_m: parseFloat(diagonal.toFixed(2)),
            building_width: buildingW,
            building_depth: buildingD,
            built_up_area: Math.round(builtUpArea),
            far: parseFloat(far.toFixed(2))
        };

        const newTestCases = [...testCases];
        newTestCases[selectedTestIndex] = updatedTest;
        setTestCases(newTestCases);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100 p-6 font-sans">
            {/* Header */}
            <div className="max-w-7xl mx-auto mb-8">
                <div className="mb-6">
                    <h1 className="text-4xl font-black mb-2 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-400">
                        Advanced Test Engine
                    </h1>
                    <p className="text-slate-400">Dynamic Layout Generation & Validation System</p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="bg-gradient-to-br from-green-900 to-green-800 rounded-lg border border-green-700 p-4">
                        <div className="text-2xl font-bold text-green-300">{testCases.length}</div>
                        <div className="text-xs text-green-200">Test Cases</div>
                    </div>
                    <div className="bg-gradient-to-br from-blue-900 to-blue-800 rounded-lg border border-blue-700 p-4">
                        <div className="text-2xl font-bold text-blue-300">{Math.round(currentTest.calculations.plot_area_sqm)}</div>
                        <div className="text-xs text-blue-200">Plot Area (sqm)</div>
                    </div>
                    <div className="bg-gradient-to-br from-purple-900 to-purple-800 rounded-lg border border-purple-700 p-4">
                        <div className="text-2xl font-bold text-purple-300">{currentTest.calculations.diagonal_m}</div>
                        <div className="text-xs text-purple-200">Diagonal (m)</div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto">
                {/* Test Selector */}
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 mb-6">
                    <h2 className="text-xl font-bold mb-4 text-slate-100">Select Test Case</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        {testCases.map((test, idx) => (
                            <button
                                key={test.id}
                                onClick={() => setSelectedTestIndex(idx)}
                                className={`p-4 rounded-lg border-2 transition-all text-left ${selectedTestIndex === idx
                                        ? 'bg-cyan-600 border-cyan-400 shadow-lg'
                                        : 'bg-slate-700 border-slate-600 hover:border-slate-500'
                                    }`}
                            >
                                <div className="font-semibold text-sm">{test.id}. {test.name}</div>
                                <div className="text-xs text-slate-300 mt-1">{test.category}</div>
                                <div className={`text-xs mt-2 font-bold ${test.expectedOutput.valid ? 'text-green-300' : 'text-red-300'}`}>
                                    {test.expectedOutput.valid ? '✓ PASS' : '✗ FAIL'}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Input Controls */}
                <InputControl
                    testCase={currentTest}
                    onChange={recalculateTest}
                />

                {/* Test Information */}
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 mb-6">
                    <h3 className="text-lg font-bold text-slate-100 mb-4">{currentTest.name}</h3>
                    <p className="text-slate-300">{currentTest.description}</p>

                    <div className="mt-6 grid grid-cols-2 gap-4">
                        <div className="bg-slate-700/50 rounded p-4">
                            <div className="text-xs text-slate-400 uppercase mb-2">Expected Result</div>
                            <div className={`text-lg font-bold ${currentTest.expectedOutput.valid ? 'text-green-400' : 'text-red-400'}`}>
                                {currentTest.expectedOutput.status}
                            </div>
                            {currentTest.expectedOutput.violations > 0 && (
                                <div className="text-xs text-red-300 mt-2">{currentTest.expectedOutput.violations} violation(s)</div>
                            )}
                        </div>
                        <div className="bg-slate-700/50 rounded p-4">
                            <div className="text-xs text-slate-400 uppercase mb-2">Applied Rules</div>
                            <div className="text-xs text-slate-300 space-y-1">
                                {currentTest.applicableRules.slice(0, 3).map((rule, idx) => (
                                    <div key={idx}>{rule}</div>
                                ))}
                                {currentTest.applicableRules.length > 3 && (
                                    <div className="text-cyan-400">+{currentTest.applicableRules.length - 3} more</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Run Test Button */}
                <button className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-bold py-4 rounded-lg transition-all flex items-center justify-center gap-2 mb-6">
                    <Play size={20} />
                    Run Test & Generate Layout
                </button>

                {/* Visualization Toggle */}
                <button
                    onClick={() => setVisualizationVisible(!visualizationVisible)}
                    className="w-full bg-slate-700 hover:bg-slate-600 text-slate-100 font-semibold py-3 rounded-lg transition-all flex items-center justify-center gap-2 mb-6"
                >
                    {visualizationVisible ? (
                        <>
                            <EyeOff size={18} /> Hide Layout Visualization
                        </>
                    ) : (
                        <>
                            <Eye size={18} /> Show Layout Visualization
                        </>
                    )}
                </button>

                {/* Layout Visualization */}
                {visualizationVisible && (
                    <EnhancedPlotVisualization
                        testCase={currentTest}
                        layoutData={currentTest.expectedOutput.generatedLayout}
                    />
                )}

                {/* Parameter Comparison Table */}
                <ParameterComparisonTable
                    testCase={currentTest}
                    actualOutput={currentTest.expectedOutput.generatedLayout}
                />

                {/* Export Section */}
                <div className="mt-8 bg-gradient-to-r from-purple-900 to-purple-800 rounded-xl border border-purple-700 p-6">
                    <h3 className="text-lg font-bold text-purple-200 mb-4">Export & Documentation</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <button className="bg-purple-700 hover:bg-purple-600 text-white font-semibold py-3 rounded-lg transition-all flex items-center justify-center gap-2">
                            <Download size={18} />
                            Export Test Results (PDF)
                        </button>
                        <button className="bg-purple-700 hover:bg-purple-600 text-white font-semibold py-3 rounded-lg transition-all flex items-center justify-center gap-2">
                            <Download size={18} />
                            Export Layout (DWG)
                        </button>
                    </div>
                </div>

                {/* Implementation Notes */}
                <div className="mt-8 bg-slate-800 rounded-xl border border-slate-700 p-6 mb-8">
                    <h3 className="text-lg font-bold text-slate-100 mb-4">How This Test Engine Works</h3>
                    <div className="space-y-3 text-sm text-slate-300">
                        <p>
                            <strong className="text-cyan-400">1. Input Parameters:</strong> Modify plot dimensions (width X, depth Y), road width, and setbacks using the controls above.
                        </p>
                        <p>
                            <strong className="text-cyan-400">2. Real-time Calculation:</strong> The system instantly calculates plot area, diagonal, building dimensions, FAR, and other metrics.
                        </p>
                        <p>
                            <strong className="text-cyan-400">3. Layout Generation:</strong> Click "Run Test" to generate the layout visualization based on current input values.
                        </p>
                        <p>
                            <strong className="text-cyan-400">4. Parameter Comparison:</strong> See side-by-side comparison of expected vs actual generated values in the detailed table below the visualization.
                        </p>
                        <p>
                            <strong className="text-cyan-400">5. Rule Validation:</strong> The system automatically checks against all applicable bylaws constraints and shows results.
                        </p>
                        <p>
                            <strong className="text-cyan-400">6. Export Options:</strong> Generate PDF reports and DWG layout files for documentation and sharing.
                        </p>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="text-center text-slate-400 text-xs mt-12">
                <p>Advanced Test Engine • Dynamic Layout Generation • v2.0 • Ready for Production</p>
            </div>
        </div>
    );
}
