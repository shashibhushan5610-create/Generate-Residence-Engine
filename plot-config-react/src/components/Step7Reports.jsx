import { SPACES, CATEGORY_COLORS } from '../hooks/useDashboard.js';

const ZONE_COLORS = {
  threshold: '#f472b6',
  social:    '#eab308',
  private:   '#3b82f6',
  service:   '#f97316',
  outdoor:   '#22c55e',
  master:    '#a78bfa',
};

export default function Step7Reports({
  geoResult,
  complianceResult,
  bylawResult,
  buildableInfo,
  zoningResult,
  selectedSpaces,
  userAreas,
}) {
  const plotArea = geoResult?.area || 0;

  return (
    <div className="step-container">
      <div className="step-header">
        <span className="step-num">7</span>
        <span className="step-title">Reports &amp; Analytics</span>
      </div>
      <div className="step-body">

        {/* Area Calculation Table */}
        <div className="section-label">Area Calculation</div>
        <table className="report-table">
          <tbody>
            <tr><td>Plot Area</td><td>{plotArea.toFixed(2)} m²</td></tr>
            <tr><td>Buildable Area</td><td>{buildableInfo.buildableArea.toFixed(2)} m²</td></tr>
            <tr><td>Gross Floor Area</td><td>{buildableInfo.grossArea.toFixed(2)} m²</td></tr>
            <tr><td>Achieved FAR</td><td>{buildableInfo.far.toFixed(2)}</td></tr>
            {complianceResult && <tr><td>Max FAR (Authority)</td><td>{complianceResult.maxFAR ?? '—'}</td></tr>}
            {complianceResult && <tr><td>Max Ground Coverage</td><td>{complianceResult.maxGroundCoverageArea?.toFixed(2)} m²</td></tr>}
            <tr><td>Parking ECS</td><td>{buildableInfo.ecs}</td></tr>
          </tbody>
        </table>

        {/* Bylaw validation summary */}
        {bylawResult && (
          <>
            <div className="section-label" style={{ marginTop: 12 }}>
              UP Bylaw Validation
              <span className={`bylaw-status ${bylawResult.isValid ? 'pass' : 'fail'}`}>
                {bylawResult.isValid ? ' ✔ PASS' : ' ✖ FAIL'}
              </span>
            </div>
            <div className="bylaw-summary">
              <span className="bys-item pass">✔ {bylawResult.summary.passed} passed</span>
              <span className="bys-item error">✖ {bylawResult.summary.errors} errors</span>
              <span className="bys-item warn">⚠ {bylawResult.summary.warnings} warnings</span>
            </div>
            {bylawResult.errors.length > 0 && (
              <div className="bylaw-errors">
                {bylawResult.errors.map((e, i) => (
                  <div key={i} className="bylaw-error-row">
                    <span className="bylaw-rule-id">{e.rule_id}</span>
                    <span className="bylaw-msg">{e.message}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Spatial Zone Legend */}
        {zoningResult && (
          <>
            <div className="section-label" style={{ marginTop: 12 }}>Spatial Zones</div>
            <div className="zone-legend">
              {Object.entries(zoningResult.zones).map(([key, poly]) => {
                if (!poly || poly.length === 0) return null;
                const area = polygonArea(poly);
                return (
                  <div key={key} className="zone-legend-row">
                    <span className="zone-dot" style={{ background: ZONE_COLORS[key] || '#64748b' }} />
                    <span className="zone-name">{key.toUpperCase()}</span>
                    <span className="zone-area">{area.toFixed(1)} m²</span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Selected space schedule */}
        {selectedSpaces.size > 0 && (
          <>
            <div className="section-label" style={{ marginTop: 12 }}>Space Schedule</div>
            <table className="report-table">
              <thead>
                <tr><th>Space</th><th>Category</th><th>Area (m²)</th></tr>
              </thead>
              <tbody>
                {[...selectedSpaces].map(id => {
                  const sp = SPACES.find(s => s.id === id);
                  if (!sp) return null;
                  const area = userAreas.get(id) ?? sp.rec;
                  return (
                    <tr key={id}>
                      <td>{sp.name}</td>
                      <td>
                        <span className="cat-dot-sm" style={{ background: CATEGORY_COLORS[sp.cat] || '#8b949e' }} />
                        {sp.cat}
                      </td>
                      <td>{area.toFixed(1)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}

      </div>
    </div>
  );
}

function polygonArea(poly) {
  if (!poly || poly.length < 3) return 0;
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const j = (i + 1) % poly.length;
    a += poly[i].x * poly[j].y - poly[j].x * poly[i].y;
  }
  return Math.abs(a) / 2;
}
