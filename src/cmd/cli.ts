import { Command } from "@cliffy/command";
import { geminiCommand } from "@cmd/commands/gemini";
import { outputCommand } from "@cmd/commands/output";
import packageJson from "../../package.json";

export const command = new Command()
    .name("invoke-agent")
    .version(packageJson.version)
    .description("Invoke external AI agents from Claude Code CLI")
    .globalOption("--db <filepath:string>", "Path to the SQLite database file")
    .env(
        "INVOKE_AGENT_DATABASE_PATH=<filepath:string>",
        "Path to the SQLite database file",
        {
            global: true,
        },
    )
    .command("gemini", geminiCommand)
    .command("output", outputCommand);
