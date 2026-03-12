---
description: Invoke Claude via invoke-agent CLI with the given prompt. Use when user wants to run a one-off Claude call bound to a Cursor/Gemini session.
---

# Claude Skill

Invoke the invoke-agent CLI to run a one-off Claude request bound to an existing Cursor Agent or Gemini session.

**Available substitutions** (see [Skills docs](https://code.claude.com/docs/en/skills#available-string-substitutions)): `$ARGUMENTS` (prompt text), `${CLAUDE_SESSION_ID}` (current Claude Code session ID — use when binding/correlating with this session).

1. **Get the session ID** from the user or from their environment (e.g. Cursor Agent session ID or Gemini session ID they want to bind to). If they want to reference the current Claude Code session, use `${CLAUDE_SESSION_ID}`.
2. **Run** in the terminal:
   - For a Cursor session: `invoke-agent claude --cursor-session-id ${CURSOR_SESSION_ID} "<prompt>"`
   - For a Gemini session: `invoke-agent claude --gemini-session-id ${GEMINI_SESSION_ID} "<prompt>"`
3. Use `$ARGUMENTS` as the prompt when the user invokes the skill with arguments (e.g. `/invoke-agent:claude Your prompt here`).

The command **returns an output ID** when it finishes. The user can pass that ID to the output skill to read the result (stdout, stderr, file content, exit status): run `/invoke-agent:output <output-id>` or `invoke-agent output get <output-id>` in the terminal.

If the user has not set `INVOKE_AGENT_DATABASE_PATH` or the database path, remind them to configure it or pass `--db <path>` if running invoke-agent manually.
