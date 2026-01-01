import React, { useState, useRef, useCallback, useEffect } from 'react';

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
}

export function ColorPicker({ color, onChange }: ColorPickerProps) {
  const [hue, setHue] = useState(0);
  const [saturation, setSaturation] = useState(100);
  const [lightness, setLightness] = useState(50);
  const gradientRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const [isDraggingGradient, setIsDraggingGradient] = useState(false);
  const [isDraggingHue, setIsDraggingHue] = useState(false);

  // Parse initial color
  useEffect(() => {
    const parsed = parseColor(color);
    if (parsed) {
      setHue(parsed.h);
      setSaturation(parsed.s);
      setLightness(parsed.l);
    }
  }, []);

  const updateColor = useCallback((h: number, s: number, l: number) => {
    const rgb = hslToRgb(h, s, l);
    const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
    onChange(hex);
  }, [onChange]);

  const handleGradientMouseDown = (e: React.MouseEvent) => {
    setIsDraggingGradient(true);
    handleGradientMove(e);
  };

  const handleGradientMove = (e: React.MouseEvent | MouseEvent) => {
    if (!gradientRef.current) return;
    const rect = gradientRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    const newSaturation = x * 100;
    const newLightness = (1 - y) * 50 + 25; // Lightness from 25 to 75

    setSaturation(newSaturation);
    setLightness(newLightness);
    updateColor(hue, newSaturation, newLightness);
  };

  const handleHueMouseDown = (e: React.MouseEvent) => {
    setIsDraggingHue(true);
    handleHueMove(e);
  };

  const handleHueMove = (e: React.MouseEvent | MouseEvent) => {
    if (!hueRef.current) return;
    const rect = hueRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newHue = x * 360;

    setHue(newHue);
    updateColor(newHue, saturation, lightness);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingGradient) handleGradientMove(e);
      if (isDraggingHue) handleHueMove(e);
    };

    const handleMouseUp = () => {
      setIsDraggingGradient(false);
      setIsDraggingHue(false);
    };

    if (isDraggingGradient || isDraggingHue) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingGradient, isDraggingHue]);

  const gradientStyle: React.CSSProperties = {
    width: '100%',
    height: '100px',
    borderRadius: '6px',
    background: `
      linear-gradient(to top, rgba(0,0,0,0.5), transparent, rgba(255,255,255,0.5)),
      linear-gradient(to right, #808080, hsl(${hue}, 100%, 50%))
    `,
    cursor: 'crosshair',
    position: 'relative',
  };

  const pickerStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${saturation}%`,
    top: `${100 - ((lightness - 25) / 50) * 100}%`,
    width: '12px',
    height: '12px',
    border: '2px solid white',
    borderRadius: '50%',
    transform: 'translate(-50%, -50%)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
    pointerEvents: 'none',
  };

  return (
    <div className="vf-color-picker" style={{ marginTop: '12px' }}>
      {/* Saturation/Lightness gradient */}
      <div
        ref={gradientRef}
        style={gradientStyle}
        onMouseDown={handleGradientMouseDown}
      >
        <div style={pickerStyle} />
      </div>

      {/* Hue slider */}
      <div
        ref={hueRef}
        style={{
          width: '100%',
          height: '14px',
          marginTop: '8px',
          borderRadius: '7px',
          background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
          cursor: 'pointer',
          position: 'relative',
        }}
        onMouseDown={handleHueMouseDown}
      >
        <div
          style={{
            position: 'absolute',
            left: `${(hue / 360) * 100}%`,
            top: '50%',
            width: '10px',
            height: '10px',
            border: '2px solid white',
            borderRadius: '50%',
            transform: 'translate(-50%, -50%)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* Hex input */}
      <input
        type="text"
        value={rgbToHex(...Object.values(hslToRgb(hue, saturation, lightness)) as [number, number, number])}
        onChange={(e) => {
          const parsed = parseColor(e.target.value);
          if (parsed) {
            setHue(parsed.h);
            setSaturation(parsed.s);
            setLightness(parsed.l);
            onChange(e.target.value);
          }
        }}
        style={{
          marginTop: '8px',
          width: '100%',
          padding: '6px 8px',
          fontSize: '12px',
          border: '1px solid rgba(0,0,0,0.1)',
          borderRadius: '4px',
          fontFamily: 'monospace',
        }}
      />
    </div>
  );
}

// Color conversion utilities
function parseColor(color: string): { h: number; s: number; l: number } | null {
  // Handle hex
  const hexMatch = color.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (hexMatch) {
    const r = parseInt(hexMatch[1], 16) / 255;
    const g = parseInt(hexMatch[2], 16) / 255;
    const b = parseInt(hexMatch[3], 16) / 255;
    return rgbToHsl(r * 255, g * 255, b * 255);
  }

  // Handle rgb(a)
  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    return rgbToHsl(
      parseInt(rgbMatch[1]),
      parseInt(rgbMatch[2]),
      parseInt(rgbMatch[3])
    );
  }

  return null;
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  h /= 360;
  s /= 100;
  l /= 100;

  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
}
