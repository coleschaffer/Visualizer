import React from 'react';
import type { ElementInfo } from '../../shared/types';

interface ElementHighlightProps {
  element: ElementInfo;
  type: 'hover' | 'selected';
}

export function ElementHighlight({ element, type }: ElementHighlightProps) {
  const { rect } = element;

  const style: React.CSSProperties = {
    position: 'fixed',
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
    pointerEvents: 'none',
  };

  const className = `vf-highlight vf-highlight--${type}`;

  return (
    <div className={className} style={style}>
      {/* Dimension badge */}
      <div className="vf-dimension-badge">
        {Math.round(rect.width)} × {Math.round(rect.height)}
      </div>
    </div>
  );
}
