import React from 'react';
import type { MeasureDistance } from '../../shared/types';

interface MeasureLinesProps {
  distances: MeasureDistance[];
}

export function MeasureLines({ distances }: MeasureLinesProps) {
  return (
    <>
      {distances.map((distance, index) => (
        <MeasureLine key={index} distance={distance} />
      ))}
    </>
  );
}

function MeasureLine({ distance }: { distance: MeasureDistance }) {
  const { from, to, distance: px, direction } = distance;

  const isHorizontal = direction === 'horizontal';

  const lineStyle: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(from.x, to.x),
    top: Math.min(from.y, to.y),
    width: isHorizontal ? Math.abs(to.x - from.x) : 1,
    height: isHorizontal ? 1 : Math.abs(to.y - from.y),
    background: '#f97316',
    pointerEvents: 'none',
  };

  const labelStyle: React.CSSProperties = {
    position: 'fixed',
    left: (from.x + to.x) / 2 - 15,
    top: (from.y + to.y) / 2 - 8,
    background: '#ea580c',
    color: 'white',
    fontSize: '10px',
    padding: '1px 4px',
    borderRadius: '2px',
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
  };

  return (
    <>
      <div style={lineStyle} />
      <div style={labelStyle}>{Math.round(px)}px</div>
    </>
  );
}
