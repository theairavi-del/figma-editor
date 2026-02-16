import { useState } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { createZipFromProject } from '../../utils/fileUtils';
import './ExportPanel.css';

export function ExportPanel() {
  const { currentProject } = useEditorStore();
  const [isExporting, setIsExporting] = useState(false);
  const [exported, setExported] = useState(false);

  const handleExport = async () => {
    if (!currentProject) return;

    setIsExporting(true);
    try {
      const blob = await createZipFromProject(currentProject);
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentProject.name}-exported.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      URL.revokeObjectURL(url);
      setExported(true);
      setTimeout(() => setExported(false), 2000);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const fileStats = currentProject?.files.reduce((acc, file) => {
    acc[file.type] = (acc[file.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  return (
    <div className="export-panel">
      <div className="export-header">
        <span className="export-title">Export Project</span>
      </div>

      <div className="export-content">
        {currentProject ? (
          <>
            <div className="export-info">
              <div className="export-info-item">
                <span className="export-info-label">Project Name</span>
                <span className="export-info-value">{currentProject.name}</span>
              </div>
              <div className="export-info-item">
                <span className="export-info-label">Files</span>
                <span className="export-info-value">{currentProject.files.length} total</span>
              </div>
              <div className="export-info-item">
                <span className="export-info-label">Modified</span>
                <span className="export-info-value">
                  {new Date(currentProject.modifiedAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            <div className="export-stats">
              <h4>File Breakdown</h4>
              <div className="export-stats-grid">
                {Object.entries(fileStats).map(([type, count]) => (
                  <div key={type} className="export-stat-item">
                    <span className="export-stat-type">{type.toUpperCase()}</span>
                    <span className="export-stat-count">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              className={`export-button ${exported ? 'success' : ''}`}
              onClick={handleExport}
              disabled={isExporting}
            >
              {isExporting ? (
                <>
                  <div className="export-spinner" />
                  <span>Exporting...</span>
                </>
              ) : exported ? (
                <>
                  <span>✓ Exported!</span>
                </>
              ) : (
                <>
                  <span>⬇ Download ZIP</span>
                </>
              )}
            </button>
          </>
        ) : (
          <div className="export-empty">
            <p>📦 No project loaded</p>
            <p className="export-empty-hint">Upload a ZIP to export</p>
          </div>
        )}
      </div>
    </div>
  );
}
