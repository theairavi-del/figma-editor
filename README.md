# Figma-like Visual Website Builder

A production-quality visual website builder that looks and feels like Figma. Edit HTML websites visually with a powerful canvas-based interface.

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Build](https://img.shields.io/badge/build-passing-brightgreen)
![React](https://img.shields.io/badge/react-19-61DAFB)
![TypeScript](https://img.shields.io/badge/typescript-5.7-3178C6)

🚀 **[Live Demo](https://theairavi-del.github.io/figma-editor/)**

## Features

- **Figma-like Interface**: Dark theme, left/right sidebars, infinite canvas with pan/zoom
- **File Upload**: Upload ZIP files containing HTML/CSS/JS websites
- **Visual Selection**: Click any element to select and see visual outline
- **Properties Panel**: Edit text content, colors, spacing, fonts, sizes
- **Drag to Move**: Move absolutely positioned elements around the canvas
- **Export**: Download modified files as ZIP
- **Undo/Redo**: Full history management
- **Auto-save**: Project state persists in localStorage

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

## Usage

1. **Upload a Website**: Drag and drop a ZIP file containing your HTML, CSS, JS, and images
2. **Navigate the Canvas**: 
   - Use the Hand tool or middle-click to pan
   - Scroll + Ctrl/Cmd to zoom
   - Double-click zoom percentage to reset
3. **Select Elements**: Click any element on the canvas to select it
4. **Edit Properties**: Use the right sidebar to modify styles, text, colors
5. **Drag Elements**: Move absolutely positioned elements by dragging
6. **Export**: Download your modified website as a ZIP file

## Keyboard Shortcuts

### Tools
| Shortcut | Action |
|----------|--------|
| `V` | Select tool |
| `H` | Hand/Pan tool |
| `T` | Text tool |

### History
| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Shift + Z` | Redo |
| `Ctrl/Cmd + Y` | Redo (alternative) |

### Zoom
| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + +` | Zoom in |
| `Ctrl/Cmd + -` | Zoom out |
| `Ctrl/Cmd + 0` | Reset zoom |
| `Ctrl/Cmd + 1` | Fit to screen |
| `Ctrl/Cmd + Scroll` | Zoom in/out |

### Selection
| Shortcut | Action |
|----------|--------|
| `Esc` or `D` | Deselect element |
| `Delete` / `Backspace` | Delete selected (coming soon) |
| `Arrow Keys` | Nudge selected element 1px |
| `Shift + Arrow` | Nudge selected element 10px |

### Canvas
| Shortcut | Action |
|----------|--------|
| `Space + Drag` | Pan canvas |
| `Double-click zoom indicator` | Reset zoom to 100% |

## Project Structure

```
/src
  /components
    /canvas       - Canvas and iframe preview
    /panels       - Sidebars and panels
    /toolbar      - Top toolbar
    /ui           - Shared UI components
  /store          - Zustand state management
  /types          - TypeScript type definitions
  /utils          - File processing utilities
  /styles         - CSS styles
```

## Technology Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Zustand** - State management
- **JSZip** - ZIP file handling
- **Lucide React** - Icons

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## ZIP File Format

Your ZIP file should contain:
- `index.html` (or other HTML files)
- CSS files (linked or inline)
- JavaScript files
- Image assets

The tool will automatically:
- Inject visual IDs for element tracking
- Inline CSS for preview
- Preserve file structure on export

## License

MIT License - feel free to use for personal or commercial projects.
