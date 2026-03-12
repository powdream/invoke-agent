import { Command } from '@cliffy/command';
import { Database } from 'bun:sqlite';
import { resolveDbPath } from '@cmd/shared/options';
import { SqliteClient } from '@lib/api/sqlite';

const putCommand = new Command()
  .description('Store output and return an output-id')
  .option('--stdout <content:string>', 'Standard output content', { required: true })
  .option('--stderr <content:string>', 'Standard error content')
  .option('--file <filepath:string>', 'File path to read content from')
  .option('--status <code:integer>', 'Exit status code')
  .option('--json', 'Output result as JSON')
  .action(async (options) => {
    const dbPath = resolveDbPath(options);
    const db = new Database(dbPath);
    const storage = new SqliteClient(db);

    try {
      let fileContent: string | undefined;
      if (options.file) {
        fileContent = await Bun.file(options.file).text();
      }

      const outputId = await storage.output.put({
        stdout: options.stdout,
        stderr: options.stderr,
        fileContent,
        statusCode: options.status,
      });

      if (options.json) {
        console.log(JSON.stringify({ outputId }));
      } else {
        console.log(outputId);
      }
    } finally {
      db.close();
    }
  });

const getCommand = new Command()
  .description('Retrieve output by output-id')
  .option('--json', 'Output result as JSON')
  .arguments('<outputId:string>')
  .action(async (options, outputId) => {
    const dbPath = resolveDbPath(options);
    const db = new Database(dbPath);
    const storage = new SqliteClient(db);

    try {
      const result = await storage.output.lookup(outputId);

      if (!result) {
        console.error(`Output not found: ${outputId}`);
        process.exit(1);
      }

      if (options.json) {
        console.log(JSON.stringify({ outputId, ...result }));
      } else {
        console.log(`Output ID: ${outputId}`);
        console.log(`  stdout: ${result.stdout || '(empty)'}`);
        console.log(`  stderr: ${result.stderr ?? '(empty)'}`);
        console.log(`  fileContent: ${result.fileContent ?? '(none)'}`);
        console.log(`  statusCode: ${result.statusCode ?? '(none)'}`);
      }
    } finally {
      db.close();
    }
  });

export const outputCommand = new Command()
  .description('Manage agent outputs')
  .command('put', putCommand)
  .command('get', getCommand);
