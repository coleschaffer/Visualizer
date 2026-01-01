import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { ElementInfo, VisualChange } from '../../shared/types';
import { useStore, generateChangeId } from '../../shared/store';
import { BoxModelDiagram } from '../controls/BoxModelDiagram';
import { ColorPicker } from '../controls/ColorPicker';
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
  const { panelPosition, addChange } = useStore();
  const [feedback, setFeedback] = useState('');
  const [status, setStatus] = useState<'idle' | 'working' | 'done'>('idle');
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [visualChanges, setVisualChanges] = useState<Partial<ElementInfo['computedStyles']>>({});
  const panelRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Initialize position from store
  useEffect(() => {
    if (panelPosition) {
      setPosition({ x: panelPosition.x, y: panelPosition.y });
    }
  }, [panelPosition]);

  // Handle panel dragging
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.vf-panel-header')) {
      setIsDragging(true);
      onDragStart();
      dragOffset.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      };
    }
  }, [position, onDragStart]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y,
      });
    }
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
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

  // Handle visual change from box model or color picker
  const handleVisualChange = (property: string, value: string) => {
    setVisualChanges(prev => ({ ...prev, [property]: value }));

    // Apply live preview
    const el = document.querySelector(element.selector) as HTMLElement;
    if (el) {
      const cssProperty = property.replace(/([A-Z])/g, '-$1').toLowerCase();
      el.style.setProperty(cssProperty, value);
    }
  };

  // Handle confirm
  const handleConfirm = async () => {
    if (!feedback.trim() && Object.keys(visualChanges).length === 0) return;

    setStatus('working');

    // Play subtle sound
    playConfirmSound();

    // Capture element screenshot
    const screenshot = await captureElementScreenshot(element.rect);

    const change: VisualChange = {
      id: generateChangeId(),
      element: {
        ...element,
        screenshot,
      },
      feedback: feedback.trim(),
      visualAdjustments: visualChanges,
      cssFramework: 'unknown', // Will be detected
      originalUnits: {},
      timestamp: new Date().toISOString(),
      status: 'confirmed',
    };

    addChange(change);

    // Send to background script for MCP
    chrome.runtime.sendMessage({
      type: 'CONFIRM_CHANGE',
      change,
    });

    // Simulate completion (in real impl, wait for MCP response)
    setTimeout(() => {
      setStatus('done');
      setTimeout(() => {
        setStatus('idle');
        setFeedback('');
        setVisualChanges({});
      }, 1500);
    }, 1000);
  };

  // Handle undo
  const handleUndo = () => {
    // Revert visual changes
    const el = document.querySelector(element.selector) as HTMLElement;
    if (el) {
      Object.keys(visualChanges).forEach(property => {
        const cssProperty = property.replace(/([A-Z])/g, '-$1').toLowerCase();
        el.style.removeProperty(cssProperty);
      });
    }
    setVisualChanges({});
  };

  const panelStyle: React.CSSProperties = {
    left: position.x,
    top: position.y,
    cursor: isDragging ? 'grabbing' : undefined,
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
        <div className="vf-panel-title">
          <span className="vf-element-info-tag">{element.tag}</span>
          {element.id && <span style={{ color: '#a855f7' }}>#{element.id}</span>}
        </div>
        <button className="vf-panel-close" onClick={onClose}>
          ✕
        </button>
      </div>

      {/* Content - side by side */}
      <div className="vf-panel-content">
        {/* Visual controls (left) */}
        <div className="vf-panel-visual">
          <BoxModelDiagram
            styles={element.computedStyles}
            onChange={handleVisualChange}
          />

          <button
            onClick={() => setShowColorPicker(!showColorPicker)}
            style={{
              marginTop: '12px',
              width: '100%',
              padding: '8px',
              background: element.computedStyles.backgroundColor,
              border: '1px solid rgba(0,0,0,0.1)',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '11px',
              color: '#6b7280',
            }}
          >
            Background Color
          </button>

          {showColorPicker && (
            <ColorPicker
              color={element.computedStyles.backgroundColor}
              onChange={(color) => handleVisualChange('backgroundColor', color)}
            />
          )}

          {Object.keys(visualChanges).length > 0 && (
            <button
              onClick={handleUndo}
              style={{
                marginTop: '8px',
                width: '100%',
                padding: '6px',
                background: 'transparent',
                border: '1px solid #ef4444',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '11px',
                color: '#ef4444',
              }}
            >
              Undo Changes
            </button>
          )}
        </div>

        {/* Chat (right) */}
        <div className="vf-panel-chat">
          <div className="vf-element-info">
            {element.smartSummary || `${element.tag} element, ${Math.round(element.rect.width)}×${Math.round(element.rect.height)}px`}
          </div>

          <textarea
            className="vf-chat-input"
            placeholder="Describe what you want to change..."
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                handleConfirm();
              }
            }}
          />

          <button
            className={`vf-confirm-btn ${status === 'working' ? 'vf-confirm-btn--working' : ''}`}
            onClick={handleConfirm}
            disabled={status === 'working' || (!feedback.trim() && Object.keys(visualChanges).length === 0)}
          >
            {status === 'idle' && 'Confirm & Send to Claude'}
            {status === 'working' && 'Working...'}
            {status === 'done' && '✓ Done'}
          </button>

          {status !== 'idle' && (
            <div className={`vf-status ${status === 'done' ? 'vf-status--success' : ''}`}>
              {status === 'working' && 'Sending to Claude Code...'}
              {status === 'done' && 'Change sent successfully!'}
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
