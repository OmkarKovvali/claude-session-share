/**
 * Session sanitization pipeline
 *
 * Orchestrates full session sanitization:
 * - Maps over all messages in session
 * - Applies appropriate sanitization based on message type
 * - Preserves message order and structure
 */

import type { SessionMessage, UserMessage } from '../session/types.js';
import {
  sanitizeAssistantMessage,
  sanitizeUserMessage,
  sanitizeFileHistorySnapshot,
} from './sanitizer.js';

/**
 * Sanitize entire session by processing all messages
 *
 * Uses discriminated union type guards to apply correct sanitization
 * Returns new array (immutable transformation)
 */
export function sanitizeSession(
  messages: SessionMessage[],
  basePath: string
): SessionMessage[] {
  return messages.map((msg) => {
    switch (msg.type) {
      case 'assistant':
        return sanitizeAssistantMessage(msg, basePath);
      case 'user':
        return sanitizeUserMessage(msg, basePath);
      case 'file-history-snapshot':
        return sanitizeFileHistorySnapshot(msg, basePath);
      default:
        // Exhaustiveness check - TypeScript ensures all cases covered
        const _exhaustive: never = msg;
        return _exhaustive;
    }
  });
}

/**
 * Infer base path from session messages
 *
 * Extracts the working directory from first user message with cwd
 * Returns empty string if no cwd found
 */
export function inferBasePath(messages: SessionMessage[]): string {
  for (const msg of messages) {
    if (msg.type === 'user') {
      const userMsg = msg as UserMessage;
      if (userMsg.cwd) {
        return userMsg.cwd;
      }
    }
  }
  return '';
}
