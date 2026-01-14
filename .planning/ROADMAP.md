# Roadmap: claude-session-share

## Overview

Build an MCP server that enables Claude Code session sharing through GitHub Gist. The journey moves from foundation setup through session export/sanitization, Gist integration, and session import, culminating in end-to-end verification that imported sessions are fully resumable and indistinguishable from native sessions.

## Domain Expertise

None

## Milestones

- ✅ **v1.0 MVP** — Phases 1-7 (shipped 2026-01-13) - [Full details](milestones/v1.0-ROADMAP.md)
- 🚧 **v1.1 Session Format Compatibility** — Phase 8 (in progress)

## Completed Milestones

<details>
<summary>✅ v1.0 MVP (Phases 1-7) — SHIPPED 2026-01-13</summary>

### Phases

- [x] **Phase 1: Foundation** - Project setup and MCP server scaffold (Completed: 2026-01-11)
- [x] **Phase 2: Session Export** - Export Claude Code sessions to sanitized format (Completed: 2026-01-12)
- [x] **Phase 3: Privacy Sanitization** - Strip thinking blocks, sanitize paths, redact secrets (Completed: 2026-01-12)
- [x] **Phase 4: Gist Storage** - GitHub Gist integration for sharing (Completed: 2026-01-13)
- [x] **Phase 5: Session Import** - Import sessions with UUID remapping and local storage (Completed: 2026-01-12)
- [x] **Phase 6: End-to-End Verification** - Round-trip testing and `claude --resume` integration (Completed: 2026-01-13)
- [x] **Phase 7: CLI Interface and Slash Commands** - Add CLI interface for direct usage and slash command integration (Completed: 2026-01-14)

## Phase Details

### Phase 1: Foundation
**Goal**: Working MCP server scaffold with basic TypeScript tooling and stdio transport
**Depends on**: Nothing (first phase)
**Research**: Unlikely (standard TypeScript/MCP setup with documented patterns)
**Status**: ✅ Complete (2026-01-11)

Plans:
- [x] 01-01: Initialize project foundation (1/1 complete - 5min)

### Phase 2: Session Export
**Goal**: Read and parse Claude Code session files from `.claude/projects/` directory
**Depends on**: Phase 1
**Research**: ✅ Complete (2026-01-11)
**Research topics**: Claude Code session file format, .claude/projects directory structure, JSONL message chain format, UUID linking system
**Status**: ✅ Complete (2026-01-12)

Plans:
- [x] 02-01: Core session reading infrastructure (1/2 complete - 3min)
- [x] 02-02: Session discovery and metadata extraction (2/2 complete - 5min)

### Phase 3: Privacy Sanitization
**Goal**: Strip thinking blocks, sanitize file paths, redact secrets from tool results
**Depends on**: Phase 2
**Research**: Unlikely (data processing logic, no external dependencies)
**Status**: ✅ Complete (2026-01-12)

Plans:
- [x] 03-01: Thinking removal, path sanitization, secret redaction (1/1 complete - 9min)

### Phase 4: Gist Storage
**Goal**: Upload sanitized sessions to GitHub Gist and return shareable URLs
**Depends on**: Phase 3
**Research**: ✅ Complete (2026-01-11)
**Research topics**: GitHub Gist API documentation, authentication methods (personal access tokens), secret gist creation, API rate limits
**Status**: ✅ Complete (2026-01-13)

Plans:
- [x] 04-01: Gist client infrastructure (1/2 complete - 5min)
- [x] 04-02: Share tool implementation (2/2 complete - 9min)

### Phase 5: Session Import
**Goal**: Fetch shared sessions, remap UUIDs, write to local `.claude/projects/` directory
**Depends on**: Phase 4
**Research**: Unlikely (builds on session format knowledge from Phase 2)
**Status**: ✅ Complete (2026-01-12)

Plans:
- [x] 05-01: Session import infrastructure (1/2 complete - 7min)
- [x] 05-02: Import tool implementation (2/2 complete - 7min)

### Phase 6: End-to-End Verification
**Goal**: Verify imported sessions appear in `claude --resume` and are fully resumable
**Depends on**: Phase 5
**Research**: Unlikely (testing existing functionality)
**Status**: ✅ Complete (2026-01-13)

Plans:
- [x] 06-01: End-to-end integration tests and manual verification (1/1 complete - 41min)

### Phase 7: CLI Interface and Slash Commands
**Goal**: Add standalone CLI commands and slash command integration for easier usage
**Depends on**: Phase 6
**Research**: Unlikely (CLI argument parsing and command routing)
**Status**: ✅ Complete (2026-01-14)

Plans:
- [x] 07-01: CLI entry point with dual-mode detection (1/2 complete - 52min)
- [x] 07-02: MCP prompts for slash commands (2/2 complete - 1min)

**Details:**
Add CLI interface that works standalone without MCP, enabling:
- `npx claude-session-share share` - Upload to Gist, return URL
- `npx claude-session-share import <url>` - Download from Gist URL
- Slash command integration (`/share`, `/import`) for natural usage within Claude Code
- Command-line argument parsing and routing to existing services

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 1/1 | Complete | 2026-01-11 |
| 2. Session Export | v1.0 | 2/2 | Complete | 2026-01-12 |
| 3. Privacy Sanitization | v1.0 | 1/1 | Complete | 2026-01-12 |
| 4. Gist Storage | v1.0 | 2/2 | Complete | 2026-01-13 |
| 5. Session Import | v1.0 | 2/2 | Complete | 2026-01-12 |
| 6. End-to-End Verification | v1.0 | 1/1 | Complete | 2026-01-13 |
| 7. CLI Interface and Slash Commands | v1.0 | 2/2 | Complete | 2026-01-14 |
| 8. Session Format Compatibility | v1.1 | 1/1 | Complete | 2026-01-14 |

**7 of 7 phases complete - v1.0 milestone work finished!**

</details>

## 🚧 v1.1 Session Format Compatibility (In Progress)

**Milestone Goal:** Support both old (v1.x) and new (v2.0.76+) Claude Code session formats with backward compatibility

**Context:** Claude Code v2.0.76 changed session format from `snapshot.messages` array to `message.content` API response object, breaking the current tool. This milestone adds format detection and dual-format support.

### Phase 8: Session Format Compatibility

**Goal:** Detect and handle both old and new Claude Code session formats seamlessly
**Depends on:** v1.0 complete
**Research:** Unlikely (format differences already identified through debugging, internal refactoring)
**Status:** ✅ Complete (2026-01-14)

**What this phase delivers:**
- Session format version detection (old `snapshot.messages` vs new `message.content`)
- Updated TypeScript types supporting both formats
- Modified sanitization logic handling both formats
- Comprehensive tests for format detection and conversion
- All 388 existing tests continue passing (backward compatibility verified)

Plans:
- [x] 08-01: Session format compatibility implementation (1/1 complete - 7min)
