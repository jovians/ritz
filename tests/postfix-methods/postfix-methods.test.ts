import { context, ritz, run, safe } from "../../ritz.default";
import { end, should, testDefine } from "../../src";

testDefine(`run function should run`); {
  should.reach.collectAll; {
    run(() => { should.reach; });  
  }
}

testDefine(`repeat should run n times`); {
  const runCount = 10;
  let counter = 0;
  run(() => {
    ++counter;
  }).repeat(runCount);
  check: counter === runCount;
}

testDefine(`times should run n times`); {
  const runCount = 10;
  let counter = 0;
  run(() => {
    ++counter;
  }).times(runCount);
  check: counter === runCount;
}

testDefine(`run expression should be able to be wrapped in postfix method`); {
  should.reach.collectAll; {
    run(() => {
      // @ts-ignore
      check: __context.postfixContext.config.try == [5]
      // @ts-ignore
      check: __context.postfixContext.config.repeat == [3]
      // @ts-ignore
      check: __context.postfixContext.config.times == [1]
      // @ts-ignore
      check: __context.postfixContext.config.timeout == [10, 's']
      should.reach;
    }).try(5)
      .repeat(3)
      .times(1)
      .timeout(10, 's');
  }
}

testDefine(`postfix context should honor the last config among duplicate calls`); {
  should.reach.collectAll; {
    run(() => {
      // @ts-ignore
      check: __context.postfixContext.config.try == [7]
      // @ts-ignore
      check: __context.postfixContext.config.repeat == [3]
      // @ts-ignore
      check: __context.postfixContext.config.times == [1]
      // @ts-ignore
      check: __context.postfixContext.config.timeout == [10, 's']
      should.reach;
    }).repeat(3)
      .times(1)
      .timeout(10, 's')
      .try(1)
      .try(3)
      .try(5)
      .try(7)
  }
}

testDefine(`inline expression should be able to be wrapped in postfix method`); {
  should.reach.collectAll; {
    (async () => {
      // @ts-ignore
      check: __context.postfixContext.config.try == [6]
      // @ts-ignore
      check: __context.postfixContext.config.backoff == ['constantOf', 0]
      // @ts-ignore
      check: __context.postfixContext.config.repeat == [2]
      // @ts-ignore
      check: __context.postfixContext.config.times == [1]
      // @ts-ignore
      check: __context.postfixContext.config.timeout == [20, 's']
      should.reach;
    })()._
      .try(6)
      .backoff('constantOf', 0)
      .repeat(2)
      .times(1)
      .timeout(20, 's');
  }
}

testDefine(`postfix transform should work with variable declaration`); {
  should.reach.collectAll; {
    const out = run(() => {
      // @ts-ignore
      check: __context.postfixContext.config.times == [2]
      // @ts-ignore
      check: __context.postfixContext.config.timeout == [20, 's']
      should.reach;
      return 1;
    }).times(2).timeout(20, 's');
    check: out === 1;
  }
}

testDefine(`postfix transform should work with assignment operation`); {
  should.reach.collectAll; {
    let out;
    out = run(async () => {
      // @ts-ignore
      check: __context.postfixContext.config.times == [3]
      // @ts-ignore
      check: __context.postfixContext.config.timeout == [20, 's']
      should.reach;
      return 2;
    }).times(3).timeout(20, 's');
    check: out === 2;
  }
}
