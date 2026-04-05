#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { execFile } from "child_process";
import { promisify } from "util";

const exec = promisify(execFile);

async function agentBrowserEval(js) {
  const b64 = Buffer.from(js).toString("base64");
  const { stdout } = await exec("agent-browser", ["eval", "-b", b64], {
    timeout: 30000,
  });
  return stdout.trim();
}

const INTERCEPTOR_JS = `
(function() {
  if (window.__consoleInterceptorInstalled) return "already installed";
  window.__capturedLogs = [];
  var oLog = console.log;
  var oErr = console.error;
  var oWarn = console.warn;
  var oInfo = console.info;
  var oDebug = console.debug;
  function capture(type, origFn, args) {
    try {
      var parts = [];
      for (var i = 0; i < args.length; i++) {
        try {
          parts.push(typeof args[i] === "object" ? JSON.stringify(args[i]) : String(args[i]));
        } catch(e) {
          parts.push("[unserializable]");
        }
      }
      window.__capturedLogs.push({ type: type, msg: parts.join(" "), ts: Date.now() });
    } catch(e) {}
    origFn.apply(console, args);
  }
  console.log = function() { capture("log", oLog, arguments); };
  console.error = function() { capture("error", oErr, arguments); };
  console.warn = function() { capture("warn", oWarn, arguments); };
  console.info = function() { capture("info", oInfo, arguments); };
  console.debug = function() { capture("debug", oDebug, arguments); };
  window.__consoleInterceptorInstalled = true;
  return "interceptor installed";
})()
`;

const server = new McpServer({
  name: "agent-browser-console",
  version: "1.0.0",
});

server.tool(
  "console_start",
  "Install console log interceptor on the current page. Call this after navigating to a page (interceptor resets on navigation).",
  {},
  async () => {
    try {
      const result = await agentBrowserEval(INTERCEPTOR_JS);
      return { content: [{ type: "text", text: result }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

server.tool(
  "console_read",
  "Read captured console logs. Returns all logs since last clear (or since interceptor was installed).",
  {
    type: z.enum(["all", "log", "error", "warn", "info", "debug"]).optional().describe("Filter by log type. Default: all"),
    clear: z.boolean().optional().describe("Clear logs after reading. Default: false"),
  },
  async ({ type, clear }) => {
    try {
      const filterType = type || "all";
      const shouldClear = clear || false;
      const js = `
        (function() {
          var logs = window.__capturedLogs || [];
          var filtered = ${filterType === "all" ? "logs" : `logs.filter(function(l) { return l.type === "${filterType}"; })`};
          ${shouldClear ? "window.__capturedLogs = [];" : ""}
          return JSON.stringify(filtered);
        })()
      `;
      const result = await agentBrowserEval(js);
      const parsed = JSON.parse(result || "[]");
      if (parsed.length === 0) {
        return { content: [{ type: "text", text: "No console logs captured." }] };
      }
      const formatted = parsed
        .map((l) => `[${l.type.toUpperCase()}] ${l.msg}`)
        .join("\n");
      return { content: [{ type: "text", text: formatted }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

server.tool(
  "console_clear",
  "Clear all captured console logs.",
  {},
  async () => {
    try {
      await agentBrowserEval("window.__capturedLogs = []; 'cleared'");
      return { content: [{ type: "text", text: "Console logs cleared." }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

server.tool(
  "console_eval",
  "Evaluate arbitrary JavaScript in the browser. Bypasses shell escaping issues with agent-browser's built-in eval.",
  {
    script: z.string().describe("JavaScript code to evaluate in the browser context"),
  },
  async ({ script }) => {
    try {
      const result = await agentBrowserEval(script);
      return { content: [{ type: "text", text: result || "(no output)" }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
