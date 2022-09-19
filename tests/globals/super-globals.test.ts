import { context, msleep, ritz, run } from "../../ritz.default";
import { $, attr, flow, testDefine, should, getRuntime, isAsyncFunction, __ScopeContext } from "../../src";

class SuperGlobalsTestClass {

    memberReturnsFunctionContext() {
        return __function;
    }

    memberReturnsScopeContext() {
        return __context;
    }

    memberReturnsScopeContextWithinContext() {
        let contextFromContext: __ScopeContext;
        context('context-from-context'); {
            contextFromContext = __context;
        }
        return contextFromContext;
    }

    memberReturnsBlockContext() {
        return __block;
    }
}
const inst = new SuperGlobalsTestClass;

testDefine(`superglobal __funtion should contain valid information regarding function`); {
    const functionContext = inst.memberReturnsFunctionContext();
    check: functionContext.funcName === 'memberReturnsFunctionContext';
    check: functionContext.funcPath === 'SuperGlobalsTestClass.memberReturnsFunctionContext';
}

testDefine(`superglobal __context from root-level should be root file context`); {
    const scopeContext = inst.memberReturnsScopeContext();
    check: scopeContext.scope === 'file'
    check: scopeContext.parent === null
}

testDefine(`superglobal __context from context-level should be root file context`); {
    const scopeContext = inst.memberReturnsScopeContextWithinContext();
    check: scopeContext.scope === 'context-from-context'
    check: scopeContext.parent.scope === 'file'
}


// $(attr.config, { runAlone: true, try: 2 })
testDefine({ runAlone: true, try: 2 }, `superglobal __context should have working elapsed value after msleep(10)`); {
    msleep(10);
    check: (__context.elapsed - 10).within(5);
}

// $(attr.config, { runAlone: true, try: 2 })
testDefine({ runAlone: true, try: 2 }, `superglobal __block should have working elapsed value after msleep(10)`); {
    msleep(10);
    check: (__block.elapsed - 10).within(5);
}

