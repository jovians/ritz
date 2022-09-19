// RITZ SKIP
import { promise } from "@jovian/type-tools";
import { ContextType, FlowEventType } from "./private.models";
import { ritzIfaceGuard } from "./ritz";
import { punchGrab } from "./ritz-util.misc";
import { __BlockContext, __ScopeContext } from "./runtime.context";

export class FlowBlockFinalizer<ReturnType = any, ErrorType = Error> {
  onReturn: (r: ReturnType) => Promise<any>;
  onThrow: (e: ErrorType) => Promise<any>;
  onAny?: (e: ErrorType, r: ReturnType) => Promise<any>;
  constructor(init?: Partial<FlowBlockFinalizer<ReturnType, ErrorType>>) {
    if (init) { Object.assign(this, init); }
  }
}

export class end {
  static if = (cond: any | Promise<any>) => {
    
  };
}

export class flow {
  static assert = flowAssert;
  static require = flowRequire;
  static pause = flowPause;
  static cadence = flowCadence;
  static finally = flowFinally;
}

type InvokeContext = [ string, string, __ScopeContext, __BlockContext ];

function getRuntime(): any {
  const rctx = (process as any).runtimeContextInfo;
  return rctx.contexts[rctx.currentContext];
}
function getInvokeContext(): InvokeContext {
  return getRuntime().immediateInvokeContext;
}

function flowAssert(cond: any | Promise<any>);
function flowAssert(cond: any | Promise<any>, message?: string);
function flowAssert(cond: any | Promise<any>, ...args) {
  const invokeCtx = getInvokeContext();
  let message = '';
  if (args[1]) {
    message = args[1];
  }
  return promise<boolean>(async (resolve, reject) => {
    if (!verifyInvokeContext(invokeCtx)) { ritzIfaceGuard('flow.assert', __filename); }
    const [ flowId, sourceLocation, scopeContext, blockContext ] = invokeCtx;
    cond = await punchGrab(cond);
    if (cond) { return resolve(true); }
    return reject(new Error(`flow.assert: ${message}`))
  });
}
function flowRequire(ctxType: ContextType) {
  const invokeCtx = getInvokeContext();
  return promise<string>(async (resolve, reject) => {
    if (!verifyInvokeContext(invokeCtx)) { ritzIfaceGuard('flow.require', __filename); }
    const [ flowId, sourceLocation, scopeContext, blockContext ] = invokeCtx;
    if (ctxType === 'context') {
      resolve(scopeContext.pause());
    } else {
      resolve(blockContext.pause());
    }
  });
}
function flowPause(ctxType: ContextType) {
  const invokeCtx = getInvokeContext();
  return promise<string>(async (resolve, reject) => {
    if (!verifyInvokeContext(invokeCtx)) { ritzIfaceGuard('flow.pause', __filename); }
    const [ flowId, sourceLocation, scopeContext, blockContext ] = invokeCtx;
    if (ctxType === 'context') {
      resolve(scopeContext.pause());
    } else {
      resolve(blockContext.pause());
    }
  });
}
function flowCadence(ctxType: ContextType, flowType: FlowEventType, cadenceMs: number | Promise<number>);
function flowCadence(ctxType: ContextType, cadenceDef: {[Key in FlowEventType]?: number});
function flowCadence(ctxType: ContextType, ...args) {
  const invokeCtx = getInvokeContext();
  if (typeof args[0] === 'string') {
    const flowType = args[0] as FlowEventType;
    const cadenceMs = args[1] as number;
    const invokeCtx = args[2] as InvokeContext;
    if (!verifyInvokeContext(invokeCtx)) { ritzIfaceGuard('flow.cadence', __filename); }
    const [ flowId, sourceLocation, scopeContext, blockContext ] = invokeCtx;
    return promise<boolean>(async (resolve, reject) => {
      let cadenceValue = await punchGrab(cadenceMs);
      if (cadenceValue === null) { cadenceValue = undefined; }
      if (!blockContext) { try { return resolve(ritzIfaceGuard('flow.cadence', __filename)); } catch (e) { return reject(e); } }
      if (ctxType === 'context') {
        scopeContext.cadenceDef[flowType] = cadenceValue;
      } else {
        blockContext.cadenceDef[flowType] = cadenceValue;
      }
      resolve(true);
    });
  } else {
    let cadenceDef = args[0] as {[Key in FlowEventType]?: number};
    if (!cadenceDef) { cadenceDef = {}; }
    const invokeCtx = args[1] as InvokeContext;
    if (!verifyInvokeContext(invokeCtx)) { ritzIfaceGuard('flow.cadence', __filename); }
    const [ flowId, sourceLocation, scopeContext, blockContext ] = invokeCtx;
    return promise<boolean>(async (resolve, reject) => {
      if (!blockContext) { try { return resolve(ritzIfaceGuard('flow.cadence', __filename)); } catch (e) { return reject(e); } }
      if (ctxType === 'context') {
        scopeContext.cadenceDef = cadenceDef;
      } else {
        blockContext.cadenceDef = cadenceDef;
      }
      resolve(true);
    });
  }
}
function flowFinally(finalizer: FlowBlockFinalizer | { onThrow: (e: Error) => Promise<any>; onReturn: (r: any) => Promise<any>; onAny?: (e: Error, r: any) => Promise<any> } | Promise<FlowBlockFinalizer>) {
  const invokeCtx = getInvokeContext();
  return promise<boolean>(async (resolve, reject) => {
    if (!verifyInvokeContext(invokeCtx)) { ritzIfaceGuard('flow.finally', __filename); }
    const [ flowId, sourceLocation, scopeContext, blockContext ] = invokeCtx;
    let ctl = finalizer as FlowBlockFinalizer;
    if (!ctl) { return resolve(false); }
    if ((ctl as any)?.then) { ctl = await punchGrab(ctl); }
    if (!blockContext.onBlockEnds) { blockContext.onBlockEnds = []; }
    blockContext.onBlockEnds.push(async (e, r) => {
      try {
        if (e) {
          if (ctl.onThrow) {
            await ctl.onThrow(e);
          }
        } else {
          if (ctl.onReturn) {
            await ctl.onReturn(r);
          }
        }
      } catch (e2) {
        getRuntime().error(e2);
      }
      try {
        if (ctl.onAny) {
          await ctl.onAny(e, r);
        }
      } catch (e2) {
        getRuntime().error(e2);
      }
    });
    return resolve(true);
  });
}
function verifyInvokeContext(ctx: InvokeContext) {
  if (!ctx) { return false; }
  if (ctx?.length !== 4) { return false; }
  return (
    typeof ctx[0] === 'string' &&
    typeof ctx[1] === 'string' &&
    ctx[2] && ctx[2].isScopeContext &&
    ctx[3] && ctx[3].isBlockContext
  );
}
