import { useEffect, useState, useRef, useCallback } from 'react';
import { useEditorStore } from '../../store/editorStore';
import type { ElementData } from '../../types';
import './LayersPanel.css';

interface LayerItemProps {
  element: ElementData;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function LayerItem({ element, depth, selectedId, onSelect }: LayerItemProps) {
  const [expanded, setExpanded] = useState(true);
  const isSelected = selectedId === element.id;
  const hasChildren = element.children.length > 0;

  const getIcon = () => {
    switch (element.tagName) {
      case 'img': return '🖼️';
      case 'p':
      case 'span':
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6': return 'T';
      default: return '□';
    }
  };

  const getLabel = () => {
    if (element.className) {
      const className = element.className.split(' ')[0];
      return `${element.tagName}.${className}`;
    }
    return element.tagName;
  };

  return (
    <div className="layer-item-container">
      <div
        className={`layer-item ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => onSelect(element.id)}
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
        <span className="layer-name">{getLabel()}</span>
      </div>
      {expanded && hasChildren && (
        <div className="layer-children">
          {element.children.map(child => (
            <LayerItem
              key={child.id}
              element={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
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
    currentProject
  } = useEditorStore();
  const [rootElements, setRootElements] = useState<ElementData[]>([]);
  const observerRef = useRef<MutationObserver | null>(null);

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
        rect,
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

  useEffect(() => {
    // Cleanup previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    const iframe = document.querySelector('iframe[data-preview-frame]') as HTMLIFrameElement;
    if (!iframe?.contentDocument) return;

    const doc = iframe.contentDocument;

    // Initial extraction - syncing with iframe DOM (external system)
    // This is intentional: we're subscribing to external iframe DOM state
    // eslint-disable-next-line react-hooks/set-state-in-effect
    extractElements();

    // Set up MutationObserver for efficient DOM change detection
    observerRef.current = new MutationObserver((mutations) => {
      // Only re-extract if there are meaningful changes
      const hasMeaningfulChanges = mutations.some(mutation => 
        mutation.type === 'childList' || 
        (mutation.type === 'attributes' && mutation.attributeName !== 'style')
      );
      
      if (hasMeaningfulChanges) {
        extractElements();
      }
    });

    observerRef.current.observe(doc.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-visual-id', 'class', 'id']
    });

    return () => {
      observerRef.current?.disconnect();
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

  return (
    <div className="layers-panel">
      <div className="layers-header">
        <span className="layers-title">Layers</span>
        <span className="layers-count">{rootElements.length} elements</span>
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
            />
          ))
        )}
      </div>
    </div>
  );
}
