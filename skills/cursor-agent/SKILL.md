---
description: Invoke Cursor Agent via invoke-agent CLI with the given prompt. Use when user wants to run a one-off Cursor Agent call bound to a Claude or Gemini session.
---

# Cursor Agent Skill

Invoke the invoke-agent CLI to run a one-off Cursor Agent request bound to an existing Claude or Gemini session.

**Available substitutions**: `$ARGUMENTS` (prompt text).

1. **Get the session ID** from the user or from their environment (Claude session ID or Gemini session ID they want to bind to). To reference the current Claude Code session, use `${CLAUDE_SESSION_ID}`.
2. **Run** in the terminal:
   - For a Claude session: `invoke-agent cursor-agent --claude-session-id ${CLAUDE_SESSION_ID} "<prompt>"`
   - For a Gemini session: `invoke-agent cursor-agent --gemini-session-id ${GEMINI_SESSION_ID} "<prompt>"`
3. Use `$ARGUMENTS` as the prompt when the user invokes the skill with arguments (e.g. `/invoke-agent:cursor-agent Your prompt here`).

The command **returns an output ID** when it finishes. The user can pass that ID to the output skill to read the result (stdout, stderr, file content, exit status): run `/invoke-agent:output <output-id>` or `invoke-agent output get <output-id>` in the terminal.

If the user has not set `INVOKE_AGENT_DATABASE_PATH` or the database path, remind them to configure it or pass `--db <path>` if running invoke-agent manually.
