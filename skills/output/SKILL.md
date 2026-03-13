---
description: Retrieve and show agent output by output-id. Use when the user wants to view the result of a previous invoke-agent prompt call using the output ID that was returned.
---

# Output Skill

Retrieve and display stored agent output by its output ID. After running `invoke-agent prompt`, the command returns an output ID; use this skill to view that output (stdout, stderr, file content, exit status).

**Available substitutions**: `$ARGUMENTS` or `$0` — the output ID (e.g. `/invoke-agent:output abc-123`). See [Skills docs](https://code.claude.com/docs/en/skills#available-string-substitutions).

1. **Get the output ID** from the user — the ID that was printed when they (or a previous step) ran `invoke-agent prompt`. When invoked with an argument, use `$ARGUMENTS` or `$0` as the output ID.
2. **Run** in the terminal:
   ```bash
   invoke-agent output get <OUTPUT_ID>
   ```
3. The command prints stdout, stderr, fileContent (if any), and statusCode for that output. For JSON: `invoke-agent output get <OUTPUT_ID> --json`.

If the user has not set `INVOKE_AGENT_DATABASE_PATH`, remind them to configure it or pass `--db <path>` so the same database is used for lookup.
