import type { MeasureDistance } from '../../shared/types';

// Calculate distances between two element rects
export function calculateMeasureDistances(
  selectedRect: DOMRect,
  hoveredRect: DOMRect
): MeasureDistance[] {
  const distances: MeasureDistance[] = [];

  // Skip if same element or overlapping
  if (rectsOverlap(selectedRect, hoveredRect)) {
    return distances;
  }

  // Horizontal distance (left/right)
  if (hoveredRect.left > selectedRect.right) {
    // Hovered is to the right
    distances.push({
      from: { x: selectedRect.right, y: selectedRect.top + selectedRect.height / 2 },
      to: { x: hoveredRect.left, y: selectedRect.top + selectedRect.height / 2 },
      distance: hoveredRect.left - selectedRect.right,
      direction: 'horizontal',
    });
  } else if (selectedRect.left > hoveredRect.right) {
    // Hovered is to the left
    distances.push({
      from: { x: hoveredRect.right, y: selectedRect.top + selectedRect.height / 2 },
      to: { x: selectedRect.left, y: selectedRect.top + selectedRect.height / 2 },
      distance: selectedRect.left - hoveredRect.right,
      direction: 'horizontal',
    });
  }

  // Vertical distance (top/bottom)
  if (hoveredRect.top > selectedRect.bottom) {
    // Hovered is below
    distances.push({
      from: { x: selectedRect.left + selectedRect.width / 2, y: selectedRect.bottom },
      to: { x: selectedRect.left + selectedRect.width / 2, y: hoveredRect.top },
      distance: hoveredRect.top - selectedRect.bottom,
      direction: 'vertical',
    });
  } else if (selectedRect.top > hoveredRect.bottom) {
    // Hovered is above
    distances.push({
      from: { x: selectedRect.left + selectedRect.width / 2, y: hoveredRect.bottom },
      to: { x: selectedRect.left + selectedRect.width / 2, y: selectedRect.top },
      distance: selectedRect.top - hoveredRect.bottom,
      direction: 'vertical',
    });
  }

  // Edge alignment distances
  const alignments = calculateEdgeAlignments(selectedRect, hoveredRect);
  distances.push(...alignments);

  return distances;
}

// Calculate edge alignment distances
function calculateEdgeAlignments(
  selectedRect: DOMRect,
  hoveredRect: DOMRect
): MeasureDistance[] {
  const alignments: MeasureDistance[] = [];
  const threshold = 100; // Only show alignments within 100px

  // Left edge alignment
  const leftDiff = Math.abs(selectedRect.left - hoveredRect.left);
  if (leftDiff > 0 && leftDiff < threshold) {
    alignments.push({
      from: { x: selectedRect.left, y: Math.min(selectedRect.top, hoveredRect.top) },
      to: { x: hoveredRect.left, y: Math.min(selectedRect.top, hoveredRect.top) },
      distance: leftDiff,
      direction: 'horizontal',
    });
  }

  // Right edge alignment
  const rightDiff = Math.abs(selectedRect.right - hoveredRect.right);
  if (rightDiff > 0 && rightDiff < threshold) {
    alignments.push({
      from: { x: selectedRect.right, y: Math.min(selectedRect.top, hoveredRect.top) },
      to: { x: hoveredRect.right, y: Math.min(selectedRect.top, hoveredRect.top) },
      distance: rightDiff,
      direction: 'horizontal',
    });
  }

  // Top edge alignment
  const topDiff = Math.abs(selectedRect.top - hoveredRect.top);
  if (topDiff > 0 && topDiff < threshold) {
    alignments.push({
      from: { x: Math.min(selectedRect.left, hoveredRect.left), y: selectedRect.top },
      to: { x: Math.min(selectedRect.left, hoveredRect.left), y: hoveredRect.top },
      distance: topDiff,
      direction: 'vertical',
    });
  }

  // Bottom edge alignment
  const bottomDiff = Math.abs(selectedRect.bottom - hoveredRect.bottom);
  if (bottomDiff > 0 && bottomDiff < threshold) {
    alignments.push({
      from: { x: Math.min(selectedRect.left, hoveredRect.left), y: selectedRect.bottom },
      to: { x: Math.min(selectedRect.left, hoveredRect.left), y: hoveredRect.bottom },
      distance: bottomDiff,
      direction: 'vertical',
    });
  }

  return alignments;
}

// Check if two rects overlap
function rectsOverlap(a: DOMRect, b: DOMRect): boolean {
  return !(
    a.right < b.left ||
    a.left > b.right ||
    a.bottom < b.top ||
    a.top > b.bottom
  );
}

// Calculate distances to viewport edges
export function calculateViewportDistances(rect: DOMRect): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} {
  return {
    top: rect.top,
    right: window.innerWidth - rect.right,
    bottom: window.innerHeight - rect.bottom,
    left: rect.left,
  };
}

// Calculate center-to-center distance
export function calculateCenterDistance(a: DOMRect, b: DOMRect): number {
  const aCenter = { x: a.left + a.width / 2, y: a.top + a.height / 2 };
  const bCenter = { x: b.left + b.width / 2, y: b.top + b.height / 2 };

  return Math.sqrt(
    Math.pow(bCenter.x - aCenter.x, 2) + Math.pow(bCenter.y - aCenter.y, 2)
  );
}
