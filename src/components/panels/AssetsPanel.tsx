import { useEditorStore } from '../../store/editorStore';
import './AssetsPanel.css';

export function AssetsPanel() {
  const { currentProject } = useEditorStore();

  const getIcon = (type: string) => {
    switch (type) {
      case 'image': return '🖼️';
      case 'css': return '🎨';
      case 'js': return '⚡';
      case 'html': return '📄';
      default: return '📎';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'image': return 'Images';
      case 'css': return 'Stylesheets';
      case 'js': return 'Scripts';
      case 'html': return 'HTML Files';
      default: return 'Other Files';
    }
  };

  const groupedFiles = currentProject?.files.reduce((acc, file) => {
    if (!acc[file.type]) acc[file.type] = [];
    acc[file.type].push(file);
    return acc;
  }, {} as Record<string, typeof currentProject.files>) || {};

  return (
    <div className="assets-panel">
      <div className="assets-header">
        <span className="assets-title">Assets</span>
        <span className="assets-count">
          {currentProject?.files.length || 0} files
        </span>
      </div>
      <div className="assets-list">
        {currentProject?.files.length === 0 ? (
          <div className="assets-empty">
            <p>No assets found</p>
            <p className="assets-empty-hint">Upload a ZIP to see assets</p>
          </div>
        ) : (
          Object.entries(groupedFiles).map(([type, files]) => (
            <div key={type} className="assets-group">
              <div className="assets-group-header">
                {getIcon(type)}
                <span>{getTypeLabel(type)}</span>
                <span className="assets-group-count">({files.length})</span>
              </div>
              <div className="assets-group-items">
                {files.map(file => (
                  <div key={file.path} className="asset-item" title={file.path}>
                    <span className="asset-name">{file.path.split('/').pop()}</span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
