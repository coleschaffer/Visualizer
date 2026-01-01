import React, { useState, useCallback, useEffect } from 'react';
import type { ElementInfo } from '../../shared/types';

interface ResizeHandlesProps {
  element: ElementInfo;
  onResize: (newRect: DOMRect) => void;
}

type HandlePosition = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export function ResizeHandles({ element, onResize }: ResizeHandlesProps) {
  const { rect } = element;
  const [isDragging, setIsDragging] = useState(false);
  const [activeHandle, setActiveHandle] = useState<HandlePosition | null>(null);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [startRect, setStartRect] = useState<DOMRect | null>(null);
  const [aspectRatio, setAspectRatio] = useState(1);

  const handles: HandlePosition[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

  const handleMouseDown = useCallback((e: React.MouseEvent, position: HandlePosition) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setActiveHandle(position);
    setStartPos({ x: e.clientX, y: e.clientY });
    setStartRect(rect);
    setAspectRatio(rect.width / rect.height);
  }, [rect]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !activeHandle || !startRect) return;

    const dx = e.clientX - startPos.x;
    const dy = e.clientY - startPos.y;
    const maintainAspect = !e.shiftKey; // Shift key disables aspect ratio lock

    let newWidth = startRect.width;
    let newHeight = startRect.height;
    let newLeft = startRect.left;
    let newTop = startRect.top;

    // Calculate new dimensions based on handle
    switch (activeHandle) {
      case 'e':
        newWidth = Math.max(20, startRect.width + dx);
        if (maintainAspect) newHeight = newWidth / aspectRatio;
        break;
      case 'w':
        newWidth = Math.max(20, startRect.width - dx);
        if (maintainAspect) newHeight = newWidth / aspectRatio;
        newLeft = startRect.left + (startRect.width - newWidth);
        break;
      case 's':
        newHeight = Math.max(20, startRect.height + dy);
        if (maintainAspect) newWidth = newHeight * aspectRatio;
        break;
      case 'n':
        newHeight = Math.max(20, startRect.height - dy);
        if (maintainAspect) newWidth = newHeight * aspectRatio;
        newTop = startRect.top + (startRect.height - newHeight);
        break;
      case 'se':
        if (maintainAspect) {
          const delta = Math.max(dx, dy);
          newWidth = Math.max(20, startRect.width + delta);
          newHeight = newWidth / aspectRatio;
        } else {
          newWidth = Math.max(20, startRect.width + dx);
          newHeight = Math.max(20, startRect.height + dy);
        }
        break;
      case 'sw':
        if (maintainAspect) {
          const delta = Math.max(-dx, dy);
          newWidth = Math.max(20, startRect.width + delta);
          newHeight = newWidth / aspectRatio;
          newLeft = startRect.left + (startRect.width - newWidth);
        } else {
          newWidth = Math.max(20, startRect.width - dx);
          newHeight = Math.max(20, startRect.height + dy);
          newLeft = startRect.left + (startRect.width - newWidth);
        }
        break;
      case 'ne':
        if (maintainAspect) {
          const delta = Math.max(dx, -dy);
          newWidth = Math.max(20, startRect.width + delta);
          newHeight = newWidth / aspectRatio;
          newTop = startRect.top + (startRect.height - newHeight);
        } else {
          newWidth = Math.max(20, startRect.width + dx);
          newHeight = Math.max(20, startRect.height - dy);
          newTop = startRect.top + (startRect.height - newHeight);
        }
        break;
      case 'nw':
        if (maintainAspect) {
          const delta = Math.max(-dx, -dy);
          newWidth = Math.max(20, startRect.width + delta);
          newHeight = newWidth / aspectRatio;
          newLeft = startRect.left + (startRect.width - newWidth);
          newTop = startRect.top + (startRect.height - newHeight);
        } else {
          newWidth = Math.max(20, startRect.width - dx);
          newHeight = Math.max(20, startRect.height - dy);
          newLeft = startRect.left + (startRect.width - newWidth);
          newTop = startRect.top + (startRect.height - newHeight);
        }
        break;
    }

    // Apply to element (live preview)
    const el = document.querySelector(element.selector) as HTMLElement;
    if (el) {
      el.style.width = `${newWidth}px`;
      el.style.height = `${newHeight}px`;
    }

    // Report new dimensions
    onResize(new DOMRect(newLeft, newTop, newWidth, newHeight));
  }, [isDragging, activeHandle, startPos, startRect, aspectRatio, element.selector, onResize]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setActiveHandle(null);
  }, []);

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

  return (
    <>
      {handles.map((position) => (
        <div
          key={position}
          className={`vf-resize-handle vf-resize-handle--${position}`}
          style={getHandleStyle(rect, position)}
          onMouseDown={(e) => handleMouseDown(e, position)}
        />
      ))}
    </>
  );
}

function getHandleStyle(rect: DOMRect, position: HandlePosition): React.CSSProperties {
  const base: React.CSSProperties = {
    position: 'fixed',
    width: '10px',
    height: '10px',
    background: '#3b82f6',
    border: '2px solid white',
    borderRadius: '50%',
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
    zIndex: 2147483647,
  };

  switch (position) {
    case 'nw':
      return { ...base, left: rect.left - 5, top: rect.top - 5, cursor: 'nw-resize' };
    case 'n':
      return { ...base, left: rect.left + rect.width / 2 - 5, top: rect.top - 5, cursor: 'n-resize' };
    case 'ne':
      return { ...base, left: rect.right - 5, top: rect.top - 5, cursor: 'ne-resize' };
    case 'e':
      return { ...base, left: rect.right - 5, top: rect.top + rect.height / 2 - 5, cursor: 'e-resize' };
    case 'se':
      return { ...base, left: rect.right - 5, top: rect.bottom - 5, cursor: 'se-resize' };
    case 's':
      return { ...base, left: rect.left + rect.width / 2 - 5, top: rect.bottom - 5, cursor: 's-resize' };
    case 'sw':
      return { ...base, left: rect.left - 5, top: rect.bottom - 5, cursor: 'sw-resize' };
    case 'w':
      return { ...base, left: rect.left - 5, top: rect.top + rect.height / 2 - 5, cursor: 'w-resize' };
  }
}
