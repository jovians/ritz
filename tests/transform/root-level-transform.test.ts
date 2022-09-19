import { ritz, run } from "../../ritz.default";
import { $, flow, testDefine, should, getRuntime, isAsyncFunction, testFileOptions } from "../../src";

const rootLevelOp = 0 + 2;

function rootLevelFunction() {}

export function rootLevelFunctionExported() {}

class rootLevelClass {
    memberMethod() { return 1; }
}
const rootLevelClassInstance = new rootLevelClass();
const rootLevelClassInstance$r = $r;

export class rootLevelClassExported {
    memberMethod() { return 1; }
}
const rootLevelClassExportedInstance = new rootLevelClassExported();
const rootLevelClassExportedInstance$r = $r;

rootLevelFunction();
rootLevelFunctionExported();

const superGlobalContext = __context;
const superGlobalBlock = __block;

testDefine(`root-level function call should also be transformed`); {
    check: getRuntime().getFunctionCallCount('rootLevelFunction') === 1;
    check: getRuntime().getFunctionCallCount('rootLevelFunctionExported') === 1;
}

testDefine(`root-level function declaration should be transformed into async`); {
    check: isAsyncFunction(rootLevelFunction);
    check: isAsyncFunction(rootLevelFunctionExported);
}

testDefine(`root-level class method declaration should be transformed into async`); {
    check: isAsyncFunction(rootLevelClassInstance.memberMethod);
    check: isAsyncFunction(rootLevelClassExportedInstance.memberMethod);
}

testDefine(`root-level class method call's return should be reduced to actual value`); {
    const methodReturn = rootLevelClassInstance.memberMethod();
    const methodReturn2 = rootLevelClassExportedInstance.memberMethod();
    check: methodReturn === 1;
    check: methodReturn2 === 1;
    check: rootLevelClassInstance.memberMethod() === 1;
    check: rootLevelClassExportedInstance.memberMethod() === 1;
}

testDefine(`root-level $r should be last statement's return`); {
    check: rootLevelClassInstance$r === rootLevelClassInstance;
    check: rootLevelClassExportedInstance$r === rootLevelClassExportedInstance;
}

testDefine(`root-level usage of super globals '__context' and '__block' be correctly defined`); {
    check: superGlobalContext.isScopeContext;
    check: superGlobalBlock.isBlockContext;
}
