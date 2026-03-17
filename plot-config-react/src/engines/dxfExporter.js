// dxfExporter.js — ES Module version
import { calculateInsetPolygon } from './geometryEngine.js';
import { getPlotDimensions, getComplianceDimensions } from './dimensionEngine.js';

function createMinimalDXFBlock(entitiesBlock) {
  return `0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1027\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n${entitiesBlock}0\nENDSEC\n0\nEOF\n`;
}

function generateLWPolyline(vertices, layer = '0', closed = true) {
  if (!vertices || vertices.length < 2) return '';
  let ent = `0\nLWPOLYLINE\n8\n${layer}\n90\n${vertices.length}\n70\n${closed ? 1 : 0}\n`;
  vertices.forEach((v) => {
    ent += `10\n${v.x.toFixed(4)}\n20\n${v.y.toFixed(4)}\n`;
  });
  return ent;
}

function generateText(text, x, y, height, rotation = 0, layer = '0') {
  return `0\nTEXT\n8\n${layer}\n10\n${x.toFixed(4)}\n20\n${y.toFixed(4)}\n40\n${height.toFixed(4)}\n1\n${text}\n50\n${rotation.toFixed(4)}\n`;
}

function generateAlignedDimension(p1, p2, text, offset = 1.0, layer = 'A-DIMS') {
  const dx = p2.x - p1.x, dy = p2.y - p1.y, len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.1) return '';
  const nx = -dy / len, ny = dx / len;
  const d1 = { x: p1.x + nx * offset, y: p1.y + ny * offset };
  const d2 = { x: p2.x + nx * offset, y: p2.y + ny * offset };
  const mid = { x: (d1.x + d2.x) / 2, y: (d1.y + d2.y) / 2 };
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  let ent = '';
  ent += `0\nLINE\n8\n${layer}\n10\n${d1.x.toFixed(4)}\n20\n${d1.y.toFixed(4)}\n11\n${d2.x.toFixed(4)}\n21\n${d2.y.toFixed(4)}\n`;
  ent += `0\nLINE\n8\n${layer}\n10\n${p1.x.toFixed(4)}\n20\n${p1.y.toFixed(4)}\n11\n${(d1.x + nx * 0.2).toFixed(4)}\n21\n${(d1.y + ny * 0.2).toFixed(4)}\n`;
  ent += `0\nLINE\n8\n${layer}\n10\n${p2.x.toFixed(4)}\n20\n${p2.y.toFixed(4)}\n11\n${(d2.x + nx * 0.2).toFixed(4)}\n21\n${(d2.y + ny * 0.2).toFixed(4)}\n`;

  const cos45 = 0.707, sin45 = 0.707;
  const rx = nx * cos45 - ny * sin45;
  const ry = nx * sin45 + ny * cos45;
  const tickSize = 0.2;
  ent += `0\nLINE\n8\n${layer}\n10\n${(d1.x - rx * tickSize).toFixed(4)}\n20\n${(d1.y - ry * tickSize).toFixed(4)}\n11\n${(d1.x + rx * tickSize).toFixed(4)}\n21\n${(d1.y + ry * tickSize).toFixed(4)}\n`;
  ent += `0\nLINE\n8\n${layer}\n10\n${(d2.x - rx * tickSize).toFixed(4)}\n20\n${(d2.y - ry * tickSize).toFixed(4)}\n11\n${(d2.x + rx * tickSize).toFixed(4)}\n21\n${(d2.y + ry * tickSize).toFixed(4)}\n`;
  ent += generateText(text, mid.x + nx * 0.2, mid.y + ny * 0.2, 0.4, angle, layer);
  return ent;
}

export function exportToDXF(geometryData, complianceData, roadsData) {
  let entities = '';

  entities += generateLWPolyline(geometryData.vertices, 'PLOT_BOUNDARY', geometryData.isClosed);

  roadsData.forEach((road) => {
    const sideW = Math.max(
      0,
      ((parseFloat(road.proposedWidth) || 0) - (parseFloat(road.width) || 0)) / 2
    );
    if (sideW > 0) {
      const v1 = geometryData.vertices[road.sideIndex];
      const v2 = geometryData.vertices[(road.sideIndex + 1) % geometryData.vertices.length];
      const dx = v2.x - v1.x, dy = v2.y - v1.y, len = Math.sqrt(dx * dx + dy * dy);
      const nx = -dy / len, ny = dx / len;
      const wPoly = [
        v1, v2,
        { x: v2.x + nx * sideW, y: v2.y + ny * sideW },
        { x: v1.x + nx * sideW, y: v1.y + ny * sideW },
      ];
      entities += generateLWPolyline(wPoly, 'ROAD_WIDENING_STRIP', true);
    }
  });

  if (geometryData.isClosed && !geometryData.isSelfIntersecting) {
    const nSides = geometryData.vertices.length;
    const offsets = new Array(nSides).fill(0);
    if (complianceData && complianceData.setbacks) {
      const fIndex = roadsData.length > 0 ? roadsData[0].sideIndex : 0;
      offsets[fIndex % nSides] = complianceData.setbacks.front || 0;
      offsets[(fIndex + 1) % nSides] = complianceData.setbacks.side1 || 0;
      if (nSides >= 4) {
        offsets[(fIndex + 2) % nSides] = complianceData.setbacks.rear || 0;
        offsets[(fIndex + 3) % nSides] = complianceData.setbacks.side2 || 0;
      }
    }
    roadsData.forEach((road) => {
      const sideW = Math.max(
        0,
        ((parseFloat(road.proposedWidth) || 0) - (parseFloat(road.width) || 0)) / 2
      );
      offsets[road.sideIndex] += sideW;
    });
    const buildableV = calculateInsetPolygon(geometryData.vertices, offsets);
    if (buildableV.length > 2) {
      entities += generateLWPolyline(buildableV, 'BUILDING_LINE', true);
    }
  }

  const frontIdx = roadsData.length > 0 ? roadsData[0].sideIndex : 0;
  const plotDims = getPlotDimensions(geometryData.vertices, frontIdx);
  plotDims.forEach((d) => {
    entities += generateAlignedDimension(d.p1, d.p2, d.label, 1.25, 'A-DIMS');
  });

  if (geometryData.isClosed && !geometryData.isSelfIntersecting && complianceData) {
    const compDims = getComplianceDimensions(
      geometryData.vertices,
      complianceData.setbacks,
      roadsData
    );
    compDims.forEach((d) => {
      entities += generateAlignedDimension(d.p1, d.p2, d.label, 0.2, 'A-DIMS');
    });
  }

  if (geometryData.vertices.length > 2) {
    let minX = Infinity, maxX = -Infinity, maxY = -Infinity;
    geometryData.vertices.forEach((v) => {
      minX = Math.min(minX, v.x);
      maxX = Math.max(maxX, v.x);
      maxY = Math.max(maxY, v.y);
    });
    const summaryX = maxX + 5.0;
    let summaryY = maxY;
    const h = 0.6;
    entities += generateText('REGULATORY SUMMARY (V2.0)', summaryX, summaryY, h * 1.2, 0, 'SUMMARY_BLOCK');
    summaryY -= h * 2;
    entities += generateText(`Authority: ${complianceData?.authorityName || 'N/A'}`, summaryX, summaryY, h, 0, 'SUMMARY_BLOCK');
    summaryY -= h * 1.2;
    entities += generateText(`Plot Area: ${geometryData.area.toFixed(2)} sqm`, summaryX, summaryY, h, 0, 'SUMMARY_BLOCK');
    summaryY -= h * 1.2;
    if (complianceData) {
      entities += generateText(`Max FAR: ${complianceData.maxFAR}`, summaryX, summaryY, h, 0, 'SUMMARY_BLOCK');
      summaryY -= h * 1.2;
      entities += generateText(`Max Ground Coverage: ${complianceData.maxGroundCoverageArea} sqm`, summaryX, summaryY, h, 0, 'SUMMARY_BLOCK');
      summaryY -= h * 1.2;
      entities += generateText(`Max Height Allowed: ${complianceData.maxHeight}m`, summaryX, summaryY, h, 0, 'SUMMARY_BLOCK');
      summaryY -= h * 1.2;
      entities += generateText(`Parking Required (ECS): ${complianceData.parkingRequired}`, summaryX, summaryY, h, 0, 'SUMMARY_BLOCK');
    }
  }

  return createMinimalDXFBlock(entities);
}
