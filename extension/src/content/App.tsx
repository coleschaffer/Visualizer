import { useEffect, useCallback, useState, useRef } from 'react';
import { useStore } from '../shared/store';
import { ElementHighlight } from './overlay/ElementHighlight';
import { FloatingPanel } from './overlay/FloatingPanel';
import { getElementInfo } from './selection/ElementTracker';
import type { ElementInfo } from '../shared/types';

export function App() {
  const {
    isActive,
    hoveredElement,
    setActive,
    hoverElement,
  } = useStore();

  const [isDraggingPanel, setIsDraggingPanel] = useState(false);
  const [selectedElement, setSelectedElement] = useState<ElementInfo | null>(null);
  const [currentRect, setCurrentRect] = useState<DOMRect | null>(null);
  const [isReferencing, setIsReferencing] = useState(false);
  const [referencedElement, setReferencedElement] = useState<ElementInfo | null>(null);

  // Toast notifications state (multiple tasks can be pending)
  const [toasts, setToasts] = useState<{
    taskId: string;
    elementName: string;
    status: 'working' | 'done' | 'error';
    fading: boolean;
    dismissed: boolean;
  }[]>([]);

  // Queued tasks counter (for MCP/async mode)
  const [queuedCount, setQueuedCount] = useState(0);

  // Fetch queued task count on load and periodically (via background script to avoid CORS)
  useEffect(() => {
    const fetchQueueCount = () => {
      chrome.runtime.sendMessage({ type: 'GET_QUEUE_COUNT' }, (response) => {
        if (response?.count !== undefined) {
          setQueuedCount(response.count);
        }
      });
    };

    // Fetch immediately on load
    fetchQueueCount();

    // Poll every 5 seconds to keep queue count in sync
    const interval = setInterval(fetchQueueCount, 5000);

    return () => clearInterval(interval);
  }, []);

  const selectedDomElement = useRef<HTMLElement | null>(null);
  const hoveredDomElement = useRef<Element | null>(null);
  const lastMousePos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Get the deepest element at a point (works with SVG, disabled elements, etc.)
  const getElementAtPoint = useCallback((x: number, y: number): Element | null => {
    // Collect ALL elements in the document and find ones containing the point
    const allElements = document.querySelectorAll('*');
    const matches: { el: Element; depth: number }[] = [];

    for (const el of allElements) {
      // Skip our overlay
      if (el.closest('#visual-feedback-overlay')) continue;
      if (el.id === 'visual-feedback-overlay') continue;

      // Get bounding rect
      const rect = el.getBoundingClientRect();

      // Skip elements with no size
      if (rect.width === 0 || rect.height === 0) continue;

      // Check if point is inside
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        // Calculate depth (how nested is this element)
        let depth = 0;
        let p = el.parentElement;
        while (p) {
          depth++;
          p = p.parentElement;
        }

        matches.push({ el, depth });
      }
    }

    // Sort by depth (deepest first) and return the deepest
    if (matches.length > 0) {
      matches.sort((a, b) => b.depth - a.depth);
      return matches[0].el;
    }

    return null;
  }, []);

  // Handle mouse move for hover detection
  const handleMouseMove = useCallback((e: MouseEvent) => {
    // Always track mouse position
    lastMousePos.current = { x: e.clientX, y: e.clientY };

    // Allow hover detection during reference mode
    if (!isActive || isDraggingPanel || (selectedElement && !isReferencing)) return;

    const target = getElementAtPoint(e.clientX, e.clientY);
    if (!target) return;

    // Store the DOM element reference for spacebar selection
    hoveredDomElement.current = target;

    // Handle both HTML and SVG elements
    const htmlTarget = target instanceof HTMLElement ? target : target as unknown as HTMLElement;
    const elementInfo = getElementInfo(htmlTarget);
    hoverElement(elementInfo);
  }, [isActive, isDraggingPanel, selectedElement, isReferencing, hoverElement, getElementAtPoint]);

  // Handle click to select element (one at a time)
  const handleClick = useCallback((e: MouseEvent) => {
    // In reference mode, set the referenced element
    if (isReferencing) {
      const target = getElementAtPoint(e.clientX, e.clientY);
      if (!target) return;

      e.preventDefault();
      e.stopPropagation();

      const htmlTarget = target instanceof HTMLElement ? target : target as unknown as HTMLElement;
      const elementInfo = getElementInfo(htmlTarget);
      setReferencedElement(elementInfo);
      return;
    }

    if (!isActive || selectedElement) return;

    const target = getElementAtPoint(e.clientX, e.clientY);
    if (!target) return;

    e.preventDefault();
    e.stopPropagation();

    // Handle both HTML and SVG elements
    const htmlTarget = target instanceof HTMLElement ? target : target as unknown as HTMLElement;
    const elementInfo = getElementInfo(htmlTarget);

    // Store DOM element reference for scroll tracking
    selectedDomElement.current = htmlTarget;
    setSelectedElement(elementInfo);
    setCurrentRect(target.getBoundingClientRect());
  }, [isActive, selectedElement, isReferencing, getElementAtPoint]);

  // Update rect continuously using RAF for smooth tracking
  useEffect(() => {
    if (!selectedDomElement.current) return;

    let rafId: number;
    let lastRect = '';

    const updateRect = () => {
      if (selectedDomElement.current) {
        const rect = selectedDomElement.current.getBoundingClientRect();
        // Only update state if rect actually changed (avoid unnecessary renders)
        const rectStr = `${rect.top},${rect.left},${rect.width},${rect.height}`;
        if (rectStr !== lastRect) {
          lastRect = rectStr;
          setCurrentRect(rect);
        }
      }
      rafId = requestAnimationFrame(updateRect);
    };

    rafId = requestAnimationFrame(updateRect);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [selectedElement]);

  // Clear DOM ref when element is deselected
  const clearSelection = useCallback(() => {
    selectedDomElement.current = null;
    setSelectedElement(null);
    setCurrentRect(null);
    setIsReferencing(false);
    setReferencedElement(null);
  }, []);

  // Reference mode handlers
  const handleStartReference = useCallback(() => {
    setIsReferencing(true);
    setReferencedElement(null);
  }, []);

  const handleEndReference = useCallback(() => {
    setIsReferencing(false);
    // Don't clear referencedElement here - FloatingPanel will handle it
  }, []);

  // Handle task submission - show toast notification and close panel
  const handleTaskSubmitted = useCallback((taskId: string, _rect: DOMRect, elementName?: string) => {
    const name = elementName || selectedElement?.selector || 'element';
    setToasts(prev => [...prev, { taskId, elementName: name, status: 'working', fading: false, dismissed: false }]);
    clearSelection(); // Close the panel
  }, [clearSelection, selectedElement?.selector]);

  // Dismiss a toast (doesn't stop the task)
  const dismissToast = useCallback((taskId: string) => {
    setToasts(prev => prev.map(t =>
      t.taskId === taskId ? { ...t, dismissed: true } : t
    ));
  }, []);

  // Listen for task completion updates
  useEffect(() => {
    const handleTaskUpdate = (message: { type: string; task?: { id: string; status: string } }) => {
      console.log('[VF] Task listener received:', message.type, message.task?.id, message.task?.status);

      if (message.type === 'TASK_UPDATE' && message.task) {
        const taskId = message.task.id;
        const taskStatus = message.task.status;

        setToasts(prev => {
          console.log('[VF] Looking for taskId:', taskId, 'in toasts:', prev.map(t => t.taskId));
          const toastIndex = prev.findIndex(t => t.taskId === taskId);
          if (toastIndex === -1) return prev;

          const newToasts = [...prev];

          if (taskStatus === 'complete') {
            // Play sound
            try {
              const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
              const oscillator = audioContext.createOscillator();
              const gainNode = audioContext.createGain();
              oscillator.connect(gainNode);
              gainNode.connect(audioContext.destination);
              oscillator.frequency.value = 800;
              oscillator.type = 'sine';
              gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
              gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
              oscillator.start(audioContext.currentTime);
              oscillator.stop(audioContext.currentTime + 0.1);
            } catch {}

            newToasts[toastIndex] = { ...newToasts[toastIndex], status: 'done' };

            // Start fading after showing success
            setTimeout(() => {
              setToasts(p => p.map(t =>
                t.taskId === taskId ? { ...t, fading: true } : t
              ));
            }, 2500);

            // Remove toast after fade
            setTimeout(() => {
              setToasts(p => p.filter(t => t.taskId !== taskId));
            }, 4000);
          } else if (taskStatus === 'failed') {
            newToasts[toastIndex] = { ...newToasts[toastIndex], status: 'error' };

            // Remove toast after delay
            setTimeout(() => {
              setToasts(p => p.filter(t => t.taskId !== taskId));
            }, 3000);
          } else if (taskStatus === 'queued') {
            // Task was queued (MCP/async mode) - remove working toast and increment counter
            setQueuedCount(c => c + 1);

            // Remove the working toast immediately
            return prev.filter(t => t.taskId !== taskId);
          }

          return newToasts;
        });
      }
    };

    chrome.runtime.onMessage.addListener(handleTaskUpdate);
    return () => {
      chrome.runtime.onMessage.removeListener(handleTaskUpdate);
    };
  }, []);

  // Handle keyboard shortcuts (when active)
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (selectedElement) {
        clearSelection();
      } else if (isActive) {
        setActive(false);
        // Notify background script so popup stays in sync
        chrome.runtime.sendMessage({ type: 'SET_ACTIVE', active: false }).catch(() => {});
      }
    }

    // Spacebar selects the currently hovered element (or reference element in reference mode)
    if (e.key === ' ' && isActive && (!selectedElement || isReferencing)) {
      e.preventDefault();
      e.stopPropagation();

      // Use stored DOM element reference
      const target = hoveredDomElement.current;
      if (target) {
        const htmlTarget = target instanceof HTMLElement ? target : target as unknown as HTMLElement;
        const elementInfo = getElementInfo(htmlTarget);

        if (isReferencing) {
          // In reference mode, set as referenced element
          setReferencedElement(elementInfo);
        } else {
          // Normal mode, select the element
          selectedDomElement.current = htmlTarget;
          setSelectedElement(elementInfo);
          setCurrentRect(target.getBoundingClientRect());
        }
      }
    }

    // Arrow Up - go to parent element
    if (e.key === 'ArrowUp' && isActive && (!selectedElement || isReferencing) && hoveredDomElement.current) {
      e.preventDefault();
      const parent = hoveredDomElement.current.parentElement;
      if (parent && parent !== document.body && !parent.closest('#visual-feedback-overlay')) {
        hoveredDomElement.current = parent;
        const htmlTarget = parent instanceof HTMLElement ? parent : parent as unknown as HTMLElement;
        const elementInfo = getElementInfo(htmlTarget);
        hoverElement(elementInfo);
      }
    }

    // Arrow Down - go to child element at mouse position (or first visible child)
    if (e.key === 'ArrowDown' && isActive && (!selectedElement || isReferencing) && hoveredDomElement.current) {
      e.preventDefault();
      const { x, y } = lastMousePos.current;

      // Find children that contain the mouse point
      const children = Array.from(hoveredDomElement.current.children);
      let foundChild: Element | null = null;

      // First try to find a child that contains the mouse position
      for (const child of children) {
        if (child.closest('#visual-feedback-overlay')) continue;
        const rect = child.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
          foundChild = child;
          break;
        }
      }

      // If no child at mouse position, find the first visible child
      if (!foundChild) {
        for (const child of children) {
          if (child.closest('#visual-feedback-overlay')) continue;
          const rect = child.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            foundChild = child;
            break;
          }
        }
      }

      if (foundChild) {
        hoveredDomElement.current = foundChild;
        const htmlTarget = foundChild instanceof HTMLElement ? foundChild : foundChild as unknown as HTMLElement;
        const elementInfo = getElementInfo(htmlTarget);
        hoverElement(elementInfo);
      }
    }

    // Arrow Left/Right - cycle through sibling elements
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && isActive && (!selectedElement || isReferencing) && hoveredDomElement.current) {
      e.preventDefault();
      const parent = hoveredDomElement.current.parentElement;
      if (!parent || parent === document.body) return;

      const siblings = Array.from(parent.children).filter(child => {
        if (child.closest('#visual-feedback-overlay')) return false;
        const rect = child.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });

      const currentIndex = siblings.indexOf(hoveredDomElement.current);
      if (currentIndex === -1) return;

      let nextIndex: number;
      if (e.key === 'ArrowRight') {
        nextIndex = (currentIndex + 1) % siblings.length;
      } else {
        nextIndex = (currentIndex - 1 + siblings.length) % siblings.length;
      }

      const nextSibling = siblings[nextIndex];
      if (nextSibling) {
        hoveredDomElement.current = nextSibling;
        const htmlTarget = nextSibling instanceof HTMLElement ? nextSibling : nextSibling as unknown as HTMLElement;
        const elementInfo = getElementInfo(htmlTarget);
        hoverElement(elementInfo);
      }
    }
  }, [isActive, selectedElement, isReferencing, setActive, clearSelection, hoverElement, setReferencedElement]);

  // Global toggle shortcut - platform-specific
  // macOS: Ctrl (Ctrl isn't used for common shortcuts on macOS)
  // Windows/Linux: Alt+Shift+V (Ctrl conflicts with copy/paste/etc)
  useEffect(() => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const shouldToggle = isMac
        ? e.key === 'Control' && !e.shiftKey && !e.altKey && !e.metaKey
        : e.key === 'Alt' && e.ctrlKey && !e.shiftKey && !e.metaKey;

      if (shouldToggle) {
        e.preventDefault();
        const newState = !isActive;
        setActive(newState);
        // Notify background script so popup stays in sync
        chrome.runtime.sendMessage({ type: 'SET_ACTIVE', active: newState }).catch(() => {});
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown, true);
    };
  }, [isActive, setActive]);

  // Set up event listeners
  useEffect(() => {
    let styleEl: HTMLStyleElement | null = null;

    if (isActive) {
      document.addEventListener('mousemove', handleMouseMove, true);
      document.addEventListener('click', handleClick, true);
      document.addEventListener('keydown', handleKeyDown, true);

      // Inject aggressive style override to enable clicking on ALL elements
      styleEl = document.createElement('style');
      styleEl.id = 'vf-pointer-override';
      styleEl.textContent = `
        *, *::before, *::after,
        *:disabled, [disabled], [aria-disabled="true"],
        button:disabled, input:disabled, select:disabled, textarea:disabled {
          pointer-events: auto !important;
          cursor: crosshair !important;
        }
      `;
      document.head.appendChild(styleEl);

      document.body.style.cursor = 'crosshair';
      document.body.classList.add('vf-tool-active');
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove, true);
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('keydown', handleKeyDown, true);
      document.body.style.cursor = '';
      document.body.classList.remove('vf-tool-active');

      // Remove injected style
      if (styleEl && styleEl.parentNode) {
        styleEl.parentNode.removeChild(styleEl);
      }
      const existingStyle = document.getElementById('vf-pointer-override');
      if (existingStyle) {
        existingStyle.remove();
      }
    };
  }, [isActive, handleMouseMove, handleClick, handleKeyDown]);

  // Listen for messages from background script
  useEffect(() => {
    const handleMessage = (
      message: { type: string; active?: boolean; status?: string },
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response: { success: boolean }) => void
    ) => {
      if (message.type === 'SET_ACTIVE' && message.active !== undefined) {
        setActive(message.active);
        sendResponse({ success: true });
        return true; // Keep channel open for async response
      } else if (message.type === 'CONNECTION_STATUS') {
        // Could update UI to show connection status
        console.log('[VF] Connection status:', message.status);
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, [setActive]);

  // Calculate toast offset (queued toast takes first slot if visible)
  const hasQueuedToast = queuedCount > 0;
  const toastOffset = hasQueuedToast ? 1 : 0;

  // Toast notifications render (always visible, even when tool is inactive)
  const toastContainer = (
    <div className="vf-toast-container">
      {/* Queued tasks counter toast */}
      {queuedCount > 0 && (
        <div className="vf-toast vf-toast--queued" style={{ top: '16px' }}>
          <div className="vf-toast-content">
            <svg
              className="vf-toast-icon vf-toast-icon--queued"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#3b82f6"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="9" y1="9" x2="15" y2="9" />
              <line x1="9" y1="13" x2="15" y2="13" />
              <line x1="9" y1="17" x2="12" y2="17" />
            </svg>
            <span className="vf-toast-text">{queuedCount} queued task{queuedCount !== 1 ? 's' : ''}</span>
          </div>
          <button
            className="vf-toast-dismiss"
            onClick={() => setQueuedCount(0)}
            title="Clear queue count"
          >
            ×
          </button>
        </div>
      )}
      {toasts.filter(t => !t.dismissed).map((toast, index) => (
        <div
          key={toast.taskId}
          className={`vf-toast ${toast.fading ? 'vf-toast--fading' : ''}`}
          style={{ top: `${16 + (index + toastOffset) * 56}px` }}
        >
          <div className="vf-toast-content">
            {/* Spinner for working state */}
            {toast.status === 'working' && (
              <>
                <div className="vf-toast-spinner" />
                <span className="vf-toast-text">Working...</span>
              </>
            )}
            {/* Checkmark for done state */}
            {toast.status === 'done' && (
              <>
                <svg
                  className="vf-toast-icon vf-toast-icon--success"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span className="vf-toast-text">Success!</span>
              </>
            )}
            {/* X for error state */}
            {toast.status === 'error' && (
              <>
                <svg
                  className="vf-toast-icon vf-toast-icon--error"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                <span className="vf-toast-text vf-toast-text--error">Failed</span>
              </>
            )}
            {/* Element name */}
            <span className="vf-toast-element">{toast.elementName}</span>
          </div>
          {/* Dismiss button - only show for working/error states */}
          {toast.status !== 'done' && (
            <button
              className="vf-toast-dismiss"
              onClick={() => dismissToast(toast.taskId)}
              title="Dismiss (task continues in background)"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      ))}
    </div>
  );

  // If not active, only render toasts
  if (!isActive) {
    return toasts.length > 0 ? <div className="vf-overlay">{toastContainer}</div> : null;
  }

  return (
    <div className="vf-overlay">
      {/* Hover highlight - show when no element selected OR during reference mode */}
      {hoveredElement && (!selectedElement || isReferencing) && (
        <ElementHighlight element={hoveredElement} type="hover" />
      )}

      {/* Selected element with highlight and panel */}
      {selectedElement && currentRect && (
        <>
          <ElementHighlight
            element={{ ...selectedElement, rect: currentRect }}
            type="selected"
          />
          <FloatingPanel
            element={{ ...selectedElement, rect: currentRect }}
            onDragStart={() => setIsDraggingPanel(true)}
            onDragEnd={() => setIsDraggingPanel(false)}
            onClose={clearSelection}
            onStartReference={handleStartReference}
            onEndReference={handleEndReference}
            referencedElement={referencedElement}
            onTaskSubmitted={handleTaskSubmitted}
          />
        </>
      )}

      {/* Toast notifications in top left */}
      {toastContainer}
    </div>
  );
}
