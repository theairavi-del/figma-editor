import { PropertiesPanel } from './PropertiesPanel';
import { ExportPanel } from './ExportPanel';
import { useState } from 'react';
import './RightSidebar.css';

export function RightSidebar() {
  const [activeTab, setActiveTab] = useState<'properties' | 'export'>('properties');

  return (
    <div className="right-sidebar">
      {/* Tabs */}
      <div className="sidebar-tabs">
        <button
          className={`sidebar-tab ${activeTab === 'properties' ? 'active' : ''}`}
          onClick={() => setActiveTab('properties')}
        >
          <span>⚙️ Design</span>
        </button>
        <button
          className={`sidebar-tab ${activeTab === 'export' ? 'active' : ''}`}
          onClick={() => setActiveTab('export')}
        >
          <span>⬇️ Export</span>
        </button>
      </div>

      {/* Panel Content */}
      <div className="sidebar-content">
        {activeTab === 'properties' && <PropertiesPanel />}
        {activeTab === 'export' && <ExportPanel />}
      </div>
    </div>
  );
}
