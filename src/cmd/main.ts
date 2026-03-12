import { command } from "@cmd/cli";

if (import.meta.main) {
    await command.parse(Bun.argv.slice(2));
}
