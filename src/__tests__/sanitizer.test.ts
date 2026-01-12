import { describe, it, expect } from 'vitest';
import {
  sanitizeAssistantMessage,
  sanitizeUserMessage,
  sanitizeFileHistorySnapshot,
} from '../sanitization/sanitizer.js';
import type { AssistantMessage, UserMessage, FileHistorySnapshot } from '../session/types.js';

describe('sanitizeAssistantMessage', () => {
  const basePath = '/Users/testuser/project';

  it('should strip thinking block', () => {
    const msg: AssistantMessage = {
      type: 'assistant',
      uuid: 'msg-1',
      sessionId: 'session-1',
      timestamp: '2026-01-11T12:00:00Z',
      parentUuid: null,
      messageId: 'msg-1',
      snapshot: {
        thinking: 'This is internal reasoning that should be removed',
        messages: [{ role: 'assistant', content: 'Hello' }],
      },
    };

    const sanitized = sanitizeAssistantMessage(msg, basePath);

    expect(sanitized.snapshot.thinking).toBeNull();
  });

  it('should handle null thinking gracefully', () => {
    const msg: AssistantMessage = {
      type: 'assistant',
      uuid: 'msg-1',
      sessionId: 'session-1',
      timestamp: '2026-01-11T12:00:00Z',
      parentUuid: null,
      messageId: 'msg-1',
      snapshot: {
        thinking: null,
        messages: [{ role: 'assistant', content: 'Hello' }],
      },
    };

    const sanitized = sanitizeAssistantMessage(msg, basePath);

    expect(sanitized.snapshot.thinking).toBeNull();
  });

  it('should handle empty thinking string', () => {
    const msg: AssistantMessage = {
      type: 'assistant',
      uuid: 'msg-1',
      sessionId: 'session-1',
      timestamp: '2026-01-11T12:00:00Z',
      parentUuid: null,
      messageId: 'msg-1',
      snapshot: {
        thinking: '',
        messages: [{ role: 'assistant', content: 'Hello' }],
      },
    };

    const sanitized = sanitizeAssistantMessage(msg, basePath);

    expect(sanitized.snapshot.thinking).toBeNull();
  });

  it('should sanitize absolute paths in tool results', () => {
    const msg: AssistantMessage = {
      type: 'assistant',
      uuid: 'msg-1',
      sessionId: 'session-1',
      timestamp: '2026-01-11T12:00:00Z',
      parentUuid: null,
      messageId: 'msg-1',
      snapshot: {
        thinking: null,
        messages: [
          {
            role: 'assistant',
            content: 'File at /Users/testuser/project/src/index.ts',
          },
        ],
      },
    };

    const sanitized = sanitizeAssistantMessage(msg, basePath);

    expect(sanitized.snapshot.messages[0].content).toContain('src/index.ts');
    expect(sanitized.snapshot.messages[0].content).not.toContain('/Users/testuser/project/src');
  });

  it('should leave external paths unchanged', () => {
    const msg: AssistantMessage = {
      type: 'assistant',
      uuid: 'msg-1',
      sessionId: 'session-1',
      timestamp: '2026-01-11T12:00:00Z',
      parentUuid: null,
      messageId: 'msg-1',
      snapshot: {
        thinking: null,
        messages: [
          {
            role: 'assistant',
            content: 'External file at /opt/external/file.txt',
          },
        ],
      },
    };

    const sanitized = sanitizeAssistantMessage(msg, basePath);

    expect(sanitized.snapshot.messages[0].content).toBe('External file at /opt/external/file.txt');
  });

  it('should handle multiple paths in same content', () => {
    const msg: AssistantMessage = {
      type: 'assistant',
      uuid: 'msg-1',
      sessionId: 'session-1',
      timestamp: '2026-01-11T12:00:00Z',
      parentUuid: null,
      messageId: 'msg-1',
      snapshot: {
        thinking: null,
        messages: [
          {
            role: 'assistant',
            content:
              'Files: /Users/testuser/project/src/a.ts and /Users/testuser/project/src/b.ts',
          },
        ],
      },
    };

    const sanitized = sanitizeAssistantMessage(msg, basePath);

    expect(sanitized.snapshot.messages[0].content).toContain('src/a.ts');
    expect(sanitized.snapshot.messages[0].content).toContain('src/b.ts');
    expect(sanitized.snapshot.messages[0].content).not.toContain('/Users/testuser/project');
  });

  it('should preserve original message (immutable)', () => {
    const msg: AssistantMessage = {
      type: 'assistant',
      uuid: 'msg-1',
      sessionId: 'session-1',
      timestamp: '2026-01-11T12:00:00Z',
      parentUuid: null,
      messageId: 'msg-1',
      snapshot: {
        thinking: 'Original thinking',
        messages: [{ role: 'assistant', content: 'Original content' }],
      },
    };

    const sanitized = sanitizeAssistantMessage(msg, basePath);

    expect(msg.snapshot.thinking).toBe('Original thinking');
    expect(msg.snapshot.messages[0].content).toBe('Original content');
    expect(sanitized.snapshot.thinking).toBeNull();
  });

  it('should handle empty messages array', () => {
    const msg: AssistantMessage = {
      type: 'assistant',
      uuid: 'msg-1',
      sessionId: 'session-1',
      timestamp: '2026-01-11T12:00:00Z',
      parentUuid: null,
      messageId: 'msg-1',
      snapshot: {
        thinking: 'Thinking',
        messages: [],
      },
    };

    const sanitized = sanitizeAssistantMessage(msg, basePath);

    expect(sanitized.snapshot.messages).toEqual([]);
    expect(sanitized.snapshot.thinking).toBeNull();
  });

  it('should handle paths in JSON tool results', () => {
    const msg: AssistantMessage = {
      type: 'assistant',
      uuid: 'msg-1',
      sessionId: 'session-1',
      timestamp: '2026-01-11T12:00:00Z',
      parentUuid: null,
      messageId: 'msg-1',
      snapshot: {
        thinking: null,
        messages: [
          {
            role: 'tool',
            content: JSON.stringify({
              file_path: '/Users/testuser/project/src/index.ts',
              status: 'success',
            }),
          },
        ],
      },
    };

    const sanitized = sanitizeAssistantMessage(msg, basePath);

    expect(sanitized.snapshot.messages[0].content).toContain('src/index.ts');
    expect(sanitized.snapshot.messages[0].content).not.toContain('/Users/testuser/project/src');
  });
});

describe('sanitizeUserMessage', () => {
  const basePath = '/Users/testuser/project';

  it('should sanitize absolute cwd to relative', () => {
    const msg: UserMessage = {
      type: 'user',
      uuid: 'msg-1',
      sessionId: 'session-1',
      timestamp: '2026-01-11T12:00:00Z',
      parentUuid: null,
      message: { role: 'user', content: 'Hello' },
      cwd: '/Users/testuser/project/src',
      version: '1.0',
    };

    const sanitized = sanitizeUserMessage(msg, basePath);

    expect(sanitized.cwd).toBe('src');
  });

  it('should handle cwd equal to basePath', () => {
    const msg: UserMessage = {
      type: 'user',
      uuid: 'msg-1',
      sessionId: 'session-1',
      timestamp: '2026-01-11T12:00:00Z',
      parentUuid: null,
      message: { role: 'user', content: 'Hello' },
      cwd: '/Users/testuser/project',
      version: '1.0',
    };

    const sanitized = sanitizeUserMessage(msg, basePath);

    expect(sanitized.cwd).toBe('.');
  });

  it('should leave external cwd unchanged', () => {
    const msg: UserMessage = {
      type: 'user',
      uuid: 'msg-1',
      sessionId: 'session-1',
      timestamp: '2026-01-11T12:00:00Z',
      parentUuid: null,
      message: { role: 'user', content: 'Hello' },
      cwd: '/opt/external',
      version: '1.0',
    };

    const sanitized = sanitizeUserMessage(msg, basePath);

    expect(sanitized.cwd).toBe('/opt/external');
  });

  it('should preserve original message (immutable)', () => {
    const msg: UserMessage = {
      type: 'user',
      uuid: 'msg-1',
      sessionId: 'session-1',
      timestamp: '2026-01-11T12:00:00Z',
      parentUuid: null,
      message: { role: 'user', content: 'Hello' },
      cwd: '/Users/testuser/project/src',
      version: '1.0',
    };

    const sanitized = sanitizeUserMessage(msg, basePath);

    expect(msg.cwd).toBe('/Users/testuser/project/src');
    expect(sanitized.cwd).toBe('src');
  });

  it('should handle empty basePath', () => {
    const msg: UserMessage = {
      type: 'user',
      uuid: 'msg-1',
      sessionId: 'session-1',
      timestamp: '2026-01-11T12:00:00Z',
      parentUuid: null,
      message: { role: 'user', content: 'Hello' },
      cwd: '/Users/testuser/project',
      version: '1.0',
    };

    const sanitized = sanitizeUserMessage(msg, '');

    expect(sanitized.cwd).toBe('/Users/testuser/project');
  });
});

describe('sanitizeFileHistorySnapshot', () => {
  const basePath = '/Users/testuser/project';

  it('should sanitize all file paths', () => {
    const msg: FileHistorySnapshot = {
      type: 'file-history-snapshot',
      uuid: 'msg-1',
      sessionId: 'session-1',
      timestamp: '2026-01-11T12:00:00Z',
      parentUuid: null,
      isSnapshotUpdate: false,
      snapshot: {
        files: [
          { path: '/Users/testuser/project/src/index.ts' },
          { path: '/Users/testuser/project/src/utils.ts' },
        ],
      },
    };

    const sanitized = sanitizeFileHistorySnapshot(msg, basePath);

    expect(sanitized.snapshot.files[0].path).toBe('src/index.ts');
    expect(sanitized.snapshot.files[1].path).toBe('src/utils.ts');
  });

  it('should handle empty files array', () => {
    const msg: FileHistorySnapshot = {
      type: 'file-history-snapshot',
      uuid: 'msg-1',
      sessionId: 'session-1',
      timestamp: '2026-01-11T12:00:00Z',
      parentUuid: null,
      isSnapshotUpdate: false,
      snapshot: {
        files: [],
      },
    };

    const sanitized = sanitizeFileHistorySnapshot(msg, basePath);

    expect(sanitized.snapshot.files).toEqual([]);
  });

  it('should leave external paths unchanged', () => {
    const msg: FileHistorySnapshot = {
      type: 'file-history-snapshot',
      uuid: 'msg-1',
      sessionId: 'session-1',
      timestamp: '2026-01-11T12:00:00Z',
      parentUuid: null,
      isSnapshotUpdate: false,
      snapshot: {
        files: [
          { path: '/Users/testuser/project/src/index.ts' },
          { path: '/opt/external/lib.ts' },
        ],
      },
    };

    const sanitized = sanitizeFileHistorySnapshot(msg, basePath);

    expect(sanitized.snapshot.files[0].path).toBe('src/index.ts');
    expect(sanitized.snapshot.files[1].path).toBe('/opt/external/lib.ts');
  });

  it('should preserve original message (immutable)', () => {
    const msg: FileHistorySnapshot = {
      type: 'file-history-snapshot',
      uuid: 'msg-1',
      sessionId: 'session-1',
      timestamp: '2026-01-11T12:00:00Z',
      parentUuid: null,
      isSnapshotUpdate: false,
      snapshot: {
        files: [{ path: '/Users/testuser/project/src/index.ts' }],
      },
    };

    const sanitized = sanitizeFileHistorySnapshot(msg, basePath);

    expect(msg.snapshot.files[0].path).toBe('/Users/testuser/project/src/index.ts');
    expect(sanitized.snapshot.files[0].path).toBe('src/index.ts');
  });

  it('should handle mix of relative and absolute paths', () => {
    const msg: FileHistorySnapshot = {
      type: 'file-history-snapshot',
      uuid: 'msg-1',
      sessionId: 'session-1',
      timestamp: '2026-01-11T12:00:00Z',
      parentUuid: null,
      isSnapshotUpdate: false,
      snapshot: {
        files: [
          { path: '/Users/testuser/project/src/index.ts' },
          { path: 'src/already-relative.ts' },
        ],
      },
    };

    const sanitized = sanitizeFileHistorySnapshot(msg, basePath);

    expect(sanitized.snapshot.files[0].path).toBe('src/index.ts');
    // Already relative path should remain unchanged
    expect(sanitized.snapshot.files[1].path).toBe('src/already-relative.ts');
  });
});
