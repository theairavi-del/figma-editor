# Architecture Documentation

## Overview

The Figma-like Visual Website Builder is a React-based single-page application that renders websites in an iframe and provides visual editing capabilities. The architecture follows a unidirectional data flow pattern with centralized state management.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        App (App.tsx)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Toolbar    │  │    Canvas    │  │   Sidebars   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                              │
│  State: Zustand Store                                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Canvas Component                         │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    Iframe Container                      ││
│  │  ┌─────────────────────────────────────────────────┐   ││
│  │  │         Sandboxed Website Preview                │   ││
│  │  │  • Injected data-visual-id attributes           │   ││
│  │  │  • Event handlers for selection                │   ││
│  │  │  • Style modifications applied directly        │   ││
│  │  └─────────────────────────────────────────────────┘   ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  Transform: pan/zoom via CSS transforms                     │
└─────────────────────────────────────────────────────────────┘
```

## State Management

### Zustand Store Structure

```typescript
interface EditorState {
  // Project Data
  currentProject: Project | null;
  
  // Selection State
  selectedElementId: string | null;
  selectedElementData: ElementData | null;
  
  // Canvas State
  canvas: {
    scale: number;
    translateX: number;
    translateY: number;
    isPanning: boolean;
  };
  
  // UI State
  activeTool: 'select' | 'pan' | 'text';
  activeLeftPanel: 'layers' | 'assets';
  
  // History (Undo/Redo)
  history: Project[];
  historyIndex: number;
}
```

### State Flow

1. **File Upload** → `processZipFile()` → `setProject()` → Store
2. **Element Selection** → Iframe event → `selectElement()` → Store → UI updates
3. **Style Update** → Properties panel → `updateElementStyle()` → Iframe + Store
4. **Export** → `createZipFromProject()` → Download ZIP

## Component Hierarchy

```
App
├── Toolbar
│   ├── Tool buttons (Select, Pan, Text)
│   ├── Undo/Redo
│   └── Zoom controls
├── LeftSidebar
│   ├── Tabs (Layers, Assets)
│   ├── LayersPanel (DOM tree)
│   └── AssetsPanel (file list)
├── Canvas
│   ├── Grid background
│   ├── Transform container
│   └── Iframe (website preview)
└── RightSidebar
    ├── Tabs (Design, Export)
    ├── PropertiesPanel (style editors)
    └── ExportPanel (download)
```

## Data Flow

### 1. File Upload Flow

```
User drops ZIP
    │
    ▼
processZipFile()
    │
    ├── Extract with JSZip
    ├── Add data-visual-id to elements
    └── Return Project object
    │
    ▼
setProject() → Store
    │
    ▼
buildHtmlDocument() → Iframe srcdoc
```

### 2. Element Selection Flow

```
User clicks element in iframe
    │
    ▼
Event handler (attached on iframe load)
    │
    ├── Get data-visual-id
    ├── Extract computed styles
    └── Build ElementData object
    │
    ▼
selectElement() + setElementData() → Store
    │
    ▼
UI updates:
    ├── Selection outline in iframe
    ├── Layer highlighted in LayersPanel
    └── Properties populated in PropertiesPanel
```

### 3. Style Update Flow

```
User changes value in PropertiesPanel
    │
    ▼
updateElementStyle(elementId, property, value)
    │
    ├── Update store.selectedElementData
    └── Apply to iframe element directly
    │
    ▼
Element style changes in real-time
    │
    ▼
On blur: saveToHistory() → Add to undo stack
```

### 4. Export Flow

```
User clicks Export
    │
    ▼
createZipFromProject()
    │
    ├── Remove injected styles
    ├── Reconstruct ZIP from files
    └── Return Blob
    │
    ▼
Trigger download via anchor element
```

## Key Technical Decisions

### 1. Iframe vs Canvas Rendering

**Decision**: Use an iframe for website preview

**Rationale**:
- True browser rendering of HTML/CSS/JS
- Sandboxed execution for security
- Maintains original website behavior
- Easier to implement than custom Canvas renderer

**Trade-offs**:
- Cross-origin restrictions (handled via srcdoc)
- Slightly slower than Canvas for very large pages
- Requires DOM parsing for interaction

### 2. State Persistence Strategy

**Decision**: Use Zustand with localStorage persistence

**Rationale**:
- Simple API compared to Redux
- Automatic persistence for project data
- Subscribe pattern for selective updates

**What's persisted**:
- Current project files
- Canvas position and zoom
- Not persisted: selection state, undo history

### 3. Element Identification

**Decision**: Inject `data-visual-id` attributes during upload

**Rationale**:
- Unique identifier survives re-renders
- No modification to existing IDs/classes
- Easy to query from both main window and iframe

**Process**:
```javascript
// During ZIP processing
function addVisualIdsToHtml(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  let counter = 0;
  
  function addIds(element) {
    element.setAttribute('data-visual-id', `el-${counter++}`);
    Array.from(element.children).forEach(addIds);
  }
  
  addIds(doc.documentElement);
  return doc.documentElement.outerHTML;
}
```

### 4. Style Editing Approach

**Decision**: Apply styles directly to iframe elements

**Rationale**:
- Immediate visual feedback
- No re-render of entire iframe needed
- Preserves element positions during drag

**Implementation**:
```javascript
// Direct DOM manipulation
const el = iframe.contentDocument.querySelector(`[data-visual-id="${id}"]`);
el.style.setProperty(property, value);
```

### 5. History/Undo Implementation

**Decision**: Deep clone project state on each significant change

**Rationale**:
- Simple implementation
- Guaranteed consistency
- 50-state limit for memory management

**Optimization consideration**:
For very large projects, could use:
- Structural sharing (Immutable.js)
- Operation-based undo (inverse operations)

## Security Considerations

### 1. Iframe Sandboxing

```html
<iframe sandbox="allow-scripts" srcdoc="...">
```

- Prevents navigation
- Prevents top-level redirects
- JavaScript executes but is isolated

### 2. Content Security

- No user-provided code executes in main window
- All DOM manipulation happens in iframe
- ZIP contents are parsed, not executed

### 3. XSS Prevention

- Text content is set via `textContent`, not `innerHTML`
- Attribute values are sanitized
- No `eval()` or similar used

## Performance Optimizations

### 1. Transform Optimization

```css
.canvas-content {
  will-change: transform;
}
```

Enables GPU acceleration for pan/zoom

### 2. Selective Re-rendering

Zustand selectors prevent unnecessary re-renders:

```javascript
const selectedId = useEditorStore(state => state.selectedElementId);
// Only re-renders when selectedElementId changes
```

### 3. Debounced History

History snapshots only taken on blur/confirm, not on every keystroke

### 4. Iframe Recycling

Same iframe element reused, only srcdoc changes

## Future Enhancements

1. **Multi-page support**: Navigation between pages in a project
2. **Component library**: Save and reuse custom components
3. **Collaboration**: Real-time multi-user editing
4. **Version control**: Git-like branching for designs
5. **Responsive editing**: Multiple viewport sizes
6. **Animation editor**: CSS animations and transitions

## Testing Strategy

### Unit Tests
- ZIP processing utilities
- State store actions
- HTML parsing functions

### Integration Tests
- File upload flow
- Element selection
- Style application
- Export functionality

### E2E Tests
- Complete user workflows
- Multiple website types
- Cross-browser compatibility
