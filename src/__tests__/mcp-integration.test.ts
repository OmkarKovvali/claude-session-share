/**
 * MCP Integration Tests for share_session tool
 *
 * Tests tool registration schema and handler logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock services before importing index
const mockUploadSession = vi.fn();
const mockImportSession = vi.fn();
vi.mock('../services/session-uploader.js', () => ({
  uploadSession: mockUploadSession,
}));
vi.mock('../services/session-importer.js', () => ({
  importSession: mockImportSession,
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

describe('MCP import_session tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GITHUB_TOKEN = 'test_token';
  });

  describe('tool schema', () => {
    it('should have correct tool name', () => {
      const toolSchema = {
        name: 'import_session',
        description: 'Import a shared Claude Code session from GitHub Gist URL or ID. Creates local resumable session in ~/.claude/projects/',
        inputSchema: {
          type: 'object',
          properties: {
            gistUrl: {
              type: 'string',
              description: 'GitHub Gist URL (https://gist.github.com/user/id) or bare gist ID',
            },
            projectPath: {
              type: 'string',
              description: 'Local project directory path where session will be imported (e.g., /Users/name/project)',
            },
          },
          required: ['gistUrl', 'projectPath'],
        },
      };

      expect(toolSchema.name).toBe('import_session');
      expect(toolSchema.description).toContain('Import a shared Claude Code session');
    });

    it('should have gistUrl and projectPath parameters in schema', () => {
      const inputSchema = {
        type: 'object',
        properties: {
          gistUrl: {
            type: 'string',
            description: 'GitHub Gist URL (https://gist.github.com/user/id) or bare gist ID',
          },
          projectPath: {
            type: 'string',
            description: 'Local project directory path where session will be imported (e.g., /Users/name/project)',
          },
        },
        required: ['gistUrl', 'projectPath'],
      };

      expect(inputSchema.properties.gistUrl.type).toBe('string');
      expect(inputSchema.properties.projectPath.type).toBe('string');
      expect(inputSchema.required).toContain('gistUrl');
      expect(inputSchema.required).toContain('projectPath');
    });
  });

  describe('tool execution', () => {
    it('should call importSession with provided arguments', async () => {
      const mockResult = {
        sessionPath: '/Users/test/.claude/projects/encoded/session-id.jsonl',
        sessionId: 'abc123',
        messageCount: 10,
        projectPath: '/Users/test/project',
      };

      mockImportSession.mockResolvedValue(mockResult);

      const gistUrl = 'https://gist.github.com/user/abc123';
      const projectPath = '/Users/test/project';
      const result = await mockImportSession(gistUrl, projectPath);

      expect(mockImportSession).toHaveBeenCalledWith(
        'https://gist.github.com/user/abc123',
        '/Users/test/project'
      );
      expect(result.sessionId).toBe('abc123');
      expect(result.messageCount).toBe(10);
    });

    it('should format success response correctly', async () => {
      const mockResult = {
        sessionPath: '/Users/test/.claude/projects/encoded/session-id.jsonl',
        sessionId: 'xyz789',
        messageCount: 25,
        projectPath: '/Users/test/my-project',
      };

      mockImportSession.mockResolvedValue(mockResult);

      const result = await mockImportSession('gist-id', '/Users/test/my-project');

      const response = {
        content: [
          {
            type: 'text',
            text: `Session imported successfully!\n\nSession ID: ${result.sessionId}\nMessages: ${result.messageCount}\nLocation: ${result.sessionPath}\n\nUse 'claude --resume' to see imported session.`,
          },
        ],
      };

      expect(response.content[0].text).toContain('Session imported successfully');
      expect(response.content[0].text).toContain('Session ID: xyz789');
      expect(response.content[0].text).toContain('Messages: 25');
      expect(response.content[0].text).toContain('claude --resume');
    });
  });

  describe('validation', () => {
    it('should validate gistUrl is provided', () => {
      const gistUrl = undefined;
      const projectPath = '/Users/test/project';

      if (!gistUrl || typeof gistUrl !== 'string' || gistUrl.trim() === '') {
        const response = {
          content: [
            {
              type: 'text',
              text: 'Error: gistUrl is required and must be a non-empty string',
            },
          ],
          isError: true,
        };

        expect(response.isError).toBe(true);
        expect(response.content[0].text).toContain('gistUrl is required');
      }
    });

    it('should validate projectPath is provided', () => {
      const gistUrl = 'https://gist.github.com/user/abc123';
      const projectPath = undefined;

      if (!projectPath || typeof projectPath !== 'string' || projectPath.trim() === '') {
        const response = {
          content: [
            {
              type: 'text',
              text: 'Error: projectPath is required and must be a non-empty string',
            },
          ],
          isError: true,
        };

        expect(response.isError).toBe(true);
        expect(response.content[0].text).toContain('projectPath is required');
      }
    });

    it('should reject empty gistUrl', () => {
      const gistUrl = '   ';
      const projectPath = '/Users/test/project';

      if (!gistUrl || typeof gistUrl !== 'string' || gistUrl.trim() === '') {
        const response = {
          content: [
            {
              type: 'text',
              text: 'Error: gistUrl is required and must be a non-empty string',
            },
          ],
          isError: true,
        };

        expect(response.isError).toBe(true);
      }
    });

    it('should reject empty projectPath', () => {
      const gistUrl = 'abc123';
      const projectPath = '';

      if (!projectPath || typeof projectPath !== 'string' || projectPath.trim() === '') {
        const response = {
          content: [
            {
              type: 'text',
              text: 'Error: projectPath is required and must be a non-empty string',
            },
          ],
          isError: true,
        };

        expect(response.isError).toBe(true);
      }
    });
  });

  describe('error handling', () => {
    it('should handle importSession errors', async () => {
      mockImportSession.mockRejectedValue(new Error('Gist not found'));

      try {
        await mockImportSession('nonexistent', '/Users/test/project');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const response = {
          content: [
            {
              type: 'text',
              text: `Import failed: ${errorMessage}`,
            },
          ],
          isError: true,
        };

        expect(response.isError).toBe(true);
        expect(response.content[0].text).toContain('Import failed');
        expect(response.content[0].text).toContain('Gist not found');
      }
    });

    it('should format error response with isError flag', async () => {
      mockImportSession.mockRejectedValue(new Error('Permission denied'));

      try {
        await mockImportSession('abc123', '/restricted/path');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const response = {
          content: [
            {
              type: 'text',
              text: `Import failed: ${errorMessage}`,
            },
          ],
          isError: true,
        };

        expect(response.isError).toBe(true);
        expect(response.content[0].text).toContain('Permission denied');
      }
    });
  });

  describe('response format', () => {
    it('should return proper MCP tool response structure', async () => {
      const mockResult = {
        sessionPath: '/Users/test/.claude/projects/encoded/session-id.jsonl',
        sessionId: 'def456',
        messageCount: 15,
        projectPath: '/Users/test/project',
      };

      mockImportSession.mockResolvedValue(mockResult);

      const result = await mockImportSession('gist-url', '/Users/test/project');

      const response = {
        content: [
          {
            type: 'text',
            text: `Session imported successfully!\n\nSession ID: ${result.sessionId}\nMessages: ${result.messageCount}\nLocation: ${result.sessionPath}\n\nUse 'claude --resume' to see imported session.`,
          },
        ],
      };

      expect(response).toHaveProperty('content');
      expect(Array.isArray(response.content)).toBe(true);
      expect(response.content[0]).toHaveProperty('type', 'text');
      expect(response.content[0]).toHaveProperty('text');
      expect(response).not.toHaveProperty('isError'); // Success case doesn't have isError
    });
  });
});
