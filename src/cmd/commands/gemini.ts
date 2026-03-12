import { Command } from "@cliffy/command";
import { resolveDbPath } from "@cmd/shared/options";

export const geminiCommand = new Command()
  .description("Invoke Gemini AI agent")
  .option(
    "--claude-session-id <sessionId:string>",
    "Claude Code CLI session ID",
    { required: true },
  )
  .option("--json", "Output result as JSON")
  .arguments("<prompt:string>")
  .action((options, prompt) => {
    const dbPath = resolveDbPath(options);

    if (options.json) {
      console.log(
        JSON.stringify({
          agent: "gemini",
          database: dbPath,
          claudeSessionId: options.claudeSessionId,
          prompt,
        }),
      );
    } else {
      console.log("Invoking Gemini agent...");
      console.log(`  Database: ${dbPath}`);
      console.log(`  Claude Session ID: ${options.claudeSessionId}`);
      console.log(`  Prompt: ${prompt}`);
    }

    // TODO: Implement actual Gemini invocation
  });
