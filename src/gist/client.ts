/**
 * GitHub Gist client for creating and managing secret gists
 *
 * Uses Octokit v5 with automatic rate limiting and retry handling.
 * Requires GITHUB_TOKEN environment variable for authentication.
 */

import { Octokit } from 'octokit';
import type { GistResponse } from './types.js';

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

  /**
   * Create a secret (unlisted) gist with the provided files
   *
   * @param description - Description of the gist
   * @param files - Object mapping filenames to file content
   * @returns Promise resolving to GistResponse with gist URL, ID, and files
   * @throws {GistAuthError} If token is invalid (401)
   * @throws {GistApiError} If API request fails (403, 422, or other errors)
   */
  async createGist(
    description: string,
    files: Record<string, string>
  ): Promise<GistResponse> {
    try {
      // Convert files object to Gist API format
      const gistFiles: Record<string, { content: string }> = {};
      for (const [filename, content] of Object.entries(files)) {
        gistFiles[filename] = { content };
      }

      // Create secret gist (public: false makes it unlisted)
      const response = await this.octokit.rest.gists.create({
        description,
        public: false,
        files: gistFiles,
      });

      // Map response to our GistResponse type
      return {
        id: response.data.id!,
        url: response.data.url!,
        html_url: response.data.html_url!,
        files: response.data.files as Record<string, any>,
        public: response.data.public!,
        created_at: response.data.created_at!,
        updated_at: response.data.updated_at!,
        description: response.data.description || '',
      };
    } catch (error: any) {
      // Handle authentication errors
      if (error.status === 401) {
        throw new GistAuthError(
          'Invalid GITHUB_TOKEN. Please check that your token is valid and has the "gist" scope. ' +
          'Create a new token at https://github.com/settings/tokens'
        );
      }

      // Handle permission/rate limit errors
      if (error.status === 403) {
        const message = error.message || 'Forbidden';
        if (message.toLowerCase().includes('rate limit')) {
          throw new GistApiError(
            'GitHub API rate limit exceeded. Please wait and try again later.',
            403
          );
        }
        throw new GistApiError(
          'Permission denied. Ensure your GITHUB_TOKEN has the "gist" scope.',
          403
        );
      }

      // Handle validation errors
      if (error.status === 422) {
        throw new GistApiError(
          `Invalid gist data: ${error.message || 'Validation failed'}`,
          422
        );
      }

      // Handle other errors
      throw new GistApiError(
        `Failed to create gist: ${error.message || 'Unknown error'}`,
        error.status
      );
    }
  }
}
