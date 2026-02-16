import { useState, useCallback } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { createZipFromProject, formatFileSize } from '../../utils/fileUtils';
import './ExportPanel.css';

type ExportStatus = 'idle' | 'exporting' | 'success' | 'error';

export function ExportPanel() {
  const { currentProject } = useEditorStore();
  const [status, setStatus] = useState<ExportStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastExported, setLastExported] = useState<Date | null>(null);

  const handleExport = useCallback(async () => {
    if (!currentProject) return;

    setStatus('exporting');
    setProgress(0);
    setErrorMessage(null);

    try {
      const blob = await createZipFromProject(currentProject, (percent) => {
        setProgress(percent);
      });
      
      // Create download link
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentProject.name}-exported.zip`;
      document.body.appendChild(a);
      
      // Trigger download
      a.click();
      
      // Cleanup
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setStatus('success');
      setLastExported(new Date());
      
      // Reset status after delay
      setTimeout(() => {
        setStatus('idle');
        setProgress(0);
      }, 2000);
    } catch (error) {
      console.error('Export failed:', error);
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Export failed. Please try again.');
      
      // Reset error after delay
      setTimeout(() => {
        setStatus('idle');
        setErrorMessage(null);
      }, 5000);
    }
  }, [currentProject]);

  // Calculate file stats
  const fileStats = currentProject?.files.reduce((acc, file) => {
    acc[file.type] = (acc[file.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  const totalSize = currentProject?.files.reduce((acc, file) => acc + (file.size || 0), 0) || 0;
  const estimatedExportSize = currentProject?.totalSize || totalSize;

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
                <span className="export-info-value" title={currentProject.name}>
                  {currentProject.name}
                </span>
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
              {estimatedExportSize > 0 && (
                <div className="export-info-item">
                  <span className="export-info-label">Est. Size</span>
                  <span className="export-info-value">~{formatFileSize(estimatedExportSize)}</span>
                </div>
              )}
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

            {status === 'exporting' && (
              <div className="export-progress">
                <div className="export-progress-bar">
                  <div 
                    className="export-progress-fill" 
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="export-progress-text">{progress}%</span>
              </div>
            )}

            {status === 'error' && errorMessage && (
              <div className="export-error">
                <span className="export-error-icon">⚠️</span>
                <span className="export-error-text">{errorMessage}</span>
              </div>
            )}

            {lastExported && status === 'success' && (
              <div className="export-last">
                Last exported: {lastExported.toLocaleTimeString()}
              </div>
            )}

            <button
              className={`export-button ${status === 'success' ? 'success' : ''} ${status === 'error' ? 'error' : ''}`}
              onClick={handleExport}
              disabled={status === 'exporting'}
            >
              {status === 'exporting' ? (
                <>
                  <div className="export-spinner" />
                  <span>Exporting... {progress}%</span>
                </>
              ) : status === 'success' ? (
                <>
                  <span className="export-check">✓</span>
                  <span>Exported!</span>
                </>
              ) : status === 'error' ? (
                <>
                  <span>⚠ Try Again</span>
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
            <span className="export-empty-icon">📦</span>
            <p>No project loaded</p>
            <p className="export-empty-hint">Upload a ZIP to export</p>
          </div>
        )}
      </div>
    </div>
  );
}
