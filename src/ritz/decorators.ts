import { Class } from "@jovian/type-tools";

export interface DecoratorHandlerDescriptor {
  class?: (target: Class<any>) => any;
  member?: (target: Class<any>, memberName: string, memberDescriptor: PropertyDescriptor) => any;
  parameter?: (target: Class<any>, memberName: string, parameterIndex: number) => any;
}

export function decoratorHandler(args: any[], handler: {
  class?: (target: Class<any>) => any;
  member?: (target: Class<any>, memberName: string | symbol, memberDescriptor: PropertyDescriptor) => any;
  parameter?: (target: Class<any>, memberName: string | symbol, parameterIndex: number) => any;
}): void;
export function decoratorHandler(handler: {
  class?: (target: Class<any>) => any;
  member?: (target: Class<any>, memberName: string | symbol, memberDescriptor: PropertyDescriptor) => any;
  parameter?: (target: Class<any>, memberName: string | symbol, parameterIndex: number) => any;
});
export function decoratorHandler(...args) {
  let handler;
  const handlerByType = (...args) => {
    let target: Class<any> = args[0];
    let memberName = args[1];
    let parameterIndex = typeof args[2] === 'number' ? args[2] : null;
    let propertyDescriptor = typeof args[2] === 'number' ? null : args[2];
    if (!memberName) {
      if (!handler.class) {
        throw new Error(`Decorator handler is missing type 'class' handler`);
      }
      handler.class(target);
      return target;
    } else if (typeof parameterIndex !== 'number') {
      if (!handler.member) {
        throw new Error(`Decorator handler is missing type 'member' handler`);
      }
      return handler.member(target, memberName, propertyDescriptor);
    } else {
      if (!handler.parameter) {
        throw new Error(`Decorator handler is missing type 'parameter' handler`);
      }
      return handler.parameter(target, memberName, parameterIndex);
    }
  };
  if (Array.isArray(args[0])) {
    handler = args[1];
    return handlerByType(...args[0]);
  } else {
    handler = args[0];
    return handlerByType;
  }
}