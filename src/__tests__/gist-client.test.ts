/**
 * Tests for GitHub Gist client authentication and initialization
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GistClient, GistAuthError, GistApiError } from '../gist/client.js';

describe('GistClient', () => {
  let originalToken: string | undefined;

  beforeEach(() => {
    // Save original token
    originalToken = process.env.GITHUB_TOKEN;
  });

  afterEach(() => {
    // Restore original token
    if (originalToken) {
      process.env.GITHUB_TOKEN = originalToken;
    } else {
      delete process.env.GITHUB_TOKEN;
    }
  });

  describe('initialization', () => {
    it('should initialize successfully with valid GITHUB_TOKEN', () => {
      process.env.GITHUB_TOKEN = 'ghp_test_token_1234567890';

      expect(() => new GistClient()).not.toThrow();
    });

    it('should throw GistAuthError when GITHUB_TOKEN is missing', () => {
      delete process.env.GITHUB_TOKEN;

      expect(() => new GistClient()).toThrow(GistAuthError);
      expect(() => new GistClient()).toThrow(
        /GITHUB_TOKEN environment variable is required/
      );
    });

    it('should provide helpful error message with token setup instructions', () => {
      delete process.env.GITHUB_TOKEN;

      try {
        new GistClient();
        expect.fail('Should have thrown GistAuthError');
      } catch (error) {
        expect(error).toBeInstanceOf(GistAuthError);
        expect((error as Error).message).toContain('https://github.com/settings/tokens');
        expect((error as Error).message).toContain('gist');
      }
    });

    it('should initialize Octokit with authentication', () => {
      process.env.GITHUB_TOKEN = 'ghp_test_token_1234567890';

      const client = new GistClient();
      const octokit = client.getOctokit();

      expect(octokit).toBeDefined();
    });
  });

  describe('throttling configuration', () => {
    it('should configure rate limit handling', () => {
      process.env.GITHUB_TOKEN = 'ghp_test_token_1234567890';

      // Just verify initialization doesn't throw
      // Actual throttling behavior is tested via Octokit's own tests
      expect(() => new GistClient()).not.toThrow();
    });
  });

  describe('createGist', () => {
    beforeEach(() => {
      process.env.GITHUB_TOKEN = 'ghp_test_token_1234567890';
    });

    it('should create a secret gist successfully', async () => {
      const client = new GistClient();
      const octokit = client.getOctokit();

      // Mock the gists.create method
      const mockCreate = vi.fn().mockResolvedValue({
        data: {
          id: 'abc123',
          url: 'https://api.github.com/gists/abc123',
          html_url: 'https://gist.github.com/abc123',
          files: {
            'test.txt': {
              filename: 'test.txt',
              type: 'text/plain',
              language: 'Text',
              raw_url: 'https://gist.githubusercontent.com/raw/abc123/test.txt',
              size: 11,
              content: 'Hello World',
            },
          },
          public: false,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          description: 'Test gist',
        },
      });

      octokit.rest.gists.create = mockCreate as any;

      const result = await client.createGist('Test gist', {
        'test.txt': 'Hello World',
      });

      expect(result.id).toBe('abc123');
      expect(result.html_url).toBe('https://gist.github.com/abc123');
      expect(result.public).toBe(false);
      expect(result.description).toBe('Test gist');
      expect(result.files['test.txt']).toBeDefined();

      // Verify it was called with public: false (secret gist)
      expect(mockCreate).toHaveBeenCalledWith({
        description: 'Test gist',
        public: false,
        files: {
          'test.txt': { content: 'Hello World' },
        },
      });
    });

    it('should handle multiple files', async () => {
      const client = new GistClient();
      const octokit = client.getOctokit();

      const mockCreate = vi.fn().mockResolvedValue({
        data: {
          id: 'abc123',
          url: 'https://api.github.com/gists/abc123',
          html_url: 'https://gist.github.com/abc123',
          files: {
            'file1.txt': { content: 'Content 1' },
            'file2.txt': { content: 'Content 2' },
          },
          public: false,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          description: 'Multi-file gist',
        },
      });

      octokit.rest.gists.create = mockCreate as any;

      await client.createGist('Multi-file gist', {
        'file1.txt': 'Content 1',
        'file2.txt': 'Content 2',
      });

      expect(mockCreate).toHaveBeenCalledWith({
        description: 'Multi-file gist',
        public: false,
        files: {
          'file1.txt': { content: 'Content 1' },
          'file2.txt': { content: 'Content 2' },
        },
      });
    });

    it('should throw GistAuthError on 401 (invalid token)', async () => {
      const client = new GistClient();
      const octokit = client.getOctokit();

      octokit.rest.gists.create = vi.fn().mockRejectedValue({
        status: 401,
        message: 'Bad credentials',
      }) as any;

      await expect(
        client.createGist('Test', { 'test.txt': 'content' })
      ).rejects.toThrow(GistAuthError);

      await expect(
        client.createGist('Test', { 'test.txt': 'content' })
      ).rejects.toThrow(/Invalid GITHUB_TOKEN/);
    });

    it('should throw GistApiError on 403 (permission denied)', async () => {
      const client = new GistClient();
      const octokit = client.getOctokit();

      octokit.rest.gists.create = vi.fn().mockRejectedValue({
        status: 403,
        message: 'Forbidden',
      }) as any;

      await expect(
        client.createGist('Test', { 'test.txt': 'content' })
      ).rejects.toThrow(GistApiError);

      await expect(
        client.createGist('Test', { 'test.txt': 'content' })
      ).rejects.toThrow(/Permission denied/);
    });

    it('should throw GistApiError on 403 rate limit', async () => {
      const client = new GistClient();
      const octokit = client.getOctokit();

      octokit.rest.gists.create = vi.fn().mockRejectedValue({
        status: 403,
        message: 'API rate limit exceeded',
      }) as any;

      await expect(
        client.createGist('Test', { 'test.txt': 'content' })
      ).rejects.toThrow(GistApiError);

      await expect(
        client.createGist('Test', { 'test.txt': 'content' })
      ).rejects.toThrow(/rate limit exceeded/);
    });

    it('should throw GistApiError on 422 (validation error)', async () => {
      const client = new GistClient();
      const octokit = client.getOctokit();

      octokit.rest.gists.create = vi.fn().mockRejectedValue({
        status: 422,
        message: 'Validation Failed',
      }) as any;

      await expect(
        client.createGist('Test', { 'test.txt': 'content' })
      ).rejects.toThrow(GistApiError);

      await expect(
        client.createGist('Test', { 'test.txt': 'content' })
      ).rejects.toThrow(/Invalid gist data/);
    });

    it('should throw GistApiError on other errors', async () => {
      const client = new GistClient();
      const octokit = client.getOctokit();

      octokit.rest.gists.create = vi.fn().mockRejectedValue({
        status: 500,
        message: 'Internal Server Error',
      }) as any;

      await expect(
        client.createGist('Test', { 'test.txt': 'content' })
      ).rejects.toThrow(GistApiError);

      await expect(
        client.createGist('Test', { 'test.txt': 'content' })
      ).rejects.toThrow(/Failed to create gist/);
    });
  });
});
