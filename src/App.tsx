import { useEffect, useCallback } from 'react';
import { useEditorStore } from './store/editorStore';
import { Toolbar } from './components/toolbar/Toolbar';
import { LeftSidebar } from './components/panels/LeftSidebar';
import { RightSidebar } from './components/panels/RightSidebar';
import { Canvas } from './components/canvas/Canvas';
import { FileUpload } from './components/ui/FileUpload';
import { ErrorToast } from './components/ui/ErrorToast';
import { LoadingOverlay } from './components/ui/LoadingOverlay';
import './styles/App.css';

function App() {
  const { 
    currentProject, 
    isLoading, 
    error, 
    undo, 
    redo, 
    canUndo, 
    canRedo,
    clearError 
  } = useEditorStore();

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ctrl/Cmd + Z for undo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      if (canUndo()) undo();
    }
    
    // Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y for redo
    if (((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') ||
        ((e.ctrlKey || e.metaKey) && e.key === 'y')) {
      e.preventDefault();
      if (canRedo()) redo();
    }

    // Escape to deselect
    if (e.key === 'Escape') {
      useEditorStore.getState().selectElement(null);
    }
  }, [undo, redo, canUndo, canRedo]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!currentProject) {
    return (
      <div className="app-container">
        <FileUpload />
        {error && <ErrorToast message={error} onClose={clearError} />}
      </div>
    );
  }

  return (
    <div className="app-container">
      <Toolbar />
      <div className="main-content">
        <LeftSidebar />
        <Canvas />
        <RightSidebar />
      </div>
      {isLoading && <LoadingOverlay />}
      {error && <ErrorToast message={error} onClose={clearError} />}
    </div>
  );
}

export default App;
