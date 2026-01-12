/**
 * Tests for session reading pipeline
 *
 * Validates JSONL parsing, error recovery, and metadata extraction.
 */

import { describe, it, expect } from 'vitest';
import { parseSessionFile } from '../session/reader.js';
import { extractMetadata } from '../session/metadata.js';
import type { SessionMessage, UserMessage, AssistantMessage } from '../session/types.js';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('session-reader', () => {
  describe('parseSessionFile', () => {
    it('parses valid JSONL session file', async () => {
      // Create minimal test fixture with 3 lines
      const testData = [
        {
          uuid: 'msg-1',
          sessionId: 'session-123',
          timestamp: '2026-01-11T10:00:00.000Z',
          parentUuid: null,
          type: 'user',
          message: { role: 'user', content: 'Hello' },
          cwd: '/Users/test/project',
          version: '1.0.0',
        },
        {
          uuid: 'msg-2',
          sessionId: 'session-123',
          timestamp: '2026-01-11T10:01:00.000Z',
          parentUuid: 'msg-1',
          type: 'assistant',
          messageId: 'assist-1',
          snapshot: { thinking: null, messages: [] },
        },
        {
          uuid: 'msg-3',
          sessionId: 'session-123',
          timestamp: '2026-01-11T10:02:00.000Z',
          parentUuid: 'msg-2',
          type: 'file-history-snapshot',
          isSnapshotUpdate: true,
          snapshot: { files: [] },
        },
      ];

      // Write test JSONL file
      const tmpFile = join(tmpdir(), `test-session-${Date.now()}.jsonl`);
      const jsonlContent = testData.map(obj => JSON.stringify(obj)).join('\n');
      await writeFile(tmpFile, jsonlContent, 'utf-8');

      try {
        // Parse the file
        const messages = await parseSessionFile(tmpFile);

        // Verify all messages parsed
        expect(messages).toHaveLength(3);
        expect(messages[0].type).toBe('user');
        expect(messages[1].type).toBe('assistant');
        expect(messages[2].type).toBe('file-history-snapshot');
        expect(messages[0].uuid).toBe('msg-1');
        expect(messages[0].sessionId).toBe('session-123');
      } finally {
        // Cleanup
        await unlink(tmpFile);
      }
    });

    it('recovers from malformed JSON line and continues processing', async () => {
      // Create JSONL with one malformed line
      const lines = [
        JSON.stringify({
          uuid: 'msg-1',
          sessionId: 'session-123',
          timestamp: '2026-01-11T10:00:00.000Z',
          parentUuid: null,
          type: 'user',
          message: { role: 'user', content: 'First' },
          cwd: '/test',
          version: '1.0.0',
        }),
        '{ invalid json here }', // Malformed line
        JSON.stringify({
          uuid: 'msg-3',
          sessionId: 'session-123',
          timestamp: '2026-01-11T10:02:00.000Z',
          parentUuid: 'msg-1',
          type: 'user',
          message: { role: 'user', content: 'Third' },
          cwd: '/test',
          version: '1.0.0',
        }),
      ];

      const tmpFile = join(tmpdir(), `test-error-recovery-${Date.now()}.jsonl`);
      await writeFile(tmpFile, lines.join('\n'), 'utf-8');

      try {
        const messages = await parseSessionFile(tmpFile);

        // Should have 2 messages (malformed line skipped)
        expect(messages).toHaveLength(2);
        expect(messages[0].uuid).toBe('msg-1');
        expect(messages[1].uuid).toBe('msg-3');
      } finally {
        await unlink(tmpFile);
      }
    });

    it('skips empty lines without breaking parsing', async () => {
      const lines = [
        JSON.stringify({
          uuid: 'msg-1',
          sessionId: 'session-123',
          timestamp: '2026-01-11T10:00:00.000Z',
          parentUuid: null,
          type: 'user',
          message: { role: 'user', content: 'First' },
          cwd: '/test',
          version: '1.0.0',
        }),
        '', // Empty line
        '   ', // Whitespace-only line
        JSON.stringify({
          uuid: 'msg-2',
          sessionId: 'session-123',
          timestamp: '2026-01-11T10:01:00.000Z',
          parentUuid: 'msg-1',
          type: 'user',
          message: { role: 'user', content: 'Second' },
          cwd: '/test',
          version: '1.0.0',
        }),
      ];

      const tmpFile = join(tmpdir(), `test-empty-lines-${Date.now()}.jsonl`);
      await writeFile(tmpFile, lines.join('\n'), 'utf-8');

      try {
        const messages = await parseSessionFile(tmpFile);

        // Should have 2 messages (empty lines skipped)
        expect(messages).toHaveLength(2);
        expect(messages[0].uuid).toBe('msg-1');
        expect(messages[1].uuid).toBe('msg-2');
      } finally {
        await unlink(tmpFile);
      }
    });

    it('skips messages missing required fields', async () => {
      const lines = [
        JSON.stringify({
          uuid: 'msg-1',
          sessionId: 'session-123',
          timestamp: '2026-01-11T10:00:00.000Z',
          parentUuid: null,
          type: 'user',
          message: { role: 'user', content: 'Valid' },
          cwd: '/test',
          version: '1.0.0',
        }),
        JSON.stringify({
          // Missing uuid
          sessionId: 'session-123',
          timestamp: '2026-01-11T10:01:00.000Z',
          type: 'user',
        }),
        JSON.stringify({
          // Missing type
          uuid: 'msg-3',
          sessionId: 'session-123',
          timestamp: '2026-01-11T10:02:00.000Z',
        }),
        JSON.stringify({
          uuid: 'msg-4',
          sessionId: 'session-123',
          timestamp: '2026-01-11T10:03:00.000Z',
          parentUuid: 'msg-1',
          type: 'user',
          message: { role: 'user', content: 'Also valid' },
          cwd: '/test',
          version: '1.0.0',
        }),
      ];

      const tmpFile = join(tmpdir(), `test-missing-fields-${Date.now()}.jsonl`);
      await writeFile(tmpFile, lines.join('\n'), 'utf-8');

      try {
        const messages = await parseSessionFile(tmpFile);

        // Should have 2 valid messages (2 with missing fields skipped)
        expect(messages).toHaveLength(2);
        expect(messages[0].uuid).toBe('msg-1');
        expect(messages[1].uuid).toBe('msg-4');
      } finally {
        await unlink(tmpFile);
      }
    });
  });

  describe('extractMetadata', () => {
    it('extracts all fields correctly from valid messages', () => {
      const messages: SessionMessage[] = [
        {
          uuid: 'msg-1',
          sessionId: 'session-abc',
          timestamp: '2026-01-11T10:00:00.000Z',
          parentUuid: null,
          type: 'user',
          message: { role: 'user', content: 'Hello' },
          cwd: '/Users/test/project',
          version: '1.2.3',
        } as UserMessage,
        {
          uuid: 'msg-2',
          sessionId: 'session-abc',
          timestamp: '2026-01-11T10:05:00.000Z',
          parentUuid: 'msg-1',
          type: 'assistant',
          messageId: 'assist-1',
          snapshot: { thinking: null, messages: [] },
        } as AssistantMessage,
      ];

      const metadata = extractMetadata(messages);

      expect(metadata).not.toBeNull();
      expect(metadata?.sessionId).toBe('session-abc');
      expect(metadata?.projectPath).toBe('/Users/test/project');
      expect(metadata?.messageCount).toBe(2);
      expect(metadata?.firstTimestamp).toBe('2026-01-11T10:00:00.000Z');
      expect(metadata?.lastTimestamp).toBe('2026-01-11T10:05:00.000Z');
      expect(metadata?.hasAgentConversations).toBe(false);
      expect(metadata?.version).toBe('1.2.3');
    });

    it('detects agent conversations from isSidechain flag', () => {
      const messages: SessionMessage[] = [
        {
          uuid: 'msg-1',
          sessionId: 'session-abc',
          timestamp: '2026-01-11T10:00:00.000Z',
          parentUuid: null,
          type: 'user',
          message: { role: 'user', content: 'Hello' },
          cwd: '/test',
          version: '1.0.0',
        } as UserMessage,
        {
          uuid: 'msg-2',
          sessionId: 'session-abc',
          timestamp: '2026-01-11T10:01:00.000Z',
          parentUuid: 'msg-1',
          isSidechain: true, // Agent conversation marker
          type: 'assistant',
          messageId: 'assist-1',
          snapshot: { thinking: null, messages: [] },
        } as AssistantMessage,
      ];

      const metadata = extractMetadata(messages);

      expect(metadata?.hasAgentConversations).toBe(true);
    });

    it('returns null for empty message array', () => {
      const metadata = extractMetadata([]);
      expect(metadata).toBeNull();
    });

    it('handles missing cwd and version with fallback', () => {
      const messages: SessionMessage[] = [
        {
          uuid: 'msg-1',
          sessionId: 'session-abc',
          timestamp: '2026-01-11T10:00:00.000Z',
          parentUuid: null,
          type: 'assistant',
          messageId: 'assist-1',
          snapshot: { thinking: null, messages: [] },
        } as AssistantMessage,
      ];

      const metadata = extractMetadata(messages);

      expect(metadata).not.toBeNull();
      expect(metadata?.projectPath).toBe('unknown');
      expect(metadata?.version).toBe('unknown');
    });

    it('finds user message even if not first message', () => {
      const messages: SessionMessage[] = [
        {
          uuid: 'msg-1',
          sessionId: 'session-abc',
          timestamp: '2026-01-11T10:00:00.000Z',
          parentUuid: null,
          type: 'assistant',
          messageId: 'assist-1',
          snapshot: { thinking: null, messages: [] },
        } as AssistantMessage,
        {
          uuid: 'msg-2',
          sessionId: 'session-abc',
          timestamp: '2026-01-11T10:01:00.000Z',
          parentUuid: 'msg-1',
          type: 'user',
          message: { role: 'user', content: 'Hello' },
          cwd: '/found/this/path',
          version: '2.0.0',
        } as UserMessage,
      ];

      const metadata = extractMetadata(messages);

      expect(metadata?.projectPath).toBe('/found/this/path');
      expect(metadata?.version).toBe('2.0.0');
    });
  });
});
