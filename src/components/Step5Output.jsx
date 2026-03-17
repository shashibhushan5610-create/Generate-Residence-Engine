import { exportToDXF } from '../engines/dxfExporter.js';

export default function Step5Output({
  activeOutputTab, setActiveOutputTab,
  geoResult, complianceResult, roads,
}) {
  const geomJson = JSON.stringify(
    {
      vertices: geoResult.vertices,
      area: geoResult.area,
      isClosed: geoResult.isClosed,
    },
    null,
    2
  );

  const compJson = complianceResult
    ? JSON.stringify(complianceResult, null, 2)
    : '{}';

  function downloadJSON() {
    const blob = new Blob([activeOutputTab === 'geom' ? geomJson : compJson], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `plot-${activeOutputTab}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadDXF() {
    if (!geoResult.isClosed) {
      alert('Cannot export DXF: polygon is not closed.');
      return;
    }
    const dxf = exportToDXF(
      { ...geoResult },
      complianceResult || {},
      roads
    );
    const blob = new Blob([dxf], { type: 'application/dxf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plot-config.dxf';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="step-block">
      <div className="step-title"><span className="step-num">5</span> Output</div>

      <div className="tab-bar">
        <button
          className={`tab-btn ${activeOutputTab === 'geom' ? 'active' : ''}`}
          onClick={() => setActiveOutputTab('geom')}
        >Geometry</button>
        <button
          className={`tab-btn ${activeOutputTab === 'comp' ? 'active' : ''}`}
          onClick={() => setActiveOutputTab('comp')}
        >Compliance</button>
      </div>

      <pre className="code-block">
        {activeOutputTab === 'geom' ? geomJson : compJson}
      </pre>

      <div className="btn-group">
        <button className="btn-primary" onClick={downloadJSON}>JSON</button>
        <button className="btn-outline" onClick={downloadDXF}>DXF</button>
      </div>
    </div>
  );
}
