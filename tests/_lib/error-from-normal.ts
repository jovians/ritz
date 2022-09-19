export function throwingFuncFromNormalContext() {
  throw new Error();
}

export function randomFailure(chance: number = 0.5) {
  const a = Math.random();
  if (a >= 1 || a < chance) { throw new Error(); }
}
