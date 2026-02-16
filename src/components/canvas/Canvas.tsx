import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { buildHtmlDocument } from '../../utils/fileUtils';
import type { ElementData } from '../../types';
import './Canvas.css';
import { SelectionOverlay } from './SelectionOverlay';

// Refs for drag state to avoid stale closures in event listeners
interface DragState {
  isDragging: boolean;
  elementId: string | null;
  startX: number;
  startY: number;
  elementStartX: number;
  elementStartY: number;
}

// Element bounds for selection overlay
interface ElementBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  scrollX: number;
  scrollY: number;
}

export function Canvas() {
  const {
    currentProject,
    canvas,
    setCanvas,
    activeTool,
    selectedElementId,
    selectElement,
    setElementData,
    debouncedSaveToHistory
  } = useEditorStore();

  const canvasRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [selectedBounds, setSelectedBounds] = useState<ElementBounds | null>(null);
  const [hoveredBounds, setHoveredBounds] = useState<ElementBounds | null>(null);
  const [spacePressed, setSpacePressed] = useState(false);
  
  // Use refs for drag state to avoid stale closure issues
  const dragStateRef = useRef<DragState>({
    isDragging: false,
    elementId: null,
    startX: 0,
    startY: 0,
    elementStartX: 0,
    elementStartY: 0
  });
  
  // Store handlers in refs for cleanup
  const handlersRef = useRef<Map<HTMLElement, {
    mouseenter: (e: Event) => void;
    mouseleave: (e: Event) => void;
    mousedown: (e: Event) => void;
    mousemove: (e: Event) => void;
    mouseup: (e: Event) => void;
  }>>(new Map());

  // Build HTML content for iframe using useMemo instead of useEffect + useState
  const htmlContent = useMemo(() => {
    if (!currentProject) return '';
    return buildHtmlDocument(currentProject);
  }, [currentProject]);

  // Get element bounds relative to canvas
  const getElementBounds = useCallback((elementId: string | null): ElementBounds | null => {
    const iframe = iframeRef.current;
    if (!iframe?.contentDocument || !elementId) return null;

    const el = iframe.contentDocument.querySelector(`[data-visual-id="${elementId}"]`) as HTMLElement;
    if (!el) return null;

    const rect = el.getBoundingClientRect();
    const iframeRect = iframe.getBoundingClientRect();
    
    return {
      x: rect.left - iframeRect.left + canvas.translateX,
      y: rect.top - iframeRect.top + canvas.translateY,
      width: rect.width,
      height: rect.height,
      scrollX: iframe.contentDocument.documentElement.scrollLeft,
      scrollY: iframe.contentDocument.documentElement.scrollTop
    };
  }, [canvas.translateX, canvas.translateY]);

  // Update selection bounds when selection changes
  useEffect(() => {
    if (selectedElementId) {
      const bounds = getElementBounds(selectedElementId);
      setSelectedBounds(bounds);
    } else {
      setSelectedBounds(null);
    }
  }, [selectedElementId, canvas.scale, canvas.translateX, canvas.translateY, getElementBounds]);

  // Pan functionality
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Middle mouse or space+click or pan tool starts panning
    if (activeTool === 'pan' || e.button === 1 || spacePressed) {
      e.preventDefault();
      setCanvas({
        isPanning: true,
        lastMouseX: e.clientX,
        lastMouseY: e.clientY
      });
    }
  }, [activeTool, spacePressed, setCanvas]);

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

  // Wheel zoom - zoom to mouse position
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      
      const canvasEl = canvasRef.current;
      if (!canvasEl) return;
      
      const rect = canvasEl.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.max(0.1, Math.min(5, canvas.scale * delta));
      
      // Zoom towards mouse position
      const scaleRatio = newScale / canvas.scale;
      const newTranslateX = mouseX - (mouseX - canvas.translateX) * scaleRatio;
      const newTranslateY = mouseY - (mouseY - canvas.translateY) * scaleRatio;
      
      setCanvas({ 
        scale: newScale,
        translateX: newTranslateX,
        translateY: newTranslateY
      });
    }
  }, [canvas.scale, canvas.translateX, canvas.translateY, setCanvas]);

  // Keyboard shortcuts for nudging and spacebar pan
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !spacePressed) {
        e.preventDefault();
        setSpacePressed(true);
      }
      
      // Arrow keys for nudging selected element
      if (selectedElementId && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const step = e.shiftKey ? 10 : 1;
        let handled = false;
        
        const iframe = iframeRef.current;
        if (iframe?.contentDocument) {
          const el = iframe.contentDocument.querySelector(`[data-visual-id="${selectedElementId}"]`) as HTMLElement;
          if (el) {
            const computedStyle = iframe.contentWindow?.getComputedStyle(el);
            const position = computedStyle?.position;
            
            if (position === 'absolute' || position === 'fixed' || position === 'relative') {
              const currentLeft = parseInt(el.style.left || computedStyle?.left || '0');
              const currentTop = parseInt(el.style.top || computedStyle?.top || '0');
              
              switch (e.key) {
                case 'ArrowLeft':
                  el.style.left = `${currentLeft - step}px`;
                  handled = true;
                  break;
                case 'ArrowRight':
                  el.style.left = `${currentLeft + step}px`;
                  handled = true;
                  break;
                case 'ArrowUp':
                  el.style.top = `${currentTop - step}px`;
                  handled = true;
                  break;
                case 'ArrowDown':
                  el.style.top = `${currentTop + step}px`;
                  handled = true;
                  break;
              }
              
              if (handled) {
                e.preventDefault();
                // Update bounds
                const bounds = getElementBounds(selectedElementId);
                setSelectedBounds(bounds);
                // Save to history on key up
              }
            }
          }
        }
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpacePressed(false);
        setCanvas({ isPanning: false });
      }
      
      // Debounced save history after nudging
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key) && selectedElementId) {
        debouncedSaveToHistory('Nudge element', 500);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedElementId, spacePressed, setCanvas, debouncedSaveToHistory, getElementBounds]);

  // Cleanup function to remove all event listeners
  const cleanupHandlers = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentDocument) return;
    
    handlersRef.current.forEach((handlers, el) => {
      el.removeEventListener('mouseenter', handlers.mouseenter);
      el.removeEventListener('mouseleave', handlers.mouseleave);
      el.removeEventListener('mousedown', handlers.mousedown);
      el.removeEventListener('mousemove', handlers.mousemove);
      el.removeEventListener('mouseup', handlers.mouseup);
    });
    handlersRef.current.clear();
  }, []);

  // Handle iframe load
  const handleIframeLoad = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentDocument) return;

    const doc = iframe.contentDocument;
    const contentWindow = iframe.contentWindow;
    if (!contentWindow) return;

    // Cleanup existing handlers first
    cleanupHandlers();

    // Add hover and click handlers to all elements
    const addInteractionHandlers = (element: Element) => {
      const el = element as HTMLElement;
      
      const mouseenterHandler = () => {
        const visualId = el.getAttribute('data-visual-id');
        const currentTool = useEditorStore.getState().activeTool;
        const currentSelected = useEditorStore.getState().selectedElementId;
        
        if (visualId && currentTool === 'select' && visualId !== currentSelected) {
          el.classList.add('visual-editor-hover');
          // Update hover bounds for overlay
          const iframeRect = iframe.getBoundingClientRect();
          const rect = el.getBoundingClientRect();
          setHoveredBounds({
            x: rect.left - iframeRect.left + canvas.translateX,
            y: rect.top - iframeRect.top + canvas.translateY,
            width: rect.width,
            height: rect.height,
            scrollX: 0,
            scrollY: 0
          });
        }
      };

      const mouseleaveHandler = () => {
        el.classList.remove('visual-editor-hover');
        setHoveredBounds(null);
      };

      const mousedownHandler = (e: Event) => {
        const mouseEvent = e as MouseEvent;
        const currentTool = useEditorStore.getState().activeTool;
        if (currentTool !== 'select') return;
        
        const visualId = el.getAttribute('data-visual-id');
        if (!visualId) return;

        mouseEvent.preventDefault();
        mouseEvent.stopPropagation();
        
        selectElement(visualId);

        // Extract element data
        const rect = el.getBoundingClientRect();
        const computedStyle = contentWindow.getComputedStyle(el);
        
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

        setElementData(data);

        // Start drag if element has position
        if (computedStyle.position === 'absolute' || computedStyle.position === 'fixed') {
          dragStateRef.current = {
            isDragging: true,
            elementId: visualId,
            startX: mouseEvent.clientX,
            startY: mouseEvent.clientY,
            elementStartX: parseInt(computedStyle.left) || 0,
            elementStartY: parseInt(computedStyle.top) || 0
          };
        }
      };

      const mousemoveHandler = (e: Event) => {
        const mouseEvent = e as MouseEvent;
        const state = dragStateRef.current;
        const currentScale = useEditorStore.getState().canvas.scale;
        
        if (!state.isDragging) return;
        
        const deltaX = (mouseEvent.clientX - state.startX) / currentScale;
        const deltaY = (mouseEvent.clientY - state.startY) / currentScale;
        
        const newLeft = state.elementStartX + deltaX;
        const newTop = state.elementStartY + deltaY;
        
        el.style.left = `${newLeft}px`;
        el.style.top = `${newTop}px`;
        
        // Update selection bounds during drag
        if (state.elementId) {
          const bounds = getElementBounds(state.elementId);
          setSelectedBounds(bounds);
        }
      };

      const mouseupHandler = () => {
        const state = dragStateRef.current;
        if (state.isDragging) {
          dragStateRef.current = { ...state, isDragging: false, elementId: null };
          debouncedSaveToHistory('Move element', 500);
        }
      };

      // Store handlers for cleanup
      handlersRef.current.set(el, {
        mouseenter: mouseenterHandler,
        mouseleave: mouseleaveHandler,
        mousedown: mousedownHandler,
        mousemove: mousemoveHandler,
        mouseup: mouseupHandler
      });

      el.addEventListener('mouseenter', mouseenterHandler);
      el.addEventListener('mouseleave', mouseleaveHandler);
      el.addEventListener('mousedown', mousedownHandler);
      el.addEventListener('mousemove', mousemoveHandler);
      el.addEventListener('mouseup', mouseupHandler);

      // Recursively add to children
      Array.from(el.children).forEach(addInteractionHandlers);
    };

    Array.from(doc.body.children).forEach(addInteractionHandlers);

    // Maintain selection highlight
    const currentSelectedId = useEditorStore.getState().selectedElementId;
    if (currentSelectedId) {
      const selected = doc.querySelector(`[data-visual-id="${currentSelectedId}"]`) as HTMLElement;
      if (selected) {
        selected.classList.add('visual-editor-selected');
      }
    }
  }, [selectElement, setElementData, debouncedSaveToHistory, cleanupHandlers, canvas.translateX, canvas.translateY, getElementBounds]);

  // Re-attach handlers when content changes
  useEffect(() => {
    if (htmlContent && iframeRef.current) {
      const timer = setTimeout(handleIframeLoad, 100);
      return () => clearTimeout(timer);
    }
  }, [htmlContent, handleIframeLoad]);

  // Maintain selection outline using CSS classes
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentDocument) return;

    const doc = iframe.contentDocument;
    
    // Clear all selection classes
    doc.querySelectorAll('[data-visual-id]').forEach((el) => {
      el.classList.remove('visual-editor-selected');
    });

    // Apply selection class to selected element
    if (selectedElementId) {
      const selected = doc.querySelector(`[data-visual-id="${selectedElementId}"]`) as HTMLElement;
      if (selected) {
        selected.classList.add('visual-editor-selected');
      }
    }
  }, [selectedElementId]);

  // Listen for style changes from store
  useEffect(() => {
    const handleStyleChange = (e: CustomEvent<{ elementId: string; property: string; value: string }>) => {
      const { elementId, property, value } = e.detail;
      const iframe = iframeRef.current;
      if (!iframe?.contentDocument) return;
      
      const el = iframe.contentDocument.querySelector(`[data-visual-id="${elementId}"]`) as HTMLElement;
      if (el) {
        el.style.setProperty(property, value);
        // Update bounds after style change
        const bounds = getElementBounds(elementId);
        setSelectedBounds(bounds);
      }
    };

    const handleTextChange = (e: CustomEvent<{ elementId: string; text: string }>) => {
      const { elementId, text } = e.detail;
      const iframe = iframeRef.current;
      if (!iframe?.contentDocument) return;
      
      const el = iframe.contentDocument.querySelector(`[data-visual-id="${elementId}"]`) as HTMLElement;
      if (el) {
        el.textContent = text;
      }
    };

    window.addEventListener('editor:style-change', handleStyleChange as EventListener);
    window.addEventListener('editor:text-change', handleTextChange as EventListener);

    return () => {
      window.removeEventListener('editor:style-change', handleStyleChange as EventListener);
      window.removeEventListener('editor:text-change', handleTextChange as EventListener);
    };
  }, [getElementBounds]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupHandlers();
    };
  }, [cleanupHandlers]);

  // Double-click zoom indicator to fit
  const handleZoomIndicatorDoubleClick = useCallback(() => {
    setCanvas({
      scale: 1,
      translateX: 0,
      translateY: 0
    });
  }, [setCanvas]);

  return (
    <div 
      ref={canvasRef}
      className={`canvas ${activeTool === 'pan' || spacePressed ? 'panning' : ''} ${canvas.isPanning ? 'is-panning' : ''}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* Grid Background - now scales properly */}
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
            <div className="canvas-empty-icon">📄</div>
            <p>Drop a ZIP file to get started</p>
            <p className="canvas-empty-hint">or use the upload button above</p>
          </div>
        )}
      </div>

      {/* Selection Overlay - renders outside iframe for better UX */}
      {selectedBounds && (
        <SelectionOverlay 
          bounds={selectedBounds}
          scale={canvas.scale}
          isSelected={true}
        />
      )}
      
      {/* Hover Overlay */}
      {hoveredBounds && !selectedBounds && (
        <SelectionOverlay 
          bounds={hoveredBounds}
          scale={canvas.scale}
          isSelected={false}
        />
      )}

      {/* Zoom Indicator */}
      <div 
        className="canvas-zoom-indicator"
        onDoubleClick={handleZoomIndicatorDoubleClick}
        title="Double-click to reset zoom"
      >
        {Math.round(canvas.scale * 100)}%
      </div>
      
      {/* Canvas Hint */}
      {currentProject && (
        <div className="canvas-hint">
          <span>Space + drag to pan</span>
          <span>•</span>
          <span>Ctrl + scroll to zoom</span>
          <span>•</span>
          <span>Arrow keys to nudge</span>
        </div>
      )}
    </div>
  );
}
