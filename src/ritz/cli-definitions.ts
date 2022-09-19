import { Command } from 'commander';
import { ritzOutputResult, ritzRevertByPattern, ritzTransformByPattern } from './ritz-util';
import { getRuntime } from './runtime.context';
import * as fs from 'fs';

const defaultTsGlobPatterns = ['./**/*.ts'];

type RitzCliCommands = (
  'run' |
  'transform' |
  'revert' |
  'recompile' |
  null
);

export namespace RitzCli {

  export function loadCommand(base: Command, commandName: RitzCliCommands, loadAsAliasCommand?: string) {

    const commandDef = base.command(loadAsAliasCommand ? loadAsAliasCommand : commandName);

    switch (commandName) {

      case 'run': return commandDef
        .description('Run entrypoint file with RITZ configuration')
        .argument('<entrypoint>', 'entrypoint file to run')
        .option('-j, --ignore-local-controllers', 'ignore file controller files (local _flowctl.ts files)', false)
        .option('-o, --controller <controllers...>', 'controller files to be imported')
        .action(async (entrypoint, options) => {
            if (options.ignoreLocalControllers) { getRuntime().ignoreLocalFlowControllers = true; }
            let errorMessage = getRuntime().__ritz_flow_controller_import_files(options.controllers);
            if (errorMessage) { getRuntime().error(errorMessage); process.exit(1); }
            errorMessage = getRuntime().__ritz_entrypoint(entrypoint);
            if (errorMessage) { getRuntime().error(errorMessage); process.exit(1); }
        });

      case 'transform': return commandDef
        .description('RITZ transform files base on glob expressions')
        .option('-i, --input <patterns...>', 'glob patterns for filtering files', defaultTsGlobPatterns)
        .option('-j, --json-output', 'show transform results in JSON format', false)
        .option('-t, --tranforms <transforms...>', 'transform name either ritz defaults or module name', '')
        .option('-v, --show-debug-output', 'show debug output for AST parsing and troubleshooting', false)
        .option('-o, --output-file <file>', 'file to save the transform result output', '')
        .option('--test', 'test ritz compatibility only (will error)', '')
        .action(async (options) => {
          if (!options.patterns) { options.patterns = defaultTsGlobPatterns; }
          options.action = 'transformed';
          if (options.test) { options.testOnly = true; }
          if (options.outputFile) { try { fs.truncateSync(options.outputFile); } catch (e) {} }
          let result = ritzOutputResult(await ritzTransformByPattern({ includeNodeModules: false, ...options }, options.tranforms, ...options.patterns), options);
          if (result.data?.errored.length > 0) { process.exit(1); }
        });

      case 'revert': return commandDef
        .description('RITZ transform revert files base on glob expressions')
        .option('-i, --input <patterns...>', 'glob patterns for filtering files', defaultTsGlobPatterns)
        .option('-j, --json-output', 'show transform results in JSON format', false)
        .option('-v, --show-debug-output', 'show debug output for AST parsing and troubleshooting', false)
        .option('-o, --output-file <file>', 'file to save the revert result output', '')
        .option('--test', 'test ritz compatibility only (will error)', '')
        .action(async (options) => {
          options.action = 'reverted';
          if (!options.patterns) { options.patterns = defaultTsGlobPatterns; }
          if (options.test) { options.testOnly = true; }
          if (options.outputFile) { try { fs.truncateSync(options.outputFile); } catch (e) {} }
          let result = ritzOutputResult(await ritzRevertByPattern({ includeNodeModules: false, ...options }, ...options.patterns), options);
          if (result.data?.errored.length > 0) { process.exit(1); }
        });

      case 'recompile': return commandDef
        .description('RITZ transform recompile files base on glob expressions')
        .option('-i, --input <patterns...>', 'glob patterns for filtering files', defaultTsGlobPatterns)
        .option('-t, --tranforms <transforms...>', 'transform name either ritz defaults or module name', [])
        .option('-j, --json-output', 'show transform results in JSON format', false)
        .option('-v, --show-debug-output', 'show debug output for AST parsing and troubleshooting', false)
        .option('-o, --output-file <file>', 'file to save the revert result output', '')
        .option('-f, --force', 'force recompile by reverting and transfroming all eligible files (including unchanged)', false)
        .option('--test', 'test ritz compatibility only (will error)', '')
        .action(async (options) => {
          if (!options.patterns) { options.patterns = defaultTsGlobPatterns; }
          if (options.test) { options.testOnly = true; }
          if (options.outputFile) { try { fs.truncateSync(options.outputFile); } catch (e) {} }
          options.action = 'revert';
          if (!options.force) { options.fromRecompile = true; }
          let errored = false;
          let result = ritzOutputResult(await ritzRevertByPattern({ includeNodeModules: false, ...options }, ...options.patterns), options);
          if (result.data?.errored.length > 0) { errored = true; }
          options.action = 'transform';
          result = ritzOutputResult(await ritzTransformByPattern({ includeNodeModules: false, ...options }, options.tranforms, ...options.patterns), options);
          if (result.data?.errored.length > 0) {
            errored = true;
            getRuntime().log(result.data?.errored[0]);
          }
          if (result.data?.errored.length > 0) { process.exit(1); }
        });

    }

  }

}