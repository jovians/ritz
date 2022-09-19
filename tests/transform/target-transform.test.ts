import { ritz, run } from "../../ritz.default";
import { testDefine } from "../../src";
import { targetFunc, nested } from "../_lib/pipeline.ritz.default";

testDefine(`generic ritz target transform should work`); {
    let args;
    targetFunc('test1', 'test2');
    args = $r;
    // @ts-ignore
    check: args == ['test1', 'test2'];
    args = targetFunc('test3', 'test4');
    // @ts-ignore
    check: args == ['test3', 'test4'];
}

testDefine(`nested generic ritz target transform should work`); {
    let args;
    
    nested.targetFunc('test1', 'test2');
    args = $r;
    // @ts-ignore
    check: args == ['test1', 'test2'];
    args = nested.targetFunc('test3', 'test4');
    // @ts-ignore
    check: args == ['test3', 'test4'];
    
    nested.deep.targetFunc('test1', 'test2');
    args = $r;
    // @ts-ignore
    check: args == ['test1', 'test2'];
    args = nested.deep.targetFunc('test3', 'test4');
    // @ts-ignore
    check: args == ['test3', 'test4'];

    ((nested).deep.targetFunc)('test1', 'test2');
    args = $r;
    // @ts-ignore
    check: args == ['test1', 'test2'];
    args = ((nested).deep.targetFunc)('test3', 'test4');
    // @ts-ignore
    check: args == ['test3', 'test4'];
}
