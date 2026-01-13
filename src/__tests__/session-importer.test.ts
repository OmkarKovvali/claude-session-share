/**
 * Tests for session import service
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { importSession } from '../services/session-importer.js';
import * as gistClient from '../gist/client.js';
import * as sessionWriter from '../session/writer.js';
import type { SessionMessage } from '../session/types.js';
import type { GistResponse } from '../gist/types.js';

describe('importSession', () => {
  const mockGist: GistResponse = {
    id: 'abc123',
    url: 'https://api.github.com/gists/abc123',
    html_url: 'https://gist.github.com/user/abc123',
    files: {
      'session.jsonl': {
        filename: 'session.jsonl',
        type: 'text/plain',
        language: 'JSON',
        raw_url: 'https://gist.githubusercontent.com/user/abc123/raw/session.jsonl',
        size: 100,
        content:
          '{"type":"user","uuid":"uuid1","sessionId":"session1","parentUuid":null,"message":"Hello","timestamp":"2024-01-01T00:00:00Z"}\n' +
          '{"type":"assistant","uuid":"uuid2","sessionId":"session1","parentUuid":"uuid1","message":"Hi","timestamp":"2024-01-01T00:00:01Z"}',
      },
      'metadata.json': {
        filename: 'metadata.json',
        type: 'text/plain',
        language: 'JSON',
        raw_url: 'https://gist.githubusercontent.com/user/abc123/raw/metadata.json',
        size: 30,
        content: '{"title":"Test Session"}',
      },
    },
    public: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    description: 'Test Gist',
  };

  beforeEach(() => {
    process.env.GITHUB_TOKEN = 'test_token';
    vi.clearAllMocks();
  });

  // Helper to mock GistClient
  function mockGistClient(fetchGistFn: any) {
    vi.spyOn(gistClient, 'GistClient').mockImplementation(function(this: any) {
      this.fetchGist = fetchGistFn;
      this.createGist = vi.fn();
      this.getOctokit = vi.fn();
      return this;
    } as any);
  }

  describe('successful import', () => {
    it('should orchestrate full import pipeline', async () => {
      const mockFetchGist = vi.fn().mockResolvedValue(mockGist);
      mockGistClient(mockFetchGist);

      const mockWriteSession = vi.spyOn(sessionWriter, 'writeSessionToLocal').mockResolvedValue({
        filePath: '/Users/test/.claude/projects/encoded/session-id.jsonl',
        sessionId: 'new-session-id',
      });

      const result = await importSession(
        'https://gist.github.com/user/abc123',
        '/Users/test/project'
      );

      expect(result).toEqual({
        sessionPath: '/Users/test/.claude/projects/encoded/session-id.jsonl',
        sessionId: 'new-session-id',
        messageCount: 2,
        projectPath: '/Users/test/project',
      });

      // Verify fetchGist was called with correct URL
      expect(mockFetchGist).toHaveBeenCalledWith(
        'https://gist.github.com/user/abc123'
      );

      // Verify writeSessionToLocal was called
      expect(mockWriteSession).toHaveBeenCalledWith(
        expect.any(Array),
        '/Users/test/project'
      );

      // Verify messages were remapped (UUIDs should be different)
      const writtenMessages = mockWriteSession.mock.calls[0][0];
      expect(writtenMessages).toHaveLength(2);
      expect(writtenMessages[0].uuid).not.toBe('uuid1');
      expect(writtenMessages[1].uuid).not.toBe('uuid2');
      expect(writtenMessages[0].sessionId).not.toBe('session1');
      expect(writtenMessages[1].sessionId).not.toBe('session1');
    });

    it('should extract JSONL file from gist', async () => {
      const mockFetchGist = vi.fn().mockResolvedValue(mockGist);
      mockGistClient(mockFetchGist);

      const mockWriteSession = vi.spyOn(sessionWriter, 'writeSessionToLocal').mockResolvedValue({
        filePath: '/Users/test/.claude/projects/encoded/session-id.jsonl',
        sessionId: 'new-session-id',
      });

      await importSession('abc123', '/Users/test/project');

      // Verify writeSessionToLocal received parsed messages
      const writtenMessages = mockWriteSession.mock.calls[0][0];
      expect(writtenMessages).toHaveLength(2);
      expect(writtenMessages[0].type).toBe('user');
      // User messages have 'message' field with role/content
      expect(writtenMessages[1].type).toBe('assistant');
    });

    it('should remap UUIDs consistently', async () => {
      const mockFetchGist = vi.fn().mockResolvedValue(mockGist);
      mockGistClient(mockFetchGist);

      const mockWriteSession = vi.spyOn(sessionWriter, 'writeSessionToLocal').mockResolvedValue({
        filePath: '/Users/test/.claude/projects/encoded/session-id.jsonl',
        sessionId: 'new-session-id',
      });

      await importSession('abc123', '/Users/test/project');

      const writtenMessages = mockWriteSession.mock.calls[0][0];

      // First message parent should be remapped consistently
      expect(writtenMessages[0].parentUuid).toBeNull();

      // Second message parent should reference first message's remapped UUID
      expect(writtenMessages[1].parentUuid).toBe(writtenMessages[0].uuid);

      // Session IDs should be consistently remapped
      expect(writtenMessages[0].sessionId).toBe(writtenMessages[1].sessionId);
    });

    it('should handle bare gist ID (not URL)', async () => {
      const mockFetchGist = vi.fn().mockResolvedValue(mockGist);
      mockGistClient(mockFetchGist);

      vi.spyOn(sessionWriter, 'writeSessionToLocal').mockResolvedValue({
        filePath: '/Users/test/.claude/projects/encoded/session-id.jsonl',
        sessionId: 'new-session-id',
      });

      await importSession('abc123', '/Users/test/project');

      expect(mockFetchGist).toHaveBeenCalledWith('abc123');
    });
  });

  describe('error handling', () => {
    it('should throw error if no JSONL file in gist', async () => {
      const gistWithoutJsonl: GistResponse = {
        ...mockGist,
        files: {
          'metadata.json': {
            filename: 'metadata.json',
            type: 'text/plain',
            language: 'JSON',
            raw_url: 'https://gist.githubusercontent.com/user/abc123/raw/metadata.json',
            size: 20,
            content: '{"title":"Test"}',
          },
        },
      };

      const mockFetchGist = vi.fn().mockResolvedValue(gistWithoutJsonl);
      mockGistClient(mockFetchGist);

      await expect(
        importSession('abc123', '/Users/test/project')
      ).rejects.toThrow(
        'No JSONL file found in gist. Expected a .jsonl file containing session messages.'
      );
    });

    it('should throw error if JSONL file has no content', async () => {
      const gistWithEmptyJsonl: GistResponse = {
        ...mockGist,
        files: {
          'session.jsonl': {
            filename: 'session.jsonl',
            type: 'text/plain',
            language: 'JSON',
            raw_url: 'https://gist.githubusercontent.com/user/abc123/raw/session.jsonl',
            size: 0,
            content: '',
          },
        },
      };

      const mockFetchGist = vi.fn().mockResolvedValue(gistWithEmptyJsonl);
      mockGistClient(mockFetchGist);

      await expect(
        importSession('abc123', '/Users/test/project')
      ).rejects.toThrow('JSONL file "session.jsonl" has no content');
    });

    it('should handle gist not found (404)', async () => {
      const notFoundError = new Error('Gist not found');
      (notFoundError as any).status = 404;

      const mockFetchGist = vi.fn().mockRejectedValue(notFoundError);
      mockGistClient(mockFetchGist);

      await expect(
        importSession('nonexistent', '/Users/test/project')
      ).rejects.toThrow('Failed to import session: Gist not found');
    });

    it('should recover from parse errors on individual lines', async () => {
      const gistWithBadLines: GistResponse = {
        ...mockGist,
        files: {
          'session.jsonl': {
            filename: 'session.jsonl',
            type: 'text/plain',
            language: 'JSON',
            raw_url: 'https://gist.githubusercontent.com/user/abc123/raw/session.jsonl',
            size: 150,
            content:
              '{"type":"user","uuid":"uuid1","sessionId":"session1","parentUuid":null,"message":"Hello","timestamp":"2024-01-01T00:00:00Z"}\n' +
              'invalid json line\n' +
              '{"type":"assistant","uuid":"uuid2","sessionId":"session1","parentUuid":"uuid1","message":"Hi","timestamp":"2024-01-01T00:00:01Z"}',
          },
        },
      };

      const mockFetchGist = vi.fn().mockResolvedValue(gistWithBadLines);
      mockGistClient(mockFetchGist);

      const mockWriteSession = vi.spyOn(sessionWriter, 'writeSessionToLocal').mockResolvedValue({
        filePath: '/Users/test/.claude/projects/encoded/session-id.jsonl',
        sessionId: 'new-session-id',
      });

      const result = await importSession('abc123', '/Users/test/project');

      // Should import 2 valid messages despite parse error
      expect(result.messageCount).toBe(2);

      const writtenMessages = mockWriteSession.mock.calls[0][0];
      expect(writtenMessages).toHaveLength(2);
    });

    it('should throw error if all lines fail to parse', async () => {
      const gistWithAllBadLines: GistResponse = {
        ...mockGist,
        files: {
          'session.jsonl': {
            filename: 'session.jsonl',
            type: 'text/plain',
            language: 'JSON',
            raw_url: 'https://gist.githubusercontent.com/user/abc123/raw/session.jsonl',
            size: 40,
            content: 'invalid json\n{bad syntax\nmore bad json',
          },
        },
      };

      const mockFetchGist = vi.fn().mockResolvedValue(gistWithAllBadLines);
      mockGistClient(mockFetchGist);

      await expect(
        importSession('abc123', '/Users/test/project')
      ).rejects.toThrow('No valid messages found in JSONL file');
    });

    it('should propagate write errors', async () => {
      const mockFetchGist = vi.fn().mockResolvedValue(mockGist);
      mockGistClient(mockFetchGist);

      vi.spyOn(sessionWriter, 'writeSessionToLocal').mockRejectedValue(
        new Error('Permission denied')
      );

      await expect(
        importSession('abc123', '/Users/test/project')
      ).rejects.toThrow('Failed to import session: Permission denied');
    });
  });
});
