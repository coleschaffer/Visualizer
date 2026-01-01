// Core types for the Visual Feedback Tool

export interface ElementInfo {
  selector: string;
  tag: string;
  id: string | null;
  classes: string[];
  path: PathSegment[]; // Breadcrumb path
  rect: DOMRect;
  computedStyles: ComputedStyleInfo;
  sourceHint: string | null;
  smartSummary: string | null;
  screenshot: string | null; // base64
}

export interface PathSegment {
  tag: string;
  id: string | null;
  classes: string[];
  index: number; // nth-child index
  selector: string;
}

export interface ComputedStyleInfo {
  width: string;
  height: string;
  marginTop: string;
  marginRight: string;
  marginBottom: string;
  marginLeft: string;
  paddingTop: string;
  paddingRight: string;
  paddingBottom: string;
  paddingLeft: string;
  backgroundColor: string;
  color: string;
  fontSize: string;
  fontWeight: string;
  display: string;
  position: string;
  // Add more as needed
}

export interface VisualChange {
  id: string;
  element: ElementInfo;
  feedback: string;
  visualAdjustments: Partial<ComputedStyleInfo>;
  cssFramework: CSSFramework;
  originalUnits: Record<string, string>;
  timestamp: string;
  status: ChangeStatus;
}

export type CSSFramework =
  | 'tailwind'
  | 'css-modules'
  | 'styled-components'
  | 'emotion'
  | 'plain-css'
  | 'unknown';

export type ChangeStatus = 'draft' | 'staged' | 'confirmed' | 'applied' | 'failed';

export interface MeasureDistance {
  from: { x: number; y: number };
  to: { x: number; y: number };
  distance: number; // in pixels
  direction: 'horizontal' | 'vertical';
}

export interface PanelPosition {
  x: number;
  y: number;
  anchorSide: 'top' | 'bottom' | 'left' | 'right';
}

export interface AppState {
  isActive: boolean;
  selectedElement: ElementInfo | null;
  hoveredElement: ElementInfo | null;
  pendingChanges: VisualChange[];
  panelPosition: PanelPosition | null;
  measureDistances: MeasureDistance[];
  connectionStatus: ConnectionStatus;
  mcpToken: string | null;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// Messages between content script and background
export type ContentMessage =
  | { type: 'GET_STATE' }
  | { type: 'SET_ACTIVE'; active: boolean }
  | { type: 'CONFIRM_CHANGE'; change: VisualChange }
  | { type: 'UNDO_CHANGE'; changeId: string }
  | { type: 'CONNECT_MCP'; token: string }
  | { type: 'CHECK_CONNECTION' }
  | { type: 'CAPTURE_SCREENSHOT'; rect: { x: number; y: number; width: number; height: number } };

export type BackgroundMessage =
  | { type: 'STATE_UPDATE'; state: Partial<AppState> }
  | { type: 'CHANGE_CONFIRMED'; changeId: string }
  | { type: 'CHANGE_APPLIED'; changeId: string }
  | { type: 'CONNECTION_STATUS'; status: ConnectionStatus }
  | { type: 'ERROR'; message: string };

// MCP communication
export interface MCPRequest {
  type: 'get_visual_feedback' | 'mark_applied' | 'retry_failed';
  payload?: unknown;
}

export interface MCPResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}
