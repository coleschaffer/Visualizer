import type { CSSFramework } from '../../shared/types';

// Detect CSS framework used on the page
export function detectCSSFramework(element: HTMLElement): CSSFramework {
  const classes = Array.from(element.classList);
  const classString = classes.join(' ');

  // Check for Tailwind
  if (isTailwind(classString)) {
    return 'tailwind';
  }

  // Check for CSS Modules (hashed class names)
  if (isCSSModules(classes)) {
    return 'css-modules';
  }

  // Check for styled-components or Emotion (sc- or css- prefixes)
  if (isStyledComponents(classes)) {
    return 'styled-components';
  }

  if (isEmotion(classes)) {
    return 'emotion';
  }

  return 'plain-css';
}

// Check for Tailwind CSS
function isTailwind(classString: string): boolean {
  const tailwindPatterns = [
    /\b(flex|grid|block|inline|hidden)\b/,
    /\b(p|m|px|py|mx|my|pt|pb|pl|pr|mt|mb|ml|mr)-\d+\b/,
    /\b(w|h|min-w|min-h|max-w|max-h)-(\d+|full|screen|auto)\b/,
    /\b(text|bg|border)-(red|blue|green|gray|white|black|slate|zinc|neutral|stone|amber|yellow|lime|emerald|teal|cyan|sky|indigo|violet|purple|fuchsia|pink|rose)-\d+\b/,
    /\b(rounded|shadow|opacity|z)-/,
    /\b(sm|md|lg|xl|2xl):/,
    /\bhover:/,
    /\bfocus:/,
    /\bdark:/,
  ];

  return tailwindPatterns.some((pattern) => pattern.test(classString));
}

// Check for CSS Modules (hashed class names)
function isCSSModules(classes: string[]): boolean {
  // CSS Modules typically have hashed suffixes like "_1x2y3z"
  const hashPattern = /_[a-zA-Z0-9]{5,}$/;
  const hashCount = classes.filter((c) => hashPattern.test(c)).length;

  // If more than half the classes look hashed, probably CSS Modules
  return hashCount > classes.length / 2;
}

// Check for styled-components
function isStyledComponents(classes: string[]): boolean {
  // styled-components uses sc-* prefixes
  return classes.some((c) => c.startsWith('sc-'));
}

// Check for Emotion
function isEmotion(classes: string[]): boolean {
  // Emotion uses css-* prefixes
  return classes.some((c) => c.startsWith('css-'));
}

// Get the original unit used for a CSS property
export function getOriginalUnit(value: string): string {
  const match = value.match(/(px|rem|em|%|vw|vh|vmin|vmax|ch|ex)$/);
  return match ? match[1] : 'px';
}

// Convert pixel value to rem
export function pxToRem(px: number, baseFontSize: number = 16): string {
  return `${px / baseFontSize}rem`;
}

// Convert rem to pixels
export function remToPx(rem: number, baseFontSize: number = 16): string {
  return `${rem * baseFontSize}px`;
}

// Convert percentage to pixels (given parent dimension)
export function percentToPx(percent: number, parentDimension: number): string {
  return `${(percent / 100) * parentDimension}px`;
}

// Analyze Tailwind classes to extract current values
export function analyzeTailwindClasses(classString: string): Record<string, string> {
  const result: Record<string, string> = {};

  // Width
  const widthMatch = classString.match(/\bw-(\d+|full|screen|auto)\b/);
  if (widthMatch) result.width = widthMatch[1];

  // Height
  const heightMatch = classString.match(/\bh-(\d+|full|screen|auto)\b/);
  if (heightMatch) result.height = heightMatch[1];

  // Padding
  const pMatch = classString.match(/\bp-(\d+)\b/);
  if (pMatch) result.padding = pMatch[1];

  const pxMatch = classString.match(/\bpx-(\d+)\b/);
  if (pxMatch) result.paddingX = pxMatch[1];

  const pyMatch = classString.match(/\bpy-(\d+)\b/);
  if (pyMatch) result.paddingY = pyMatch[1];

  // Margin
  const mMatch = classString.match(/\bm-(\d+)\b/);
  if (mMatch) result.margin = mMatch[1];

  const mxMatch = classString.match(/\bmx-(\d+)\b/);
  if (mxMatch) result.marginX = mxMatch[1];

  const myMatch = classString.match(/\bmy-(\d+)\b/);
  if (myMatch) result.marginY = myMatch[1];

  // Background color
  const bgMatch = classString.match(/\bbg-([a-z]+-\d+)\b/);
  if (bgMatch) result.backgroundColor = bgMatch[1];

  // Text color
  const textMatch = classString.match(/\btext-([a-z]+-\d+)\b/);
  if (textMatch) result.textColor = textMatch[1];

  // Border radius
  const roundedMatch = classString.match(/\brounded(-[a-z]+)?\b/);
  if (roundedMatch) result.borderRadius = roundedMatch[0];

  return result;
}
