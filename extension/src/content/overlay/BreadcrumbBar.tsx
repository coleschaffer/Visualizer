import React from 'react';
import type { ElementInfo } from '../../shared/types';

interface BreadcrumbBarProps {
  element: ElementInfo | null;
  onSelectPath: (index: number) => void;
}

export function BreadcrumbBar({ element, onSelectPath }: BreadcrumbBarProps) {
  if (!element) {
    return (
      <div className="vf-breadcrumb-bar">
        <span style={{ color: '#9ca3af' }}>
          Click an element to select it
        </span>
      </div>
    );
  }

  return (
    <div className="vf-breadcrumb-bar">
      {element.path.map((segment, index) => (
        <React.Fragment key={index}>
          {index > 0 && <span className="vf-breadcrumb-separator">›</span>}
          <button
            className={`vf-breadcrumb-item ${
              index === element.path.length - 1 ? 'vf-breadcrumb-item--active' : ''
            }`}
            onClick={() => onSelectPath(index)}
          >
            <span>{segment.tag}</span>
            {segment.id && (
              <span style={{ color: '#a855f7' }}>#{segment.id}</span>
            )}
            {segment.classes.slice(0, 2).map((cls, i) => (
              <span key={i} style={{ color: '#22c55e' }}>.{cls}</span>
            ))}
            {segment.classes.length > 2 && (
              <span style={{ color: '#9ca3af' }}>+{segment.classes.length - 2}</span>
            )}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}
