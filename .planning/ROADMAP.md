# Roadmap: claude-session-share

## Overview

Build an MCP server that enables Claude Code session sharing through GitHub Gist. The journey moves from foundation setup through session export/sanitization, Gist integration, and session import, culminating in end-to-end verification that imported sessions are fully resumable and indistinguishable from native sessions.

## Domain Expertise

None

## Phases

- [x] **Phase 1: Foundation** - Project setup and MCP server scaffold (Completed: 2026-01-11)
- [x] **Phase 2: Session Export** - Export Claude Code sessions to sanitized format (Completed: 2026-01-12)
- [ ] **Phase 3: Privacy Sanitization** - Strip thinking blocks, sanitize paths, redact secrets
- [ ] **Phase 4: Gist Storage** - GitHub Gist integration for sharing
- [ ] **Phase 5: Session Import** - Import sessions with UUID remapping and local storage
- [ ] **Phase 6: End-to-End Verification** - Round-trip testing and `claude --resume` integration

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
**Plans**: TBD

Plans:
- TBD (will be defined during phase planning)

### Phase 4: Gist Storage
**Goal**: Upload sanitized sessions to GitHub Gist and return shareable URLs
**Depends on**: Phase 3
**Research**: Likely (external API integration)
**Research topics**: GitHub Gist API documentation, authentication methods (personal access tokens), secret gist creation, API rate limits
**Plans**: TBD

Plans:
- TBD (will be defined during phase planning)

### Phase 5: Session Import
**Goal**: Fetch shared sessions, remap UUIDs, write to local `.claude/projects/` directory
**Depends on**: Phase 4
**Research**: Unlikely (builds on session format knowledge from Phase 2)
**Plans**: TBD

Plans:
- TBD (will be defined during phase planning)

### Phase 6: End-to-End Verification
**Goal**: Verify imported sessions appear in `claude --resume` and are fully resumable
**Depends on**: Phase 5
**Research**: Unlikely (testing existing functionality)
**Plans**: TBD

Plans:
- TBD (will be defined during phase planning)

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 1/1 | Complete | 2026-01-11 |
| 2. Session Export | 2/2 | Complete | 2026-01-12 |
| 3. Privacy Sanitization | 0/TBD | Not started | - |
| 4. Gist Storage | 0/TBD | Not started | - |
| 5. Session Import | 0/TBD | Not started | - |
| 6. End-to-End Verification | 0/TBD | Not started | - |
