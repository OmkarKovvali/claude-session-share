/**
 * Path encoding utilities for Claude Code session directories
 *
 * Claude Code stores sessions in ~/.claude/projects/{encodedPath}/
 * where paths are encoded by:
 * 1. Replacing `/` with `-` (keeps leading dash from root /)
 * 2. Replacing `_` with `-` (underscores become hyphens)
 *
 * Example: /Users/name/my_project -> -Users-name-my-project
 */

import { homedir } from 'os';
import { join } from 'path';

/**
 * Encodes an absolute project path into Claude Code's directory naming format
 *
 * @param absolutePath - Absolute file system path (e.g., "/Users/name/my_project")
 * @returns Encoded directory name (e.g., "-Users-name-my-project")
 *
 * @example
 * encodeProjectPath('/Users/name/my_project')
 * // Returns: '-Users-name-my-project'
 */
export function encodeProjectPath(absolutePath: string): string {
  // Replace all forward slashes with dashes (keep leading dash)
  // Replace all underscores with dashes (Claude Code normalizes to hyphens)
  return absolutePath.replace(/\//g, '-').replace(/_/g, '-');
}

/**
 * Decodes a Claude Code directory name back to an absolute path
 *
 * Note: This is a best-effort decode since both `/` and `_` encode to `-`.
 * The result will have all `-` converted to `/`, which works for path lookup
 * but may not preserve original underscores in folder names.
 *
 * @param encodedName - Encoded directory name (e.g., "-Users-name-project")
 * @returns Decoded absolute path (e.g., "/Users/name/project")
 *
 * @example
 * decodeProjectPath('-Users-name-my-project')
 * // Returns: '/Users/name/my/project'
 */
export function decodeProjectPath(encodedName: string): string {
  // Replace all dashes with forward slashes
  // The leading dash becomes the root /
  return encodedName.replace(/-/g, '/');
}

/**
 * Gets the full session directory path for a project
 *
 * @param projectPath - Absolute project path
 * @returns Full path to ~/.claude/projects/{encodedPath}
 *
 * @example
 * getSessionDirectory('/Users/name/my-project')
 * // Returns: '/Users/name/.claude/projects/Users-name-my-project'
 */
export function getSessionDirectory(projectPath: string): string {
  const encoded = encodeProjectPath(projectPath);
  return join(homedir(), '.claude', 'projects', encoded);
}
