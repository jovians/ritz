/* Jovian (c) 2020, License: MIT */
// RITZ SKIP
export * from './src/index';
export * as RitzDefault from './ritz.default';
import { backfillArgs, decoratorHandler, errorCheck, grabActualResult, must, punchGrab, RunAsyncController, should, TaggedTemplateSelfChain, TimeUnit, unitTimeMs, __ScopeContext } from './src/index';
import { CallContextEvent, getRuntime, PostfixReturn, __BlockContext, __FunctionContext, __RuntimeContext } from './src/ritz/runtime.context';
import { ritzUntransformedGuard } from './src/ritz/ritz';
import { MergeClass, promise } from '@jovian/type-tools';
import 'reflect-metadata';

export function __ritz_reflect__(...args): any {
  if (args[0] !== true) {
    ritzUntransformedGuard('__ritz_reflect', __filename);
  }
  const memberPropertyDefinitions = args[1][0];
  return decoratorHandler({
    member: (target, memberName) => {
      // console.log(target, memberName)
      var types = (Reflect as any).getMetadata("design:paramtypes", target, memberName);
      // console.log(...types);
    },
  });
}

let anonContextIndex = 0;

export function context__(cce: CallContextEvent, ...args): any {
  const a = backfillArgs(args, 'contextName', 'contextClosure');
  if (!a.contextName) { a.contextName = `(anonymous_context_${anonContextIndex++})`; }
  return getRuntime().scopedExec(
    cce, a.contextName, { data: { contextName: a.contextName } },
    async (resolve, reject, scopeContext) => {
      try {
        let res;
        if (a.contextClosure) { res = await errorCheck(a.contextClosure(scopeContext)); }
        resolve(res);
      } catch (e) { reject(e); }
    });
}

export function run__(cce: CallContextEvent, ...args): any {
  const a = backfillArgs(args, 'runClosure');
  return getRuntime().scopedExec(
    cce, 'run', { data: {} },
    async (resolve, reject, scopeContext) => {
      try {
        let res;
        if (a.runClosure) { res = await errorCheck(a.runClosure(scopeContext)); }
        resolve(res);
      } catch (e) { reject(e); }
    });
}

export function async__(cce: CallContextEvent, ...args): any {
  const a = backfillArgs(args, 'runClosure');
  return getRuntime().scopedExec(
    cce, 'async', { data: {} },
    async (resolve, reject, scopeContext) => {
      setImmediate(async () => {
        try {
          let res;
          if (a.runClosure) { res = await errorCheck(a.runClosure(scopeContext)); }
          resolve(res);
        } catch (e) { reject(e); }
      });
    });
}

export function defer__(cce: CallContextEvent, ...args): any {
  let a;
  if (typeof args[0] === 'number' && typeof args[1] === 'string') {
    a = { dur: args[0], unit: args[1], runClosure: args[2]};
  } else if (typeof args[0] === 'number') {
    a = { dur: args[0], unit: 's', runClosure: args[1]};
  } else {
    a = { dur: 0, unit: 's', runClosure: args[0]};
  }
  let asyncProm;
  let asyncPromResolver;
  const controller: RunAsyncController = {
    startTime: Date.now(),
    canceled: false, finished: false,
    result: undefined, errors: [], errorLast: null, errorsMaxKept: 10,
    join: async () => { return await asyncProm as any },
    cancel: () => {
      if (controller.canceled) { return; }
      controller.canceled = true;
      asyncPromResolver();
      return controller;
    },
  };
  let ctx: __ScopeContext;
  let asyncPromResolverCalled = false;
  asyncProm = promise(async ( resolve ) => {
    asyncPromResolver = (e?: Error) => {
      if (asyncPromResolverCalled) { return; }
      asyncPromResolverCalled = true;
      controller.endTime = Date.now();
      controller.duration = controller.endTime - controller.startTime;
      if (ctx) {
        if (e) { getRuntime().setScopeError(ctx, null, e); }
        getRuntime().endContext(ctx);
      }
      resolve();
    };
  });
  promise(async ( resolve, reject ) => {
    ctx = await getRuntime().newContext(cce, 'defer', cce.scopeContext, {});
    try {
      resolve(controller);
      (async () => {
        await sleep__(cce, a.dur, a.unit);
        try {
          if (a.runClosure && !controller.canceled) {
            controller.result = await errorCheck(a.runClosure(ctx));
          }
        } catch (e) {
          if (controller.errors.length < controller.errorsMaxKept) { controller.errors.push(e); }
          controller.errorLast = e;
        }
        asyncPromResolver();
      })();
    } catch (e) {
      asyncPromResolver(e);
      reject(e);
    }
  });
  return controller;
}

export function every__(cce: CallContextEvent, ...args): any {
  let a;
  if (typeof args[0] === 'number' && typeof args[1] === 'string') {
    a = { dur: args[0], unit: args[1], runClosure: args[2]};
  } else if (typeof args[0] === 'number') {
    a = { dur: args[0], unit: 's', runClosure: args[1]};
  } else {
    a = { dur: 0, unit: 's', runClosure: args[0]};
  }
  let asyncProm;
  let asyncPromResolver;
  const controller: RunAsyncController = {
    startTime: Date.now(),
    canceled: false, finished: false,
    result: undefined, errors: [], errorLast: null, errorsMaxKept: 10,
    join: async () => { return await asyncProm as any },
    cancel: () => {
      if (controller.canceled) { return; }
      controller.canceled = true;
      asyncPromResolver();
      return controller;
    },
  };
  let asyncPromResolverCalled = false;
  asyncProm = promise(async ( resolve ) => {
    asyncPromResolver = (e?: Error) => {
      if (asyncPromResolverCalled) { return; }
      asyncPromResolverCalled = true;
      controller.endTime = Date.now();
      controller.duration = controller.endTime - controller.startTime;
      if (ctx) {
        if (e) { getRuntime().setScopeError(ctx, null, e); }
        getRuntime().endContext(ctx);
      }
      resolve();
    };
  });
  let ctx: __ScopeContext;
  promise(async ( resolve, reject ) => {
    ctx = await getRuntime().newContext(cce, 'every', cce.scopeContext, {});
    try {
      resolve(controller);
      (async () => {
        while (true) {
          if (controller.canceled) { break; }
          await sleep__(cce, a.dur, a.unit);
          try {
            if (a.runClosure && !controller.canceled) {
              controller.result = await errorCheck(a.runClosure(ctx));
            }
          } catch (e) {
            if (controller.errors.length < controller.errorsMaxKept) { controller.errors.push(e); }
            controller.errorLast = e;
          }
        }
        asyncPromResolver();
      })();
    } catch (e) {
      asyncPromResolver(e);
      reject(e);
    }
  });
  return controller;
}

export function safe__(cce: CallContextEvent, ...args): any {
  const a = backfillArgs(args, 'safeClosure');
  return getRuntime().scopedExec(
    cce, 'safe', { data: {} },
    async (resolve, reject, scopeContext) => {
      scopeContext.noInterrupt = true;
      try {
        let res;
        if (a.safeClosure) { res = await errorCheck(a.safeClosure(scopeContext)); }
        resolve(res);
      } catch (e) { reject(e); }
    });
}

export function noInterrupt__(cce: CallContextEvent, ...args): any {
  const a = backfillArgs(args, 'safeClosure');
  return getRuntime().scopedExec(
    cce, 'noInterrupt', { data: {} },
    async (resolve, reject, scopeContext) => {
      scopeContext.noInterrupt = true;
      try {
        let res;
        if (a.safeClosure) { res = await errorCheck(a.safeClosure(scopeContext)); }
        resolve(res);
      } catch (e) { reject(e); }
    });
}

export function check__(cce: CallContextEvent, ...args): any {
  return getRuntime().scopedExec(
    cce, 'check', { data: {} },
    async (resolve, reject, scopeContext) => {
      const resObj = grabActualResult(await punchGrab(args[0]));
      const checkedRes = getRuntime().__check(resObj, cce.scopeContext);
      if (checkedRes instanceof Error) {
        return reject(checkedRes);
      } else {
        return resolve(checkedRes);
      }
    });
}

export function sleep__(cce: CallContextEvent, duration: number, unit: TimeUnit = 's'): any {
  let ms = unitTimeMs(duration, unit);
  if (ms < 0) { ms = 0; }
  return promise(async resolve => duration > 0 ? setTimeout(resolve, ms) : setImmediate(resolve));
}

export function msleep__(cce: CallContextEvent, ms: number): any {
  if (ms < 0) { ms = 0; }
  return promise(async resolve => ms > 0 ? setTimeout(resolve, ms) : setImmediate(resolve));
}

export class ritz__ {
}


declare global {
  

  interface Object {
    $: Object & number; _: any;
    must: typeof must; should: typeof should;
    contains: (element: any) => boolean;
    containsEquivalent: (element: any) => boolean;
    equivalentTo: (target: object) => boolean;
  }
  interface Array<T> {
    $: Array<T> & number; _: any;
    must: typeof must; should: typeof should;
    contains: (element: T) => boolean;
    containsEquivalent: (element: T) => boolean;
    equivalentTo: (target: any[]) => boolean;
    get first(): T;
    get last(): T;
  }
  interface String {
    $: String & number; _: any;
    must: typeof must; should: typeof should;
    contains: (subpattern: string | Buffer) => boolean;
    dedent: () => string;
    toBase64: (encoding?: BufferEncoding) => string;
    toHex: (encoding?: BufferEncoding) => string;
    toBuffer: (encoding?: BufferEncoding) => Buffer;
  }
  interface Boolean {
    $: Boolean & number; _: any;
    must: typeof must; should: typeof should;
    toNumber: () => number;
  }
  interface Number {
    $: Number & number; _: any;
    must: typeof must; should: typeof should;
    toNumber: () => number;
    within: (n: number) => boolean;
  }
  interface BigInt {
    $: BigInt & number; _: any;
    must: typeof must; should: typeof should;
    toNumber: () => number;
    within: (n: bigint) => boolean;
  }
  interface Symbol {
    $: Symbol & number; _: any;
    must: typeof must; should: typeof should;
  }
  interface Buffer {
    $: Buffer & number; _: any;
    must: typeof must; should: typeof should;
    contains: (subpattern: string | Buffer) => boolean;
    equivalentTo: (target: string | Buffer) => boolean;
    toBase64: () => string;
    toHex: () => string;
  }
  const __context: __ScopeContext;
  const __block: __BlockContext;
  const __function: __FunctionContext;
  const __runtime: __RuntimeContext;
  // const __statement: any;
  // const __last_return: any;
  const $r: any;
}
