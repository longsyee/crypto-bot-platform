#!/usr/bin/env node
import { startStdioServer } from "./server.js";

async function main() {
  console.error("[NexusBot MCP] Starting stdio server...");
  try {
    await startStdioServer();
  } catch (err) {
    console.error("[NexusBot MCP] Fatal error:", err);
    process.exit(1);
  }
}

main();
