/**
 * Snapshot routes — capture and compare content versions for diff viewing.
 * Snapshots are stored as JSON files in .agent-quest/snapshots/.
 * Auto-captured when quests/tasks enter pending_approval status.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

export const snapshotRoutes = Router();

const SNAPSHOT_DIR = join(process.cwd(), '.agent-quest', 'snapshots');
const MAX_SNAPSHOTS_PER_ENTITY = 10;

// Ensure snapshot directory exists
if (!existsSync(SNAPSHOT_DIR)) {
  mkdirSync(SNAPSHOT_DIR, { recursive: true });
}

// ============================================================================
// Types
// ============================================================================

interface Snapshot {
  id: string;
  entityType: 'quest' | 'task';
  entityId: string;
  timestamp: string;
  content: Record<string, string>;
}

// ============================================================================
// Helpers
// ============================================================================

function getEntityDir(entityType: string, entityId: string): string {
  const dir = join(SNAPSHOT_DIR, entityType, entityId);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function listSnapshots(entityType: string, entityId: string): Snapshot[] {
  const dir = getEntityDir(entityType, entityId);
  const files = readdirSync(dir).filter(f => f.endsWith('.json')).sort();
  return files.map(f => {
    try {
      return JSON.parse(readFileSync(join(dir, f), 'utf-8')) as Snapshot;
    } catch {
      return null;
    }
  }).filter(Boolean) as Snapshot[];
}

function pruneSnapshots(entityType: string, entityId: string): void {
  const dir = getEntityDir(entityType, entityId);
  const files = readdirSync(dir).filter(f => f.endsWith('.json')).sort();
  while (files.length > MAX_SNAPSHOTS_PER_ENTITY) {
    const oldest = files.shift()!;
    try { require('fs').unlinkSync(join(dir, oldest)); } catch {}
  }
}

// ============================================================================
// Public API for other routes to call
// ============================================================================

export function captureSnapshot(entityType: 'quest' | 'task', entityId: string, content: Record<string, string>): string {
  const id = `snap_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const snapshot: Snapshot = {
    id,
    entityType,
    entityId,
    timestamp: new Date().toISOString(),
    content,
  };

  const dir = getEntityDir(entityType, entityId);
  const filename = `${snapshot.timestamp.replace(/[:.]/g, '-')}_${id}.json`;
  writeFileSync(join(dir, filename), JSON.stringify(snapshot, null, 2));

  pruneSnapshots(entityType, entityId);
  console.log(`[snapshots] Captured ${entityType}/${entityId} (${id})`);
  return id;
}

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /api/snapshots/:entityType/:entityId — List snapshots for an entity
 */
snapshotRoutes.get('/:entityType/:entityId', (req: Request, res: Response, next: NextFunction) => {
  try {
    const entityType = req.params.entityType as string;
    const entityId = req.params.entityId as string;
    const snapshots = listSnapshots(entityType, entityId);
    res.json({
      success: true,
      data: snapshots.map(s => ({ id: s.id, timestamp: s.timestamp, fields: Object.keys(s.content) })),
      count: snapshots.length,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/snapshots/:entityType/:entityId/diff — Get diff between two snapshots
 * Query: ?from=<index>&to=<index> (0-based, default: last two)
 * Or: ?field=<fieldName> to get diff for a specific field only
 */
snapshotRoutes.get('/:entityType/:entityId/diff', (req: Request, res: Response, next: NextFunction) => {
  try {
    const entityType = req.params.entityType as string;
    const entityId = req.params.entityId as string;
    const field = (Array.isArray(req.query.field) ? req.query.field[0] : req.query.field) as string | undefined;
    const snapshots = listSnapshots(entityType, entityId);

    if (snapshots.length < 2) {
      res.json({ success: true, data: null, message: 'Not enough snapshots for diff' });
      return;
    }

    const fromIdx = req.query.from !== undefined ? parseInt(String(req.query.from)) : snapshots.length - 2;
    const toIdx = req.query.to !== undefined ? parseInt(String(req.query.to)) : snapshots.length - 1;

    if (fromIdx < 0 || toIdx >= snapshots.length || fromIdx >= toIdx) {
      res.status(400).json({ success: false, error: 'Invalid snapshot indices' });
      return;
    }

    const oldSnap = snapshots[fromIdx];
    const newSnap = snapshots[toIdx];

    if (field) {
      res.json({
        success: true,
        data: {
          field,
          oldText: oldSnap.content[field] || '',
          newText: newSnap.content[field] || '',
          oldTimestamp: oldSnap.timestamp,
          newTimestamp: newSnap.timestamp,
        },
      });
    } else {
      // Return diffs for all fields
      const fields = [...new Set([...Object.keys(oldSnap.content), ...Object.keys(newSnap.content)])];
      const diffs = fields.map(f => ({
        field: f,
        oldText: oldSnap.content[f] || '',
        newText: newSnap.content[f] || '',
        changed: (oldSnap.content[f] || '') !== (newSnap.content[f] || ''),
      }));

      res.json({
        success: true,
        data: {
          diffs: diffs.filter(d => d.changed),
          oldTimestamp: oldSnap.timestamp,
          newTimestamp: newSnap.timestamp,
          totalFields: fields.length,
          changedFields: diffs.filter(d => d.changed).length,
        },
      });
    }
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/snapshots/:entityType/:entityId — Manually capture a snapshot
 * Body: { content: { field1: "text", field2: "text" } }
 */
snapshotRoutes.post('/:entityType/:entityId', (req: Request, res: Response, next: NextFunction) => {
  try {
    const entityType = req.params.entityType as string;
    const entityId = req.params.entityId as string;
    const { content } = req.body;

    if (!content || typeof content !== 'object') {
      res.status(400).json({ success: false, error: 'content object required' });
      return;
    }

    const id = captureSnapshot(entityType as 'quest' | 'task', entityId, content);
    res.json({ success: true, data: { id, entityType, entityId } });
  } catch (err) {
    next(err);
  }
});
