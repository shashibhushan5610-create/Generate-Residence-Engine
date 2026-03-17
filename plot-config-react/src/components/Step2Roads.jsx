export default function Step2Roads({ roads, addRoad, removeRoad, updateRoad, vertexCount }) {
  const maxIndex = Math.max(0, vertexCount - 1);

  return (
    <div className="step-block">
      <div className="step-title"><span className="step-num">2</span> Roads & Access</div>
      {roads.map((road, i) => (
        <div key={road.id} className="road-card">
          <div className="road-card-header">
            <span>Road {i + 1}</span>
            <button className="btn-icon" onClick={() => removeRoad(road.id)}>×</button>
          </div>
          <div className="input-row">
            <div className="form-group">
              <label>Side Index</label>
              <input
                type="number"
                min="0"
                max={maxIndex}
                value={road.sideIndex}
                onChange={e => updateRoad(road.id, 'sideIndex', parseInt(e.target.value) || 0)}
              />
            </div>
            <div className="form-group">
              <label>Existing (m)</label>
              <input
                type="number"
                step="0.5"
                value={road.width}
                onChange={e => updateRoad(road.id, 'width', parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="form-group">
              <label>Proposed (m)</label>
              <input
                type="number"
                step="0.5"
                value={road.proposedWidth}
                onChange={e => updateRoad(road.id, 'proposedWidth', parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
        </div>
      ))}
      <button className="btn-outline" onClick={addRoad}>+ Add Road</button>
    </div>
  );
}
