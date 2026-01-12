/**
 * Path encoding utilities for Claude Code session directories
 *
 * Claude Code stores sessions in ~/.claude/projects/{encodedPath}/
 * where paths are encoded by replacing `/` with `-` and removing leading `-`
 *
 * Example: /Users/name/project -> Users-name-project
 */

import { homedir } from 'os';
import { join } from 'path';

/**
 * Encodes an absolute project path into Claude Code's directory naming format
 *
 * @param absolutePath - Absolute file system path (e.g., "/Users/name/project")
 * @returns Encoded directory name (e.g., "Users-name-project")
 *
 * @example
 * encodeProjectPath('/Users/name/my-project')
 * // Returns: 'Users-name-my-project'
 */
export function encodeProjectPath(absolutePath: string): string {
  // Replace all forward slashes with dashes
  const encoded = absolutePath.replace(/\//g, '-');

  // Remove leading dash (from root /)
  return encoded.startsWith('-') ? encoded.slice(1) : encoded;
}

/**
 * Decodes a Claude Code directory name back to an absolute path
 *
 * @param encodedName - Encoded directory name (e.g., "Users-name-project")
 * @returns Decoded absolute path (e.g., "/Users/name/project")
 *
 * @example
 * decodeProjectPath('Users-name-my-project')
 * // Returns: '/Users/name/my-project'
 */
export function decodeProjectPath(encodedName: string): string {
  // Replace all dashes with forward slashes and add leading slash
  return '/' + encodedName.replace(/-/g, '/');
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
