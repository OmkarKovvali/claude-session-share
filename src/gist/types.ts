/**
 * TypeScript types for GitHub Gist operations
 *
 * These types represent the structure of Gist API responses
 * and request payloads for creating and reading gists.
 */

/**
 * File content in a Gist
 */
export interface GistFile {
  filename: string;
  type: string;
  language: string | null;
  raw_url: string;
  size: number;
  truncated?: boolean;
  content?: string;
}

/**
 * Response from creating or reading a Gist
 */
export interface GistResponse {
  id: string;
  url: string;
  html_url: string;
  files: Record<string, GistFile>;
  public: boolean;
  created_at: string;
  updated_at: string;
  description: string;
}

/**
 * Input for creating a Gist file
 */
export interface GistFileInput {
  content: string;
}

/**
 * Input for creating a Gist
 */
export interface CreateGistInput {
  description: string;
  public: boolean;
  files: Record<string, GistFileInput>;
}
