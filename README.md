# claude-session-share

MCP server for sharing Claude Code sessions via GitHub Gist with automatic privacy protection.

[![npm version](https://badge.fury.io/js/claude-session-share.svg)](https://www.npmjs.com/package/claude-session-share)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- **One-Click Sharing** - Export sessions to GitHub Gist through natural language
- **Privacy First** - Automatically strips thinking blocks, sanitizes paths, and redacts secrets
- **Seamless Import** - Import shared sessions that work exactly like native Claude Code sessions
- **Full Compatibility** - Imported sessions appear in `claude --resume`

## Installation

### Prerequisites

- Node.js 18+
- Claude Code CLI
- GitHub Personal Access Token with `gist` scope

### Setup GitHub Token

1. Go to [GitHub Settings > Personal Access Tokens](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Check the **`gist`** scope
4. Generate and copy the token

### Configure MCP Server

Add to `~/.claude/mcp.json`:

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

### Verify Installation

```bash
claude  # Start Claude Code
# Type: /mcp
# You should see "claude-session-share" in the list
```

## Usage

### Share a Session

In any Claude Code conversation:

```
"Share my current session to GitHub Gist"
```

Claude will:
1. Find your current session
2. Remove thinking blocks and sanitize paths/secrets
3. Upload to a secret GitHub Gist
4. Return a shareable link

### Import a Session

```
"Import this session: https://gist.github.com/username/abc123"
```

### Resume an Imported Session

```bash
claude --resume
# Select the imported session from the list
```

Or directly:
```bash
claude --resume <session-id>
```

## Privacy Protection

Every shared session is automatically sanitized:

### Removed/Sanitized
- Thinking blocks (internal reasoning)
- Absolute paths → relative paths
- API keys, tokens, secrets → `[REDACTED]`

### Preserved
- Conversation flow and context
- Code examples
- Relative file paths
- Tool use history

## MCP Tools

### `share_session`
Exports current session to GitHub Gist.

### `import_session`
Imports session from GitHub Gist URL.

## Troubleshooting

### "Not authenticated" Error
Ensure `GITHUB_TOKEN` is set in MCP configuration.

### Imported Session Doesn't Appear
Restart Claude Code to refresh the session list.

### MCP Server Not Listed
Verify `~/.claude/mcp.json` and restart Claude Code.

## Development

```bash
git clone https://github.com/OmkarKovvali/claude-session-share.git
cd claude-session-share
npm install
npm run build
npm test
```

## License

MIT © Omkar Kovvali
