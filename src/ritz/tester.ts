// RITZ SKIP
import { backfillArgs, punchGrab } from "./ritz-util.misc";
import { callContextArgsProcess, CallContextEvent, CCE, getRuntime, __BlockContext, __ScopeContext } from "./runtime.context";
import colors from 'colors/safe';
import  { v4 as uuidv4 } from 'uuid';
import { Class, PromUtil } from "@jovian/type-tools";
import { ProcessExit } from "@jovian/type-tools/nodejs/proc/process.exit.handler";

interface TestResultLog {
  status: 'PASS' | 'FAIL' | 'UNSTABLE' | 'SKIP' ;
  log: string,
  totalDur?: number,
  durations?: number[],
  errors?: Error[]
}

interface TestFileOptions {
  runAlone?: boolean;
  dedicatedProcess?: boolean;
  isDefault?: boolean;
}

const defaultTestFileOptions: TestFileOptions = {
  runAlone: false,
  dedicatedProcess: false,
  isDefault: true,
};

interface TestOptions {
  try?: number;
  runAlone?: boolean;
  runAloneWithinFile?: boolean;
}

interface TestRegistration extends TestOptions {
  testUid?: string;
  error?: Error;
  type?: string;
  testName: string;
  logic: (__ctx?: __ScopeContext) => any;
  cce?: CCE;
  srcTs?: string;
  testContext?: Promise<__ScopeContext>;
}

export class TestConfig {
  static maxConcurrentTestFiles = 20;
  static maxConcurrentTestProcesses = 10;
  static failFast = true;
  static anyTestFailed = false;
  static anonTextIndex = 0;
  static testCasesPerMarker: {[marker:string]: TestRegistration[] } = {};
  static testCasesPerFile: {[fileName:string]: {[testCase: string]: { runCount: number } } } = {};
  static queue: TestRegistration[] = [];
  static entrypointLocker = null;
  static goodCount = 0;
  static failCount = 0;
  static unstableCount = 0;
  static testPrepDuration = 0;
  static testsStart = 0;
  static finishedTestCount = 0;
  static resultLogs: { [testFile: string]: TestResultLog[] } = {};
  static testFileOrder: string[] = [];
  static testFileConfig: { [testFile: string]: TestFileOptions } = {};
  static testFileTests: { [testFile: string]: TestRegistration[] } = {};
  static testFileTestsRunAlone: { [testFile: string]: TestRegistration[] } = {};
  static beforeTestsMap: { [testFile: string]: TestRegistration[] } = {};
  static afterTestsMap: { [testFile: string]: TestRegistration[] } = {};
  static currentTestFilesInProgress: { [testFile: string]: boolean } = {};
  static currentTestsInProgress: { [testUid: string]: TestRegistration } = {};
  static allTestsByUid: { [testUid: string]: TestRegistration } = {};
  static testProcessInitPromises: Promise<any>[] = [];
  static reset() {
    TestConfig.failFast = true;
    TestConfig.anonTextIndex = 0;
    TestConfig.testCasesPerMarker = {};
    TestConfig.testCasesPerFile = {};
    TestConfig.queue = [];
    TestConfig.anyTestFailed = false;
    TestConfig.goodCount = 0;
    TestConfig.failCount = 0;
    TestConfig.unstableCount = 0;
    TestConfig.finishedTestCount = 0;
    TestConfig.entrypointLocker = null;
    TestConfig.resultLogs = {};
    TestConfig.testPrepDuration = 0;
    TestConfig.testsStart = 0;
    TestConfig.testFileConfig = {};
    TestConfig.testFileTests = {};
    TestConfig.testFileTestsRunAlone = {};
    TestConfig.beforeTestsMap = {};
    TestConfig.afterTestsMap = {};
    TestConfig.testFileOrder = [];
    TestConfig.currentTestsInProgress = {};
    TestConfig.currentTestFilesInProgress = {};
    TestConfig.allTestsByUid = {};
    TestConfig.testProcessInitPromises = [];
  }
  static prepareBeforeAnyTest(toBeRunBefore: () => Promise<any>) {
    TestConfig.testProcessInitPromises.push(toBeRunBefore());
  }
};

export namespace attr {
  function markModel(marker: string) {
    return getRuntime().addDecoration({ decorationKind: 'config', type: 'test-mark', data: marker });
  }  
  export const tag = markModel as (typeof markModel & Class<any>);
  function testConfModel(opts: TestOptions) {
    return getRuntime().addDecoration({ decorationKind: 'config', type: 'test-config', data: opts });
  }
  export const config = testConfModel as (typeof testConfModel & Class<any>);
}

export async function testDefine(testName: string);
export async function testDefine(tryCount: number, testName: string);
export async function testDefine(testConfig: TestOptions, testName: string);
export async function testDefine(...fnArgs) {
  let { cce, blockContext, args } = callContextArgsProcess(fnArgs);
  const a0 = backfillArgs(args, 'firstArg', 'testName', 'logic');
  if (a0.firstArg) {
    if (typeof a0.firstArg === 'number') {
      (a0 as any).try = a0.firstArg;
    } else if (typeof a0.firstArg === 'object') {
      Object.assign(a0, a0.firstArg);
    }
  }
  const a: TestRegistration = a0 as any;
  (a as any).type = 'test';
  (a as any).testUid = uuidv4();
  if (!a.testName) { a.testName = `(unnamed test ${TestConfig.anonTextIndex++})`; }
  if (cce) {
    if (cce.blockContext.decorations.length) {
      for (const deco of cce.blockContext.decorations) {
        if (deco.decorationKind === 'config' && deco.type === 'test-mark' && deco.data) {
          if (!TestConfig.testCasesPerMarker[deco.data]) { TestConfig.testCasesPerMarker[deco.data] = []; }
          TestConfig.testCasesPerMarker[deco.data].push(a);
        } else if (deco.decorationKind === 'config' && deco.type === 'test-config' && deco.data) {
          Object.assign((a as any), deco.data);
        }
      }
    }
    (a as any).testContext = getRuntime().newContext(cce, 'test', cce.scopeContext, { data: a });
    (a as any).cce = cce;
  }
  if (!a.try) { a.try = 1; }
  if (!a.logic) { return; }
  let srcTs = cce?.blockContext.sourceFile.file.ts;
  if (srcTs) {
    if (!TestConfig.testCasesPerFile[srcTs]) { TestConfig.testCasesPerFile[srcTs] = {}; }
    if (TestConfig.testCasesPerFile[srcTs][a.testName]) {
      const e = (a as any).error = new Error(`Duplicate test name '${a.testName}' in file '${cce?.blockContext.sourceFile.file.ts}'`);
      if (cce?.blockContext) { getRuntime().prepareError(e, cce?.blockContext); }
      a.testName = `${colors.red('(DUPLICATE_TEST_NAME)')} ${a.testName}`;
    }
    TestConfig.testCasesPerFile[srcTs][a.testName] = { runCount: 0 };
  }
  TestConfig.allTestsByUid[a.testUid] = a;
  TestConfig.queue.push(a);
  const locker = TestConfig.entrypointLocker = {};
  setTimeout(async () => {
    if (locker !== TestConfig.entrypointLocker) { return; }
    await runAllTests();
  }, 10);
}

export function testFileOptions(testConfig: TestFileOptions);
export function testFileOptions(...fnArgs) {
  let { cce, blockContext, args } = callContextArgsProcess(fnArgs);
  const a = backfillArgs(args, 'testFileOptions');
  if (a.testFileOptions) {
    const srcTs = getSrcTsFromBlockContext(getRuntime().immediateSynchronousBlockContext);
    TestConfig.testFileConfig[srcTs] = a.testFileOptions;
  }
}

export function beforeTest(...fnArgs) {
  let { cce, blockContext, args } = callContextArgsProcess(fnArgs);
  const a = backfillArgs(args, 'logic');
  (a as any).type = 'beforeTest';
  if (cce) {
    (a as any).testContext = getRuntime().newContext(cce, 'beforeTest', cce.scopeContext, { data: a });
    (a as any).cce = cce;
  }
  if (!a.logic) { return; }
  TestConfig.queue.push(a as any);
  const locker = TestConfig.entrypointLocker = {};
  setTimeout(async () => {
    if (locker !== TestConfig.entrypointLocker) { return; }
    await runAllTests();
  }, 10);
}

export function afterTest(...fnArgs) {
  let { cce, blockContext, args } = callContextArgsProcess(fnArgs);
  const a = backfillArgs(args, 'logic');
  (a as any).type = 'afterTest';
  if (cce) {
    (a as any).testContext = getRuntime().newContext(cce, 'afterTest', cce.scopeContext, { data: a });
    (a as any).cce = cce;
  }
  if (!a.logic) { return; }
  TestConfig.queue.push(a as any);
  const locker = TestConfig.entrypointLocker = {};
  setTimeout(async () => {
    if (locker !== TestConfig.entrypointLocker) { return; }
    await runAllTests();
  }, 10);
}

function handleTestDefConfig(testDef: TestRegistration) {
  const srcTs = getSrcTs(testDef);
  if (!srcTs) { throw new Error(`Cannot run test defitnition with unknown source file.`); }
  if (testDef.type === 'beforeTest') {
    if (!TestConfig.beforeTestsMap[srcTs]) { TestConfig.beforeTestsMap[srcTs] = []; }
    TestConfig.beforeTestsMap[srcTs].push(testDef);
    return null;
  } else if (testDef.type === 'afterTest') {
    if (!TestConfig.afterTestsMap[srcTs]) { TestConfig.afterTestsMap[srcTs] = []; }
    TestConfig.afterTestsMap[srcTs].push(testDef);
    return null;
  } else {
    if (!TestConfig.testFileTests[srcTs]) {
      TestConfig.testFileOrder.push(srcTs);
      TestConfig.testFileTests[srcTs] = [];
    }
    TestConfig.testFileTests[srcTs].push(testDef);
  }
  return null;
}

async function runTestFile(testFile: string, runAloneNoDefer: boolean = false) {
  const tests = TestConfig.testFileTests[testFile];
  if (!tests) { return; }
  TestConfig.currentTestFilesInProgress[testFile] = true;
  const runTogethers: TestRegistration[] = [];
  const runAlonesWithinFile: TestRegistration[] = [];
  for (const test of tests) {
    if (test.runAlone && !runAloneNoDefer) {
      if (!TestConfig.testFileTestsRunAlone[testFile]) { TestConfig.testFileTestsRunAlone[testFile] = []; }
      TestConfig.testFileTestsRunAlone[testFile].push(test);
    } else if (test.runAloneWithinFile || (test.runAlone && runAloneNoDefer)) {
      runAlonesWithinFile.push(test);
    } else {
      runTogethers.push(test);
    }
  }
  const proms = [];
  for (const test of runTogethers) {
    proms.push(runTest(test));
  }
  if (proms.length) { await PromUtil.allSettled(proms); }
  for (const test of runAlonesWithinFile) {
    try {
      await runTest(test);
    } catch (e) {
      getRuntime().error(e);
    }
  }
  delete TestConfig.currentTestFilesInProgress[testFile];
}

async function runTest(testDef: TestRegistration) {
  TestConfig.currentTestsInProgress[testDef.testUid] = testDef;
  const srcTs = getSrcTs(testDef);
  if (!TestConfig.resultLogs[srcTs]) { TestConfig.resultLogs[srcTs] = []; }
  const caseErrors: Error[] = [];
  const durations: number[] = [];
  let caseTryCount = testDef.try;
  let caseTriedCount = 0;
  let caseSuccess = 0;
  let caseFailure = 0;
  let durMs: number;
  let t0 = Date.now();
  let retryEnd = false;
  let skipped = false;
  for (let i = 0; i < caseTryCount && !retryEnd; ++i) {
    if (TestConfig.failFast && TestConfig.anyTestFailed) {
      delete TestConfig.currentTestsInProgress[testDef.testUid];
      skipped = true;
      break;
    }
    ++caseTriedCount;
    let t1 = Date.now();
    try {
      if (testDef.error) { retryEnd = true; throw testDef.error; }
      if (testDef.logic) {
        if (TestConfig.beforeTestsMap[srcTs]) {
          for (const beforeTestDef of TestConfig.beforeTestsMap[srcTs]) {
            await punchGrab(beforeTestDef.logic(await beforeTestDef.testContext));
            if (beforeTestDef.testContext) { getRuntime().endContext(await beforeTestDef.testContext); }
          }
        }
        const testContext = await testDef.testContext;
        testContext.startTime = Date.now();
        await punchGrab(testDef.logic(testContext));
        if (TestConfig.afterTestsMap[srcTs]) {
          for (const afterTestDef of TestConfig.afterTestsMap[srcTs]) {
            await punchGrab(afterTestDef.logic(await afterTestDef.testContext));
            if (afterTestDef.testContext) { getRuntime().endContext(await afterTestDef.testContext); }
          }
        }
      }
      ++caseSuccess;
      durMs = Date.now() - t1;
      durations.push(durMs);
      break;
    } catch (e) {
      durMs = Date.now() - t1;
      durations.push(durMs);
      caseErrors.push(getRuntime().sanitizeError(e));
      ++caseFailure;
    }
  }
  const totalDur = Date.now() - t0;
  if (skipped) {
    TestConfig.resultLogs[srcTs].push({
      status: 'SKIP',
      log: `  [ ${colors.gray('SKIP')} ] ${colors.gray(testDef.testName)}  (due to earlier failures)`,
    });
  } else if (!caseFailure && caseSuccess) {
    ++TestConfig.goodCount;
    TestConfig.resultLogs[srcTs].push({
      status: 'PASS',
      log: `  [ ${colors.green('PASS')} ] ${colors.cyan(testDef.testName)}`,
      totalDur, durations
    });
  } else if (caseFailure && !caseSuccess) {
    ++TestConfig.failCount;
    TestConfig.anyTestFailed = true;
    TestConfig.resultLogs[srcTs].push({
      status: 'FAIL',
      log: `  [ ${colors.red('FAIL')} ] ${colors.cyan(testDef.testName)}`,
      totalDur, durations, errors: caseErrors
    });
  } else if (caseFailure && caseSuccess) {
    ++TestConfig.unstableCount;
    TestConfig.resultLogs[srcTs].push({
      status: 'UNSTABLE',
      log: `  [ ${colors.yellow('UNSTABLE')} ] ${colors.cyan(testDef.testName)}`,
      totalDur, durations, errors: caseErrors
    });
  } else {
    getRuntime().error(new Error(`Unknown outcome for '${testDef.testName}' in '${srcTs}'`));
  }
  delete TestConfig.currentTestsInProgress[testDef.testUid];
  ++TestConfig.finishedTestCount;
  // getRuntime().log(`finished ${testDef.testName} in ${testDef.srcTs}`);
}

async function runAllTests() {
  const stl = Error.stackTraceLimit;
  Error.stackTraceLimit = 50;
  for (const testDef of TestConfig.queue) { handleTestDefConfig(testDef); }
  const stuckTestsChecker = setInterval(() => {
    // getRuntime().log(TestConfig.finishedTestCount);
    // getRuntime().log(Object.keys(TestConfig.allTestsByUid).length)
    for (const testUid of Object.keys(TestConfig.currentTestsInProgress)) {
      const testDef = TestConfig.currentTestsInProgress[testUid];
      // getRuntime().log(`${testDef.testName} is still in progress after`);
    }
    for (const testFile of Object.keys(TestConfig.currentTestFilesInProgress)) {
      getRuntime().log(`[${new Date().toISOString()}] ${testFile} is still in progress ... `);
    }
  }, 10000);
  const concurrentSuites: string[] = [];
  const runAloneSuites: string[] = [];
  for (const testSrcTs of TestConfig.testFileOrder) {
    let config = TestConfig.testFileConfig[testSrcTs];
    if (!config) { config = defaultTestFileOptions; }
    if (!config.runAlone && !config.dedicatedProcess) {
      concurrentSuites.push(testSrcTs);
    } else {
      runAloneSuites.push(testSrcTs);
    }
  }
  if (TestConfig.testProcessInitPromises.length) {
    const t1 = Date.now();
    console.log(`waiting for beforeAnyTest preparation...`);
    await PromUtil.allSettled(TestConfig.testProcessInitPromises);  
    console.log(`successfully awaited all beforeAnyTest preparations.`);
    TestConfig.testPrepDuration = Date.now() - t1;
  }
  TestConfig.testsStart = Date.now();
  const proms = [];
  for (const testSrcTs of concurrentSuites) {
    proms.push(runTestFile(testSrcTs));
  }
  if (proms.length) { await PromUtil.allSettled(proms); }
  for (const testSrcTs of concurrentSuites) {
    const runAloneList = TestConfig.testFileTestsRunAlone[testSrcTs];
    if (runAloneList) {
      for (const testDef of runAloneList) {
        try {
          await runTest(testDef);
        } catch (e) {
          getRuntime().error(e);
        }
      }
    }
  }
  for (const testSrcTs of runAloneSuites) {
    await runTestFile(testSrcTs, true);
  }
  for (const testSrcTs of TestConfig.testFileOrder) {
    getRuntime().log(`In ${colors.yellow(testSrcTs)}:`);
    if (!TestConfig.resultLogs[testSrcTs]) {
      getRuntime().log(`  ${testSrcTs} has no results`);
      continue;
    }
    for (const result of TestConfig.resultLogs[testSrcTs]) {
      switch (result.status) {
        case 'PASS': {
          const dur = `  ... ${colors.yellow(result.totalDur + 'ms')}`;
          getRuntime().log(result.log + dur);
        } break;
        case 'FAIL': {
          const tryCount = result.errors.length;
          if (tryCount === 1) {
            getRuntime().group(result.log + `  ... ${colors.yellow(result.totalDur + 'ms')}`);
          } else {
            getRuntime().group(result.log + ` after ${colors.red(`${tryCount} tr${tryCount === 1 ? 'y' : 'ies'}`)} ... total ${colors.yellow(result.totalDur + 'ms')}`);
          }
          for (let i = 0; i < result.errors.length; ++i) {
            if (tryCount > 1) {
              getRuntime().group(result.log + ` (${colors.red(`try ${i}`)})  ... ${colors.yellow(result.durations[i] + 'ms')}`);
            }
            getRuntime().error(result.errors[i]);
            getRuntime().groupEnd();
          }
          getRuntime().groupEnd();
        } break;
        case 'SKIP': {
          getRuntime().log(result.log);
        } break;
        case 'UNSTABLE': {
          const tryCount = result.errors.length;
          getRuntime().group(result.log + ` succeeded after ${colors.yellow(`${tryCount + 1} tr${tryCount === 1 ? 'y' : 'ies'}`)} ... total ${colors.yellow(result.totalDur + 'ms')}`);
          for (let i = 0; i < result.errors.length; ++i) {
            getRuntime().group(result.log + ` (${colors.red(`try ${i+1}`)})  ... ${colors.yellow(result.durations[i] + 'ms')}`);
            getRuntime().error(result.errors[i]);
            getRuntime().groupEnd();
          }
          getRuntime().groupEnd();
        } break;
        default: {
          getRuntime().log(result.log);
        } break;
      }
    }
  }
  const overall = TestConfig.anyTestFailed ? colors.red('FAIL') : colors.green('PASS');
  const testPrepDur = TestConfig.testPrepDuration ? colors.gray(` (+${TestConfig.testPrepDuration}ms prep)`) : '';
  getRuntime().log(
    `\nResult: [ ${overall} ]  ${colors.yellow((TestConfig.goodCount + TestConfig.failCount + TestConfig.unstableCount) + '')} test cases;  ` +
    `${colors.green(TestConfig.goodCount + '')} passed;  ` + 
    `${TestConfig.failCount > 0 ? colors.red(TestConfig.failCount + '') : colors.green(TestConfig.failCount + '')} failed;  ` + 
    `${TestConfig.unstableCount > 0 ? colors.yellow(TestConfig.unstableCount + '') : colors.green(TestConfig.unstableCount + '')} unstable;  ` +
    `... taken ${colors.yellow((Date.now() - TestConfig.testsStart) + 'ms')} total${testPrepDur}` +
    `\n`
  )
  Error.stackTraceLimit = stl;
  setTimeout(() => {
    ProcessExit.gracefully(TestConfig.anyTestFailed ? 1 : 0);
  }, 10);
}

function getSrcTs(testDef: TestRegistration) {
  if (testDef.srcTs) { return testDef.srcTs; }
  let srcTs = testDef.cce?.blockContext.sourceFile.path.ts;
  if (srcTs?.startsWith(`${process.cwd()}/`)) { srcTs = srcTs.replace(`${process.cwd()}/`, ''); }
  testDef.srcTs = srcTs;
  return srcTs;
}

function getSrcTsFromBlockContext(blockContext: __BlockContext) {
  let srcTs = blockContext.sourceFile.path.ts;
  if (srcTs?.startsWith(`${process.cwd()}/`)) { srcTs = srcTs.replace(`${process.cwd()}/`, ''); }
  return srcTs;
}
