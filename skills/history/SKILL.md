---
description: Print the full chronological history (prompts and responses) for a specific agent session thread.
---

# History Skill

Invoke the invoke-agent CLI to view the complete conversation history of a specific responder session thread.

1. **Identify the target session**:
   - `to`: The target agent (`claude`, `cursor-agent`, or `gemini`).
   - `to-session-id`: The session ID of the responder agent.

2. **Run** in the terminal:
   ```bash
   invoke-agent history --to <TARGET_AGENT> --to-session-id <SESSION_ID>
   ```

3. The command will print all user prompts and agent responses (stdout, fileContent, stderr) sequentially.