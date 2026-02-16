/**
 * Type definitions for the Figma-like visual website builder
 */

// CSS property types for better autocompletion
export type CSSProperty = 
  | 'color' | 'background-color' | 'font-size' | 'font-family' | 'font-weight'
  | 'line-height' | 'text-align' | 'padding' | 'margin' | 'border-radius'
  | 'border-width' | 'border-color' | 'border-style' | 'display' | 'position'
  | 'width' | 'height' | 'top' | 'left' | 'right' | 'bottom' | 'z-index'
  | 'flex-direction' | 'justify-content' | 'align-items' | 'gap'
  | 'padding-top' | 'padding-right' | 'padding-bottom' | 'padding-left'
  | 'margin-top' | 'margin-right' | 'margin-bottom' | 'margin-left';

// Valid HTML tag names (subset of most common)
export type HTMLTagName = 
  | 'div' | 'span' | 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
  | 'a' | 'button' | 'input' | 'img' | 'section' | 'article' | 'header'
  | 'footer' | 'nav' | 'aside' | 'main' | 'ul' | 'ol' | 'li';

// Tool types
export type EditorTool = 'select' | 'pan' | 'text';

// Left panel tabs
export type LeftPanelTab = 'layers' | 'assets';

// Element selection and metadata
export interface ElementData {
  id: string;
  tagName: HTMLTagName | string;
  className?: string;
  styles: Record<string, string>;
  attributes: Record<string, string>;
  textContent?: string;
  children: ElementData[];
  rect: Pick<DOMRect, 'x' | 'y' | 'width' | 'height' | 'top' | 'left' | 'right' | 'bottom'>;
  parentId?: string;
  index: number;
}

// Serializable version of ElementData for safe cloning
export type SerializableElementData = Omit<ElementData, 'rect'> & {
  rect: { x: number; y: number; width: number; height: number; top: number; left: number; right: number; bottom: number };
};

// Canvas state
export interface CanvasState {
  scale: number;
  translateX: number;
  translateY: number;
  isPanning: boolean;
  lastMouseX: number;
  lastMouseY: number;
}

// Project structure
export interface ProjectFile {
  path: string;
  content: string;
  type: 'html' | 'css' | 'js' | 'image' | 'other';
  size?: number;
}

export interface Project {
  id: string;
  name: string;
  files: ProjectFile[];
  rootHtmlPath: string;
  modifiedAt: number;
  totalSize?: number;
}

// Editor state
export interface EditorState {
  // Project
  currentProject: Project | null;
  isLoading: boolean;
  error: string | null;
  
  // Selection
  selectedElementId: string | null;
  hoveredElementId: string | null;
  selectedElementData: ElementData | null;
  
  // Canvas
  canvas: CanvasState;
  
  // UI State
  activeLeftPanel: LeftPanelTab;
  activeTool: EditorTool;
  
  // History for undo/redo
  history: HistoryEntry[];
  historyIndex: number;
  isHistoryEnabled: boolean;
  lastHistorySave: number;
  
  // Batch operations
  activeBatch: string | null;
  batchCommands: Command[];
  
  // Actions
  setProject: (project: Project) => void;
  updateProject: (updater: (project: Project) => Project) => void;
  selectElement: (id: string | null) => void;
  hoverElement: (id: string | null) => void;
  setElementData: (data: ElementData | null) => void;
  updateElement: (elementId: string, updates: Partial<ElementData>) => void;
  updateElementStyle: (elementId: string, property: CSSProperty | string, value: string) => void;
  updateElementText: (elementId: string, text: string) => void;
  setCanvas: (canvas: Partial<CanvasState>) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  setActiveTool: (tool: EditorTool) => void;
  setActiveLeftPanel: (panel: LeftPanelTab) => void;
  
  // History Actions
  saveToHistory: (label?: string) => void;
  debouncedSaveToHistory: (label?: string, delay?: number) => void;
  flushHistory: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  getHistoryLabel: () => string | null;
  setHistoryEnabled: (enabled: boolean) => void;
  clearHistory: () => void;
  
  // Batch Actions
  startBatch: (label: string) => void;
  endBatch: () => void;
  cancelBatch: () => void;
  
  // Utility Actions
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

// File upload
export interface FileUploadResult {
  success: boolean;
  project?: Project;
  error?: string;
}

// File validation
export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

// Progress tracking
export interface FileProgress {
  stage: 'reading' | 'parsing' | 'extracting' | 'processing' | 'finalizing' | 'complete' | 'error';
  percent: number;
  current?: number;
  total?: number;
}

// Element modification
export interface ElementModification {
  type: 'style' | 'attribute' | 'text' | 'position';
  target: string;
  property?: string;
  value: string | number;
}

// ============================================
// HISTORY TYPES
// ============================================

// History entry for undo/redo
export interface HistoryEntry {
  project: Project;
  selectedElementId: string | null;
  timestamp: number;
  label: string;
}

// Command pattern for atomic operations
export interface Command {
  id: string;
  type: 'style' | 'text' | 'attribute' | 'position' | 'composite';
  elementId: string;
  property?: string;
  oldValue: unknown;
  newValue: unknown;
  timestamp: number;
}

// Batch operation tracking
export interface BatchOperation {
  id: string;
  label: string;
  commands: Command[];
  timestamp: number;
}
