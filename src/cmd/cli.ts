import { Command } from '@cliffy/command';
import { promptCommand } from '@cmd/commands/prompt';
import { listCommand } from '@cmd/commands/list';
import { summaryCommand } from '@cmd/commands/summary';
import { historyCommand } from '@cmd/commands/history';
import { outputCommand } from '@cmd/commands/output';
import packageJson from '../../package.json';

export const command = new Command()
  .name('invoke-agent')
  .version(packageJson.version)
  .description('Invoke external AI agents from Claude Code CLI')
  .globalOption('--db <filepath:string>', 'Path to the SQLite database file')
  .env('INVOKE_AGENT_DATABASE_PATH=<filepath:string>', 'Path to the SQLite database file', {
    global: true,
  })
  .command('prompt', promptCommand)
  .command('list', listCommand)
  .command('summary', summaryCommand)
  .command('history', historyCommand)
  .command('output', outputCommand);
