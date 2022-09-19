import { dataclass } from "@jovian/type-tools";
import { context, msleep, ritz, run, every, safe, defer, noInterrupt } from "../../ritz.default";
import { end, must, testDefine, should, testFileOptions, PostfixReturn, RunAsyncController, $, attr, flow, __ScopeContext } from "../../src";

testFileOptions({ runAlone: true });

// $(attr.config, { runAlone: true, try: 2 })
testDefine({ runAlone: true, try: 2 }, `safe closure should continue to run despite upstream throw and wait for completion`); {
    let i = 0;
    should.reach.collectAll; {
        should.throw; {
            run(() => {
                safe; {
                    // should run even with timeout throw
                    should.reach.first;
                    msleep(5);
                    should.reach.second;
                }
                msleep(10); // thrown during waiting
                should.NOT.reach;
                ++i;
            }).timeout(2, 'ms');
        }
    }
    check: i === 0;
}

// $(attr.config, { runAlone: true, try: 2 })
testDefine({ runAlone: true, try: 2 }, `safe closure should continue to run despite upstream throw`); {
    let i = 0;
    should.reach.collectAll; {
        should.throw; {
            run(() => {
                safe; {
                    context; {
                        should.reach.first;
                    }
                    setTimeout(() => {
                        should.reach.third;
                    }, 0);
                    should.reach.second;
                }
                setTimeout(() => {
                    ++i; // closure block sourced from thrown upstream should not run
                    should.NOT.reach;
                }, 7);
                msleep(1);
                context; {
                    should.reach.fourth;
                }
                should.reach.fifth;
                msleep(15); // thrown during waiting
                ++i;
                should.NOT.reach;
            }).timeout(4, 'ms');
        }
    }
    check: i === 0;
}

// $(attr.config, { runAlone: true, try: 2 })
testDefine({ runAlone: true, try: 2 }, `defer closure should not block`); {
    should.reach.collectAll; {
        defer(5, 'ms'); {
            should.reach.second;
        }
        should.reach.first;
        msleep(10);
        should.reach.third;
    }
}

// $(attr.config, { runAlone: true, try: 2 })
testDefine({ runAlone: true, try: 2 }, `defer closure should work without call expression`); {
    should.reach.collectAll; {
        defer; {
            should.reach;
        }
        msleep(1);
    }
}

// $(attr.config, { runAlone: true, try: 2 })
testDefine({ runAlone: true, try: 2 }, `defer closure should not run when canceled`); {
    should.reach.collectAll; {
        const control = defer(5, 'ms'); {
            should.NOT.reach;
        }
        control.cancel();
        control.join();
    }
}

// $(attr.config, { runAlone: true, try: 2 })
testDefine({ runAlone: true, try: 2 }, `defer closure should not run with upstream throw`); {
    should.reach.collectAll; {
        should.throw; {
            should.reach.first;
            defer(5, 'ms'); {
                should.NOT.reach;
            }
            should.reach.second;
            throws: new Error;
        }
        msleep(10);
    }
}

// $(attr.config, { runAlone: true, try: 2 })
testDefine({ runAlone: true, try: 2 }, `defer closure should run with upstream throw when wrapped under safe`); {
    should.reach.collectAll; {
        should.throw; {
            should.reach.first;
            safe; {
                defer(5, 'ms'); {
                    should.reach.third;
                }
            }
            should.reach.second;
            throws: new Error;
        }
        msleep(10);
    }
}

// $(attr.config, { runAlone: true, try: 2 })
testDefine({ runAlone: true, try: 2 }, `every closure should not block`); {
    should.reach.collectAll; {
        let i = 0;
        const control = every(5, 'ms'); {
            ++i;
            should.reach.second;
        }
        should.reach.first;
        msleep(50);
        control.cancel().join();
        should.reach.third;
        check: i >= 7;
        check: __context.elapsed < 100;
    }
}

// $(attr.config, { runAlone: true, try: 2 })
testDefine({ runAlone: true, try: 2 }, `every closure should still run with upstream throw when wrapped under noInterrupt`); {
    let control: PostfixReturn<RunAsyncController>;
    let count = 0;
    let countWhileThrown = 0;
    should.throw; {
        noInterrupt; {
            control = every(5, 'ms'); {
                if (__context.upstreamError) { ++countWhileThrown; }
                ++count;
            }
        }
        msleep(10);
        throws: new Error('attr');
    }
    msleep(50);
    control.cancel().join();
    check: count >= 7;
    check: countWhileThrown >= 7;
    check: __context.elapsed < 100;
}
