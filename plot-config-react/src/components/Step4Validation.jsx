export default function Step4Validation({ geoResult, complianceResult }) {
  const hasCompliance = complianceResult && !complianceResult.error;

  return (
    <div className="step-block">
      <div className="step-title"><span className="step-num">4</span> Validation</div>

      <div className="diag-list">
        {/* Geometry checks */}
        <DiagRow
          label="Polygon closure"
          ok={geoResult.isClosed}
          msg={geoResult.isClosed ? 'Closed' : `Open (err: ${geoResult.closureError?.toFixed(3)}m)`}
        />
        <DiagRow
          label="Self-intersection"
          ok={!geoResult.isSelfIntersecting}
          msg={geoResult.isSelfIntersecting ? 'Detected — fix geometry' : 'None'}
        />
        <DiagRow
          label="Plot area"
          ok={geoResult.area > 0}
          msg={`${geoResult.area.toFixed(2)} m²`}
        />

        {/* Compliance checks */}
        {!hasCompliance && (
          <div className="diag-info">Select an authority to run compliance checks.</div>
        )}

        {hasCompliance && (
          <>
            <DiagRow
              label="Compliance status"
              ok={complianceResult.status === 'Passed'}
              msg={complianceResult.status}
            />
            {complianceResult.errors?.map((err, i) => (
              <div key={i} className="diag-error-msg">{err}</div>
            ))}
            {complianceResult.warnings?.map((w, i) => (
              <div key={i} className="diag-warn-msg">{w}</div>
            ))}
            <DiagRow label="Max FAR" ok={true} msg={complianceResult.maxFAR} />
            <DiagRow label="Max Height" ok={true} msg={`${complianceResult.maxHeight} m`} />
            <DiagRow label="Parking (ECS)" ok={true} msg={complianceResult.parkingRequired} />
            <DiagRow label="Basement" ok={true} msg={complianceResult.basementRule} />
            {complianceResult.socialHousing?.status === 'Mandatory' && (
              <DiagRow
                label="Social Housing"
                ok={false}
                msg={`EWS: ${complianceResult.socialHousing.EWS}, LIG: ${complianceResult.socialHousing.LIG}`}
              />
            )}
          </>
        )}

        {complianceResult?.error && (
          <div className="diag-error-msg">{complianceResult.error}</div>
        )}
      </div>
    </div>
  );
}

function DiagRow({ label, ok, msg }) {
  return (
    <div className="diag-row">
      <span className={`diag-dot ${ok ? 'ok' : 'error'}`} />
      <span className="diag-label">{label}</span>
      <span className="diag-value">{msg}</span>
    </div>
  );
}
