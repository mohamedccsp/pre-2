import { describe, it, expect, beforeEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { logAuditEntry, getRecentAuditEntries, hashForAudit } from '@/lib/maestro/audit-logger';

const AUDIT_DIR = path.join(process.cwd(), 'data', 'audit');

describe('Audit Logger (MAESTRO L5)', () => {
  beforeEach(async () => {
    // Clean up test audit files
    try {
      const files = await fs.readdir(AUDIT_DIR);
      for (const file of files) {
        if (file.endsWith('.ndjson')) {
          await fs.unlink(path.join(AUDIT_DIR, file));
        }
      }
    } catch {
      // Directory may not exist yet
    }
  });

  describe('logAuditEntry', () => {
    it('should create an audit entry with generated ID and timestamp', async () => {
      const entry = await logAuditEntry({
        agentName: 'researcher',
        action: 'execute',
        inputHash: 'abc123',
        outputHash: 'def456',
        durationMs: 100,
        success: true,
      });

      expect(entry.id).toBeDefined();
      expect(entry.timestamp).toBeGreaterThan(0);
      expect(entry.agentName).toBe('researcher');
      expect(entry.success).toBe(true);
    });

    it('should persist entries as NDJSON', async () => {
      await logAuditEntry({
        agentName: 'researcher',
        action: 'execute',
        inputHash: 'abc',
        outputHash: 'def',
        durationMs: 50,
        success: true,
      });

      const date = new Date().toISOString().split('T')[0];
      const filePath = path.join(AUDIT_DIR, `${date}.ndjson`);
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.trim().split('\n');
      expect(lines).toHaveLength(1);
      const entry = JSON.parse(lines[0]);
      expect(entry.agentName).toBe('researcher');
    });

    it('should append to existing daily file', async () => {
      await logAuditEntry({
        agentName: 'researcher',
        action: 'execute',
        inputHash: 'a',
        outputHash: 'b',
        durationMs: 10,
        success: true,
      });
      await logAuditEntry({
        agentName: 'researcher',
        action: 'blocked_injection',
        inputHash: 'c',
        outputHash: '',
        durationMs: 0,
        success: false,
        error: 'Blocked',
      });

      const date = new Date().toISOString().split('T')[0];
      const filePath = path.join(AUDIT_DIR, `${date}.ndjson`);
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.trim().split('\n');
      expect(lines).toHaveLength(2);
    });
  });

  describe('getRecentAuditEntries', () => {
    it('should return empty array when no entries exist', async () => {
      const entries = await getRecentAuditEntries();
      expect(entries).toEqual([]);
    });

    it('should return entries sorted by timestamp descending', async () => {
      await logAuditEntry({
        agentName: 'researcher',
        action: 'first',
        inputHash: 'a',
        outputHash: 'b',
        durationMs: 10,
        success: true,
      });
      await logAuditEntry({
        agentName: 'researcher',
        action: 'second',
        inputHash: 'c',
        outputHash: 'd',
        durationMs: 20,
        success: true,
      });

      const entries = await getRecentAuditEntries();
      expect(entries.length).toBe(2);
      expect(entries[0].action).toBe('second');
      expect(entries[1].action).toBe('first');
    });

    it('should respect limit parameter', async () => {
      for (let i = 0; i < 5; i++) {
        await logAuditEntry({
          agentName: 'researcher',
          action: `action-${i}`,
          inputHash: String(i),
          outputHash: String(i),
          durationMs: i,
          success: true,
        });
      }

      const entries = await getRecentAuditEntries(3);
      expect(entries).toHaveLength(3);
    });
  });

  describe('hashForAudit', () => {
    it('should produce consistent hashes', () => {
      const hash1 = hashForAudit('hello world');
      const hash2 = hashForAudit('hello world');
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different inputs', () => {
      const hash1 = hashForAudit('hello');
      const hash2 = hashForAudit('world');
      expect(hash1).not.toBe(hash2);
    });

    it('should return 16-char hex string (SHA-256 prefix)', () => {
      const hash = hashForAudit('test');
      expect(hash).toMatch(/^[0-9a-f]{16}$/);
    });
  });
});
