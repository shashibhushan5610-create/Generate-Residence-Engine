import { useDashboard } from './hooks/useDashboard.js';
import CanvasView from './components/CanvasView.jsx';
import Step1Geometry from './components/Step1Geometry.jsx';
import Step2Roads from './components/Step2Roads.jsx';
import Step3Compliance from './components/Step3Compliance.jsx';
import Step4Validation from './components/Step4Validation.jsx';
import Step5Output from './components/Step5Output.jsx';
import './App.css';

export default function App() {
  const dash = useDashboard();

  return (
    <div className={`app ${dash.theme}`}>
      <header className="app-header">
        <div className="header-brand">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3h18v18H3zM3 9h18M9 3v18" />
          </svg>
          Plot Configuration Dashboard v2.2
        </div>
        <div className="header-actions">
          <button
            className="btn-outline sm"
            onClick={() => dash.setShowDims(v => !v)}
          >
            Dims: {dash.showDims ? 'ON' : 'OFF'}
          </button>
          <button
            className="btn-outline sm"
            onClick={() => dash.setTheme(t => t === 'dark' ? 'light' : 'dark')}
          >
            {dash.theme === 'dark' ? '\u2600 Light' : '\uD83C\uDF19 Dark'}
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
        </aside>

        <main className="canvas-area">
          <CanvasView
            geoResult={dash.geoResult}
            complianceResult={dash.complianceResult}
            roads={dash.roads}
            showDims={dash.showDims}
            theme={dash.theme}
            onVertexDrag={dash.handleVertexDrag}
            onVertexDragEnd={dash.handleVertexDragEnd}
          />
        </main>
      </div>
    </div>
  );
}
