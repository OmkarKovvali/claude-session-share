#!/usr/bin/env node
/**
 * CLI entry point for Claude Session Share
 *
 * Provides standalone command-line interface:
 * - share: Upload session to Gist
 * - import: Download session from Gist
 *
 * Also detects MCP mode when stdin is piped (no TTY).
 */

import { uploadSession } from './services/session-uploader.js';
import { importSession } from './services/session-importer.js';
import { stdin } from 'process';
import { homedir } from 'os';
import { join } from 'path';
import { readdir, stat } from 'fs/promises';

/**
 * Find the most recent session file
 * Searches ~/.claude/projects/ for all session files and returns the most recently modified one
 */
async function findMostRecentSession(): Promise<string | null> {
  const projectsDir = join(homedir(), '.claude', 'projects');

  try {
    // Get all subdirectories in ~/.claude/projects/
    const entries = await readdir(projectsDir, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);

    let mostRecentFile: string | null = null;
    let mostRecentTime = 0;

    // Search each project directory for session files
    for (const dir of dirs) {
      const dirPath = join(projectsDir, dir);
      try {
        const files = await readdir(dirPath);

        for (const file of files) {
          if (file.endsWith('.jsonl')) {
            const filePath = join(dirPath, file);
            const stats = await stat(filePath);

            if (stats.mtimeMs > mostRecentTime) {
              mostRecentTime = stats.mtimeMs;
              mostRecentFile = filePath;
            }
          }
        }
      } catch (err) {
        // Skip directories we can't read
        continue;
      }
    }

    return mostRecentFile;
  } catch (err) {
    throw new Error(`Failed to find sessions: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Parse command-line arguments for share command
 * Returns session path or null for auto-detect
 */
function parseShareArgs(args: string[]): string | null {
  // Look for --session-path flag
  const pathIndex = args.indexOf('--session-path');
  if (pathIndex !== -1 && pathIndex + 1 < args.length) {
    return args[pathIndex + 1];
  }
  return null; // Auto-detect most recent
}

/**
 * Parse command-line arguments for import command
 * Returns { gistUrl, projectPath } or throws if invalid
 */
function parseImportArgs(args: string[]): { gistUrl: string; projectPath: string } {
  // First positional arg after "import" is gist URL
  const gistUrl = args[0];
  if (!gistUrl) {
    throw new Error('Missing required argument: gist-url\nUsage: import <gist-url> [--project-path <path>]');
  }

  // Look for --project-path flag, default to cwd
  const pathIndex = args.indexOf('--project-path');
  const projectPath = pathIndex !== -1 && pathIndex + 1 < args.length
    ? args[pathIndex + 1]
    : process.cwd();

  return { gistUrl, projectPath };
}

/**
 * Display usage information
 */
function showUsage(): void {
  console.log(`
Claude Session Share - CLI for sharing Claude Code sessions

USAGE:
  claude-session-share <command> [options]

COMMANDS:
  share                     Share most recent session to GitHub Gist
  share --session-path PATH Share specific session file
  import <gist-url>         Import session from GitHub Gist to current directory
  import <gist-url> --project-path PATH
                            Import session to specific directory

EXAMPLES:
  # Share most recent session
  claude-session-share share

  # Share specific session
  claude-session-share share --session-path ~/.claude/projects/abc/session.jsonl

  # Import session to current directory
  claude-session-share import https://gist.github.com/user/abc123

  # Import to specific directory
  claude-session-share import abc123 --project-path /Users/name/project

ENVIRONMENT:
  GITHUB_TOKEN    Required for both share and import operations
                  Get token at https://github.com/settings/tokens
                  Needs 'gist' scope for creating/reading gists
`);
}

/**
 * Main CLI entry point
 */
async function main() {
  const args = process.argv.slice(2);

  // If no args and stdin is not a TTY, assume MCP stdio mode
  if (args.length === 0 && !stdin.isTTY) {
    // Import and run MCP server
    const { default: runMCPServer } = await import('./index.js');
    return runMCPServer();
  }

  // CLI mode: require at least one argument
  if (args.length === 0) {
    showUsage();
    process.exit(1);
  }

  const command = args[0];

  try {
    if (command === 'share') {
      // Parse share arguments
      const sessionPath = parseShareArgs(args.slice(1));

      // Find session to share
      const pathToShare = sessionPath || await findMostRecentSession();

      if (!pathToShare) {
        console.error('Error: No session files found in ~/.claude/projects/');
        console.error('Please provide a session path with --session-path');
        process.exit(1);
      }

      // Upload session
      console.log(`Uploading session: ${pathToShare}`);
      const gistUrl = await uploadSession(pathToShare);

      console.log('\n✓ Session shared successfully!');
      console.log(`\nGist URL: ${gistUrl}`);
      console.log('\nShare this URL to give others access to the conversation.');

    } else if (command === 'import') {
      // Parse import arguments
      const { gistUrl, projectPath } = parseImportArgs(args.slice(1));

      // Import session
      console.log(`Importing session from: ${gistUrl}`);
      console.log(`Target directory: ${projectPath}`);

      const result = await importSession(gistUrl, projectPath);

      console.log('\n✓ Session imported successfully!');
      console.log(`\nSession ID: ${result.sessionId}`);
      console.log(`Messages: ${result.messageCount}`);
      console.log(`Location: ${result.sessionPath}`);
      console.log(`\nUse 'claude --resume' to see imported session.`);

    } else {
      console.error(`Error: Unknown command '${command}'`);
      console.error('');
      showUsage();
      process.exit(1);
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`\nError: ${errorMessage}`);
    process.exit(1);
  }
}

// Export main for MCP mode, but also run if this is the entry point
export default main;

// Run main if this file is executed directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
