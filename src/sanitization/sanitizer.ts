/**
 * Session sanitization utilities for privacy protection
 *
 * Removes sensitive data before sharing:
 * - Strips thinking blocks from assistant messages
 * - Sanitizes absolute paths to relative paths
 * - Immutable transformations (returns new objects)
 */

import * as path from 'node:path';
import type { AssistantMessage, UserMessage, FileHistorySnapshot } from '../session/types.js';

/**
 * Sanitize assistant message by stripping thinking and sanitizing paths in tool results
 */
export function sanitizeAssistantMessage(
  msg: AssistantMessage,
  basePath: string
): AssistantMessage {
  return {
    ...msg,
    snapshot: {
      thinking: null, // Strip thinking block
      messages: msg.snapshot.messages.map((m) => ({
        ...m,
        content: sanitizePathsInContent(m.content, basePath),
      })),
    },
  };
}

/**
 * Sanitize user message by converting absolute cwd to relative path
 */
export function sanitizeUserMessage(msg: UserMessage, basePath: string): UserMessage {
  return {
    ...msg,
    cwd: sanitizePath(msg.cwd, basePath),
  };
}

/**
 * Sanitize file history snapshot by converting absolute paths to relative
 */
export function sanitizeFileHistorySnapshot(
  msg: FileHistorySnapshot,
  basePath: string
): FileHistorySnapshot {
  return {
    ...msg,
    snapshot: {
      ...msg.snapshot,
      files: msg.snapshot.files.map((file) => ({
        ...file,
        path: sanitizePath(file.path, basePath),
      })),
    },
  };
}

/**
 * Sanitize a single path: convert absolute to relative if within basePath
 */
function sanitizePath(absolutePath: string, basePath: string): string {
  if (!basePath || !absolutePath) {
    return absolutePath;
  }

  // Normalize paths for comparison
  const normalizedBase = path.resolve(basePath);
  const normalizedPath = path.resolve(absolutePath);

  // Check if path is within basePath
  if (normalizedPath.startsWith(normalizedBase)) {
    const relativePath = path.relative(normalizedBase, normalizedPath);
    // Avoid returning empty string for basePath itself
    return relativePath || '.';
  }

  // External path - return as-is
  return absolutePath;
}

/**
 * Sanitize paths found in text content (tool results, etc.)
 */
function sanitizePathsInContent(content: string, basePath: string): string {
  if (!basePath || !content) {
    return content;
  }

  // Replace absolute paths with relative ones
  // Match file paths (must be platform-aware)
  const normalizedBase = path.resolve(basePath);

  // Create regex that matches the base path
  // Escape special regex characters in path
  const escapedBase = normalizedBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Match absolute paths starting with base (both forward and backslashes)
  const pathRegex = new RegExp(escapedBase.replace(/\\/g, '[\\\\/]') + '[\\\\/][^\\s"\'<>|]*', 'g');

  return content.replace(pathRegex, (match) => {
    return sanitizePath(match, basePath);
  });
}
