/* Jovian (c) 2020, License: MIT */
// RITZ SKIP
import { ix, promise, Promise2, PromUtil, Result, spotfull } from "@jovian/type-tools";
import { v4 as uuidv4 } from 'uuid';
import { version as runtimeVersion } from '../../package.json';
import { bufferStringify, deepError, grabActualResult, isClass, punchGrab, TimeUnit, unitTimeMs } from "./ritz-util.misc";
import { CallContextPhase, doNotSet, FlowEventKind, FlowEventType, gcReg, gcRegConfig, gcRegCount, getId, releaseId } from "./private.models";
import { globalProperties, globalPropertiesLookUpBehavior, GlobalPropertyLookUpEvent, propertyRequiringDirectAccess } from "./global.words.list";
import colors from 'colors/safe';
import { ritzIfaceGuard } from "./ritz";

export interface FlowTrackingEvent {
  flowId: string;
  uuid: string;
  async: boolean;
  sourceLocation: string;
  scopeContext: __ScopeContext;
  blockContext: __BlockContext;
  runtimeContext: __RuntimeContext;
  type: FlowEventType;
  info: string;
  metadata?: any;
  referenceCount: number;
  skipPauseCheck?: boolean;
  time: number;
  release?: () => void;
};

export interface CommentData {
  p: string;
  t: 'single' | 'multi' | 'doc';
  c: string;
  r: string;
}

const ordinalMap = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
  eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15, sixteenth: 16, seventeenth: 17,
  eighteenth: 18, nineteenth: 19, twentieth: 20,
  _1: 1, _2: 2, _3: 3, _4: 4, _5: 5, _6: 6, _7: 7, _8: 8, _9: 9, _10: 10, 
  _11: 11, _12: 12, _13: 13, _14: 14, _15: 15, _16: 16, _17: 17, _18: 18, _19: 19, _20: 20, 
};
const ordinalArrayNamed = [
  null, 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth',
  'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth', 'seventeenth',
  'eighteenth', 'nineteenth', 'twentieth',
];
const ordinalArrayNumber = [
  null, '_1', '_2', '_3', '_4', '_5', '_6', '_7', '_8', '_9', '_10',
  '_11', '_12', '_13', '_14', '_15', '_16', '_17', '_18', '_19', '_20',
];

export interface CallContextEvent<FunctionType extends (...args) => any = any> {
  async: boolean;
  fromTaggedTemplate: boolean;
  isCallContextEvent: boolean;
  scopeContext: __ScopeContext;
  blockContext: __BlockContext;
  runtimeContext: __RuntimeContext;
  uuid: string;
  callId: string;
  func: Function;
  funcImportedName: string;
  funcOverloadType: string;
  data: {[key: string]: any};
  args: {
    original: [CallContextEvent, ...Parameters<FunctionType>];
    final: [CallContextEvent, ...Parameters<FunctionType>];
  };
  hasThrown: boolean;
  error: {
    original: Error;
    final: Error;
  };
  result: {
    original: ReturnType<FunctionType>;
    final: ReturnType<FunctionType>;
  };
  currentHandler: HandlerInfo<FunctionType>;
  allHandlerSources: {
    beforeCall: HandlerInfo<FunctionType>[];
    functionThrow: HandlerInfo<FunctionType>[];
    afterCall: HandlerInfo<FunctionType>[];
  };
  phase: CallContextPhase;
  phaseAny: boolean;
  processorErrors: {
    beforeCall: Error[];
    functionThrow: Error[];
    afterCall: Error[];
  };
  propagationCanceled: {
    beforeCall: { canceledBy: HandlerInfo<FunctionType>[]; }
    functionThrow: { canceledBy: HandlerInfo<FunctionType>[]; }
    afterCall: { canceledBy: HandlerInfo<FunctionType>[]; }
  };
  ignoredHandlerContexts: {
    [key: string]: { ignoredBy: HandlerInfo<FunctionType>[]; };
  },
  returnNullOnThrow: boolean;
  time: number;
  onSkippedHandling?: (event: CallContextEvent<FunctionType>, skippedDueTo: HandlerInfo<FunctionType>[]) => any;
  ignoreHandlerContext: (handlerContext: string) => void;
  stopHere: () => any;
  release?: () => void;
}

interface HandlerInfo<HandlerType = Function> {
  handlerContext: string;
  addedAt: string;
  handler: HandlerType;
}

interface HandlerRegistryByName<HandlerType = Function> {
  [callableName: string]: {
    source?: string;
    list?: HandlerInfo<HandlerType>[];
  }
}

export interface Decoration {
  decorationKind?: 'config' | 'setReplace';
  type?: string;
  data?: any;
}

export type CCE = CallContextEvent;

type LabeledContextProvider = (before: __ScopeContext) => any;

export interface OperandInterceptResult {
  a?: boolean;
  b?: boolean;
  c?: boolean;
  return?: boolean;
  overrideValue?: {
    a?;
    b?;
    c?;
    return?;
  }
}

export type OperandPreprocessHandler = (cce: CCE, opName: RitzOperandPreprocessType, self: any, ...operands) => OperandInterceptResult;

function handleOperandsOverride(cce: CCE, opName: RitzOperandPreprocessType, self: any, ...operands) {
  if (self && self[opName]) {
    return (self[opName] as OperandPreprocessHandler)(cce, opName, self, ...operands);
  } else if (self === null) {
    return cce.scopeContext.operandPreprocessingNull?.[opName]?.(cce, opName, self, ...operands);
  } else if (self === undefined) {
    return cce.scopeContext.operandPreprocessingUndefined?.[opName]?.(cce, opName, self, ...operands);
  }
  const t = typeof self;
  if (t === 'number') {
    return cce.scopeContext.operandPreprocessingNumber?.[opName]?.(cce, opName, self, ...operands);
  } else if (t === 'bigint') {
    return cce.scopeContext.operandPreprocessingBigInt?.[opName]?.(cce, opName, self, ...operands);
  } else if (t === 'boolean') {
    return cce.scopeContext.operandPreprocessingBoolean?.[opName]?.(cce, opName, self, ...operands);
  } else if (t === 'string') {
    return cce.scopeContext.operandPreprocessingString?.[opName]?.(cce, opName, self, ...operands);
  } else if (t === 'symbol') {
    return cce.scopeContext.operandPreprocessingSymbol?.[opName]?.(cce, opName, self, ...operands);
  }
  return null;
}

export type RitzOperandPreprocessType = (
  'on this++' |
  'on this--' |
  'on ++this' |
  'on --this' |
  'on +this' |
  'on -this' |
  'on !this' |
  'on ~this' |
  
  'on void this' |
  'on typeof this' |
  
  'on this + b' |
  'on a + this' |
  'on this - b' |
  'on a - this' |
  'on this * b' |
  'on a * this' |
  'on this / b' |
  'on a / this' |
  'on this % b' |
  'on a % this' |
  'on this ** b' |
  'on a ** this' |
  
  'on this == b' |
  'on a == this' |
  'on this === b' |
  'on a === this' |
  'on this != b' |
  'on a != this' |
  'on this !== b' |
  'on a !== this' |
  'on this > b' |
  'on a > this' |
  'on this >= b' |
  'on a >= this' |
  'on this < b' |
  'on a < this' |
  'on this <= b' |
  'on a <= this' |

  'on this && b' |
  'on a && this' |
  'on this || b' |
  'on a || this' |
  'on this ?? b' |
  'on a ?? this' |

  'on this & b' |
  'on a & this' |
  'on this | b' |
  'on a | this' |
  'on this ^ b' |
  'on a ^ this' |
  'on this << b' |
  'on a << this' |
  'on this >> b' |
  'on a >> this' |
  'on this >>> b' |
  'on a >>> this' |

  'on this in b' |
  'on a in this' |

  'on delete this[b]' |
  'on delete a[this]' |

  'on this instanceof b' |
  'on a instanceof this' |

  'on this ? b : c' |
  'on a ? this : c' |
  'on a ? b : this'
);

export interface OperandPreprocessRubric {
  null?: {[opName in RitzOperandPreprocessType]?: OperandPreprocessHandler};
  undefined?: {[opName in RitzOperandPreprocessType]?: OperandPreprocessHandler};
  boolean?: {[opName in RitzOperandPreprocessType]?: OperandPreprocessHandler};
  number?: {[opName in RitzOperandPreprocessType]?: OperandPreprocessHandler};
  bigint?: {[opName in RitzOperandPreprocessType]?: OperandPreprocessHandler};
  string?: {[opName in RitzOperandPreprocessType]?: OperandPreprocessHandler};
  symbol?: {[opName in RitzOperandPreprocessType]?: OperandPreprocessHandler};
};

export class RitzOperatorRubric {
  name = 'default';
  useDefaultRubricWhenOperatorNotFound = true;

  // unary postfix
  'x++'(cce: CCE, a): any {
    const oo =  handleOperandsOverride(cce, 'on this++', a, a);
    if (oo) {
      if (oo.a) { a = oo.overrideValue.a; }
      if (oo.return) { return oo.overrideValue.return; }
    }
    return a;
  }
  'x--'(cce: CCE, a): any {
    const oo =  handleOperandsOverride(cce, 'on this--', a, a);
    if (oo) {
      if (oo.a) { a = oo.overrideValue.a; }
      if (oo.return) { return oo.overrideValue.return; }
    }
    return a;
  }

  // unary prefix
  '++x'(cce: CCE, a): any {
    const oo =  handleOperandsOverride(cce, 'on ++this', a, a);
    if (oo) {
      if (oo.a) { a = oo.overrideValue.a; }
      if (oo.return) { return oo.overrideValue.return; }
    }
    return ++a;
  }
  '--x'(cce: CCE, a): any {
    const oo =  handleOperandsOverride(cce, 'on --this', a, a);
    if (oo) {
      if (oo.a) { a = oo.overrideValue.a; }
      if (oo.return) { return oo.overrideValue.return; }
    }
    return --a;
  }
  '+x'(cce: CCE, a): any {
    const oo =  handleOperandsOverride(cce, 'on +this', a, a);
    if (oo) {
      if (oo.a) { a = oo.overrideValue.a; }
      if (oo.return) { return oo.overrideValue.return; }
    }
    return +a;
  }
  '-x'(cce: CCE, a): any {
    const oo =  handleOperandsOverride(cce, 'on -this', a, a);
    if (oo) {
      if (oo.a) { a = oo.overrideValue.a; }
      if (oo.return) { return oo.overrideValue.return; }
    }
    return -a;
  }
  '!'(cce: CCE, a): any {
    const oo =  handleOperandsOverride(cce, 'on !this', a, a);
    if (oo) {
      if (oo.a) { a = oo.overrideValue.a; }
      if (oo.return) { return oo.overrideValue.return; }
    }
    return !a;
  }
  '~'(cce: CCE, a): any {
    const oo =  handleOperandsOverride(cce, 'on ~this', a, a);
    if (oo) {
      if (oo.a) { a = oo.overrideValue.a; }
      if (oo.return) { return oo.overrideValue.return; }
    }
    return ~a;
  }

  // unary prefix word
  'void'(cce: CCE, a): any {
    const oo =  handleOperandsOverride(cce, 'on void this', a, a);
    if (oo) {
      if (oo.a) { a = oo.overrideValue.a; }
      if (oo.return) { return oo.overrideValue.return; }
    }
    return void a;
  }
  'typeof'(cce: CCE, a): any {
    const oo =  handleOperandsOverride(cce, 'on typeof this', a, a);
    if (oo) {
      if (oo.a) { a = oo.overrideValue.a; }
      if (oo.return) { return oo.overrideValue.return; }
    }
    return typeof a;
  }

  // binary arithmatic
  '+'(cce: CCE, a, b): any {
    let oo =  handleOperandsOverride(cce, 'on this + b', a, a, b);
    if (oo) {
      if (oo.a) { a = oo.overrideValue.a; }
      if (oo.b) { a = oo.overrideValue.b; }
      if (oo.return) { return oo.overrideValue.return; }
    }
    oo =  handleOperandsOverride(cce, 'on a + this', b, a, b);
    if (oo) {
      if (oo.a) { a = oo.overrideValue.a; }
      if (oo.b) { a = oo.overrideValue.b; }
      if (oo.return) { return oo.overrideValue.return; }
    }
    return a + b;
  }
  '-'(cce: CCE, a, b): any {
    let oo =  handleOperandsOverride(cce, 'on this - b', a, a, b);
    if (oo) {
      if (oo.a) { a = oo.overrideValue.a; }
      if (oo.b) { a = oo.overrideValue.b; }
      if (oo.return) { return oo.overrideValue.return; }
    }
    oo =  handleOperandsOverride(cce, 'on a - this', b, a, b);
    if (oo) {
      if (oo.a) { a = oo.overrideValue.a; }
      if (oo.b) { a = oo.overrideValue.b; }
      if (oo.return) { return oo.overrideValue.return; }
    }
    return a - b;
  }
  '*'(cce: CCE, a, b): any {
    let oo =  handleOperandsOverride(cce, 'on this * b', a, a, b);
    if (oo) {
      if (oo.a) { a = oo.overrideValue.a; }
      if (oo.b) { a = oo.overrideValue.b; }
      if (oo.return) { return oo.overrideValue.return; }
    }
    oo =  handleOperandsOverride(cce, 'on a * this', b, a, b);
    if (oo) {
      if (oo.a) { a = oo.overrideValue.a; }
      if (oo.b) { a = oo.overrideValue.b; }
      if (oo.return) { return oo.overrideValue.return; }
    }
    return a * b;
  }
  '**'(cce: CCE, a, b): any {
    let oo =  handleOperandsOverride(cce, 'on this ** b', a, a, b);
    if (oo) {
      if (oo.a) { a = oo.overrideValue.a; }
      if (oo.b) { a = oo.overrideValue.b; }
      if (oo.return) { return oo.overrideValue.return; }
    }
    oo =  handleOperandsOverride(cce, 'on a ** this', b, a, b);
    if (oo) {
      if (oo.a) { a = oo.overrideValue.a; }
      if (oo.b) { a = oo.overrideValue.b; }
      if (oo.return) { return oo.overrideValue.return; }
    }
    return a ** b;
  }
  '/'(cce: CCE, a, b): any {
    let oo =  handleOperandsOverride(cce, 'on this / b', a, a, b);
    if (oo) {
      if (oo.a) { a = oo.overrideValue.a; }
      if (oo.b) { a = oo.overrideValue.b; }
      if (oo.return) { return oo.overrideValue.return; }
    }
    oo =  handleOperandsOverride(cce, 'on a / this', b, a, b);
    if (oo) {
      if (oo.a) { a = oo.overrideValue.a; }
      if (oo.b) { a = oo.overrideValue.b; }
      if (oo.return) { return oo.overrideValue.return; }
    }
    return a / b;
  }
  '%'(cce: CCE, a, b): any {
    let oo =  handleOperandsOverride(cce, 'on this % b', a, a, b);
    if (oo) {
      if (oo.a) { a = oo.overrideValue.a; }
      if (oo.b) { a = oo.overrideValue.b; }
      if (oo.return) { return oo.overrideValue.return; }
    }
    oo =  handleOperandsOverride(cce, 'on a % this', b, a, b);
    if (oo) {
      if (oo.a) { a = oo.overrideValue.a; }
      if (oo.b) { a = oo.overrideValue.b; }
      if (oo.return) { return oo.overrideValue.return; }
    }
    return a % b;
  }

  // double equals defaults to serialized comparison
  '=='(cce: CCE, a, b): any {
    let oo =  handleOperandsOverride(cce, 'on this == b', a, a, b);
    if (oo) {
      if (oo.a) { a = oo.overrideValue.a; }
      if (oo.b) { a = oo.overrideValue.b; }
      if (oo.return) { return oo.overrideValue.return; }
    }
    oo =  handleOperandsOverride(cce, 'on a == this', b, a, b);
    if (oo) {
      if (oo.a) { a = oo.overrideValue.a; }
      if (oo.b) { a = oo.overrideValue.b; }
      if (oo.return) { return oo.overrideValue.return; }
    }
    if (Buffer.isBuffer(a) && Buffer.isBuffer(b)) {
      cce.scopeContext?.setLastOpExpression(true, () => [['operand', bufferStringify(a)], ['op', '!='], ['operand', bufferStringify(b)]]);
      return a.indexOf(b) === 0 && a.length === b.length;
    } else if (a?.equivalentTo) {
      return a.equivalentTo(b);
    } else if (b?.equivalentTo) {
      return b.equivalentTo(a);
    } else {
      a = JSON.stringify(a); b = JSON.stringify(b);
      cce.scopeContext?.setLastOpExpression(true, () => [['operand', a], ['op', '!='], ['operand', b]]);
      return a === b;
    }
  }
  
  // binary comparison
  '==='(cce: CCE, a, b): any {
    let oo =  handleOperandsOverride(cce, 'on this === b', a, a, b);
    if (oo) {
      if (oo.a) { a = oo.overrideValue.a; }
      if (oo.b) { a = oo.overrideValue.b; }
      if (oo.return) { return oo.overrideValue.return; }
    }
    oo =  handleOperandsOverride(cce, 'on a === this', b, a, b);
    if (oo) {
      if (oo.a) { a = oo.overrideValue.a; }
      if (oo.b) { a = oo.overrideValue.b; }
      if (oo.return) { return oo.overrideValue.return; }
    }
    if (Buffer.isBuffer(a) && Buffer.isBuffer(b)) {
      cce.scopeContext?.setLastOpExpression(true, () => [['operand', bufferStringify(a)], ['op', '!=='], ['operand', bufferStringify(b)]]);
      return a === b || (a.indexOf(b) === 0 && a.length === b.length);
    } else {
      cce.scopeContext?.setLastOpExpression(true, () => [['operand', a], ['op', '!=='], ['operand', b]]);
      return a === b;
    }
  }
  '!='(cce: CCE, a,b): any {
    let oo =  handleOperandsOverride(cce, 'on this != b', a, a, b);
    if (oo) {
      if (oo.a) { a = oo.overrideValue.a; }
      if (oo.b) { a = oo.overrideValue.b; }
      if (oo.return) { return oo.overrideValue.return; }
    }
    oo =  handleOperandsOverride(cce, 'on a != this', b, a, b);
    if (oo) {
      if (oo.a) { a = oo.overrideValue.a; }
      if (oo.b) { a = oo.overrideValue.b; }
      if (oo.return) { return oo.overrideValue.return; }
    }
    a = JSON.stringify(a); b = JSON.stringify(b);
    cce.scopeContext?.setLastOpExpression(true, () => [['operand', a], ['op', '=='], ['operand', b]]);
    return a !== b;
  }
  '!=='(cce: CCE, a,b): any {
    let oo =  handleOperandsOverride(cce, 'on this !== b', a, a, b);
    if (oo) {
      if (oo.a) { a = oo.overrideValue.a; }
      if (oo.b) { a = oo.overrideValue.b; }
      if (oo.return) { return oo.overrideValue.return; }
    }
    oo =  handleOperandsOverride(cce, 'on a !== this', b, a, b);
    if (oo) {
      if (oo.a) { a = oo.overrideValue.a; }
      if (oo.b) { a = oo.overrideValue.b; }
      if (oo.return) { return oo.overrideValue.return; }
    }
    cce.scopeContext?.setLastOpExpression(true, () => [['operand', a], ['op', '==='], ['operand', b]]);
    return a !== b;
  }
  '>'(cce: CCE, a,b): any {
    let oo =  handleOperandsOverride(cce, 'on this > b', a, a, b);
    if (oo) {
      if (oo.a) { a = oo.overrideValue.a; }
      if (oo.b) { a = oo.overrideValue.b; }
      if (oo.return) { return oo.overrideValue.return; }
    }
    oo =  handleOperandsOverride(cce, 'on a > this', b, a, b);
    if (oo) {
      if (oo.a) { a = oo.overrideValue.a; }
      if (oo.b) { a = oo.overrideValue.b; }
      if (oo.return) { return oo.overrideValue.return; }
    }
    cce.scopeContext?.setLastOpExpression(true, () => [['operand', a], ['op', '<='], ['operand', b]]);
    return a > b;
  }
  '<'(cce: CCE, a,b): any {
    let oo =  handleOperandsOverride(cce, 'on this < b', a, a, b);
    if (oo) {
      if (oo.a) { a = oo.overrideValue.a; }
      if (oo.b) { a = oo.overrideValue.b; }
      if (oo.return) { return oo.overrideValue.return; }
    }
    oo = handleOperandsOverride(cce, 'on a < this', b, a, b);
    if (oo) {
      if (oo.a) { a = oo.overrideValue.a; }
      if (oo.b) { a = oo.overrideValue.b; }
      if (oo.return) { return oo.overrideValue.return; }
    }
    cce.scopeContext?.setLastOpExpression(true, () => [['operand', a], ['op', '>='], ['operand', b]]);
    return a < b;
  }
  '>='(cce: CCE, a,b): any {
    let oo = handleOperandsOverride(cce, 'on this >= b', a, a, b);
    if (oo) {
      if (oo.a) { a = oo.overrideValue.a; }
      if (oo.b) { a = oo.overrideValue.b; }
      if (oo.return) { return oo.overrideValue.return; }
    }
    oo = handleOperandsOverride(cce, 'on a >= this', b, a, b);
    if (oo) {
      if (oo.a) { a = oo.overrideValue.a; }
      if (oo.b) { a = oo.overrideValue.b; }
      if (oo.return) { return oo.overrideValue.return; }
    }
    cce.scopeContext?.setLastOpExpression(true, () => [['operand', a], ['op', '<'], ['operand', b]]);
    return a >= b;
  }
  '<='(cce: CCE, a,b): any {
    let oo = handleOperandsOverride(cce, 'on this <= b', a, a, b);
    if (oo) {
      if (oo.a) { a = oo.overrideValue.a; }
      if (oo.b) { a = oo.overrideValue.b; }
      if (oo.return) { return oo.overrideValue.return; }
    }
    oo = handleOperandsOverride(cce, 'on a <= this', b, a, b);
    if (oo) {
      if (oo.a) { a = oo.overrideValue.a; }
      if (oo.b) { a = oo.overrideValue.b; }
      if (oo.return) { return oo.overrideValue.return; }
    }
    cce.scopeContext?.setLastOpExpression(true, () => [['operand', a], ['op', '>'], ['operand', b]]);
    return a <= b;
  }

  // ternary expression
  '?'(cce: CCE, a, b, c): any {
    let oo = handleOperandsOverride(cce, 'on this ? b : c', a, a, b, c);
    if (oo) {
      if (oo.a) { a = oo.overrideValue.a; }
      if (oo.b) { a = oo.overrideValue.b; }
      if (oo.c) { a = oo.overrideValue.c; }
      if (oo.return) { return oo.overrideValue.return; }
    }
    oo = handleOperandsOverride(cce, 'on a ? this : c', b, a, b, c);
    if (oo) {
      if (oo.a) { a = oo.overrideValue.a; }
      if (oo.b) { a = oo.overrideValue.b; }
      if (oo.c) { a = oo.overrideValue.c; }
      if (oo.return) { return oo.overrideValue.return; }
    }
    oo = handleOperandsOverride(cce, 'on a ? b : this', c, a, b, c);
    if (oo) {
      if (oo.a) { a = oo.overrideValue.a; }
      if (oo.b) { a = oo.overrideValue.b; }
      if (oo.c) { a = oo.overrideValue.c; }
      if (oo.return) { return oo.overrideValue.return; }
    }
    return a ? b : c;
  }

  // binary logical
  '&&'(cce: CCE, a,b): any {
    let oo =  handleOperandsOverride(cce, 'on this && b', a, a, b);
    if (oo) {
      if (oo.a) { a = oo.overrideValue.a; }
      if (oo.b) { a = oo.overrideValue.b; }
      if (oo.return) { return oo.overrideValue.return; }
    }
    oo =  handleOperandsOverride(cce, 'on a && this', b, a, b);
    if (oo) {
      if (oo.a) { a = oo.overrideValue.a; }
      if (oo.b) { a = oo.overrideValue.b; }
      if (oo.return) { return oo.overrideValue.return; }
    }
    cce.scopeContext?.setLastOpExpression(false, () => [['operand', a], ['op', '&&'], ['operand', b]]);
    return a && b;
  }
  '||'(cce: CCE, a,b): any {
    let oo =  handleOperandsOverride(cce, 'on this || b', a, a, b);
    if (oo) {
      if (oo.a) { a = oo.overrideValue.a; }
      if (oo.b) { a = oo.overrideValue.b; }
      if (oo.return) { return oo.overrideValue.return; }
    }
    oo =  handleOperandsOverride(cce, 'on a || this', b, a, b);
    if (oo) {
      if (oo.a) { a = oo.overrideValue.a; }
      if (oo.b) { a = oo.overrideValue.b; }
      if (oo.return) { return oo.overrideValue.return; }
    }
    cce.scopeContext?.setLastOpExpression(false, () => [['operand', a], ['op', '||'], ['operand', b]]);
    return a || b;
  }
  '??'(cce: CCE, a,b): any {
    let oo =  handleOperandsOverride(cce, 'on this ?? b', a, a, b);
    if (oo) {
      if (oo.a) { a = oo.overrideValue.a; }
      if (oo.b) { a = oo.overrideValue.b; }
      if (oo.return) { return oo.overrideValue.return; }
    }
    oo =  handleOperandsOverride(cce, 'on a ?? this', b, a, b);
    if (oo) {
      if (oo.a) { a = oo.overrideValue.a; }
      if (oo.b) { a = oo.overrideValue.b; }
      if (oo.return) { return oo.overrideValue.return; }
    }
    cce.scopeContext?.setLastOpExpression(false, () => [['operand', a], ['op', '??'], ['operand', b]]);
    return a ?? b;
  }

  // binary bitwise
  '&'(cce: CCE, a, b): any {
    let oo =  handleOperandsOverride(cce, 'on this & b', a, a, b);
    if (oo) {
      if (oo.a) { a = oo.overrideValue.a; }
      if (oo.b) { a = oo.overrideValue.b; }
      if (oo.return) { return oo.overrideValue.return; }
    }
    oo =  handleOperandsOverride(cce, 'on a & this', b, a, b);
    if (oo) {
      if (oo.a) { a = oo.overrideValue.a; }
      if (oo.b) { a = oo.overrideValue.b; }
      if (oo.return) { return oo.overrideValue.return; }
    }
    return a & b;
  }
  '|'(cce: CCE, a, b): any {
    let oo =  handleOperandsOverride(cce, 'on this | b', a, a, b);
    if (oo) {
      if (oo.a) { a = oo.overrideValue.a; }
      if (oo.b) { a = oo.overrideValue.b; }
      if (oo.return) { return oo.overrideValue.return; }
    }
    oo =  handleOperandsOverride(cce, 'on a | this', b, a, b);
    if (oo) {
      if (oo.a) { a = oo.overrideValue.a; }
      if (oo.b) { a = oo.overrideValue.b; }
      if (oo.return) { return oo.overrideValue.return; }
    }
    return a | b;
  }
  '^'(cce: CCE, a,b): any {
    let oo =  handleOperandsOverride(cce, 'on this ^ b', a, a, b);
    if (oo) {
      if (oo.a) { a = oo.overrideValue.a; }
      if (oo.b) { a = oo.overrideValue.b; }
      if (oo.return) { return oo.overrideValue.return; }
    }
    oo =  handleOperandsOverride(cce, 'on a ^ this', b, a, b);
    if (oo) {
      if (oo.a) { a = oo.overrideValue.a; }
      if (oo.b) { a = oo.overrideValue.b; }
      if (oo.return) { return oo.overrideValue.return; }
    }
    return a ^ b;
  }
  '<<'(cce: CCE, a,b): any {
    let oo =  handleOperandsOverride(cce, 'on this << b', a, a, b);
    if (oo) {
      if (oo.a) { a = oo.overrideValue.a; }
      if (oo.b) { a = oo.overrideValue.b; }
      if (oo.return) { return oo.overrideValue.return; }
    }
    oo =  handleOperandsOverride(cce, 'on a << this', b, a, b);
    if (oo) {
      if (oo.a) { a = oo.overrideValue.a; }
      if (oo.b) { a = oo.overrideValue.b; }
      if (oo.return) { return oo.overrideValue.return; }
    }
    return a << b;
  }
  '>>'(cce: CCE, a,b): any {
    let oo =  handleOperandsOverride(cce, 'on this >> b', a, a, b);
    if (oo) {
      if (oo.a) { a = oo.overrideValue.a; }
      if (oo.b) { a = oo.overrideValue.b; }
      if (oo.return) { return oo.overrideValue.return; }
    }
    oo =  handleOperandsOverride(cce, 'on a >> this', b, a, b);
    if (oo) {
      if (oo.a) { a = oo.overrideValue.a; }
      if (oo.b) { a = oo.overrideValue.b; }
      if (oo.return) { return oo.overrideValue.return; }
    }
    return a >> b;
  }
  '>>>'(cce: CCE, a,b): any {
    let oo =  handleOperandsOverride(cce, 'on this >>> b', a, a, b);
    if (oo) {
      if (oo.a) { a = oo.overrideValue.a; }
      if (oo.b) { a = oo.overrideValue.b; }
      if (oo.return) { return oo.overrideValue.return; }
    }
    oo =  handleOperandsOverride(cce, 'on a >>> this', b, a, b);
    if (oo) {
      if (oo.a) { a = oo.overrideValue.a; }
      if (oo.b) { a = oo.overrideValue.b; }
      if (oo.return) { return oo.overrideValue.return; }
    }
    return a >>> b;
  }

  // binary word
  'in'(cce: CCE, a, b): any {
    let oo =  handleOperandsOverride(cce, 'on this in b', a, a, b);
    if (oo) {
      if (oo.a) { a = oo.overrideValue.a; }
      if (oo.b) { a = oo.overrideValue.b; }
      if (oo.return) { return oo.overrideValue.return; }
    }
    oo =  handleOperandsOverride(cce, 'on a in this', b, a, b);
    if (oo) {
      if (oo.a) { a = oo.overrideValue.a; }
      if (oo.b) { a = oo.overrideValue.b; }
      if (oo.return) { return oo.overrideValue.return; }
    }
    cce.scopeContext?.setLastOpExpression(true, () => [['operand', a], ['op', 'not in'], ['operand', b]]);
    if (typeof b === 'string') {
      return b.indexOf(a) >= 0;
    } else if (Array.isArray(b)) {
      return b.indexOf(a) >= 0;
    }
    return a in b;
  }
  'delete'(cce: CCE, a, b): any {
    let oo =  handleOperandsOverride(cce, 'on delete this[b]', a, a, b);
    if (oo) {
      if (oo.a) { a = oo.overrideValue.a; }
      if (oo.b) { a = oo.overrideValue.b; }
      if (oo.return) { return oo.overrideValue.return; }
    }
    oo =  handleOperandsOverride(cce, 'on delete a[this]', b, a, b);
    if (oo) {
      if (oo.a) { a = oo.overrideValue.a; }
      if (oo.b) { a = oo.overrideValue.b; }
      if (oo.return) { return oo.overrideValue.return; }
    }
    if (b === '$') {
      for (const p of Object.keys(a)) {
        delete a[p];
      }
    } else {
      delete a[b];
    }
  }
  'instanceof'(cce: CCE, a, b): any {
    let oo =  handleOperandsOverride(cce, 'on this instanceof b', a, a, b);
    if (oo) {
      if (oo.a) { a = oo.overrideValue.a; }
      if (oo.b) { a = oo.overrideValue.b; }
      if (oo.return) { return oo.overrideValue.return; }
    }
    oo =  handleOperandsOverride(cce, 'on a instanceof this', b, a, b);
    if (oo) {
      if (oo.a) { a = oo.overrideValue.a; }
      if (oo.b) { a = oo.overrideValue.b; }
      if (oo.return) { return oo.overrideValue.return; }
    }
    cce.scopeContext?.setLastOpExpression(true, () => [['operand', a], ['op', 'not instanceof'], ['operand', b]]);
    return a instanceof b;
  }
}

export interface __FunctionContext {
  flowId: string;
  filename: string;
  funcName: string;
  funcPath: string;
  anyThis: boolean;
  anyFile: boolean;
  scopeContext: __ScopeContext;
  functionContext: __FunctionContext;
  doSkip?: boolean;
  doSkipReturn?: any;
}

type InvokeContext = [ string, string, __ScopeContext, __BlockContext ];

export const defaultOperatorRubric = new RitzOperatorRubric();

export class __RuntimeCollator {
  collation: {[subjectName: string]: any} = {};
  collateClosure(subjectName: string, closure: () => Promise<any>) {
    this.collation[subjectName] = closure;
  }
  collateData(subjectName: string, data: any) {
    this.collation[subjectName] = data;
  }
}

export interface InCollationArguments {
  collator: __RuntimeCollator;
  async: boolean;
  fromTaggedTemplate: boolean;
  scopeContext: __ScopeContext;
  blockContext: __BlockContext;
  invocable: any;
  funcImportedName: string;
  args: any[];
  func: any;
  cce: CallContextEvent;
}

export interface InCollationReturn {
  collationName: string;
  closureOverride?: () => any;
  runPassthru?: boolean;
}

export type InCollationHandler = (ica: InCollationArguments) => InCollationReturn;

interface MetaContextObject {
  async?: boolean;
  fromTaggedTemplate?: boolean;
  ignoreInCollation?: boolean;
  cce?: CCE;
}
type MetaContext = boolean | MetaContextObject;

export class __RuntimeContext<DataType = {[key: string]: any}, ControllerType = any> extends ix.Entity {
  static version = runtimeVersion;
  version: string;
  isRuntimeContext = true;
  uuid = uuidv4();
  type: string;
  data: DataType;
  sharedData: {[key: string]: any} = {};
  
  controller?: ControllerType;
  
  pausedState = false;
  pauseSource: Error;
  resumeResolvers: Function[] = [];

  mostRecentScopeContext: __ScopeContext;
  mostRecentBlockContext: __BlockContext;
  blocks: {[id: string]: __BlockContext} = {};
  currentCallBlock: __BlockContext;
  currentFlowTrackingEventById: {[id: string]: FlowTrackingEvent} = {};
  labeledContextsToBeValidated: {[name: string]: number} = {};
  labeledContextsProvided: {[name: string]: LabeledContextProvider} = {};
  futureCollectors: {[id: string]: any} = {};
  functionContextCallbacks: { [filename: string]: { [funcPath: string]: ((fnCtx: __FunctionContext) => any)[]; } } = { any: {} };
  immediateInvokeContext: InvokeContext;
  immediateSynchronousBlockContext: __BlockContext;
  outputManagement?: (type: 'log' | 'error' | 'warn' | 'info' | 'debug' | 'group' | 'groupEnd', ...arg) => any;
  
  currentCollator: __RuntimeCollator = null;
  compilerVersion: string = null;
  entrypoint: string;
  
  __$r: any;
  __devnull = null;
  
  ignoreLocalFlowControllers = false;
  uuidConfig = {
    blocks: false,
    contexts: true,
    flowEvents: false,
  }
  closureFinishCheckingInterval = 500;
  flowExecCutoffBreather = 10000;
  flowExecCutoffBreatherTimeMs = 25;
  flowExecCutoffBreatherThrown = 100;
  flowExecCutoffBreatherThrownTimeMs = 25;
  stackTraceLimit = 50;
  gcData = {
    gcLast: 0,
    gcLastFlow: 0,
    gcInterval: 30,
    gcPerFlowCount: 10000000,
    gcNativeNodeInterval: 7,
    gcNativeNodeIntervalLast: 0,
    gcNativeThreshold: 100
  };
  
  metrics = {
    runtimeStartTime: Date.now(),
    calls: {
      count: {

      } as {[funcName: string]: number},
    },
    blocks: {
      totalOpened: 0,
      totalClosed: 0,
    },
    contexts: {
      totalOpened: 0,
      totalClosed: 0,
    },
    flow: {
      count: 0,
      thrown: 0,
      thrownIntermediate: 0,
      breather: 0,
      breatherLast: 0,
      breatherThrown: 0,
      breatherThrownLast: 0,
    }
  };

  postfixMethodsConfig = {
    tryConfigDefault: new WrappedFlowTryConfig({ tryCount: 5, backoffConfig: new WrappedFlowBackOffConfig({ type: 'expo' }) }),
    timeoutConfigDefault: new WrappedFlowTimeoutConfig({ value: 1, unit: 'm' }),
  };

  private callEvent: CallContextEvent;
  private callEventHandler: (cce: CallContextEvent) => any;
  private flowHandler: (fte: FlowTrackingEvent) => any;
  private handlerRegistry: HandlerRegistryByName<typeof this.callEventHandler>;
  private flowHandlerRegistry: HandlerRegistryByName<typeof this.flowHandler>;

  private onBeforeCall: typeof this.handlerRegistry = {};
  private onFunctionThrow: typeof this.handlerRegistry = {};
  private onAfterCall: typeof this.handlerRegistry = {};
  private onBeforeAnyCall: typeof this.handlerRegistry = { __any_handler: { list: [] } };
  private onAnyFunctionThrow: typeof this.handlerRegistry = { __any_handler: {list: [] } };
  private onAfterAnyCall: typeof this.handlerRegistry = { __any_handler: { list: [] } };
  private onFlowTrack: typeof this.flowHandlerRegistry = { __any_handler: { list: [] } };

  constructor(type: string) {
    super(`Runtime-${type}`);
    this.type = type;
  }

  get __last_computed_v() {
    let v;
    return {
      $get: () => v,
      $set: (async: boolean, blockCtx: __BlockContext, varname: string, value: any, expr?: string) => {
        // if ((valueFinal as Result)?.isResultKind?.()) {
        //   if ((valueFinal as Result).bad) {
        //     ((valueFinal as Result).error as any).__bad_result = true;
        //     v = (valueFinal as Result).error;
        //   } else {
        //     v = (valueFinal as Result).data;
        //   }
        //   return resolve(v);
        // }
        if (!async) {
          if (expr) { this.__set_expr(blockCtx, expr); }
          if (value !== doNotSet) {
            v = value;
            blockCtx?.clearDecorations();
          }
          return v;
        }
        return promise(async (resolve, reject) => {
          try { 
            if (expr) { this.__set_expr(blockCtx, expr); }
            const valueFinal = await punchGrab(value);
            if (valueFinal !== doNotSet) {
              v = valueFinal;
              blockCtx?.clearDecorations();
            }
          } catch (e) {
            return reject(e);
          }
          return resolve(v);
        });
      },
    };
    // const obj = { $r: null };
    // if (enableFinalization) {
    //   ++gcRegCount.lcvr;
    //   gcReg.register(obj, 'lcvr', obj);
    // }
    // return obj;
  }

  get elapsed(): number { return Date.now() - this.metrics.runtimeStartTime; }
  get paused(): boolean { return this.pausedState; }
  get self() { return this; }
  get beforeCall$() { return this.ixRx<typeof this.callEvent>('beforeCall').obs(); }
  get beforeCallAfterHandlers$() { return this.ixRx<typeof this.callEvent>('beforeCallAfterHandlers').obs(); }
  get functionCallThrow$() { return this.ixRx<typeof this.callEvent>('functionCallThrow').obs(); }
  get functionCallThrowAfterHandlers$() { return this.ixRx<typeof this.callEvent>('functionCallThrowAfterHandlers').obs(); }
  get afterCall$() { return this.ixRx<typeof this.callEvent>('afterCall').obs(); }
  get afterCallAfterHandlers$() { return this.ixRx<typeof this.callEvent>('afterCallAfterHandlers').obs(); }
  get flowTrack$() { return this.ixRx<FlowTrackingEvent>('flowTrack').obs(); }
  get customEvent$() { return this.ixRx<any>('customEvent').obs(); }

  error(...args) { this.outputManagement ? this.outputManagement('error', ...args) : console.error(...args); return this; }
  warn(...args) { this.outputManagement ? this.outputManagement('warn', ...args) : console.warn(...args); return this;  }
  info(...args) { this.outputManagement ? this.outputManagement('log', ...args) : console.info(...args); return this;  }
  log(...args) { this.outputManagement ? this.outputManagement('log', ...args) : console.log(...args); return this;  }
  debug(...args) { this.outputManagement ? this.outputManagement('debug', ...args) : console.debug(...args); return this;  }
  group(...args) { this.outputManagement ? this.outputManagement('group', ...args) : console.group(...args); return this;  }
  groupEnd(groupId?: string) { this.outputManagement ? this.outputManagement('groupEnd') : console.groupEnd(); return this;  }

  getClass() { return __RuntimeContext; }
  addBeforeCall<FunctionType extends (...args) => any>(handlerContext: string, func: FunctionType, handler: (e: CallContextEvent<FunctionType>) => any): void;
  addBeforeCall<FunctionType extends (...args) => any>(handlerContext: string, functionCallName: string, handler: (e: CallContextEvent<FunctionType>) => any): void;
  addBeforeCall<FunctionType extends (...args) => any>(handlerContext: string, functionOrCallExpression: any, handler: (e: CallContextEvent<FunctionType>) => any) {
    const functionCallName = typeof functionOrCallExpression === 'string' ? functionOrCallExpression : functionOrCallExpression.name;
    this.addCallEvent('beforeCall', this.onBeforeCall, handlerContext, functionCallName, handler);
  }

  addOnFunctionThrow<FunctionType extends (...args) => any>(handlerContext: string, func: FunctionType, handler: (e: CallContextEvent<FunctionType>) => any): void;
  addOnFunctionThrow<FunctionType extends (...args) => any>(handlerContext: string, functionCallName: string, handler: (e: CallContextEvent<FunctionType>) => any): void;
  addOnFunctionThrow<FunctionType extends (...args) => any>(handlerContext: string, functionOrCallExpression: any, handler: (e: CallContextEvent<FunctionType>) => any) {
    const functionCallName = typeof functionOrCallExpression === 'string' ? functionOrCallExpression : functionOrCallExpression.name;
    this.addCallEvent('functionThrow', this.onFunctionThrow, handlerContext, functionCallName, handler);
  }

  addAfterCall<FunctionType extends (...args) => any>(handlerContext: string, func: FunctionType, handler: (e: CallContextEvent<FunctionType>) => any): void;
  addAfterCall<FunctionType extends (...args) => any>(handlerContext: string, functionCallName: string, handler: (e: CallContextEvent<FunctionType>) => any): void;
  addAfterCall<FunctionType extends (...args) => any>(handlerContext: string, functionOrCallExpression: any, handler: (e: CallContextEvent<FunctionType>) => any) {
    const functionCallName = typeof functionOrCallExpression === 'string' ? functionOrCallExpression : functionOrCallExpression.name;
    this.addCallEvent('afterCall', this.onAfterCall, handlerContext, functionCallName, handler);
  }

  addBeforeAnyCall(handlerContext: string, handler: typeof this.callEventHandler) {
    this.addCallEvent('beforeCall', this.onBeforeAnyCall, handlerContext, '__any_handler', handler);
  }

  addOnAnyFunctionThrow(handlerContext: string, handler: typeof this.callEventHandler) {
    this.addCallEvent('functionThrow', this.onAnyFunctionThrow, handlerContext, '__any_handler', handler);
  }

  addAfterAnyCall(handlerContext: string, handler: typeof this.callEventHandler) {
    this.addCallEvent('afterCall', this.onAfterAnyCall, handlerContext, '__any_handler', handler);
  }

  addFlowTracker(handlerContext: string, handler: typeof this.flowHandler) {
    this.addCallEvent('afterCall', this.onFlowTrack, handlerContext, '__any_handler', handler);
  }

  emitCustomEvent(eventObject: any) { this.customEvent$.next(eventObject); }

  /**
   * Argument processor
   * @param scopeCtx 
   * @param func 
   * @param funcImportedName 
   * @param args 
   * @returns 
   */
  __$(metaCtx: MetaContext, scopeCtx: __ScopeContext, blockCtx: __BlockContext, invocable: any, funcImportedName: string, ...args) {
    const { async, fromTaggedTemplate, ignoreInCollation, cce } = this.parseMetaContext(metaCtx);
    const func = this.getFunction(invocable, funcImportedName, scopeCtx, blockCtx);
    const event = cce ? cce : this.getCallEventObject(async, fromTaggedTemplate, scopeCtx, blockCtx, func, funcImportedName, args);
    if (!ignoreInCollation && blockCtx.collator && (func as any)?.inCollationHandler) {
      const { collationName, closureOverride, runPassthru } = (func as any).inCollationHandler({
        collator: blockCtx.collator,
        async, fromTaggedTemplate,
        scopeContext: scopeCtx,
        blockContext: blockCtx,
        invocable: invocable,
        funcImportedName: funcImportedName,
        args: args, func, cce: event,
      } as InCollationArguments);
      let prom: Promise2;
      if (collationName) {
        let deferredResolve;
        let deferredReject;
        prom = promise(async (resolve, reject) => { deferredResolve = resolve; deferredReject = reject; });
        blockCtx.collator.collateClosure(collationName, closureOverride ? closureOverride : async () => {
          const metaCtx2 = { async, fromTaggedTemplate, ignoreInCollation: true, cce: event };
          try {
            const deferredRes = await this.__$(metaCtx2, scopeCtx, blockCtx, invocable, funcImportedName, ...args);
            if (deferredResolve) { deferredResolve(deferredRes); }
            return deferredRes;
          } catch (deferredE) {
            if (deferredReject) { deferredReject(deferredReject); }
            throw deferredE;
          }
        });
      }
      if (!runPassthru) {
        return {
          isDeferredCall: true,
          deferredCallPromise: prom
        };
      }
    }
    scopeCtx.currentCallContext = event;
    blockCtx.currentCallContext = event;
    if (!async) {
      try {
        this.beforeCall$.next(event);
        this.handleCallHandlerTypeSync('beforeCall', this.onBeforeAnyCall, event);
        this.handleCallHandlerTypeSync('beforeCall', this.onBeforeCall, event);
        this.beforeCallAfterHandlers$.next(event);
        let result;
        try {
          result = func(...event.args.final);
          event.result.original = result;
          event.result.final = result;
        } catch (e) {
          event.hasThrown = true;
          event.error.original = e;
          event.error.final = e;
          this.functionCallThrow$.next(event);
          this.handleCallHandlerTypeSync('functionThrow', this.onAnyFunctionThrow, event);
          this.handleCallHandlerTypeSync('functionThrow', this.onFunctionThrow, event);
          this.functionCallThrowAfterHandlers$.next(event);
        }
        this.afterCall$.next(event);
        event.release();
        this.handleCallHandlerTypeSync('afterCall', this.onAfterAnyCall, event);
        this.handleCallHandlerTypeSync('afterCall', this.onAfterCall, event);
        this.afterCallAfterHandlers$.next(event);
        blockCtx.clearDecorations();
        if (event.hasThrown) {
          if (event.returnNullOnThrow) {
            return null;
          }
          throw event.error.final;
        }
        return event.result.final;
      } catch (e2) {
        getRuntime().error(e2);
        throw e2;
      }
    }
    return promise(async (resolve, reject) => {
      try {
        const oriArgs = event.args.original;
        const finArgs = event.args.final;
        for (let i = 0; i < oriArgs.length; ++i) { oriArgs[i] = await punchGrab(oriArgs[i]); }
        for (let i = 0; i < finArgs.length; ++i) { finArgs[i] = await punchGrab(finArgs[i]); }
        this.beforeCall$.next(event);
        await this.handleCallHandlerType('beforeCall', this.onBeforeAnyCall, event);
        await this.handleCallHandlerType('beforeCall', this.onBeforeCall, event);
        this.beforeCallAfterHandlers$.next(event);
        try {
          const result = await punchGrab(func(...event.args.final));
          event.result.original = result;
          event.result.final = result;
        } catch (e) {
          event.hasThrown = true;
          event.error.original = e;
          event.error.final = e;
          this.functionCallThrow$.next(event);
          await this.handleCallHandlerType('functionThrow', this.onAnyFunctionThrow, event);
          await this.handleCallHandlerType('functionThrow', this.onFunctionThrow, event);
          this.functionCallThrowAfterHandlers$.next(event);
        }
        this.afterCall$.next(event);
        await this.handleCallHandlerType('afterCall', this.onAfterAnyCall, event);
        await this.handleCallHandlerType('afterCall', this.onAfterCall, event);
        this.afterCallAfterHandlers$.next(event);
        blockCtx.clearDecorations();
        event.release();
        if (event.hasThrown) {
          if (event.returnNullOnThrow) {
            return resolve(null);
          }
          return reject(event.error.final);
        }
        return resolve(event.result.final);
      } catch (e2) {
        getRuntime().error(e2);
        return reject(e2);
      }
    });
  }

  /**
   * Generic operator, overloadable
   */
  __op(scopeCtx: __ScopeContext, blockCtx: __BlockContext, opName: string, ...args): any {
    const opRubric = scopeCtx?.currentOperatorRubric ? scopeCtx.currentOperatorRubric : defaultOperatorRubric;
    const func = opRubric[opName];
    scopeCtx.lastOp = { op: opName, operands: args };
    return this.__$(false, scopeCtx, blockCtx, func, opName, ...args);
  }

  __flow(flowEvent: FlowTrackingEvent): boolean | Promise2<boolean>;
  __flow(async: boolean, flowId: string, sourceLocation: string, scopeCtx: __ScopeContext, blockCtx: __BlockContext, type: FlowEventType, info: string, metadata?: any, skipPauseCheck?: boolean): boolean | Promise2<boolean>;
  __flow(...args): boolean | Promise2<boolean> {
    let flowEvent: FlowTrackingEvent;
    if (typeof args[0] === 'boolean') {
      // let [ flowId, sourceLocation, scopeCtx, blockCtx, type, info, metadata, skipPauseCheck ] =
      //   args as [string, string, __ScopeContext, __BlockContext, FlowEventType, string, any, boolean];
      flowEvent = {
        async: args[0],
        flowId: args[1],
        uuid: this.uuidConfig.flowEvents ? uuidv4() : `${args[0]}_${Date.now()}`,
        sourceLocation: args[2],
        scopeContext: args[3],
        blockContext: args[4],
        runtimeContext: this,
        type: args[5],
        info: args[6],
        metadata: args[7],
        referenceCount: 0,
        skipPauseCheck: args[8],
        time: Date.now(),
      };
    } else {
      flowEvent = args[0];
    }
    const async = flowEvent.async;
    if (!async) {
      const blockCtx = flowEvent.blockContext;
      const flowEventType = flowEvent.type;
      if (flowEventType !== 'BLOCK_START' && flowEventType !== 'BLOCK_END' && flowEventType !== 'THROW') {
        const interruptError = flowEvent.blockContext.flowInterruption;
        if (interruptError) {
          throw interruptError;
        }
      }
      const mf = this.metrics.flow;
      ++mf.count;
      ++mf.breather;
      let now = Date.now();
      if (!blockCtx.ended) {
        blockCtx.lastRunFlowId = flowEvent.flowId;
        blockCtx.lastRunSource = flowEvent.sourceLocation;
      }
      this.flowTrack$.next(flowEvent);
      for (const handlerInfo of this.onFlowTrack.__any_handler.list) {
        try {
          handlerInfo.handler(flowEvent);
        } catch (e) {
          getRuntime().error(e);
        }
      }
      if (flowEventType === 'EXPR') {
        flowEvent.blockContext.lastExpression = flowEvent.scopeContext.lastExpression = flowEvent.info;
        flowEvent.blockContext.lastExpressionLocation = flowEvent.scopeContext.lastExpressionLocation = flowEvent.sourceLocation;
      }
      blockCtx.lastFlowEvent = flowEvent;
      return true;
    }
    return promise<boolean>(async (resolve, reject) => {
      const blockCtx = flowEvent.blockContext;
      const flowEventType = flowEvent.type;
      if (flowEventType !== 'BLOCK_START' && flowEventType !== 'BLOCK_END' && flowEventType !== 'THROW') {
        let interruptError = flowEvent.blockContext.flowInterruption;
        if (interruptError) { return reject(interruptError); }
      }
      const mf = this.metrics.flow;
      ++mf.count;
      ++mf.breather;
      let now = Date.now();
      if (async && mf.breather > this.flowExecCutoffBreather || now - mf.breatherLast > this.flowExecCutoffBreatherTimeMs) {
        await promise(resolve => { setImmediate(resolve); });
        mf.breatherLast = Date.now();
        mf.breather = 0;
      }
      now = Date.now();
      const gc = this.gcData;
      if (async && mf.count - gc.gcLastFlow > gc.gcPerFlowCount || now - gc.gcLast > gc.gcInterval * 1000) {
        gc.gcLastFlow = mf.count;
        gc.gcLast = now;
        this.gc();
      }
      if (async && global.gc && now - gc.gcNativeNodeIntervalLast > gc.gcNativeNodeInterval * 1000) {
        gc.gcNativeNodeIntervalLast = now;
        global.gc();
      }
      if (!blockCtx.ended) {
        blockCtx.lastRunFlowId = flowEvent.flowId;
        blockCtx.lastRunSource = flowEvent.sourceLocation;
        if (async && blockCtx.paused || blockCtx.scopeContext.paused || this.paused) {
          await this.__pause_check(blockCtx);
        }
      }
      if (async) {
        const cadence = flowEvent.scopeContext.getCadence(flowEventType) || blockCtx.getCadence(flowEventType);  
        if (cadence >= 0) {
          await promise(resolve => { setTimeout(resolve, cadence); });
        }
      }
      this.flowTrack$.next(flowEvent);
      for (const handlerInfo of this.onFlowTrack.__any_handler.list) {
        try {
          handlerInfo.handler(flowEvent);
        } catch (e) {
          getRuntime().error(e);
        }
      }
      if (flowEventType === 'EXPR') {
        flowEvent.blockContext.lastExpression = flowEvent.scopeContext.lastExpression = flowEvent.info;
        flowEvent.blockContext.lastExpressionLocation = flowEvent.scopeContext.lastExpressionLocation = flowEvent.sourceLocation;
      }
      blockCtx.lastFlowEvent = flowEvent;
      return resolve(true);
    });
  }

  __flow_deco(id: string, scopeCtx: __ScopeContext, blockCtx: __BlockContext, type: FlowEventType, info: string, metadata?: any) {
    return (...arg) => {

    };
  }

  __pause_check(blockCtx: __BlockContext) {
    const scopeCtx = blockCtx.scopeContext;
    return promise<boolean>(async resolve => {
      let blockPaused: boolean;
      let scopePaused: boolean;
      let runtimePaused: boolean;
      if (!(blockPaused = blockCtx.paused) && !(scopePaused = scopeCtx.paused) && !(runtimePaused = this.paused)) {
        return resolve(true);
      }
      do {
        const proms = [
          ...(blockPaused ? [blockCtx.addResumeResolver()] : []),
          ...(scopePaused ? [scopeCtx.addResumeResolver()] : []),
          ...(runtimePaused ? [this.addResumeResolver()] : []),
        ]
        if (proms.length === 0) {
          return resolve(true);
        }
        await PromUtil.allSettled(proms as any);
      } while ((blockPaused = blockCtx.paused) || (scopePaused = scopeCtx.paused) || (runtimePaused = this.paused));
      return resolve(true);
    });
  }

  __collate(flowId: string, scopeCtx: __ScopeContext, blockCtx: __BlockContext, subjectName: string, closure: (...args) => Promise<any>) {
    return promise(async resolve => {
      const sourceLocation = blockCtx.lastRunSource ? blockCtx.lastRunSource : '0:0';
      this.currentCollator = scopeCtx.immediateBlockContext.collator;
      if (scopeCtx?.immediateBlockContext?.collator) {
        scopeCtx.immediateBlockContext.collator.collateClosure(subjectName, closure);
      }
      if (blockCtx?.collator) {
        blockCtx?.collator.collateClosure(subjectName, closure);
      }
      await this.__flow(true, flowId, sourceLocation, scopeCtx, blockCtx, FlowEventKind.COLLATE, '');
      resolve(doNotSet);
    });
  }

  __ritz_flow_controller_import(filename: string, isLocal = false) {
    if (isLocal && this.ignoreLocalFlowControllers) { return null; }
    filename = this.sanitizeFilenameForImport(filename);
    const postfix = isLocal ? '.ts._flowctl' : '';
    const controllerFileTarget = filename + postfix;
    try { 
      require(controllerFileTarget);
      return true;
    } catch (e) {
      return false;
    }
  }

  __new_future_collector(flowId: string, collectOnce: boolean, scopeCtx: __ScopeContext, blockCtx: __BlockContext, targetName: string, targets?: any[]) {
    const collector = {
      id: flowId,
      targetName,
      collectOnce,
      hits: 0,
      targets,
      consumeByUid: {},
      consumedInOrder: [] as { uid: string, name: string }[],
      finalize: () => {
        const strictFulfill = {};
        let orderError = '';
        for (let i = 0; i < collector.consumedInOrder.length; ++i) {
          const name = collector.consumedInOrder[i].name;
          if (name.startsWith('should.reach.')) {
            const nameEnding = name.split('.').pop();
            const endingNumeric = ordinalMap[nameEnding];
            if (endingNumeric) {
              for (let j = 10; j > endingNumeric; --j) {
                if (strictFulfill[j]) {
                  orderError = `reached '${ordinalArrayNamed[j]}(${ordinalArrayNumber[j]})' before '${nameEnding}(${ordinalArrayNumber[ordinalMap[nameEnding]]})'`;
                  break;
                }
              }
              strictFulfill[ordinalMap[nameEnding]] = true;
              if (orderError) { break; }
            }
          }
        }
        if (orderError) {
          return {
            result: false,
            message: orderError,
          }
        }
        return {
          result: collector.hits === targets?.length,
          message: `expected ${targets?.length} collections, only got ${collector.hits}`,
        }
      }
    };
    if (!scopeCtx.onScopeEnds) { scopeCtx.onScopeEnds = []; }
    scopeCtx.onScopeEnds.push(() => {
      if (this.futureCollectors[collector.id]) {
        delete this.futureCollectors[collector.id];
      }
    });
    scopeCtx.futureCollector = collector;
    this.futureCollectors[collector.id] = collector;
    return collector;
  }

  __future_collect(scopeCtx: __ScopeContext, blockCtx: __BlockContext, collector: any, collectionName: string, collectionUid: string) {
    if (!collector) {
      throw new Error(`future logic collected onto a null future collector`);
    }
    if (collector.consumeByUid[collectionUid]) {
      if (collectionName === 'should.reach.once') {
        throw new Error(`reached more than once when running: ${blockCtx.lastExpression}`);
      }
      return;
    }
    if (!collector.consumeByUid[collectionUid]) { collector.consumeByUid[collectionUid] = 0; }
    collector.consumedInOrder.push({ uid: collectionUid, name: collectionName });
    ++collector.consumeByUid[collectionUid];
    ++collector.hits;
  }

  __ritz_flow_controller_import_files(filenames: string[]): string {
    if (filenames) {
      for (const controllerFile of filenames) {
        const imported = getRuntime().__ritz_flow_controller_import(controllerFile);
        if (!imported) {
          return `Unable to import ritz flow controller file '${controllerFile}'`;
        }
      }
    }
    return '';
  }

  __ritz_entrypoint(filename: string): string {
    const filename2 = this.sanitizeFilenameForImport(filename);
    try { 
      require(filename2);
      return '';
    } catch (e) {
      try {
        import(`${filename}`);
        return '';
      } catch (e2) {
        return `Unable to load ritz flow entrypoint file '${filename}' (${e.stack})`;  
      }
    }
  }

  __marker_command(...args) { return args; }

  __get<T = any>(async: true, a: T): Promise<T>; 
  __get<T = any>(async: false, a: T): T;
  __get<T = any>(async: boolean, a: T): T | Promise<T> {
    if (!async) { return a; }
    return promise<T>(async resolve => resolve(a));
  }

  __bad(flowId: string, scopeCtx: __ScopeContext, blockCtx: __BlockContext, target) {
    if ((target as Result)?.isResultKind?.()) {
      if ((target as Result).bad) {
        blockCtx.returnValue = (target as Result).error;
        return true;
      } else {
        return false;
      }
    }
    return false;
  }

  __new_blk(flowId: string, sourceLocation: string, isReturnPoint: boolean, isLoopSource: boolean,
            scopeContext: __ScopeContext, parentBlock: __BlockContext, rootBlock: __BlockContext,
            lastComputeRegister: any, blockContent: string) {
    return promise(async (resolve, reject) => {
      if (!scopeContext?.blocks) { return reject(new Error(`new block initiated without scope context.`)); }
      const blk = new __BlockContext(scopeContext);
      const blkId = blk.id;
      __BlockContext.allUnfinishedBlocks[blkId] = blk;
      blk.uuid = this.uuidConfig.blocks ? uuidv4() : `${blkId}_${Date.now()}`;
      blk.lastComputeRegister = lastComputeRegister;
      blk.flowId = flowId;
      blk.root = rootBlock;
      blk.isReturnPoint = isReturnPoint;
      blk.isLoopSource = isLoopSource;
      if (parentBlock) { blk.parent = parentBlock; }
      if (blk.parent) { blk.parent.blocks[blkId] = blk; }
      if (blk.root){ blk.root.blocks[blkId] = blk;}
      blk.content = blockContent;
      blk.sourceLocation = sourceLocation;
      scopeContext.mostRecentBlockContext = blk;
      if (!scopeContext.immediateBlockContext) {
        scopeContext.immediateBlockContext = blk;
        if (scopeContext.onImmediateBlockContextAssign) {
          for (const cb of scopeContext.onImmediateBlockContextAssign) {
            try { cb(scopeContext, blk); } catch (e) { getRuntime().error(e); }
            cb(scopeContext, blk);
          }
        }
      }
      scopeContext.blocks[blkId] = blk;
      this.blocks[blkId] = blk;
      ++this.metrics.blocks.totalOpened;
      await this.__flow(true, flowId, sourceLocation, scopeContext, blk, FlowEventKind.BLOCK_START, blk.content, blk);
      if (gcRegConfig.enableFinalization) {
        ++gcRegCount.block;
        gcReg.register(blk, 'block', blk);
      }
      this.mostRecentBlockContext = blk;
      resolve(blk);
    });
  }

  __end_blk(flowId: string, sourceLocation: string, block: __BlockContext, endType: null | '__return' | '__break' | '__throw' | '__continue' = null, returnData?: any) {
    return promise(async (resolve, reject) => {
      if (!block) { return reject(new Error(`BLOCK_END called to a null block.`)); }
      if (block.ended) { return resolve(doNotSet); }
      block.ended = true;
      block.enderFlowId = flowId;
      const blkId = block.id;
      if (block.parent?.blocks[blkId]) { block.parent.blocks[blkId] = null; }
      if (block.root?.blocks[blkId]) { block.root.blocks[blkId] = null; }
      if (block.scopeContext.blocks[blkId]) { block.scopeContext.blocks[blkId] = null; }
      if (this.blocks[blkId]) { delete this.blocks[blkId]; }
      if (__BlockContext.allUnfinishedBlocks[blkId]) { delete __BlockContext.allUnfinishedBlocks[blkId]; }
      ++this.metrics.blocks.totalClosed;
      await this.__flow(true, flowId, sourceLocation, block.scopeContext, block, FlowEventKind.BLOCK_END, '');
      if (block.endResolver) { block.endResolver(); block.endResolver = null; }
      if (endType) {
        switch (endType) {
          case '__return':
            block.returnValue = returnData;
            if (!block.isReturnPoint) { // close down to return point
              await this.__end_blk(flowId, sourceLocation, block.parent, endType, returnData);
            } else {
              await this.__flow(true, flowId, sourceLocation, block.scopeContext, block, FlowEventKind.RETURN, returnData);
            }
            break;
          case '__throw':
            block.thrownError = returnData;
            await this.__flow(true, flowId, sourceLocation, block.scopeContext, block, FlowEventKind.THROW, (returnData as Error).stack);
            // if (!block.isReturnPoint) { // close down to return point
            //   this.__end_blk(flowId, sourceLocation, block.parent, endType, returnData);
            // } else {
            //   const e = returnData as Error;
            //   this.__flow(flowId, sourceLocation, block.scopeContext, block, FlowEventKind.THROW, e.stack);
            //   if (!block.parent && block.scopeContext.scope !== 'file') {
            //     throw e;
            //   }
            // }
            break;
          case '__break':
            if (!block.isLoopSource) { // close down to loop source point
              await this.__end_blk(flowId, sourceLocation, block.parent, endType, returnData);
            } else {
              await this.__flow(true, flowId, sourceLocation, block.scopeContext, block, FlowEventKind.BREAK, returnData);
            }
            break;
          case '__continue':
            if (!block.isLoopSource) { // close down to loop source point
              await this.__end_blk(flowId, sourceLocation, block.parent, endType, returnData);
            } else {
              await this.__flow(true, flowId, sourceLocation, block.scopeContext, block, FlowEventKind.CONTINUE, returnData);
            }
            break;
        }
      }
      if (block.onBlockEnds?.length) {
        for (const cb of block.onBlockEnds) {
          try { await punchGrab(cb(block.thrownError, block.returnValue)); } catch (e) { getRuntime().error(e); }
        }
      }
      block.release();
      resolve(doNotSet);
    });
  }

  __dot(blockCtx: __BlockContext, base: any, paths: any[]) {
    const pathLen = paths.length;
    let node = base;
    let penultimate = null;
    const propertyAccessErrorGetter = (prop: string) => {
      return new Error(`Cannot access property '${prop}' of non-object while running expression: ${blockCtx.lastExpression}`);
    }
    let shouldReturnNull = false;
    let optionalFlag = false;
    for (let i = 0; i < pathLen; ++i) {
      const prop = paths[i];
      if (prop === true) { optionalFlag = true; continue; }
      if (prop === '_' || prop === '$') {
        continue;
      }
      if (node === null || node === undefined) {
        if (optionalFlag || blockCtx.nextNullAccessForgive) {
          shouldReturnNull = true;
          break;
        }
        throw propertyAccessErrorGetter(prop);
      }
      penultimate = node;
      if (propertyRequiringDirectAccess[prop]) {
        node = node[prop];
      } else {
        const glBehavior = globalPropertiesLookUpBehavior[prop] as (r: any, evt: GlobalPropertyLookUpEvent) => any;
        if (glBehavior) {
          node = glBehavior(node, { property: prop, errorGetter: propertyAccessErrorGetter, blockContext: blockCtx });  
        } else {
          node = node.getProperty ? node.getProperty(prop, base, paths, i, blockCtx) : node[prop];
        }
      }
      optionalFlag = false;
    }
    blockCtx.lastPropertyLookUpPaths = paths;
    if (node && penultimate && typeof node === 'function') {
      if (!node.lastThis) { node.lastThis = []; }
      node.lastThis.push(penultimate);
    }
    if (optionalFlag) {
      blockCtx.nextNullAccessForgive = true;
    }
    if (shouldReturnNull) {
      return null;
    }
    return node;
  }

  __call(blockCtx: __BlockContext, fromPropertyAccessExpr: boolean, optional: boolean, async: boolean, func: any, args: any[]) {
    if (!func || (!func.call && !func.apply && !func.apply)) {
      if (optional || blockCtx.nextNullAccessForgive) {
        blockCtx.nextNullAccessForgive = optional ? true : false;
        return null;
      }
      throw new Error(`Function call on a non-function type while running expression: ${blockCtx.lastExpression}`);
    }
    this.immediateSynchronousBlockContext = blockCtx;
    Object.defineProperty(args, '__block_ctx', { value: blockCtx.currentCallContext });
    blockCtx.nextNullAccessForgive = false;
    let thisArg = null;
    if (func.lastThis?.length > 0) {
      thisArg = func.lastThis.pop();
    }
    if (!this.metrics.calls.count[func.name]) { this.metrics.calls.count[func.name] = 0; }
    ++this.metrics.calls.count[func.name];
    if (!async) {
      let res;
      this.currentCallBlock = blockCtx;
      try {
        this.immediateInvokeContext = ['', '', blockCtx.scopeContext, blockCtx];
        if (thisArg) {
          res = (func as Function).apply(thisArg, args);  
        } else {
          res = (func as Function)(...args);
        }
        this.immediateInvokeContext = null;
      } catch (e) {
        this.prepareError(e, blockCtx);
        throw e;
      }
      this.currentCallBlock = null;
      return res;
    }
    return promise(async (resolve, reject) => {
      let res;
      let error: Error;
      this.currentCallBlock = blockCtx;
      try {
        this.immediateInvokeContext = ['', '', blockCtx.scopeContext, blockCtx];
        if (thisArg) {
          res = (func as Function).apply(thisArg, args);  
        } else {
          res = (func as Function)(...args);
        }
        this.immediateInvokeContext = null;
      } catch (e) {
        this.prepareError(e, blockCtx);
        error = e;
      }
      this.currentCallBlock = null;
      if (error) {
        return reject(error);
      } else {
        return resolve(await punchGrab(res));
      }
    });
  }

  __at(scopeCtx: __ScopeContext, blockCtx: __BlockContext, optional: boolean, base: any, lookUpKey: string | number) {
    if (base === null  || base === undefined) {
      if (optional || blockCtx.nextNullAccessForgive) {
        blockCtx.nextNullAccessForgive = optional ? true : false;
        return null;
      }
      throw new Error(`Cannot access property '${lookUpKey}' of non-object while running expression: ${blockCtx.lastExpression}`);  
    }
    blockCtx.nextNullAccessForgive = false;
    return base[lookUpKey];
  }

  __return(flowId: string, sourceLocation: string, block: __BlockContext, returnData?: any) {
    if (returnData === undefined) { returnData = block.returnValue; }
    if (!sourceLocation) { sourceLocation = block.lastExpressionLocation; }
    return promise(async resolve => {
      await this.__end_blk(flowId, sourceLocation, block, '__return', returnData);
      resolve(returnData);
    });
  }

  __break(flowId: string, sourceLocation: string, block: __BlockContext) {
    return this.__end_blk(flowId, sourceLocation, block, '__break');
  }

  __continue(flowId: string, sourceLocation: string, block: __BlockContext) {
    return this.__end_blk(flowId, sourceLocation, block, '__continue');
  }

  __cmt(flowId: string, sourceLocation: string, key: string, reg: {[key: string]: CommentData}, scopeCtx: __ScopeContext, blockCtx: __BlockContext) {
    return promise(async resolve => {
      const cmtObj = reg[key];
      scopeCtx.lastComment = cmtObj;
      blockCtx.lastComment = cmtObj;
      await this.__flow(true, flowId, sourceLocation, scopeCtx, blockCtx, FlowEventKind.COMMENT, cmtObj.r, cmtObj);  
      resolve(doNotSet);
    });
  }

  __throw(flowId: string, scopeCtx: __ScopeContext, blockCtx: __BlockContext, e: Error, doThrow = true) {
    return promise<Error>(async resolve => {
      const mf = this.metrics.flow;
      ++mf.thrownIntermediate;
      ++mf.breatherThrown;
      const now = Date. now();
      if (mf.breatherThrown > this.flowExecCutoffBreatherThrown || now - mf.breatherThrownLast > this.flowExecCutoffBreatherThrownTimeMs) {
        await promise(resolve => { setImmediate(resolve); });
        mf.breatherThrownLast = Date.now();
        mf.breatherThrown = 0;
      }
      this.prepareError(e, blockCtx);
      this.preventUnhandledRejection(e); // prevent unhandledRejection at root level
      blockCtx.propagateThrow(e, blockCtx.id, true);
      this.__end_blk(flowId, blockCtx.sourceLocation, blockCtx, '__throw', e);
      resolve(e);
    });
  }

  __get_ctx(args: any, ctxr: __ScopeContext) {
    for (let i = 0; i < args.length; ++i) {
      const arg = args[i];
      if (arg && arg.isScopeContext) {
        return arg;
      }
    }
    return ctxr;
  }

  __set_expr(blockCtx: __BlockContext, expr: string) {
    const lit = expr.split('.').map(a => a.toLowerCase());
    if (lit[0] === 'should') {
      if (lit[1] === 'not') {
        if (lit[2] === 'reach') {
          const e = new Error(`Reached code section that should not reach`);
          (e as any).__uncatchable = true;
          throw e;
        }
      }
    }
  }

  getFunctionCallCount(fnName: string) {
    let count = this.metrics.calls.count[fnName];
    if (!count) { count = 0; }
    return count;
  }

  clearFunctionCallCount(fnName: string) {
    this.metrics.calls.count[fnName] = 0;
  }

  __num(async: boolean, scopeCtx: __ScopeContext, blockCtx: __BlockContext, num: number);
  __num(async: boolean, scopeCtx: __ScopeContext, blockCtx: __BlockContext, num: bigint);
  __num(async: boolean, scopeCtx: __ScopeContext, blockCtx: __BlockContext, num: any) {
    return num;
  }

  __match_compiler_version(v: string) {
    if (this.version !== v) {
      throw new Error(
        `Compiled Ritz version (${v}) does not match ` + 
        `the current runtime version (${this.version}); ` +
        `please 'ritz recompile' with matching versions.`
      );
    }
  }

  prepareError(e: Error, blockCtx: __BlockContext) {
    if (!(e as any).__thrown) {
      ++this.metrics.flow.thrown;
      (e as any).__thrown = true;
      (e as any).__ritz_stack = [];
      (e as any).__from_block_getter = () => blockCtx;
    }
    if (!(e as any).__source_attached) {
      this.attachOriginalThrowLocation(e, blockCtx);
    }
    (e as any).__ritz_stack?.push(blockCtx.flowId);
    return e;
  }

  preventUnhandledRejection(e: Error) {
    Object.defineProperty(e, '__no_root_unhandled_rejection', { value: true });
  }

  addResumeResolver() { return promise(resolve => { this.resumeResolvers.push(resolve); }); }
  pause(cb?: () => any) { if (this.pausedState) { return; } this.pauseSource = deepError(); this.pausedState = true; if (cb) { cb(); } }
  resume() { if (!this.pausedState) { return; } this.pausedState = false; for (const resolve of this.resumeResolvers) { resolve(); } }

  async __run_in_context(__ctx: __ScopeContext, __blk: __BlockContext, func: Function, funcName: string, ...args) {
    return await this.__$(true, __ctx, __blk, func, funcName, ...args);
  }

  newContext(cce: CallContextEvent, scope: string, parent: __ScopeContext, options?: __ScopeContextOptions) {
    return promise<__ScopeContext>(async resolve => {
      const ctx = new __ScopeContext(scope, parent, options);
      const ctxId = ctx.id;
      __ScopeContext.allUnfinishedContexts[ctxId] = ctx;
      ctx.uuid = this.uuidConfig.contexts ? uuidv4() : `${ctxId}_${Date.now()}`;
      ctx.runtimeContext = this;
      ctx.sourceCallContext = cce;
      ctx.ended = false;
      ctx.decorations = [].concat(parent.decorations, cce.blockContext.decorations);
      ++this.metrics.contexts.totalOpened;
      await this.__flow(true, cce.callId, cce.blockContext.lastRunSource, ctx, cce.blockContext, FlowEventKind.CONTEXT_START, scope, { parent });
      if (gcRegConfig.enableFinalization) {
        ++gcRegCount.context;
        gcReg.register(ctx, 'context', ctx);
      }
      this.mostRecentScopeContext = ctx;
      resolve(ctx);
    });
  }

  addDecoration(deco: Decoration) {
    if (!this.currentCallBlock) {
      throw new Error(`Cannot add decoration from block that doesn't support it. Make sure you're calling with '$'`);
    }
    if (!this.currentCallBlock.decorations) { this.currentCallBlock.decorations = []; }
    this.currentCallBlock.decorations.push(deco);
    return doNotSet;
  }

  endContext(ctx: __ScopeContext, e?: Error): Promise<__ScopeContext> {
    return promise<__ScopeContext>(async resolve => {
      if (!ctx) { return resolve(null); }
      ctx.ended = true;
      const ctxId = ctx.id;
      const cce = ctx.sourceCallContext;
      if (__ScopeContext.allUnfinishedContexts[ctxId]) { delete __ScopeContext.allUnfinishedContexts[ctxId]; }
      ++this.metrics.contexts.totalClosed;
      this.__flow(true, cce.callId, cce.blockContext.lastRunSource, ctx, cce.blockContext, FlowEventKind.CONTEXT_END, ctx.scope);
      if (ctx.onScopeEnds?.length) {
        for (const cb of ctx.onScopeEnds) {
          try { await punchGrab(cb()); } catch (e) { getRuntime().error(e); }
        }
      }
      if (ctx.endResolver) { ctx.endResolver(); ctx.endResolver = null; }
      ctx.release();
      resolve(ctx);
    });
  }

  scopedExec<T>(cce: CallContextEvent, scope: string, options: __ScopeContextOptions,
                executor: (resolve: (value: T) => any, reject: (error: Error) => any, scopeContext?: __ScopeContext) => any) {
    let ctx: __ScopeContext;
    const onFinalize = async (e, r) => {
      if (e) {
        this.preventUnhandledRejection(e);
        this.setScopeError(ctx, null, e);
      }
      if (!ctx?.ended) { await this.endContext(ctx, e); }
    };
    return promise<T>(async ( resolve, reject ) => {
        ctx = await this.newContext(cce, scope, cce.scopeContext, options);
        executor(resolve, reject, ctx);
      }, onFinalize);
  }

  __fn_ctx(flowId: string, filename: string, scopeCtx: __ScopeContext, fnName: string, thisArg?: any) {
    const funcPath = thisArg ? `${thisArg.constructor.name}.${fnName}` : fnName;
    const funcPath2 = `any.${fnName}`;
    const fnCtx = {
      flowId,
      filename,
      funcName: fnName,
      funcPath,
      anyThis: false,
      anyFile: false,
      scopeContext: scopeCtx,
    } as __FunctionContext;
    fnCtx.functionContext = fnCtx;
    const fnCtx2 = {
      flowId,
      filename,
      funcName: fnName,
      funcPath,
      anyThis: false,
      anyFile: true,
      scopeContext: scopeCtx,
    } as __FunctionContext;
    fnCtx2.functionContext = fnCtx;
    const fnCtx3 = {
      flowId,
      filename,
      funcName: fnName,
      funcPath: funcPath2,
      anyThis: true,
      anyFile: true,
      scopeContext: scopeCtx,
    } as __FunctionContext;
    fnCtx3.functionContext = fnCtx;
    const cbs = this.functionContextCallbacks[filename]?.[funcPath];
    if (cbs) { for (const cb of cbs) { try { cb(fnCtx); } catch (e) { getRuntime().error(e); }  } }
    const cbs2 = this.functionContextCallbacks.any?.[funcPath];
    if (cbs2) { for (const cb of cbs2) { try { cb(fnCtx2); } catch (e) { getRuntime().error(e); }  } }
    const cbs3 = this.functionContextCallbacks.any?.[funcPath2];
    if (cbs3) { for (const cb of cbs3) { try { cb(fnCtx3); } catch (e) { getRuntime().error(e); }  } }
    return fnCtx;
  }

  __check(resObj, scopeCtx: __ScopeContext) {
    if (!resObj.isResultKind && resObj.value) {
      return resObj.value;
    }
    let expression = '';
    if (scopeCtx.lastOp?.expression?.negated) {
      const list = scopeCtx.lastOp.expression.expressionListGetter();
      expression = list.map(a => {
        let str: string = null;
        if (a[0] === 'op') {
          str = `${a[1]}`;
        } else if (a[0] === 'operand') {
          str = `${colors.cyan(a[1] + '')}`;
        }
        // if (str.length > 64) { str = str.slice(0, 64) + '...'; }
        return str;
      }).filter(a => a).join(' ');
    }
    if (!resObj.value) {
      if (expression) {
        return new Error(`AssertError(check): ${expression}\n    while running expression: ${scopeCtx.lastExpression}`);
      } else {
        return new Error(`AssertError(check): condition evaluated to falsey response\n    while running expression: ${scopeCtx.lastExpression}`);
      }
    }
    if (resObj.isResultKind && resObj.result.bad) {
      if (expression) {
        return new Error(`AssertError(check): ${expression}\n    error result while running expression: ${scopeCtx.lastExpression}`)
      } else {
        return new Error(`AssertError(check): condition evaluated to an error result\n    while running expression: ${scopeCtx.lastExpression}`);
      }
    }
    return null;
  }

  __lbl(scopeCtx: __ScopeContext, blockCtx: __BlockContext, labelName: string, body: (__ctx: __ScopeContext) => Promise<any>) {
    const scope = `label:${labelName}`;
    const cce = this.getCallEventObject(true, false, scopeCtx, blockCtx, body, scope, []);
    const prom = promise(async (resolve, reject) => {
      let ctx = scopeCtx;
      const labelContextProvider = this.labeledContextsProvided[labelName];
      if (labelContextProvider) { ctx = labelContextProvider(ctx); }
      if (!ctx) { ctx = scopeCtx; }
      const isProvidedContext = ctx !== scopeCtx;
      try {
        const resObj = grabActualResult(await punchGrab(body(ctx)));
        if (isProvidedContext) { await this.endContext(ctx); }
        if (labelName === 'check' || labelName === 'require' || labelName === 'req') {
          const checkedRes = this.__check(resObj, scopeCtx);
          if (checkedRes instanceof Error) {
            return reject(checkedRes);
          } else {
            return resolve(checkedRes);
          }
        }
        return resolve(resObj.value);
      } catch (e) {
        if (isProvidedContext) { await this.endContext(ctx); }
        return reject(e);
      }
    });
    prom.finally(() => { cce.release(); });
    return prom;
  }

  __validate_labeled_contexts(labeledContexts: {[key: string]: number}) {
    if (labeledContexts) {
      Object.assign(this.labeledContextsToBeValidated, labeledContexts);
    }
  }

  provideLabeledContext(labelName: string, labeledContextProvider: LabeledContextProvider) {
    this.labeledContextsProvided[labelName] = labeledContextProvider;
  }

  __postfix_method(scopeCtx: __ScopeContext, blockCtx: __BlockContext, postfixMap: {[word: string]: any[]}, logic: Function) {
    const contextName = `postfix-methods-context(${Object.keys(postfixMap)})`;
    const cce = this.getCallEventObject(false, false, scopeCtx, blockCtx, logic, contextName, []);
    // WrappedFlowWithRuntime
    const wrapper = this.scopedExec(
      cce, contextName, { data: { contextName, postfixedMethodContext: true } },
      async (resolve, reject, scopeContext) => {
        const flowConfig = new WrappedFlowWithRuntime(this, scopeContext, blockCtx);
        scopeContext.postfixContext = { controller: flowConfig, config: postfixMap };
        for (const configKey of Object.keys(postfixMap)) {
          if (flowConfig[configKey]) {
            flowConfig[configKey].apply(flowConfig, postfixMap[configKey])
          }
        }
        let errorCount = 0;
        let tryCount = flowConfig.tryConfig ? flowConfig.tryConfig.tryCount
                        : this.postfixMethodsConfig.tryConfigDefault.tryCount;
        let runCount = flowConfig.runCount;
        if ((tryCount !== 'forever' && !isNumber(tryCount)) || !isNumber(runCount)) {
          return reject(new Error(`[FlowControl] postfix context config is not valid`));
        }
        const tryCond = (i) => {
          if (tryCount === 'forever') { return true; }
          return errorCount < tryCount && i < runCount;
        };
        let retVal;
        let returned;
        let timedOut;
        let error: Error;
        let logicPromise;
        if (flowConfig.timeoutConfig) {
          const t = flowConfig.timeoutConfig.value;
          const unit = flowConfig.timeoutConfig.unit;
          const ms = unitTimeMs(t, unit);
          const timeoutFunc = async () => {
            if (returned) { return; }
            timedOut = true;
            returned = true;
            const timeoutError = new Error(`[FlowControl] timed out after ${t}${unit} in expression: ${blockCtx.lastExpression}`);
            this.setScopeError(scopeContext, blockCtx, timeoutError);
            try {
              if (logicPromise) { await logicPromise; }
            } catch (e2) {}
            return reject(timeoutError);
          };
          ms > 0 ? setTimeout(timeoutFunc, ms) : setImmediate(timeoutFunc);
        }
        for (let i = 0; tryCond(i); ++i) {
          if (i > 0) {
            const waitTimeMs = unitTimeMs(...flowConfig.getTryWaitTime());
            await promise(resolve2 => { waitTimeMs > 0 ? setTimeout(resolve2, waitTimeMs) : setImmediate(resolve2); });
          }
          if (returned) { return; }
          try {
            logicPromise = punchGrab(logic(scopeContext));
            retVal = await logicPromise;
            error = null;
            if (returned) { return; }
            // if (retVal?.__thrown) { throw retVal; }
            flowConfig.iteratorIncrement();
            if (i < runCount) { continue; }
            returned = true;
            return resolve(retVal);
          } catch (e) {
            logicPromise = null;
            error = e;
            if (returned) { return; }
            flowConfig.iteratorIncrement(true);
          }
        }
        if (returned) { return; }
        returned = true;
        if (error) {
          return reject(error);  
        } else {
          return resolve(retVal);
        }
      });
    wrapper.finally(() => {
      cce.release();
    });
    return wrapper;
  }

  __tagged_templ(scopeCtx: __ScopeContext, blockCtx: __BlockContext, t1?: any, ...t: any[]) {

  }

  gc(force = false) {
    const now = Date.now();
    let cleanCount = 0;
    for (const id of Object.keys(this.currentFlowTrackingEventById)) {
      const e = this.currentFlowTrackingEventById[id];
      if (e && now - e.time > 7000) {
        ++cleanCount;
        e.release();
        delete this.currentFlowTrackingEventById[id];
      }
    }
    for (const id of Object.keys(__BlockContext.allUnfinishedBlocks)) {
      if (!__BlockContext.allUnfinishedBlocks[id]) {
        ++cleanCount;
        delete __BlockContext.allUnfinishedBlocks[id];
      }
    }
    for (const id of Object.keys(__ScopeContext.allUnfinishedContexts)) {
      if (!__ScopeContext.allUnfinishedContexts[id]) {
        ++cleanCount;
        delete __ScopeContext.allUnfinishedContexts[id];
      }
    }
    return cleanCount;
  }

  sanitizeError(e: Error) {
    if (!e) { return; }
    const eAny: any = e;
    if (eAny.__thrown) { delete eAny.__thrown; }
    if (eAny.__ritz_stack) { delete eAny.__ritz_stack; }
    if (eAny.__source_attached) { delete eAny.__source_attached; }
    if (eAny.__from_block_getter) { delete eAny.__from_block_getter; }
    if (eAny.__uncatchable) { delete eAny.__uncatchable; }
    if (eAny.__from_context_getter) { delete eAny.__from_context_getter; }
    return e;
  }

  private attachOriginalThrowLocation(e: Error, blockCtx: __BlockContext) {
    if ((e as any)?.__source_attached) { return e; }
    if (blockCtx.lastFlowEvent) {
      const lit = e.stack.split('    at ');
      const src = blockCtx.sourceFile;
      const moreInfo = '    at __THROW_ORIGIN__ (' + src.path.ts + ':' + blockCtx.lastFlowEvent.sourceLocation + ')';
      const moreInfoRitz = '    at __RITZ_THROW_ORIGIN__ (' + src.path.ritzTs + ':' + blockCtx.lastFlowEvent.sourceLocation + ')';
      lit[0] = lit[0] + moreInfo + '\n' + moreInfoRitz + '\n';
      e.stack = lit.join('    at ');
      (e as any).__source_attached = true;
    }
    return e;
  }

  private sanitizeFilenameForImport(filename: string) {
    filename = filename.endsWith('.ts') ? filename.slice(0, -3) : filename;
    filename = filename.endsWith('.js') ? filename.slice(0, -3) : filename;
    if (!filename.startsWith(process.cwd())) {
      return process.cwd() + '/' + filename;
    } else {
      return filename;
    }
  }

  private addCallEvent<T = Function>(type: CallContextPhase, registry: HandlerRegistryByName<T>, 
                       handlerContext: string, functionCallName: string, handler: T
  ) {
    const prevContext = registry[`__handler_context_${handlerContext}`];
    if (prevContext) {
      throw new Error(`Failed to add handler for phase '${type}', handler context ` + 
                      `'${handlerContext}' is already defined at ${prevContext.source}`);
    }
    const source = spotfull(new Error, 3); // track where the handler was added from
    registry[`__handler_context_${handlerContext}`] = { list: [], source };
    if (!registry[functionCallName]) { registry[functionCallName] = { list: [] }; }
    registry[functionCallName].list.push({ handlerContext, addedAt: source, handler });
  }

  private handleCallHandlerType(type: CallContextPhase, registry: typeof this.handlerRegistry, event: typeof this.callEvent) {
    return promise<boolean>(async resolve => {
      event.phase = type;
      try {
        if (registry.__any_handler) {
          event.phaseAny = true;
          await this.handleFunctionCallHandler(type, registry, '__any_handler', event);
        } else {
          event.phaseAny = false;
          if (event.funcImportedName !== event.func.name) {
            await this.handleFunctionCallHandler(type, registry, event.funcImportedName, event);
          }
          await this.handleFunctionCallHandler(type, registry, event.func.name, event);
        }
      } catch (e2) {
        getRuntime().error(`Call context handling process failed`);
        getRuntime().error(e2);
      }
      resolve(true);
    });
  }

  private handleCallHandlerTypeSync(type: CallContextPhase, registry: typeof this.handlerRegistry, event: typeof this.callEvent) {
    event.phase = type;
    try {
      if (registry.__any_handler) {
        event.phaseAny = true;
        this.handleFunctionCallHandlerSync(type, registry, '__any_handler', event);
      } else {
        event.phaseAny = false;
        if (event.funcImportedName !== event.func.name) {
          this.handleFunctionCallHandlerSync(type, registry, event.funcImportedName, event);
        }
        this.handleFunctionCallHandlerSync(type, registry, event.func.name, event);
      }
    } catch (e2) {
      getRuntime().error(`Call context handling process failed`);
      getRuntime().error(e2);
    }
  }

  private async handleFunctionCallHandler(type: CallContextPhase, registry: typeof this.handlerRegistry, funcName: string, event: typeof this.callEvent) {
    if (!registry[funcName]) { return; }
    for (const handlerInfo of registry[funcName].list) {
      event.currentHandler = handlerInfo;
      event.allHandlerSources[event.phase].push(handlerInfo);
      if (event.propagationCanceled[event.phase]) {
        if (event.onSkippedHandling) { event.onSkippedHandling(event, event.propagationCanceled[event.phase].canceledBy); }
        event.currentHandler = null;
        continue;
      }
      if (event.ignoredHandlerContexts[handlerInfo.handlerContext]) {
        if (event.onSkippedHandling) { event.onSkippedHandling(event, event.ignoredHandlerContexts[handlerInfo.handlerContext].ignoredBy); }
        event.currentHandler = null;
        continue;
      }
      try {
        const res = handlerInfo.handler(event);
        if (res?.then) { await res; }
      } catch (e) {
        event.processorErrors[type].push(e);
        this.outputWrapperError(handlerInfo, type, event, e);
      }
      event.currentHandler = null;
    }
  }

  private handleFunctionCallHandlerSync(type: CallContextPhase, registry: typeof this.handlerRegistry, funcName: string, event: typeof this.callEvent) {
    if (!registry[funcName]) { return; }
    for (const handlerInfo of registry[funcName].list) {
      event.currentHandler = handlerInfo;
      event.allHandlerSources[event.phase].push(handlerInfo);
      if (event.propagationCanceled[event.phase]) {
        if (event.onSkippedHandling) { event.onSkippedHandling(event, event.propagationCanceled[event.phase].canceledBy); }
        event.currentHandler = null;
        continue;
      }
      if (event.ignoredHandlerContexts[handlerInfo.handlerContext]) {
        if (event.onSkippedHandling) { event.onSkippedHandling(event, event.ignoredHandlerContexts[handlerInfo.handlerContext].ignoredBy); }
        event.currentHandler = null;
        continue;
      }
      try {
        const res = handlerInfo.handler(event);
      } catch (e) {
        event.processorErrors[type].push(e);
        this.outputWrapperError(handlerInfo, type, event, e);
      }
      event.currentHandler = null;
    }
  }


  private outputWrapperError(handlerInfo: HandlerInfo, type: CallContextPhase, event: typeof this.callEvent, e: Error) {
    if (!(process as any).runtimeContextHideProcessingError) { return; }
    getRuntime().warn(
      `${type} handler of context '${handlerInfo.handlerContext}' (added at ${handlerInfo.addedAt}) has failed. ` +
      `(To hide this warning message, set process.runtimeContextHideProcessingError to true)`,
      e
    );
  }

  private getCallEventObject(
      async: boolean, fromTaggedTemplate: boolean, 
      scopeContext: __ScopeContext, blockContext: __BlockContext,
      func: Function, funcImportedName: string,
      args: any[]
  ): CallContextEvent {
    const callId = getId('callId');
    const e: CallContextEvent = {
      async,
      fromTaggedTemplate,
      isCallContextEvent: true,
      uuid: uuidv4(),
      scopeContext,
      blockContext,
      runtimeContext: this,
      callId,
      func,
      funcImportedName,
      funcOverloadType: '',
      phase: 'beforeCall',
      phaseAny: false,
      data: {},
      args: {
        original: [null, ...args],
        final: [null, ...args],
      },
      error: {
        original: null,
        final: null,
      },
      result: {
        original: null,
        final: null,
      },
      hasThrown: false,
      processorErrors: {
        beforeCall: [],
        functionThrow: [],
        afterCall: [],
      },
      propagationCanceled: {
        beforeCall: null,
        functionThrow: null,
        afterCall: null,
      },
      returnNullOnThrow: false,
      ignoredHandlerContexts: {},
      ignoreHandlerContext: (handlerContext: string) => {
        if (!e.currentHandler) {
          throw new Error(`Current handler not found for call context event object. ` +
                          `ignoreHandlerContext might have been called in async deferred context.`);
        }
        if (!e.ignoredHandlerContexts[handlerContext]) { e.ignoredHandlerContexts[handlerContext] = { ignoredBy: [] }; }
        e.ignoredHandlerContexts[handlerContext].ignoredBy.push({ ...e.currentHandler });
      },
      stopHere: () => {
        if (!e.currentHandler) {
          throw new Error(`Current handler not found for call context event object. ` +
                          `stopHere might have been called in async deferred context.`);
        }
        if (!e.propagationCanceled[e.phase]) { e.propagationCanceled[e.phase] = { canceledBy: [] }; }
        e.propagationCanceled[e.phase].canceledBy.push({ ...e.currentHandler });
      },
      currentHandler: null,
      allHandlerSources: {
        beforeCall: [],
        functionThrow: [],
        afterCall: [],
      },
      time: Date.now(),
      release: () => { releaseId(callId); },
    };
    e.args.original[0] = e;
    e.args.final[0] = e;
    if (gcRegConfig.enableFinalization) {
      ++gcRegCount.cce;
      gcReg.register(e, 'cce', e);
    }
    return e;
  }

  private getFunction(func: Function, importedName: string, scopeCtx: __ScopeContext, blockCtx: __BlockContext): Function {
    if (!func || isClass(func)) {
      switch(importedName) {
        case 'must.throw':
        case 'should.throw':
          return (cce: CCE, closure: Function) => {
            return this.scopedExec(cce, importedName, {}, async (resolve, reject, scopeContext) => {
              try {
                let res; if (closure) { res = await punchGrab(closure(scopeContext)); }
                return reject(new Error(`'${importedName}' inner closure did not throw`));
              } catch (e) {
                blockCtx.lastError = e;
                this.setScopeError(scopeContext, cce.blockContext, e);
                if (e.__uncatchable) {
                  return reject(e);
                } else {
                  return resolve(e);
                }
              }
            });
          }
        case 'should.reach.collectAll':
          return (cce: CCE, closure: Function) => {
            return this.scopedExec(cce, importedName, {}, async (resolve, reject, scopeContext) => {
              try {
                let res; if (closure) { res = await punchGrab(closure(scopeContext)); }
                if (scopeContext.futureCollector) {
                  const futureCollectionResult = scopeContext.futureCollector.finalize();
                  if (!futureCollectionResult.result) {
                    return reject(new Error(`Future collection with '${importedName}' did not finalize as intended: ${futureCollectionResult.message}`));
                  }
                }
                return resolve(true);
              } catch (e) {
                return reject(e);
              }
            });
          }
      }
    }
    if (!func.bind && !func.apply && func.call) {
      return func.call;
    }
    if (!func) {
      throw new Error(`Unable to resolve callable type '${importedName}'`);
    }
    return func;
  }

  getAsync(metaCtx: MetaContext) {
    if (typeof metaCtx === 'boolean') {
      return metaCtx;
    }
    return metaCtx.async;
  }

  getFromTaggedTemplate(metaCtx: MetaContext) {
    if (typeof metaCtx === 'boolean') {
      return false;
    }
    return metaCtx.fromTaggedTemplate;
  }

  setScopeError(scopeContext: __ScopeContext, blockContext: __BlockContext, e: Error) {
    if (scopeContext) {
      scopeContext.flowInterruptedError = e;
      scopeContext.lastError = e;
      (e as any).__from_context_getter = () => scopeContext;
    }
    if (blockContext) {
      blockContext.lastError = e;
    }
  }

  parseMetaContext(metaCtx: MetaContext): MetaContextObject {
    if (typeof metaCtx === 'boolean') {
      return { async: metaCtx };
    } else {
      return metaCtx;
    }
  }
}

export interface __ScopeContextOptions {
  file?: string;
  data?: {[key: string]: any};
  sourceStack?: Error;
  requireParent?: string | string[] | __ScopeContext;
}

export class __ScopeContext {
  static allUnfinishedContexts: {[id: string]: __ScopeContext} = {};
  static allPauses: {[id: string]: __ScopeContext} = {};
  static allPausesCount = 0;
  static stackTraceEnabled = false;
  isScopeContext = true;
  id = getId('scope');
  uuid: string;
  startTime = Date.now();
  runtimeContext: __RuntimeContext;
  sourceCallContext: CallContextEvent;
  currentCallContext: CallContextEvent;
  scope: string;
  ended: boolean;
  endResolver: (value?: any) => any;
  endPromise = promise(async resolve => this.endResolver = resolve);
  noInterrupt: boolean;
  hardKillError: Error;
  flowInterruptedError: Error;
  preloadedErrorMessage: () => string;
  scopeTrail: string[] = [];
  parent: __ScopeContext;
  options: __ScopeContextOptions = {};
  data: {[key: string]: any} = {};
  currentOperatorRubric?: RitzOperatorRubric;
  operandPreprocessing: OperandPreprocessRubric = {};
  mostRecentBlockContext: __BlockContext;
  blocks: {[blockId: string]: __BlockContext} = {};
  immediateBlockContext: __BlockContext;
  onImmediateBlockContextAssign: ((thisCtx: __ScopeContext, immediateBlockContext: __BlockContext) => any)[] = [];
  onScopeEnds: ((...args) => any)[];
  lastError: Error;
  lastComment: CommentData;
  lastExpression: string;
  lastExpressionLocation: string;
  lastOp: { op: string; operands: any[], expression?: { negated: boolean; expressionListGetter: () => ['op'|'operand', any][]; } };
  decorations: Decoration[] = [];
  futureCollector: any;
  
  postfixContext: {
    controller: WrappedFlowWithRuntime;
    config: {[word: string]: any[]};
  };
  cadenceDef: {[Key in FlowEventType]?: number} = {};
  pauseSource: Error;
  pausedState: boolean;
  pauseId: string;
  pauseTime: number;
  private resumeResolvers: Function[] = [];
  constructor(scope: string, parent: __ScopeContext, options?: __ScopeContextOptions) {
    this.scope = scope;
    this.parent = parent;
    if (this.parent && this.parent.isScopeContext) {
      this.scopeTrail = [...parent.scopeTrail, scope];
      this.currentOperatorRubric = this.parent.currentOperatorRubric;
    } else {
      this.scopeTrail = [scope];
    }
    if (options) {
      Object.assign(this.options, options);
      if (options.data) { Object.assign(this.data, options.data); }
    }
    if (__ScopeContext.stackTraceEnabled) {
      const stl = Error.stackTraceLimit;
      Error.stackTraceLimit = 3;
      this.options.sourceStack = new Error;
      Error.stackTraceLimit = stl;
    }
    if (options?.requireParent) {
      const parentScopeShouldBe = 
        typeof options?.requireParent === 'string' ? [ options?.requireParent ]
        : Array.isArray(options.requireParent) ? options.requireParent
        : [ options.requireParent.scope ];
      let invalidParentScope = false;
      if (parentScopeShouldBe.indexOf(parent.scope) === -1) {
        invalidParentScope = true;
      }
      if (invalidParentScope) {
        const stl = Error.stackTraceLimit;
        Error.stackTraceLimit = 30;
        const parentScopeShouldBeStr = parentScopeShouldBe.map(a => `'${a}'`).join(' | ');
        const scopeTrailDetected = parent.scopeTrail.map(a => `'${a}'`).join(' => ');
        const e = new Error(`Unable to create scope '${scope}', the required parent scope must be ` +
                            `${parentScopeShouldBeStr} (detected scope trail: ${scopeTrailDetected})`);
        Error.stackTraceLimit = stl;
        throw e;
      }
    }
  }
  get elapsed(): number { return Date.now() - this.startTime; }
  get hardKilled(): Error { return this.hardKillError || this.parent?.hardKillError; }
  get flowInterruption(): Error { if (this.noInterrupt) { return null; } return this.flowInterruptedError || this.parent?.flowInterruption; }
  get upstreamError(): Error { return this.flowInterruptedError || this.parent?.upstreamError; }
  get paused(): boolean { return (this.pausedState || this.parent?.paused) ? true : false; }
  get operandPreprocessingNull() { return this.operandPreprocessing.null || this.parent?.operandPreprocessingNull; }
  get operandPreprocessingUndefined() { return this.operandPreprocessing.undefined || this.parent?.operandPreprocessingUndefined; }
  get operandPreprocessingBoolean() { return this.operandPreprocessing.boolean || this.parent?.operandPreprocessingBoolean; }
  get operandPreprocessingNumber() { return this.operandPreprocessing.number || this.parent?.operandPreprocessingNumber; }
  get operandPreprocessingBigInt() { return this.operandPreprocessing.bigint || this.parent?.operandPreprocessingBigInt; }
  get operandPreprocessingString() { return this.operandPreprocessing.string || this.parent?.operandPreprocessingString; }
  get operandPreprocessingSymbol() { return this.operandPreprocessing.symbol || this.parent?.operandPreprocessingSymbol; }
  getData<T = {[key: string]: any}>() { return this.data as T; }
  clearDecorations() { this.decorations = []; }
  setLastOpExpression(negated: boolean, expressionGetter: () => ['op'|'operand', any][]) {
    if (!this.lastOp) { this.lastOp = { op: null, operands: null }; }
    this.lastOp.expression = { negated, expressionListGetter: expressionGetter };
  }
  getCadence(type: FlowEventType): number { const cadence = this.cadenceDef[type]; return cadence >= 0 ? cadence : this.parent?.getCadence(type); }
  addResumeResolver() { return promise(resolve => { this.resumeResolvers.push(resolve); }); }
  pause(cb?: () => any) {
    if (this.pausedState) { return ''; }
    this.pauseSource = deepError();
    this.pausedState = true;
    this.pauseId = getId('scopePause');
    this.pauseTime = Date.now();
    ++__ScopeContext.allPausesCount;
    __ScopeContext.allPauses[this.pauseId] = this;
    if (cb) { cb(); }
  }
  resume() {
    if (!this.pausedState) { return ''; }
    this.pausedState = false;
    for (const resolve of this.resumeResolvers) { resolve(); }
    --__ScopeContext.allPausesCount;
    __ScopeContext.allPauses[this.pauseId] = null;
    this.pauseTime = null;
    this.pauseId = releaseId(this.pauseId);
  }
  release() {
    this.id = releaseId(this.id);
  }
}

export { __ScopeContext as __ScopeContextRoot };

export const __context = new __ScopeContext('__dummy', null);

class __BlockContextSourceFileInfo {
  path: {
    js: string;
    ts: string;
    ritzTs: string;
    flowctlTs: string;
  };
  file: {
    js: string;
    ts: string;
    ritzTs: string;
    flowctlTs: string;
  };
};

export class __BlockContext {
  static allUnfinishedBlocks: {[id: string]: __BlockContext} = {};
  static allPauses: {[id: string]: __BlockContext} = {};
  static allPausesCount = 0;
  isBlockContext = true;
  id = getId('block');
  uuid: string;
  startTime = Date.now();
  flowId: string;
  lastRunFlowId: string;
  lastRunSource: string;
  parent: __BlockContext;
  root: __BlockContext;
  currentCallContext: CallContextEvent;
  blocks: {[blockId: string]: __BlockContext} = {};
  data: {[key: string]: any} = {};
  currentOperatorRubric?: RitzOperatorRubric;
  nextNullAccessForgive: boolean;
  scopeContext: __ScopeContext;
  sourceLocation: string;
  content: string;
  collator: __RuntimeCollator;
  isReturnPoint: boolean;
  isLoopSource: boolean;
  // flowHistory: FlowTrackingEvent[] = [];
  ended: boolean;
  endResolver: (value?: any) => any;
  endPromise = promise(async resolve => this.endResolver = resolve);
  enderFlowId: string;
  returnValue: any;
  lastFlowEvent: FlowTrackingEvent;
  lastComment: CommentData;
  lastComputeRegister: any;
  lastExpression: string;
  lastExpressionLocation: string;
  lastPropertyLookUpPaths: string[];
  lastError: Error;
  decorations: Decoration[] = [];

  thrownError: Error;
  onBlockEnds: ((error?: Error, returnValue?: any) => any)[];
  
  cadenceDef: {[Key in FlowEventType]?: number} = {};
  pauseSource: Error;
  pausedState: boolean;
  pauseId: string;
  pauseTime: number;
  private resumeResolvers: Function[] = [];
  constructor(scopeContext: __ScopeContext) {
    this.scopeContext = scopeContext;
  }
  get elapsed(): number { return Date.now() - this.startTime; }
  get flowInterruption(): Error { return this.scopeContext.flowInterruption || this.scopeContext.hardKilled; }
  get upstreamError(): Error { return this.scopeContext.flowInterruptedError; }
  get lastComputedValue() { return this.lastComputeRegister?.$r; }
  get paused(): boolean { return (this.pausedState || this.parent?.paused || this.root?.paused) ? true : false; }
  get sourceFile(): __BlockContextSourceFileInfo {
    const fullpath = this.getRootBlock().scopeContext.options.file;
    const tsFile = fullpath.slice(0, -3) + '.ts';
    const tsRitzFile = fullpath.slice(0, -3) + '.ts._ritz.ts';
    const tsRitzFlowFile = fullpath.slice(0, -3) + '.ts._flowctl.ts';
    const fileName = this.getRootBlock().scopeContext.options.file.split('/').pop();
    const tsFileName = fileName.slice(0, -3) + '.ts';
    const tsRitzFileName = fileName.slice(0, -3) + '.ts._ritz.ts';
    const tsRitzFlowFileName = fileName.slice(0, -3) + '.ts._flowctl.ts';
    return {
      path: {
        js: fullpath,
        ts: tsFile,
        ritzTs: tsRitzFile,
        flowctlTs: tsRitzFlowFile,
      },
      file: {
        js: fileName,
        ts: tsFileName,
        ritzTs: tsRitzFileName,
        flowctlTs: tsRitzFlowFileName,
      },
    };
  }
  clearDecorations() { this.decorations = []; }
  getFileName(fullFilePath: string) { return fullFilePath.split('/').pop(); }
  getCadence(type: FlowEventType): number { const cadence = this.cadenceDef[type]; return cadence >= 0 ? cadence : this.parent?.getCadence(type); }
  getRootBlock() { return this.root ? this.root : this; }
  addResumeResolver() { return promise(resolve => { this.resumeResolvers.push(resolve); }); }
  pause(cb?: () => any) {
    if (this.pausedState) { return ''; }
    this.pauseSource = deepError();
    this.pausedState = true;
    this.pauseId = getId('blockPause');
    this.pauseTime = Date.now();
    ++__BlockContext.allPausesCount;
    __BlockContext.allPauses[this.pauseId] = this;
    if (cb) { cb(); }
  }
  resume() {
    if (!this.pausedState) { return ''; }
    this.pausedState = false;
    for (const resolve of this.resumeResolvers) { resolve(); }
    --__BlockContext.allPausesCount;
    __BlockContext.allPauses[this.pauseId] = null;
    this.pauseTime = null;
    this.pauseId = releaseId(this.pauseId);
  }
  propagateThrow(e: Error, sourceBlockId: string, fromThisBlock = false) {
    if (!e) { return; }
    if (fromThisBlock) {
      this.thrownError = e;
    }
    for (const blockId of Object.keys(this.blocks)) {
      const ch = this.blocks[blockId];
      if (ch) { ch.propagateThrow(e, sourceBlockId); }
    }
  }
  release() {
    this.id = releaseId(this.id);
    this.lastFlowEvent = null;
  }
}

export type configBool = true | false | 1 | 0 | 'true' | 'false' | 'on' | 'off' | '1' | '0';
export type configTrue = true | 1 | 'true' | 'on' | '1';
export type configFalse = false | 0 | 'false' | 'off' | '0';
export function configBoolValue(v: configBool) {
  if (!v) { return false; }
  if (v === 'false' || v === 'off' || v == '0') { return false; }
  return true;
}

export type WrappedFlowBackOffTypes = 'constantOf' | 'multipleOf' | 'expo';

export class WrappedFlowBackOffConfig {
  /**
   * Backoff type  
   * `constantOf` Formula => `initial` (constant)
   * `3 initial` yield: 3s, 3s, 3s, 3s, ...  
   *   
   * `multipleOf` Formula => `mutiple` x `i` + `additiveBase`  
   * `3 multiple` yield: 3s, 6s, 9s, 12s, 15s, 18s, 21s, 24s, ...
   *   
   * `expo` Formula => `expoBase` ^ (`i` x `expoMultiple`) + `additiveBase`  
   * `e` expoBase with `expoMultiple` of 0.8 would yield: 2s, 5s, 11s, 24s, 55s, 120s, 270s, 602s, ...
  */
  type: WrappedFlowBackOffTypes;
  /**
   * Initial value of back-off (default e = 2.718...)
  */
  initial: number = Math.E;
  /**
   * `expo` Formula => `expoBase` ^ (`i` x `expoMultiple`) + `additiveBase`  
   * Default: `e` expoBase with `expoMultiple` of 0.8 would yield: 2s, 5s, 11s, 24s, 55s, 120s, 270s, 602s, ...
  */
  expoBase: number = Math.E;
  /**
   * `expo` Formula => `expoBase` ^ (`i` x `expoMultiple`) + `additiveBase`  
   * Default: `e` expoBase with `expoMultiple` of 0.8 would yield: 2s, 5s, 11s, 24s, 55s, 120s, 270s, 602s, ...
  */
  expoMultiple: number = 0.8;
  /**
   * `multipleOf` Formula => `mutiple` x `i` + `additiveBase`  
   * Default: `3 multiple` yield: 3s, 6s, 9s, 12s, 15s, 18s, 21s, 24s, ...
  */
  mutiple: number = 3;
  /**
   * Additive base for backoff types `multipleOf` and `expo` (default `0`)
  */
  additiveBase: number = 0;
  /**
   * If the yielded amount exceeds the `max`, flow controller will always use the max value.
   * (`0` denotes unlimited.)
  */
  max: number = 0;
  /**
   * Base time unit for backoff (default: `s`)
  */
  unit: TimeUnit = 's';
  constructor(init?: Partial<WrappedFlowBackOffConfig>) { if (init) { Object.assign(this, init); } }
}

export class WrappedFlowTryConfig {
  tryCount: number | 'forever';
  backoffConfig?: WrappedFlowBackOffConfig;
  constructor(init?: Partial<WrappedFlowTryConfig>) { if (init) { Object.assign(this, init); } }
}

export class WrappedFlowTimeoutConfig {
  value: number;
  unit: TimeUnit;
  constructor(init?: Partial<WrappedFlowTimeoutConfig>) { if (init) { Object.assign(this, init); } }
}

export class PostfixWrappedReturn {
  try(count?: number | 'forever', backoffConfig?: WrappedFlowBackOffConfig): typeof this;
  try(count?: number | 'forever', backoffType?: 'constantOf', initial?: number): typeof this;
  try(count?: number | 'forever', backoffType?: 'multipleOf', multiple?: number, additiveBase?: number): typeof this;
  try(count?: number | 'forever', backoffType?: 'expo', expoBase?: number, expoMultiple?: number, additiveBase?: number): typeof this;
  try(config?: WrappedFlowTryConfig): typeof this;
  try(...arg): typeof this { ritzIfaceGuard('try', __filename); return this; }

  backoff(backoffConfig?: WrappedFlowBackOffConfig): typeof this;
  backoff(backoffType?: 'constantOf', initial?: number): typeof this;
  backoff(backoffType?: 'multipleOf', multiple?: number, additiveBase?: number): typeof this;
  backoff(backoffType?: 'expo', expoBase?: number, expoMultiple?: number, additiveBase?: number): typeof this;
  backoff(...arg): typeof this { ritzIfaceGuard('backoff', __filename); return this; }

  repeat(count: number): typeof this;
  repeat(...arg): typeof this { ritzIfaceGuard('repeat', __filename); return this; }

  times(count: number): typeof this;
  times(...arg): typeof this { ritzIfaceGuard('times', __filename); return this; }

  timeout(value: number, unit?: TimeUnit): typeof this;
  timeout(config?: WrappedFlowTimeoutConfig): typeof this;
  timeout(...arg): typeof this { ritzIfaceGuard('timeout', __filename); return this; }
}

export type PostfixReturn<T> = T & PostfixWrappedReturn;

export class WrappedFlowWithRuntime extends PostfixWrappedReturn {
  runtime: __RuntimeContext;
  scopeContext: __ScopeContext;
  blockContext: __BlockContext;
  tryConfig: WrappedFlowTryConfig;
  timeoutConfig: WrappedFlowTimeoutConfig;
  runCount = 1;
  iterator = 0;
  errorCount = 0;
  returned: boolean;
  timedOut: boolean;
  constructor(runtime: __RuntimeContext, scopeContext: __ScopeContext, blockContext: __BlockContext) {
    super();
    this.runtime = runtime;
    this.scopeContext = scopeContext;
    this.blockContext = blockContext;
  }
  getTryWaitTime(): [number, TimeUnit] {
    const boc = this.tryConfig?.backoffConfig;
    if (!boc) { return [0, 'ms']; }
    let value: number = 0;
    switch (boc.type) {
      case 'constantOf': value = boc.initial; break;
      case 'multipleOf': value = this.errorCount * boc.mutiple + boc.additiveBase; break;
      case 'expo': value = Math.pow(boc.expoBase, this.errorCount * boc.expoMultiple) + boc.additiveBase; break;
    }
    if (boc.max !== 0 && value >= boc.max) {
      value = boc.max;
    }
    return [value, boc.unit];
  }
  iteratorIncrement(errored = false) {
    if (errored) { ++this.errorCount; }
    ++this.iterator;
  }

  try(count?: number | 'forever', backoffConfig?: WrappedFlowBackOffConfig);
  try(count?: number | 'forever', backoffType?: 'constantOf', initial?: number);
  try(count?: number | 'forever', backoffType?: 'multipleOf', multiple?: number, additiveBase?: number);
  try(count?: number | 'forever', backoffType?: 'expo', expoBase?: number, expoMultiple?: number, additiveBase?: number);
  try(config?: WrappedFlowTryConfig);
  try(...arg) {
    const firstArg = arg[0];
    const secondArg = arg[1];
    if (isNumber(firstArg) || firstArg === 'forever') {
      this.tryConfig = new WrappedFlowTryConfig;
      this.tryConfig.tryCount = firstArg === 'forever' ? firstArg : number(firstArg);
      if (typeof secondArg === 'string') {
        let boConfig: WrappedFlowBackOffConfig;
        switch (secondArg) {
          case 'constantOf': boConfig = new WrappedFlowBackOffConfig(objTrim({ type: secondArg, initial: arg[2] })); break;
          case 'multipleOf': boConfig = new WrappedFlowBackOffConfig(objTrim({ type: secondArg, multiple: arg[2], additiveBase: arg[3] })); break;
          case 'expo': boConfig = new WrappedFlowBackOffConfig(objTrim({ type: secondArg, expoBase: arg[2], expoMultiple: arg[3], additiveBase: arg[4] })); break;
        }
        if (boConfig) { this.tryConfig.backoffConfig = boConfig; } 
      } else {
        this.tryConfig.backoffConfig = arg[1];
      }
      if (!this.tryConfig.backoffConfig) {
        this.tryConfig.backoffConfig = new WrappedFlowBackOffConfig;
        Object.assign(this.tryConfig.backoffConfig, this.runtime.postfixMethodsConfig.tryConfigDefault.backoffConfig);
      }
    } else if (firstArg && typeof firstArg === 'object'){
      this.tryConfig = new WrappedFlowTryConfig;
      Object.assign(this.tryConfig, firstArg);
    } else {
      this.tryConfig = new WrappedFlowTryConfig;
      Object.assign(this.tryConfig, this.runtime.postfixMethodsConfig.tryConfigDefault);
    }
    return this;
  }

  repeat(count: number);
  repeat(...arg: any[]) {
    const firstArg = arg[0];
    if (firstArg === null || firstArg === undefined) {
      this.runCount = 2;
    } if (isNumber(firstArg)) {
      this.runCount = number(firstArg);
    }
    if (this.runCount <= 0) { this.runCount = 0; }
    return this;
  }

  times(count: number);
  times(...arg) {
    return this.repeat(arg[0]);
  }

  backoff(backoffConfig?: WrappedFlowBackOffConfig);
  backoff(backoffType?: 'constantOf', initial?: number);
  backoff(backoffType?: 'multipleOf', multiple?: number, additiveBase?: number);
  backoff(backoffType?: 'expo', expoBase?: number, expoMultiple?: number, additiveBase?: number);
  backoff(...arg) {
    const firstArg = arg[0];
    if (!this.tryConfig) {
      throw new Error(`'backoff' cannot be without calling 'try' before it in expression: ${this.blockContext.lastExpression}`);
    }
    if (typeof firstArg === 'string') {
      let boConfig: WrappedFlowBackOffConfig;
      switch (firstArg) {
        case 'constantOf': boConfig = new WrappedFlowBackOffConfig(objTrim({ type: firstArg, initial: arg[2] })); break;
        case 'multipleOf': boConfig = new WrappedFlowBackOffConfig(objTrim({ type: firstArg, multiple: arg[2], additiveBase: arg[3] })); break;
        case 'expo': boConfig = new WrappedFlowBackOffConfig(objTrim({ type: firstArg, expoBase: arg[2], expoMultiple: arg[3], additiveBase: arg[4] })); break;
      }
      if (boConfig) { this.tryConfig.backoffConfig = boConfig; } 
    } else {
      this.tryConfig.backoffConfig = firstArg;
    }
    if (!this.tryConfig.backoffConfig) {
      this.tryConfig.backoffConfig = new WrappedFlowBackOffConfig;
      Object.assign(this.tryConfig.backoffConfig, this.runtime.postfixMethodsConfig.tryConfigDefault.backoffConfig);
    }
    return this;
  }
  timeout(value: number, unit: TimeUnit);
  timeout(config?: WrappedFlowTimeoutConfig);
  timeout(...arg) {
    const firstArg = arg[0];
    if (isNumber(firstArg)) {
      this.timeoutConfig = new WrappedFlowTimeoutConfig;
      this.timeoutConfig.value = number(firstArg);
      this.timeoutConfig.unit = arg[1] ? arg[1] : 's';
      if (!this.timeoutConfig.unit) { this.timeoutConfig.unit = this.runtime.postfixMethodsConfig.timeoutConfigDefault.unit; }
    } else {
      this.timeoutConfig = new WrappedFlowTimeoutConfig;
      Object.assign(this.timeoutConfig, this.runtime.postfixMethodsConfig.timeoutConfigDefault);
    }
    return this;
  }
}

export { __BlockContext as __BlockContextRoot };

export const __block = new __BlockContext(__context);

export const __fnr = null as __FunctionContext;

// export const __$: any = new Proxy({},  {
//   set(target, prop, value, receiver) {
//     const ctx = (process as any).runtimeContextInfo;
//     (ctx.contexts[ctx.currentContext] as __RuntimeContext).__set$(value, prop);
//     return value;
//   }
// });

export const __ctxg = new Proxy({} as __RuntimeContext, {
  get(target, prop, receiver) {
    const rctx = (process as any).runtimeContextInfo;
    return rctx.contexts[rctx.currentContext][prop];
  },
  set(target, prop, value, receiver) {
    const rctx = (process as any).runtimeContextInfo;
    rctx.contexts[rctx.currentContext][prop] = value;
    return true;
  }
});

export function callContextArgsProcess(args: any[]) {
  let cce: CCE = null;
  let blockContext: __BlockContext = null;
  if (args[0]?.isCallContextEvent) {
    cce = args[0];
    blockContext = cce.blockContext;
    args = args.slice(1);
  } else if ((args as any).__block_ctx) {
    blockContext = (args as any).__block_ctx;
  }
  return { cce, blockContext, args };
}

export function getRuntime() {
  return __ctxg.self;
}

if (!(process as any).runtimeContextInfo) {
  const rt = new __RuntimeContext<any, {[key: string]: any}>('default');
  rt.version = runtimeVersion;
  (process as any).runtimeContextInfo = {
    currentContext: 'default',
    contexts: { default: rt }
  };
  process.on('unhandledRejection', (e: Error, prom) => {
    setImmediate(() => {
      if (!(e as any).__process_warned && !(e as any).__no_root_unhandled_rejection) {
        (e as any).__process_warned = true;
        getRuntime().error(`[UnhandledPromiseRejectionWarning]: ${e.stack}`);
      }
    });
  });
  setImmediate(() => {
    const pausedCheckerId = setInterval(() => {
      if (__ScopeContext.allPausesCount === 0 && __BlockContext.allPausesCount === 0) {
        return clearInterval(pausedCheckerId);
      }
    }, getRuntime().closureFinishCheckingInterval);
  });
}

function objTrim<T extends object = any>(obj: T, excludeNulls = false): Partial<T> {
  const newObj: Partial<T> = {};
  for (const key of Object.keys(obj)) {
    if (obj[key] === undefined) {
      continue;
    }
    if (excludeNulls && obj[key] === null) {
      continue;
    }
    newObj[key] = obj[key];
  }
  return newObj;
}

export function isNumber(n: any) {
  return typeof n === 'number' || typeof n === 'bigint' || (n && typeof n === 'object' && n.isNumberType);
}

export type NumberLike = number | bigint | Numeric;

export function number(n: NumberLike): number {
  if (n === null || n === undefined) { return null; }
  if (n && (n as any).toNumber) {
    return (n as any).toNumber();
  } else if (typeof n === 'number') {
    return n;
  } else if (typeof n === 'bigint') {
    return Number(n);
  } else if (typeof n === 'boolean') {
    return n ? 1 : 0;
  }
  return null;
}

export class Numeric {
  isNumberType = true;
  kind: string;
  add(b: Numeric): Numeric {
    return null;
  }
  sub(b: Numeric): Numeric {
    return null;
  }
  mul(b: Numeric): Numeric {
    return null;
  }
  div(b: Numeric): Numeric {
    return null;
  }
  mod(b: Numeric): Numeric {
    return null;
  }
  pow(a: Numeric, b: Numeric): Numeric {
    return null;
  }
  toNumber(): number {
    return null; 
  }

}
