import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useEditorStore } from '../../store/editorStore';
import type { ElementData } from '../../types';
import './LayersPanel.css';

// Drag state for layer reordering
interface LayerDragState {
  isDragging: boolean;
  draggedId: string | null;
  dropTargetId: string | null;
  dropPosition: 'before' | 'after' | 'inside' | null;
}

interface LayerItemProps {
  element: ElementData;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  dragState: LayerDragState;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDragOver: (targetId: string, position: 'before' | 'after' | 'inside') => void;
  allElements: ElementData[];
}

function LayerItem({ 
  element, 
  depth, 
  selectedId, 
  onSelect, 
  dragState, 
  onDragStart, 
  onDragEnd, 
  onDragOver,
  allElements 
}: LayerItemProps) {
  const [expanded, setExpanded] = useState(true);
  const itemRef = useRef<HTMLDivElement>(null);
  const isSelected = selectedId === element.id;
  const hasChildren = element.children.length > 0;
  const isDragging = dragState.draggedId === element.id;
  const isDropTarget = dragState.dropTargetId === element.id;
  
  const getIcon = () => {
    switch (element.tagName) {
      case 'img': return '🖼️';
      case 'button': return '🔘';
      case 'input':
      case 'textarea': return '📝';
      case 'a': return '🔗';
      case 'svg':
      case 'path':
      case 'circle': return '🎨';
      case 'p':
      case 'span':
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6': return 'T';
      case 'div': return '▭';
      case 'section': return '📦';
      case 'nav': return '🧭';
      case 'header': return '📰';
      case 'footer': return '🦶';
      case 'ul':
      case 'ol': return '☰';
      case 'li': return '•';
      default: return '□';
    }
  };

  const getLabel = () => {
    if (element.className) {
      const className = element.className.split(' ')[0];
      return `${element.tagName}.${className}`;
    }
    if (element.textContent && element.textContent.length < 20) {
      return `${element.tagName} "${element.textContent}"`;
    }
    return element.tagName;
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', element.id);
    onDragStart(element.id);
    
    // Set drag image (optional - browser default is usually fine)
    if (itemRef.current) {
      const rect = itemRef.current.getBoundingClientRect();
      e.dataTransfer.setDragImage(itemRef.current, rect.width / 2, 14);
    }
  };

  const handleDragEnd = () => {
    onDragEnd();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isDragging) return;
    
    const rect = itemRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const mouseY = e.clientY - rect.top;
    const itemHeight = rect.height;
    
    // Determine drop position based on mouse location
    let position: 'before' | 'after' | 'inside';
    if (mouseY < itemHeight * 0.25) {
      position = 'before';
    } else if (mouseY > itemHeight * 0.75) {
      position = 'after';
    } else {
      position = 'inside';
    }
    
    onDragOver(element.id, position);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const draggedId = e.dataTransfer.getData('text/plain');
    if (draggedId && draggedId !== element.id) {
      // Dispatch custom event for the drop
      window.dispatchEvent(new CustomEvent('layer:reorder', {
        detail: {
          draggedId,
          targetId: element.id,
          position: dragState.dropPosition
        }
      }));
    }
    onDragEnd();
  };

  // Get drop indicator class
  const getDropIndicatorClass = () => {
    if (!isDropTarget || dragState.dropPosition === null) return '';
    return `drop-target-${dragState.dropPosition}`;
  };

  return (
    <div className="layer-item-container">
      <div
        ref={itemRef}
        className={`layer-item ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''} ${getDropIndicatorClass()}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => onSelect(element.id)}
        draggable={true}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {hasChildren ? (
          <button
            className="layer-expand-btn"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
          >
            {expanded ? '▼' : '▶'}
          </button>
        ) : (
          <span className="layer-expand-placeholder" />
        )}
        <span className="layer-icon">{getIcon()}</span>
        <span className="layer-name" title={getLabel()}>{getLabel()}</span>
        
        {/* Drag handle */}
        <span className="layer-drag-handle">⋮⋮</span>
      </div>
      
      {/* Drop indicator lines */}
      {isDropTarget && dragState.dropPosition === 'before' && (
        <div className="drop-indicator before" style={{ marginLeft: `${depth * 16 + 8}px` }} />
      )}
      {isDropTarget && dragState.dropPosition === 'after' && (
        <div className="drop-indicator after" style={{ marginLeft: `${depth * 16 + 8}px` }} />
      )}
      
      {expanded && hasChildren && (
        <div className="layer-children">
          {element.children.map(child => (
            <LayerItem
              key={child.id}
              element={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              dragState={dragState}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragOver={onDragOver}
              allElements={allElements}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function LayersPanel() {
  const {
    selectedElementId,
    selectElement,
    setElementData,
    currentProject,
    updateProject
  } = useEditorStore();
  const [rootElements, setRootElements] = useState<ElementData[]>([]);
  const [dragState, setDragState] = useState<LayerDragState>({
    isDragging: false,
    draggedId: null,
    dropTargetId: null,
    dropPosition: null
  });
  const observerRef = useRef<MutationObserver | null>(null);

  // Flatten all elements for easier lookup
  const allElements = useMemo(() => {
    const flatten = (elements: ElementData[]): ElementData[] => {
      return elements.reduce((acc, el) => {
        acc.push(el);
        if (el.children.length > 0) {
          acc.push(...flatten(el.children));
        }
        return acc;
      }, [] as ElementData[]);
    };
    return flatten(rootElements);
  }, [rootElements]);

  const extractElements = useCallback(() => {
    const iframe = document.querySelector('iframe[data-preview-frame]') as HTMLIFrameElement;
    if (!iframe?.contentDocument || !iframe.contentWindow) return;

    const body = iframe.contentDocument.body;
    const contentWindow = iframe.contentWindow;
    const elements: ElementData[] = [];

    const processElement = (el: Element): ElementData | null => {
      const visualId = el.getAttribute('data-visual-id');
      if (!visualId) return null;

      const rect = el.getBoundingClientRect();
      const computedStyle = contentWindow.getComputedStyle(el);

      const styles: Record<string, string> = {};
      const relevantProps = [
        'color', 'background-color', 'font-size', 'font-family', 'font-weight',
        'padding', 'margin', 'border-radius', 'display', 'position',
        'width', 'height'
      ];
      relevantProps.forEach(prop => {
        const value = computedStyle.getPropertyValue(prop);
        if (value && value !== 'initial' && value !== 'none') {
          styles[prop] = value;
        }
      });

      const attributes: Record<string, string> = {};
      for (let i = 0; i < el.attributes.length; i++) {
        const attr = el.attributes[i];
        if (!attr.name.startsWith('data-visual') && attr.name !== 'style') {
          attributes[attr.name] = attr.value;
        }
      }

      return {
        id: visualId,
        tagName: el.tagName.toLowerCase(),
        className: (el as HTMLElement).className || undefined,
        styles,
        attributes,
        textContent: el.children.length === 0 ? el.textContent || undefined : undefined,
        children: Array.from(el.children)
          .map(child => processElement(child))
          .filter((child): child is ElementData => child !== null),
        rect: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          top: rect.top,
          left: rect.left,
          right: rect.right,
          bottom: rect.bottom
        },
        parentId: el.parentElement?.getAttribute('data-visual-id') || undefined,
        index: Array.from(el.parentElement?.children || []).indexOf(el)
      };
    };

    Array.from(body.children).forEach(child => {
      const data = processElement(child);
      if (data) elements.push(data);
    });

    setRootElements(elements);
  }, []);

  // Handle layer reordering
  const handleLayerReorder = useCallback((e: CustomEvent<{ draggedId: string; targetId: string; position: 'before' | 'after' | 'inside' }>) => {
    const { draggedId, targetId, position } = e.detail;
    if (!currentProject) return;

    const iframe = document.querySelector('iframe[data-preview-frame]') as HTMLIFrameElement;
    if (!iframe?.contentDocument) return;

    const doc = iframe.contentDocument;
    const draggedEl = doc.querySelector(`[data-visual-id="${draggedId}"]`) as HTMLElement;
    const targetEl = doc.querySelector(`[data-visual-id="${targetId}"]`) as HTMLElement;

    if (!draggedEl || !targetEl) return;

    // Perform the DOM manipulation based on drop position
    switch (position) {
      case 'before':
        targetEl.parentElement?.insertBefore(draggedEl, targetEl);
        break;
      case 'after':
        targetEl.parentElement?.insertBefore(draggedEl, targetEl.nextSibling);
        break;
      case 'inside':
        targetEl.appendChild(draggedEl);
        break;
    }

    // Update the project state
    updateProject(project => {
      const updatedFiles = project.files.map(file => {
        if (file.type === 'html') {
          return {
            ...file,
            content: doc.documentElement.outerHTML
          };
        }
        return file;
      });

      return {
        ...project,
        files: updatedFiles,
        modifiedAt: Date.now()
      };
    });

    // Re-extract elements to update the layer tree
    extractElements();

    // Dispatch event for history
    window.dispatchEvent(new CustomEvent('editor:save-history', {
      detail: { label: 'Reorder layer' }
    }));
  }, [currentProject, updateProject, extractElements]);

  useEffect(() => {
    window.addEventListener('layer:reorder', handleLayerReorder as EventListener);
    return () => {
      window.removeEventListener('layer:reorder', handleLayerReorder as EventListener);
    };
  }, [handleLayerReorder]);

  useEffect(() => {
    const iframe = document.querySelector('iframe[data-preview-frame]') as HTMLIFrameElement;
    if (!iframe?.contentDocument) return;

    const doc = iframe.contentDocument;

    // Initial extraction - syncing with iframe DOM (external system)
    // Using setTimeout to defer state update until after render
    const timeoutId = setTimeout(() => {
      extractElements();
    }, 0);

    // Set up MutationObserver for efficient DOM change detection
    const observer = new MutationObserver((mutations) => {
      // Only re-extract if there are meaningful changes
      const hasMeaningfulChanges = mutations.some(mutation => 
        mutation.type === 'childList' || 
        (mutation.type === 'attributes' && mutation.attributeName !== 'style')
      );
      
      if (hasMeaningfulChanges) {
        extractElements();
      }
    });

    observer.observe(doc.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-visual-id', 'class', 'id']
    });

    observerRef.current = observer;

    return () => {
      clearTimeout(timeoutId);
      observer.disconnect();
      observerRef.current = null;
    };
  }, [currentProject?.id, extractElements]);

  const handleSelect = (id: string) => {
    selectElement(id);
    
    // Also update element data
    const findElement = (elements: ElementData[]): ElementData | null => {
      for (const el of elements) {
        if (el.id === id) return el;
        const found = findElement(el.children);
        if (found) return found;
      }
      return null;
    };

    const data = findElement(rootElements);
    if (data) {
      setElementData(data);
    }
  };

  const handleDragStart = (id: string) => {
    setDragState({
      isDragging: true,
      draggedId: id,
      dropTargetId: null,
      dropPosition: null
    });
  };

  const handleDragEnd = () => {
    setDragState({
      isDragging: false,
      draggedId: null,
      dropTargetId: null,
      dropPosition: null
    });
  };

  const handleDragOver = (targetId: string, position: 'before' | 'after' | 'inside') => {
    // Prevent dropping inside itself or its descendants
    const findElement = (elements: ElementData[], id: string): ElementData | null => {
      for (const el of elements) {
        if (el.id === id) return el;
        const found = findElement(el.children, id);
        if (found) return found;
      }
      return null;
    };

    const draggedEl = dragState.draggedId ? findElement(rootElements, dragState.draggedId) : null;
    if (draggedEl) {
      const isDescendant = (parent: ElementData, childId: string): boolean => {
        if (parent.id === childId) return true;
        return parent.children.some(c => isDescendant(c, childId));
      };

      // Can't drop inside itself or its descendants
      if (isDescendant(draggedEl, targetId)) {
        return;
      }
    }

    setDragState(prev => ({
      ...prev,
      dropTargetId: targetId,
      dropPosition: position
    }));
  };

  // Count total elements recursively
  const countElements = (elements: ElementData[]): number => {
    return elements.reduce((count, el) => {
      return count + 1 + countElements(el.children);
    }, 0);
  };

  const totalElements = countElements(rootElements);

  return (
    <div className={`layers-panel ${dragState.isDragging ? 'is-dragging' : ''}`}>
      <div className="layers-header">
        <span className="layers-title">Layers</span>
        <span className="layers-count">{totalElements} elements</span>
      </div>
      <div className="layers-list">
        {rootElements.length === 0 ? (
          <div className="layers-empty">
            <p>No elements found</p>
            <p className="layers-empty-hint">Upload a project to see layers</p>
          </div>
        ) : (
          rootElements.map(element => (
            <LayerItem
              key={element.id}
              element={element}
              depth={0}
              selectedId={selectedElementId}
              onSelect={handleSelect}
              dragState={dragState}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragOver={handleDragOver}
              allElements={allElements}
            />
          )))
        }
      </div>
    </div>
  );
}
