import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

// Types
interface VisualChange {
  id: string;
  element: {
    selector: string;
    tag: string;
    id: string | null;
    classes: string[];
    computedStyles: Record<string, string>;
    sourceHint: string | null;
    smartSummary: string | null;
    screenshot: string | null;
  };
  feedback: string;
  visualAdjustments: Record<string, string>;
  cssFramework: string;
  originalUnits: Record<string, string>;
  timestamp: string;
  status: 'draft' | 'staged' | 'confirmed' | 'applied' | 'failed';
  failureReason?: string;
  retryCount?: number;
}

// File-based change queue for cross-process sharing
const QUEUE_DIR = join(homedir(), '.visual-feedback');
const QUEUE_FILE = join(QUEUE_DIR, 'change-queue.json');

export class ChangeQueue {
  constructor() {
    // Ensure directory exists
    if (!existsSync(QUEUE_DIR)) {
      mkdirSync(QUEUE_DIR, { recursive: true });
    }
  }

  // Read changes from file
  private readChanges(): Map<string, VisualChange> {
    try {
      if (existsSync(QUEUE_FILE)) {
        const data = readFileSync(QUEUE_FILE, 'utf-8');
        const parsed = JSON.parse(data);
        return new Map(Object.entries(parsed));
      }
    } catch (error) {
      console.error('Failed to read change queue:', error);
    }
    return new Map();
  }

  // Write changes to file
  private writeChanges(changes: Map<string, VisualChange>): void {
    try {
      const obj = Object.fromEntries(changes);
      writeFileSync(QUEUE_FILE, JSON.stringify(obj, null, 2));
    } catch (error) {
      console.error('Failed to write change queue:', error);
    }
  }

  // Add a new change
  add(change: VisualChange): void {
    const changes = this.readChanges();
    changes.set(change.id, {
      ...change,
      retryCount: 0,
    });
    this.writeChanges(changes);
  }

  // Get a specific change
  get(id: string): VisualChange | undefined {
    const changes = this.readChanges();
    return changes.get(id);
  }

  // Get pending changes (optionally include applied)
  getPending(includeApplied: boolean = false): VisualChange[] {
    const changes = this.readChanges();
    return Array.from(changes.values()).filter((change) => {
      if (includeApplied) {
        return true;
      }
      return change.status === 'confirmed' || change.status === 'failed';
    });
  }

  // Mark a change as applied
  markApplied(id: string): boolean {
    const changes = this.readChanges();
    const change = changes.get(id);
    if (change) {
      change.status = 'applied';
      this.writeChanges(changes);
      return true;
    }
    return false;
  }

  // Mark a change as failed
  markFailed(id: string, reason?: string): boolean {
    const changes = this.readChanges();
    const change = changes.get(id);
    if (change) {
      change.status = 'failed';
      change.failureReason = reason;
      change.retryCount = (change.retryCount || 0) + 1;
      this.writeChanges(changes);
      return true;
    }
    return false;
  }

  // Remove a change
  remove(id: string): boolean {
    const changes = this.readChanges();
    const result = changes.delete(id);
    if (result) {
      this.writeChanges(changes);
    }
    return result;
  }

  // Clear all changes
  clear(): void {
    this.writeChanges(new Map());
  }

  // Get count by status
  getStatusCounts(): Record<string, number> {
    const changes = this.readChanges();
    const counts: Record<string, number> = {
      draft: 0,
      staged: 0,
      confirmed: 0,
      applied: 0,
      failed: 0,
    };

    for (const change of changes.values()) {
      counts[change.status]++;
    }

    return counts;
  }

  // Get changes that should be retried
  getRetryable(maxRetries: number = 3): VisualChange[] {
    const changes = this.readChanges();
    return Array.from(changes.values()).filter((change) => {
      return change.status === 'failed' && (change.retryCount || 0) < maxRetries;
    });
  }
}
