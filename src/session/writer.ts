/**
 * Session writer for local JSONL storage
 *
 * Writes session messages to Claude Code's local storage format:
 * ~/.claude/projects/{encodedPath}/{sessionId}.jsonl
 *
 * Uses atomic file writes and handles filesystem errors gracefully.
 */

import { mkdir, writeFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { homedir } from 'os';
import type { SessionMessage } from './types.js';
import { encodeProjectPath } from '../utils/path-encoding.js';

/**
 * Error thrown when session writing fails
 */
export class SessionWriteError extends Error {
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'SessionWriteError';
  }
}

/**
 * Result of writing a session to local storage
 */
export interface WriteSessionResult {
  /** Full path to the written session file */
  filePath: string;
  /** The session ID used for the filename */
  sessionId: string;
}

/**
 * Write session messages to local Claude Code storage
 *
 * Creates a new session file in ~/.claude/projects/{encodedPath}/{sessionId}.jsonl
 * with JSONL format (one JSON object per line).
 *
 * @param messages - Array of session messages to write
 * @param projectPath - Absolute path to the project (e.g., "/Users/name/project")
 * @returns Promise resolving to written file path and session ID
 * @throws {SessionWriteError} If writing fails (permissions, disk space, etc.)
 *
 * @example
 * const result = await writeSessionToLocal(messages, '/Users/name/my-project');
 * console.log(`Written to: ${result.filePath}`);
 */
export async function writeSessionToLocal(
  messages: SessionMessage[],
  projectPath: string
): Promise<WriteSessionResult> {
  try {
    // 1. Encode project path for directory name
    const encodedPath = encodeProjectPath(projectPath);

    // 2. Generate new session ID for filename
    // Note: Messages already have remapped sessionIds in their fields,
    // but the filename needs its own unique ID
    const sessionId = randomUUID();

    // 3. Build target directory and file paths
    const sessionDirectory = join(homedir(), '.claude', 'projects', encodedPath);
    const targetPath = join(sessionDirectory, `${sessionId}.jsonl`);

    // 4. Create directory structure (handles missing ~/.claude/projects/ gracefully)
    await mkdir(sessionDirectory, { recursive: true });

    // 5. Format as JSONL: one JSON object per line with trailing newline
    const jsonlContent = messages.map((msg) => JSON.stringify(msg)).join('\n') + '\n';

    // 6. Write file atomically
    await writeFile(targetPath, jsonlContent, { encoding: 'utf-8' });

    // 7. Return written file path and session ID for verification
    return {
      filePath: targetPath,
      sessionId,
    };
  } catch (error: any) {
    // Handle filesystem errors with descriptive messages
    if (error.code === 'EACCES') {
      throw new SessionWriteError(
        `Permission denied: Cannot write to session directory. Check permissions for ~/.claude/projects/`,
        error.code
      );
    }

    if (error.code === 'ENOSPC') {
      throw new SessionWriteError(
        `Disk full: Not enough space to write session file`,
        error.code
      );
    }

    // Generic error
    throw new SessionWriteError(
      `Failed to write session: ${error.message || 'Unknown error'}`,
      error.code
    );
  }
}
