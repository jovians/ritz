// RITZ SKIP
import { Class, ClassLineage, ok, promise, PromUtil, Result, ReturnCodeFamily } from '@jovian/type-tools';
import { CallContextEvent, getRuntime, InCollationArguments, InCollationHandler, InCollationReturn, PostfixReturn, __BlockContext, __RuntimeCollator, __RuntimeContext, __ScopeContext } from '../../src/ritz/runtime.context';
import { Workflow, StageReturn, FlowContext, StageOptions, ParallelExecError, StageInfo } from './pipeline.model';
import { __ritz_reflect } from '../../ritz.default';
import { v4 as uuidv4 } from 'uuid';
import { backfillArgs, decoratorHandler, errorCheck, notFromTransformedContext, punchGrab, TaggedTemplateSelfChain } from '../../src';
import { randomFillSync } from 'crypto';


enum PipelineCodesEnum {
  PARALLEL_EXEC_FAILURE,
}
export const PipelineCodes = ReturnCodeFamily('PipelineCodes', PipelineCodesEnum);

// function testDeco(...args): any { return (...args2) => {}; }

export class StageReflect__ {
  stage(...args): any {}

  // @__ritz_reflect
  stage_0(stageName?: string, stageClosure?: (scopeContext: __ScopeContext) => any): StageReturn { return null; };
  stage_2(stageOptions?: StageOptions): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => void { return null; }
  stage_3(...args: any[]): any { return null; }
}

export namespace run__ {
  export let parallel = null;
}

let _stage_reflect: StageReflect__;
export const stage__: typeof _stage_reflect.stage = (...args): any => {
  // Decorator handler
  if (notFromTransformedContext(args)) {
    if (!args[0]) {
      // called decorator with 0 arg
      return decoratorHandler({
        member: (target, memberName) => {
          addFlowContext(target, 'stage', memberName);
        }
      });
    } else if (args[0].constructor === Object) {
      // called decorator with first arg (StageOptions)
      const stageOptions = args[0];
      return decoratorHandler({
        member: (target, memberName) => {
          addFlowContext(target, 'stage', memberName);
          const anyFcb = getRuntime().functionContextCallbacks.any;
          const funcPath = `${target.constructor.name}.${memberName as string}`;
          if (!anyFcb[funcPath]) { anyFcb[funcPath] = []; }
          anyFcb[funcPath].push(fnCtx => {
            if (stageOptions) {
              if (stageOptions.name) { stageOptions.stageName = stageOptions.name; }
              Object.assign(fnCtx.scopeContext.data, stageOptions);
            }
          });
        }
      });
    }
    // uncalled decorator
    return decoratorHandler(args, {
      member: (target, memberName) => {
        addFlowContext(target, 'stage', memberName);
      }
    });
  }
  // Stage function
  // console.log('stage called', args[1]);
  const cce = args[0] as CallContextEvent;
  const a = backfillArgs(args.slice(1), 'stageName', 'stageClosure');
  if (a.stageName && typeof a.stageName === 'object') {
    a.stageName = a.stageName.name;
  }
  // console.e
  console.log(a.stageName);
  // console.log(a);
  return getRuntime().scopedExec<Result<StageReturn>>(
    cce, 'lugger:pipeline:stage', { data: { name: a.stageName }},
    async (resolve, reject, scopeContext) => {
      try {
        let res: any;
        if (a.stageClosure) {
          res = await errorCheck(a.stageClosure(scopeContext));
        }
        if (!res) { res = {}; }
        resolve(ok(res));
      } catch (e) {
        reject(e);
      }
    });
};
(stage__ as any).inCollationHandler = ((ica: InCollationArguments): InCollationReturn => {
  return {
    collationName: 'stage_' + Date.now() + '_' + randomFillSync(Buffer.from(' '.repeat(8))).toString('hex')
  }
}) as InCollationHandler;

export function step__(cce: CallContextEvent, ...stepArgs): any {
  const a = backfillArgs(stepArgs, 'stepName', 'stepClosure');
  return getRuntime().scopedExec(
    cce, 'lugger:pipeline:step', { data: { stepName: a.stepName }, requireParent: 'lugger:pipeline:stage' },
    async (resolve, reject, scopeContext) => {
      try {
        let res: StageReturn;
        if (a.stepClosure) {
          res = await errorCheck(a.stepClosure(scopeContext));
        }
        if (!res) { res = {}; }
        resolve(ok(res));
      } catch (e) {
        reject(e);
      }
    });
}

export function task__(cce: CallContextEvent, taskName?: string, stepClosure?: (ctx: __ScopeContext) => Promise<any>): any {
  // Step function
  return getRuntime().scopedExec(
    cce, 'lugger:pipeline:task', { data: { taskName }, requireParent: 'lugger:pipeline:stage' },
    async (resolve, reject, scopeContext) => {
      try {
        let res: StageReturn;
        if (stepClosure) {
          res = await stepClosure(scopeContext);
        }
        if (!res) { res = {}; }
        resolve(ok(res));
      } catch (e) {
        reject(e);
      }
    });
}

export function parallel__(cce: CallContextEvent, ...args) {
  const collator = new __RuntimeCollator();
  const a = backfillArgs(args, 'parallelOptions', 'closure');
  return getRuntime().scopedExec(
    cce, 'lugger:pipeline:parallel', { data: { collator } },
    async (resolve, reject, scopeContext) => {
      try {
        let immediateBlock: __BlockContext;
        scopeContext.onImmediateBlockContextAssign.push((scopeCtx, blockCtx) => {
          immediateBlock = blockCtx;
          blockCtx.collator = collator;
        });
        if (a.closure) {
          await errorCheck(a.closure(scopeContext));
        }
        const proms = [];
        const collationKeys = Object.keys(collator.collation);
        for (const key of collationKeys) {
          proms.push(promise(async (resolve, reject) => {
            try {
              return resolve(await errorCheck(collator.collation[key](scopeContext)));
            } catch (e) {
              // if (options.failFast) {
              //   getRuntime().setScopeError(scopeContext, null, e);
              // }
              return reject(e);
            }
          }));
        }
        let res = await PromUtil.allSettled(proms);
        const threadErrors: { key: string, error: Error }[] = [];
        let i = 0;
        const failedCollationKeys: string[] = [];
        res.forEach(a => {
          if (a instanceof Error) {
            const collationKey = collationKeys[i];
            threadErrors.push({ key: collationKey, error: a });
            failedCollationKeys.push(collationKey);
          }
          ++i;
        })
        if (threadErrors.length > 0) {
          const e = new ParallelExecError(`Parallel exec failed at threads: [${failedCollationKeys.join(', ')}]`);
          e.threadErrors = threadErrors;
          return reject(PipelineCodes.error('PARALLEL_EXEC_FAILURE', e).error);
        }
        return resolve(true);
        // if (!res) { res = {}; }
        // resolve(ok(res));
      } catch (e) {
        reject(e);
      }
    });
}

export class end__ {
  static if = (cond: any | Promise<any>) => {
    // ritzIfaceGuard('end.if', __filename); return null;
  };
}

export class flow__ {
  static assert = (cond: any | Promise<any>) => {
    // ritzIfaceGuard('end.if', __filename); return null;
  };
  static require = (cond: any | Promise<any>) => {
    // ritzIfaceGuard('end.if', __filename); return null;
  };
}

export function sleep__(ctx: __RuntimeContext, seconds: number) {
  return new Promise<Result<any>>(resolve => {
    setTimeout(() => { resolve(ok(true)) }, seconds * 1000);
  }); 
}
export function msleep__(ctx: __RuntimeContext, miliSeconds: number) {
  return new Promise<Result<any>>(resolve => {
    setTimeout(() => { resolve(ok(true)) }, miliSeconds);
  }); 
}

function addFlowContext(target: Class<any>, type: string, property: string | symbol, stageOptions?: StageOptions) {
  if (target.constructor) { target = target.constructor as any; }
  if (!(target as any).flowContexts) { (target as any).flowContexts = []; }
  (target as any).flowContexts.push({ type, target, property, stageOptions } as FlowContext);
}

export function runWorkflow__<T extends Workflow<any, any> = any>(cce: CallContextEvent, workflowClass: Class<T>):
ReturnType<T['finalReturn']> extends Promise<any> ? ReturnType<T['finalReturn']> : Promise<ReturnType<T['finalReturn']>> {
  return promise(async (resolve, reject) => {
    const flowContexts = (workflowClass as any).flowContexts as FlowContext[];
    const workflowId = uuidv4();
    const wfInst = new workflowClass();
    (wfInst as any).__workflowId = workflowId;
    (wfInst as any).__ctx = cce.scopeContext;
    const info: StageInfo = {
      workflow: wfInst,
      workflowId,
      workflowName: workflowClass.name,
      stageName: '',
      stageType: '',
      result: null,
      error: null,
      rethrow: true,
      startTime: Date.now(),
      duration: null,
      endTime: null,
      metadata: {},
    };
    let error: Error;
    for (const section of flowContexts) {
      try {
        await errorCheck(wfInst[section.property]());
      } catch (e) {
        error = e;
        break;
      }
    }
    if (error) { return reject(error); }
    let pipelineReturn: ReturnType<typeof wfInst.finalReturn>;
    if (wfInst.finalReturn) {
      pipelineReturn = await punchGrab((wfInst.finalReturn as any)(error));
    }
    return resolve(pipelineReturn as any);
  }) as any;
}

export function tteTestSample__(cce: CallContextEvent, ...args: string[]): TaggedTemplateSelfChain<PostfixReturn<string[]>> {
  return args as any;
}

export function targetFunc__(cce: CallContextEvent, ...args: any[]) {
  return args as any;
}

export namespace nested__ {
  export function targetFunc(cce: CallContextEvent, ...args: any[]) {
    return args as any;
  }
  export function taggedTemplate(cce: CallContextEvent, ...args: string[]): TaggedTemplateSelfChain<PostfixReturn<string[]>> {
    return args as any;
  }
  export namespace deep {
    export function targetFunc(cce: CallContextEvent, ...args: any[]) {
      return args as any;
    }
    export function taggedTemplate(cce: CallContextEvent, ...args: string[]): TaggedTemplateSelfChain<PostfixReturn<string[]>> {
      return args as any;
    } 
  }
}

export function nestedPromiseToNumber(): 10 {
  return promise(async resolve => {
    resolve(promise(async resolve2 => {
      resolve2(promise(async resolve3 => {
        resolve3(10);
      }));
    }));
  }) as any;
}

export function nestedPromiseToObject(): { sampleObject: true } {
  return promise(async resolve => {
    resolve(promise(async resolve2 => {
      resolve2(promise(async resolve3 => {
        resolve3({ sampleObject: true });
      }));
    }));
  }) as any;
}
