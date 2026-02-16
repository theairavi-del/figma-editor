import { useEffect, useState, useCallback } from 'react';
import { useEditorStore } from '../../store/editorStore';
import './PropertiesPanel.css';

interface SectionProps {
  title: string;
  icon: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}

function Section({ title, icon, children, defaultExpanded = true }: SectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="prop-section">
      <button 
        className="prop-section-header"
        onClick={() => setExpanded(!expanded)}
      >
        <span>{icon}</span>
        <span>{title}</span>
        <span className={`prop-section-chevron ${expanded ? 'expanded' : ''}`}>
          ▼
        </span>
      </button>
      {expanded && (
        <div className="prop-section-content">
          {children}
        </div>
      )}
    </div>
  );
}

interface PropInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'number' | 'color';
  placeholder?: string;
  suffix?: string;
}

function PropInput({ label, value, onChange, type = 'text', placeholder, suffix }: PropInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className="prop-input">
      <label>{label}</label>
      <div className="prop-input-wrapper">
        {type === 'color' ? (
          <div className="prop-color-input">
            <input
              type="color"
              value={value || '#000000'}
              onChange={handleChange}
            />
            <input
              type="text"
              value={value}
              onChange={handleChange}
              placeholder={placeholder}
            />
          </div>
        ) : (
          <>
            <input
              type={type}
              value={value}
              onChange={handleChange}
              placeholder={placeholder}
            />
            {suffix && <span className="prop-input-suffix">{suffix}</span>}
          </>
        )}
      </div>
    </div>
  );
}

interface PropSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}

function PropSelect({ label, value, onChange, options }: PropSelectProps) {
  return (
    <div className="prop-input">
      <label>{label}</label>
      <select 
        value={value} 
        onChange={(e) => onChange(e.target.value)}
        className="prop-select"
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

export function PropertiesPanel() {
  const { 
    selectedElementData, 
    selectedElementId,
    updateElementStyle, 
    updateElementText,
    saveToHistory
  } = useEditorStore();

  const [localStyles, setLocalStyles] = useState<Record<string, string>>({});
  const [localText, setLocalText] = useState('');

  useEffect(() => {
    if (selectedElementData) {
      setLocalStyles(selectedElementData.styles || {});
      setLocalText(selectedElementData.textContent || '');
    }
  }, [selectedElementData?.id]);

  const handleStyleChange = useCallback((property: string, value: string) => {
    if (!selectedElementId) return;
    
    setLocalStyles(prev => ({ ...prev, [property]: value }));
    updateElementStyle(selectedElementId, property, value);
  }, [selectedElementId, updateElementStyle]);

  const handleTextChange = useCallback((value: string) => {
    if (!selectedElementId) return;
    
    setLocalText(value);
    updateElementText(selectedElementId, value);
  }, [selectedElementId, updateElementText]);

  const handleBlur = useCallback(() => {
    saveToHistory();
  }, [saveToHistory]);

  if (!selectedElementData) {
    return (
      <div className="properties-panel">
        <div className="properties-empty">
          <span className="properties-empty-icon">👆</span>
          <p>Select an element on the canvas to edit its properties</p>
        </div>
      </div>
    );
  }

  const elementName = selectedElementData.className 
    ? `${selectedElementData.tagName}.${selectedElementData.className.split(' ')[0]}`
    : selectedElementData.tagName;

  return (
    <div className="properties-panel">
      {/* Element Header */}
      <div className="properties-header">
        <span className="properties-element-name">{elementName}</span>
        <span className="properties-element-id">ID: {selectedElementData.id}</span>
      </div>

      {/* Content Section */}
      {selectedElementData.textContent !== undefined && (
        <Section title="Content" icon="T">
          <div className="prop-textarea">
            <textarea
              value={localText}
              onChange={(e) => handleTextChange(e.target.value)}
              onBlur={handleBlur}
              rows={3}
              placeholder="Enter text content..."
            />
          </div>
        </Section>
      )}

      {/* Layout Section */}
      <Section title="Layout" icon="📐">
        <div className="prop-grid">
          <PropSelect
            label="Display"
            value={localStyles['display'] || 'block'}
            onChange={(val) => handleStyleChange('display', val)}
            options={[
              { value: 'block', label: 'Block' },
              { value: 'inline', label: 'Inline' },
              { value: 'inline-block', label: 'Inline Block' },
              { value: 'flex', label: 'Flex' },
              { value: 'grid', label: 'Grid' },
              { value: 'none', label: 'None' },
            ]}
          />
          <PropInput
            label="Width"
            value={localStyles['width'] || ''}
            onChange={(val) => handleStyleChange('width', val)}
            placeholder="auto"
          />
          <PropInput
            label="Height"
            value={localStyles['height'] || ''}
            onChange={(val) => handleStyleChange('height', val)}
            placeholder="auto"
          />
        </div>
      </Section>

      {/* Spacing Section */}
      <Section title="Spacing" icon="□">
        <div className="prop-grid-4">
          <PropInput
            label="Top"
            value={(localStyles['padding-top'] || localStyles['padding'] || '').toString().replace('px', '')}
            onChange={(val) => handleStyleChange('padding-top', val ? `${val}px` : '')}
            type="number"
            suffix="px"
          />
          <PropInput
            label="Right"
            value={(localStyles['padding-right'] || localStyles['padding'] || '').toString().replace('px', '')}
            onChange={(val) => handleStyleChange('padding-right', val ? `${val}px` : '')}
            type="number"
            suffix="px"
          />
          <PropInput
            label="Bottom"
            value={(localStyles['padding-bottom'] || localStyles['padding'] || '').toString().replace('px', '')}
            onChange={(val) => handleStyleChange('padding-bottom', val ? `${val}px` : '')}
            type="number"
            suffix="px"
          />
          <PropInput
            label="Left"
            value={(localStyles['padding-left'] || localStyles['padding'] || '').toString().replace('px', '')}
            onChange={(val) => handleStyleChange('padding-left', val ? `${val}px` : '')}
            type="number"
            suffix="px"
          />
        </div>
        <div className="prop-divider" />
        <div className="prop-grid-4">
          <PropInput
            label="M-Top"
            value={(localStyles['margin-top'] || localStyles['margin'] || '').toString().replace('px', '')}
            onChange={(val) => handleStyleChange('margin-top', val ? `${val}px` : '')}
            type="number"
            suffix="px"
          />
          <PropInput
            label="M-Right"
            value={(localStyles['margin-right'] || localStyles['margin'] || '').toString().replace('px', '')}
            onChange={(val) => handleStyleChange('margin-right', val ? `${val}px` : '')}
            type="number"
            suffix="px"
          />
          <PropInput
            label="M-Bottom"
            value={(localStyles['margin-bottom'] || localStyles['margin'] || '').toString().replace('px', '')}
            onChange={(val) => handleStyleChange('margin-bottom', val ? `${val}px` : '')}
            type="number"
            suffix="px"
          />
          <PropInput
            label="M-Left"
            value={(localStyles['margin-left'] || localStyles['margin'] || '').toString().replace('px', '')}
            onChange={(val) => handleStyleChange('margin-left', val ? `${val}px` : '')}
            type="number"
            suffix="px"
          />
        </div>
      </Section>

      {/* Appearance Section */}
      <Section title="Appearance" icon="🎨">
        <div className="prop-grid">
          <PropInput
            label="Text Color"
            value={localStyles['color'] || ''}
            onChange={(val) => handleStyleChange('color', val)}
            type="color"
          />
          <PropInput
            label="Background"
            value={localStyles['background-color'] || localStyles['background'] || ''}
            onChange={(val) => handleStyleChange('background-color', val)}
            type="color"
          />
          <PropInput
            label="Border Radius"
            value={localStyles['border-radius']?.replace('px', '') || ''}
            onChange={(val) => handleStyleChange('border-radius', val ? `${val}px` : '')}
            type="number"
            suffix="px"
          />
        </div>
      </Section>

      {/* Typography Section */}
      <Section title="Typography" icon="🔤">
        <div className="prop-grid">
          <PropInput
            label="Font Size"
            value={localStyles['font-size']?.replace('px', '') || ''}
            onChange={(val) => handleStyleChange('font-size', val ? `${val}px` : '')}
            type="number"
            suffix="px"
          />
          <PropSelect
            label="Font Weight"
            value={localStyles['font-weight'] || 'normal'}
            onChange={(val) => handleStyleChange('font-weight', val)}
            options={[
              { value: 'normal', label: 'Normal' },
              { value: 'bold', label: 'Bold' },
              { value: '300', label: 'Light' },
              { value: '500', label: 'Medium' },
              { value: '700', label: 'Bold (700)' },
            ]}
          />
          <PropSelect
            label="Text Align"
            value={localStyles['text-align'] || 'left'}
            onChange={(val) => handleStyleChange('text-align', val)}
            options={[
              { value: 'left', label: 'Left' },
              { value: 'center', label: 'Center' },
              { value: 'right', label: 'Right' },
              { value: 'justify', label: 'Justify' },
            ]}
          />
        </div>
      </Section>
    </div>
  );
}
