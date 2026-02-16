import { useState, useCallback, useMemo } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { parseColor, formatColor, COLOR_PRESETS } from '../../utils/colorUtils';
import './PropertiesPanel.css';

interface SectionProps {
  title: string;
  icon: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  badge?: string;
}

function Section({ title, icon, children, defaultExpanded = true, badge }: SectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="prop-section">
      <button 
        className="prop-section-header"
        onClick={() => setExpanded(!expanded)}
      >
        <span>{icon}</span>
        <span>{title}</span>
        {badge && <span className="prop-section-badge">{badge}</span>}
        <span className={`prop-section-chevron ${expanded ? 'expanded' : ''}`}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
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
  value: string | number;
  onChange: (value: string) => void;
  type?: 'text' | 'number';
  placeholder?: string;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
}

function PropInput({ label, value, onChange, type = 'text', placeholder, suffix, min, max, step }: PropInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className="prop-input">
      <label>{label}</label>
      <div className="prop-input-wrapper">
        <input
          type={type}
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          min={min}
          max={max}
          step={step}
        />
        {suffix && <span className="prop-input-suffix">{suffix}</span>}
      </div>
    </div>
  );
}

interface PropSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; icon?: string }[];
  icons?: boolean;
}

function PropSelect({ label, value, onChange, options, icons }: PropSelectProps) {
  return (
    <div className="prop-input">
      <label>{label}</label>
      <select 
        value={value} 
        onChange={(e) => onChange(e.target.value)}
        className="prop-select"
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>
            {icons && opt.icon ? `${opt.icon} ` : ''}{opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// Enhanced Color Picker Component
interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  showAlpha?: boolean;
}

function ColorPicker({ label, value, onChange, showAlpha = false }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const parsed = parseColor(value) || { hex: '#000000', alpha: 1, rgb: { r: 0, g: 0, b: 0, a: 1 } };
  
  const displayValue = value || 'transparent';
  const isTransparent = displayValue === 'transparent' || parsed.alpha === 0;

  const handleHexChange = (hex: string) => {
    if (showAlpha) {
      onChange(formatColor(hex, parsed.alpha));
    } else {
      onChange(hex.toUpperCase());
    }
  };

  const handleAlphaChange = (alpha: number) => {
    onChange(formatColor(parsed.hex, alpha));
  };

  return (
    <div className="prop-color-picker">
      <label>{label}</label>
      <div className="prop-color-trigger-wrapper">
        <button 
          className="prop-color-trigger"
          onClick={() => setIsOpen(!isOpen)}
          style={{ backgroundColor: isTransparent ? 'transparent' : parsed.hex }}
        >
          {isTransparent && <div className="prop-color-transparent-pattern" />}
        </button>
        <input
          type="text"
          value={displayValue}
          onChange={(e) => onChange(e.target.value)}
          className="prop-color-text"
          placeholder="#000000"
        />
      </div>
      
      {isOpen && (
        <div className="prop-color-popover">
          <div className="prop-color-presets">
            {COLOR_PRESETS.map((color) => (
              <button
                key={color}
                className="prop-color-swatch"
                style={{ backgroundColor: color }}
                onClick={() => handleHexChange(color)}
              />
            ))}
          </div>
          <div className="prop-color-custom">
            <input
              type="color"
              value={parsed.hex}
              onChange={(e) => handleHexChange(e.target.value)}
            />
            <span>Custom</span>
          </div>
          {showAlpha && (
            <div className="prop-color-alpha">
              <label>Opacity</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={parsed.alpha}
                onChange={(e) => handleAlphaChange(parseFloat(e.target.value))}
              />
              <span>{Math.round(parsed.alpha * 100)}%</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Enhanced Spacing Box Control (Figma-style)
interface SpacingBoxProps {
  values: {
    top: string;
    right: string;
    bottom: string;
    left: string;
  };
  onChange: (side: 'top' | 'right' | 'bottom' | 'left', value: string) => void;
  label: string;
  icon: string;
}

function SpacingBox({ values, onChange, label, icon }: SpacingBoxProps) {
  const [linked, setLinked] = useState(false);
  
  // Parse values to numbers
  const parseVal = (val: string) => parseInt(val.replace(/px/g, '')) || 0;
  const topVal = parseVal(values.top);
  const rightVal = parseVal(values.right);
  const bottomVal = parseVal(values.bottom);
  const leftVal = parseVal(values.left);

  const handleChange = (side: 'top' | 'right' | 'bottom' | 'left', val: string) => {
    const numVal = parseInt(val) || 0;
    
    if (linked) {
      // Update all sides when linked
      onChange('top', `${numVal}px`);
      onChange('right', `${numVal}px`);
      onChange('bottom', `${numVal}px`);
      onChange('left', `${numVal}px`);
    } else {
      onChange(side, val ? `${numVal}px` : '');
    }
  };

  return (
    <div className="prop-spacing-box">
      <div className="prop-spacing-header">
        <span>{icon} {label}</span>
        <button 
          className={`prop-spacing-link ${linked ? 'linked' : ''}`}
          onClick={() => setLinked(!linked)}
          title={linked ? 'Unlink sides' : 'Link sides'}
        >
          {linked ? '🔗' : '◻'}
        </button>
      </div>
      <div className="prop-spacing-visual">
        <input
          className="prop-spacing-input prop-spacing-top"
          type="number"
          value={topVal || ''}
          onChange={(e) => handleChange('top', e.target.value)}
          placeholder="-"
        />
        <input
          className="prop-spacing-input prop-spacing-right"
          type="number"
          value={rightVal || ''}
          onChange={(e) => handleChange('right', e.target.value)}
          placeholder="-"
        />
        <input
          className="prop-spacing-input prop-spacing-bottom"
          type="number"
          value={bottomVal || ''}
          onChange={(e) => handleChange('bottom', e.target.value)}
          placeholder="-"
        />
        <input
          className="prop-spacing-input prop-spacing-left"
          type="number"
          value={leftVal || ''}
          onChange={(e) => handleChange('left', e.target.value)}
          placeholder="-"
        />
        <div className="prop-spacing-center">□</div>
      </div>
    </div>
  );
}

// Border Control Component
interface BorderControlProps {
  styles: Record<string, string>;
  onChange: (property: string, value: string) => void;
}

function BorderControl({ styles, onChange }: BorderControlProps) {
  const width = parseInt(styles['border-width']?.replace('px', '')) || 0;
  const style = styles['border-style'] || 'solid';
  const color = styles['border-color'] || '#000000';
  const radius = parseInt(styles['border-radius']?.replace('px', '')) || 0;

  return (
    <div className="prop-border-control">
      <div className="prop-grid">
        <PropInput
          label="Width"
          value={width}
          onChange={(val) => onChange('border-width', val ? `${val}px` : '0')}
          type="number"
          suffix="px"
        />
        <PropSelect
          label="Style"
          value={style}
          onChange={(val) => onChange('border-style', val)}
          options={[
            { value: 'none', label: 'None' },
            { value: 'solid', label: 'Solid' },
            { value: 'dashed', label: 'Dashed' },
            { value: 'dotted', label: 'Dotted' },
            { value: 'double', label: 'Double' },
          ]}
        />
      </div>
      {width > 0 && (
        <>
          <ColorPicker
            label="Color"
            value={color}
            onChange={(val) => onChange('border-color', val)}
          />
          <PropInput
            label="Radius"
            value={radius}
            onChange={(val) => onChange('border-radius', val ? `${val}px` : '0')}
            type="number"
            suffix="px"
          />
        </>
      )}
    </div>
  );
}

// Shadow Control Component
interface ShadowControlProps {
  styles: Record<string, string>;
  onChange: (property: string, value: string) => void;
}

function ShadowControl({ styles, onChange }: ShadowControlProps) {
  const shadow = styles['box-shadow'] || '';
  const hasShadow = Boolean(shadow && shadow !== 'none');
  
  // Parse shadow values
  const parseShadow = (s: string) => {
    if (!s || s === 'none') return { x: 0, y: 4, blur: 8, spread: 0, color: 'rgba(0,0,0,0.1)' };
    const match = s.match(/(-?\d+)px\s+(-?\d+)px\s+(-?\d+)px(?:\s+(-?\d+)px)?\s+(.+)/);
    if (!match) return { x: 0, y: 4, blur: 8, spread: 0, color: 'rgba(0,0,0,0.1)' };
    return {
      x: parseInt(match[1]) || 0,
      y: parseInt(match[2]) || 0,
      blur: parseInt(match[3]) || 0,
      spread: parseInt(match[4]) || 0,
      color: match[5] || 'rgba(0,0,0,0.1)'
    };
  };

  const s = parseShadow(shadow);

  const updateShadow = (updates: Partial<typeof s>) => {
    const newS = { ...s, ...updates };
    const value = `${newS.x}px ${newS.y}px ${newS.blur}px ${newS.spread}px ${newS.color}`;
    onChange('box-shadow', value);
  };

  return (
    <div className="prop-shadow-control">
      <div className="prop-shadow-toggle">
        <label className="prop-shadow-checkbox">
          <input 
            type="checkbox" 
            checked={hasShadow}
            onChange={(e) => onChange('box-shadow', e.target.checked ? '0px 4px 8px 0px rgba(0,0,0,0.1)' : 'none')}
          />
          <span>Enable Shadow</span>
        </label>
      </div>
      {hasShadow && (
        <div className="prop-shadow-fields">
          <div className="prop-grid">
            <PropInput
              label="X"
              value={s.x}
              onChange={(val) => updateShadow({ x: parseInt(val) || 0 })}
              type="number"
              suffix="px"
            />
            <PropInput
              label="Y"
              value={s.y}
              onChange={(val) => updateShadow({ y: parseInt(val) || 0 })}
              type="number"
              suffix="px"
            />
            <PropInput
              label="Blur"
              value={s.blur}
              onChange={(val) => updateShadow({ blur: parseInt(val) || 0 })}
              type="number"
              suffix="px"
            />
            <PropInput
              label="Spread"
              value={s.spread}
              onChange={(val) => updateShadow({ spread: parseInt(val) || 0 })}
              type="number"
              suffix="px"
            />
          </div>
          <ColorPicker
            label="Shadow Color"
            value={s.color}
            onChange={(val) => updateShadow({ color: val })}
            showAlpha
          />
        </div>
      )}
    </div>
  );
}

// Flexbox Controls
interface FlexControlProps {
  styles: Record<string, string>;
  onChange: (property: string, value: string) => void;
}

function FlexControl({ styles, onChange }: FlexControlProps) {
  const isFlex = styles['display'] === 'flex';
  
  if (!isFlex) return null;

  return (
    <div className="prop-flex-control">
      <div className="prop-grid">
        <PropSelect
          label="Direction"
          value={styles['flex-direction'] || 'row'}
          onChange={(val) => onChange('flex-direction', val)}
          options={[
            { value: 'row', label: 'Row →', icon: '→' },
            { value: 'row-reverse', label: 'Row ←', icon: '←' },
            { value: 'column', label: 'Column ↓', icon: '↓' },
            { value: 'column-reverse', label: 'Column ↑', icon: '↑' },
          ]}
        />
        <PropSelect
          label="Justify"
          value={styles['justify-content'] || 'flex-start'}
          onChange={(val) => onChange('justify-content', val)}
          options={[
            { value: 'flex-start', label: 'Start' },
            { value: 'center', label: 'Center' },
            { value: 'flex-end', label: 'End' },
            { value: 'space-between', label: 'Space Between' },
            { value: 'space-around', label: 'Space Around' },
          ]}
        />
        <PropSelect
          label="Align"
          value={styles['align-items'] || 'stretch'}
          onChange={(val) => onChange('align-items', val)}
          options={[
            { value: 'stretch', label: 'Stretch' },
            { value: 'flex-start', label: 'Start' },
            { value: 'center', label: 'Center' },
            { value: 'flex-end', label: 'End' },
          ]}
        />
        <PropInput
          label="Gap"
          value={styles['gap']?.replace('px', '') || ''}
          onChange={(val) => onChange('gap', val ? `${val}px` : '')}
          type="number"
          suffix="px"
        />
      </div>
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

  // Use derived state pattern - local state mirrors props but doesn't need effect
  const localStyles = selectedElementData?.styles ?? {};
  const localText = selectedElementData?.textContent ?? '';

  const handleStyleChange = useCallback((property: string, value: string) => {
    if (!selectedElementId) return;
    updateElementStyle(selectedElementId, property, value);
  }, [selectedElementId, updateElementStyle]);

  const handleTextChange = useCallback((value: string) => {
    if (!selectedElementId) return;
    updateElementText(selectedElementId, value);
  }, [selectedElementId, updateElementText]);

  const handleBlur = useCallback(() => {
    saveToHistory();
  }, [saveToHistory]);

  // Extract spacing values
  const getSpacingValue = (property: string, shorthand: string) => {
    const specific = localStyles[property];
    const short = localStyles[shorthand];
    if (specific) return specific;
    if (short) {
      // Parse shorthand (simplified)
      const parts = short.split(' ').map(v => v.replace('px', ''));
      if (property.includes('top')) return parts[0] ? `${parts[0]}px` : '';
      if (property.includes('right')) return parts[1] || parts[0] ? `${parts[1] || parts[0]}px` : '';
      if (property.includes('bottom')) return parts[2] || parts[0] ? `${parts[2] || parts[0]}px` : '';
      if (property.includes('left')) return parts[3] || parts[1] || parts[0] ? `${parts[3] || parts[1] || parts[0]}px` : '';
    }
    return '';
  };

  const padding = useMemo(() => ({
    top: getSpacingValue('padding-top', 'padding'),
    right: getSpacingValue('padding-right', 'padding'),
    bottom: getSpacingValue('padding-bottom', 'padding'),
    left: getSpacingValue('padding-left', 'padding'),
  }), [localStyles]);

  const margin = useMemo(() => ({
    top: getSpacingValue('margin-top', 'margin'),
    right: getSpacingValue('margin-right', 'margin'),
    bottom: getSpacingValue('margin-bottom', 'margin'),
    left: getSpacingValue('margin-left', 'margin'),
  }), [localStyles]);

  const handlePaddingChange = (side: 'top' | 'right' | 'bottom' | 'left', value: string) => {
    const property = `padding-${side}`;
    handleStyleChange(property, value);
  };

  const handleMarginChange = (side: 'top' | 'right' | 'bottom' | 'left', value: string) => {
    const property = `margin-${side}`;
    handleStyleChange(property, value);
  };

  if (!selectedElementData) {
    return (
      <div className="properties-panel">
        <div className="properties-empty">
          <div className="properties-empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
            </svg>
          </div>
          <p>Select an element on the canvas to edit its properties</p>
        </div>
      </div>
    );
  }

  const elementName = selectedElementData.className 
    ? `${selectedElementData.tagName}.${selectedElementData.className.split(' ')[0]}`
    : selectedElementData.tagName;

  const displayMode = localStyles['display'] || 'block';
  const isFlexOrGrid = displayMode === 'flex' || displayMode === 'grid';

  return (
    <div className="properties-panel">
      {/* Element Header */}
      <div className="properties-header">
        <span className="properties-element-name">{elementName}</span>
        <span className="properties-element-id">ID: {selectedElementData.id}</span>
      </div>

      {/* Content Section */}
      {selectedElementData.textContent !== undefined && (
        <Section title="Content" icon="📝">
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
      <Section title="Layout" icon="📐" badge={displayMode.toUpperCase()}>
        <div className="prop-grid">
          <PropSelect
            label="Display"
            value={displayMode}
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
          <PropSelect
            label="Position"
            value={localStyles['position'] || 'static'}
            onChange={(val) => handleStyleChange('position', val)}
            options={[
              { value: 'static', label: 'Static' },
              { value: 'relative', label: 'Relative' },
              { value: 'absolute', label: 'Absolute' },
              { value: 'fixed', label: 'Fixed' },
              { value: 'sticky', label: 'Sticky' },
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
        {isFlexOrGrid && <FlexControl styles={localStyles} onChange={handleStyleChange} />}
      </Section>

      {/* Spacing Section */}
      <Section title="Spacing" icon="□">
        <SpacingBox
          label="Padding"
          icon="🎯"
          values={padding}
          onChange={handlePaddingChange}
        />
        <div className="prop-divider" />
        <SpacingBox
          label="Margin"
          icon="↔"
          values={margin}
          onChange={handleMarginChange}
        />
      </Section>

      {/* Appearance Section */}
      <Section title="Appearance" icon="🎨">
        <ColorPicker
          label="Background Color"
          value={localStyles['background-color'] || localStyles['background'] || ''}
          onChange={(val) => handleStyleChange('background-color', val)}
          showAlpha
        />
        <ColorPicker
          label="Text Color"
          value={localStyles['color'] || ''}
          onChange={(val) => handleStyleChange('color', val)}
        />
      </Section>

      {/* Border Section */}
      <Section title="Border" icon="▣">
        <BorderControl styles={localStyles} onChange={handleStyleChange} />
      </Section>

      {/* Effects Section */}
      <Section title="Effects" icon="✨">
        <ShadowControl styles={localStyles} onChange={handleStyleChange} />
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
          <PropInput
            label="Line Height"
            value={localStyles['line-height']?.replace('px', '') || ''}
            onChange={(val) => handleStyleChange('line-height', val)}
            placeholder="normal"
          />
        </div>
        <div className="prop-grid">
          <PropSelect
            label="Font Weight"
            value={localStyles['font-weight'] || 'normal'}
            onChange={(val) => handleStyleChange('font-weight', val)}
            options={[
              { value: 'normal', label: 'Normal (400)' },
              { value: '300', label: 'Light (300)' },
              { value: '500', label: 'Medium (500)' },
              { value: '600', label: 'Semibold (600)' },
              { value: 'bold', label: 'Bold (700)' },
              { value: '800', label: 'Extra Bold (800)' },
            ]}
          />
          <PropSelect
            label="Text Align"
            value={localStyles['text-align'] || 'left'}
            onChange={(val) => handleStyleChange('text-align', val)}
            options={[
              { value: 'left', label: 'Left', icon: '◀' },
              { value: 'center', label: 'Center', icon: '◆' },
              { value: 'right', label: 'Right', icon: '▶' },
              { value: 'justify', label: 'Justify', icon: '≡' },
            ]}
          />
        </div>
      </Section>
    </div>
  );
}
