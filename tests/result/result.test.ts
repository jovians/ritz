import { ritz, run } from "../../ritz.default";
import { testDefine, should } from "../../src";
import { testBadResult, testGoodResult } from "../_lib/result";

testDefine(`testGoodResult should not interfere with flow`); {
    let i = 0;
    run(() => {
        const res = testGoodResult(); returnBad: res;
        i = 1;
    });
    check: i === 1;
}

testDefine(`testBadResult with throwBad should throw`); {
    should.throw; {
        run(() => {
            const res = testBadResult(); throwBad: res;
            should.not.reach;
        });
    }
}
