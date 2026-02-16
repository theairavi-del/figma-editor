import { useEditorStore } from '../../store/editorStore';
import './Toolbar.css';

export function Toolbar() {
  const {
    activeTool,
    setActiveTool,
    zoomIn,
    zoomOut,
    resetZoom,
    canvas,
    undo,
    redo,
    canUndo,
    canRedo,
    currentProject
  } = useEditorStore();

  const handleNewProject = () => {
    if (confirm('Start a new project? Unsaved changes will be lost.')) {
      localStorage.removeItem('figma-editor-storage');
      window.location.reload();
    }
  };

  return (
    <div className="toolbar">
      {/* Left: Logo and Project Name */}
      <div className="toolbar-section toolbar-left">
        <div className="toolbar-logo">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="6" cy="6" r="5" fill="#0d99ff"/>
            <circle cx="18" cy="6" r="5" fill="#f5a623"/>
            <circle cx="6" cy="18" r="5" fill="#14ae5c"/>
            <circle cx="18" cy="18" r="5" fill="#f24822"/>
          </svg>
        </div>
        <span className="toolbar-project-name">
          {currentProject?.name || 'Untitled'}
        </span>
      </div>

      {/* Center: Tools */}
      <div className="toolbar-section toolbar-center">
        <div className="toolbar-tools">
          <button
            className={`toolbar-tool ${activeTool === 'select' ? 'active' : ''}`}
            onClick={() => setActiveTool('select')}
            title="Select (V)"
          >
            <span>↖</span>
          </button>
          <button
            className={`toolbar-tool ${activeTool === 'pan' ? 'active' : ''}`}
            onClick={() => setActiveTool('pan')}
            title="Pan (H)"
          >
            <span>✋</span>
          </button>
          <button
            className={`toolbar-tool ${activeTool === 'text' ? 'active' : ''}`}
            onClick={() => setActiveTool('text')}
            title="Text (T)"
          >
            <span>T</span>
          </button>
        </div>

        <div className="toolbar-divider" />

        <div className="toolbar-actions">
          <button
            className={`toolbar-action history-btn ${!canUndo() ? 'disabled' : ''}`}
            onClick={undo}
            disabled={!canUndo()}
            title="Undo (Ctrl+Z)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 7v6h6" />
              <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
            </svg>
          </button>
          <button
            className={`toolbar-action history-btn ${!canRedo() ? 'disabled' : ''}`}
            onClick={redo}
            disabled={!canRedo()}
            title="Redo (Ctrl+Shift+Z)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 7v6h-6" />
              <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" />
            </svg>
          </button>
        </div>

        <div className="toolbar-divider" />

        <div className="toolbar-zoom">
          <button
            className="toolbar-action"
            onClick={zoomOut}
            title="Zoom Out"
          >
            <span>−</span>
          </button>
          <button
            className="toolbar-zoom-value"
            onClick={resetZoom}
            title="Reset Zoom"
          >
            {Math.round(canvas.scale * 100)}%
          </button>
          <button
            className="toolbar-action"
            onClick={zoomIn}
            title="Zoom In"
          >
            <span>+</span>
          </button>
        </div>
      </div>

      {/* Right: Export and New */}
      <div className="toolbar-section toolbar-right">
        <button
          className="toolbar-button secondary"
          onClick={handleNewProject}
        >
          <span>📂 Open</span>
        </button>
      </div>
    </div>
  );
}
