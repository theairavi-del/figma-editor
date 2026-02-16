import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import type { EditorState, CanvasState } from '../types';

const initialCanvasState: CanvasState = {
  scale: 1,
  translateX: 0,
  translateY: 0,
  isPanning: false,
  lastMouseX: 0,
  lastMouseY: 0,
};

export const useEditorStore = create<EditorState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        // Initial State
        currentProject: null,
        isLoading: false,
        error: null,
        selectedElementId: null,
        hoveredElementId: null,
        selectedElementData: null,
        canvas: initialCanvasState,
        activeLeftPanel: 'layers',
        activeTool: 'select',
        history: [],
        historyIndex: -1,

        // Project Actions
        setProject: (project) => {
          set({ 
            currentProject: project,
            history: [JSON.parse(JSON.stringify(project))],
            historyIndex: 0,
            selectedElementId: null,
            selectedElementData: null,
            error: null 
          });
        },

        updateProject: (updater) => {
          const current = get().currentProject;
          if (!current) return;
          
          const updated = updater(JSON.parse(JSON.stringify(current)));
          set({ currentProject: updated });
        },

        // Selection Actions
        selectElement: (id) => {
          set({ 
            selectedElementId: id,
            selectedElementData: null 
          });
        },

        hoverElement: (id) => {
          set({ hoveredElementId: id });
        },

        setElementData: (data) => {
          set({ selectedElementData: data });
        },

        updateElement: (elementId, updates) => {
          const current = get().currentProject;
          if (!current) return;

          const updateInTree = (files: typeof current.files): typeof current.files => {
            return files.map(file => {
              if (file.type === 'html') {
                // Parse and update HTML content
                const parser = new DOMParser();
                const doc = parser.parseFromString(file.content, 'text/html');
                const element = doc.querySelector(`[data-visual-id="${elementId}"]`);
                
                if (element) {
                  // Apply updates
                  if (updates.styles) {
                    Object.entries(updates.styles).forEach(([prop, val]) => {
                      (element as HTMLElement).style.setProperty(prop, val);
                    });
                  }
                  if (updates.textContent !== undefined) {
                    element.textContent = updates.textContent;
                  }
                  if (updates.attributes) {
                    Object.entries(updates.attributes).forEach(([attr, val]) => {
                      element.setAttribute(attr, val);
                    });
                  }
                  
                  return {
                    ...file,
                    content: doc.documentElement.outerHTML
                  };
                }
              }
              return file;
            });
          };

          const updatedFiles = updateInTree(current.files);
          set({
            currentProject: {
              ...current,
              files: updatedFiles,
              modifiedAt: Date.now()
            }
          });
        },

        updateElementStyle: (elementId, property, value) => {
          const state = get();
          if (!state.selectedElementData) return;

          const updatedData = {
            ...state.selectedElementData,
            styles: {
              ...state.selectedElementData.styles,
              [property]: value
            }
          };

          set({ selectedElementData: updatedData });
          
          // Also update in iframe if possible
          const iframe = document.querySelector('iframe[data-preview-frame]') as HTMLIFrameElement;
          if (iframe?.contentDocument) {
            const el = iframe.contentDocument.querySelector(`[data-visual-id="${elementId}"]`) as HTMLElement;
            if (el) {
              el.style.setProperty(property, value);
            }
          }
        },

        updateElementText: (elementId, text) => {
          const state = get();
          if (!state.selectedElementData) return;

          set({
            selectedElementData: {
              ...state.selectedElementData,
              textContent: text
            }
          });

          // Update in iframe
          const iframe = document.querySelector('iframe[data-preview-frame]') as HTMLIFrameElement;
          if (iframe?.contentDocument) {
            const el = iframe.contentDocument.querySelector(`[data-visual-id="${elementId}"]`) as HTMLElement;
            if (el) {
              el.textContent = text;
            }
          }
        },

        // Canvas Actions
        setCanvas: (canvas) => {
          set((state) => ({
            canvas: { ...state.canvas, ...canvas }
          }));
        },

        zoomIn: () => {
          set((state) => ({
            canvas: {
              ...state.canvas,
              scale: Math.min(state.canvas.scale * 1.1, 5)
            }
          }));
        },

        zoomOut: () => {
          set((state) => ({
            canvas: {
              ...state.canvas,
              scale: Math.max(state.canvas.scale / 1.1, 0.1)
            }
          }));
        },

        resetZoom: () => {
          set({
            canvas: {
              ...initialCanvasState,
              isPanning: get().canvas.isPanning,
              lastMouseX: get().canvas.lastMouseX,
              lastMouseY: get().canvas.lastMouseY,
            }
          });
        },

        // Tool Actions
        setActiveTool: (tool) => {
          set({ activeTool: tool });
        },

        setActiveLeftPanel: (panel) => {
          set({ activeLeftPanel: panel });
        },

        // History Actions
        saveToHistory: () => {
          const { currentProject, history, historyIndex } = get();
          if (!currentProject) return;

          // Remove any future history if we're in the middle
          const newHistory = history.slice(0, historyIndex + 1);
          newHistory.push(JSON.parse(JSON.stringify(currentProject)));

          // Limit history to 50 states
          let newIndex = newHistory.length - 1;
          if (newHistory.length > 50) {
            newHistory.shift();
            newIndex = Math.max(0, newIndex - 1);
          }

          set({
            history: newHistory,
            historyIndex: newIndex
          });
        },

        undo: () => {
          const { historyIndex, history } = get();
          if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            set({
              currentProject: JSON.parse(JSON.stringify(history[newIndex])),
              historyIndex: newIndex
            });
          }
        },

        redo: () => {
          const { historyIndex, history } = get();
          if (historyIndex < history.length - 1) {
            const newIndex = historyIndex + 1;
            set({
              currentProject: JSON.parse(JSON.stringify(history[newIndex])),
              historyIndex: newIndex
            });
          }
        },

        canUndo: () => get().historyIndex > 0,
        canRedo: () => get().historyIndex < get().history.length - 1,

        // Loading and Error Actions
        setLoading: (loading) => {
          set({ isLoading: loading });
        },

        setError: (error) => {
          set({ error, isLoading: false });
        },

        clearError: () => {
          set({ error: null });
        },
      }),
      {
        name: 'figma-editor-storage',
        partialize: (state) => ({
          currentProject: state.currentProject,
          canvas: {
            scale: state.canvas.scale,
            translateX: state.canvas.translateX,
            translateY: state.canvas.translateY,
          }
        })
      }
    )
  )
);
