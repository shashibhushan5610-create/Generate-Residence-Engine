import { SPACES, CATEGORY_COLORS } from '../hooks/useDashboard.js';

const STRATEGY_OPTIONS = [
  { value: 'auto',      label: 'Option 1 — Centralized Hub' },
  { value: 'compact',   label: 'Option 2 — Corner-Pinned' },
  { value: 'open_plan', label: 'Option 3 — Service Segregation' },
  { value: 'l_shape',   label: 'Option 4 — Privacy Split' },
  { value: 'solar',     label: 'Option 5 — Open-Plan Soft Zoning' },
];

const FLOOR_OPTIONS = [
  { value: 'ground', label: 'Ground Floor' },
  { value: 'upper',  label: 'Upper Floor' },
];

// Group spaces by category
const SPACE_GROUPS = SPACES.reduce((acc, sp) => {
  (acc[sp.cat] = acc[sp.cat] || []).push(sp);
  return acc;
}, {});

export default function Step6Zoning({
  zoningMode, setZoningMode,
  floorLevel, setFloorLevel,
  selectedSpaces, toggleSpace,
  userAreas, setSpaceArea, resetSpaceArea,
  spaceUtilisation,
  buildableInfo,
  showZones, setShowZones,
  STRATEGY_META,
}) {
  const meta = STRATEGY_META?.[zoningMode];
  const { used, avail, pct } = spaceUtilisation;

  return (
    <div className="step-container">
      <div className="step-header">
        <span className="step-num">6</span>
        <span className="step-title">Zoning Layout</span>
      </div>
      <div className="step-body">

        {/* Strategy selector */}
        <div className="form-group">
          <label className="form-label">Strategy</label>
          <select className="form-select" value={zoningMode} onChange={e => setZoningMode(e.target.value)}>
            {STRATEGY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Floor level */}
        <div className="form-group">
          <label className="form-label">Floor Level</label>
          <select className="form-select" value={floorLevel} onChange={e => setFloorLevel(e.target.value)}>
            {FLOOR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Strategy info card */}
        {meta && (
          <div className="strategy-card">
            <div className="strategy-concept">{meta.concept}</div>
            <div className="strategy-pros-cons">
              <div>
                <div className="pros-label">Pros</div>
                {meta.pros.map((p, i) => <div key={i} className="pros-item">+ {p}</div>)}
              </div>
              <div>
                <div className="cons-label">Cons</div>
                {meta.cons.map((c, i) => <div key={i} className="cons-item">- {c}</div>)}
              </div>
            </div>
          </div>
        )}

        {/* Show zones toggle */}
        <div className="form-group toggle-row">
          <label className="form-label">Show Zones on Canvas</label>
          <button
            className={`btn-toggle ${showZones ? 'active' : ''}`}
            onClick={() => setShowZones(v => !v)}
          >
            {showZones ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* Space catalog */}
        <div className="section-label">Space Program</div>
        <div className="space-catalog">
          {Object.entries(SPACE_GROUPS).map(([cat, spaces]) => (
            <div key={cat} className="space-category">
              <div className="space-category-header">
                <span className="cat-dot" style={{ background: CATEGORY_COLORS[cat] || '#8b949e' }} />
                <span className="cat-name">{cat}</span>
                <span className="cat-count">{spaces.length}</span>
              </div>
              {spaces.map(sp => {
                const isSelected = selectedSpaces.has(sp.id);
                const area = userAreas.get(sp.id) ?? sp.rec;
                return (
                  <div key={sp.id} className={`space-row ${isSelected ? 'selected' : ''}`}>
                    <button
                      className={`space-check ${isSelected ? 'checked' : ''}`}
                      onClick={() => toggleSpace(sp.id)}
                      aria-label={`Toggle ${sp.name}`}
                    />
                    <span className="space-name" onClick={() => toggleSpace(sp.id)}>{sp.name}</span>
                    <input
                      className="space-area-input"
                      type="number"
                      step="0.5"
                      min={sp.min}
                      max={sp.max}
                      value={area.toFixed(1)}
                      onChange={e => setSpaceArea(sp.id, parseFloat(e.target.value) || sp.rec)}
                    />
                    <span className="space-unit">m²</span>
                    <button className="space-restore" onClick={() => resetSpaceArea(sp.id)} title="Restore recommended">↺</button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Utilisation bar */}
        <div className="util-section">
          <div className="util-header">
            <span className="util-pct">{pct.toFixed(0)}%</span>
            <span className="util-detail">{used.toFixed(1)} m² used of {avail.toFixed(1)} m² available</span>
          </div>
          <div className="util-track">
            <div
              className={`util-bar ${pct > 100 ? 'error' : pct > 85 ? 'warn' : ''}`}
              style={{ width: Math.min(pct, 100) + '%' }}
            />
          </div>
        </div>

        {/* Zone KV summary */}
        <div className="kv-grid">
          <div className="kv-card">
            <div className="kv-label">Buildable</div>
            <div className="kv-value">{buildableInfo.buildableArea.toFixed(1)}<span className="kv-unit">m²</span></div>
          </div>
          <div className="kv-card">
            <div className="kv-label">Gross Area</div>
            <div className="kv-value">{buildableInfo.grossArea.toFixed(1)}<span className="kv-unit">m²</span></div>
          </div>
          <div className="kv-card">
            <div className="kv-label">FAR</div>
            <div className="kv-value">{buildableInfo.far.toFixed(2)}</div>
          </div>
          <div className="kv-card">
            <div className="kv-label">Parking</div>
            <div className="kv-value">{buildableInfo.ecs}<span className="kv-unit">ECS</span></div>
          </div>
        </div>

      </div>
    </div>
  );
}
