#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

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

// TODO: Tool handlers will be added in Phase 2+
// - share_session: Export current session to shareable format
// - import_session: Import session from link/file
// - list_sessions: Show available shared sessions

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
