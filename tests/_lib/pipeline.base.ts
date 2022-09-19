import { Class, ClassLineage, ok, Promise2, Result } from '@jovian/type-tools';
import { Workflow, StageReturn, FlowContext, StageInfo } from './pipeline.model';
import { v4 as uuidv4 } from 'uuid';
import { errorCheck, __ScopeContext } from '../../src';

export class StageController {
  public static addOnBeforeStage<T = any>(callback: (e: StageInfo<T>) => any) {
    StageController.onBeforeStages.push(callback);
    return StageController;
  }
  public static addOnAfterStage<T = any>(callback: (e: StageInfo<T>) => any) {
    StageController.onAfterStages.push(callback);
    return StageController;
  }
  public static addOnStageError<T = any>(callback: (e: StageInfo<T>) => any) {
    StageController.onStageError.push(callback);
    return StageController;
  }
  public static addOnStageSkip<T = any>(callback: (e: StageInfo<T>) => any) {
    StageController.onStageError.push(callback);
    return StageController;
  }
  private static onBeforeStages: ((e: StageInfo) => any)[];
  private static onAfterStages: ((e: StageInfo) => any)[];
  private static onStageError: ((e: StageInfo) => any)[];
  private static onStageSkip: ((e: StageInfo) => any)[];
}


export class ClassWithFunction1 {
  thisRef: ClassWithFunction1;
  constructor() { this.thisRef = this; }
  func1(init: any) {
    if (this.thisRef !== this) { throw new Error(`Class member function invoked with mistaching 'this' reference`); }
  }
}

export class ClassWithFunction2 {
  thisRef: ClassWithFunction2;
  constructor() { this.thisRef = this; }
  func2(init: any) {
    if (this.thisRef !== this) { throw new Error(`Class member function invoked with mistaching 'this' reference`); }
  }
}

