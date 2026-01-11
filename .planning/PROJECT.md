# claude-session-share

## What This Is

An MCP server that adds `/share` and `/import` commands to Claude Code, enabling users to upload conversation sessions to GitHub Gist and import shared sessions as fully resumable local conversations. Works as a standalone npm package that integrates seamlessly with existing Claude Code installations.

## Core Value

Imported sessions must be indistinguishable from native Claude Code sessions - appearing in `claude --resume`, preserving full conversation context, and working exactly as if they were created locally. If this doesn't work flawlessly, the tool is useless.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Round-trip session sharing works end-to-end (share → import → resumable)
- [ ] Imported sessions appear in `claude --resume` picker like native sessions
- [ ] Privacy sanitization is bulletproof (strips thinking blocks, sanitizes paths, redacts secrets)
- [ ] Dead simple installation (single command: `claude mcp add`)
- [ ] Minimal MCP context footprint (tool definitions under 200 tokens)
- [ ] GitHub Gist storage backend (secret gists for privacy)
- [ ] Tool results are sanitized, not stripped (preserve utility while removing secrets)

### Out of Scope

- **Web viewer for browsing sessions** - v1 uses raw Gist links; building a custom UI adds complexity without core value
- **Expiring links** - Gist links are permanent; ephemeral sharing is a v2+ feature
- **Selective message sharing** - Share whole sessions only; cherry-picking messages complicates the mental model
- **Access control / permissions** - Secret Gists are accessible to anyone with the URL; fine for v1
- **Team workspaces or collaboration features** - Individual use only; multi-user workflows are future work
- **Alternative storage backends (S3, R2, etc)** - GitHub Gist sufficient for v1; other backends can come later

## Context

This project emerged from wanting to share Claude Code sessions with others and realize there's no built-in way to do it. Claude Code already has `/export` but it outputs markdown and is one-way only (no import).

The challenge is making imported sessions truly resumable. Claude Code stores sessions as JSONL files with UUIDs linking parent/child messages. Importing requires:
- Fetching the shared session
- Remapping all UUIDs to avoid conflicts
- Writing to the correct local `.claude/projects/` directory
- Preserving the conversation chain structure

Privacy is critical. Sessions contain Claude's internal thinking blocks, user file paths, and potentially API keys in tool results. These must be stripped/sanitized before sharing.

## Constraints

- **Compatibility**: Must work with existing Claude Code installations without modification - can't require custom builds or forks
- **Context efficiency**: MCP tool definitions must stay under 200 tokens total to avoid eating into the 200K context budget
- **Tech stack**: TypeScript + MCP SDK (stdio transport) + GitHub Gist API
- **Distribution**: Should be easily installable (npm/npx), but publishing to npm is not a hard requirement for v1

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| GitHub Gist for storage | Free, no infrastructure, built-in versioning, accessible URLs | — Pending |
| Secret gists (not public) | Not searchable but accessible via URL - good privacy/sharing balance | — Pending |
| Sanitize tool results, don't strip | Preserves session utility while removing sensitive data | — Pending |
| stdio transport for MCP | Standard for local tools, no HTTP server needed | — Pending |
| Two tools only (share/import) | Minimal context footprint, clear purpose | — Pending |

---
*Last updated: 2026-01-11 after initialization*
