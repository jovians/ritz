/* Jovian (c) 2020, License: MIT */
import { Class, ReturnCodeFamily } from '@jovian/type-tools';

export interface StageReturn {
  outcome?
}

export interface StepReturn {
  outcome?
}

export type DefaultWorkflowStateType = (
  'RUNNING' |
  'CANCELING' |
  
  'SUCCESS' | 
  'FAILURE' |
  'UNSTABLE' |
  'CANCELED'
);

export class ParallelOptions {
  failFast: boolean = true;
};

export class ParallelExecError extends Error {
  threadErrors: { key: string; error: Error }[] = [];
}

export type ParallelExecOutcome = { key: string; outcome: any; }[];

export class Workflow<StateType = DefaultWorkflowStateType, DataType = {[key: string]: any}> {
  workflowId?: string;
  state: StateType = null;
  data: DataType = {} as any;
  paused?: boolean = false;
  interrupted?: boolean = false;
  setup?(){}
  post?(){}
  success?(){}
  failure?(){}
  cleanup?(){}
  defineEndStates?(){}
  finalReturn?(){}
}

export interface FlowContext {
  target: Class<any>;
  type: string;
  property: string;
  desc?: PropertyDescriptor;
  stageOptions?: StageOptions;
}

export interface StageOptions {
  name?: string;
  stageName?: string;
  when?: (inst: Workflow) => any;
}

export type StageType = (
  'setup' |
  'stage' | 
  'post' |
  'cleanup' |
  'success'
);

export interface StageInfo<T = any> {
  workflow: Workflow;
  workflowId: string;
  workflowName: string;
  stageName: string;
  stageType: string;
  result?: T;
  error?: Error;
  rethrow?: boolean;
  startTime?: number;
  duration?: number;
  endTime?: number;
  metadata?: {[key: string]: any};
}
