import { check, ritz, run } from "../../ritz.default";
import { $, flow, testDefine, should, getRuntime, isAsyncFunction } from "../../src";
import { ClassWithFunction1, ClassWithFunction2 } from "../_lib/pipeline.base";
import { stage } from "../_lib/pipeline.ritz.default";

const a = {
    b: null as unknown as { c: 1 },
    c: null as unknown as  { d: () => {} },
    d: { e: null as unknown as  () => {} },
    e: null as unknown as  [{ test: 1 }],
    f: {
        g: [{
            h: () => {
                return [5, [6, 7, { i: 1 }]];
            }
        }]
    }
};

const b = null as unknown as  {
    c: { d: 1 }
};

testDefine(`optional chaining should be honored`); {
    check: a.b?.c === null;
    check: a.c?.d() === null;
    check: a.d?.e?.() === null;
    check: a.e?.[0].test === null;
    check: a.f.g[0].h()[1][2].i === 1;
    check: a?.f?.g?.[0].h?.()?.[1]?.[2].i === 1;
    check: b?.c.d === null;
}

testDefine({ runAlone: true, try: 2 }, `function calls with thisArg should be honored with nested property access and calls`); {
    const obj = {
        aInside: new ClassWithFunction1(),
        bInside: new ClassWithFunction2(),
    };
    const a = new ClassWithFunction1();
    const b = new ClassWithFunction2();
    obj.aInside.func1({ field: b.func2({ field: obj.bInside.func2({ field3: obj.aInside.func1(3) })}) });
    a.func1({ field: b.thisRef, field2: obj.bInside.func2({ field3: a.func1(3) }) });
}
