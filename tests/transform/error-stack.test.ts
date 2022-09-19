import { ritz, run } from "../../ritz.default";
import { $, flow, testDefine, should } from "../../src";
import { throwingFuncFromNormalContext } from "../_lib/error-from-normal";
import { throwingFuncWithPrecedingDoubleSlashCommentsMultiline, throwingFuncWithPrecedingMultilineComments, throwingFuncWithPrecedingMultilineCommentsMultiline, throwingFuncWithPrecedingMultilineJSDocComments, throwingFuncWithPrecedingMultilineJSDocCommentsMultiline, throwingFuncWithTrailingJSDocComments, throwingFuncWithTrailingJSDocCommentsMultiline, throwingFuncWithTrailingMultilineComments, throwingFuncWithTrailingMultilineCommentsMultiline } from "../_lib/error-with-comments";
import { throwingFuncWithPrecedingDoubleSlashComments, throwingFuncWithTrailingDoubleSlashComments } from "../_lib/error-with-comments";


testDefine(`error from normal context should still have valid throw location in stack trace`); {
    should.throw; {
        // should refer back to location of throwingFuncFromNormalContext();
        // which is position 12:9 of this script file.
        throwingFuncFromNormalContext();
    }
    check: __block.lastError.stack.contains('.ts:12:9)');
}

testDefine(`error with preceding double slash comment with valid throw location in stack trace`); {
    should.throw; {
        throwingFuncWithPrecedingDoubleSlashComments();
    }
    check: __block.lastError.stack.contains('.ts:5:3)');
}

testDefine(`error with trailing double slash comment with valid throw location in stack trace`); {
    should.throw; {
        throwingFuncWithTrailingDoubleSlashComments();
    }
    check: __block.lastError.stack.contains('.ts:10:3)');
}

testDefine(`error with preceding double slash comment (multiline) with valid throw location in stack trace`); {
    should.throw; {
        throwingFuncWithPrecedingDoubleSlashCommentsMultiline();
    }
    check: __block.lastError.stack.contains('.ts:19:3)');
}

testDefine(`error with preceding multiline comment (one line) with valid throw location in stack trace`); {
    should.throw; {
        throwingFuncWithPrecedingMultilineComments();
    }
    check: __block.lastError.stack.contains('.ts:24:3)');
}

testDefine(`error with preceding multiline comment (multiline) with valid throw location in stack trace`); {
    should.throw; {
        throwingFuncWithPrecedingMultilineCommentsMultiline();
    }
    check: __block.lastError.stack.contains('.ts:33:3)');
}

testDefine(`error with preceding jsdoc comment (one line) with valid throw location in stack trace`); {
    should.throw; {
        throwingFuncWithPrecedingMultilineJSDocComments();
    }
    check: __block.lastError.stack.contains('.ts:38:3)');
}

testDefine(`error with preceding jsdoc comment (multiline) with valid throw location in stack trace`); {
    should.throw; {
        throwingFuncWithPrecedingMultilineJSDocCommentsMultiline();
    }
    check: __block.lastError.stack.contains('.ts:47:3)');
}

testDefine(`error with trailing multiline comment (one line) with valid throw location in stack trace`); {
    should.throw; {
        throwingFuncWithTrailingMultilineComments();
    }
    check: __block.lastError.stack.contains('.ts:52:3)');
}

testDefine(`error with trailing multiline comment (multiline) with valid throw location in stack trace`); {
    should.throw; {
        throwingFuncWithTrailingMultilineCommentsMultiline();
    }
    check: __block.lastError.stack.contains('.ts:60:3)');
}

testDefine(`error with trailing jsdoc comment (one line) with valid throw location in stack trace`); {
    should.throw; {
        throwingFuncWithTrailingJSDocComments();
    }
    check: __block.lastError.stack.contains('.ts:65:3)');
}

testDefine(`error with trailing jsdoc comment (multiline) with valid throw location in stack trace`); {
    should.throw; {
        throwingFuncWithTrailingJSDocCommentsMultiline();
    }
    check: __block.lastError.stack.contains('.ts:73:3)');
}
