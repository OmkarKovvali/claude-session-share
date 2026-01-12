/**
 * Session metadata extraction from parsed messages
 *
 * Extracts useful metadata from session messages including message counts,
 * timestamps, project path, and agent conversation detection.
 */

import type { SessionMessage, UserMessage } from './types.js';

/**
 * Session metadata extracted from messages
 */
export interface SessionMetadata {
  /** Session UUID */
  sessionId: string;

  /** Project working directory path */
  projectPath: string;

  /** Total number of messages in session */
  messageCount: number;

  /** Timestamp of first message */
  firstTimestamp: string;

  /** Timestamp of last message */
  lastTimestamp: string;

  /** Whether session includes agent sidechain conversations */
  hasAgentConversations: boolean;

  /** Claude Code version that created the session */
  version: string;
}

/**
 * Extracts metadata from session messages
 *
 * Analyzes message array to extract session metadata including:
 * - Session ID and project path (from user messages)
 * - Message count and timestamp range
 * - Agent conversation detection
 * - Claude Code version
 *
 * @param messages - Array of parsed session messages
 * @returns Session metadata, or null if messages array is empty
 *
 * @example
 * const messages = await parseSessionFile('/path/to/session.jsonl');
 * const metadata = extractMetadata(messages);
 * // Returns: {
 * //   sessionId: 'abc-123',
 * //   projectPath: '/Users/name/project',
 * //   messageCount: 42,
 * //   firstTimestamp: '2026-01-11T10:00:00.000Z',
 * //   lastTimestamp: '2026-01-11T11:30:00.000Z',
 * //   hasAgentConversations: true,
 * //   version: '1.2.3'
 * // }
 */
export function extractMetadata(messages: SessionMessage[]): SessionMetadata | null {
  // Return null for empty arrays
  if (messages.length === 0) {
    return null;
  }

  // Get first and last messages for timestamps
  const firstMessage = messages[0];
  const lastMessage = messages[messages.length - 1];

  // Find first user message to extract cwd and version
  // Use type guard to safely access UserMessage fields
  const firstUserMessage = messages.find(m => m.type === 'user') as UserMessage | undefined;

  // Detect agent conversations by checking isSidechain flag
  const hasAgentConversations = messages.some(m => m.isSidechain === true);

  // Build metadata object with all fields
  return {
    sessionId: firstMessage.sessionId,
    projectPath: firstUserMessage?.cwd || 'unknown',
    messageCount: messages.length,
    firstTimestamp: firstMessage.timestamp,
    lastTimestamp: lastMessage.timestamp,
    hasAgentConversations,
    version: firstUserMessage?.version || 'unknown',
  };
}
