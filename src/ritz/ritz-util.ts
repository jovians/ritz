/* Jovian (c) 2020, License: MIT */
import { PromUtil, ReturnCodeFamily, ok, Result } from "@jovian/type-tools";
import { Ritz, RitzConfig } from "./ritz";
import * as fs from 'fs';
import { getRuntime } from "./runtime.context";
const fg = require('fast-glob');

enum RitzUtilCodesEnum {
  RITZ_TRANSFORM_FILES_BY_PATTERN_ERROR,
  RITZ_REVERT_FILES_BY_PATTERN_ERROR,
}
export const RitzUtilCodes = ReturnCodeFamily('RitzUtilCodes', RitzUtilCodesEnum);

interface RitzPatternTransformConfig extends RitzConfig {
  includeNodeModules?: boolean;
}

interface RitzPatternTransformOutcome {
  patterns: string[];
  affected?: string[];
  matched?: string[];
  unchanged?: string[];
  notEligible?: string[];
  errored?: { file: string; error?: Error; }[];
}

export async function ritzTransformByPattern(config: RitzPatternTransformConfig, transforms: string[], ...patterns: string[]) {
  patterns = patterns.slice();
  if (!config) { config = {}; }
  if (!config.includeNodeModules) { patterns.push('!node_modules'); }
  if (!transforms || transforms.length === 0) { transforms = ['default']; }
  const outcome = defaultOutcomeObject(patterns);
  return new Promise<Result<RitzPatternTransformOutcome>>(resolve => {
    fg(patterns).then(async entries => {
      outcome.matched = entries;
      const proms = [];
      for (const file of entries) { proms.push(ritzTransformFile(file, config, transforms, outcome)); }
      try {
        await PromUtil.allSettled(proms);
      } catch (e) {
        return resolve(RitzUtilCodes.error('RITZ_TRANSFORM_FILES_BY_PATTERN_ERROR', e));
      }
      return resolve(ok(outcome));
    });
  });
}

export function ritzTransformFile(file: string, config: RitzPatternTransformConfig, transforms: string[], outcome?: RitzPatternTransformOutcome) {
  if (config.outputFile) { config.outputCollector = []; }
  const ritz = new Ritz(config);
  if (!outcome) { outcome = defaultOutcomeObject(); } 
  return ritz.eligibleFile(file).then(async r => {
    if (r.bad) {
      return outcome.errored.push({ file, error: r.error });
    }
    if (!r.data) {
      return outcome.notEligible.push(file);
    }
    try {
      ritz.addTransformersByNames(transforms);
      const transformResult = await ritz.transformFile(file);
      if (config.outputCollector?.length) { fs.appendFile(config.outputFile, config.outputCollector.join('\n') + '\n\n', 'utf8', () => {}) }
      if (transformResult.ok) {
        return outcome.affected.push(file);
      } else {
        return outcome.errored.push({ file, error: transformResult.error });
      }
    } catch (e) {
      if (config.outputCollector?.length) { fs.appendFile(config.outputFile, e.stack + '\n\n', 'utf8', () => {})}
      return outcome.errored.push({ file, error: e });
    }
  })
}

export async function ritzRevertByPattern(config: RitzPatternTransformConfig, ...patterns: string[]) {
  patterns = patterns.slice();
  if (!config) { config = {}; }
  if (!config.includeNodeModules) { patterns.push('!node_modules'); }
  const outcome = defaultOutcomeObject(patterns);
  return new Promise<Result<RitzPatternTransformOutcome>>(resolve => {  
    fg(patterns).then(async entries => {
      outcome.matched = entries;
      const proms = [];
      for (const file of entries) { proms.push(ritzRevertFile(file, config, outcome)); }
      try {
        await PromUtil.allSettled(proms);
      } catch (e) {
        if (config.outputCollector?.length) { fs.appendFile(config.outputFile, e.stack, 'utf8', () => {})}
      }
      return resolve(ok(outcome));
    });
  });
}

export function ritzRevertFile(file: string, config: RitzPatternTransformConfig, outcome?: RitzPatternTransformOutcome) {
  if (config.outputFile) { config.outputCollector = []; }
  const ritz = new Ritz(config);
  if (!outcome) { outcome = defaultOutcomeObject(); } 
  return ritz.eligibleFileRevert(file).then(async r => {
    if (r.bad) {
      return outcome.errored.push({ file, error: r.error });
    }
    if (!r.data) {
      return outcome.notEligible.push(file);
    }
    try {
      const revertResult = await ritz.revertFile(file);
      if (config.outputCollector?.length) { fs.appendFile(config.outputFile, config.outputCollector.join('\n') + '\n\n', 'utf8', () => {})}
      if (revertResult.ok) {
        if (revertResult.meta?.unchanged) {
          return outcome.unchanged.push(file);
        } else {
          return outcome.affected.push(file);
        }
      } else {
        return outcome.errored.push({ file, error: revertResult.error });
      }
    } catch (e) {
      if (config.outputCollector?.length) { fs.appendFile(config.outputFile, e.stack + '\n\n', 'utf8', () => {})}
      return outcome.errored.push({ file, error: e });
    }
  });
}

export function ritzOutputResult(result: Result<RitzPatternTransformOutcome>, options?) {
  const action = options.action ? options.action : 'transformed';
  if (!result.ok) {
    getRuntime().log(`ERROR: `, result.error);
    return result;
  }
  if (options?.jsonOutput) {
    const content = JSON.stringify(result.data, null, 4);
    if (options?.outputFile) {
      fs.appendFileSync(options.outputFile, content, 'utf8');
    } else {
      getRuntime().log(content);
    }
    return result;
  }
  const lines = [];
  for (const affectedFile of result.data.affected) { lines.push(`RITZ ${action}: ${affectedFile}`); }
  lines.push(`Target patterns: ${result.data.patterns.map(p => `"${p}"`).join(', ')}`);
  lines.push(
    `Total ${result.data.affected.length} affected among ${result.data.matched.length} matched ` +
    `(not-eligible: ${result.data.notEligible.length}; unchanged: ${result.data.unchanged.length}; errors: ${result.data.errored.length})`
  );
  for (const e of result.data.errored) { lines.push(`Revert error for ${e.file}:\n` + e.error?.stack); }
  if (options?.outputFile) {
    fs.appendFile(options.outputFile, lines.join('\n') + '\n\n', 'utf8', () => {});
  } else {
    getRuntime().log(lines.join('\n'));
  }
  return result;
}

function defaultOutcomeObject(patterns: string[] = []): RitzPatternTransformOutcome {
  return { patterns, matched: null, unchanged: [], affected: [], notEligible: [], errored: [] };
}
