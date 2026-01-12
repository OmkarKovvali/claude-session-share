/**
 * TypeScript types for Claude Code session messages
 *
 * Sessions are stored as JSONL files with three message types:
 * - user: User input messages
 * - assistant: Assistant responses with thinking snapshots
 * - file-history-snapshot: File state tracking
 *
 * Uses discriminated unions for type-safe message handling.
 */

/**
 * Base message fields common to all session message types
 */
export interface BaseMessage {
  uuid: string;
  sessionId: string;
  timestamp: string;
  parentUuid: string | null;
  isSidechain?: boolean;
}

/**
 * User message content structure
 */
export interface UserMessageContent {
  role: 'user';
  content: string;
}

/**
 * User input message
 */
export interface UserMessage extends BaseMessage {
  type: 'user';
  message: UserMessageContent;
  cwd: string;
  version: string;
  gitBranch?: string;
  isMeta?: boolean;
}

/**
 * Assistant thinking and response snapshot
 */
export interface AssistantSnapshot {
  thinking: string;
  messages: Array<{
    role: string;
    content: string;
  }>;
}

/**
 * Assistant response message
 */
export interface AssistantMessage extends BaseMessage {
  type: 'assistant';
  messageId: string;
  snapshot: AssistantSnapshot;
}

/**
 * File state in history snapshot
 */
export interface FileState {
  path: string;
  // Additional file state fields can be added as discovered
}

/**
 * File history snapshot structure
 */
export interface FileHistorySnapshotData {
  files: FileState[];
}

/**
 * File history snapshot message
 */
export interface FileHistorySnapshot extends BaseMessage {
  type: 'file-history-snapshot';
  isSnapshotUpdate: boolean;
  snapshot: FileHistorySnapshotData;
}

/**
 * Discriminated union of all session message types
 * Type discrimination based on 'type' field
 */
export type SessionMessage = UserMessage | AssistantMessage | FileHistorySnapshot;

/**
 * Session file metadata
 */
export interface SessionFile {
  path: string;
  sessionId: string;
  isAgent: boolean;
}
