// App component
import { useEditorStore } from './store/editorStore';
import { useKeyboardShortcuts, getAllShortcuts } from './hooks/useKeyboardShortcuts';
import { Toolbar } from './components/toolbar/Toolbar';
import { LeftSidebar } from './components/panels/LeftSidebar';
import { RightSidebar } from './components/panels/RightSidebar';
import { Canvas } from './components/canvas/Canvas';
import { FileUpload } from './components/ui/FileUpload';
import { ErrorToast } from './components/ui/ErrorToast';
import { LoadingOverlay } from './components/ui/LoadingOverlay';
import { ShortcutFeedback } from './components/ui/ShortcutFeedback';
import './styles/App.css';

function App() {
  const { 
    currentProject, 
    isLoading, 
    error, 
    clearError 
  } = useEditorStore();

  // Use enhanced keyboard shortcuts
  const { feedback } = useKeyboardShortcuts();

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
      {feedback && <ShortcutFeedback action={feedback.action} />}
    </div>
  );
}

export default App;
export { getAllShortcuts };
