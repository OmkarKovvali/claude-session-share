/**
 * Tests for session-to-gist upload service
 *
 * Verifies orchestration of:
 * - Session reading
 * - Privacy sanitization
 * - JSONL formatting
 * - Metadata extraction
 * - Gist upload
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uploadSession } from '../services/session-uploader.js';
import * as reader from '../session/reader.js';
import * as metadata from '../session/metadata.js';
import * as pipeline from '../sanitization/pipeline.js';
import * as gistClient from '../gist/client.js';
import type { SessionMessage, UserMessage, AssistantMessage } from '../session/types.js';
import type { SessionMetadata } from '../session/metadata.js';
import type { GistResponse } from '../gist/types.js';

describe('uploadSession', () => {
  const mockSessionPath = '/test/session.jsonl';

  const mockUserMessage: UserMessage = {
    type: 'user',
    uuid: 'user-1',
    sessionId: 'test-session',
    timestamp: '2026-01-12T10:00:00.000Z',
    parentUuid: null,
    message: { role: 'user', content: 'Hello' },
    cwd: '/Users/test/project',
    version: '1.0.0',
  };

  const mockAssistantMessage: AssistantMessage = {
    type: 'assistant',
    uuid: 'assistant-1',
    sessionId: 'test-session',
    timestamp: '2026-01-12T10:01:00.000Z',
    parentUuid: 'user-1',
    messageId: 'msg-1',
    snapshot: {
      thinking: 'Internal thinking',
      messages: [{ role: 'assistant', content: 'Hi there!' }],
    },
  };

  const mockMessages: SessionMessage[] = [mockUserMessage, mockAssistantMessage];

  const mockSanitizedMessages: SessionMessage[] = [
    { ...mockUserMessage, cwd: 'project' },
    {
      ...mockAssistantMessage,
      snapshot: {
        thinking: null,
        messages: [{ role: 'assistant', content: 'Hi there!' }],
      },
    },
  ];

  const mockMetadata: SessionMetadata = {
    sessionId: 'test-session',
    projectPath: '/Users/test/project',
    messageCount: 2,
    firstTimestamp: '2026-01-12T10:00:00.000Z',
    lastTimestamp: '2026-01-12T10:01:00.000Z',
    hasAgentConversations: false,
    version: '1.0.0',
  };

  const mockGistResponse: GistResponse = {
    id: 'gist123',
    url: 'https://api.github.com/gists/gist123',
    html_url: 'https://gist.github.com/user/gist123',
    files: {},
    public: false,
    created_at: '2026-01-12T10:00:00Z',
    updated_at: '2026-01-12T10:00:00Z',
    description: 'Test gist',
  };

  // Set up environment variable before tests
  beforeEach(() => {
    process.env.GITHUB_TOKEN = 'test_token';
    vi.clearAllMocks();
  });

  // Helper to mock GistClient
  function mockGistClient(createGistFn: any) {
    vi.spyOn(gistClient, 'GistClient').mockImplementation(function(this: any) {
      this.createGist = createGistFn;
      this.getOctokit = vi.fn();
      return this;
    } as any);
  }

  describe('successful upload', () => {
    it('should orchestrate full upload pipeline and return gist URL', async () => {
      // Mock all dependencies
      const parseSessionFileSpy = vi.spyOn(reader, 'parseSessionFile').mockResolvedValue(mockMessages);
      const inferBasePathSpy = vi.spyOn(pipeline, 'inferBasePath').mockReturnValue('/Users/test/project');
      const sanitizeSessionSpy = vi.spyOn(pipeline, 'sanitizeSession').mockReturnValue(mockSanitizedMessages);
      const extractMetadataSpy = vi.spyOn(metadata, 'extractMetadata').mockReturnValue(mockMetadata);

      const mockCreateGist = vi.fn().mockResolvedValue(mockGistResponse);
      mockGistClient(mockCreateGist);

      // Execute
      const result = await uploadSession(mockSessionPath);

      // Verify correct call sequence
      expect(parseSessionFileSpy).toHaveBeenCalledWith(mockSessionPath);
      expect(inferBasePathSpy).toHaveBeenCalledWith(mockMessages);
      expect(sanitizeSessionSpy).toHaveBeenCalledWith(mockMessages, '/Users/test/project');
      expect(extractMetadataSpy).toHaveBeenCalledWith(mockSanitizedMessages);
      expect(mockCreateGist).toHaveBeenCalled();

      // Verify result
      expect(result).toBe('https://gist.github.com/user/gist123');
    });

    it('should format JSONL correctly (one message per line)', async () => {
      vi.spyOn(reader, 'parseSessionFile').mockResolvedValue(mockMessages);
      vi.spyOn(pipeline, 'inferBasePath').mockReturnValue('/Users/test/project');
      vi.spyOn(pipeline, 'sanitizeSession').mockReturnValue(mockSanitizedMessages);
      vi.spyOn(metadata, 'extractMetadata').mockReturnValue(mockMetadata);

      const mockCreateGist = vi.fn().mockResolvedValue(mockGistResponse);
      mockGistClient(mockCreateGist);

      await uploadSession(mockSessionPath);

      // Verify JSONL format
      const createGistCall = mockCreateGist.mock.calls[0];
      const files = createGistCall[1];
      const sessionJsonl = files['session.jsonl'];

      // Should have one JSON object per line
      const lines = sessionJsonl.split('\n');
      expect(lines).toHaveLength(2);

      // Each line should be valid JSON
      const parsed1 = JSON.parse(lines[0]);
      const parsed2 = JSON.parse(lines[1]);
      expect(parsed1.type).toBe('user');
      expect(parsed2.type).toBe('assistant');
    });

    it('should include metadata.json with correct structure', async () => {
      vi.spyOn(reader, 'parseSessionFile').mockResolvedValue(mockMessages);
      vi.spyOn(pipeline, 'inferBasePath').mockReturnValue('/Users/test/project');
      vi.spyOn(pipeline, 'sanitizeSession').mockReturnValue(mockSanitizedMessages);
      vi.spyOn(metadata, 'extractMetadata').mockReturnValue(mockMetadata);

      const mockCreateGist = vi.fn().mockResolvedValue(mockGistResponse);
      mockGistClient(mockCreateGist);

      await uploadSession(mockSessionPath);

      // Verify metadata file
      const createGistCall = mockCreateGist.mock.calls[0];
      const files = createGistCall[1];
      const metadataJson = files['metadata.json'];

      const parsedMetadata = JSON.parse(metadataJson);
      expect(parsedMetadata).toEqual(mockMetadata);
    });

    it('should use project name in gist description when available', async () => {
      vi.spyOn(reader, 'parseSessionFile').mockResolvedValue(mockMessages);
      vi.spyOn(pipeline, 'inferBasePath').mockReturnValue('/Users/test/project');
      vi.spyOn(pipeline, 'sanitizeSession').mockReturnValue(mockSanitizedMessages);
      vi.spyOn(metadata, 'extractMetadata').mockReturnValue(mockMetadata);

      const mockCreateGist = vi.fn().mockResolvedValue(mockGistResponse);
      mockGistClient(mockCreateGist);

      await uploadSession(mockSessionPath);

      const createGistCall = mockCreateGist.mock.calls[0];
      const description = createGistCall[0];
      expect(description).toContain('project'); // Last path segment
    });

    it('should fallback to timestamp in description when no project path', async () => {
      vi.spyOn(reader, 'parseSessionFile').mockResolvedValue(mockMessages);
      vi.spyOn(pipeline, 'inferBasePath').mockReturnValue('');
      vi.spyOn(pipeline, 'sanitizeSession').mockReturnValue(mockSanitizedMessages);

      const metadataNoPath = { ...mockMetadata, projectPath: 'unknown' };
      vi.spyOn(metadata, 'extractMetadata').mockReturnValue(metadataNoPath);

      const mockCreateGist = vi.fn().mockResolvedValue(mockGistResponse);
      mockGistClient(mockCreateGist);

      await uploadSession(mockSessionPath);

      const createGistCall = mockCreateGist.mock.calls[0];
      const description = createGistCall[0];
      expect(description).toContain('2026-01-12'); // Timestamp fallback
    });
  });

  describe('error handling', () => {
    it('should propagate error from parseSessionFile', async () => {
      const parseError = new Error('File not found');
      vi.spyOn(reader, 'parseSessionFile').mockRejectedValue(parseError);

      await expect(uploadSession(mockSessionPath)).rejects.toThrow('Failed to upload session: File not found');
    });

    it('should throw error for empty session file', async () => {
      vi.spyOn(reader, 'parseSessionFile').mockResolvedValue([]);

      await expect(uploadSession(mockSessionPath)).rejects.toThrow(
        'Session file is empty or contains no valid messages'
      );
    });

    it('should propagate error from sanitizeSession', async () => {
      vi.spyOn(reader, 'parseSessionFile').mockResolvedValue(mockMessages);
      vi.spyOn(pipeline, 'inferBasePath').mockReturnValue('/Users/test/project');
      vi.spyOn(pipeline, 'sanitizeSession').mockImplementation(() => {
        throw new Error('Sanitization failed');
      });

      await expect(uploadSession(mockSessionPath)).rejects.toThrow('Failed to upload session: Sanitization failed');
    });

    it('should throw error when metadata extraction returns null', async () => {
      vi.spyOn(reader, 'parseSessionFile').mockResolvedValue(mockMessages);
      vi.spyOn(pipeline, 'inferBasePath').mockReturnValue('/Users/test/project');
      vi.spyOn(pipeline, 'sanitizeSession').mockReturnValue(mockSanitizedMessages);
      vi.spyOn(metadata, 'extractMetadata').mockReturnValue(null);

      await expect(uploadSession(mockSessionPath)).rejects.toThrow('Failed to extract session metadata');
    });

    it('should propagate error from GistClient.createGist', async () => {
      vi.spyOn(reader, 'parseSessionFile').mockResolvedValue(mockMessages);
      vi.spyOn(pipeline, 'inferBasePath').mockReturnValue('/Users/test/project');
      vi.spyOn(pipeline, 'sanitizeSession').mockReturnValue(mockSanitizedMessages);
      vi.spyOn(metadata, 'extractMetadata').mockReturnValue(mockMetadata);

      const gistError = new Error('GitHub API rate limit exceeded');
      const mockCreateGist = vi.fn().mockRejectedValue(gistError);
      mockGistClient(mockCreateGist);

      await expect(uploadSession(mockSessionPath)).rejects.toThrow(
        'Failed to upload session: GitHub API rate limit exceeded'
      );
    });
  });

  describe('immutability', () => {
    it('should not modify original messages array', async () => {
      const originalMessages = [...mockMessages];
      vi.spyOn(reader, 'parseSessionFile').mockResolvedValue(mockMessages);
      vi.spyOn(pipeline, 'inferBasePath').mockReturnValue('/Users/test/project');
      vi.spyOn(pipeline, 'sanitizeSession').mockReturnValue(mockSanitizedMessages);
      vi.spyOn(metadata, 'extractMetadata').mockReturnValue(mockMetadata);

      const mockCreateGist = vi.fn().mockResolvedValue(mockGistResponse);
      mockGistClient(mockCreateGist);

      await uploadSession(mockSessionPath);

      // Verify original not mutated
      expect(mockMessages).toEqual(originalMessages);
    });
  });
});
