import { Class } from '@jovian/type-tools';
import { PostfixReturn, PromiseCollapse, RunAsyncController, TaggedTemplateSelfChain, TimeUnit, __ScopeContext } from './src';
import { ritzIfaceGuard } from './src/ritz/ritz';

export function __ritz_reflect(...arg): any { return ritzIfaceGuard('__ritz_reflect', __filename); }

export function context(stepName?: string): any { return ritzIfaceGuard('context', __filename); }

export function safe(stepName?: string): any { return ritzIfaceGuard('safe', __filename); }
export function noInterrupt(stepName?: string): any { return ritzIfaceGuard('noInterrupt', __filename); }

function runModel<T extends (...args: any) => any = any>(logic?: T): PostfixReturn<PromiseCollapse<ReturnType<T>>> { return ritzIfaceGuard('run', __filename); }
export const run = runModel as (typeof runModel & Class<any>);

function asyncModel<T extends (...args: any) => any = any>(timeInSeconds: number, logic?: T): PostfixReturn<RunAsyncController>;
function asyncModel<T extends (...args: any) => any = any>(time: number, unit: TimeUnit, logic?: T): PostfixReturn<RunAsyncController>;
function asyncModel(...arg): PostfixReturn<any> { return ritzIfaceGuard('async', __filename); }
export const async = asyncModel as (typeof asyncModel & Class<any>);

function runDeferModel<T extends (...args: any) => any = any>(timeInSeconds: number, logic?: T): PostfixReturn<RunAsyncController>;
function runDeferModel<T extends (...args: any) => any = any>(time: number, unit: TimeUnit, logic?: T): PostfixReturn<RunAsyncController>;
function runDeferModel(...arg): PostfixReturn<any> { return ritzIfaceGuard('defer', __filename); }
export const defer = runDeferModel as (typeof runDeferModel & Class<any>);

function runEveryModel<T extends (...args: any) => any = any>(timeinSeconds: number, logic?: T): PostfixReturn<RunAsyncController>;
function runEveryModel<T extends (...args: any) => any = any>(time: number, unit: TimeUnit, logic?: T): PostfixReturn<RunAsyncController>;
function runEveryModel(...arg): PostfixReturn<any> { return ritzIfaceGuard('every', __filename); }
export const every = runEveryModel as (typeof runEveryModel & Class<any>);

export function sleep(duration: number, unit: TimeUnit = 's') { return ritzIfaceGuard('sleep', __filename); }

export function msleep(duration: number) { return ritzIfaceGuard('msleep', __filename); }

export function check(value: any) { return ritzIfaceGuard('check', __filename); }

export class ritz {}

