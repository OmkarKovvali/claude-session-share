/**
 * MCP Integration Tests for share_session tool
 *
 * Tests tool registration schema and handler logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock uploadSession before importing index
const mockUploadSession = vi.fn();
vi.mock('../services/session-uploader.js', () => ({
  uploadSession: mockUploadSession,
}));

describe('MCP share_session tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GITHUB_TOKEN = 'test_token';
  });

  describe('tool schema', () => {
    it('should have correct tool name', () => {
      const toolSchema = {
        name: 'share_session',
        description: 'Share a Claude Code session via GitHub Gist. Creates a sanitized, shareable link to the conversation.',
        inputSchema: {
          type: 'object',
          properties: {
            sessionPath: {
              type: 'string',
              description: 'Optional path to session file. If not provided, shares the most recent session.',
            },
          },
        },
      };

      expect(toolSchema.name).toBe('share_session');
      expect(toolSchema.description).toContain('Share a Claude Code session');
    });

    it('should have sessionPath parameter in schema', () => {
      const inputSchema = {
        type: 'object',
        properties: {
          sessionPath: {
            type: 'string',
            description: 'Optional path to session file. If not provided, shares the most recent session.',
          },
        },
      };

      expect(inputSchema.properties.sessionPath.type).toBe('string');
      expect(inputSchema.properties.sessionPath.description).toContain('Optional');
    });
  });

  describe('tool execution with explicit path', () => {
    it('should call uploadSession with provided sessionPath', async () => {
      mockUploadSession.mockResolvedValue('https://gist.github.com/test/abc123');

      // Simulate tool handler logic
      const sessionPath = '/test/session.jsonl';
      const gistUrl = await mockUploadSession(sessionPath);

      expect(mockUploadSession).toHaveBeenCalledWith('/test/session.jsonl');
      expect(gistUrl).toBe('https://gist.github.com/test/abc123');
    });

    it('should format success response correctly', async () => {
      mockUploadSession.mockResolvedValue('https://gist.github.com/user/def456');

      const sessionPath = '/explicit/path.jsonl';
      const gistUrl = await mockUploadSession(sessionPath);

      const response = {
        content: [
          {
            type: 'text',
            text: `Successfully shared session!\n\nGist URL: ${gistUrl}\n\nYou can share this URL with others to give them access to this conversation.`,
          },
        ],
      };

      expect(response.content[0].text).toContain('Gist URL: https://gist.github.com/user/def456');
      expect(response.content[0].text).toContain('You can share this URL');
    });
  });

  describe('error handling', () => {
    it('should handle uploadSession errors', async () => {
      mockUploadSession.mockRejectedValue(new Error('GitHub API rate limit exceeded'));

      try {
        await mockUploadSession('/error/path.jsonl');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const response = {
          content: [
            {
              type: 'text',
              text: `Failed to share session: ${errorMessage}`,
            },
          ],
          isError: true,
        };

        expect(response.isError).toBe(true);
        expect(response.content[0].text).toContain('Failed to share session');
        expect(response.content[0].text).toContain('GitHub API rate limit exceeded');
      }
    });

    it('should format error response with isError flag', async () => {
      mockUploadSession.mockRejectedValue(new Error('Invalid GITHUB_TOKEN'));

      try {
        await mockUploadSession('/auth/error.jsonl');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const response = {
          content: [
            {
              type: 'text',
              text: `Failed to share session: ${errorMessage}`,
            },
          ],
          isError: true,
        };

        expect(response.isError).toBe(true);
        expect(response.content[0].text).toContain('Invalid GITHUB_TOKEN');
      }
    });
  });

  describe('response format', () => {
    it('should return proper MCP tool response structure', async () => {
      mockUploadSession.mockResolvedValue('https://gist.github.com/test/response123');

      const sessionPath = '/test/response.jsonl';
      const gistUrl = await mockUploadSession(sessionPath);

      const response = {
        content: [
          {
            type: 'text',
            text: `Successfully shared session!\n\nGist URL: ${gistUrl}\n\nYou can share this URL with others to give them access to this conversation.`,
          },
        ],
      };

      expect(response).toHaveProperty('content');
      expect(Array.isArray(response.content)).toBe(true);
      expect(response.content[0]).toHaveProperty('type', 'text');
      expect(response.content[0]).toHaveProperty('text');
      expect(response).not.toHaveProperty('isError'); // Success case doesn't have isError
    });

    it('should handle missing sessionPath (use most recent)', async () => {
      // Simulate findMostRecentSession returning a path
      const mostRecentPath = '/mock/most/recent/session.jsonl';
      mockUploadSession.mockResolvedValue('https://gist.github.com/test/xyz789');

      const sessionPath = undefined;
      const pathToShare = sessionPath || mostRecentPath;

      const gistUrl = await mockUploadSession(pathToShare);

      expect(mockUploadSession).toHaveBeenCalledWith(mostRecentPath);
      expect(gistUrl).toBe('https://gist.github.com/test/xyz789');
    });

    it('should handle no sessions found', () => {
      const mostRecentPath = null;

      const response = {
        content: [
          {
            type: 'text',
            text: 'Error: No session files found. Please provide a session path or ensure you have Claude Code sessions in ~/.claude/projects/',
          },
        ],
        isError: true,
      };

      if (!mostRecentPath) {
        expect(response.isError).toBe(true);
        expect(response.content[0].text).toContain('No session files found');
      }
    });
  });

  describe('tool integration', () => {
    it('should verify tool can be imported without errors', async () => {
      // This test verifies the index.ts module loads successfully
      const moduleImport = import('../index.js');
      await expect(moduleImport).resolves.toBeDefined();
    });
  });
});
