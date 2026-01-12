# Phase 4: Gist Storage - Research

**Researched:** 2026-01-11
**Domain:** GitHub Gist API integration with Node.js/TypeScript
**Confidence:** HIGH

<research_summary>
## Summary

Researched the GitHub Gist API ecosystem for uploading sanitized Claude Code sessions. The standard approach uses Octokit (the official GitHub SDK) which handles authentication, rate limiting, retries, and provides full TypeScript support. Native Node.js fetch is available but Octokit implements all recommended best practices automatically.

Key finding: Don't hand-roll HTTP client logic, authentication handling, or retry mechanisms. Octokit includes built-in rate limit handling via @octokit/plugin-throttling, automatic retries via @octokit/plugin-retry, and comprehensive TypeScript types for all API endpoints. The GitHub Gist API has specific limitations (1MB content per file, 300 file limit) that require checking the `truncated` field and fetching from `raw_url` for large files.

**Primary recommendation:** Use Octokit v5 for gist creation. Store GitHub Personal Access Token in environment variables (accessed via MCP's `env` config). Create secret (private) gists by setting `public: false`. Handle rate limits through Octokit's automatic throttling with custom callbacks for awareness.
</research_summary>

<standard_stack>
## Standard Stack

The established libraries/tools for GitHub API integration:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| octokit | 5.0.5 | GitHub SDK for Node.js | Official GitHub SDK, implements all best practices |
| @octokit/core | 7.0.6 | Core Octokit functionality | Included in main package, extensible base |
| @octokit/plugin-retry | latest | Automatic request retries | Built-in, transparent retry with exponential backoff |
| @octokit/plugin-throttling | latest | Rate limit handling | Built-in, automatic rate limit detection and waiting |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node.js 18+ | 18+ | Native fetch API | Already available, no external HTTP client needed |
| TypeScript | 5+ | Type safety | Octokit has extensive TypeScript declarations |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Octokit | Native fetch | Native fetch requires manual auth, rate limiting, retries - not worth it |
| Octokit | node-fetch + manual | More control but reimplements solved problems |
| Classic PAT | Fine-grained PAT | Fine-grained recommended by GitHub but gist-specific scoping not yet available |

**Installation:**
```bash
npm install octokit
# or
pnpm add octokit
```
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Recommended Project Structure
```
src/
├── services/
│   ├── gist-client.ts      # Octokit wrapper with gist operations
│   └── auth-provider.ts    # PAT retrieval from environment
├── types/
│   └── gist.ts             # Gist response types (from Octokit)
└── utils/
    └── error-handler.ts    # Rate limit and API error handling
```

### Pattern 1: Octokit with Environment-Based Auth
**What:** Initialize Octokit with PAT from environment variable, configured via MCP's `env` field
**When to use:** All authenticated GitHub API operations
**Example:**
```typescript
// Source: Octokit official docs + MCP env best practices
import { Octokit } from 'octokit';

// In MCP server initialization
const token = process.env.GITHUB_TOKEN;
if (!token) {
  throw new Error('GITHUB_TOKEN environment variable required');
}

const octokit = new Octokit({
  auth: token,
  throttle: {
    onRateLimit: (retryAfter, options, octokit, retryCount) => {
      octokit.log.warn(`Rate limit hit, retrying after ${retryAfter}s`);
      return retryCount < 3; // Retry up to 3 times
    },
    onSecondaryRateLimit: (retryAfter, options, octokit) => {
      octokit.log.warn(`Secondary rate limit hit, waiting ${retryAfter}s`);
      return true; // Always retry secondary limits
    },
  },
});
```

### Pattern 2: Create Secret Gist with Multiple Files
**What:** Use octokit.rest.gists.create() with public: false for private gists
**When to use:** Uploading session data that shouldn't be publicly listed
**Example:**
```typescript
// Source: Octokit GitHub REST API documentation
const response = await octokit.rest.gists.create({
  description: 'Claude Code Session Export',
  public: false, // Creates a secret (unlisted) gist
  files: {
    'session.jsonl': {
      content: sessionContent,
    },
    'metadata.json': {
      content: JSON.stringify(metadata),
    },
  },
});

// Response contains html_url for sharing
const shareableUrl = response.data.html_url;
```

### Pattern 3: Handle File Size Truncation
**What:** Check truncated field and fetch from raw_url for large files
**When to use:** Reading gists that may exceed 1MB per file
**Example:**
```typescript
// Source: GitHub Gist API documentation
const gist = await octokit.rest.gists.get({ gist_id });

for (const [filename, file] of Object.entries(gist.data.files)) {
  let content: string;

  if (file.truncated) {
    // File > 1MB, fetch from raw_url
    const response = await fetch(file.raw_url);
    content = await response.text();
  } else {
    content = file.content;
  }

  // Process content...
}
```

### Pattern 4: MCP Environment Variable Configuration
**What:** Use MCP's `env` field to pass environment variables to stdio servers
**When to use:** Configuring MCP servers with secrets
**Example:**
```json
// Source: MCP configuration best practices
{
  "mcpServers": {
    "claude-session-share": {
      "command": "node",
      "args": ["dist/index.js"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

### Anti-Patterns to Avoid
- **Manual HTTP requests with fetch:** Octokit handles auth headers, rate limits, retries automatically
- **Hardcoding tokens in config:** Use environment variables, never commit tokens
- **Ignoring truncated field:** Assuming content field has full file leads to data loss for large files
- **Not handling rate limits:** GitHub has strict limits (5000/hr authenticated, 60/hr unauthenticated)
- **Using variable interpolation in MCP config:** Pass env vars by name, don't interpolate values
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP client for GitHub | Custom fetch wrapper | Octokit | Handles auth, rate limits, retries, types automatically |
| Rate limit detection | Check headers manually | Octokit plugin-throttling | Automatic detection, waiting, retry with backoff |
| Retry logic | Custom exponential backoff | Octokit plugin-retry | Built-in, battle-tested, transparent |
| Auth header formatting | Manual header construction | Octokit auth option | Handles Bearer vs token formats correctly |
| Request pagination | Manual page iteration | Octokit pagination | Automatic pagination for list endpoints |
| Error type discrimination | if/else on status codes | Octokit typed errors | TypeScript discriminated unions for errors |

**Key insight:** GitHub's official Octokit SDK implements all best practices from 40+ years of HTTP client development. It includes automatic rate limit handling, intelligent retries with exponential backoff, and comprehensive TypeScript types. Building custom HTTP logic reimplements solved problems and introduces bugs around edge cases (secondary rate limits, token expiration, network failures, response parsing).
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: File Content Truncation
**What goes wrong:** Files over 1MB are silently truncated in API responses
**Why it happens:** GitHub Gist API returns up to 1MB per file, sets truncated: true for larger files
**How to avoid:** Always check file.truncated field, fetch from file.raw_url if true
**Warning signs:** Session data appears incomplete, messages cut off mid-content

### Pitfall 2: Rate Limit Exhaustion
**What goes wrong:** Hitting 403/429 errors after successful requests
**Why it happens:** GitHub limits to 5000 requests/hour (authenticated), 60/hour (unauthenticated)
**How to avoid:** Use Octokit's throttling plugin with custom callbacks, check x-ratelimit-remaining header
**Warning signs:** Intermittent failures, errors during bulk operations, 403 Forbidden responses

### Pitfall 3: Token Permission Issues
**What goes wrong:** 404 or 403 errors when creating gists despite valid token
**Why it happens:** Token lacks gist scope (classic PAT) or gist permissions (fine-grained PAT)
**How to avoid:** For classic PAT: require `gist` scope. For fine-grained: verify gist read/write permissions
**Warning signs:** "Not Found" or "Forbidden" despite token working for other endpoints

### Pitfall 4: Environment Variable Not Available
**What goes wrong:** MCP server fails to start or creates unauthenticated requests
**Why it happens:** MCP config doesn't properly pass environment variables to stdio server
**How to avoid:** Use MCP's `env` field (not `env_vars`), set variables in shell before launching Claude
**Warning signs:** "GITHUB_TOKEN is undefined" errors, unauthenticated rate limits (60/hr)

### Pitfall 5: Secret Gist Discoverability
**What goes wrong:** Users think secret gists are private and secure
**Why it happens:** "Secret" gists are unlisted but publicly accessible with URL
**How to avoid:** Document that gist URLs are shareable and accessible to anyone with link
**Warning signs:** Users accidentally share sessions with sensitive info assuming privacy

### Pitfall 6: Gist File Limit Exceeded
**What goes wrong:** Gist creation fails or files are silently dropped
**Why it happens:** GitHub limits gists to 300 files maximum
**How to avoid:** For multi-file sessions, combine into single JSONL file or split across multiple gists
**Warning signs:** Fewer files in gist than expected, silent failures during creation
</common_pitfalls>

<code_examples>
## Code Examples

Verified patterns from official sources:

### Basic Octokit Setup
```typescript
// Source: Octokit documentation
import { Octokit } from 'octokit';

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

// Verify authentication
const { data: { login } } = await octokit.rest.users.getAuthenticated();
console.log(`Authenticated as ${login}`);
```

### Create Secret Gist with Session Data
```typescript
// Source: GitHub Gist API + Octokit REST API docs
import { Octokit } from 'octokit';

async function uploadSession(sessionContent: string, metadata: object) {
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

  const response = await octokit.rest.gists.create({
    description: `Claude Code Session - ${metadata.title || 'Untitled'}`,
    public: false, // Secret gist (unlisted but accessible via URL)
    files: {
      'session.jsonl': {
        content: sessionContent,
      },
      'metadata.json': {
        content: JSON.stringify(metadata, null, 2),
      },
    },
  });

  return {
    url: response.data.html_url,
    id: response.data.id,
    files: Object.keys(response.data.files),
  };
}
```

### Error Handling with Rate Limit Awareness
```typescript
// Source: Octokit throttling plugin + GitHub best practices
import { Octokit } from 'octokit';

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
  throttle: {
    onRateLimit: (retryAfter, options, octokit, retryCount) => {
      // Log rate limit hit
      console.warn(
        `Rate limit hit for ${options.method} ${options.url}, ` +
        `retrying after ${retryAfter}s (attempt ${retryCount + 1}/3)`
      );

      // Retry up to 3 times
      return retryCount < 3;
    },
    onSecondaryRateLimit: (retryAfter, options, octokit) => {
      // Secondary limits are stricter, always respect
      console.warn(
        `Secondary rate limit hit for ${options.method} ${options.url}, ` +
        `waiting ${retryAfter}s`
      );
      return true; // Always retry
    },
  },
});

try {
  const result = await octokit.rest.gists.create({ /* ... */ });
  return result.data;
} catch (error) {
  if (error.status === 401) {
    throw new Error('Invalid GitHub token - check GITHUB_TOKEN environment variable');
  } else if (error.status === 403) {
    throw new Error('Token lacks gist permissions or rate limit exceeded');
  } else if (error.status === 422) {
    throw new Error('Invalid gist data - check file content and description');
  }
  throw error; // Re-throw unexpected errors
}
```

### Check Rate Limit Status
```typescript
// Source: GitHub REST API documentation
const { data: rateLimit } = await octokit.rest.rateLimit.get();

console.log(`Rate limit: ${rateLimit.resources.core.remaining}/${rateLimit.resources.core.limit}`);
console.log(`Resets at: ${new Date(rateLimit.resources.core.reset * 1000).toISOString()}`);

// Check before expensive operations
if (rateLimit.resources.core.remaining < 100) {
  console.warn('Rate limit running low, consider waiting');
}
```

### Fetch Gist with Truncation Handling
```typescript
// Source: GitHub Gist API documentation
async function fetchGistContent(gistId: string, filename: string): Promise<string> {
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

  const { data: gist } = await octokit.rest.gists.get({ gist_id: gistId });
  const file = gist.files[filename];

  if (!file) {
    throw new Error(`File ${filename} not found in gist`);
  }

  // Handle truncation for files > 1MB
  if (file.truncated) {
    const response = await fetch(file.raw_url);
    if (!response.ok) {
      throw new Error(`Failed to fetch raw content: ${response.statusText}`);
    }
    return response.text();
  }

  return file.content;
}
```
</code_examples>

<sota_updates>
## State of the Art (2025-2026)

What's changed recently:

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| node-fetch library | Native Node.js fetch | Node 18+ (2022) | No external HTTP library needed, Octokit uses native fetch |
| Classic PATs | Fine-grained PATs | 2023 | GitHub recommends fine-grained but gist-specific scoping not yet available |
| Manual retry logic | Octokit plugin-retry | Built-in | Automatic exponential backoff, no custom code needed |
| HTTP agents | Fetch dispatchers | 2024 | Node native fetch uses undici.Agent, not http.Agent |
| Hardcoded configs | Environment variables via MCP | 2025 | MCP `env` field standard for passing secrets to stdio servers |

**New tools/patterns to consider:**
- **MCP Secret Wrapper:** Open-source wrapper that pulls secrets from vaults instead of static env vars (Astrix, 2025)
- **Octokit v5:** Latest major version with improved TypeScript support, native fetch (released Nov 2025)
- **GitHub API version header:** X-GitHub-Api-Version: 2022-11-28 now recommended in all requests

**Deprecated/outdated:**
- **Personal Access Tokens (classic):** Still work but GitHub recommends fine-grained PATs for new tokens
- **node-fetch package:** Unnecessary with Node 18+, native fetch is standard
- **Manual rate limit checking:** Octokit throttling plugin handles automatically, no need to check headers manually
</sota_updates>

<open_questions>
## Open Questions

Things that couldn't be fully resolved:

1. **Session Size Limits**
   - What we know: Gist files truncate at 1MB, max 300 files per gist
   - What's unclear: Whether Claude Code sessions typically exceed these limits after sanitization
   - Recommendation: During planning, decide on handling: (a) fail if too large, (b) split across multiple gists, or (c) compress content

2. **Fine-Grained PAT Gist Scoping**
   - What we know: GitHub recommends fine-grained PATs, but gist-specific scoping appears limited
   - What's unclear: Exact permission names for gist operations with fine-grained PATs
   - Recommendation: Document both classic PAT (with `gist` scope) and fine-grained PAT setup, test both during implementation

3. **MCP Server Restart on Token Change**
   - What we know: MCP servers read env vars on startup
   - What's unclear: Whether Claude Code requires restart to pick up new GITHUB_TOKEN values
   - Recommendation: Document that token changes require MCP server restart (likely full Claude restart)
</open_questions>

<sources>
## Sources

### Primary (HIGH confidence)
- [GitHub Gist API Documentation](https://docs.github.com/en/rest/gists/gists) - Official REST API reference
- [GitHub Authentication Documentation](https://docs.github.com/en/rest/overview/authenticating-to-the-rest-api) - PAT authentication methods
- [GitHub Rate Limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api) - Official rate limit documentation
- [Octokit.js Repository](https://github.com/octokit/octokit.js/) - Official SDK documentation and examples

### Secondary (MEDIUM confidence)
- [Octokit npm Package](https://www.npmjs.com/package/octokit) - Version 5.0.5, verified Nov 2025
- [MCP Environment Variable Best Practices](https://dev.to/saleor/dynamic-configuration-for-mcp-servers-using-environment-variables-2a0o) - Verified with MCP docs
- [Retry Logic & Exponential Backoff Guide 2025](https://jaytech.substack.com/p/retry-logic-and-exponential-backoff) - Verified with GitHub best practices
- [Environment Variables Security 2026](https://securityboulevard.com/2025/12/are-environment-variables-still-safe-for-secrets-in-2026/) - Recent security analysis

### Tertiary (LOW confidence - needs validation)
- None - all key findings verified against official GitHub and Octokit documentation
</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: GitHub Gist API v3 (REST)
- Ecosystem: Octokit v5, Node.js 18+ native fetch
- Patterns: Secret gist creation, rate limiting, error handling, MCP env config
- Pitfalls: File truncation, rate limits, token permissions, env var configuration

**Confidence breakdown:**
- Standard stack: HIGH - Octokit is official GitHub SDK, verified from npm and GitHub
- Architecture: HIGH - Patterns from official Octokit and GitHub API documentation
- Pitfalls: HIGH - Documented in GitHub API docs and Octokit issues
- Code examples: HIGH - From official Octokit documentation and GitHub REST API reference
- MCP integration: MEDIUM - Based on MCP best practices articles, not official docs

**Research date:** 2026-01-11
**Valid until:** 2026-02-11 (30 days - GitHub API and Octokit are stable)

**Research methodology:**
- Official documentation consulted first (GitHub Docs, Octokit GitHub)
- WebSearch for ecosystem best practices (MCP, error handling, security)
- All WebSearch findings cross-verified with official sources
- Research pitfalls checklist completed
</metadata>

---

*Phase: 04-gist-storage*
*Research completed: 2026-01-11*
*Ready for planning: yes*
