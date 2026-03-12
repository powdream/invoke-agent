# invoke-agent

Invoke external AI agents (Claude, Cursor Agent, Gemini) from the command line and from Claude Code via the invoke-agent plugin.

## Requirements

- [Bun](https://bun.sh/) (for building and development)
- Claude Code 1.0.33+ (for the plugin)

## CLI

```bash
bun run dev          # run without building
bun run build        # compile for current and other platforms
bun run src/cmd/main.ts -- --help
```

## Claude Code plugin

This repo is also a [Claude Code](https://code.claude.com/) plugin. It adds skills to invoke the invoke-agent CLI from Claude Code.

### Install via marketplace

1. Add the powdream-plugins marketplace (if not already):
   ```
   /plugin marketplace add powdream/claude-plugins
   ```
2. Install the plugin:
   ```
   /plugin install invoke-agent@powdream-plugins
   ```

### Local development

Run Claude Code with the plugin directory:

```bash
claude --plugin-dir /path/to/invoke-agent
```

Then try:

- `/invoke-agent:install` — install the invoke-agent CLI for the current OS/arch and add it to PATH (Windows cmd/PowerShell, bash, zsh, fish).
- `/invoke-agent:claude <prompt>` — run a one-off Claude call bound to a Cursor or Gemini session (`--cursor-session-id` or `--gemini-session-id`).
- `/invoke-agent:gemini <prompt>` — run a one-off Gemini call bound to a Claude or Cursor Agent session (`--claude-session-id` or `--cursor-session-id`).
- `/invoke-agent:cursor-agent <prompt>` — run a one-off Cursor Agent call bound to a Claude or Gemini session (`--claude-session-id` or `--gemini-session-id`).
- `/invoke-agent:output <output-id>` — retrieve and show stored agent output (stdout, stderr, etc.) for a given output ID returned by claude/gemini/cursor-agent.

### Environment

- **INVOKE_AGENT_DATABASE_PATH** — path to the SQLite database file used by invoke-agent. Optional if you pass `--db <path>` when running the CLI.

## License

See [LICENSE](LICENSE) if present.
