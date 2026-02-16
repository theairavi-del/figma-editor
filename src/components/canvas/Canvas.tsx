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
  hasMoved: boolean;
  dragOffsetX: number;
  dragOffsetY: number;
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

// Snap line for visual feedback
interface SnapLine {
  orientation: 'horizontal' | 'vertical';
  position: number;
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
  const [snapLines, setSnapLines] = useState<SnapLine[]>([]);
  const [isSnapping, setIsSnapping] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(true);
  
  // Use refs for drag state to avoid stale closure issues
  const dragStateRef = useRef<DragState>({
    isDragging: false,
    elementId: null,
    startX: 0,
    startY: 0,
    elementStartX: 0,
    elementStartY: 0,
    hasMoved: false,
    dragOffsetX: 0,
    dragOffsetY: 0
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
      scrollX: 0,
      scrollY: 0
    };
  }, [canvas.translateX, canvas.translateY]);

  // Calculate snap lines based on other elements
  const calculateSnapLines = useCallback((currentElId: string, x: number, y: number, width: number, height: number): SnapLine[] => {
    if (!snapEnabled) return [];
    
    const iframe = iframeRef.current;
    if (!iframe?.contentDocument) return [];

    const doc = iframe.contentDocument;
    const snapThreshold = 8 / canvas.scale; // Snap threshold in canvas coordinates
    const lines: SnapLine[] = [];
    
    // Current element edges
    const currentEdges = {
      left: x,
      right: x + width,
      top: y,
      bottom: y + height,
      centerX: x + width / 2,
      centerY: y + height / 2
    };

    // Check all other positioned elements
    doc.querySelectorAll('[data-visual-id]').forEach((el) => {
      const id = el.getAttribute('data-visual-id');
      if (id === currentElId) return;

      const htmlEl = el as HTMLElement;
      const computedStyle = iframe.contentWindow?.getComputedStyle(htmlEl);
      if (!computedStyle || computedStyle.position === 'static') return;

      const elLeft = parseInt(computedStyle.left) || 0;
      const elTop = parseInt(computedStyle.top) || 0;
      const elWidth = htmlEl.offsetWidth;
      const elHeight = htmlEl.offsetHeight;

      const otherEdges = {
        left: elLeft,
        right: elLeft + elWidth,
        top: elTop,
        bottom: elTop + elHeight,
        centerX: elLeft + elWidth / 2,
        centerY: elTop + elHeight / 2
      };

      // Check for snap alignment
      const checks = [
        { current: currentEdges.left, target: otherEdges.left, orientation: 'vertical' as const },
        { current: currentEdges.left, target: otherEdges.centerX, orientation: 'vertical' as const },
        { current: currentEdges.left, target: otherEdges.right, orientation: 'vertical' as const },
        { current: currentEdges.centerX, target: otherEdges.left, orientation: 'vertical' as const },
        { current: currentEdges.centerX, target: otherEdges.centerX, orientation: 'vertical' as const },
        { current: currentEdges.centerX, target: otherEdges.right, orientation: 'vertical' as const },
        { current: currentEdges.right, target: otherEdges.left, orientation: 'vertical' as const },
        { current: currentEdges.right, target: otherEdges.centerX, orientation: 'vertical' as const },
        { current: currentEdges.right, target: otherEdges.right, orientation: 'vertical' as const },
        { current: currentEdges.top, target: otherEdges.top, orientation: 'horizontal' as const },
        { current: currentEdges.top, target: otherEdges.centerY, orientation: 'horizontal' as const },
        { current: currentEdges.top, target: otherEdges.bottom, orientation: 'horizontal' as const },
        { current: currentEdges.centerY, target: otherEdges.top, orientation: 'horizontal' as const },
        { current: currentEdges.centerY, target: otherEdges.centerY, orientation: 'horizontal' as const },
        { current: currentEdges.centerY, target: otherEdges.bottom, orientation: 'horizontal' as const },
        { current: currentEdges.bottom, target: otherEdges.top, orientation: 'horizontal' as const },
        { current: currentEdges.bottom, target: otherEdges.centerY, orientation: 'horizontal' as const },
        { current: currentEdges.bottom, target: otherEdges.bottom, orientation: 'horizontal' as const },
      ];

      for (const check of checks) {
        if (Math.abs(check.current - check.target) < snapThreshold) {
          const position = check.orientation === 'vertical' ? check.target : check.target;
          // Only add if not already present
          if (!lines.some(l => l.orientation === check.orientation && Math.abs(l.position - position) < 1)) {
            lines.push({ orientation: check.orientation, position });
          }
        }
      }
    });

    return lines;
  }, [canvas.scale, snapEnabled]);

  // Apply snapping to position
  const applySnapping = useCallback((x: number, y: number, width: number, height: number, elementId: string): { x: number; y: number; snapped: boolean } => {
    if (!snapEnabled) return { x, y, snapped: false };

    const lines = calculateSnapLines(elementId, x, y, width, height);
    setSnapLines(lines);
    
    let newX = x;
    let newY = y;
    let snapped = false;
    const snapThreshold = 8 / canvas.scale;

    for (const line of lines) {
      if (line.orientation === 'vertical') {
        // Check if left, center, or right edge aligns
        const leftDist = Math.abs(x - line.position);
        const centerDist = Math.abs((x + width / 2) - line.position);
        const rightDist = Math.abs((x + width) - line.position);

        if (leftDist < snapThreshold) {
          newX = line.position;
          snapped = true;
        } else if (centerDist < snapThreshold) {
          newX = line.position - width / 2;
          snapped = true;
        } else if (rightDist < snapThreshold) {
          newX = line.position - width;
          snapped = true;
        }
      } else {
        // Check if top, center, or bottom edge aligns
        const topDist = Math.abs(y - line.position);
        const centerDist = Math.abs((y + height / 2) - line.position);
        const bottomDist = Math.abs((y + height) - line.position);

        if (topDist < snapThreshold) {
          newY = line.position;
          snapped = true;
        } else if (centerDist < snapThreshold) {
          newY = line.position - height / 2;
          snapped = true;
        } else if (bottomDist < snapThreshold) {
          newY = line.position - height;
          snapped = true;
        }
      }
    }

    setIsSnapping(snapped);
    return { x: newX, y: newY, snapped };
  }, [calculateSnapLines, canvas.scale, snapEnabled]);

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
      
      // Toggle snap with Cmd/Ctrl + '
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        setSnapEnabled(prev => !prev);
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
        const currentDragState = dragStateRef.current;
        
        // Don't show hover if dragging
        if (visualId && currentTool === 'select' && visualId !== currentSelected && !currentDragState.isDragging) {
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
        const currentDragState = dragStateRef.current;
        if (!currentDragState.isDragging) {
          setHoveredBounds(null);
        }
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
          const elRect = el.getBoundingClientRect();
          
          dragStateRef.current = {
            isDragging: true,
            elementId: visualId,
            startX: mouseEvent.clientX,
            startY: mouseEvent.clientY,
            elementStartX: parseInt(computedStyle.left) || 0,
            elementStartY: parseInt(computedStyle.top) || 0,
            hasMoved: false,
            dragOffsetX: mouseEvent.clientX - elRect.left,
            dragOffsetY: mouseEvent.clientY - elRect.top
          };
          
          // Add dragging class for cursor
          el.classList.add('visual-editor-dragging');
          
          // Update cursor
          if (canvasRef.current) {
            canvasRef.current.style.cursor = 'grabbing';
          }
        }
      };

      const mousemoveHandler = (e: Event) => {
        const mouseEvent = e as MouseEvent;
        const state = dragStateRef.current;
        const currentScale = useEditorStore.getState().canvas.scale;
        
        if (!state.isDragging || !state.elementId) return;
        
        // Calculate delta from start
        const deltaX = (mouseEvent.clientX - state.startX) / currentScale;
        const deltaY = (mouseEvent.clientY - state.startY) / currentScale;
        
        // Check if we've moved enough to count as a drag
        if (!state.hasMoved) {
          const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
          if (distance < 3) return; // 3px threshold
          state.hasMoved = true;
        }
        
        let newLeft = state.elementStartX + deltaX;
        let newTop = state.elementStartY + deltaY;
        
        // Apply snapping
        const el = doc.querySelector(`[data-visual-id="${state.elementId}"]`) as HTMLElement;
        if (el && snapEnabled) {
          const width = el.offsetWidth;
          const height = el.offsetHeight;
          const snapped = applySnapping(newLeft, newTop, width, height, state.elementId);
          newLeft = snapped.x;
          newTop = snapped.y;
        }
        
        el.style.left = `${newLeft}px`;
        el.style.top = `${newTop}px`;
        
        // Update selection bounds during drag
        const bounds = getElementBounds(state.elementId);
        setSelectedBounds(bounds);
      };

      const mouseupHandler = () => {
        const state = dragStateRef.current;
        if (state.isDragging) {
          // Remove dragging class
          if (state.elementId) {
            const el = doc.querySelector(`[data-visual-id="${state.elementId}"]`) as HTMLElement;
            if (el) {
              el.classList.remove('visual-editor-dragging');
            }
          }
          
          // Reset cursor
          if (canvasRef.current) {
            canvasRef.current.style.cursor = '';
          }
          
          dragStateRef.current = { 
            isDragging: false, 
            elementId: null,
            startX: 0,
            startY: 0,
            elementStartX: 0,
            elementStartY: 0,
            hasMoved: false,
            dragOffsetX: 0,
            dragOffsetY: 0
          };
          
          // Clear snap lines
          setSnapLines([]);
          setIsSnapping(false);
          
          // Only save to history if we actually moved
          if (state.hasMoved) {
            debouncedSaveToHistory('Move element', 500);
          }
        }
      };

      // Store handlers for cleanup
      handlersRef.current.set(el, {
        mouseenter: mouseenterHandler,
        mouseleave: mouseleaveHandler,
        mousedown: mouseenterHandler,
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
  }, [selectElement, setElementData, debouncedSaveToHistory, cleanupHandlers, canvas.translateX, canvas.translateY, getElementBounds, applySnapping, snapEnabled]);

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
      className={`canvas ${activeTool === 'pan' || spacePressed ? 'panning' : ''} ${canvas.isPanning ? 'is-panning' : ''} ${isSnapping ? 'is-snapping' : ''}`}
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

      {/* Snap Lines */}
      {snapLines.map((line, index) => (
        <div
          key={index}
          className={`snap-line ${line.orientation}`}
          style={{
            [line.orientation === 'vertical' ? 'left' : 'top']: `${line.position * canvas.scale + canvas.translateX}px`,
            [line.orientation === 'vertical' ? 'top' : 'left']: 0,
            [line.orientation === 'vertical' ? 'height' : 'width']: '100%',
            [line.orientation === 'vertical' ? 'width' : 'height']: '1px',
          }}
        />
      ))}

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
      
      {/* Snap Indicator */}
      <div 
        className={`canvas-snap-indicator ${snapEnabled ? 'active' : ''}`}
        onClick={() => setSnapEnabled(!snapEnabled)}
        title={`Snap to elements (${snapEnabled ? 'on' : 'off'}) - Cmd+\\ to toggle`}
      >
        {snapEnabled ? '🧲' : '○'}
      </div>
      
      {/* Canvas Hint */}
      {currentProject && (
        <div className="canvas-hint">
          <span>Space + drag to pan</span>
          <span>•</span>
          <span>Ctrl + scroll to zoom</span>
          <span>•</span>
          <span>Cmd+\ snap</span>
        </div>
      )}
    </div>
  );
}
