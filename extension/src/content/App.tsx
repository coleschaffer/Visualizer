import { useEffect, useCallback, useState } from 'react';
import { useStore } from '../shared/store';
import { ElementHighlight } from './overlay/ElementHighlight';
import { MeasureLines } from './overlay/MeasureLines';
import { BreadcrumbBar } from './overlay/BreadcrumbBar';
import { FloatingPanel } from './overlay/FloatingPanel';
import { ResizeHandles } from './controls/ResizeHandles';
import { getElementInfo } from './selection/ElementTracker';
import { calculateMeasureDistances } from './selection/MeasureCalculator';

export function App() {
  const {
    isActive,
    selectedElement,
    hoveredElement,
    measureDistances,
    setActive,
    selectElement,
    hoverElement,
    setMeasureDistances,
  } = useStore();

  const [isDraggingPanel, setIsDraggingPanel] = useState(false);

  // Handle mouse move for hover detection
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isActive || isDraggingPanel) return;

    const target = e.target as HTMLElement;

    // Ignore our own overlay elements
    if (target.closest('#visual-feedback-overlay')) return;

    const elementInfo = getElementInfo(target);
    hoverElement(elementInfo);

    // Calculate measure distances to nearby elements
    if (selectedElement) {
      const distances = calculateMeasureDistances(
        selectedElement.rect,
        elementInfo.rect
      );
      setMeasureDistances(distances);
    }
  }, [isActive, isDraggingPanel, selectedElement, hoverElement, setMeasureDistances]);

  // Handle click to select element
  const handleClick = useCallback((e: MouseEvent) => {
    if (!isActive) return;

    const target = e.target as HTMLElement;

    // Ignore our own overlay elements
    if (target.closest('#visual-feedback-overlay')) return;

    e.preventDefault();
    e.stopPropagation();

    const elementInfo = getElementInfo(target);
    selectElement(elementInfo);
  }, [isActive, selectElement]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (selectedElement) {
        selectElement(null);
        setMeasureDistances([]);
      } else if (isActive) {
        setActive(false);
      }
    }

    // Cmd+Z for undo
    if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
      // Handle undo - will be implemented in store
    }
  }, [isActive, selectedElement, selectElement, setActive, setMeasureDistances]);

  // Set up event listeners
  useEffect(() => {
    if (isActive) {
      document.addEventListener('mousemove', handleMouseMove, true);
      document.addEventListener('click', handleClick, true);
      document.addEventListener('keydown', handleKeyDown, true);

      // Add body class for cursor change
      document.body.style.cursor = 'crosshair';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove, true);
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('keydown', handleKeyDown, true);
      document.body.style.cursor = '';
    };
  }, [isActive, handleMouseMove, handleClick, handleKeyDown]);

  // Listen for messages from background script
  useEffect(() => {
    const handleMessage = (message: { type: string; active?: boolean }) => {
      console.log('[VF] Received message:', message);
      if (message.type === 'TOGGLE_ACTIVE') {
        console.log('[VF] Toggling active state from', isActive, 'to', !isActive);
        setActive(!isActive);
      } else if (message.type === 'SET_ACTIVE' && message.active !== undefined) {
        console.log('[VF] Setting active state to', message.active);
        setActive(message.active);
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    console.log('[VF] Message listener registered, current isActive:', isActive);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, [isActive, setActive]);

  if (!isActive) return null;

  return (
    <div className="vf-overlay">
      {/* Breadcrumb bar at top */}
      <BreadcrumbBar
        element={selectedElement}
        onSelectPath={(index) => {
          if (selectedElement) {
            const pathElement = document.querySelector(
              selectedElement.path[index].selector
            ) as HTMLElement;
            if (pathElement) {
              selectElement(getElementInfo(pathElement));
            }
          }
        }}
      />

      {/* Hover highlight */}
      {hoveredElement && !selectedElement && (
        <ElementHighlight element={hoveredElement} type="hover" />
      )}

      {/* Selected element highlight with resize handles */}
      {selectedElement && (
        <>
          <ElementHighlight element={selectedElement} type="selected" />
          <ResizeHandles
            element={selectedElement}
            onResize={() => {
              // Will trigger visual change
            }}
          />
        </>
      )}

      {/* Measure distance lines */}
      {measureDistances.length > 0 && (
        <MeasureLines distances={measureDistances} />
      )}

      {/* Floating panel with visual controls and chat */}
      {selectedElement && (
        <FloatingPanel
          element={selectedElement}
          onDragStart={() => setIsDraggingPanel(true)}
          onDragEnd={() => setIsDraggingPanel(false)}
          onClose={() => {
            selectElement(null);
            setMeasureDistances([]);
          }}
        />
      )}
    </div>
  );
}
