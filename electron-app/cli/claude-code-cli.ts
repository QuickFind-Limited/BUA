import { program } from 'commander';
import { generateIntentCommand } from './commands/generate-intent';
import { analyzeErrorCmd } from './commands/analyze-error';

program
  .name('claude-code')
  .description('Claude Code CLI for automation tasks')
  .version('1.0.0');

program
  .command('generate-intent')
  .description('Generate Intent Spec from Playwright recording')
  .requiredOption('--from <file>', 'Recording spec file')
  .option('--with-fallback', 'Include fallback paths')
  .option('--prefer-snippet-for <elements>', 'Prefer snippets for these elements')
  .option('--prefer-ai-for <steps>', 'Prefer AI for these steps')
  .action(generateIntentCommand);

// Add the analyze-error command
program.addCommand(analyzeErrorCmd);

program.parse();