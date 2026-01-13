# claude-session-share

> **MCP server for sharing Claude Code sessions via GitHub Gist with automatic privacy protection**

Share your Claude Code conversations effortlessly while keeping your private data safe. This MCP server enables you to export sessions to shareable GitHub Gist links and import them back—all through natural language.

[![npm version](https://badge.fury.io/js/claude-session-share.svg)](https://www.npmjs.com/package/claude-session-share)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ Features

- **🔗 One-Click Sharing** - Export sessions to GitHub Gist with a simple command
- **🔒 Privacy First** - Automatically strips thinking blocks, sanitizes paths, and redacts secrets
- **📥 Seamless Import** - Import shared sessions that work exactly like native Claude Code sessions
- **💬 Natural Language** - Just ask Claude to "share my session" or "import from [link]"
- **🔄 Full Compatibility** - Imported sessions appear in `claude --resume` and preserve conversation context

## 📦 Installation

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

## ⚙️ Configuration

Add the MCP server to your Claude Code configuration:

### Option 1: User Config (Recommended)

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

### Option 2: Project-Specific Config

Create `.mcp.json` in your project directory with the same structure.

### Verify Installation

```bash
# Check if the MCP server is recognized
claude  # Start Claude Code
# Then type: /mcp
# You should see "claude-session-share" in the list
```

## 🚀 Usage

### Option A: Natural Language (via MCP)

In any Claude Code conversation, simply say:

```
"Share my current session to GitHub Gist"
```

Claude will:
1. Find your current session
2. Remove thinking blocks and sanitize paths/secrets
3. Upload to a secret (unlisted) GitHub Gist
4. Return a shareable link

**Example output:**
```
✓ Session shared successfully!
Link: https://gist.github.com/username/abc123...

Share this link with anyone. They can import it with:
"Import session from https://gist.github.com/username/abc123..."
```

#### Importing via MCP

To import a shared session:

```
"Import this session: https://gist.github.com/username/abc123..."
```

Claude will:
1. Fetch the session from the Gist
2. Remap UUIDs to avoid conflicts
3. Write to your local `.claude/projects/` directory
4. Make it available for resuming

### Option B: Command Line (Standalone CLI)

You can also use the CLI directly without Claude Code:

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

**CLI flags:**
- `--session-path <path>` - Specific session file to share (default: most recent)
- `--project-path <path>` - Target directory for import (default: current directory)

### Resuming an Imported Session

```bash
cd your-project-directory
claude --resume
# Select the imported session from the list
```

The imported session works exactly like a native Claude Code session—full conversation history, no thinking blocks, perfect privacy.

## 🔐 Privacy Protection

Every shared session is automatically sanitized:

### ✅ What Gets Removed/Sanitized

- **Thinking Blocks** - Internal reasoning stripped completely
- **Absolute Paths** - `/Users/you/project/file.ts` → `file.ts`
- **API Keys** - `sk_test_abc123`, `ghp_token`, AWS keys → `[REDACTED]`
- **Tokens** - Bearer tokens, OAuth tokens → `[REDACTED]`
- **Secrets** - Environment variables, passwords (key=value format) → `[REDACTED]`

### ✅ What Gets Preserved

- Conversation flow and context
- Code examples and explanations
- File names and relative paths
- Tool use history
- UUIDs and message chains (remapped on import)

### Known Limitations

- Passwords in connection strings (e.g., `postgresql://user:pass@host/db`) are not detected
- Secrets in natural language (not key=value format) may not be redacted
- These tradeoffs prevent false positives on legitimate content

## 📚 MCP Tools Reference

The server provides two MCP tools:

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
- `gistUrl` - GitHub Gist URL (e.g., `https://gist.github.com/user/abc123`)
- `projectPath` (optional) - Local project directory (defaults to current directory)

**Returns:**
- `sessionPath` - Path to imported session file
- `sessionId` - New session ID
- `messageCount` - Number of messages imported

## 🛠️ Development

### Clone and Setup

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
# 337 tests with full coverage
```

### Project Structure

```
claude-session-share/
├── src/
│   ├── index.ts                 # MCP server entry point
│   ├── gist/                    # GitHub Gist integration
│   ├── sanitization/            # Privacy protection
│   ├── services/                # Share/import orchestration
│   ├── session/                 # Session read/write
│   └── utils/                   # UUID remapping, etc.
├── dist/                        # Compiled output
├── .planning/                   # Project planning docs
└── package.json
```

## 🧪 Testing

The project includes comprehensive test coverage:

- **Unit Tests** - All modules tested individually
- **Integration Tests** - Service orchestration verified
- **E2E Tests** - Full share→import→resume workflow validated
- **Real API Tests** - GitHub Gist integration tested with actual API

Run tests:
```bash
npm test                    # All tests
npm test -- session-reader  # Specific test file
```

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- TypeScript with strict mode
- ESM modules
- Functional programming style (immutable transformations)
- Comprehensive tests for new features

## 📋 Roadmap

- [x] Core share/import functionality
- [x] Privacy sanitization
- [x] MCP server integration
- [x] End-to-end testing
- [ ] Web interface for browsing shared sessions
- [ ] Session versioning and updates
- [ ] Organization/team sharing features
- [ ] Custom sanitization rules

## 🐛 Troubleshooting

### "Not authenticated" Error

Make sure your `GITHUB_TOKEN` is set in the MCP configuration:
```json
"env": {
  "GITHUB_TOKEN": "ghp_your_token_here"
}
```

### "No sessions found" Error

Ensure you're in a directory with an active Claude Code session. Sessions are stored in `~/.claude/projects/`.

### Imported Session Doesn't Appear

Check that the session was written to the correct location:
```bash
ls -la ~/.claude/projects/*/
```

Each project directory should have a `.jsonl` file—that's your session.

### MCP Server Not Listed

Verify your MCP configuration:
```bash
cat ~/.claude/mcp.json
```

Then restart Claude Code.

## 📄 License

MIT © Omkar Kovvali

See [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Model Context Protocol](https://modelcontextprotocol.io/)
- Uses [GitHub Gist API](https://docs.github.com/en/rest/gists)
- Powered by [Claude Code](https://www.anthropic.com/claude)

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/OmkarKovvali/claude-session-share/issues)
- **Discussions**: [GitHub Discussions](https://github.com/OmkarKovvali/claude-session-share/discussions)
- **Email**: okovvali5@gmail.com

---

**Made with ❤️ for the Claude Code community**
