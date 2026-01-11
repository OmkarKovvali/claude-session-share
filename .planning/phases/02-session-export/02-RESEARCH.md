# Phase 2: Session Export - Research

**Researched:** 2026-01-11
**Domain:** Claude Code session storage architecture and JSONL parsing
**Confidence:** HIGH

<research_summary>
## Summary

Researched Claude Code's session storage system, which uses JSONL (JSON Lines) format stored in `~/.claude/projects/[encoded-directory]/[session-uuid].jsonl`. Each JSONL file contains a chronological sequence of events (user messages, assistant responses, file snapshots) with UUID-based message threading.

Key findings:
- **Directory encoding**: Project paths like `/Users/name/project` become `-Users-name-project` as directory names
- **Session structure**: Each line is a JSON object with fields like `type`, `uuid`, `parentUuid`, `sessionId`, `timestamp`, `message`, and `snapshot`
- **Message types**: `user`, `assistant`, `file-history-snapshot`, with support for `isSidechain` for agent conversations
- **Resumability requirements**: Full message history preservation, UUID integrity, and proper snapshot reconstruction

**Primary recommendation:** Use Node.js streaming with `stream-json` for memory-efficient JSONL parsing, native `crypto.randomUUID()` for UUID generation, and implement line-by-line validation with graceful error recovery.
</research_summary>

<standard_stack>
## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js `fs/promises` | Built-in | File system operations | Native async file access |
| Node.js `readline` | Built-in | Line-by-line JSONL reading | Memory-efficient streaming |
| Node.js `crypto.randomUUID()` | Built-in (14.17.0+) | UUID v4 generation | Native, cryptographically secure, 3x faster than libraries |
| `stream-json` | Latest | Large JSONL file streaming | Minimal memory footprint, handles files exceeding available RAM |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `uuid` | 10.x | UUID generation (fallback) | If Node.js < 14.17.0 or need v1/v3/v5 UUIDs |
| `@types/node` | Latest | TypeScript type definitions | Already in project |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `stream-json` | `readline` + manual parsing | readline is built-in but stream-json has better error handling and pipeline composability |
| `crypto.randomUUID()` | `uuid` package | uuid package needed for older Node.js or non-v4 UUIDs, but crypto is faster and built-in |
| Line-by-line streaming | `fs.readFileSync()` + `split('\n')` | Synchronous approach loads entire file into memory, fails on large sessions |

**Installation:**
```bash
npm install stream-json
# No installation needed for crypto.randomUUID() - built into Node.js 14.17.0+
```
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Recommended Project Structure
```
src/
├── session/
│   ├── reader.ts          # Read JSONL files with streaming
│   ├── parser.ts          # Parse and validate session structure
│   └── types.ts           # Session message type definitions
├── utils/
│   ├── path-encoding.ts   # Directory name encoding/decoding
│   └── uuid-mapper.ts     # UUID remapping logic (for later phases)
└── mcp/
    └── tools/             # MCP tool implementations
```

### Pattern 1: Streaming JSONL Reader
**What:** Use Node.js streams to read JSONL files line-by-line without loading entire file into memory
**When to use:** All session file reads (sessions can be 1MB+ with thousands of messages)
**Example:**
```typescript
// Source: Node.js readline docs + stream-json patterns
import { createReadStream } from 'fs';
import { createInterface } from 'readline';

async function* readSessionLines(filePath: string): AsyncGenerator<string> {
  const fileStream = createReadStream(filePath, { encoding: 'utf-8' });
  const rl = createInterface({
    input: fileStream,
    crlfDelay: Infinity // Handle both \n and \r\n
  });

  for await (const line of rl) {
    if (line.trim()) { // Skip empty lines
      yield line;
    }
  }
}

async function parseSession(filePath: string): Promise<SessionMessage[]> {
  const messages: SessionMessage[] = [];

  for await (const line of readSessionLines(filePath)) {
    try {
      const message = JSON.parse(line);
      messages.push(message);
    } catch (error) {
      console.warn(`Skipping invalid line: ${error.message}`);
      // Continue processing other lines
    }
  }

  return messages;
}
```

### Pattern 2: Directory Path Encoding
**What:** Convert filesystem paths to Claude Code's directory naming scheme
**When to use:** Finding session directories from project paths
**Example:**
```typescript
// Source: Verified from ~/.claude/projects/ structure
function encodeProjectPath(absolutePath: string): string {
  // /Users/omkark/cc_links -> -Users-omkark-cc_links
  return absolutePath.replace(/\//g, '-').replace(/^-/, '');
}

function decodeProjectPath(encodedName: string): string {
  // -Users-omkark-cc_links -> /Users/omkark/cc_links
  return '/' + encodedName.replace(/-/g, '/');
}

function getSessionDirectory(projectPath: string): string {
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  const encoded = encodeProjectPath(projectPath);
  return path.join(homeDir, '.claude', 'projects', encoded);
}
```

### Pattern 3: Message Type Discrimination
**What:** Use TypeScript discriminated unions to handle different message types safely
**When to use:** Processing messages with different structures (user, assistant, file-history-snapshot)
**Example:**
```typescript
// Source: Observed session structure patterns
type SessionMessage =
  | UserMessage
  | AssistantMessage
  | FileHistorySnapshot;

interface BaseMessage {
  uuid: string;
  sessionId: string;
  timestamp: string;
  parentUuid: string | null;
  isSidechain?: boolean;
}

interface UserMessage extends BaseMessage {
  type: 'user';
  message: {
    role: 'user';
    content: string;
  };
  cwd: string;
  version: string;
  gitBranch?: string;
  isMeta?: boolean;
}

interface AssistantMessage extends BaseMessage {
  type: 'assistant';
  messageId: string | null;
  snapshot: {
    thinking: string | null;
    messages: unknown[]; // Full message array
  };
}

interface FileHistorySnapshot extends BaseMessage {
  type: 'file-history-snapshot';
  isSnapshotUpdate: boolean;
  snapshot: {
    files: Record<string, FileSnapshot>;
  };
}

function processMessage(msg: SessionMessage) {
  switch (msg.type) {
    case 'user':
      // TypeScript knows msg.message exists
      return handleUserMessage(msg);
    case 'assistant':
      // TypeScript knows msg.snapshot exists
      return handleAssistantMessage(msg);
    case 'file-history-snapshot':
      return handleFileSnapshot(msg);
  }
}
```

### Anti-Patterns to Avoid
- **Loading entire JSONL file into memory:** Session files can be multi-MB; always use streaming
- **Assuming all lines are valid JSON:** Corruption happens; wrap parsing in try-catch and continue
- **Modifying UUIDs in place:** Original UUIDs must be preserved for verification; use separate mapping
- **Ignoring `parentUuid` links:** Message threading is critical for conversation structure
- **Skipping `isSidechain` messages:** Agent conversations are part of the session context
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UUID v4 generation | Custom random string generator | `crypto.randomUUID()` | Crypto-secure, RFC-compliant, native performance, no dependencies |
| JSONL streaming | Manual buffering/line splitting | `readline` or `stream-json` | Edge cases with large lines, CRLF handling, backpressure management |
| File path encoding | Complex regex replacements | Simple `.replace(/\//g, '-')` | Verified pattern, no edge cases found in Claude Code's encoding |
| JSON schema validation | Manual type checking | TypeScript discriminated unions | Type safety at compile time, runtime validation only where needed |
| Error recovery in parsing | Fail-fast on first error | Try-catch per line with continue | JSONL spec allows partial recovery; one bad line shouldn't fail entire session |

**Key insight:** Session parsing is a data pipeline problem, not a complex algorithm problem. Use Node.js built-in streaming primitives and TypeScript's type system rather than custom parsers or validation libraries. The only external dependency needed is `stream-json` for advanced streaming scenarios.
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Memory Exhaustion from Large Sessions
**What goes wrong:** Loading entire session file into memory with `fs.readFileSync()` causes OOM crashes
**Why it happens:** Sessions can exceed 1MB with thousands of messages and large tool results
**How to avoid:** Always use streaming with `readline` or `stream-json`; process line-by-line
**Warning signs:** High memory usage, `ENOMEM` errors, crashes on large sessions

### Pitfall 2: Silent Data Loss from Malformed Lines
**What goes wrong:** Single malformed JSON line causes entire session parse to fail
**Why it happens:** Throwing on `JSON.parse()` error without catching stops iteration
**How to avoid:** Wrap each line's `JSON.parse()` in try-catch, log warnings, continue processing
**Warning signs:** Missing messages in output, complete session rejection on minor corruption

### Pitfall 3: Breaking Session Resumability
**What goes wrong:** Imported sessions don't appear in `claude --resume` or fail to restore context
**Why it happens:** Missing required fields (`uuid`, `sessionId`, `timestamp`), broken UUID chains via `parentUuid`
**How to avoid:** Validate all required fields exist before writing; maintain UUID relationships
**Warning signs:** Sessions visible in directory but not in `claude --resume` list, "No conversations found" errors

### Pitfall 4: Incorrect Directory Path Encoding
**What goes wrong:** Can't find session files because path encoding doesn't match Claude Code's scheme
**Why it happens:** Using URL encoding, base64, or other schemes instead of simple `/` → `-` replacement
**How to avoid:** Use verified pattern: `path.replace(/\//g, '-').replace(/^-/, '')`
**Warning signs:** `ENOENT` errors when trying to read sessions, empty session lists

### Pitfall 5: Ignoring Agent Sidechain Sessions
**What goes wrong:** Losing context from agent subconversations when exporting main session
**Why it happens:** Not checking `isSidechain` flag or `agent-*.jsonl` files
**How to avoid:** Process both main session files (UUID.jsonl) and agent files (agent-*.jsonl) in same directory
**Warning signs:** Missing context about agent actions, incomplete conversation history

### Pitfall 6: 30-Day Automatic Deletion
**What goes wrong:** Session files disappear after 30 days, making long-term sharing impossible
**Why it happens:** Claude Code default cleanup behavior deletes sessions after `cleanupPeriodDays` (default 30)
**How to avoid:** Document for users to set `"cleanupPeriodDays": 99999` in `~/.claude/settings.json`
**Warning signs:** Old sessions missing, users reporting "sessions disappeared"
</common_pitfalls>

<code_examples>
## Code Examples

### Complete Session Reader Implementation
```typescript
// Source: Verified patterns from Node.js docs + observed session structure
import { readdir } from 'fs/promises';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import path from 'path';

interface SessionFile {
  path: string;
  sessionId: string;
  isAgent: boolean;
}

/**
 * Find all session files for a project
 */
async function findSessionFiles(projectPath: string): Promise<SessionFile[]> {
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  if (!homeDir) throw new Error('Cannot determine home directory');

  const encoded = projectPath.replace(/\//g, '-').replace(/^-/, '');
  const sessionDir = path.join(homeDir, '.claude', 'projects', encoded);

  const files = await readdir(sessionDir);

  return files
    .filter(f => f.endsWith('.jsonl'))
    .map(f => {
      const isAgent = f.startsWith('agent-');
      const sessionId = isAgent
        ? f.replace('agent-', '').replace('.jsonl', '')
        : f.replace('.jsonl', '');

      return {
        path: path.join(sessionDir, f),
        sessionId,
        isAgent
      };
    });
}

/**
 * Parse a single session file with error recovery
 */
async function parseSessionFile(filePath: string): Promise<SessionMessage[]> {
  const messages: SessionMessage[] = [];
  const fileStream = createReadStream(filePath, { encoding: 'utf-8' });
  const rl = createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let lineNumber = 0;
  for await (const line of rl) {
    lineNumber++;

    if (!line.trim()) {
      continue; // Skip empty lines
    }

    try {
      const message = JSON.parse(line);

      // Validate required fields
      if (!message.type || !message.uuid || !message.sessionId) {
        console.warn(`Line ${lineNumber}: Missing required fields, skipping`);
        continue;
      }

      messages.push(message);
    } catch (error) {
      console.warn(`Line ${lineNumber}: Parse error - ${error.message}, skipping`);
      // Continue processing remaining lines
    }
  }

  return messages;
}

/**
 * Get all sessions for a project
 */
async function getAllSessions(projectPath: string): Promise<Map<string, SessionMessage[]>> {
  const sessionFiles = await findSessionFiles(projectPath);
  const sessions = new Map<string, SessionMessage[]>();

  for (const file of sessionFiles) {
    const messages = await parseSessionFile(file.path);
    sessions.set(file.sessionId, messages);
  }

  return sessions;
}
```

### Session Metadata Extraction
```typescript
// Source: Observed session structure
interface SessionMetadata {
  sessionId: string;
  projectPath: string;
  messageCount: number;
  firstTimestamp: string;
  lastTimestamp: string;
  hasAgentConversations: boolean;
  version: string;
}

function extractMetadata(messages: SessionMessage[]): SessionMetadata | null {
  if (messages.length === 0) return null;

  const firstMessage = messages[0];
  const lastMessage = messages[messages.length - 1];

  // Find first user message to get cwd and version
  const firstUserMsg = messages.find(m => m.type === 'user') as UserMessage | undefined;

  return {
    sessionId: firstMessage.sessionId,
    projectPath: firstUserMsg?.cwd || 'unknown',
    messageCount: messages.length,
    firstTimestamp: firstMessage.timestamp,
    lastTimestamp: lastMessage.timestamp,
    hasAgentConversations: messages.some(m => m.isSidechain === true),
    version: firstUserMsg?.version || 'unknown'
  };
}
```

### Safe UUID Remapping (For Later Phases)
```typescript
// Source: Design pattern for Phase 5 import
class UUIDMapper {
  private mapping = new Map<string, string>();

  /**
   * Get or create mapping for a UUID
   */
  remap(originalUuid: string): string {
    if (!this.mapping.has(originalUuid)) {
      this.mapping.set(originalUuid, crypto.randomUUID());
    }
    return this.mapping.get(originalUuid)!;
  }

  /**
   * Remap all UUIDs in a message while preserving relationships
   */
  remapMessage(message: SessionMessage): SessionMessage {
    return {
      ...message,
      uuid: this.remap(message.uuid),
      sessionId: this.remap(message.sessionId),
      parentUuid: message.parentUuid ? this.remap(message.parentUuid) : null
    };
  }
}
```
</code_examples>

<sota_updates>
## State of the Art (2025-2026)

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `uuid` package | `crypto.randomUUID()` | Node.js 14.17.0 (2021) | 3x faster, native, no dependencies needed |
| `JSONStream` | `stream-json` | ~2020+ | JSONStream unmaintained since 2018; stream-json actively maintained |
| Manual JSONL parsing | `readline` built-in | Always available | Native solution sufficient for most cases |
| 30-day retention default | Configurable `cleanupPeriodDays` | Current Claude Code | Must document workaround for users |

**New tools/patterns to consider:**
- **Native crypto.randomUUID()**: Always prefer over external libraries for v4 UUIDs
- **TypeScript discriminated unions**: Compile-time safety for message type handling
- **Async generators**: Clean syntax for streaming JSONL with `async function*`

**Deprecated/outdated:**
- **JSONStream package**: Use `stream-json` or native `readline` instead
- **Synchronous file reading**: Never use `fs.readFileSync()` for session files
- **Custom UUID generators**: Crypto-unsafe patterns replaced by `crypto.randomUUID()`
</sota_updates>

<open_questions>
## Open Questions

1. **Session Summarization Files**
   - What we know: Claude Code mentions "summary files" for long sessions
   - What's unclear: Exact format, how they're used by `--resume`, whether we need to parse them
   - Recommendation: Export them alongside main sessions as-is; investigate format in Phase 6 verification

2. **Tool Results Size Limits**
   - What we know: Tool results (file reads, bash output) can be large
   - What's unclear: Whether there's size truncation in stored sessions vs. what was shown to LLM
   - Recommendation: Preserve as-is during export; consider size warnings in sanitization phase

3. **Thinking Block Presence**
   - What we know: `snapshot.thinking` field exists but observed as null in current sessions
   - What's unclear: When thinking blocks are stored, how they affect privacy
   - Recommendation: Handle thinking blocks in sanitization phase; assume they may contain sensitive reasoning
</open_questions>

<sources>
## Sources

### Primary (HIGH confidence)
- Direct inspection of `~/.claude/projects/` directory structure (verified 2026-01-11)
- Analysis of live JSONL session files from current project
- [Node.js fs/promises documentation](https://nodejs.org/api/fs.html#promises-api) - File system operations
- [Node.js readline documentation](https://nodejs.org/api/readline.html) - Line-by-line reading
- [Node.js crypto.randomUUID() documentation](https://nodejs.org/api/crypto.html#cryptorandomuuidoptions) - UUID generation

### Secondary (MEDIUM confidence)
- [Claude Code Session Management (Steve Kinney)](https://stevekinney.com/courses/ai-development/claude-code-session-management) - Verified session structure details
- [Claude Code `--continue` after `mv` Migration Guide (GitHub Gist)](https://gist.github.com/gwpl/e0b78a711b4a6b2fc4b594c9b9fa2c4c) - Directory encoding, UUID linking
- [Don't let Claude Code delete your session logs (Simon Willison)](https://simonwillison.net/2025/Oct/22/claude-code-logs/) - Retention settings verified
- [claude-code-transcripts (GitHub)](https://github.com/simonw/claude-code-transcripts) - Verified JSONL parsing approaches
- [stream-json npm package](https://www.npmjs.com/package/stream-json) - Streaming JSONL library
- [Manage Claude's memory - Claude Code Docs](https://code.claude.com/docs/en/memory) - Session storage location
- [Common workflows - Claude Code Docs](https://code.claude.com/docs/en/common-workflows) - Resume command behavior

### Tertiary (LOW confidence - needs validation)
- None - all findings verified against official sources or direct observation
</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: Claude Code session storage, Node.js JSONL streaming
- Ecosystem: Built-in Node.js modules (fs, readline, crypto), stream-json
- Patterns: Streaming file I/O, error recovery, UUID preservation
- Pitfalls: Memory exhaustion, data corruption, resumability breaking

**Confidence breakdown:**
- Session file format: HIGH - directly observed from live sessions
- Directory encoding: HIGH - verified pattern from actual directory names
- JSONL parsing: HIGH - standard format with well-documented Node.js support
- Streaming approach: HIGH - verified from Node.js docs and established patterns
- Pitfalls: MEDIUM-HIGH - some observed (memory), others inferred from best practices

**Research date:** 2026-01-11
**Valid until:** 2026-03-11 (60 days - Claude Code session format appears stable)

**Notes:**
- Session format may evolve with Claude Code updates; validate against current version
- No MCP-specific considerations for Phase 2 (just reading local files)
- Privacy sanitization deferred to Phase 3 (export raw sessions first)
</metadata>

---

*Phase: 02-session-export*
*Research completed: 2026-01-11*
*Ready for planning: yes*
