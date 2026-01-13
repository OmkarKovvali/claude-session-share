#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { uploadSession } from "./services/session-uploader.js";
import { importSession } from "./services/session-importer.js";
import { findSessionFiles } from "./session/finder.js";
import { parseSessionFile } from "./session/reader.js";
import { homedir } from 'os';
import { join } from 'path';
import { readdir, stat } from 'fs/promises';

/**
 * MCP Server for Claude Code session sharing
 *
 * This server provides tools for exporting and importing Claude Code sessions,
 * enabling collaboration through shareable links.
 */

// Create the MCP server instance
const server = new Server(
  {
    name: "claude-session-share",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

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
 * List available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "share_session",
        description: "Share a Claude Code session via GitHub Gist. Creates a sanitized, shareable link to the conversation.",
        inputSchema: {
          type: "object",
          properties: {
            sessionPath: {
              type: "string",
              description: "Optional path to session file. If not provided, shares the most recent session.",
            },
          },
        },
      },
      {
        name: "import_session",
        description: "Import a shared Claude Code session from GitHub Gist URL or ID. Creates local resumable session in ~/.claude/projects/",
        inputSchema: {
          type: "object",
          properties: {
            gistUrl: {
              type: "string",
              description: "GitHub Gist URL (https://gist.github.com/user/id) or bare gist ID",
            },
            projectPath: {
              type: "string",
              description: "Local project directory path where session will be imported (e.g., /Users/name/project)",
            },
          },
          required: ["gistUrl", "projectPath"],
        },
      },
    ],
  };
});

/**
 * Handle tool execution
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "share_session") {
    try {
      const sessionPath = request.params.arguments?.sessionPath as string | undefined;

      // If no sessionPath provided, find most recent session
      const pathToShare = sessionPath || await findMostRecentSession();

      if (!pathToShare) {
        return {
          content: [
            {
              type: "text",
              text: "Error: No session files found. Please provide a session path or ensure you have Claude Code sessions in ~/.claude/projects/",
            },
          ],
          isError: true,
        };
      }

      // Upload session and get gist URL
      const gistUrl = await uploadSession(pathToShare);

      return {
        content: [
          {
            type: "text",
            text: `Successfully shared session!\n\nGist URL: ${gistUrl}\n\nYou can share this URL with others to give them access to this conversation.`,
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: `Failed to share session: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }

  if (request.params.name === "import_session") {
    try {
      const gistUrl = request.params.arguments?.gistUrl as string | undefined;
      const projectPath = request.params.arguments?.projectPath as string | undefined;

      // Validate inputs
      if (!gistUrl || typeof gistUrl !== 'string' || gistUrl.trim() === '') {
        return {
          content: [
            {
              type: "text",
              text: "Error: gistUrl is required and must be a non-empty string",
            },
          ],
          isError: true,
        };
      }

      if (!projectPath || typeof projectPath !== 'string' || projectPath.trim() === '') {
        return {
          content: [
            {
              type: "text",
              text: "Error: projectPath is required and must be a non-empty string",
            },
          ],
          isError: true,
        };
      }

      // Import session
      const result = await importSession(gistUrl, projectPath);

      return {
        content: [
          {
            type: "text",
            text: `Session imported successfully!\n\nSession ID: ${result.sessionId}\nMessages: ${result.messageCount}\nLocation: ${result.sessionPath}\n\nUse 'claude --resume' to see imported session.`,
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: `Import failed: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }

  throw new Error(`Unknown tool: ${request.params.name}`);
});

/**
 * Start the server with stdio transport
 * This allows the MCP server to communicate via standard input/output
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Server is now running and ready to handle MCP protocol messages
  console.error("Claude Session Share MCP server running on stdio");
}

// Export main for CLI mode, but also run if this is the entry point
export default main;

// Run main if this file is executed directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
  });
}
