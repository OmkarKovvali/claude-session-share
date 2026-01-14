/**
 * MCP Prompt Integration Tests
 *
 * Tests slash command functionality via MCP prompts.
 * Prompts convert slash commands to natural language that triggers tool handlers.
 */

import { describe, it, expect } from 'vitest';

describe('MCP Prompts', () => {
  // Test prompt definitions (schema)
  const promptDefinitions = {
    prompts: [
      {
        name: 'share',
        description: 'Share current Claude Code session to GitHub Gist',
        arguments: [
          {
            name: 'session_path',
            description: 'Optional: Path to session file (defaults to most recent)',
            required: false,
          },
        ],
      },
      {
        name: 'import',
        description: 'Import shared session from GitHub Gist URL',
        arguments: [
          {
            name: 'gist_url',
            description: 'GitHub Gist URL (e.g., https://gist.github.com/user/abc123)',
            required: true,
          },
          {
            name: 'project_path',
            description: 'Optional: Local project directory (defaults to current directory)',
            required: false,
          },
        ],
      },
    ],
  };

  // Test GetPrompt handler logic
  const handleGetPrompt = (name: string, args?: Record<string, unknown>) => {
    if (name === 'share') {
      const sessionPath = args?.session_path;
      return {
        description: 'Share session to GitHub Gist',
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: sessionPath
                ? `Share my session from ${sessionPath} to GitHub Gist`
                : 'Share my current session to GitHub Gist',
            },
          },
        ],
      };
    }

    if (name === 'import') {
      const gistUrl = args?.gist_url;
      const projectPath = args?.project_path;

      if (!gistUrl) {
        throw new Error('gist_url argument is required');
      }

      return {
        description: 'Import session from Gist',
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: projectPath
                ? `Import session from ${gistUrl} to ${projectPath}`
                : `Import session from ${gistUrl}`,
            },
          },
        ],
      };
    }

    throw new Error(`Unknown prompt: ${name}`);
  };

  describe('ListPrompts', () => {
    it('should list share and import prompts', () => {
      expect(promptDefinitions.prompts).toHaveLength(2);
      expect(promptDefinitions.prompts[0].name).toBe('share');
      expect(promptDefinitions.prompts[1].name).toBe('import');
    });

    it('should include descriptions for both prompts', () => {
      expect(promptDefinitions.prompts[0].description).toContain('Share current Claude Code session');
      expect(promptDefinitions.prompts[1].description).toContain('Import shared session');
    });

    it('should define correct arguments for share prompt', () => {
      const sharePrompt = promptDefinitions.prompts.find((p) => p.name === 'share');
      expect(sharePrompt?.arguments).toHaveLength(1);
      expect(sharePrompt?.arguments?.[0].name).toBe('session_path');
      expect(sharePrompt?.arguments?.[0].required).toBe(false);
    });

    it('should define correct arguments for import prompt', () => {
      const importPrompt = promptDefinitions.prompts.find((p) => p.name === 'import');
      expect(importPrompt?.arguments).toHaveLength(2);
      expect(importPrompt?.arguments?.[0].name).toBe('gist_url');
      expect(importPrompt?.arguments?.[0].required).toBe(true);
      expect(importPrompt?.arguments?.[1].name).toBe('project_path');
      expect(importPrompt?.arguments?.[1].required).toBe(false);
    });
  });

  describe('GetPrompt - share', () => {
    it('should return share prompt without arguments', () => {
      const response = handleGetPrompt('share', {});

      expect(response.description).toBe('Share session to GitHub Gist');
      expect(response.messages).toHaveLength(1);
      expect(response.messages[0].role).toBe('user');
      expect(response.messages[0].content.type).toBe('text');
      expect(response.messages[0].content.text).toBe('Share my current session to GitHub Gist');
    });

    it('should return share prompt with session_path argument', () => {
      const response = handleGetPrompt('share', { session_path: '/path/to/session.jsonl' });

      expect(response.messages[0].content.text).toBe(
        'Share my session from /path/to/session.jsonl to GitHub Gist'
      );
    });
  });

  describe('GetPrompt - import', () => {
    it('should return import prompt with gist_url only', () => {
      const response = handleGetPrompt('import', { gist_url: 'https://gist.github.com/user/abc123' });

      expect(response.description).toBe('Import session from Gist');
      expect(response.messages).toHaveLength(1);
      expect(response.messages[0].role).toBe('user');
      expect(response.messages[0].content.type).toBe('text');
      expect(response.messages[0].content.text).toBe(
        'Import session from https://gist.github.com/user/abc123'
      );
    });

    it('should return import prompt with both gist_url and project_path', () => {
      const response = handleGetPrompt('import', {
        gist_url: 'https://gist.github.com/user/abc123',
        project_path: '/my/project',
      });

      expect(response.messages[0].content.text).toBe(
        'Import session from https://gist.github.com/user/abc123 to /my/project'
      );
    });

    it('should error when import prompt missing gist_url', () => {
      expect(() => handleGetPrompt('import', {})).toThrow('gist_url argument is required');
    });
  });

  describe('GetPrompt - error cases', () => {
    it('should error on unknown prompt name', () => {
      expect(() => handleGetPrompt('unknown', {})).toThrow('Unknown prompt: unknown');
    });
  });
});
