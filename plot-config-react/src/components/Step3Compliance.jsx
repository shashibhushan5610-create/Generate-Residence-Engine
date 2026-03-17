export default function Step3Compliance({
  authorities,
  authorityId, handleAuthorityChange,
  landUses, landUse, setLandUse,
  isCornerPlot, setIsCornerPlot,
}) {
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
              {landUses.map(lu => (
                <option key={lu} value={lu}>{lu}</option>
              ))}
            </select>
          </div>

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={isCornerPlot}
              onChange={e => setIsCornerPlot(e.target.checked)}
            />
            Is Corner Plot?
          </label>
        </>
      )}
    </div>
  );
}
