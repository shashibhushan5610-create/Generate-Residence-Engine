import { useDashboard } from './hooks/useDashboard.js';
import CanvasView from './components/CanvasView.jsx';
import Step1Geometry from './components/Step1Geometry.jsx';
import Step2Roads from './components/Step2Roads.jsx';
import Step3Compliance from './components/Step3Compliance.jsx';
import Step4Validation from './components/Step4Validation.jsx';
import Step5Output from './components/Step5Output.jsx';
import Step6Zoning from './components/Step6Zoning.jsx';
import Step7Reports from './components/Step7Reports.jsx';
import './App.css';

export default function App() {
  const dash = useDashboard();

  return (
    <div className={`app ${dash.theme}`}>
      <header className="app-header">
        <div className="header-brand">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3h18v18H3zM3 9h18M9 3v18" />
          </svg>
          <span className="brand-name">ArchitectOS</span>
          <span className="brand-version">v3.0</span>
        </div>
        <div className="header-actions">
          <button
            className={`btn-toggle-header ${dash.showDims ? 'active' : ''}`}
            onClick={() => dash.setShowDims(v => !v)}
          >
            Dims
          </button>
          <button
            className={`btn-toggle-header ${dash.showZones ? 'active' : ''}`}
            onClick={() => dash.setShowZones(v => !v)}
          >
            Zones
          </button>
          <button
            className={`btn-toggle-header ${dash.showWalls ? 'active' : ''}`}
            onClick={() => dash.setShowWalls(v => !v)}
          >
            Walls
          </button>
          <div className="north-control">
            <label className="form-label" style={{ marginBottom: 0, fontSize: 10 }}>N°</label>
            <input
              type="number"
              className="north-input"
              value={dash.northAngle}
              onChange={e => dash.setNorthAngle(parseFloat(e.target.value) || 0)}
              min="-180" max="180" step="5"
            />
          </div>
          <button
            className="btn-outline sm"
            onClick={() => dash.setTheme(t => t === 'dark' ? 'light' : 'dark')}
          >
            {dash.theme === 'dark' ? '☀ Light' : '🌙 Dark'}
          </button>
        </div>
      </header>

      <div className="app-body">
        <aside className="sidebar">
          <Step1Geometry
            geoMode={dash.geoMode} setGeoMode={dash.setGeoMode}
            regWidth={dash.regWidth} setRegWidth={dash.setRegWidth}
            regHeight={dash.regHeight} setRegHeight={dash.setRegHeight}
            edges={dash.edges} addEdge={dash.addEdge} removeEdge={dash.removeEdge} updateEdge={dash.updateEdge}
            diagonals={dash.diagonals} addDiagonal={dash.addDiagonal} removeDiagonal={dash.removeDiagonal} updateDiagonal={dash.updateDiagonal}
            geoResult={dash.geoResult}
            sbFront={dash.sbFront} setSbFront={dash.setSbFront}
            sbRear={dash.sbRear} setSbRear={dash.setSbRear}
            sbLeft={dash.sbLeft} setSbLeft={dash.setSbLeft}
            sbRight={dash.sbRight} setSbRight={dash.setSbRight}
            floors={dash.floors} setFloors={dash.setFloors}
            maxH={dash.maxH} setMaxH={dash.setMaxH}
          />
          <Step2Roads
            roads={dash.roads} addRoad={dash.addRoad} removeRoad={dash.removeRoad} updateRoad={dash.updateRoad}
            vertexCount={dash.geoResult.vertices.length}
          />
          <Step3Compliance
            authorities={dash.authorities}
            authorityId={dash.authorityId} handleAuthorityChange={dash.handleAuthorityChange}
            landUses={dash.landUses} landUse={dash.landUse} setLandUse={dash.setLandUse}
            isCornerPlot={dash.isCornerPlot} setIsCornerPlot={dash.setIsCornerPlot}
            developmentType={dash.developmentType} setDevelopmentType={dash.setDevelopmentType}
            proposedHeight={dash.proposedHeight} setProposedHeight={dash.setProposedHeight}
            totalUnits={dash.totalUnits} setTotalUnits={dash.setTotalUnits}
            complianceResult={dash.complianceResult}
            buildableInfo={dash.buildableInfo}
            geoResult={dash.geoResult}
          />
          <Step4Validation
            geoResult={dash.geoResult}
            complianceResult={dash.complianceResult}
          />
          <Step5Output
            activeOutputTab={dash.activeOutputTab} setActiveOutputTab={dash.setActiveOutputTab}
            geoResult={dash.geoResult}
            complianceResult={dash.complianceResult}
            roads={dash.roads}
          />
          <Step6Zoning
            zoningMode={dash.zoningMode} setZoningMode={dash.setZoningMode}
            floorLevel={dash.floorLevel} setFloorLevel={dash.setFloorLevel}
            selectedSpaces={dash.selectedSpaces} toggleSpace={dash.toggleSpace}
            userAreas={dash.userAreas} setSpaceArea={dash.setSpaceArea} resetSpaceArea={dash.resetSpaceArea}
            spaceUtilisation={dash.spaceUtilisation}
            buildableInfo={dash.buildableInfo}
            showZones={dash.showZones} setShowZones={dash.setShowZones}
            STRATEGY_META={dash.STRATEGY_META}
          />
          <Step7Reports
            geoResult={dash.geoResult}
            complianceResult={dash.complianceResult}
            bylawResult={dash.bylawResult}
            buildableInfo={dash.buildableInfo}
            zoningResult={dash.zoningResult}
            selectedSpaces={dash.selectedSpaces}
            userAreas={dash.userAreas}
          />
        </aside>

        <main className="canvas-area">
          <CanvasView
            geoResult={dash.geoResult}
            buildableVertices={dash.buildableVertices}
            complianceResult={dash.complianceResult}
            roads={dash.roads}
            showDims={dash.showDims}
            showZones={dash.showZones}
            showWalls={dash.showWalls}
            zoningResult={dash.zoningResult}
            northAngle={dash.northAngle}
            theme={dash.theme}
            onVertexDrag={dash.handleVertexDrag}
            onVertexDragEnd={dash.handleVertexDragEnd}
          />
        </main>
      </div>

      <footer className="status-bar">
        <span className="sb-item">Area: <strong>{(dash.geoResult.area || 0).toFixed(2)} m²</strong></span>
        <span className="sb-item">Buildable: <strong>{dash.buildableInfo.buildableArea.toFixed(2)} m²</strong></span>
        <span className="sb-item">FAR: <strong>{dash.buildableInfo.far.toFixed(2)}</strong></span>
        <span className="sb-item">ECS: <strong>{dash.buildableInfo.ecs}</strong></span>
        <span className="sb-item sb-status">{dash.geoResult.isClosed ? (dash.geoResult.isSelfIntersecting ? '⚠ Self-intersecting' : '✔ Closed') : '○ Open'}</span>
      </footer>
    </div>
  );
}
