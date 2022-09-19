import { ritz } from "../../ritz.default";

export function throwingFuncWithPrecedingDoubleSlashComments(): '5:3' {
  // preceding double slash comments
  throw new Error;
}

export function throwingFuncWithTrailingDoubleSlashComments(): '10:3' {
  const someExpr = ''; // trailing double slash comments
  throw new Error;
}

export function throwingFuncWithPrecedingDoubleSlashCommentsMultiline(): '19:3' {
  // preceding double slash comments line 1
  // preceding double slash comments line 2

  // preceding double slash comments line 3
  // preceding double slash comments line 4
  throw new Error;
}

export function throwingFuncWithPrecedingMultilineComments(): '24:3' {
  /* preceding multiline comments  */
  throw new Error;
}

export function throwingFuncWithPrecedingMultilineCommentsMultiline(): '33:3' {
  /* 
      preceding multiline comments line 1
      preceding multiline comments line 2
      preceding multiline comments line 3
  */
  throw new Error;
}

export function throwingFuncWithPrecedingMultilineJSDocComments(): '38:3' {
  /** preceding jsdoc comments  */
  throw new Error;
}

export function throwingFuncWithPrecedingMultilineJSDocCommentsMultiline(): '47:3' {
  /**
   * preceding jsdoc comments line 1
   * preceding jsdoc comments line 2
   * preceding jsdoc comments line 3
   */
  throw new Error;
}

export function throwingFuncWithTrailingMultilineComments(): '52:3' {
  const someExpr = ''; /* trailing multiline comments */
  throw new Error;
}

export function throwingFuncWithTrailingMultilineCommentsMultiline(): '60:3' {
  const someExpr = ''; /** trailing multiline comments line 1
    trailing multiline comments line 2
    trailing multiline comments line 3
  */
  throw new Error;
}

export function throwingFuncWithTrailingJSDocComments(): '65:3' {
  const someExpr = ''; /** trailing jsdoc comments */
  throw new Error;
}

export function throwingFuncWithTrailingJSDocCommentsMultiline(): '73:3' {
  const someExpr = ''; /** trailing jsdoc comments line 1
  * trailing jsdoc comments line 2
  * trailing jsdoc comments line 3
  */
  throw new Error;
}
