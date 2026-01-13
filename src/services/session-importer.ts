/**
 * Session import service
 *
 * Orchestrates the complete workflow of importing a Claude Code session from GitHub Gist:
 * 1. Fetch gist content
 * 2. Extract session JSONL
 * 3. Parse messages with error recovery
 * 4. Remap UUIDs to avoid conflicts
 * 5. Write to local storage
 */

import { GistClient } from '../gist/client.js';
import { UUIDMapper } from '../utils/uuid-mapper.js';
import { writeSessionToLocal } from '../session/writer.js';
import type { SessionMessage } from '../session/types.js';

/**
 * Result of importing a session
 */
export interface ImportResult {
  /** Full path to the imported session file */
  sessionPath: string;
  /** The session ID used for the filename */
  sessionId: string;
  /** Number of messages successfully imported */
  messageCount: number;
  /** Project path where session was imported */
  projectPath: string;
}

/**
 * Import a session from GitHub Gist
 *
 * Fetches a shared session gist, remaps UUIDs, and writes to local storage.
 * Includes error recovery for malformed messages (logs and continues).
 *
 * @param gistIdOrUrl - GitHub Gist URL or bare gist ID
 * @param projectPath - Local project directory path (e.g., "/Users/name/project")
 * @returns Promise resolving to import result with session path and metadata
 * @throws Error if gist not found, no JSONL file, or write fails
 *
 * @example
 * const result = await importSession('https://gist.github.com/user/abc123', '/Users/name/project');
 * console.log(`Imported ${result.messageCount} messages to ${result.sessionPath}`);
 */
export async function importSession(
  gistIdOrUrl: string,
  projectPath: string
): Promise<ImportResult> {
  try {
    // Step 1: Initialize GistClient (validates GITHUB_TOKEN)
    const gistClient = new GistClient();

    // Step 2: Fetch gist content
    const gist = await gistClient.fetchGist(gistIdOrUrl);

    // Step 3: Extract session JSONL file
    // Look for file with .jsonl extension
    const jsonlFileName = Object.keys(gist.files).find((name) =>
      name.endsWith('.jsonl')
    );

    if (!jsonlFileName) {
      throw new Error(
        'No JSONL file found in gist. Expected a .jsonl file containing session messages.'
      );
    }

    const jsonlFile = gist.files[jsonlFileName];
    if (!jsonlFile || !jsonlFile.content) {
      throw new Error(
        `JSONL file "${jsonlFileName}" has no content. The gist may be malformed.`
      );
    }

    const jsonlContent = jsonlFile.content;

    // Step 4: Parse messages with per-line error recovery
    const messages: SessionMessage[] = [];
    const lines = jsonlContent.split('\n').filter((line) => line.trim());
    let parseErrors = 0;

    for (const [index, line] of lines.entries()) {
      try {
        const message = JSON.parse(line) as SessionMessage;
        messages.push(message);
      } catch (error) {
        // Log error but continue parsing remaining lines
        parseErrors++;
        console.warn(
          `Failed to parse message at line ${index + 1}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }

    if (messages.length === 0) {
      throw new Error(
        `No valid messages found in JSONL file. Parse errors: ${parseErrors}`
      );
    }

    // Log parse errors if any occurred
    if (parseErrors > 0) {
      console.warn(
        `Imported ${messages.length} messages with ${parseErrors} parse errors`
      );
    }

    // Step 5: Remap UUIDs to avoid conflicts
    const mapper = new UUIDMapper();
    const remappedMessages = messages.map((msg) => mapper.remapMessage(msg));

    // Step 6: Write to local storage
    const result = await writeSessionToLocal(remappedMessages, projectPath);

    // Step 7: Return import result
    return {
      sessionPath: result.filePath,
      sessionId: result.sessionId,
      messageCount: remappedMessages.length,
      projectPath,
    };
  } catch (error) {
    // Add context to errors for better debugging
    if (error instanceof Error) {
      throw new Error(`Failed to import session: ${error.message}`);
    }
    throw new Error(`Failed to import session: ${String(error)}`);
  }
}
