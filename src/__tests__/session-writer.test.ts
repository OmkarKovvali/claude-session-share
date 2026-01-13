/**
 * Tests for session writer with local JSONL storage
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { writeSessionToLocal, SessionWriteError } from '../session/writer.js';
import type { UserMessage, AssistantMessage } from '../session/types.js';
import { homedir } from 'os';
import { join } from 'path';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  mkdir: vi.fn(),
  writeFile: vi.fn(),
}));

// Mock crypto for predictable UUID generation
vi.mock('crypto', () => ({
  randomUUID: vi.fn(() => 'test-session-uuid-123'),
}));

describe('writeSessionToLocal', () => {
  let mockMkdir: any;
  let mockWriteFile: any;

  beforeEach(async () => {
    // Get mocked functions
    const fs = await import('fs/promises');
    mockMkdir = fs.mkdir as any;
    mockWriteFile = fs.writeFile as any;

    // Reset mocks
    vi.clearAllMocks();

    // Default successful behavior
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should write session messages to correct path', async () => {
    const messages: UserMessage[] = [
      {
        type: 'user',
        uuid: 'uuid-1',
        sessionId: 'session-123',
        timestamp: '2024-01-01T00:00:00Z',
        parentUuid: null,
        message: { role: 'user', content: 'Test message' },
        cwd: '/Users/name/project',
        version: '1.0.0',
      },
    ];

    const projectPath = '/Users/name/project';
    const result = await writeSessionToLocal(messages, projectPath);

    // Verify directory creation
    const expectedDir = join(homedir(), '.claude', 'projects', 'Users-name-project');
    expect(mockMkdir).toHaveBeenCalledWith(expectedDir, { recursive: true });

    // Verify file writing
    const expectedPath = join(expectedDir, 'test-session-uuid-123.jsonl');
    expect(mockWriteFile).toHaveBeenCalledWith(
      expectedPath,
      expect.any(String),
      { encoding: 'utf-8' }
    );

    // Verify result
    expect(result.filePath).toBe(expectedPath);
    expect(result.sessionId).toBe('test-session-uuid-123');
  });

  it('should format messages as JSONL with trailing newline', async () => {
    const messages: UserMessage[] = [
      {
        type: 'user',
        uuid: 'uuid-1',
        sessionId: 'session-123',
        timestamp: '2024-01-01T00:00:00Z',
        parentUuid: null,
        message: { role: 'user', content: 'First' },
        cwd: '/Users/name/project',
        version: '1.0.0',
      },
      {
        type: 'user',
        uuid: 'uuid-2',
        sessionId: 'session-123',
        timestamp: '2024-01-01T00:01:00Z',
        parentUuid: 'uuid-1',
        message: { role: 'user', content: 'Second' },
        cwd: '/Users/name/project',
        version: '1.0.0',
      },
    ];

    await writeSessionToLocal(messages, '/Users/name/project');

    const writtenContent = mockWriteFile.mock.calls[0][1];
    const lines = writtenContent.split('\n');

    // Should have 3 lines: 2 messages + trailing newline (which creates empty string)
    expect(lines.length).toBe(3);
    expect(lines[2]).toBe(''); // Trailing newline creates empty last element

    // Each line should be valid JSON
    expect(() => JSON.parse(lines[0])).not.toThrow();
    expect(() => JSON.parse(lines[1])).not.toThrow();

    // Verify content
    const msg1 = JSON.parse(lines[0]);
    const msg2 = JSON.parse(lines[1]);
    expect(msg1.uuid).toBe('uuid-1');
    expect(msg2.uuid).toBe('uuid-2');
  });

  it('should handle multiple message types', async () => {
    const messages: (UserMessage | AssistantMessage)[] = [
      {
        type: 'user',
        uuid: 'uuid-1',
        sessionId: 'session-123',
        timestamp: '2024-01-01T00:00:00Z',
        parentUuid: null,
        message: { role: 'user', content: 'Question' },
        cwd: '/Users/name/project',
        version: '1.0.0',
      },
      {
        type: 'assistant',
        uuid: 'uuid-2',
        sessionId: 'session-123',
        timestamp: '2024-01-01T00:01:00Z',
        parentUuid: 'uuid-1',
        messageId: 'msg-1',
        snapshot: {
          thinking: 'Let me help',
          messages: [{ role: 'assistant', content: 'Answer' }],
        },
      },
    ];

    await writeSessionToLocal(messages, '/Users/name/project');

    const writtenContent = mockWriteFile.mock.calls[0][1];
    const lines = writtenContent.split('\n');

    const msg1 = JSON.parse(lines[0]);
    const msg2 = JSON.parse(lines[1]);

    expect(msg1.type).toBe('user');
    expect(msg2.type).toBe('assistant');
    expect(msg2.snapshot.thinking).toBe('Let me help');
  });

  it('should encode project path correctly', async () => {
    const messages: UserMessage[] = [
      {
        type: 'user',
        uuid: 'uuid-1',
        sessionId: 'session-123',
        timestamp: '2024-01-01T00:00:00Z',
        parentUuid: null,
        message: { role: 'user', content: 'Test' },
        cwd: '/opt/code/my-app',
        version: '1.0.0',
      },
    ];

    await writeSessionToLocal(messages, '/opt/code/my-app');

    const expectedDir = join(homedir(), '.claude', 'projects', 'opt-code-my-app');
    expect(mockMkdir).toHaveBeenCalledWith(expectedDir, { recursive: true });
  });

  it('should create directory with recursive flag', async () => {
    const messages: UserMessage[] = [
      {
        type: 'user',
        uuid: 'uuid-1',
        sessionId: 'session-123',
        timestamp: '2024-01-01T00:00:00Z',
        parentUuid: null,
        message: { role: 'user', content: 'Test' },
        cwd: '/Users/name/project',
        version: '1.0.0',
      },
    ];

    await writeSessionToLocal(messages, '/Users/name/project');

    expect(mockMkdir).toHaveBeenCalledWith(
      expect.any(String),
      { recursive: true }
    );
  });

  it('should throw SessionWriteError on EACCES (permissions)', async () => {
    const messages: UserMessage[] = [
      {
        type: 'user',
        uuid: 'uuid-1',
        sessionId: 'session-123',
        timestamp: '2024-01-01T00:00:00Z',
        parentUuid: null,
        message: { role: 'user', content: 'Test' },
        cwd: '/Users/name/project',
        version: '1.0.0',
      },
    ];

    mockMkdir.mockRejectedValue({
      code: 'EACCES',
      message: 'Permission denied',
    });

    await expect(
      writeSessionToLocal(messages, '/Users/name/project')
    ).rejects.toThrow(SessionWriteError);

    await expect(
      writeSessionToLocal(messages, '/Users/name/project')
    ).rejects.toThrow(/Permission denied/);
  });

  it('should throw SessionWriteError on ENOSPC (disk full)', async () => {
    const messages: UserMessage[] = [
      {
        type: 'user',
        uuid: 'uuid-1',
        sessionId: 'session-123',
        timestamp: '2024-01-01T00:00:00Z',
        parentUuid: null,
        message: { role: 'user', content: 'Test' },
        cwd: '/Users/name/project',
        version: '1.0.0',
      },
    ];

    mockWriteFile.mockRejectedValue({
      code: 'ENOSPC',
      message: 'No space left on device',
    });

    await expect(
      writeSessionToLocal(messages, '/Users/name/project')
    ).rejects.toThrow(SessionWriteError);

    await expect(
      writeSessionToLocal(messages, '/Users/name/project')
    ).rejects.toThrow(/Disk full/);
  });

  it('should throw SessionWriteError on other filesystem errors', async () => {
    const messages: UserMessage[] = [
      {
        type: 'user',
        uuid: 'uuid-1',
        sessionId: 'session-123',
        timestamp: '2024-01-01T00:00:00Z',
        parentUuid: null,
        message: { role: 'user', content: 'Test' },
        cwd: '/Users/name/project',
        version: '1.0.0',
      },
    ];

    mockWriteFile.mockRejectedValue({
      code: 'UNKNOWN',
      message: 'Something went wrong',
    });

    await expect(
      writeSessionToLocal(messages, '/Users/name/project')
    ).rejects.toThrow(SessionWriteError);

    await expect(
      writeSessionToLocal(messages, '/Users/name/project')
    ).rejects.toThrow(/Failed to write session/);
  });

  it('should include error code in SessionWriteError', async () => {
    const messages: UserMessage[] = [
      {
        type: 'user',
        uuid: 'uuid-1',
        sessionId: 'session-123',
        timestamp: '2024-01-01T00:00:00Z',
        parentUuid: null,
        message: { role: 'user', content: 'Test' },
        cwd: '/Users/name/project',
        version: '1.0.0',
      },
    ];

    mockMkdir.mockRejectedValue({
      code: 'EACCES',
      message: 'Permission denied',
    });

    try {
      await writeSessionToLocal(messages, '/Users/name/project');
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(SessionWriteError);
      expect((error as SessionWriteError).code).toBe('EACCES');
    }
  });

  it('should write empty messages array', async () => {
    const messages: UserMessage[] = [];

    await writeSessionToLocal(messages, '/Users/name/project');

    const writtenContent = mockWriteFile.mock.calls[0][1];
    expect(writtenContent).toBe('\n'); // Just trailing newline
  });

  it('should preserve all message fields in written JSON', async () => {
    const messages: UserMessage[] = [
      {
        type: 'user',
        uuid: 'uuid-1',
        sessionId: 'session-123',
        timestamp: '2024-01-01T00:00:00Z',
        parentUuid: null,
        message: { role: 'user', content: 'Test message' },
        cwd: '/Users/name/project',
        version: '1.0.0',
        gitBranch: 'main',
        isSidechain: true,
        isMeta: false,
      },
    ];

    await writeSessionToLocal(messages, '/Users/name/project');

    const writtenContent = mockWriteFile.mock.calls[0][1];
    const parsed = JSON.parse(writtenContent.split('\n')[0]);

    expect(parsed.type).toBe('user');
    expect(parsed.uuid).toBe('uuid-1');
    expect(parsed.sessionId).toBe('session-123');
    expect(parsed.timestamp).toBe('2024-01-01T00:00:00Z');
    expect(parsed.parentUuid).toBeNull();
    expect(parsed.cwd).toBe('/Users/name/project');
    expect(parsed.version).toBe('1.0.0');
    expect(parsed.gitBranch).toBe('main');
    expect(parsed.isSidechain).toBe(true);
    expect(parsed.isMeta).toBe(false);
  });
});
