import { Class, promise } from "@jovian/type-tools";
import { doNotSet } from "./private.models";
import { punchGrab } from "./ritz-util.misc";

// RITZ SKIP
export class must extends Number {
  private static inst: must;
  static throw: Class<any>;
  static not: typeof must = must;
  static NOT: typeof must = must;
  static reach = class {
    static collectAll: Class<any>;
    static once: Class<any>;
    static first: Class<any>;
    static second: Class<any>;
    static third: Class<any>;
    static fourth: Class<any>;
    static fifth: Class<any>;
    static sixth: Class<any>;
    static seventh: Class<any>;
    static eighth: Class<any>;
    static ninth: Class<any>;
    static tenth: Class<any>;
    static eleventh: Class<any>;
    static twelfth: Class<any>;
    static thirteenth: Class<any>;
    static fourteenth: Class<any>;
    static fifteenth: Class<any>;
    static sixteenth: Class<any>;
    static seventeenth: Class<any>;
    static eighteenth: Class<any>;
    static nineteenth: Class<any>;
    static twentieth: Class<any>;
    static _1: Class<any>;
    static _2: Class<any>;
    static _3: Class<any>;
    static _4: Class<any>;
    static _5: Class<any>;
    static _6: Class<any>;
    static _7: Class<any>;
    static _8: Class<any>;
    static _9: Class<any>;
    static _10: Class<any>;
    static _11: Class<any>;
    static _12: Class<any>;
    static _13: Class<any>;
    static _14: Class<any>;
    static _15: Class<any>;
    static _16: Class<any>;
    static _17: Class<any>;
    static _18: Class<any>;
    static _19: Class<any>;
    static _20: Class<any>;
    static here = ((spotUid: string) => {
      
    }) as any as (Class<any> & ((spotUid: string) => void));
  };
  static be: typeof must.inst.be;
  static equal: typeof must.inst.equal;
  static startWith: typeof must.inst.startWith;
  leftOperand: any;
  get letOperandType() { return typeof this.leftOperand; }
  getThisOperand<T>() { return this.leftOperand as any as T; }
  be(right: any) {
    return promise<boolean>(async (resolve, reject) => {
      if (this.leftOperand !== right) { return reject(new Error(`AssertError(must.be): ${this.leftOperand} !== (${right})`)); }
      return resolve(true);
    });
  }
  equal(right: any) {
    return promise<boolean>(async (resolve, reject) => {
      if (this.leftOperand !== right) { return reject(new Error(`AssertError(must.equal): ${this.leftOperand} !== ${right}`)); }
      return resolve(true);
    });
  }
  startWith(right: string) {
    return promise<boolean>(async (resolve, reject) => {
      if (this.letOperandType !== 'string') { return reject(new Error(`AssertError(must.startWith): left operand ${this.leftOperand} is not string type`)); }
      if (!this.getThisOperand<string>().startsWith(right)) { return reject(new Error(`AssertError(must.startWith): ${this.leftOperand} does not start with ${right}`)); }
      return resolve(true);
    });
  }
  throw(closure: () => any) {
    return promise<boolean>(async (resolve, reject) => {
      try {
        await punchGrab(closure());
        return reject(new Error(`AssertError(must.throw): given closure has not thrown`));
      } catch (e) {
        return resolve(true);
      }
    });
  }
  notThrow(closure: () => any) {
    return promise<boolean>(async (resolve, reject) => {
      try {
        await punchGrab(closure());
      } catch (e) {
        e.message = `AssertError(must.notThrow): given closure has thrown`;
        return reject(e);
      }
    });
  }
}

export const should = must;

function $2<T extends (...any) => any, S extends Parameters<T>>(decorator: T, ...args: S) {
  decorator.apply(null, args);
  return doNotSet;
}

export const $ = $2 as unknown as (Class<any> & typeof $2);

