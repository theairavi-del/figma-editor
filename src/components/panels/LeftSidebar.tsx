import { useEditorStore } from '../../store/editorStore';
import { LayersPanel } from './LayersPanel';
import { AssetsPanel } from './AssetsPanel';
import './LeftSidebar.css';

export function LeftSidebar() {
  const { activeLeftPanel, setActiveLeftPanel } = useEditorStore();

  return (
    <div className="left-sidebar">
      {/* Tabs */}
      <div className="sidebar-tabs">
        <button
          className={`sidebar-tab ${activeLeftPanel === 'layers' ? 'active' : ''}`}
          onClick={() => setActiveLeftPanel('layers')}
        >
          <span>🗂️ Layers</span>
        </button>
        <button
          className={`sidebar-tab ${activeLeftPanel === 'assets' ? 'active' : ''}`}
          onClick={() => setActiveLeftPanel('assets')}
        >
          <span>🎨 Assets</span>
        </button>
      </div>

      {/* Panel Content */}
      <div className="sidebar-content">
        {activeLeftPanel === 'layers' && <LayersPanel />}
        {activeLeftPanel === 'assets' && <AssetsPanel />}
      </div>
    </div>
  );
}
