// RITZ SKIP
import { must, should } from "./global.predefined";
import { dedent, bufferStringify, ifaceInvokeGuard } from "./ritz-util.misc";

export const globalWords = [
  'end',
  'flow',
  'must',
  'should',
];

export const propertyAccessBannedRoots = [
  'Array',
  'Object',
  'String',
  'Number',
  'BigInt',
  'Boolean',
  'Function',
  'Symbol',
  'Buffer',
];

export const propertyRequiringDirectAccess = {
  'constructor': 1,
  'prototype': 1,
  'toString': 1,
  'valueOf': 1,
  'isPrototypeOf': 1,
  'toLocaleString': 1,
  'hasOwnProperty': 1,
  'propertyIsEnumerable': 1,
};

export const specialGlobalFunctions = [
  '$',
];

// Any data class (string, number, boolean, Array, Object.. etc.) will have these util properties
export const globalProperties = [
  '$',
  '_',
  'must',
  'should',
];

export const globalPrefixMethods = [
  'try',
  'repeat',
  'times',
  'backoff',
  'timeout',
];

export interface GlobalPropertyLookUpEvent {
  property: string;
  errorGetter: (prop: string) => Error;
  blockContext: any;
}

export const globalPropertiesLookUpBehavior = {
  '$': (r, evt: GlobalPropertyLookUpEvent) => r,
  '_': (r, evt: GlobalPropertyLookUpEvent) => r,
  'must': (r, evt: GlobalPropertyLookUpEvent) => {
    const m = new must();
    m.leftOperand = r;
    return m;
  },
  'should': (r, evt: GlobalPropertyLookUpEvent) => {
    const m = new should();
    m.leftOperand = r;
    return m;
  },
  'equivalentTo': (r, evt: GlobalPropertyLookUpEvent) => {
    if (r['equivalentTo']) { return r['equivalentTo']; }
    if (r) {
      if (Array.isArray(r)) {
        return (target: any[]) => {
          evt.blockContext.scopeContext?.setLastOpExpression(true, () => [['operand', JSON.stringify(r)], ['op', 'not equivalent to'], ['operand', JSON.stringify(target)]]);
          return deepEquivalenceComparisonArray(r, target);
        }
      } else if (r && Buffer.isBuffer(r)) {
        return (target: string | Buffer) => {
          const target2 = Buffer.isBuffer(target) ? target : Buffer.from(target);
          evt.blockContext.scopeContext?.setLastOpExpression(true, () => [['operand', bufferStringify(r)], ['op', 'not equivalent to'], ['operand', bufferStringify(target2)]]);
          return (r as Buffer).indexOf(target) === 0 && target.length === r.length;
        };
      } else if (typeof r === 'object') {
        return (target: object) => {
          evt.blockContext.scopeContext?.setLastOpExpression(true, () => [['operand', JSON.stringify(r)], ['op', 'not equivalent to'], ['operand', JSON.stringify(target)]]);
          return deepEquivalenceComparisonObject(r, target);
        }
      }
    }
    return r[evt.property];
    ifaceInvokeGuard();
  },
  'containsEquivalent': (r, evt: GlobalPropertyLookUpEvent) => {
    if (r['containsEquivalent']) { return r['containsEquivalent']; }
    if (Array.isArray(r)) {
      return (target: any) => {
        evt.blockContext.scopeContext?.setLastOpExpression(true, () => [['operand', JSON.stringify(r)], ['op', 'does not contain equivalent element to'], ['operand', JSON.stringify(target)]]);
        for (const a of r) {
          if (a === target) {
            return true;
          } else if (Array.isArray(a)) {
            if (deepEquivalenceComparisonArray(a, target)) { return true; }
          } else if (a && typeof a === 'object') {
            if (deepEquivalenceComparisonObject(a, target)) { return true; }
          }
        }
        return false;
      }
    } else if (r && typeof r === 'object') {
      return (target: any) => {
        evt.blockContext.scopeContext?.setLastOpExpression(true, () => [['operand', JSON.stringify(r)], ['op', 'does not contain equivalent element to'], ['operand', JSON.stringify(target)]]);
        for (const key of Object.keys(r)) {
          const a = r[key];
          if (a === target) {
            return true;
          } else if (Array.isArray(a)) {
            if (deepEquivalenceComparisonArray(a, target)) { return true; }
          } else if (a && typeof a === 'object') {
            if (deepEquivalenceComparisonObject(a, target)) { return true; }
          }
        }
        return false;
      };
    }
    return r[evt.property];
    ifaceInvokeGuard();
  },
  'contains': (r, evt: GlobalPropertyLookUpEvent) => {
    if (r['contains']) { return r['contains']; }
    if (typeof r === 'string') {
      return (target: string | Buffer) => {
        if (typeof target === 'string') {
          evt.blockContext.scopeContext?.setLastOpExpression(true, () => [['operand', r], ['op', 'does not contain'], ['operand', target]]);
          return r.indexOf(target) >= 0;
        } else {
          evt.blockContext.scopeContext?.setLastOpExpression(true, () => [['operand', r], ['op', 'does not contain'], ['operand', bufferStringify(target)]]);
          return Buffer.from(r).indexOf(target) >= 0;
        }
      }
    } else if (Array.isArray(r)) {
      return (target: any) => {
        evt.blockContext.scopeContext?.setLastOpExpression(true, () => [['operand', JSON.stringify(r)], ['op', 'does not contain'], ['operand', JSON.stringify(target)]]);
        return r.indexOf(target) >= 0;
      }
    } else if (r && Buffer.isBuffer(r)) {
      return (target: string | Buffer) => {
        const target2 = Buffer.isBuffer(target) ? target : Buffer.from(target);
        evt.blockContext.scopeContext?.setLastOpExpression(true, () => [['operand', bufferStringify(r)], ['op', 'does not contain'], ['operand', bufferStringify(target2)]]);
        return (r as Buffer).indexOf(target2) >= 0;
      };
    } else if (r && typeof r === 'object') {
      return (target: any) => {
        evt.blockContext.scopeContext?.setLastOpExpression(true, () => [['operand', JSON.stringify(r)], ['op', 'does not contain'], ['operand', JSON.stringify(target)]]);
        for (const key of Object.keys(r)) { if (r[key] === target) { return true; } }
        return false;
      };
    }
    return r[evt.property];
    ifaceInvokeGuard();
  },
  'toNumber': (r, evt: GlobalPropertyLookUpEvent) => {
    if (r['toNumber']) { return r['toNumber']; }
    if (typeof r === 'number') {
      return () => r;
    } else if (typeof r === 'bigint') {
      return () => Number(r);
    } else if (typeof r === 'boolean') {
      return () => r ? 1 : 0;
    }
    return r[evt.property];
    ifaceInvokeGuard();
  },
  'within': (r, evt: GlobalPropertyLookUpEvent) => {
    if (r['within']) { return r['within']; }
    if (r[evt.property]) {
      return r[evt.property];
    }
    if (typeof r === 'number') {
      return (n: number) => Math.abs(r) <= n;
    } else if (typeof r === 'bigint') {
      return (n: bigint) => n < BigInt(0) ? -r <= n : r <= n;
    }
    return r[evt.property];
    ifaceInvokeGuard();
  },
  'toBuffer': (r, evt: GlobalPropertyLookUpEvent) => {
    if (r['toBuffer']) { return r['toBuffer']; }
    if (typeof r === 'string') {
      return (encoding: BufferEncoding) => {
        if (!encoding) { encoding = 'utf8'; }
        return Buffer.from(r, encoding);
      }
    }
    return r[evt.property];
    ifaceInvokeGuard();
  },
  'toBase64': (r, evt: GlobalPropertyLookUpEvent) => {
    if (r['toBase64']) { return r['toBase64']; }
    if (typeof r === 'string') {
      return (encoding: BufferEncoding) => {
        if (!encoding) { encoding = 'utf8'; }
        return Buffer.from(r, encoding).toString('base64');
      }
    } else if (r && Buffer.isBuffer(r)) {
      return () => {
        return r.toString('base64');
      }
    }
    return r[evt.property];
    ifaceInvokeGuard();
  },
  'toHex': (r, evt: GlobalPropertyLookUpEvent) => {
    if (r['toHex']) { return r['toHex']; }
    if (typeof r === 'string') {
      return (encoding: BufferEncoding) => {
        if (!encoding) { encoding = 'utf8'; }
        return Buffer.from(r, encoding).toString('hex');
      }
    } else if (r && Buffer.isBuffer(r)) {
      return () => {
        return r.toString('hex');
      }
    }
    return r[evt.property];
    ifaceInvokeGuard();
  },
  'dedent': (r, evt: GlobalPropertyLookUpEvent) => {
    if (r['dedent']) { return r['dedent']; }
    if (typeof r === 'string') {
      return () => {
        return dedent(r);
      }
    }
    return r[evt.property];
    ifaceInvokeGuard();
  },
  'first': (r, evt: GlobalPropertyLookUpEvent) => {
    if (r['first']) { return r['first']; }
    if (Array.isArray(r)) {
      return r.length ? r[0] : undefined;
    }
    return r[evt.property];
    ifaceInvokeGuard();
  },
  'last': (r, evt: GlobalPropertyLookUpEvent) => {
    if (r['last']) { return r['last']; }
    if (Array.isArray(r)) {
      return r.length ? r[r.length - 1] : undefined;
    }
    return r[evt.property];
    ifaceInvokeGuard();
  },
};

function deepEquivalenceComparisonArray(a: any[], b: any[]) {
  if (a === b) { return true; }
  if (!a || !b) { return false; }
  if (!Array.isArray(a) || !Array.isArray(b)) { return false; }
  if (a.length !== b.length) { return false; }
  for (let i = 0; i < a.length; ++i) {
    const aCh = a[i];
    const bCh = b[i];
    if (aCh === bCh) { continue; }
    if (!aCh || !bCh) { return false; }
    if (Array.isArray(aCh) && Array.isArray(bCh)) {
      if (!deepEquivalenceComparisonArray(aCh, bCh)) { return false; }
    } else if (typeof aCh === 'object' && typeof bCh === 'object') {
      if (!deepEquivalenceComparisonObject(aCh, bCh)) { return false; }
    } else {
      return false;
    }
  }
  return true;
}

function deepEquivalenceComparisonObject(a: object, b: object) {
  if (a === b) { return true; }
  if (!a || !b) { return false; }
  if (typeof a !== 'object' || typeof b !== 'object') { return false; }
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) { return false; }
  aKeys.sort();
  bKeys.sort();
  if (!deepEquivalenceComparisonArray(aKeys, bKeys)) { return false; }
  for (const aKey of aKeys) {
    const aCh = a[aKey];
    const bCh = b[aKey];
    if (aCh === bCh) { continue; }
    if (!aCh || !bCh) { return false; }
    if (Array.isArray(aCh) && Array.isArray(bCh)) {
      if (!deepEquivalenceComparisonArray(aCh, bCh)) { return false; }
    } else if (typeof aCh === 'object' && typeof bCh === 'object') {
      if (!deepEquivalenceComparisonObject(aCh, bCh)) { return false; }
    } else {
      return false;
    }
  }
  return true;
}