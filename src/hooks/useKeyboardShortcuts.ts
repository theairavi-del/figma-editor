import { useEffect, useCallback, useRef, useState, useMemo } from 'react';
import { useEditorStore } from '../store/editorStore';
// Keyboard shortcut types

// Keyboard shortcut definition
interface Shortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  action: () => void;
  description: string;
  global?: boolean; // Listen even when input is focused
}

// Visual feedback state
interface ShortcutFeedback {
  action: string;
  visible: boolean;
}

export function useKeyboardShortcuts() {
  const [feedback, setFeedback] = useState<ShortcutFeedback | null>(null);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const store = useEditorStore();
  const { 
    undo, 
    redo, 
    canUndo, 
    canRedo,
    selectElement,
    setActiveTool,
    zoomIn,
    zoomOut,
    resetZoom,
    flushHistory
  } = store;

  // Show visual feedback for shortcuts
  const showFeedback = useCallback((action: string) => {
    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current);
    }
    
    setFeedback({ action, visible: true });
    
    feedbackTimeoutRef.current = setTimeout(() => {
      setFeedback(null);
    }, 1000);
  }, []);

  // Define all shortcuts - memoized to prevent effect re-runs on every render
  const shortcuts = useMemo<Shortcut[]>(() => [
    // Undo/Redo
    {
      key: 'z',
      ctrl: true,
      action: () => {
        if (canUndo()) {
          undo();
          showFeedback('Undo');
        }
      },
      description: 'Undo'
    },
    {
      key: 'z',
      ctrl: true,
      shift: true,
      action: () => {
        if (canRedo()) {
          redo();
          showFeedback('Redo');
        }
      },
      description: 'Redo'
    },
    {
      key: 'y',
      ctrl: true,
      action: () => {
        if (canRedo()) {
          redo();
          showFeedback('Redo');
        }
      },
      description: 'Redo (alternate)'
    },

    // Tools
    {
      key: 'v',
      action: () => {
        setActiveTool('select');
        showFeedback('Select Tool');
      },
      description: 'Select tool',
      global: true
    },
    {
      key: 'h',
      action: () => {
        setActiveTool('pan');
        showFeedback('Hand Tool');
      },
      description: 'Hand/Pan tool',
      global: true
    },
    {
      key: 't',
      action: () => {
        setActiveTool('text');
        showFeedback('Text Tool');
      },
      description: 'Text tool',
      global: true
    },

    // Zoom
    {
      key: '+',
      ctrl: true,
      action: () => {
        zoomIn();
        showFeedback('Zoom In');
      },
      description: 'Zoom in'
    },
    {
      key: '=',
      ctrl: true,
      action: () => {
        zoomIn();
        showFeedback('Zoom In');
      },
      description: 'Zoom in'
    },
    {
      key: '-',
      ctrl: true,
      action: () => {
        zoomOut();
        showFeedback('Zoom Out');
      },
      description: 'Zoom out'
    },
    {
      key: '0',
      ctrl: true,
      action: () => {
        resetZoom();
        showFeedback('Reset Zoom');
      },
      description: 'Reset zoom'
    },
    {
      key: '1',
      ctrl: true,
      action: () => {
        resetZoom();
        showFeedback('Fit to Screen');
      },
      description: 'Fit to screen'
    },

    // Selection
    {
      key: 'Escape',
      action: () => {
        selectElement(null);
        showFeedback('Deselected');
      },
      description: 'Deselect',
      global: true
    },
    {
      key: 'a',
      ctrl: true,
      action: () => {
        // TODO: Implement select all
        showFeedback('Select All');
      },
      description: 'Select all'
    },
    {
      key: 'd',
      action: () => {
        selectElement(null);
        showFeedback('Deselected');
      },
      description: 'Deselect',
      global: true
    },

    // History flush (force save)
    {
      key: 's',
      ctrl: true,
      action: () => {
        flushHistory();
        showFeedback('Saved');
      },
      description: 'Force save'
    },

    // Delete
    {
      key: 'Delete',
      action: () => {
        // TODO: Implement delete
        showFeedback('Delete');
      },
      description: 'Delete selected'
    },
    {
      key: 'Backspace',
      action: () => {
        // TODO: Implement delete
        showFeedback('Delete');
      },
      description: 'Delete selected'
    },
  ], [canUndo, canRedo, undo, redo, setActiveTool, zoomIn, zoomOut, resetZoom, selectElement, flushHistory, showFeedback]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs (unless marked global)
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || 
                      target.tagName === 'TEXTAREA' || 
                      target.isContentEditable;

      for (const shortcut of shortcuts) {
        const keyMatches = e.key.toLowerCase() === shortcut.key.toLowerCase() ||
                          e.key === shortcut.key; // For special keys like Escape
        
        const ctrlMatches = !!shortcut.ctrl === (e.ctrlKey || e.metaKey);
        const shiftMatches = !!shortcut.shift === e.shiftKey;
        const altMatches = !!shortcut.alt === e.altKey;
        
        if (keyMatches && ctrlMatches && shiftMatches && altMatches) {
          // Skip if in input and not global
          if (isInput && !shortcut.global) {
            continue;
          }
          
          e.preventDefault();
          shortcut.action();
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, [shortcuts]);

  return { feedback, shortcuts };
}

// Get all shortcuts for help display
export function getAllShortcuts(): { key: string; description: string }[] {
  return [
    { key: 'V', description: 'Select tool' },
    { key: 'H', description: 'Hand/Pan tool' },
    { key: 'T', description: 'Text tool' },
    { key: 'Ctrl/Cmd + Z', description: 'Undo' },
    { key: 'Ctrl/Cmd + Shift + Z', description: 'Redo' },
    { key: 'Ctrl/Cmd + Y', description: 'Redo (alternate)' },
    { key: 'Ctrl/Cmd + +', description: 'Zoom in' },
    { key: 'Ctrl/Cmd + -', description: 'Zoom out' },
    { key: 'Ctrl/Cmd + 0', description: 'Reset zoom' },
    { key: 'Esc', description: 'Deselect' },
    { key: 'D', description: 'Deselect' },
    { key: 'Delete / Backspace', description: 'Delete selected' },
    { key: 'Arrow Keys', description: 'Nudge selected element' },
    { key: 'Shift + Arrow', description: 'Nudge 10px' },
    { key: 'Space + Drag', description: 'Pan canvas' },
    { key: 'Ctrl/Cmd + Scroll', description: 'Zoom in/out' },
  ];
}
