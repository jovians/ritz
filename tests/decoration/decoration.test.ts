import { context, ritz, run } from "../../ritz.default";
import { $, Decoration, testDefine, should, getRuntime } from "../../src";
import { testConfigDeco } from "../_lib/decoration";
import { testBadResult, testGoodResult } from "../_lib/result";

// $(testConfigDeco)
// testDefine(`single testConfigDeco should add decoration to `); {
//     check: __context.decorations.containsEquivalent({ decorationKind: 'config' });
// }

// $(testConfigDeco, '1')
// $(testConfigDeco, '2')
// $(testConfigDeco, '3')
// testDefine(`multiple testConfigDeco with data should add corresponding decorations to context in order`); {
//     check: __context.decorations.equivalentTo([
//         { decorationKind: 'config', data: '1' },
//         { decorationKind: 'config', data: '2' },
//         { decorationKind: 'config', data: '3' }
//     ]);
// }

// $(testConfigDeco, '1')
// getRuntime();
// testDefine(`testConfigDeco should only decorate the next line statment`); {
//     check: __context.decorations.equivalentTo([]);
// }

// $(testConfigDeco, '1')
// $(testConfigDeco, '2')
// testDefine(`decorations should get compounded in scope contexts`); {
//     check: __context.decorations.equivalentTo([
//         { decorationKind: 'config', data: '1' },
//         { decorationKind: 'config', data: '2' },
//     ]);
//     $(testConfigDeco, '3')
//     context; {
//         check: __context.decorations.equivalentTo([
//             { decorationKind: 'config', data: '1' },
//             { decorationKind: 'config', data: '2' },
//             { decorationKind: 'config', data: '3' },
//         ]);
//     }
// }

// testDefine(`block-level decorations should only last for next statement`); {
//     $(testConfigDeco, '1')
//     $(testConfigDeco, '2')
//     $(testConfigDeco, '3')
//     check: __block.decorations.equivalentTo([
//         { decorationKind: 'config', data: '1' },
//         { decorationKind: 'config', data: '2' },
//         { decorationKind: 'config', data: '3' },
//     ]);
//     // should be cleared within next statement because previous statement consumed it
//     check: __block.decorations.equivalentTo([]);
// }
