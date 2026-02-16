import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import type { EditorState, CanvasState, HistoryEntry } from '../types';

const initialCanvasState: CanvasState = {
  scale: 1,
  translateX: 0,
  translateY: 0,
  isPanning: false,
  lastMouseX: 0,
  lastMouseY: 0,
};

// Debounce utility for history saving
const createDebouncer = () => {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let pendingAction: (() => void) | null = null;

  return {
    debounce: (action: () => void, delay: number = 300) => {
      pendingAction = action;
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        if (pendingAction) {
          pendingAction();
          pendingAction = null;
        }
      }, delay);
    },
    flush: () => {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      if (pendingAction) {
        pendingAction();
        pendingAction = null;
      }
    },
    cancel: () => {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      pendingAction = null;
    }
  };
};

export const useEditorStore = create<EditorState>()(
  subscribeWithSelector(
    persist(
      (set, get) => {
        const historyDebouncer = createDebouncer();

        return {
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
          
          // Enhanced History State
          history: [],
          historyIndex: -1,
          isHistoryEnabled: true,
          lastHistorySave: 0,
          
          // Batch/Group tracking
          activeBatch: null,
          batchCommands: [],

          // Project Actions
          setProject: (project) => {
            historyDebouncer.cancel();
            const entry: HistoryEntry = {
              project: JSON.parse(JSON.stringify(project)),
              selectedElementId: null,
              timestamp: Date.now(),
              label: 'Initial state'
            };
            
            set({ 
              currentProject: project,
              history: [entry],
              historyIndex: 0,
              selectedElementId: null,
              selectedElementData: null,
              error: null,
              lastHistorySave: Date.now()
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
                  const parser = new DOMParser();
                  const doc = parser.parseFromString(file.content, 'text/html');
                  const element = doc.querySelector(`[data-visual-id="${elementId}"]`);
                  
                  if (element) {
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
            
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('editor:style-change', {
                detail: { elementId, property, value }
              }));
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

            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('editor:text-change', {
                detail: { elementId, text }
              }));
            }
          },

          // Page Navigation
          setCurrentPage: (htmlPath: string) => {
            const current = get().currentProject;
            if (!current) return;

            // Update rootHtmlPath to switch pages
            set({
              currentProject: {
                ...current,
                rootHtmlPath: htmlPath,
                modifiedAt: Date.now()
              },
              selectedElementId: null,
              selectedElementData: null
            });
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

          // ============================================
          // ENHANCED HISTORY ACTIONS
          // ============================================
          
          saveToHistory: (label?: string) => {
            const state = get();
            if (!state.isHistoryEnabled || !state.currentProject) return;

            // Cancel any pending debounced save
            historyDebouncer.cancel();

            const entry: HistoryEntry = {
              project: JSON.parse(JSON.stringify(state.currentProject)),
              selectedElementId: state.selectedElementId,
              timestamp: Date.now(),
              label: label || 'Edit'
            };

            // Remove any future history if we're in the middle
            const newHistory = state.history.slice(0, state.historyIndex + 1);
            newHistory.push(entry);

            // Limit history to 50 states
            let newIndex = newHistory.length - 1;
            if (newHistory.length > 50) {
              newHistory.shift();
              newIndex = Math.max(0, newIndex - 1);
            }

            set({
              history: newHistory,
              historyIndex: newIndex,
              lastHistorySave: Date.now()
            });
          },

          // Debounced save for rapid changes (typing, dragging)
          debouncedSaveToHistory: (label?: string, delay?: number) => {
            const state = get();
            if (!state.isHistoryEnabled || !state.currentProject) return;

            historyDebouncer.debounce(() => {
              get().saveToHistory(label);
            }, delay || 300);
          },

          // Flush any pending debounced save immediately
          flushHistory: () => {
            historyDebouncer.flush();
          },

          undo: () => {
            historyDebouncer.flush(); // Flush any pending changes first
            
            const { historyIndex, history } = get();
            if (historyIndex > 0) {
              const newIndex = historyIndex - 1;
              const entry = history[newIndex];
              
              set({
                currentProject: JSON.parse(JSON.stringify(entry.project)),
                selectedElementId: entry.selectedElementId,
                historyIndex: newIndex
              });

              // Emit event for UI feedback
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('editor:undo', {
                  detail: { label: entry.label, canUndo: newIndex > 0 }
                }));
              }
            }
          },

          redo: () => {
            historyDebouncer.flush();
            
            const { historyIndex, history } = get();
            if (historyIndex < history.length - 1) {
              const newIndex = historyIndex + 1;
              const entry = history[newIndex];
              
              set({
                currentProject: JSON.parse(JSON.stringify(entry.project)),
                selectedElementId: entry.selectedElementId,
                historyIndex: newIndex
              });

              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('editor:redo', {
                  detail: { label: entry.label, canRedo: newIndex < history.length - 1 }
                }));
              }
            }
          },

          canUndo: () => {
            const { historyIndex, isHistoryEnabled } = get();
            return isHistoryEnabled && historyIndex > 0;
          },
          
          canRedo: () => {
            const { historyIndex, history, isHistoryEnabled } = get();
            return isHistoryEnabled && historyIndex < history.length - 1;
          },

          getHistoryLabel: () => {
            const { history, historyIndex } = get();
            if (historyIndex > 0 && history[historyIndex]) {
              return history[historyIndex].label;
            }
            return null;
          },

          // Toggle history on/off (for bulk operations)
          setHistoryEnabled: (enabled) => {
            set({ isHistoryEnabled: enabled });
          },

          // Clear history
          clearHistory: () => {
            historyDebouncer.cancel();
            const { currentProject } = get();
            if (currentProject) {
              const entry: HistoryEntry = {
                project: JSON.parse(JSON.stringify(currentProject)),
                selectedElementId: null,
                timestamp: Date.now(),
                label: 'Cleared'
              };
              set({
                history: [entry],
                historyIndex: 0
              });
            }
          },

          // ============================================
          // BATCH/GROUP OPERATIONS
          // ============================================
          
          startBatch: (label: string) => {
            set({
              activeBatch: label,
              batchCommands: []
            });
          },

          endBatch: () => {
            const state = get();
            if (state.activeBatch && state.batchCommands.length > 0) {
              // Save batch as single history entry
              state.saveToHistory(state.activeBatch);
            }
            set({
              activeBatch: null,
              batchCommands: []
            });
          },

          cancelBatch: () => {
            // Restore state before batch started
            const state = get();
            if (state.activeBatch && state.historyIndex >= 0) {
              const entry = state.history[state.historyIndex];
              set({
                currentProject: JSON.parse(JSON.stringify(entry.project)),
                activeBatch: null,
                batchCommands: []
              });
            }
          },

          // ============================================
          // UTILITY ACTIONS
          // ============================================
          
          setLoading: (loading) => {
            set({ isLoading: loading });
          },

          setError: (error) => {
            set({ error, isLoading: false });
          },

          clearError: () => {
            set({ error: null });
          },
        };
      },
      {
        name: 'figma-editor-storage',
        partialize: (state) => ({
          currentProject: state.currentProject,
          canvas: {
            scale: state.canvas.scale,
            translateX: state.canvas.translateX,
            translateY: state.canvas.translateY,
          }
        }),
        onRehydrateStorage: () => {
          return () => {
            // Listen for history save events from layer reordering
            if (typeof window !== 'undefined') {
              window.addEventListener('editor:save-history', ((e: CustomEvent<{ label?: string }>) => {
                const store = useEditorStore.getState();
                store.saveToHistory(e.detail?.label || 'Edit');
              }) as EventListener);
            }
          };
        }
      }
    )
  )
);
