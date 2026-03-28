import { promises as fs } from 'fs';
import { createHash } from 'crypto';
import path from 'path';
import { generateId } from '@/lib/utils';
import type { AuditEntry } from '@/lib/types/agent';

const AUDIT_DIR = path.join(process.cwd(), 'data', 'audit');

/**
 * Get the file path for today's audit log
 * @returns Absolute path to today's NDJSON audit file
 */
function getAuditFilePath(): string {
  const date = new Date().toISOString().split('T')[0];
  return path.join(AUDIT_DIR, `${date}.ndjson`);
}

/**
 * Ensure the audit directory exists
 * @returns Promise that resolves when directory is ready
 */
async function ensureDir(): Promise<void> {
  await fs.mkdir(AUDIT_DIR, { recursive: true });
}

/**
 * Read entries from a single audit file (NDJSON format)
 * @param filePath - Path to the NDJSON file
 * @returns Array of audit entries
 */
async function readEntriesFromFile(filePath: string): Promise<AuditEntry[]> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return content
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as AuditEntry);
  } catch {
    return [];
  }
}

/**
 * Log an agent action to the daily audit file (MAESTRO L5)
 * Uses atomic append to avoid race conditions under concurrency.
 * @param entry - Partial audit entry (id and timestamp are auto-generated)
 * @returns The complete audit entry with generated ID
 */
export async function logAuditEntry(
  entry: Omit<AuditEntry, 'id' | 'timestamp'>
): Promise<AuditEntry> {
  await ensureDir();

  const fullEntry: AuditEntry = {
    ...entry,
    id: generateId(),
    timestamp: Date.now(),
  };

  // Append a single NDJSON line — atomic, no read-modify-write race
  await fs.appendFile(getAuditFilePath(), JSON.stringify(fullEntry) + '\n');
  return fullEntry;
}

/**
 * Get recent audit entries (for the UI audit trail)
 * @param limit - Maximum number of entries to return
 * @returns Array of recent audit entries, newest first
 */
export async function getRecentAuditEntries(limit = 20): Promise<AuditEntry[]> {
  await ensureDir();

  try {
    const files = await fs.readdir(AUDIT_DIR);
    const auditFiles = files
      .filter((f) => f.endsWith('.ndjson'))
      .sort()
      .reverse();

    const entries: AuditEntry[] = [];

    for (const file of auditFiles) {
      if (entries.length >= limit) break;
      const fileEntries = await readEntriesFromFile(path.join(AUDIT_DIR, file));
      // Entries within a file are oldest-first, reverse to get newest-first
      entries.push(...fileEntries.reverse());
    }

    return entries.slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * Create a SHA-256 hash of input/output for audit trail integrity
 * @param data - String to hash
 * @returns Hex hash string (first 16 chars of SHA-256)
 */
export function hashForAudit(data: string): string {
  return createHash('sha256').update(data).digest('hex').slice(0, 16);
}
