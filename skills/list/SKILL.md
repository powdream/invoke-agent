---
description: List all responder agent sessions mapped to a requester session. Useful to see which agents have been invoked and read their AI-generated summaries.
---

# List Skill

Invoke the invoke-agent CLI to list all responder sessions associated with a specific requester session.

**Available substitutions**: `${CLAUDE_SESSION_ID}` (current Claude Code session ID).

1. **Get the session ID**: Typically `${CLAUDE_SESSION_ID}` unless the user specifies otherwise.
2. **Run** in the terminal:
   ```bash
   invoke-agent list --from claude --from-session-id ${CLAUDE_SESSION_ID}
   ```
3. The command will output a list of target agents, their session IDs, and an AI-generated summary (up to 300 characters) for each session thread.

If the user has not set `INVOKE_AGENT_DATABASE_PATH`, remind them to configure it.