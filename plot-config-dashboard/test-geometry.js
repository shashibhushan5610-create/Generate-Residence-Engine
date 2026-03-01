const fs = require('fs');

// Simple mock environment
global.window = {};

const authStr = fs.readFileSync('authorities-data.js', 'utf8');
const geomStr = fs.readFileSync('geometry-engine.js', 'utf8');

eval(authStr);
eval(geomStr);

// Let's mock evaluateGeometry output
const stateData = {
    type: 'regular',
    width: 30,
    height: 40,
    edges: [],
    diagonals: []
};
const geometry = window.GeometryEngine.evaluateGeometry(stateData);
console.log("Original Vertices:", geometry.vertices);

// Mock offsets
const offsets = [2.5, 0, 0, 0]; // 1.5m widening + 1m setback on side 0

const insetVertices = window.GeometryEngine.calculateInsetPolygon(geometry.vertices, offsets);
console.log("Inset Vertices:", insetVertices);

const insetArea = window.GeometryEngine.calculateArea(insetVertices);
console.log("Inset Area:", insetArea);
