/* Jovian (c) 2020, License: MIT */
import { Class, Result } from '@jovian/type-tools';
import { PostfixReturn, TaggedTemplateSelfChain, __ScopeContext } from '../../src';
import { ritzIfaceGuard } from '../../src/ritz/ritz';
import { StageOptions, StageReturn, StepReturn, Workflow } from './pipeline.model';

export function stage(target: any, propertyKey: string, descriptor: PropertyDescriptor): void;
export function stage(stageName?: string, stageClosure?: () => any): StageReturn;
export function stage(stageOptions?: StageOptions): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => void;
export function stage(target: any, propertyKey: string, descriptor: PropertyDescriptor): void;
export function stage(stageOptions: StageOptions, stageClosure?: () => any): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => void;
export function stage(...args): any { return ritzIfaceGuard('stage', __filename); }

export function step(stepName?: string): StepReturn { return ritzIfaceGuard('step', __filename); }

export function sleep(seconds: number) { ritzIfaceGuard('sleep', __filename); return null;}
export function msleep(miliseconds: number) { ritzIfaceGuard('msleep', __filename); return null;}

export namespace parallel {
  export namespace failFast {
    export const _ = null;
  }
  export namespace failFast2 {
    export const _ = null;
  }
  export const _ = null;
}

export function runWorkflow<T extends Workflow<any, any> = any>(workflowClass: Class<T>):
ReturnType<T['finalReturn']> extends Promise<any> ? ReturnType<T['finalReturn']> : Promise<ReturnType<T['finalReturn']>> {
  return ritzIfaceGuard('runWorkflow', __filename);
}

export function tteTestSample(strs: TemplateStringsArray, ...args: any[]): TaggedTemplateSelfChain<PostfixReturn<string[]>> {
  return ritzIfaceGuard('tteTestSample', __filename);
}

export function targetFunc(...args: any[]) {
  return ritzIfaceGuard('targetFunc', __filename);
}

export namespace nested {
  export function targetFunc(...args: any[]) {
    return ritzIfaceGuard('nested.targetFunc', __filename);
  }
  export function taggedTemplate(strs: TemplateStringsArray, ...args: any[]): TaggedTemplateSelfChain<PostfixReturn<string[]>> {
    return ritzIfaceGuard('nested.taggedTemplate', __filename);
  }
  export namespace deep {
    export function targetFunc(...args: any[]) {
      return ritzIfaceGuard('nested.targetFunc', __filename);
    }
    export function taggedTemplate(strs: TemplateStringsArray, ...args: any[]): TaggedTemplateSelfChain<PostfixReturn<string[]>> {
      return ritzIfaceGuard('nested.taggedTemplate', __filename);
    } 
  }
}
