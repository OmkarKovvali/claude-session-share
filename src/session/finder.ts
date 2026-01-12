/**
 * Session file discovery for Claude Code projects
 *
 * Finds all session JSONL files (main and agent) for a given project path.
 * Uses Claude Code's path encoding scheme to locate session directories.
 */

import { readdir } from 'fs/promises';
import { join } from 'path';
import { getSessionDirectory } from '../utils/path-encoding.js';
import type { SessionFile } from './types.js';

/**
 * Finds all session files for a project
 *
 * Discovers both main session files (uuid.jsonl) and agent session files
 * (agent-uuid.jsonl) in the project's session directory.
 *
 * @param projectPath - Absolute path to the project
 * @returns Array of session files with metadata
 * @throws Error if home directory cannot be determined
 *
 * @example
 * const sessions = await findSessionFiles('/Users/name/project');
 * // Returns: [
 * //   { path: '/Users/name/.claude/projects/Users-name-project/abc-123.jsonl',
 * //     sessionId: 'abc-123', isAgent: false },
 * //   { path: '/Users/name/.claude/projects/Users-name-project/agent-def-456.jsonl',
 * //     sessionId: 'def-456', isAgent: true }
 * // ]
 */
export async function findSessionFiles(projectPath: string): Promise<SessionFile[]> {
  // Get home directory
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  if (!homeDir) {
    throw new Error('Cannot determine home directory: HOME and USERPROFILE environment variables not set');
  }

  // Get the encoded session directory path
  const sessionDir = getSessionDirectory(projectPath);

  try {
    // List all files in the session directory
    const files = await readdir(sessionDir);

    // Filter and map to SessionFile objects
    return files
      .filter(filename => filename.endsWith('.jsonl'))
      .map(filename => {
        // Detect agent sessions by filename prefix
        const isAgent = filename.startsWith('agent-');

        // Extract session ID: remove 'agent-' prefix if present, then remove '.jsonl' extension
        const sessionId = isAgent
          ? filename.replace('agent-', '').replace('.jsonl', '')
          : filename.replace('.jsonl', '');

        return {
          path: join(sessionDir, filename),
          sessionId,
          isAgent,
        };
      });
  } catch (error) {
    // Handle missing directory gracefully - not an error if project has no sessions yet
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return [];
    }

    // Re-throw other errors (permission denied, etc.)
    throw error;
  }
}
