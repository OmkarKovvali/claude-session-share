/**
 * Session-to-Gist upload service
 *
 * Orchestrates the complete workflow of uploading a Claude Code session to GitHub Gist:
 * 1. Read session messages
 * 2. Sanitize for privacy
 * 3. Convert to JSONL format
 * 4. Extract metadata
 * 5. Upload to Gist
 */

import { parseSessionFile } from '../session/reader.js';
import { extractMetadata } from '../session/metadata.js';
import { sanitizeSession, inferBasePath } from '../sanitization/pipeline.js';
import { GistClient } from '../gist/client.js';

/**
 * Upload a session file to GitHub Gist
 *
 * Performs full sanitization pipeline and uploads to secret (unlisted) Gist.
 *
 * @param sessionPath - Absolute path to session JSONL file
 * @returns Promise resolving to Gist URL
 * @throws Error if any step fails (reading, sanitizing, uploading)
 *
 * @example
 * const url = await uploadSession('/Users/name/.claude/projects/abc/session.jsonl');
 * console.log(`Shared at: ${url}`);
 */
export async function uploadSession(sessionPath: string): Promise<string> {
  try {
    // Step 1: Read session messages
    const messages = await parseSessionFile(sessionPath);

    if (messages.length === 0) {
      throw new Error('Session file is empty or contains no valid messages');
    }

    // Step 2: Sanitize session for privacy
    const basePath = inferBasePath(messages);
    const sanitizedMessages = sanitizeSession(messages, basePath);

    // Step 3: Convert sanitized messages to JSONL string
    const sessionJsonl = sanitizedMessages.map(msg => JSON.stringify(msg)).join('\n');

    // Step 4: Extract metadata for gist description and metadata file
    const metadata = extractMetadata(sanitizedMessages);

    if (!metadata) {
      throw new Error('Failed to extract session metadata');
    }

    // Step 5: Upload to Gist
    const gistClient = new GistClient();

    // Use metadata title if available, fallback to timestamp-based title
    const description = metadata.projectPath && metadata.projectPath !== 'unknown'
      ? `Claude Code Session - ${metadata.projectPath.split('/').pop()}`
      : `Claude Code Session - ${new Date(metadata.firstTimestamp).toISOString()}`;

    const response = await gistClient.createGist(description, {
      'session.jsonl': sessionJsonl,
      'metadata.json': JSON.stringify(metadata, null, 2),
    });

    return response.html_url;
  } catch (error) {
    // Add context to errors for better debugging
    if (error instanceof Error) {
      throw new Error(`Failed to upload session: ${error.message}`);
    }
    throw new Error(`Failed to upload session: ${String(error)}`);
  }
}
