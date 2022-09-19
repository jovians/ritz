import { errorResult, ok, ReturnCodeFamily } from '@jovian/type-tools';

enum ResultTestingCodesEnum {
  SAMPLE_BAD_RESULT,
}
export const ResultTestingCodes = ReturnCodeFamily('ResultTestingCodes', ResultTestingCodesEnum);

export function testGoodResult(): any {
  return ok(true);
}

export function testBadResult(): any {
  return ResultTestingCodes.error('SAMPLE_BAD_RESULT');
}
