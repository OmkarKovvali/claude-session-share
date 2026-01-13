/**
 * Tests for GitHub Gist client authentication and initialization
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GistClient, GistAuthError } from '../gist/client.js';

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
});
