import React, { useState } from 'react';
import type { ComputedStyleInfo } from '../../shared/types';

interface BoxModelDiagramProps {
  styles: ComputedStyleInfo;
  onChange: (property: string, value: string) => void;
}

export function BoxModelDiagram({ styles, onChange }: BoxModelDiagramProps) {
  const [editingProperty, setEditingProperty] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleEdit = (property: string, currentValue: string) => {
    setEditingProperty(property);
    setEditValue(parseFloat(currentValue).toString());
  };

  const handleSave = () => {
    if (editingProperty && editValue) {
      onChange(editingProperty, `${editValue}px`);
    }
    setEditingProperty(null);
    setEditValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setEditingProperty(null);
      setEditValue('');
    }
  };

  const renderValue = (property: string, value: string) => {
    const numValue = parseFloat(value);
    const displayValue = isNaN(numValue) ? '0' : Math.round(numValue).toString();

    if (editingProperty === property) {
      return (
        <input
          autoFocus
          type="number"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          style={{
            width: '32px',
            padding: '1px 2px',
            fontSize: '9px',
            border: '1px solid #3b82f6',
            borderRadius: '2px',
            textAlign: 'center',
          }}
        />
      );
    }

    return (
      <button
        onClick={() => handleEdit(property, value)}
        className="vf-box-value"
        style={{
          cursor: 'pointer',
          border: 'none',
          background: 'rgba(255,255,255,0.9)',
        }}
      >
        {displayValue}
      </button>
    );
  };

  return (
    <div className="vf-box-model">
      {/* Margin layer */}
      <div className="vf-box-margin">
        <span style={{ position: 'absolute', top: '2px', left: '50%', transform: 'translateX(-50%)', fontSize: '8px', color: '#f97316' }}>
          margin
        </span>

        {/* Margin values */}
        <div style={{ position: 'absolute', top: '2px', left: '50%', transform: 'translateX(-50%)' }}>
          {renderValue('marginTop', styles.marginTop)}
        </div>
        <div style={{ position: 'absolute', right: '2px', top: '50%', transform: 'translateY(-50%)' }}>
          {renderValue('marginRight', styles.marginRight)}
        </div>
        <div style={{ position: 'absolute', bottom: '2px', left: '50%', transform: 'translateX(-50%)' }}>
          {renderValue('marginBottom', styles.marginBottom)}
        </div>
        <div style={{ position: 'absolute', left: '2px', top: '50%', transform: 'translateY(-50%)' }}>
          {renderValue('marginLeft', styles.marginLeft)}
        </div>

        {/* Border layer */}
        <div className="vf-box-border">
          {/* Padding layer */}
          <div className="vf-box-padding">
            <span style={{ position: 'absolute', top: '2px', left: '50%', transform: 'translateX(-50%)', fontSize: '8px', color: '#22c55e' }}>
              padding
            </span>

            {/* Padding values */}
            <div style={{ position: 'absolute', top: '2px', left: '50%', transform: 'translateX(-50%)' }}>
              {renderValue('paddingTop', styles.paddingTop)}
            </div>
            <div style={{ position: 'absolute', right: '2px', top: '50%', transform: 'translateY(-50%)' }}>
              {renderValue('paddingRight', styles.paddingRight)}
            </div>
            <div style={{ position: 'absolute', bottom: '2px', left: '50%', transform: 'translateX(-50%)' }}>
              {renderValue('paddingBottom', styles.paddingBottom)}
            </div>
            <div style={{ position: 'absolute', left: '2px', top: '50%', transform: 'translateY(-50%)' }}>
              {renderValue('paddingLeft', styles.paddingLeft)}
            </div>

            {/* Content */}
            <div className="vf-box-content">
              {Math.round(parseFloat(styles.width))} × {Math.round(parseFloat(styles.height))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
