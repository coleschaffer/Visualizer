import type { ElementInfo, PathSegment, ComputedStyleInfo } from '../../shared/types';

// Get comprehensive info about an element
export function getElementInfo(element: HTMLElement): ElementInfo {
  const rect = element.getBoundingClientRect();
  const computedStyles = window.getComputedStyle(element);

  return {
    selector: generateUniqueSelector(element),
    tag: element.tagName.toLowerCase(),
    id: element.id || null,
    classes: Array.from(element.classList),
    path: getElementPath(element),
    rect,
    computedStyles: extractComputedStyles(computedStyles),
    sourceHint: detectSourceFile(element),
    smartSummary: generateSmartSummary(element, computedStyles),
    screenshot: null, // Captured separately
  };
}

// Generate unique CSS selector for element
export function generateUniqueSelector(element: HTMLElement): string {
  if (element.id) {
    return `#${element.id}`;
  }

  const path: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();

    if (current.id) {
      selector = `#${current.id}`;
      path.unshift(selector);
      break;
    }

    if (current.className && typeof current.className === 'string') {
      const classes = current.className.trim().split(/\s+/).filter(Boolean);
      if (classes.length > 0) {
        // Use first 2 classes for specificity
        selector += '.' + classes.slice(0, 2).join('.');
      }
    }

    // Add nth-child if needed for uniqueness
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (child) => child.tagName === current!.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-child(${index})`;
      }
    }

    path.unshift(selector);
    current = current.parentElement;
  }

  return path.join(' > ');
}

// Get element path for breadcrumb
export function getElementPath(element: HTMLElement): PathSegment[] {
  const path: PathSegment[] = [];
  let current: Element | null = element;
  let depth = 0;
  const maxDepth = 10; // Limit depth for performance

  while (current && current !== document.documentElement && depth < maxDepth) {
    const parentEl: Element | null = current.parentElement;
    let index = 0;

    if (parentEl) {
      const siblings = Array.from(parentEl.children);
      index = siblings.indexOf(current) + 1;
    }

    path.unshift({
      tag: current.tagName.toLowerCase(),
      id: current.id || null,
      classes: Array.from(current.classList).slice(0, 3), // Limit classes
      index,
      selector: generateUniqueSelector(current as HTMLElement),
    });

    current = parentEl;
    depth++;
  }

  return path;
}

// Extract computed styles we care about
function extractComputedStyles(styles: CSSStyleDeclaration): ComputedStyleInfo {
  return {
    width: styles.width,
    height: styles.height,
    marginTop: styles.marginTop,
    marginRight: styles.marginRight,
    marginBottom: styles.marginBottom,
    marginLeft: styles.marginLeft,
    paddingTop: styles.paddingTop,
    paddingRight: styles.paddingRight,
    paddingBottom: styles.paddingBottom,
    paddingLeft: styles.paddingLeft,
    backgroundColor: styles.backgroundColor,
    color: styles.color,
    fontSize: styles.fontSize,
    fontWeight: styles.fontWeight,
    display: styles.display,
    position: styles.position,
  };
}

// Detect source file from source maps or React/Vue devtools
function detectSourceFile(element: HTMLElement): string | null {
  // Try React DevTools fiber
  const fiberKey = Object.keys(element).find((key) =>
    key.startsWith('__reactFiber$') || key.startsWith('__reactInternalInstance$')
  );

  if (fiberKey) {
    const fiber = (element as any)[fiberKey];
    if (fiber?._debugSource) {
      return `${fiber._debugSource.fileName}:${fiber._debugSource.lineNumber}`;
    }
  }

  // Try Vue
  if ((element as any).__vue__) {
    const vm = (element as any).__vue__;
    if (vm.$options?.__file) {
      return vm.$options.__file;
    }
  }

  // Try data attributes
  if (element.dataset.sourceFile) {
    return element.dataset.sourceFile;
  }

  return null;
}

// Generate AI-friendly summary of the element
function generateSmartSummary(element: HTMLElement, styles: CSSStyleDeclaration): string {
  const tag = element.tagName.toLowerCase();
  const rect = element.getBoundingClientRect();
  const width = Math.round(rect.width);
  const height = Math.round(rect.height);

  const parts: string[] = [];

  // Element type
  if (tag === 'button' || element.getAttribute('role') === 'button') {
    parts.push('Button');
  } else if (tag === 'a') {
    parts.push('Link');
  } else if (tag === 'img') {
    parts.push('Image');
  } else if (tag === 'input') {
    const type = element.getAttribute('type') || 'text';
    parts.push(`${type} input`);
  } else if (tag === 'h1' || tag === 'h2' || tag === 'h3') {
    parts.push(`Heading (${tag.toUpperCase()})`);
  } else if (tag === 'p') {
    parts.push('Paragraph');
  } else if (tag === 'div' || tag === 'section') {
    parts.push('Container');
  } else {
    parts.push(tag);
  }

  // Size
  parts.push(`${width}×${height}px`);

  // Background color (if not transparent)
  const bg = styles.backgroundColor;
  if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
    parts.push(`bg: ${bg}`);
  }

  // Position if notable
  if (styles.position === 'fixed') {
    parts.push('fixed position');
  } else if (styles.position === 'absolute') {
    parts.push('absolute position');
  }

  // Check for common patterns
  const classes = Array.from(element.classList);
  if (classes.some((c) => c.includes('btn') || c.includes('button'))) {
    if (!parts[0].includes('Button')) parts.unshift('Button');
  }
  if (classes.some((c) => c.includes('card'))) {
    parts.push('card');
  }
  if (classes.some((c) => c.includes('modal') || c.includes('dialog'))) {
    parts.push('modal/dialog');
  }
  if (classes.some((c) => c.includes('nav'))) {
    parts.push('navigation');
  }

  return parts.join(', ');
}

// Set up MutationObserver to track element changes
export function createElementObserver(
  element: HTMLElement,
  onUpdate: (element: HTMLElement) => void
): MutationObserver {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList' || mutation.type === 'attributes') {
        // Check if our element still exists
        if (document.contains(element)) {
          onUpdate(element);
        }
      }
    }
  });

  observer.observe(element.parentElement || document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style', 'id'],
  });

  return observer;
}
