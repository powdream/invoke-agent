---
description: Generate or retrieve an AI-powered summary for a specific agent session thread.
---

# Summary Skill

Invoke the invoke-agent CLI to fetch (or generate) a one-paragraph summary of a specific responder session thread.

1. **Identify the target session**:
   - `to`: The target agent (`claude`, `cursor-agent`, or `gemini`).
   - `to-session-id`: The session ID of the responder agent.

2. **Run** in the terminal:
   ```bash
   invoke-agent summary --to <TARGET_AGENT> --to-session-id <SESSION_ID>
   ```

3. The command will output a summary of the conversation history.