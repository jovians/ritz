import { check, ritz } from "../../ritz.default";
import { testDefine } from "../../src";

testDefine(`List.containsEquivalent should handle { a: 1, b: 2, c: 3 }`); {
    check: [{ a: 1, b: 2, c: 3 }].containsEquivalent({ a: 1, b: 2, c: 3 });
}

testDefine(`Object.equivalentTo should handle { a: 1, b: 2, c: 3 }`); {
    check: ({ a: 1, b: 2, c: 3 }).equivalentTo({ a: 1, b: 2, c: 3 });
}

testDefine(`List.equivalentTo should handle [1, 5, 3]`); {
    check: [1, 5, 3].equivalentTo([1, 5, 3]);
}

testDefine(`Numeric.within with number type should handle both positive and negative numbers`); {
    check: (1).within(5);
    check: (-1).within(5);
}

testDefine(`Numeric.within with bigint type should handle both positive and negative numbers`); {
    check: BigInt(1).within(BigInt(5));
    check: BigInt(2).within(BigInt(5));
}

testDefine(`(Buffer | String).toBase64 should return base64 encoded`); {
    const testStr = 'test 123ABC';
    const testStrBase64 = Buffer.from(testStr).toString('base64');
    check: testStr.toBase64() === testStrBase64;
    const testBuffer = Buffer.from(testStr);
    check: testBuffer.toBase64() === testStrBase64;
}

testDefine(`(Buffer | String).toHex should return hexadecimal encoded`); {
    const testStr = 'test 123ABC';
    const testStrHex = Buffer.from(testStr).toString('hex');
    check: testStr.toHex() === testStrHex;
    const testBuffer = Buffer.from(testStr);
    check: testBuffer.toHex() === testStrHex;
}

testDefine(`String.toBuffer should return correct buffer`); {
    const testStr = 'test 123ABC';
    const testStrBuffer = Buffer.from(testStr);
    check: testStr.toBuffer().equivalentTo(testStrBuffer);
}

testDefine(`(String | Buffer).contains should function correctly`); {
    const testStr = 'test 123ABC';
    const testStrBuffer = Buffer.from(testStr);
    const abcBuffer = Buffer.from('ABC');
    check: testStr.contains('ABC');
    check: testStr.contains(abcBuffer);
    check: testStrBuffer.contains('ABC');
    check: testStrBuffer.contains(abcBuffer);
}

testDefine(`String.dedent should function correctly`); {
    const testStr = `
        test
        test
    `;
    const testStrTrimmed = `test\ntest`; // should strip indent and top new line and bottom new line
    check: testStrTrimmed === testStr.dedent();
}

testDefine(`Array.first should function correctly`); {
    check: ['onlyElement'].first === 'onlyElement';
    check: ['firstElement', 'secondElement', 'thirdElement'].first === 'firstElement';
    check: [].first === undefined;
}

testDefine(`Array.last should function correctly`); {
    check: ['onlyElement'].last === 'onlyElement';
    check: ['firstElement', 'secondElement', 'thirdElement'].last === 'thirdElement';
    check: [].last === undefined;
}

