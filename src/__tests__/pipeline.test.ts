import { describe, it, expect } from 'vitest';
import { sanitizeSession, inferBasePath } from '../sanitization/pipeline.js';
import type {
  SessionMessage,
  AssistantMessage,
  UserMessage,
  FileHistorySnapshot,
} from '../session/types.js';

describe('sanitizeSession', () => {
  const basePath = '/Users/testuser/project';

  it('should sanitize full session with all message types', () => {
    const messages: SessionMessage[] = [
      {
        type: 'user',
        uuid: 'msg-1',
        sessionId: 'session-1',
        timestamp: '2026-01-11T12:00:00Z',
        parentUuid: null,
        message: { role: 'user', content: 'Hello' },
        cwd: '/Users/testuser/project/src',
        version: '1.0',
      },
      {
        type: 'assistant',
        uuid: 'msg-2',
        sessionId: 'session-1',
        timestamp: '2026-01-11T12:00:01Z',
        parentUuid: 'msg-1',
        messageId: 'msg-2',
        snapshot: {
          thinking: 'Internal reasoning',
          messages: [
            {
              role: 'assistant',
              content: 'File at /Users/testuser/project/src/index.ts with api_key="secret123456"',
            },
          ],
        },
      },
      {
        type: 'file-history-snapshot',
        uuid: 'msg-3',
        sessionId: 'session-1',
        timestamp: '2026-01-11T12:00:02Z',
        parentUuid: 'msg-2',
        isSnapshotUpdate: false,
        snapshot: {
          files: [{ path: '/Users/testuser/project/src/utils.ts' }],
        },
      },
    ];

    const sanitized = sanitizeSession(messages, basePath);

    // Verify thinking stripped
    expect((sanitized[1] as AssistantMessage).snapshot.thinking).toBeNull();

    // Verify cwd sanitized
    expect((sanitized[0] as UserMessage).cwd).toBe('src');

    // Verify file paths sanitized
    expect((sanitized[2] as FileHistorySnapshot).snapshot.files[0].path).toBe('src/utils.ts');

    // Verify secret redacted
    expect((sanitized[1] as AssistantMessage).snapshot.messages[0].content).toContain(
      '[REDACTED]'
    );
    expect((sanitized[1] as AssistantMessage).snapshot.messages[0].content).not.toContain(
      'secret123456'
    );

    // Verify path in content sanitized
    expect((sanitized[1] as AssistantMessage).snapshot.messages[0].content).toContain(
      'src/index.ts'
    );
    expect((sanitized[1] as AssistantMessage).snapshot.messages[0].content).not.toContain(
      '/Users/testuser/project/src/index.ts'
    );
  });

  it('should handle empty session', () => {
    const messages: SessionMessage[] = [];
    const sanitized = sanitizeSession(messages, basePath);
    expect(sanitized).toEqual([]);
  });

  it('should handle session with only user messages', () => {
    const messages: SessionMessage[] = [
      {
        type: 'user',
        uuid: 'msg-1',
        sessionId: 'session-1',
        timestamp: '2026-01-11T12:00:00Z',
        parentUuid: null,
        message: { role: 'user', content: 'Hello' },
        cwd: '/Users/testuser/project',
        version: '1.0',
      },
      {
        type: 'user',
        uuid: 'msg-2',
        sessionId: 'session-1',
        timestamp: '2026-01-11T12:00:01Z',
        parentUuid: 'msg-1',
        message: { role: 'user', content: 'Another message' },
        cwd: '/Users/testuser/project/src',
        version: '1.0',
      },
    ];

    const sanitized = sanitizeSession(messages, basePath);

    expect((sanitized[0] as UserMessage).cwd).toBe('.');
    expect((sanitized[1] as UserMessage).cwd).toBe('src');
  });

  it('should handle session with only assistant messages', () => {
    const messages: SessionMessage[] = [
      {
        type: 'assistant',
        uuid: 'msg-1',
        sessionId: 'session-1',
        timestamp: '2026-01-11T12:00:00Z',
        parentUuid: null,
        messageId: 'msg-1',
        snapshot: {
          thinking: 'Thinking 1',
          messages: [{ role: 'assistant', content: 'Response 1' }],
        },
      },
      {
        type: 'assistant',
        uuid: 'msg-2',
        sessionId: 'session-1',
        timestamp: '2026-01-11T12:00:01Z',
        parentUuid: 'msg-1',
        messageId: 'msg-2',
        snapshot: {
          thinking: 'Thinking 2',
          messages: [{ role: 'assistant', content: 'Response 2' }],
        },
      },
    ];

    const sanitized = sanitizeSession(messages, basePath);

    expect((sanitized[0] as AssistantMessage).snapshot.thinking).toBeNull();
    expect((sanitized[1] as AssistantMessage).snapshot.thinking).toBeNull();
  });

  it('should preserve message order', () => {
    const messages: SessionMessage[] = [
      {
        type: 'user',
        uuid: 'msg-1',
        sessionId: 'session-1',
        timestamp: '2026-01-11T12:00:00Z',
        parentUuid: null,
        message: { role: 'user', content: 'First' },
        cwd: '/Users/testuser/project',
        version: '1.0',
      },
      {
        type: 'assistant',
        uuid: 'msg-2',
        sessionId: 'session-1',
        timestamp: '2026-01-11T12:00:01Z',
        parentUuid: 'msg-1',
        messageId: 'msg-2',
        snapshot: { thinking: null, messages: [{ role: 'assistant', content: 'Second' }] },
      },
      {
        type: 'user',
        uuid: 'msg-3',
        sessionId: 'session-1',
        timestamp: '2026-01-11T12:00:02Z',
        parentUuid: 'msg-2',
        message: { role: 'user', content: 'Third' },
        cwd: '/Users/testuser/project',
        version: '1.0',
      },
    ];

    const sanitized = sanitizeSession(messages, basePath);

    expect(sanitized[0].type).toBe('user');
    expect(sanitized[1].type).toBe('assistant');
    expect(sanitized[2].type).toBe('user');
    expect((sanitized[0] as UserMessage).message.content).toBe('First');
    expect((sanitized[1] as AssistantMessage).snapshot.messages[0].content).toBe('Second');
    expect((sanitized[2] as UserMessage).message.content).toBe('Third');
  });

  it('should be immutable (preserve original messages)', () => {
    const messages: SessionMessage[] = [
      {
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
      },
    ];

    const sanitized = sanitizeSession(messages, basePath);

    // Original unchanged
    expect((messages[0] as AssistantMessage).snapshot.thinking).toBe('Original thinking');
    expect((messages[0] as AssistantMessage).snapshot.messages[0].content).toBe('Original content');

    // Sanitized changed
    expect((sanitized[0] as AssistantMessage).snapshot.thinking).toBeNull();
  });

  it('should handle realistic session snippet', () => {
    // Fixture: Small realistic session with thinking, paths, and secrets
    const messages: SessionMessage[] = [
      {
        type: 'user',
        uuid: 'user-1',
        sessionId: 'session-abc',
        timestamp: '2026-01-11T14:30:00Z',
        parentUuid: null,
        message: { role: 'user', content: 'Create an API endpoint' },
        cwd: '/Users/testuser/project',
        version: '1.0',
      },
      {
        type: 'assistant',
        uuid: 'asst-1',
        sessionId: 'session-abc',
        timestamp: '2026-01-11T14:30:05Z',
        parentUuid: 'user-1',
        messageId: 'asst-1',
        snapshot: {
          thinking:
            'User wants an API endpoint. I should create a REST endpoint with proper validation.',
          messages: [
            {
              role: 'assistant',
              content: 'I will create the endpoint at /Users/testuser/project/src/api/users.ts',
            },
            {
              role: 'tool',
              content: JSON.stringify({
                file_path: '/Users/testuser/project/src/api/users.ts',
                api_key: 'sk-1234567890abcdef',
                status: 'created',
              }),
            },
          ],
        },
      },
      {
        type: 'file-history-snapshot',
        uuid: 'snapshot-1',
        sessionId: 'session-abc',
        timestamp: '2026-01-11T14:30:06Z',
        parentUuid: 'asst-1',
        isSnapshotUpdate: true,
        snapshot: {
          files: [
            { path: '/Users/testuser/project/src/api/users.ts' },
            { path: '/Users/testuser/project/src/types.ts' },
          ],
        },
      },
    ];

    const sanitized = sanitizeSession(messages, basePath);

    // User message: cwd sanitized
    expect((sanitized[0] as UserMessage).cwd).toBe('.');

    // Assistant message: thinking stripped, paths sanitized, secrets redacted
    const assistantMsg = sanitized[1] as AssistantMessage;
    expect(assistantMsg.snapshot.thinking).toBeNull();
    expect(assistantMsg.snapshot.messages[0].content).toContain('src/api/users.ts');
    expect(assistantMsg.snapshot.messages[0].content).not.toContain(
      '/Users/testuser/project/src'
    );
    expect(assistantMsg.snapshot.messages[1].content).toContain('[REDACTED]');
    expect(assistantMsg.snapshot.messages[1].content).not.toContain('sk-1234567890abcdef');

    // File snapshot: paths sanitized
    const snapshotMsg = sanitized[2] as FileHistorySnapshot;
    expect(snapshotMsg.snapshot.files[0].path).toBe('src/api/users.ts');
    expect(snapshotMsg.snapshot.files[1].path).toBe('src/types.ts');
  });
});

describe('inferBasePath', () => {
  it('should extract base path from first user message', () => {
    const messages: SessionMessage[] = [
      {
        type: 'user',
        uuid: 'msg-1',
        sessionId: 'session-1',
        timestamp: '2026-01-11T12:00:00Z',
        parentUuid: null,
        message: { role: 'user', content: 'Hello' },
        cwd: '/Users/testuser/project',
        version: '1.0',
      },
    ];

    const basePath = inferBasePath(messages);
    expect(basePath).toBe('/Users/testuser/project');
  });

  it('should return empty string if no user messages', () => {
    const messages: SessionMessage[] = [
      {
        type: 'assistant',
        uuid: 'msg-1',
        sessionId: 'session-1',
        timestamp: '2026-01-11T12:00:00Z',
        parentUuid: null,
        messageId: 'msg-1',
        snapshot: { thinking: null, messages: [] },
      },
    ];

    const basePath = inferBasePath(messages);
    expect(basePath).toBe('');
  });

  it('should return empty string for empty session', () => {
    const messages: SessionMessage[] = [];
    const basePath = inferBasePath(messages);
    expect(basePath).toBe('');
  });

  it('should use first user message even if multiple exist', () => {
    const messages: SessionMessage[] = [
      {
        type: 'user',
        uuid: 'msg-1',
        sessionId: 'session-1',
        timestamp: '2026-01-11T12:00:00Z',
        parentUuid: null,
        message: { role: 'user', content: 'First' },
        cwd: '/Users/testuser/project',
        version: '1.0',
      },
      {
        type: 'user',
        uuid: 'msg-2',
        sessionId: 'session-1',
        timestamp: '2026-01-11T12:00:01Z',
        parentUuid: 'msg-1',
        message: { role: 'user', content: 'Second' },
        cwd: '/Users/testuser/different',
        version: '1.0',
      },
    ];

    const basePath = inferBasePath(messages);
    expect(basePath).toBe('/Users/testuser/project');
  });

  it('should skip non-user messages when finding cwd', () => {
    const messages: SessionMessage[] = [
      {
        type: 'assistant',
        uuid: 'msg-1',
        sessionId: 'session-1',
        timestamp: '2026-01-11T12:00:00Z',
        parentUuid: null,
        messageId: 'msg-1',
        snapshot: { thinking: null, messages: [] },
      },
      {
        type: 'user',
        uuid: 'msg-2',
        sessionId: 'session-1',
        timestamp: '2026-01-11T12:00:01Z',
        parentUuid: 'msg-1',
        message: { role: 'user', content: 'Hello' },
        cwd: '/Users/testuser/project',
        version: '1.0',
      },
    ];

    const basePath = inferBasePath(messages);
    expect(basePath).toBe('/Users/testuser/project');
  });
});
