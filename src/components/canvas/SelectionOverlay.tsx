import './SelectionOverlay.css';

interface SelectionOverlayProps {
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  scale: number;
  isSelected: boolean;
}

export function SelectionOverlay({ bounds, scale, isSelected }: SelectionOverlayProps) {
  const handleSize = 8 / scale;
  const borderWidth = 1 / scale;
  
  // Calculate handle positions
  const handles = [
    { x: 0, y: 0, cursor: 'nw-resize' }, // top-left
    { x: bounds.width / 2, y: 0, cursor: 'n-resize' }, // top-center
    { x: bounds.width, y: 0, cursor: 'ne-resize' }, // top-right
    { x: bounds.width, y: bounds.height / 2, cursor: 'e-resize' }, // right-center
    { x: bounds.width, y: bounds.height, cursor: 'se-resize' }, // bottom-right
    { x: bounds.width / 2, y: bounds.height, cursor: 's-resize' }, // bottom-center
    { x: 0, y: bounds.height, cursor: 'sw-resize' }, // bottom-left
    { x: 0, y: bounds.height / 2, cursor: 'w-resize' }, // left-center
  ];

  return (
    <div
      className={`selection-overlay ${isSelected ? 'selected' : 'hovered'}`}
      style={{
        left: bounds.x,
        top: bounds.y,
        width: bounds.width,
        height: bounds.height,
        borderWidth: `${borderWidth}px`,
      }}
    >
      {/* Border */}
      <div className="selection-border" />
      
      {/* Size Label */}
      <div 
        className="selection-label"
        style={{
          fontSize: `${11 / scale}px`,
          padding: `${2 / scale}px ${6 / scale}px`,
        }}
      >
        {Math.round(bounds.width)} × {Math.round(bounds.height)}
      </div>
      
      {/* Resize Handles - only show for selected */}
      {isSelected && handles.map((handle, index) => (
        <div
          key={index}
          className="selection-handle"
          style={{
            left: handle.x - handleSize / 2,
            top: handle.y - handleSize / 2,
            width: handleSize,
            height: handleSize,
            cursor: handle.cursor,
          }}
        />
      ))}
    </div>
  );
}
