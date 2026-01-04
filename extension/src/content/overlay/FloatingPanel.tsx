import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { ElementInfo, VisualChange } from '../../shared/types';
import { useStore, generateChangeId } from '../../shared/store';
import { captureElementScreenshot } from '../selection/ScreenshotCapture';

interface FloatingPanelProps {
  element: ElementInfo;
  onDragStart: () => void;
  onDragEnd: () => void;
  onClose: () => void;
}

export function FloatingPanel({
  element,
  onDragStart,
  onDragEnd,
  onClose,
}: FloatingPanelProps) {
  const { addChange } = useStore();
  const [feedback, setFeedback] = useState('');
  const [status, setStatus] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dragMouseOffset = useRef({ x: 0, y: 0 });

  // Store relative offset from element for scroll tracking
  const relativeOffset = useRef<{ x: number; y: number } | null>(null);
  const initialElementPos = useRef<{ left: number; top: number } | null>(null);

  // Calculate position based on element rect
  const calculatePosition = useCallback((rect: DOMRect): { x: number; y: number } => {
    // If user has dragged, track relative to element
    if (relativeOffset.current && initialElementPos.current) {
      const deltaX = rect.left - initialElementPos.current.left;
      const deltaY = rect.top - initialElementPos.current.top;
      return {
        x: relativeOffset.current.x + deltaX,
        y: relativeOffset.current.y + deltaY,
      };
    }

    // Initial positioning near element
    const panelWidth = 320;
    const panelHeight = 200;
    const padding = 12;

    let x = rect.right + padding;
    let y = rect.top;

    if (x + panelWidth > window.innerWidth) {
      x = rect.left - panelWidth - padding;
    }

    if (x < 0) {
      x = Math.max(padding, rect.left);
      y = rect.bottom + padding;
    }

    if (y + panelHeight > window.innerHeight) {
      y = Math.max(padding, window.innerHeight - panelHeight - padding);
    }

    if (y < 0) {
      y = padding;
    }

    // Store initial offset on first calculation
    if (!relativeOffset.current) {
      relativeOffset.current = { x, y };
      initialElementPos.current = { left: rect.left, top: rect.top };
    }

    return { x, y };
  }, []);

  // Get current position (drag position overrides calculated)
  const position = dragPosition ?? calculatePosition(element.rect);

  // Auto-focus textarea on mount
  useEffect(() => {
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  }, []);

  // Handle panel dragging
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.vf-panel-header')) {
      setIsDragging(true);
      onDragStart();
      dragMouseOffset.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      };
    }
  }, [position, onDragStart]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      const newX = e.clientX - dragMouseOffset.current.x;
      const newY = e.clientY - dragMouseOffset.current.y;
      setDragPosition({ x: newX, y: newY });
      // Update relative offset for scroll tracking
      relativeOffset.current = { x: newX, y: newY };
      initialElementPos.current = { left: element.rect.left, top: element.rect.top };
    }
  }, [isDragging, element.rect]);

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      setDragPosition(null); // Clear drag position, use calculated
      onDragEnd();
    }
  }, [isDragging, onDragEnd]);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Handle confirm
  const handleConfirm = async () => {
    if (!feedback.trim() || status === 'working') return;

    setStatus('working');
    setErrorMessage(null);

    try {
      // Capture element screenshot
      const screenshot = await captureElementScreenshot(element.rect);

      const change: VisualChange = {
        id: generateChangeId(),
        element: {
          ...element,
          screenshot,
        },
        feedback: feedback.trim(),
        visualAdjustments: {},
        cssFramework: 'unknown',
        originalUnits: {},
        timestamp: new Date().toISOString(),
        status: 'confirmed',
      };

      addChange(change);

      // Get project path from storage or use default
      const storage = await chrome.storage.local.get(['projectPath']);
      const projectPath = storage.projectPath || '/tmp';

      // Send to background script and wait for response
      const response = await new Promise<{ success: boolean; error?: string }>((resolve) => {
        chrome.runtime.sendMessage(
          { type: 'SUBMIT_FEEDBACK', change, projectPath, pageUrl: window.location.href },
          (resp) => resolve(resp || { success: false, error: 'No response from server' })
        );
      });

      if (response.success) {
        // Play subtle sound on success
        playConfirmSound();
        setStatus('done');
        setTimeout(() => {
          onClose();
        }, 400);
      } else {
        console.error('Failed to send feedback:', response.error);
        setStatus('error');
        setErrorMessage(response.error || 'Failed to send to terminal');
        // Reset after 3 seconds
        setTimeout(() => {
          setStatus('idle');
          setErrorMessage(null);
        }, 3000);
      }
    } catch (error) {
      console.error('Error confirming change:', error);
      setStatus('error');
      setErrorMessage('Connection error');
      setTimeout(() => {
        setStatus('idle');
        setErrorMessage(null);
      }, 3000);
    }
  };

  const panelStyle: React.CSSProperties = {
    left: position.x,
    top: position.y,
    cursor: isDragging ? 'grabbing' : undefined,
  };

  // Get full element identifier for copying
  const getFullElementName = () => {
    if (element.classes.length > 0) {
      return `.${element.classes[0]}`;
    }
    if (element.id) {
      return `#${element.id}`;
    }
    return element.tag;
  };

  // Get shortened element name for display
  const getElementName = () => {
    const fullName = getFullElementName();
    if (fullName.length > 30) {
      return fullName.slice(0, 27) + '...';
    }
    return fullName;
  };

  // Copy element name to clipboard
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const name = getFullElementName();
    try {
      await navigator.clipboard.writeText(name);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = name;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div
      ref={panelRef}
      className="vf-panel"
      style={panelStyle}
      onMouseDown={handleMouseDown}
    >
      {/* Header */}
      <div className="vf-panel-header">
        <div
          className="vf-panel-title"
          onClick={handleCopy}
          title="Click to copy"
          style={{
            fontSize: '12px',
            color: copied ? '#22c55e' : '#374151',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'color 0.2s ease',
            flex: 1,
            minWidth: 0,
          }}
        >
          {getElementName()}
        </div>
        <button
          className="vf-panel-close"
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#9ca3af',
            fontSize: '16px',
            cursor: 'pointer',
            padding: '4px',
            lineHeight: 1,
          }}
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div className="vf-panel-content">
        <div className="vf-panel-chat">
          <textarea
            ref={textareaRef}
            className="vf-chat-input"
            placeholder="Describe what you want to change..."
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (e.altKey) {
                  // Option+Enter = new line (let it happen naturally)
                  return;
                }
                // Enter = confirm
                e.preventDefault();
                handleConfirm();
              }
            }}
          />

          <button
            className={`vf-confirm-btn ${status === 'working' ? 'vf-confirm-btn--working' : ''}`}
            onClick={handleConfirm}
            disabled={status === 'working' || !feedback.trim()}
            style={{
              background: status === 'done' ? '#22c55e' : status === 'error' ? '#ef4444' : '#22c55e'
            }}
          >
            {status === 'idle' && 'Confirm'}
            {status === 'working' && 'Sending...'}
            {status === 'done' && '✓ Sent'}
            {status === 'error' && '✕ Failed'}
          </button>
          {errorMessage && (
            <div style={{
              color: '#ef4444',
              fontSize: '11px',
              marginTop: '4px',
              textAlign: 'center'
            }}>
              {errorMessage}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// Play subtle confirmation sound
function playConfirmSound() {
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
  } catch {
    // Audio not available
  }
}
