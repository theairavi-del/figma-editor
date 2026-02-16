import { useEffect, useRef, useCallback, useState } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { buildHtmlDocument } from '../../utils/fileUtils';
import type { ElementData } from '../../types';
import './Canvas.css';

export function Canvas() {
  const {
    currentProject,
    canvas,
    setCanvas,
    activeTool,
    selectedElementId,
    selectElement,
    setElementData,
    saveToHistory
  } = useEditorStore();

  const canvasRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [htmlContent, setHtmlContent] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const elementStartPos = useRef({ x: 0, y: 0 });

  // Build HTML content for iframe
  useEffect(() => {
    if (currentProject) {
      const html = buildHtmlDocument(currentProject);
      setHtmlContent(html);
    }
  }, [currentProject]);

  // Pan functionality
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (activeTool === 'pan' || (e.button === 1) || (e.button === 0 && e.shiftKey)) {
      e.preventDefault();
      setCanvas({
        isPanning: true,
        lastMouseX: e.clientX,
        lastMouseY: e.clientY
      });
    }
  }, [activeTool, setCanvas]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (canvas.isPanning) {
      const deltaX = e.clientX - canvas.lastMouseX;
      const deltaY = e.clientY - canvas.lastMouseY;
      
      setCanvas({
        translateX: canvas.translateX + deltaX,
        translateY: canvas.translateY + deltaY,
        lastMouseX: e.clientX,
        lastMouseY: e.clientY
      });
    }
  }, [canvas.isPanning, canvas.lastMouseX, canvas.lastMouseY, canvas.translateX, canvas.translateY, setCanvas]);

  const handleMouseUp = useCallback(() => {
    setCanvas({ isPanning: false });
  }, [setCanvas]);

  // Wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setCanvas({ scale: Math.max(0.1, Math.min(5, canvas.scale * delta)) });
    }
  }, [canvas.scale, setCanvas]);

  // Handle iframe load
  const handleIframeLoad = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentDocument) return;

    const doc = iframe.contentDocument;

    // Add hover and click handlers to all elements
    const addInteractionHandlers = (element: Element) => {
      const el = element as HTMLElement;
      
      el.addEventListener('mouseenter', () => {
        const visualId = el.getAttribute('data-visual-id');
        if (visualId && activeTool === 'select') {
          el.style.outline = '2px solid #0d99ff';
          el.style.outlineOffset = '-2px';
        }
      });

      el.addEventListener('mouseleave', () => {
        const visualId = el.getAttribute('data-visual-id');
        if (visualId !== selectedElementId) {
          el.style.outline = '';
          el.style.outlineOffset = '';
        }
      });

      el.addEventListener('mousedown', (e) => {
        if (activeTool !== 'select') return;
        
        const visualId = el.getAttribute('data-visual-id');
        if (!visualId) return;

        e.preventDefault();
        e.stopPropagation();
        
        selectElement(visualId);

        // Extract element data
        const rect = el.getBoundingClientRect();
        const computedStyle = iframe.contentWindow!.getComputedStyle(el);
        
        const styles: Record<string, string> = {};
        const relevantProps = [
          'color', 'background-color', 'font-size', 'font-family', 'font-weight',
          'line-height', 'text-align', 'padding', 'margin', 'border-radius',
          'border-width', 'border-color', 'border-style', 'display', 'position',
          'width', 'height', 'top', 'left', 'right', 'bottom', 'z-index',
          'flex-direction', 'justify-content', 'align-items', 'gap'
        ];
        
        relevantProps.forEach(prop => {
          const value = computedStyle.getPropertyValue(prop);
          if (value && value !== 'initial' && value !== 'none') {
            styles[prop] = value;
          }
        });

        // Get inline styles
        for (let i = 0; i < el.style.length; i++) {
          const prop = el.style.item(i);
          styles[prop] = el.style.getPropertyValue(prop);
        }

        const data: ElementData = {
          id: visualId,
          tagName: el.tagName.toLowerCase(),
          className: el.className || undefined,
          styles,
          attributes: {},
          textContent: el.children.length === 0 ? el.textContent || undefined : undefined,
          children: [],
          rect,
          parentId: el.parentElement?.getAttribute('data-visual-id') || undefined,
          index: Array.from(el.parentElement?.children || []).indexOf(el)
        };

        setElementData(data);

        // Start drag if element has position
        if (computedStyle.position === 'absolute' || computedStyle.position === 'fixed') {
          setIsDragging(true);
          dragStartPos.current = { x: e.clientX, y: e.clientY };
          const left = parseInt(computedStyle.left) || 0;
          const top = parseInt(computedStyle.top) || 0;
          elementStartPos.current = { x: left, y: top };
        }
      });

      // Handle drag
      el.addEventListener('mousemove', (e) => {
        if (!isDragging || selectedElementId !== el.getAttribute('data-visual-id')) return;
        
        const deltaX = (e.clientX - dragStartPos.current.x) / canvas.scale;
        const deltaY = (e.clientY - dragStartPos.current.y) / canvas.scale;
        
        const newLeft = elementStartPos.current.x + deltaX;
        const newTop = elementStartPos.current.y + deltaY;
        
        el.style.left = `${newLeft}px`;
        el.style.top = `${newTop}px`;
      });

      el.addEventListener('mouseup', () => {
        if (isDragging) {
          setIsDragging(false);
          saveToHistory();
        }
      });

      // Recursively add to children
      Array.from(el.children).forEach(addInteractionHandlers);
    };

    Array.from(doc.body.children).forEach(addInteractionHandlers);

    // Maintain selection highlight
    if (selectedElementId) {
      const selected = doc.querySelector(`[data-visual-id="${selectedElementId}"]`) as HTMLElement;
      if (selected) {
        selected.style.outline = '2px solid #0d99ff';
        selected.style.outlineOffset = '-2px';
      }
    }
  }, [activeTool, selectElement, setElementData, selectedElementId, isDragging, canvas.scale, saveToHistory]);

  // Re-attach handlers when content changes
  useEffect(() => {
    if (htmlContent && iframeRef.current) {
      const timer = setTimeout(handleIframeLoad, 100);
      return () => clearTimeout(timer);
    }
  }, [htmlContent, handleIframeLoad]);

  // Maintain selection outline
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentDocument) return;

    // Clear all outlines
    iframe.contentDocument.querySelectorAll('[data-visual-id]').forEach((el) => {
      (el as HTMLElement).style.outline = '';
      (el as HTMLElement).style.outlineOffset = '';
    });

    // Apply outline to selected
    if (selectedElementId) {
      const selected = iframe.contentDocument.querySelector(`[data-visual-id="${selectedElementId}"]`) as HTMLElement;
      if (selected) {
        selected.style.outline = '2px solid #0d99ff';
        selected.style.outlineOffset = '-2px';
      }
    }
  }, [selectedElementId]);

  return (
    <div 
      ref={canvasRef}
      className={`canvas ${activeTool === 'pan' ? 'panning' : ''} ${canvas.isPanning ? 'is-panning' : ''}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* Grid Background */}
      <div 
        className="canvas-grid"
        style={{
          backgroundSize: `${20 * canvas.scale}px ${20 * canvas.scale}px`,
          backgroundPosition: `${canvas.translateX}px ${canvas.translateY}px`
        }}
      />

      {/* Canvas Content */}
      <div 
        className="canvas-content"
        style={{
          transform: `translate(${canvas.translateX}px, ${canvas.translateY}px) scale(${canvas.scale})`,
          transformOrigin: '0 0'
        }}
      >
        {htmlContent ? (
          <iframe
            ref={iframeRef}
            data-preview-frame
            srcDoc={htmlContent}
            className="canvas-iframe"
            sandbox="allow-scripts"
            title="Preview"
          />
        ) : (
          <div className="canvas-empty">
            <p>No content loaded</p>
          </div>
        )}
      </div>

      {/* Zoom Indicator */}
      <div className="canvas-zoom-indicator">
        {Math.round(canvas.scale * 100)}%
      </div>
    </div>
  );
}
