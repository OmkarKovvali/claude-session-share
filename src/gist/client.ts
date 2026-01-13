/**
 * GitHub Gist client for creating and managing secret gists
 *
 * Uses Octokit v5 with automatic rate limiting and retry handling.
 * Requires GITHUB_TOKEN environment variable for authentication.
 */

import { Octokit } from 'octokit';

/**
 * Error thrown when GITHUB_TOKEN is missing or invalid
 */
export class GistAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GistAuthError';
  }
}

/**
 * Error thrown when Gist API operations fail
 */
export class GistApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = 'GistApiError';
  }
}

/**
 * Authenticated GitHub Gist client
 *
 * Handles authentication, rate limiting, and error handling for GitHub Gist operations.
 */
export class GistClient {
  private octokit: Octokit;

  constructor() {
    const token = process.env.GITHUB_TOKEN;

    if (!token) {
      throw new GistAuthError(
        'GITHUB_TOKEN environment variable is required. ' +
        'Create a personal access token at https://github.com/settings/tokens with "gist" scope.'
      );
    }

    // Initialize Octokit with authentication and throttling
    this.octokit = new Octokit({
      auth: token,
      throttle: {
        onRateLimit: (retryAfter: number, options: any, octokit: Octokit, retryCount: number) => {
          // Retry up to 3 times on primary rate limits
          console.warn(
            `Rate limit hit for ${options.method} ${options.url}. ` +
            `Retrying after ${retryAfter} seconds (attempt ${retryCount + 1}/3)`
          );
          return retryCount < 3;
        },
        onSecondaryRateLimit: (retryAfter: number, options: any, octokit: Octokit) => {
          // Always retry secondary rate limits (abuse detection)
          console.warn(
            `Secondary rate limit hit for ${options.method} ${options.url}. ` +
            `Retrying after ${retryAfter} seconds`
          );
          return true;
        },
      },
    });
  }

  /**
   * Get the authenticated Octokit instance
   * @internal Used for testing
   */
  getOctokit(): Octokit {
    return this.octokit;
  }
}
