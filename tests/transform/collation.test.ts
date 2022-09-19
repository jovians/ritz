import { msleep, ritz, run } from "../../ritz.default";
import { $, flow, testDefine, should, getRuntime, isAsyncFunction } from "../../src";
import { StageOptions } from "../_lib/pipeline.model";
import { parallel, stage } from "../_lib/pipeline.ritz.default";

testDefine({ runAlone: true, try: 3 },`Collation should register all collations`); {
    class TestClass {
        @stage memberMethod1() {
            let i = 0;
            parallel; {
                `task1`; { ++i; }
                `task2`; { ++i; }
                `task3`; { ++i; }
                check: Object.keys(__block.collator.collation).length === 3;
            }
        }
    }
    new TestClass().memberMethod1();
}

testDefine({ runAlone: true, try: 3 }, `Collation should register all collations with arrow function`); {
    class TestClass {
        @stage memberMethod1() {
            let i = 0;
            parallel; {
                `task1`; () => { i += 2; }
                `task2`; () => { i += 2; }
                check: Object.keys(__block.collator.collation).length === 2;
            }
            check: i === 4;
        }
    }
    new TestClass().memberMethod1();
}


testDefine({ runAlone: true, try: 3 }, `target.inCollationHandler should honor collation during collation context`); {
    should.reach.collectAll; {
        parallel; {
            stage; {
                should.reach.second;
                msleep(10);
                parallel; {
                    stage; {
                        msleep(10);
                    }
                    stage; {
                        msleep(10);
                    }
                }
            }
            stage; {
                should.reach.second;
                parallel; {
                    stage; {
                        msleep(10);
                    }
                    stage; {
                        msleep(10);
                    }
                }
            }
            should.reach.first;
            check: Object.keys(__block.collator.collation).length === 2;
        }
    }
    check: __context.elapsed >= 20;
    check: __context.elapsed <= 30;
}
