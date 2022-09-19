import { TestConfig } from '../src';
import { promise } from '@jovian/type-tools';

import './context/context.test';
import './postfix-methods/postfix-methods.test';
import './result/result.test';
import './globals/global-properties.test';
import './globals/super-globals.test';
import './decoration/decoration.test';
import './flow/flow.test';
import './transform/target-transform.test';
import './transform/error-stack.test';
import './transform/property-access.test';
import './transform/class-transform.test';
import './transform/collation.test';
import './transform/root-level-transform.test';
import './transform/tagged-template.test';

TestConfig.prepareBeforeAnyTest(async () => {
  await promise(resolve => setTimeout(resolve, 100));
});

// import './aat.test';
