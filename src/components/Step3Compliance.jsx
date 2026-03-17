const DEV_TYPES = [
  { value: 'plotted_single', label: 'Plotted Single Unit' },
  { value: 'plotted_multi',  label: 'Plotted Multi Unit' },
  { value: 'group_housing',  label: 'Group Housing' },
];

export default function Step3Compliance({
  authorities,
  authorityId, handleAuthorityChange,
  landUses, landUse, setLandUse,
  isCornerPlot, setIsCornerPlot,
  developmentType, setDevelopmentType,
  proposedHeight, setProposedHeight,
  totalUnits, setTotalUnits,
  complianceResult,
  buildableInfo,
  geoResult,
}) {
  const c = complianceResult;

  return (
    <div className="step-block">
      <div className="step-title"><span className="step-num">3</span> Compliance Engine</div>

      <div className="form-group">
        <label>Authority</label>
        <select value={authorityId} onChange={e => handleAuthorityChange(e.target.value)}>
          <option value="">-- Select Authority --</option>
          {Object.entries(authorities).map(([id, auth]) => (
            <option key={id} value={id}>{auth.name}</option>
          ))}
        </select>
      </div>

      {authorityId && (
        <>
          <div className="form-group">
            <label>Land Use</label>
            <select value={landUse} onChange={e => setLandUse(e.target.value)}>
              {landUses.map(lu => <option key={lu} value={lu}>{lu}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>Development Type</label>
            <select value={developmentType} onChange={e => setDevelopmentType(e.target.value)}>
              {DEV_TYPES.map(dt => <option key={dt.value} value={dt.value}>{dt.label}</option>)}
            </select>
          </div>

          <div className="input-row">
            <div className="form-group">
              <label>Proposed Height (m)</label>
              <input type="number" step="0.5" min="3" value={proposedHeight} onChange={e => setProposedHeight(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Total Units</label>
              <input type="number" step="1" min="1" value={totalUnits} onChange={e => setTotalUnits(e.target.value)} />
            </div>
          </div>

          <label className="checkbox-label">
            <input type="checkbox" checked={isCornerPlot} onChange={e => setIsCornerPlot(e.target.checked)} />
            Is Corner Plot?
          </label>
        </>
      )}

      {/* KV Cards */}
      {(c || buildableInfo) && (
        <div className="kv-grid" style={{ marginTop: 12 }}>
          <div className="kv-card">
            <div className="kv-label">Plot Area</div>
            <div className="kv-value">{(geoResult?.area || 0).toFixed(2)}<span className="kv-unit">m²</span></div>
          </div>
          <div className="kv-card">
            <div className="kv-label">Status</div>
            <div className="kv-value" style={{ fontSize: 12 }}>{c?.status || (geoResult?.isClosed ? 'Closed' : 'Open')}</div>
          </div>
          <div className="kv-card">
            <div className="kv-label">FAR (achieved)</div>
            <div className="kv-value">{buildableInfo?.far?.toFixed(2) || '—'}</div>
          </div>
          {c && (
            <>
              <div className="kv-card">
                <div className="kv-label">Max FAR</div>
                <div className="kv-value">{c.maxFAR ?? '—'}</div>
              </div>
              <div className="kv-card">
                <div className="kv-label">Gross Area</div>
                <div className="kv-value">{c.maxBuiltUpArea?.toFixed(1) ?? '—'}<span className="kv-unit">m²</span></div>
              </div>
              <div className="kv-card">
                <div className="kv-label">Coverage</div>
                <div className="kv-value">{c.maxGroundCoverageArea?.toFixed(1) ?? '—'}<span className="kv-unit">m²</span></div>
              </div>
              <div className="kv-card">
                <div className="kv-label">Parking</div>
                <div className="kv-value">{c.parkingRequired ?? '—'}<span className="kv-unit">ECS</span></div>
              </div>
              <div className="kv-card">
                <div className="kv-label">Basement</div>
                <div className="kv-value" style={{ fontSize: 11 }}>{c.basementRule ?? '—'}</div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Setbacks summary */}
      {c?.setbacks && (
        <div className="setbacks-summary">
          <div className="sb-row"><span>Front</span><strong>{c.setbacks.front} m</strong></div>
          <div className="sb-row"><span>Rear</span><strong>{c.setbacks.rear} m</strong></div>
          <div className="sb-row"><span>Side 1</span><strong>{c.setbacks.side1} m</strong></div>
          <div className="sb-row"><span>Side 2</span><strong>{c.setbacks.side2} m</strong></div>
        </div>
      )}
    </div>
  );
}
