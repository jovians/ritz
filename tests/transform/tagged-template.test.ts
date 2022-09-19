import { ritz, run } from "../../ritz.default";
import { testDefine } from "../../src";
import { nested, tteTestSample } from "../_lib/pipeline.ritz.default";

testDefine(`tagged templated with transform target should function correctly`); {
    const res = '123';
    const res2 = 'ABC';
    tteTestSample `test ${res} aaaaaa ${res2}` `test1`;
    const test1 = tteTestSample `test ${res} aaaaaa ${res2}` `test1 ${res}`.try(20) `test2` `test3 ${res}`.timeout(30);
    // @ts-ignore
    check: test1 == [`test ${res} aaaaaa ${res2}`, `test1 ${res}`, `test2`, `test3 ${res}`];
    const test2 = (tteTestSample) `test ${res} aaaaaa ${res2}` `test1`;
    // @ts-ignore
    check: test2 == [`test ${res} aaaaaa ${res2}`, `test1`];
}

testDefine(`tagged templated with nested transform target should function correctly`); {
    const res = '123';
    const res2 = 'ABC';
    nested.taggedTemplate `test ${res} aaaaaa ${res2}` `test1`;
    const test1 = nested.taggedTemplate `test ${res} aaaaaa ${res2}` `test1`;
    // @ts-ignore
    check: test1 == [`test ${res} aaaaaa ${res2}`, `test1`];
    const test2 = (nested).taggedTemplate `test ${res} aaaaaa ${res2}` `test1`;
    // @ts-ignore
    check: test2 == [`test ${res} aaaaaa ${res2}`, `test1`];
    const test3 = (nested.taggedTemplate) `test ${res} aaaaaa ${res2}` `test1`;
    // @ts-ignore
    check: test3 == [`test ${res} aaaaaa ${res2}`, `test1`];
    const test4 = ((nested).taggedTemplate) `test ${res} aaaaaa ${res2}` `test1`;
    // @ts-ignore
    check: test4 == [`test ${res} aaaaaa ${res2}`, `test1`];
    nested.deep.taggedTemplate `test ${res} aaaaaa ${res2}` `test1`;
    const test5 = nested.deep.taggedTemplate `test ${res} aaaaaa ${res2}` `test1`;
    // @ts-ignore
    check: test5 == [`test ${res} aaaaaa ${res2}`, `test1`];
    const test6 = (nested).deep.taggedTemplate `test ${res} aaaaaa ${res2}` `test1`;
    // @ts-ignore
    check: test6 == [`test ${res} aaaaaa ${res2}`, `test1`];
    const test7 = (nested.deep.taggedTemplate) `test ${res} aaaaaa ${res2}` `test1`;
    // @ts-ignore
    check: test7 == [`test ${res} aaaaaa ${res2}`, `test1`];
    const test8 = ((nested).deep.taggedTemplate) `test ${res} aaaaaa ${res2}` `test1`;
    // @ts-ignore
    check: test8 == [`test ${res} aaaaaa ${res2}`, `test1`];
    const test9 = (((nested).deep).taggedTemplate) `test ${res} aaaaaa ${res2}` `test1`;
    // @ts-ignore
    check: test9 == [`test ${res} aaaaaa ${res2}`, `test1`];
    // TODO
    // const test10 = ((<any>(nested).deep).taggedTemplate) `test ${res} aaaaaa ${res2}` `test1`;
    // // @ts-ignore
    // check: test10 == [`test ${res} aaaaaa ${res2}`, `test1`];
    // const test11 = (((nested).deep as any).taggedTemplate) `test ${res} aaaaaa ${res2}` `test1`;
    // // @ts-ignore
    // check: test11 == [`test ${res} aaaaaa ${res2}`, `test1`];
}
