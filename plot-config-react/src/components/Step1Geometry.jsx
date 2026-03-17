export default function Step1Geometry({
  geoMode, setGeoMode,
  regWidth, setRegWidth,
  regHeight, setRegHeight,
  edges, addEdge, removeEdge, updateEdge,
  diagonals, addDiagonal, removeDiagonal, updateDiagonal,
  geoResult,
}) {
  return (
    <div className="step-block">
      <div className="step-title"><span className="step-num">1</span> Geometry Definition</div>
      <div className="btn-group mb-1">
        <button
          className={`btn-seg ${geoMode === 'regular' ? 'active' : ''}`}
          onClick={() => setGeoMode('regular')}
        >Regular</button>
        <button
          className={`btn-seg ${geoMode === 'irregular' ? 'active' : ''}`}
          onClick={() => setGeoMode('irregular')}
        >Irregular</button>
      </div>

      {geoMode === 'regular' && (
        <div className="input-row">
          <div className="form-group">
            <label>Width (m)</label>
            <input type="number" step="0.1" value={regWidth} onChange={e => setRegWidth(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Height (m)</label>
            <input type="number" step="0.1" value={regHeight} onChange={e => setRegHeight(e.target.value)} />
          </div>
        </div>
      )}

      {geoMode === 'irregular' && (
        <>
          <div className="form-group">
            <label>Side Lengths (m)</label>
            {edges.map((e, i) => (
              <div key={e.id} className="list-row">
                <span className="list-label">S{i + 1}</span>
                <input
                  type="number"
                  step="0.1"
                  value={e.length}
                  onChange={ev => updateEdge(e.id, ev.target.value)}
                />
                {edges.length > 3 && (
                  <button className="btn-icon" onClick={() => removeEdge(e.id)}>×</button>
                )}
              </div>
            ))}
            <button className="btn-outline sm" onClick={addEdge}>+ Side</button>
          </div>

          <div className="form-group">
            <label>Diagonals (m)</label>
            {diagonals.map((d, i) => (
              <div key={d.id} className="list-row">
                <span className="list-label">D{i + 1}</span>
                <input
                  type="number"
                  step="0.1"
                  value={d.length}
                  onChange={ev => updateDiagonal(d.id, ev.target.value)}
                />
                <button className="btn-icon" onClick={() => removeDiagonal(d.id)}>×</button>
              </div>
            ))}
            <button className="btn-outline sm" onClick={addDiagonal}>+ Diagonal</button>
          </div>

          {geoResult.closureError > 0.01 && (
            <div className="alert warn">Closure error: {geoResult.closureError.toFixed(3)} m</div>
          )}
          {geoResult.isSelfIntersecting && (
            <div className="alert error">Self-intersecting polygon detected.</div>
          )}
        </>
      )}
    </div>
  );
}
