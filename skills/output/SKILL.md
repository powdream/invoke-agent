---
description: Retrieve and show agent output by output-id. Use when the user wants to view the result of a previous invoke-agent prompt call using the output ID that was returned.
---

# Output Skill

Retrieve and display stored agent output by its output ID. After running `invoke-agent prompt`, the command returns an output ID; use this skill to view that output (stdout, stderr, file content, exit status).

**Available substitutions**: `$ARGUMENTS` or `$0` — the output ID (e.g. `/invoke-agent:output abc-123`). See [Skills docs](https://code.claude.com/docs/en/skills#available-string-substitutions).

1. **Get the output ID** from the user — the ID that was printed when they (or a previous step) ran `invoke-agent prompt`. When invoked with an argument, use `$ARGUMENTS` or `$0` as the output ID.
2. **Determine the DB path**: If `INVOKE_AGENT_DATABASE_PATH` is set, the CLI picks it up automatically and no `--db` flag is needed. Otherwise, pass `--db <project-root>/.invoke-agent/communication.db`, where `<project-root>` is the directory where the AI agent CLI (e.g. Claude Code) was originally started — you already know this from your session context.

3. **Run** in the terminal:
   ```bash
   invoke-agent output get <OUTPUT_ID> --json
   # or, if INVOKE_AGENT_DATABASE_PATH is not set:
   invoke-agent output get <OUTPUT_ID> --json --db <project-root>/.invoke-agent/communication.db
   ```
4. The command prints stdout, stderr, fileContent (if any), and statusCode for that output in JSON format.
