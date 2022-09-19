import { ClassLineage, promise, Promise2, Result, spotfull } from "@jovian/type-tools";
import * as dedentOriginal from 'dedent';
import { getRuntime } from "./runtime.context";

export function errorCheck<T = any>(res: T): PromiseCollapse<T> {
  return promise(async (resolve, reject) => {
    try {
      let error: Error;
      while ((res as any)?.then) {
        (res as any)?.catch(e => { error = e; });
        (res as any) = await res;
        if (error) { (res as any) = error; error = null; }
      }
      if (error) { (res as any) = error; error = null; }
      if ((res as any)?.__thrown && !(res as any)?.__consumed) { return reject(res as any as Error); }
      return resolve(res);
    } catch (e) {
      return reject(e);
    }
  }) as any;
}

export type PromiseCollapse<A0> =
  A0 extends Promise<Promise<Promise<Promise<Promise<infer X>>>>> ? X
    : A0 extends Promise<Promise<Promise<Promise<infer X>>>> ? X
    : A0 extends Promise<Promise<Promise<infer X>>> ? X
    : A0 extends Promise<Promise<infer X>> ? X
    : A0 extends Promise<infer X> ? X : A0;

export type TaggedTemplateSelfChain<T, S extends any[] = any[]> = T & ((strArr: TemplateStringsArray, ...args: S) => TaggedTemplateSelfChain<T>);

export function punchGrab<T = any>(res: T): PromiseCollapse<T> {
  return promise(async (resolve, reject) => {
    try {
      while ((res as any)?.then) { (res as any) = await res; }
      return resolve(res);
    } catch (e) {
      return reject(e);
    }
  }) as any;
}

export function deepError(message?: string, depth = 50) {
  const stl = Error.stackTraceLimit;
  Error.stackTraceLimit = depth;
  const e = new Error(message);
  Error.stackTraceLimit = stl;
  return e;
}


export function fillArgs<T extends object = any>(args: any[], ...argNames: (keyof T)[]) {
  const ret: any = {};
  for (let i = 0; i < args.length; ++i) {
    const arg = args[i];
    ret[argNames[i]] = arg;
  }
  return ret as T;
}

export function backfillArgs<T extends object = any>(args: any[], ...argNames: (keyof T)[]) {
  const ret: any = {};
  let nameAt = argNames.length - 1;
  for (let i = args.length - 1; i >= 0; --i) {
    const arg = args[i];
    ret[argNames[nameAt]] = arg;
    --nameAt;
  }
  return ret as T;
}

export function notFromTransformedContext(args: any[]) {
  return !args[0] || !args[0]?.isCallContextEvent;
}

export function isClass(target) {
  return !!target.prototype && !!target.constructor.name;
}

export type TimeUnit = 'ms' | 's' | 'm' | 'h' | 'd' | 'wk' | 'mo' | 'y';

export function unitTimeMs(value: number, unit: TimeUnit) {
  switch (unit) {
    case 'ms': return value;
    case 's': return value * 1000;
    case 'm': return value * 60000;
    case 'h': return value * 3600000;
    case 'd': return value * 86400000;
    case 'wk': return value * 86400000 * 7;
    case 'mo': return value * 86400000 * 30;
    case 'y': return value * 86400000 * 365;
    default: return value * 1000;
  }
}

export function grabActualResult(originalRes) {
  if ((originalRes as Result)?.isResultKind?.()) {
    const result = originalRes as Result;
    return {
      isResultKind: true,
      value: result.ok ? result.data : result.error,
      result,
    };
  } else {
    return {
      isResultKind: false,
      value: originalRes,
      result: null,
    };
  }
}

const AsyncFunction = (async () => {}).constructor;
const GeneratorFunction = (function* () {}).constructor;
export function isAsyncFunction(a) {
  if (AsyncFunction === Function || AsyncFunction === GeneratorFunction) { throw new Error(`Cannot use 'isAsyncFunction' in transpiled context.`); }
  return a instanceof AsyncFunction;
}

export function bufferStringify(a: Buffer) {
  const hexStr = a.toString('hex');
  const hexStrLen = hexStr.length;
  const hexList = [];
  for (let i = 0; i < hexStrLen; i += 2) {
    hexList.push(hexStr[i] + hexStr[i + 1]);
  }
  return `<Buffer ${hexList.join(' ')}>`;
} 

export function ifaceInvokeGuard(identifier?: string, fileName?: string, stackDepth = 4): any {
  const e = new Error(
    `[USING_IFACE_AS_ACTUAL] Using untransformed identifier${identifier ? ` '${identifier}'`: ''} in '${spotfull(new Error, stackDepth)}'.` +
    ` ${fileName ? `(raised from '${fileName}')` : ''}`,
  );
  getRuntime().error(e);
  throw e;
}

export function dedent(target: string) {
  return dedentOriginal.default(target);
}

export interface RunAsyncController {
  startTime?: number;
  endTime?: number;
  duration?: number;
  canceled: boolean;
  finished: boolean;
  result: any;
  errors: Error[];
  errorLast: Error;
  errorsMaxKept: number;
  join: () => Promise<any> | Promise2;
  cancel: () => RunAsyncController;
}

