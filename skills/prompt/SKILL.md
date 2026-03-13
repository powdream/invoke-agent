---
description: Invoke an AI agent (claude, cursor-agent, gemini) via invoke-agent CLI. Use when you need to run a cross-agent call bound to an existing session or start a new one.
---

# Prompt Skill

Invoke the invoke-agent CLI to run a request targeting a specific AI agent, continuing an existing conversation or starting a new one.

**Available substitutions**: `$ARGUMENTS` (prompt text), `${CLAUDE_SESSION_ID}` (current Claude Code session ID).

1. **Identify the roles**:
   - `to`: The target agent to invoke (`claude`, `cursor-agent`, or `gemini`).
   - `from`: The requester agent type (usually `claude` if you are running this from Claude Code).
   - `from-session-id`: The current session ID (use `${CLAUDE_SESSION_ID}`).

2. **Run** in the terminal:
   ```bash
   invoke-agent prompt --to <TARGET_AGENT> --from claude --from-session-id ${CLAUDE_SESSION_ID} "<prompt>"
   ```
   *If the user explicitly wants to start a fresh conversation instead of resuming the last one, append `--new`.*

3. The command **returns an output ID** when it finishes. You can pass that ID to the output skill (`/invoke-agent:output <output-id>`) or use `invoke-agent output get <output-id>` to read the result (stdout, stderr, file content, exit status).

If the user has not set `INVOKE_AGENT_DATABASE_PATH`, remind them to configure it or pass `--db <path>` if running invoke-agent manually.