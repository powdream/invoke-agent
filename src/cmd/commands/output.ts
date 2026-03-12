import { Command } from '@cliffy/command';
import { randomUUIDv7 } from 'bun';
import { resolveDbPath } from '@cmd/shared/options';

const putCommand = new Command()
  .description('Store output and return an output-id')
  .option('--stdout <content:string>', 'Standard output content', { required: true })
  .option('--stderr <content:string>', 'Standard error content')
  .option('--file <filepath:string>', 'File path to include')
  .option('--status <code:integer>', 'Exit status code')
  .action((options) => {
    const dbPath = resolveDbPath(options);
    const outputId = randomUUIDv7();

    // TODO: Store to DB
    void dbPath;
    void options;

    console.log(outputId);
  });

const getCommand = new Command()
  .description('Retrieve output by output-id')
  .option('--json', 'Output result as JSON')
  .arguments('<outputId:string>')
  .action((options, outputId) => {
    const dbPath = resolveDbPath(options);

    // TODO: Fetch from DB
    const result = {
      id: outputId,
      stdout: null,
      stderr: null,
      file: null,
      status: null,
    };

    void dbPath;

    if (options.json) {
      console.log(JSON.stringify(result));
    } else {
      console.log(`Output ID: ${outputId}`);
      console.log(`  stdout: ${result.stdout ?? '(empty)'}`);
      console.log(`  stderr: ${result.stderr ?? '(empty)'}`);
      console.log(`  file: ${result.file ?? '(none)'}`);
      console.log(`  status: ${result.status ?? '(none)'}`);
    }
  });

export const outputCommand = new Command()
  .description('Manage agent outputs')
  .command('put', putCommand)
  .command('get', getCommand);
