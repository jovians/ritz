import { context, msleep, ritz, run } from "../../ritz.default";
import { $, flow, testDefine, should, getRuntime, isAsyncFunction, testFileOptions } from "../../src";
import { StageOptions } from "../_lib/pipeline.model";
import { stage } from "../_lib/pipeline.ritz.default";

testFileOptions({ runAlone: true });

class TestClass {
    constructor() {

    }

    // @ts-ignore
    @stage memberMethod1() {
        check: this.constructor.name === 'TestClass'
        check: __context.scope === 'lugger:pipeline:stage'
    }

    // @ts-ignore
    @stage({ name: 'test' }) memberMethod2() {
        check: __context.getData<StageOptions>().name === 'test'
        check: __context.scope === 'lugger:pipeline:stage'
    }

    memberMethod3() {
        return __function;
    }

    memberMethod4() {
        let ctx;
        context('test-context'); {
            ctx = __context;
        };
        return ctx;
    }

    // @ts-ignore
    @stage sleepingStage() {
        msleep(10);
    }

    post() {

    }
}
const testClassInst = new TestClass;

testDefine(`transformed class with eligible scoped decorator should have scope as the scoped function`); {
    testClassInst.memberMethod1();
}

testDefine(`transformed class with eligible scoped decorator should scoped with overriden context data`); {
    testClassInst.memberMethod2();
}

testDefine(`transformed class with member function should have right function context info when returned`); {
    const fnCtx = testClassInst.memberMethod3();
    check: fnCtx.funcName === 'memberMethod3';
    check: fnCtx.funcPath === 'TestClass.memberMethod3';
}

testDefine(`transformed class with member function should have right scope context info when returned`); {
    const scopeCtx = testClassInst.memberMethod4();
    check: scopeCtx.scope === 'test-context';
}

testDefine(`transformed class with member should auto await inside`); {
    testClassInst.sleepingStage();
    check: __context.elapsed >= 10;
    check: __context.elapsed <= 20;
}
