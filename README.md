# agent-browser-console

MCP server that adds console log capture to [agent-browser](https://github.com/vercel-labs/agent-browser).

## Prerequisites

- [agent-browser](https://github.com/vercel-labs/agent-browser) installed globally (`npm i -g agent-browser`)

## Installation

```bash
npm install -g @theprintspace/agent-browser-console
```

## Claude Code Setup

Add to your Claude Code MCP settings (`.claude.json` or via Settings):

```json
{
  "mcpServers": {
    "agent-browser-console": {
      "command": "agent-browser-console"
    }
  }
}
```

## Tools

### console_start

Install the console log interceptor on the current page. Call after navigating to a page (resets on navigation).

### console_read

Read captured logs. Options:

- `type` — filter by `log`, `error`, `warn`, `info`, `debug`, or `all` (default)
- `clear` — clear logs after reading (default: false)

### console_clear

Clear all captured logs.

### console_eval

Evaluate arbitrary JavaScript in the browser context. This bypasses the shell escaping issues that affect agent-browser's built-in `browser_evaluate` MCP tool with complex scripts.

## Usage

Typical workflow:

1. Navigate with agent-browser: `browser_open` to a URL
2. `console_start` to install the interceptor
3. Interact with the page (click buttons, fill forms, etc.)
4. `console_read` to see what was logged
5. After navigation, call `console_start` again (interceptor resets on page load)
