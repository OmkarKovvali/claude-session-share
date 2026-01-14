# claude-session-share

## What This Is

An MCP server that adds `/share` and `/import` commands to Claude Code, enabling users to upload conversation sessions to GitHub Gist and import shared sessions as fully resumable local conversations. Works as a standalone npm package that integrates seamlessly with existing Claude Code installations.

## Core Value

Imported sessions must be indistinguishable from native Claude Code sessions - appearing in `claude --resume`, preserving full conversation context, and working exactly as if they were created locally. If this doesn't work flawlessly, the tool is useless.

## Requirements

### Validated

- ✓ Round-trip session sharing works end-to-end (share → import → resumable) — v1.0
- ✓ Imported sessions appear in `claude --resume` picker like native sessions — v1.0
- ✓ Privacy sanitization is bulletproof (strips thinking blocks, sanitizes paths, redacts secrets) — v1.0
- ✓ GitHub Gist storage backend (secret gists for privacy) — v1.0
- ✓ Tool results are sanitized, not stripped (preserve utility while removing secrets) — v1.0
- ✓ Minimal MCP context footprint (tool definitions under 200 tokens) — v1.0

### Active

- [ ] Dead simple installation (single command: `claude mcp add`)
- [ ] npm package publishing for easier distribution
- [ ] Documentation improvements (video demo, troubleshooting guide)

### Out of Scope

- **Web viewer for browsing sessions** - v1 uses raw Gist links; building a custom UI adds complexity without core value
- **Expiring links** - Gist links are permanent; ephemeral sharing is a v2+ feature
- **Selective message sharing** - Share whole sessions only; cherry-picking messages complicates the mental model
- **Access control / permissions** - Secret Gists are accessible to anyone with the URL; fine for v1
- **Team workspaces or collaboration features** - Individual use only; multi-user workflows are future work
- **Alternative storage backends (S3, R2, etc)** - GitHub Gist sufficient for v1; other backends can come later

## Context

**Current State (v1.0 shipped 2026-01-13):**

Shipped fully functional MCP server with 6,475 lines of TypeScript across 66 files. Tech stack: TypeScript, MCP SDK (stdio transport), Octokit v5, Vitest. All 388 tests passing including end-to-end validation with real GitHub API.

**What works:**
- Session export/import with GitHub Gist integration
- Privacy sanitization (thinking removal, path relativization, secret redaction)
- Three usage modes: MCP tools, slash commands (`/share`, `/import`), standalone CLI
- UUID remapping ensures imported sessions don't conflict with existing ones
- Imported sessions fully resumable via `claude --resume`

**Known limitations:**
- Connection string passwords (e.g., `postgresql://user:pass@host/db`) not detected by pattern-based redactor
- No web viewer for browsing sessions (raw Gist links only)
- Manual installation required (not yet in npm registry)

**Origins:**

This project emerged from wanting to share Claude Code sessions with others. Claude Code has `/export` but it outputs markdown and is one-way only (no import). The challenge was making imported sessions truly resumable while ensuring bulletproof privacy.

## Constraints

- **Compatibility**: Must work with existing Claude Code installations without modification - can't require custom builds or forks
- **Context efficiency**: MCP tool definitions must stay under 200 tokens total to avoid eating into the 200K context budget
- **Tech stack**: TypeScript + MCP SDK (stdio transport) + GitHub Gist API
- **Distribution**: Should be easily installable (npm/npx), but publishing to npm is not a hard requirement for v1

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| GitHub Gist for storage | Free, no infrastructure, built-in versioning, accessible URLs | ✓ Good - Works seamlessly, secret gists provide right privacy balance |
| Secret gists (not public) | Not searchable but accessible via URL - good privacy/sharing balance | ✓ Good - Unlisted URLs perfect for controlled sharing |
| Sanitize tool results, don't strip | Preserves session utility while removing sensitive data | ✓ Good - Shared sessions remain useful while protecting secrets |
| stdio transport for MCP | Standard for local tools, no HTTP server needed | ✓ Good - Zero configuration, works out of box |
| Service layer pattern | Separates business logic from MCP handlers, enables reuse | ✓ Good - Enabled standalone CLI mode without code duplication |
| Node.js built-ins only | Avoid external deps for core functionality | ✓ Good - Lightweight package, only 3 runtime deps (MCP SDK, Octokit, uuid) |
| Pattern-based secret detection | Covers common formats without external libs | ⚠️ Revisit - Misses connection string passwords, may need enhancement |
| Three usage modes | MCP tools + slash commands + CLI for flexibility | ✓ Good - Users can choose their preferred interface |

---
*Last updated: 2026-01-13 after v1.0 milestone*
