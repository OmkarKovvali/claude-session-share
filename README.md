# claude-session-share

MCP server for sharing Claude Code sessions via GitHub Gist with automatic privacy protection.

Share your Claude Code conversations while keeping private data safe. Export sessions to shareable GitHub Gist links and import them back—all through natural language or CLI.

[![npm version](https://badge.fury.io/js/claude-session-share.svg)](https://www.npmjs.com/package/claude-session-share)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- **One-Click Sharing** - Export sessions to GitHub Gist with a simple command
- **Privacy First** - Automatically strips thinking blocks, sanitizes paths, and redacts secrets
- **Seamless Import** - Import shared sessions that work exactly like native Claude Code sessions
- **Natural Language** - Just ask Claude to "share my session" or "import from [link]"
- **Full Compatibility** - Imported sessions appear in `claude --resume` and preserve conversation context

## Installation

### Prerequisites

- Node.js 18+
- Claude Code CLI
- GitHub Personal Access Token with `gist` scope

### Install via npm

```bash
npm install -g claude-session-share
```

### Setup GitHub Token

1. Go to [GitHub Settings > Personal Access Tokens](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Give it a name like "Claude Session Share"
4. Check the **`gist`** scope
5. Generate and copy the token

## Configuration

Add the MCP server to your Claude Code configuration.

### User Config (Recommended)

Create or edit `~/.claude/mcp.json`:

```json
{
  "mcpServers": {
    "claude-session-share": {
      "command": "npx",
      "args": ["-y", "claude-session-share"],
      "env": {
        "GITHUB_TOKEN": "ghp_your_token_here"
      }
    }
  }
}
```

### Project-Specific Config

Create `.mcp.json` in your project directory with the same structure.

### Verify Installation

```bash
claude  # Start Claude Code
# Then type: /mcp
# You should see "claude-session-share" in the list
```

## Usage

### Natural Language (via MCP)

In any Claude Code conversation:

```
"Share my current session to GitHub Gist"
```

Claude will:
1. Find your current session
2. Remove thinking blocks and sanitize paths/secrets
3. Upload to a secret (unlisted) GitHub Gist
4. Return a shareable link

To import a shared session:

```
"Import this session: https://gist.github.com/username/abc123..."
```

### Command Line (Standalone CLI)

#### Share a session

```bash
# Share most recent session
npx claude-session-share share

# Share specific session file
npx claude-session-share share --session-path ~/.claude/projects/abc/session.jsonl
```

#### Import a session

```bash
# Import to current directory
npx claude-session-share import https://gist.github.com/user/abc123

# Import to specific directory
npx claude-session-share import abc123 --project-path /Users/name/project
```

### Resuming an Imported Session

```bash
cd your-project-directory
claude --resume
# Select the imported session from the list
```

Or resume directly with the session ID:

```bash
claude --resume <session-id>
```

## Privacy Protection

Every shared session is automatically sanitized:

### What Gets Removed/Sanitized

- **Thinking Blocks** - Internal reasoning stripped completely
- **Absolute Paths** - `/Users/you/project/file.ts` → `file.ts`
- **API Keys** - `sk_test_abc123`, `ghp_token`, AWS keys → `[REDACTED]`
- **Tokens** - Bearer tokens, OAuth tokens → `[REDACTED]`
- **Secrets** - Environment variables, passwords (key=value format) → `[REDACTED]`

### What Gets Preserved

- Conversation flow and context
- Code examples and explanations
- File names and relative paths
- Tool use history
- UUIDs and message chains (remapped on import)

### Known Limitations

- Passwords in connection strings (e.g., `postgresql://user:pass@host/db`) are not detected
- Secrets in natural language (not key=value format) may not be redacted

## MCP Tools Reference

### `share_session`

Exports the current session to GitHub Gist.

**Parameters:**
- `sessionPath` (optional) - Path to session file (defaults to most recent)

**Returns:**
- `gistUrl` - Shareable GitHub Gist URL
- `messageCount` - Number of messages exported

### `import_session`

Imports a session from a GitHub Gist.

**Parameters:**
- `gistUrl` - GitHub Gist URL or bare gist ID
- `projectPath` - Local project directory for import

**Returns:**
- `sessionPath` - Path to imported session file
- `sessionId` - New session ID
- `messageCount` - Number of messages imported

## Development

### Setup

```bash
git clone https://github.com/OmkarKovvali/claude-session-share.git
cd claude-session-share
npm install
```

### Build

```bash
npm run build
```

### Run Tests

```bash
npm test
# 420 tests
```

### Project Structure

```
claude-session-share/
├── src/
│   ├── index.ts                 # MCP server entry point
│   ├── cli.ts                   # CLI entry point
│   ├── gist/                    # GitHub Gist integration
│   ├── sanitization/            # Privacy protection
│   ├── services/                # Share/import orchestration
│   ├── session/                 # Session read/write
│   └── utils/                   # UUID remapping, path encoding
├── dist/                        # Compiled output
└── package.json
```

## Troubleshooting

### "Not authenticated" Error

Ensure `GITHUB_TOKEN` is set in MCP configuration:
```json
"env": {
  "GITHUB_TOKEN": "ghp_your_token_here"
}
```

### "No sessions found" Error

Ensure you're in a directory with an active Claude Code session. Sessions are stored in `~/.claude/projects/`.

### Imported Session Doesn't Appear

After importing, restart Claude Code to refresh the session list. The session file should be in `~/.claude/projects/-{encoded-path}/`.

### MCP Server Not Listed

Verify your MCP configuration:
```bash
cat ~/.claude/mcp.json
```
Then restart Claude Code.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## License

MIT © Omkar Kovvali

## Support

- **Issues**: [GitHub Issues](https://github.com/OmkarKovvali/claude-session-share/issues)
- **Email**: okovvali5@gmail.com
