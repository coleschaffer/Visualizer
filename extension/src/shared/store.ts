import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AppState, VisualChange, ElementInfo, PanelPosition, ConnectionStatus, MeasureDistance } from './types';

interface StoreActions {
  setActive: (active: boolean) => void;
  selectElement: (element: ElementInfo | null) => void;
  hoverElement: (element: ElementInfo | null) => void;
  setPanelPosition: (position: PanelPosition | null) => void;
  setMeasureDistances: (distances: MeasureDistance[]) => void;

  // Change management
  addChange: (change: VisualChange) => void;
  updateChange: (changeId: string, updates: Partial<VisualChange>) => void;
  removeChange: (changeId: string) => void;
  confirmChange: (changeId: string) => void;
  undoChange: (changeId: string) => void;
  clearChangesForElement: (selector: string) => void;

  // Connection
  setConnectionStatus: (status: ConnectionStatus) => void;
  setMcpToken: (token: string | null) => void;

  // Reset
  reset: () => void;
}

const initialState: AppState = {
  isActive: false,
  selectedElement: null,
  hoveredElement: null,
  pendingChanges: [],
  panelPosition: null,
  measureDistances: [],
  connectionStatus: 'disconnected',
  mcpToken: null,
};

export const useStore = create<AppState & StoreActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      setActive: (active) => set({ isActive: active }),

      selectElement: (element) => set({
        selectedElement: element,
        panelPosition: element ? calculatePanelPosition(element.rect) : null,
      }),

      hoverElement: (element) => set({ hoveredElement: element }),

      setPanelPosition: (position) => set({ panelPosition: position }),

      setMeasureDistances: (distances) => set({ measureDistances: distances }),

      addChange: (change) => set((state) => ({
        pendingChanges: [...state.pendingChanges, change],
      })),

      updateChange: (changeId, updates) => set((state) => ({
        pendingChanges: state.pendingChanges.map((c) =>
          c.id === changeId ? { ...c, ...updates } : c
        ),
      })),

      removeChange: (changeId) => set((state) => ({
        pendingChanges: state.pendingChanges.filter((c) => c.id !== changeId),
      })),

      confirmChange: (changeId) => set((state) => ({
        pendingChanges: state.pendingChanges.map((c) =>
          c.id === changeId ? { ...c, status: 'confirmed' } : c
        ),
      })),

      undoChange: (changeId) => {
        const state = get();
        const change = state.pendingChanges.find((c) => c.id === changeId);
        if (change) {
          // Remove the change and revert visual preview
          set({
            pendingChanges: state.pendingChanges.filter((c) => c.id !== changeId),
          });
        }
      },

      clearChangesForElement: (selector) => set((state) => ({
        pendingChanges: state.pendingChanges.filter(
          (c) => c.element.selector !== selector
        ),
      })),

      setConnectionStatus: (status) => set({ connectionStatus: status }),

      setMcpToken: (token) => set({ mcpToken: token }),

      reset: () => set(initialState),
    }),
    {
      name: 'visual-feedback-storage',
      storage: createJSONStorage(() => localStorage),
      // Only persist token, not changes (they contain large screenshots)
      partialize: (state) => ({
        mcpToken: state.mcpToken,
      }),
    }
  )
);

// Helper to calculate optimal panel position
function calculatePanelPosition(rect: DOMRect): PanelPosition {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const panelWidth = 400; // Approximate panel width
  const panelHeight = 300; // Approximate panel height
  const offset = 16;

  let x: number;
  let y: number;
  let anchorSide: PanelPosition['anchorSide'];

  // Try right side first
  if (rect.right + offset + panelWidth < viewportWidth) {
    x = rect.right + offset;
    y = Math.min(rect.top, viewportHeight - panelHeight - offset);
    anchorSide = 'left';
  }
  // Try left side
  else if (rect.left - offset - panelWidth > 0) {
    x = rect.left - offset - panelWidth;
    y = Math.min(rect.top, viewportHeight - panelHeight - offset);
    anchorSide = 'right';
  }
  // Try bottom
  else if (rect.bottom + offset + panelHeight < viewportHeight) {
    x = Math.max(offset, Math.min(rect.left, viewportWidth - panelWidth - offset));
    y = rect.bottom + offset;
    anchorSide = 'top';
  }
  // Default to top
  else {
    x = Math.max(offset, Math.min(rect.left, viewportWidth - panelWidth - offset));
    y = Math.max(offset, rect.top - panelHeight - offset);
    anchorSide = 'bottom';
  }

  return { x, y, anchorSide };
}

// Generate unique change ID
export function generateChangeId(): string {
  return `change-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
