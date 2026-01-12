/**
 * Streaming JSONL reader for Claude Code session files
 *
 * Provides memory-efficient line-by-line reading with error recovery.
 * Handles large session files without loading entire content into memory.
 */

import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import type { SessionMessage } from './types.js';

/**
 * Reads session file line-by-line using async generator
 *
 * Streams the file efficiently, yielding non-empty lines.
 * Handles CRLF line endings automatically.
 *
 * @param filePath - Absolute path to session JSONL file
 * @yields Non-empty lines from the file
 *
 * @example
 * for await (const line of readSessionLines('/path/to/session.jsonl')) {
 *   console.log(line);
 * }
 */
export async function* readSessionLines(filePath: string): AsyncGenerator<string> {
  // Create read stream with UTF-8 encoding
  const fileStream = createReadStream(filePath, { encoding: 'utf-8' });

  // Create readline interface for line-by-line reading
  // crlfDelay: Infinity handles both \n and \r\n line endings
  const rl = createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  // Yield each non-empty line
  for await (const line of rl) {
    const trimmedLine = line.trim();
    if (trimmedLine) {
      yield trimmedLine;
    }
  }
}

/**
 * Checks if a parsed object has required session message fields
 *
 * @param obj - Parsed JSON object
 * @returns true if object has required fields (type, uuid, sessionId)
 */
function hasRequiredFields(obj: unknown): obj is { type: string; uuid: string; sessionId: string } {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'type' in obj &&
    'uuid' in obj &&
    'sessionId' in obj &&
    typeof (obj as { type: unknown }).type === 'string' &&
    typeof (obj as { uuid: unknown }).uuid === 'string' &&
    typeof (obj as { sessionId: unknown }).sessionId === 'string'
  );
}

/**
 * Parses a session JSONL file with error recovery
 *
 * Reads the file line-by-line, parsing each line as JSON.
 * Continues processing even if individual lines fail to parse.
 * Skips lines missing required fields (type, uuid, sessionId).
 *
 * @param filePath - Absolute path to session JSONL file
 * @returns Array of successfully parsed session messages
 *
 * @example
 * const messages = await parseSessionFile('/path/to/session.jsonl');
 * console.log(`Loaded ${messages.length} messages`);
 */
export async function parseSessionFile(filePath: string): Promise<SessionMessage[]> {
  const messages: SessionMessage[] = [];
  let lineNumber = 0;

  try {
    // Process each line from the file
    for await (const line of readSessionLines(filePath)) {
      lineNumber++;

      try {
        // Parse JSON - this is wrapped per line for error recovery
        const parsed = JSON.parse(line);

        // Validate required fields exist
        if (!hasRequiredFields(parsed)) {
          console.warn(
            `[reader] Line ${lineNumber}: Skipping message missing required fields (type, uuid, sessionId)`
          );
          continue;
        }

        // Type assertion is safe after validation
        messages.push(parsed as SessionMessage);
      } catch (parseError) {
        // Log warning but continue processing remaining lines
        console.warn(
          `[reader] Line ${lineNumber}: Failed to parse JSON - ${parseError instanceof Error ? parseError.message : String(parseError)}`
        );
        continue;
      }
    }
  } catch (fileError) {
    // This catches file-level errors (file not found, permission denied, etc.)
    console.error(
      `[reader] Error reading file ${filePath}: ${fileError instanceof Error ? fileError.message : String(fileError)}`
    );
    throw fileError;
  }

  return messages;
}
