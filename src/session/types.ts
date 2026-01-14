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
 * Assistant thinking and response snapshot (v1.x format)
 */
export interface AssistantSnapshot {
  thinking: string | null;
  messages: Array<{
    role: string;
    content: string;
  }>;
}

/**
 * Content block in new format (v2.0.76+)
 */
export interface ContentBlock {
  type: string; // 'text', 'thinking', 'tool_use', 'tool_result', etc.
  text?: string; // Present for text and thinking blocks
  // Additional fields for tool blocks preserved as-is
  [key: string]: unknown;
}

/**
 * API response message structure (v2.0.76+ format)
 */
export interface ApiResponseMessage {
  model: string;
  id: string;
  type: string;
  role: string;
  content: ContentBlock[];
  stop_reason: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * Assistant response message
 *
 * Supports two formats:
 * - Old format (v1.x): Uses `snapshot` field with thinking string and messages array
 * - New format (v2.0.76+): Uses `message` field with API response structure
 *
 * At least one of `snapshot` or `message` must be present.
 */
export interface AssistantMessage extends BaseMessage {
  type: 'assistant';
  messageId: string;
  snapshot?: AssistantSnapshot; // Old format (v1.x)
  message?: ApiResponseMessage; // New format (v2.0.76+)
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
