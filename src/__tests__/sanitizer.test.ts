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

    expect(sanitized.snapshot!.thinking).toBeNull();
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

    expect(sanitized.snapshot!.thinking).toBeNull();
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

    expect(sanitized.snapshot!.thinking).toBeNull();
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

    expect(sanitized.snapshot!.messages[0].content).toContain('src/index.ts');
    expect(sanitized.snapshot!.messages[0].content).not.toContain('/Users/testuser/project/src');
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

    expect(sanitized.snapshot!.messages[0].content).toBe('External file at /opt/external/file.txt');
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

    expect(sanitized.snapshot!.messages[0].content).toContain('src/a.ts');
    expect(sanitized.snapshot!.messages[0].content).toContain('src/b.ts');
    expect(sanitized.snapshot!.messages[0].content).not.toContain('/Users/testuser/project');
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

    expect(msg.snapshot!.thinking).toBe('Original thinking');
    expect(msg.snapshot!.messages[0].content).toBe('Original content');
    expect(sanitized.snapshot!.thinking).toBeNull();
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

    expect(sanitized.snapshot!.messages).toEqual([]);
    expect(sanitized.snapshot!.thinking).toBeNull();
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

    expect(sanitized.snapshot!.messages[0].content).toContain('src/index.ts');
    expect(sanitized.snapshot!.messages[0].content).not.toContain('/Users/testuser/project/src');
  });
});

// New format (v2.0.76+) tests
describe('sanitizeAssistantMessage - new format (v2.0.76+)', () => {
  const basePath = '/Users/testuser/project';

  it('should filter out thinking blocks', () => {
    const msg: AssistantMessage = {
      type: 'assistant',
      uuid: 'msg-1',
      sessionId: 'session-1',
      timestamp: '2026-01-11T12:00:00Z',
      parentUuid: null,
      messageId: 'msg-1',
      message: {
        model: 'claude-opus-4-5',
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [
          { type: 'thinking', text: 'This is internal reasoning that should be removed' },
          { type: 'text', text: 'Hello, user!' },
        ],
        stop_reason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 50 },
      },
    };

    const sanitized = sanitizeAssistantMessage(msg, basePath);

    expect(sanitized.message!.content).toHaveLength(1);
    expect(sanitized.message!.content[0].type).toBe('text');
    expect(sanitized.message!.content[0].text).toBe('Hello, user!');
  });

  it('should handle message with only thinking blocks (empty result)', () => {
    const msg: AssistantMessage = {
      type: 'assistant',
      uuid: 'msg-1',
      sessionId: 'session-1',
      timestamp: '2026-01-11T12:00:00Z',
      parentUuid: null,
      messageId: 'msg-1',
      message: {
        model: 'claude-opus-4-5',
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [
          { type: 'thinking', text: 'Only thinking here' },
          { type: 'thinking', text: 'More thinking' },
        ],
        stop_reason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 50 },
      },
    };

    const sanitized = sanitizeAssistantMessage(msg, basePath);

    expect(sanitized.message!.content).toHaveLength(0);
  });

  it('should handle message with no thinking blocks', () => {
    const msg: AssistantMessage = {
      type: 'assistant',
      uuid: 'msg-1',
      sessionId: 'session-1',
      timestamp: '2026-01-11T12:00:00Z',
      parentUuid: null,
      messageId: 'msg-1',
      message: {
        model: 'claude-opus-4-5',
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Just a simple message' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 50 },
      },
    };

    const sanitized = sanitizeAssistantMessage(msg, basePath);

    expect(sanitized.message!.content).toHaveLength(1);
    expect(sanitized.message!.content[0].text).toBe('Just a simple message');
  });

  it('should sanitize absolute paths in text blocks', () => {
    const msg: AssistantMessage = {
      type: 'assistant',
      uuid: 'msg-1',
      sessionId: 'session-1',
      timestamp: '2026-01-11T12:00:00Z',
      parentUuid: null,
      messageId: 'msg-1',
      message: {
        model: 'claude-opus-4-5',
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'File at /Users/testuser/project/src/index.ts was modified',
          },
        ],
        stop_reason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 50 },
      },
    };

    const sanitized = sanitizeAssistantMessage(msg, basePath);

    expect(sanitized.message!.content[0].text).toContain('src/index.ts');
    expect(sanitized.message!.content[0].text).not.toContain('/Users/testuser/project/src');
  });

  it('should redact secrets in text blocks', () => {
    const msg: AssistantMessage = {
      type: 'assistant',
      uuid: 'msg-1',
      sessionId: 'session-1',
      timestamp: '2026-01-11T12:00:00Z',
      parentUuid: null,
      messageId: 'msg-1',
      message: {
        model: 'claude-opus-4-5',
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'Config: api_key="sk_live_abcd1234efgh5678ijkl"',
          },
        ],
        stop_reason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 50 },
      },
    };

    const sanitized = sanitizeAssistantMessage(msg, basePath);

    expect(sanitized.message!.content[0].text).not.toContain('sk_live_abcd1234efgh5678ijkl');
    expect(sanitized.message!.content[0].text).toContain('[REDACTED');
  });

  it('should preserve tool_use blocks', () => {
    const msg: AssistantMessage = {
      type: 'assistant',
      uuid: 'msg-1',
      sessionId: 'session-1',
      timestamp: '2026-01-11T12:00:00Z',
      parentUuid: null,
      messageId: 'msg-1',
      message: {
        model: 'claude-opus-4-5',
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [
          { type: 'text', text: 'Let me read that file.' },
          {
            type: 'tool_use',
            id: 'tool_123',
            name: 'read_file',
            input: { path: '/Users/testuser/project/src/file.ts' },
          },
        ],
        stop_reason: 'tool_use',
        usage: { input_tokens: 100, output_tokens: 50 },
      },
    };

    const sanitized = sanitizeAssistantMessage(msg, basePath);

    expect(sanitized.message!.content).toHaveLength(2);
    expect(sanitized.message!.content[1].type).toBe('tool_use');
    expect((sanitized.message!.content[1] as any).id).toBe('tool_123');
    expect((sanitized.message!.content[1] as any).name).toBe('read_file');
  });

  it('should preserve tool_result blocks', () => {
    const msg: AssistantMessage = {
      type: 'assistant',
      uuid: 'msg-1',
      sessionId: 'session-1',
      timestamp: '2026-01-11T12:00:00Z',
      parentUuid: null,
      messageId: 'msg-1',
      message: {
        model: 'claude-opus-4-5',
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'tool_123',
            content: 'File contents here',
          },
        ],
        stop_reason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 50 },
      },
    };

    const sanitized = sanitizeAssistantMessage(msg, basePath);

    expect(sanitized.message!.content).toHaveLength(1);
    expect(sanitized.message!.content[0].type).toBe('tool_result');
    expect((sanitized.message!.content[0] as any).tool_use_id).toBe('tool_123');
  });

  it('should handle mixed content blocks', () => {
    const msg: AssistantMessage = {
      type: 'assistant',
      uuid: 'msg-1',
      sessionId: 'session-1',
      timestamp: '2026-01-11T12:00:00Z',
      parentUuid: null,
      messageId: 'msg-1',
      message: {
        model: 'claude-opus-4-5',
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [
          { type: 'thinking', text: 'Planning approach' },
          { type: 'text', text: 'First step' },
          { type: 'tool_use', id: 'tool_1', name: 'bash', input: {} },
          { type: 'thinking', text: 'More planning' },
          { type: 'text', text: 'Second step' },
        ],
        stop_reason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 50 },
      },
    };

    const sanitized = sanitizeAssistantMessage(msg, basePath);

    expect(sanitized.message!.content).toHaveLength(3);
    expect(sanitized.message!.content[0].type).toBe('text');
    expect(sanitized.message!.content[0].text).toBe('First step');
    expect(sanitized.message!.content[1].type).toBe('tool_use');
    expect(sanitized.message!.content[2].type).toBe('text');
    expect(sanitized.message!.content[2].text).toBe('Second step');
  });

  it('should handle multiple paths in same text block', () => {
    const msg: AssistantMessage = {
      type: 'assistant',
      uuid: 'msg-1',
      sessionId: 'session-1',
      timestamp: '2026-01-11T12:00:00Z',
      parentUuid: null,
      messageId: 'msg-1',
      message: {
        model: 'claude-opus-4-5',
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'Files: /Users/testuser/project/src/a.ts and /Users/testuser/project/src/b.ts',
          },
        ],
        stop_reason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 50 },
      },
    };

    const sanitized = sanitizeAssistantMessage(msg, basePath);

    expect(sanitized.message!.content[0].text).toContain('src/a.ts');
    expect(sanitized.message!.content[0].text).toContain('src/b.ts');
    expect(sanitized.message!.content[0].text).not.toContain('/Users/testuser/project');
  });

  it('should preserve original message (immutable)', () => {
    const msg: AssistantMessage = {
      type: 'assistant',
      uuid: 'msg-1',
      sessionId: 'session-1',
      timestamp: '2026-01-11T12:00:00Z',
      parentUuid: null,
      messageId: 'msg-1',
      message: {
        model: 'claude-opus-4-5',
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [
          { type: 'thinking', text: 'Original thinking' },
          { type: 'text', text: 'Original text' },
        ],
        stop_reason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 50 },
      },
    };

    const sanitized = sanitizeAssistantMessage(msg, basePath);

    // Original should be unchanged
    expect(msg.message!.content).toHaveLength(2);
    expect(msg.message!.content[0].type).toBe('thinking');
    expect(msg.message!.content[1].text).toBe('Original text');
    // Sanitized should have thinking removed
    expect(sanitized.message!.content).toHaveLength(1);
    expect(sanitized.message!.content[0].type).toBe('text');
  });

  it('should preserve all message fields (model, id, usage, etc.)', () => {
    const msg: AssistantMessage = {
      type: 'assistant',
      uuid: 'msg-1',
      sessionId: 'session-1',
      timestamp: '2026-01-11T12:00:00Z',
      parentUuid: null,
      messageId: 'msg-1',
      message: {
        model: 'claude-opus-4-5',
        id: 'msg_abc123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 150, output_tokens: 75 },
      },
    };

    const sanitized = sanitizeAssistantMessage(msg, basePath);

    expect(sanitized.message!.model).toBe('claude-opus-4-5');
    expect(sanitized.message!.id).toBe('msg_abc123');
    expect(sanitized.message!.type).toBe('message');
    expect(sanitized.message!.role).toBe('assistant');
    expect(sanitized.message!.stop_reason).toBe('end_turn');
    expect(sanitized.message!.usage.input_tokens).toBe(150);
    expect(sanitized.message!.usage.output_tokens).toBe(75);
  });
});

describe('sanitizeAssistantMessage - format detection', () => {
  const basePath = '/Users/testuser/project';

  it('should throw error if neither snapshot nor message is present', () => {
    const msg: AssistantMessage = {
      type: 'assistant',
      uuid: 'msg-1',
      sessionId: 'session-1',
      timestamp: '2026-01-11T12:00:00Z',
      parentUuid: null,
      messageId: 'msg-1',
      // Neither snapshot nor message
    } as AssistantMessage;

    expect(() => sanitizeAssistantMessage(msg, basePath)).toThrow(
      'AssistantMessage must have either snapshot or message field'
    );
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
