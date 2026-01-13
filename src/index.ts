#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { uploadSession } from "./services/session-uploader.js";
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

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
