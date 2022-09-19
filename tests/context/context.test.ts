import { context, ritz, safe } from "../../ritz.default";
import { end, should, testDefine } from "../../src";

testDefine(`context closure should be possible with block notation`); {
  should.reach.collectAll; {
    context; { should.reach; }
    context('test'); { should.reach; }
  }
};

testDefine(`context closure should with line break before block notation`); {
  should.reach.collectAll; {
    context('test');
    {
      check: __context.scope === 'test';
      should.reach;
    }
  }
};

testDefine(`context closure should be possible with arrow function notation`); {
  should.reach.collectAll; {
    context; () => { should.reach; }
    context('test'); () => { should.reach; }
  }
};

testDefine(`context with no name given should be (anonymous_context_N)`); {
  context; {
    check: __context.scope.startsWith('(anonymous_context')
  }
}

testDefine(`context with given name should have that name`); {
  const ctxName = 'Test Context Name';
  context(ctxName); {
    check: __context.scope === ctxName;
  }
};
