# Setup Guide

## 1. Install agent-browser (prerequisite)

```bash
npm install -g agent-browser
agent-browser install
```

This installs the core browser automation CLI and downloads Chrome for Testing.

Verify it's working:

```bash
agent-browser open https://example.com
agent-browser snapshot
agent-browser close
```

## 2. Add both MCP servers to Claude Code

Open your Claude Code settings and add the following to the `mcpServers` section.

**Via the CLI:**

```bash
claude mcp add agent-browser -- agent-browser --json mcp
claude mcp add agent-browser-console -- npx -y github:theprintspace/agent-browser-console
```

**Or manually in `~/.claude.json`:**

```json
{
  "mcpServers": {
    "agent-browser": {
      "command": "agent-browser",
      "args": ["--json", "mcp"]
    },
    "agent-browser-console": {
      "command": "npx",
      "args": ["-y", "github:theprintspace/agent-browser-console"]
    }
  }
}
```

> You can also add these to a project-level `.claude/settings.json` instead of the global `~/.claude.json` if you prefer per-project config.

## 3. Restart Claude Code

After updating the MCP config, restart Claude Code so it picks up the new servers. You should see both sets of tools available:

- **agent-browser** tools: `browser_open`, `browser_click`, `browser_fill`, `browser_snapshot`, `browser_screenshot`, etc.
- **agent-browser-console** tools: `console_start`, `console_read`, `console_clear`, `console_eval`

## 4. Verify it works

In a Claude Code conversation, try:

```
Open https://example.com in the browser, install the console interceptor,
run console.log("hello"), and read the logs back.
```

You should see the captured log output.

## How it works

The `agent-browser` MCP has a shell escaping issue where complex JavaScript (arrow functions, parentheses, etc.) gets mangled when passed through `browser_evaluate`. This server works around that by calling `agent-browser eval -b <base64>` under the hood, which bypasses shell interpretation entirely.

### Tools

| Tool | What it does |
|------|-------------|
| `console_start` | Injects a console interceptor into the current page. Captures `log`, `error`, `warn`, `info`, and `debug`. Call again after any page navigation. |
| `console_read` | Returns captured logs. Optional `type` filter (`log`, `error`, `warn`, `info`, `debug`, `all`) and `clear` flag to empty the buffer after reading. |
| `console_clear` | Empties the captured log buffer. |
| `console_eval` | Runs arbitrary JavaScript in the browser context without shell escaping issues. Useful for any complex JS beyond console logging. |

### Typical workflow

1. `browser_open` a URL (agent-browser tool)
2. `console_start` to install the interceptor
3. Interact with the page using agent-browser tools (`browser_click`, `browser_fill`, etc.)
4. `console_read` to see what the page logged
5. If you navigate to a new page, call `console_start` again (the interceptor resets on navigation)

### Limitations

- The interceptor only captures logs **after** `console_start` is called — it can't retroactively capture logs from page load
- Page navigations reset the interceptor — call `console_start` again after navigation
- Very large log volumes may slow down `console_read` — use `clear: true` to flush regularly
