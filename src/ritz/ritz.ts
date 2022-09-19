
// RITZ SKIP
/* Jovian (c) 2020, License: MIT */
import { Class, ix, ok, promise, Result, ReturnCodeFamily, spotfull, utilSha512 } from '@jovian/type-tools';
import * as ts from 'typescript';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { globalPrefixMethods, globalProperties, globalWords } from './global.words.list';


enum RitzCodesEnum {
  USING_RITZ_IFACE_AS_ACTUAL,
  TRANSFORM_FILE_ERROR,
  TRANSFORM_FILE_READ_ERROR,
  TRANSFORM_FILE_WRITE_ERROR,
  TRANSFORM_FILE_MARKER_WRITE_ERROR,
  TRANSFORM_FILE_NOT_ELIGIBLE,
  TRANSFORM_FILE_ELIGIBILITY_CHECK_READ_ERROR,
  REVERT_FILE_ERROR,
  REVERT_FILE_READ_ERROR,
  REVERT_FILE_NOT_ELIGIBLE,
  REVERT_FILE_ORIGINAL_CODE_MISSING,
  REVERT_FILE_WRITE_ERROR,
  REVERT_FILE_MARKER_UNLINK_ERROR,
  REVERT_FILE_ELIGIBILITY_CHECK_READ_ERROR,
  USING_RITZ_IDENTIFIER_FROM_NORMAL_IMPORT_SOURCE,
}
export const RitzCodes = ReturnCodeFamily('RitzCodes', RitzCodesEnum);

export const ritzConsts = {
  header: `/** [ RITZ TRANSFORM COMPLETE ] */`,
  originalCodeSHAHeader: `\n\n/** [ RITZ TRANSFORM ORIGINAL CODE SHA512 ] */\n// `,
  originalCodeCompilerVersionHeader: `\n\n/** [ RITZ TRANSFORM COMPILER VERSION ] */\n// `,
  originalCodeSectionHeader: `\n\n/** [ RITZ TRANSFORM ORIGINAL CODE ] */\n// `,
  skipFlag: `// RITZ SKIP`,
};

type CommentTypes = 'line' | 'multi' | 'doc';
interface CommentObject {
  key: string;
  type: CommentTypes;
  start: number;
  end: number;
  comment: string;
  content: string;
  position: string;
}

type OverloadablesList = (string | ((ritz: Ritz, transformer: RitzTransformer, node: ts.Node) => boolean))[];

/**
 * RitzTransformTargets is of type {[key: string]: any;}
 */
export interface RitzTransformTargets {
  [key: string]: any;
}

export interface RitzConfig {
  outputCollector?: string[];
  outputFile?: string;
  showDebugOutput?: boolean;
  skipLoggingExecutionSteps?: boolean;
  removeComments?: boolean;
  fromRecompile?: boolean;
  extraOverloadables?: OverloadablesList;
  extraGlobalWords?: string[];
  extraPostfixMethods?: string[];
  testOnly?: boolean;
}

/**
 * RitzTransformer class must also 
 */
export interface RitzTransformer {
  name: string;
  needsAnotherPass: boolean;
  keepTransformTargets: boolean;
  transformTargets: RitzTransformTargets;
  passNumber: number;
  iterationEndReplacer: (tsCode: string) => string;
  getTransformer: (ritz: Ritz) => (<T extends ts.Node>(ctx: ts.TransformationContext) => (rootNode: T) => T);
}

export class Ritz extends ix.Entity {
  static packageName: string = 'ritz';
  static compilerVersion: string = '0.0.0';
  static throwOnIfaceInvoke = true;

  config: RitzConfig;
  nodeMarkedDescendentOutput: ts.Node = null;
  fileShaSig: string;
  sourceFileFullText: string;
  sourceFileLines: { line: string; lineNumber: number; startAt: number; endAt: number }[] = [];
  sourceFileCommentStartSpots: {[startPos: string]: { pos: number; end: number; comment: string }} = {};
  sourceFileCommentEndSpots: {[startPos: string]: { pos: number; end: number; comment: string }} = {};
  sourceFileCommentsRegistry: { [key: string]: CommentObject; } = {};
  namedLabeledContextsUsed: { [name: string]: number } = {};

  private transformers: { [name: string]: () => RitzTransformer; } = {};
  private crossTransformsData: { [transformName: string]: { [key: string]: any }; } = {};
  private fileContext = '';
  private fileContextAbsolute = '';
  private fileOriginalContent = '';
  private fileCurrentContent = '';
  private preprocessedSection = '';

  constructor(config?: RitzConfig) {
    super('ritz-controller');
    this.config = config ? config : {};
    if (!this.config.extraOverloadables) { this.config.extraOverloadables = globalProperties; }
    if (!this.config.extraGlobalWords) { this.config.extraGlobalWords = globalWords; }
    if (!this.config.extraPostfixMethods) { this.config.extraPostfixMethods = globalPrefixMethods; }
  }

  get transformIteration$() { return this.ixRx<string>('transformIteration').obs(); }

  addTransformer(name: string, tfGetter: () => RitzTransformer) {
    this.transformers[name] = tfGetter;
  }
  getFileContext() { return this.fileContext; }
  getFileContextAbsolute() { return this.fileContextAbsolute; }
  getFileCurrentContent() { return this.fileCurrentContent; }
  getFileOriginalContent() { return this.fileOriginalContent; }
  addTransformersByNames(tfs: string[]) {
    tfs.forEach(transformName => {
      let moduleName = __dirname.indexOf('/node_modules/') >= 0 ? transformName : `./transformers/${transformName}`;
      let error = this.importTransformDefinition(transformName, moduleName);
      if (error) {
        moduleName = `./transformers/${transformName}`;
        error = this.importTransformDefinition(transformName, moduleName);
      }
      if (error) {
        throw error;
      }
    });
  }
  getTransformersNames(): string[] {
    return Object.keys(this.transformers);
  }
  setCrossTransformsData(transformName: string, key: string, data: any) {
    if (!key) { key = uuidv4(); }
    if (!this.crossTransformsData[transformName]) {
      this.crossTransformsData[transformName] = {};
    }
    this.crossTransformsData[transformName][key] = data;
    return key;
  }
  getCrossTransformsData(transformName: string, key: string) {
    return this.crossTransformsData[transformName]?.[key] || null;
  }
  transformativeImportSource(node: ts.Node, transformationName: string): string{
    if (node.kind !== ts.SyntaxKind.ImportDeclaration) { return ''; }
    const importDecl = node as ts.ImportDeclaration;
    const sourceTextNode = importDecl.getChildAt(1)?.parent;
    const sourceTextModuleSpec = (sourceTextNode as any).moduleSpecifier;
    const sourceText: string = sourceTextModuleSpec.text;
    if (
      sourceText &&
      sourceText.endsWith(`.ritz.${transformationName}`) ||
      sourceText.endsWith(`/ritz.${transformationName}`)
    ) {
      return sourceText;
    }
    return '';
  }
  transform(tsCode: string, file = '__tmp_ritz.ts') {
    if (tsCode.startsWith(ritzConsts.header)) {
      // already transformed
      return null;
    }
    this.fileContext = file;
    this.fileContextAbsolute = file.startsWith(process.cwd()) ? file : `${process.cwd()}/${file}`;
    this.fileOriginalContent = tsCode;
    this.fileShaSig = this.getShaSig(tsCode, 128);
    const originalCodeB64 = Buffer.from(tsCode, 'utf8').toString('base64');
    tsCode = this.preprocessContent(tsCode);
    const transforms: string[] = Object.keys(this.transformers).reverse();
    const transformsIndexCount: {[name: string]: number} = {};
    let transformTargetsKept: RitzTransformTargets = null;
    while (transforms.length > 0) {
      const transformName = transforms.pop();
      if (!transformsIndexCount[transformName]) { transformsIndexCount[transformName] = 0; }
      ++transformsIndexCount[transformName];
      const tf = this.transformers[transformName]();
      if (transformTargetsKept) {
        tf.transformTargets = transformTargetsKept;
        transformTargetsKept = null;
      }
      if (this.config.showDebugOutput) {
        const div = `======================================`;
        const content = (`\n\n\n\n${div} Transform '${transformName}' in file '${this.fileContext}' ` +
                    `(pass ${transformsIndexCount[transformName]}) ${div}\n\n` + tsCode);
        if (this.config.outputFile && this.config.outputCollector) {
          this.config.outputCollector.push(content);
        } else {
          console.log(content);
        }
      }
      tf.passNumber = transformsIndexCount[transformName];
      const printer: ts.Printer = ts.createPrinter({
        newLine: ts.NewLineKind.LineFeed,
        removeComments: this.config.removeComments,
      });
      const sourceFile: ts.SourceFile = ts.createSourceFile(
        file, tsCode, ts.ScriptTarget.ES2015, true, ts.ScriptKind.TS
      );
      // this.sourceFileFullText = sourceFile.getFullText();
      const result = ts.transform(sourceFile, [ tf.getTransformer(this) ]);
      let newCode = printer.printNode(ts.EmitHint.SourceFile, result.transformed[0], sourceFile);
      if (tf.iterationEndReplacer) { newCode = tf.iterationEndReplacer(newCode); }
      if (typeof newCode !== 'string') {
        throw new Error(`transform '${transformName}' source replacer is not returning a transformed source code string.`);
      }
      // if (tsCode === newCode) {
      //   console.log('same');
      // }
      tsCode = newCode;
      this.transformIteration$.next(tsCode);
      this.fileCurrentContent = tsCode;
      if (tf.needsAnotherPass) {
        transforms.push(transformName);
      }
      if (tf.keepTransformTargets) {
        transformTargetsKept = tf.transformTargets;
      }
    }
    let transformedCode = tsCode;
    transformedCode += (
      ritzConsts.originalCodeCompilerVersionHeader + Ritz.compilerVersion + '\n' +
      ritzConsts.originalCodeSHAHeader + this.fileShaSig + '\n' +
      ritzConsts.originalCodeSectionHeader + originalCodeB64 + '\n'
    );
    transformedCode = this.injectHeader(transformedCode);
    return transformedCode;
  }

  getShaSig(content: string, length = 40) {
    return utilSha512(content).reduce((output, elem) => (output + ('0' + elem.toString(16)).slice(-2)), '').substring(0, length);
  }

  preprocessContent(tsCode: string) {
    const tsCodeOriginal = tsCode;
    if (this.config.removeComments) { return tsCode; }
    const sourceFile: ts.SourceFile = ts.createSourceFile(
      '__tmp_ritz.ts', tsCode, ts.ScriptTarget.ES2015, true, ts.ScriptKind.TS
    );
    this.sourceFileFullText = sourceFile.getFullText();
    let at = 0;
    let lineCounter = 1;
    for (const line of this.sourceFileFullText.split('\n')) {
      this.sourceFileLines.push({ line, lineNumber: lineCounter, startAt: at, endAt: at + line.length + 1 });
      at += line.length + 1;
      ++lineCounter;
    }
    let commentKeyIndex = 0;
    const commentsRegisteredPos = {};
    const commentsMap = {};
    const commentsPosMap: { [key: string]: CommentObject; } = {};
    const visit = (node: ts.Node) => {
      const commentRanges = ts.getLeadingCommentRanges(sourceFile.getFullText(), node.getFullStart());
      if (commentRanges?.length) {
        const commentRangeLog = [];
        const commentStrings: string[] = commentRanges.map(r => {
          const comment = sourceFile.getFullText().slice(r.pos, r.end);
          commentRangeLog.push(`[${r.pos}-${r.end}]`);
          this.sourceFileCommentStartSpots[r.pos] = { pos: r.pos, end: r.end, comment };
          this.sourceFileCommentEndSpots[r.end] = { pos: r.pos, end: r.end, comment };
          return comment;
        });
        let commentType: CommentTypes;
        const commentBundle = commentStrings.map(cmt => {
          if (cmt.startsWith('//')) { commentType = 'line'; return cmt.slice(2); }
          else if (cmt.startsWith('/**')) { commentType = 'doc'; return cmt.slice(3, -2); }
          else if (cmt.startsWith('/*')) { commentType = 'multi'; return cmt.slice(2. -2); }
          return cmt;
        }).join('\n');
        // const commentId = commentKey// this.getShaSig(commentRangeLog.join(','));
        const commentObjEscaped = commentBundle.replace(/\`/g, '\\`').replace(/\$/g, '\\$');
        if (!commentsRegisteredPos[commentRanges[0].pos]) {
          commentsRegisteredPos[commentRanges[0].pos] = true;
          const commentKey = `${commentKeyIndex++}`;
          commentsMap[commentKey] = { comment: commentObjEscaped, };
          const start = commentRanges[0].pos;
          const end = commentRanges[commentStrings.length - 1].end;
          commentsPosMap[commentKey] = {
            key: commentKey,
            type: commentType,
            start, end,
            position: this.getPosition(start, end),
            comment: commentObjEscaped,
            content: tsCodeOriginal.slice(start, end),
          };
        }
        // const commentBundleEscaped = commentBundle.replace(/\*\//g, '*\\/');
        // const commentEscaped = ts.factory.createNoSubstitutionTemplateLiteral(commentBundle).text.replace(/\`/g, '\\`');
        // for (let i = 0; i < commentStrings.length; ++i) {
        //   if (i+1 === commentStrings.length) {
        //     tsCode = tsCode.replace(commentStrings[i],
        //       `/** ${commentBundleEscaped} */\n'__ritz_comment_${commentId}';\n`);
        //   } else {
        //     tsCode = tsCode.replace(commentStrings[i], '');
        //   }
        // }
        // console.log(ts.factory.createNoSubstitutionTemplateLiteral(commentBundle));
        // console.log(commentBundle);
      }
      ts.forEachChild(node, visit);
    }
    ts.forEachChild(sourceFile, visit);
    this.sourceFileCommentsRegistry = commentsPosMap;
    const sections = [];
    let index = 0;
    let lastBegin = 0;
    let lastCommentPos = null;
    const commentOrdered = Object.keys(commentsPosMap).map(key => commentsPosMap[key]).sort((a, b) => a.start - b.start);
    for (const commentObj of commentOrdered) {
      sections.push({
        isComment: false,
        from: lastBegin, to: commentObj.start,
        content: tsCodeOriginal.slice(lastBegin, commentObj.start)
      });
      sections.push({
        isComment: true,
        from: commentObj.start,
        to: commentObj.end,
        key: commentObj.key,
        content: commentObj.content,
        comment: commentObj.comment,
      });
      lastBegin = commentObj.end;
    }
    if (lastBegin < tsCodeOriginal.length) {
      sections.push({
        isComment: false,
        from: lastBegin, to: null,
        content: tsCodeOriginal.slice(lastBegin)
      });
    }
    const newSectionsContent = [];
    for (const section of sections) {
      if (section.isComment) {
        let commentInvoke = `'_c${section.key}';`;
        const commentEnd = `/*${section.key}*/;`;
        const lineCount = section.content.split('\n').length - 1;
        const pad = section.content.length - lineCount - commentInvoke.length - commentEnd.length;
        if (pad < 0) {
          commentInvoke = `'_c${section.key},';`;
          const pad2 = section.content.length - lineCount - commentInvoke.length;
          if (pad2 < 0) {
            // if comment too short, just ignore
            newSectionsContent.push(`${' '.repeat(section.content.length)}`);
          } else {
            newSectionsContent.push(`${commentInvoke}${'\n'.repeat(lineCount)}${';'.repeat(pad2)}`);
          }
        } else {
          newSectionsContent.push(`${commentInvoke}${'\n'.repeat(lineCount)}${' '.repeat(pad)}${commentEnd}`);
        }
      } else {
        newSectionsContent.push(section.content);
      }
    }
    const objectContent = {};
    Object.keys(commentsMap).map(key => {
      const cmt = commentsPosMap[key];
      objectContent[key] = { p: cmt.position, t: cmt.type, c: cmt.content, r: cmt.comment };
    });
    this.preprocessedSection = `const __ritz_cmts: {[key: string]: any} = ${JSON.stringify(objectContent)};`
    return newSectionsContent.join('');
  }
  
  eligibleFile(path: string) {
    return promise<Result<boolean>>(resolve => {
      if (path.indexOf('._ritz.ts') >= 0 || path.indexOf('._flowctl.ts') >= 0 || path.indexOf('ritz.ts') >= 0) {
        return resolve(ok(false));
      }
      if (fs.existsSync(`${path}._ritz.ts`)) {
        return resolve(ok(false));
      }
      fs.readFile(path, 'utf8', (e, content) => {
        if (e) { return resolve(RitzCodes.error('TRANSFORM_FILE_ELIGIBILITY_CHECK_READ_ERROR', e)); }
        return resolve(ok(this.filContentEligible(content)));
      });
    }); 
  }

  eligibleFileRevert(path: string) {
    return promise<Result<boolean>>(resolve => {
      if (path.endsWith(`._ritz.ts`) || !fs.existsSync(`${path}._ritz.ts`)) {
        return resolve(ok(false));
      }
      fs.readFile(path, 'utf8', (e, content) => {
        if (e) { return resolve(RitzCodes.error('REVERT_FILE_ELIGIBILITY_CHECK_READ_ERROR', e)); }
        return resolve(ok(true));
      });
    });
  }

  transformFile(path: string) {
    return promise<Result<boolean>>(resolve => {
      Error.stackTraceLimit = 1000;
      fs.readFile(path, 'utf8', (readError, content) => {
        if (readError) { return resolve(RitzCodes.error('TRANSFORM_FILE_READ_ERROR')); }
        let newCode: string;
        try {
          newCode = this.transform(content, path);
        } catch (e) { resolve(RitzCodes.error('TRANSFORM_FILE_ERROR', e)); }
        if (!newCode) { return resolve(RitzCodes.error('TRANSFORM_FILE_NOT_ELIGIBLE')); }
        if (this.config.testOnly) { return resolve(ok(true)); }
        fs.writeFile(path, newCode, 'utf8', (writeError) => {
          if (writeError) { return resolve(RitzCodes.error('TRANSFORM_FILE_WRITE_ERROR')); }
          fs.writeFile(`${path}._ritz.ts`, content, 'utf8', (markerWriteError) => {
            if (markerWriteError) { return resolve(RitzCodes.error('TRANSFORM_FILE_MARKER_WRITE_ERROR')); }
            return resolve(ok(true));
          });
        });
      });
    });
  }

  recompileFromOriginal(path: string) {
    const ritzPath = `${path}._ritz.ts`;
    if (!fs.existsSync(ritzPath) && fs.existsSync(path)) {
      const content = fs.readFileSync(path, 'utf8');
      // const contentSha = this.getShaSig(content, 128);
      if (!content.startsWith(ritzConsts.header)) {
        fs.writeFileSync(ritzPath, content, 'utf8');    
      }
    }
    if (!fs.existsSync(ritzPath)) {
      return null;
    }
    const content = fs.readFileSync(ritzPath, 'utf8');
    const newCode = this.transform(content);
    if (newCode) {
      fs.writeFileSync(path, newCode, 'utf8');
    }
  }

  revertFile(path: string) {
    return promise<Result<boolean>>(resolve => {
      fs.readFile(path, 'utf8', async (readError, content) => {
        if (readError) { return resolve(RitzCodes.error('REVERT_FILE_READ_ERROR')); }
        let originalCode: string;
        const hasOriginalFile = fs.existsSync(`${path}._ritz.ts`);
        try {
          if (hasOriginalFile) {
            originalCode = await this.getFileContent(`${path}._ritz.ts`, 'utf8');
            if (this.config.fromRecompile) {
              const originalShaNow = this.getShaSig(originalCode, 128);
              const originalContent = await this.getFileContent(path, 'utf8');
              const originalShaPostCompile = this.getOriginalSha(originalContent);
              const originalCompilerVersion = this.getOriginalCompilerVersion(originalContent);
              if (originalShaNow === originalShaPostCompile && originalCompilerVersion === Ritz.compilerVersion) {
                return resolve(ok(true, { meta: { unchanged: true } }));
              }
            }
          } else {
            if (content.indexOf(ritzConsts.originalCodeSectionHeader) === -1) {
              return resolve(RitzCodes.error('REVERT_FILE_ORIGINAL_CODE_MISSING'));
            }
            const originalB64 = content.split(ritzConsts.originalCodeSectionHeader)[1];
            originalCode = Buffer.from(originalB64, 'base64').toString('utf8');
          }
        } catch (e) { resolve(RitzCodes.error('REVERT_FILE_ERROR', e)); }
        if (!originalCode) { return resolve(RitzCodes.error('REVERT_FILE_NOT_ELIGIBLE')); }
        if (this.config.testOnly) { return resolve(ok(true)); }
        fs.writeFile(path, originalCode, 'utf8', (writeError) => {
          if (writeError) { return resolve(RitzCodes.error('REVERT_FILE_WRITE_ERROR')); }
          if (!hasOriginalFile) { return resolve((ok(true))); }
          fs.unlink(`${path}._ritz.ts`, (markerUnlinError) => {
            if (markerUnlinError) { return resolve(RitzCodes.error('REVERT_FILE_MARKER_UNLINK_ERROR')); }
            resolve(ok(true));
          });
        });
      });
    });
  }

  getOriginalSha(content: string) {
    return content.split(ritzConsts.originalCodeSHAHeader)[1]?.split('\n')[0];
  }

  getOriginalCompilerVersion(content: string) {
    return content.split(ritzConsts.originalCodeCompilerVersionHeader)[1]?.split('\n')[0];
  }

  getFileContent(path: string, encoding: BufferEncoding) {
    return promise<string>((resolve, reject) => {
      fs.readFile(path, encoding, (e, data) => {
        if (e) { return reject(e); }
        resolve(data);
      });
    });
  }

  getNextSibling(node: ts.Node, ignoreNodeKind: ts.SyntaxKind[] = []) {
    const siblings = this.descendentListOf(node.parent);
    let i = 0; 
    for (const sibling of siblings) {
      if (sibling === node) {
        let skipCount = 0;
        for (let j = i + 1; j < siblings.length; ++j) {
          const sib = siblings[j];
          if (ignoreNodeKind.indexOf(sib?.kind) === -1) {
            (sib as any)._sibling_find_skip_count = skipCount;
            return sib;
          }
          ++skipCount;
        }
        return null;
      }
      ++i;
    }
    return null;
  }

  getPrevSibling(node: ts.Node, ignoreNodeKind: ts.SyntaxKind[] = []) {
    const siblings = this.descendentListOf(node.parent);
    let i = 0; 
    for (const sibling of siblings) {
      if (sibling === node) {
        let skipCount = 0;
        for (let j = i - 1; j >= 0; --j) {
          const sib = siblings[j];
          if (ignoreNodeKind.indexOf(sib?.kind) === -1) {
            (sib as any)._sibling_find_skip_count = skipCount;
            return sib;
          }
          ++skipCount;
        }
        return null;
      }
      ++i;
    }
    return null;
  }

  descendentListOf(node: ts.Node): ts.Node[] {
    try {
      node.getChildAt(0);
      return (node as any).statements ? (node as any).statements : node.getChildren();
    } catch (e) {
      return this.descendentListUnevaluated(node);
    }
  }
  
  descendentListUnevaluated(node: ts.Node): ts.Node[] {
    const list: ts.Node[] = [];
    node.forEachChild(c => list.push(c));
    return list;
  }

  findDescendent(node: ts.Node, type: ts.SyntaxKind, depthFirst = false, depth = 0, skipKind?: ts.SyntaxKind[], outputNodes = '') {
    let found: ts.Node = null;
    const children = this.descendentListOf(node);
    if (outputNodes) { this.outputNode(node, outputNodes, depth); }
    for (const ch of children) {
      if (skipKind && skipKind.indexOf(ch.kind) >= 0) { continue; }
      if (ch.kind === type) { (ch as any)._found_at_depth = depth; return ch; }
      if (!depthFirst) { continue; }
      found = this.findDescendent(ch, type, depthFirst, depth + 1);
      if (found) { return found; }
    }
    if (!depthFirst) {
      for (const ch of children) {
        if (skipKind && skipKind.indexOf(ch.kind) >= 0) { continue; }
        found = this.findDescendent(ch, type, depthFirst, depth + 1);
        if (found) { return found; }
      }
    }
    return null;
  }

  findScopeDescendent(node: ts.Node, type: ts.SyntaxKind, depthFirst = false, depth = 0) {
    if (!node) { return null; }
    return this.findDescendent(node, type, depthFirst, depth, [ts.SyntaxKind.Block]);
  }

  findExactDecendent(withinNode: ts.Node, findTarget: ts.Node): ts.Node {
    if (withinNode === findTarget) { return findTarget; }
    const children = this.descendentListOf(withinNode);
    for (const ch of children) {
      if (ch === findTarget) { return ch; }
      const found = this.findExactDecendent(ch, findTarget);
      if (found) { return found; }
    }
    return null;
  }

  isJSDocKind(node: ts.Node) {
    return ts.SyntaxKind[node.kind].startsWith('JSDoc');
  }

  getIdentifierExpression(strExpression: string): ts.Expression {
    if (strExpression.indexOf('.') === -1) {
      return ts.factory.createIdentifier(strExpression);
    }
    let leftExpr;
    for (const iden of strExpression.split('.').reverse()) {
      if (!leftExpr) {
        leftExpr = ts.factory.createIdentifier(iden);
      } else {
        leftExpr = ts.factory.createPropertyAccessExpression(
          ts.factory.createIdentifier(iden), leftExpr
        );
      }
    }
    return leftExpr;
  }

  getPrecedingJSDocComments(node: ts.Node): ts.JSDoc[] {
    const list: ts.JSDoc[] = [];
    for (const ch of this.descendentListOf(node)) {
      if (this.isJSDocKind(ch)) {
        list.push(ch as ts.JSDoc);
      } else {
        return list;
      }
    }
    return list;
  }

  getNodeChildAt(node: ts.Node, i: number, options?: { noJSDoc?: boolean }) {
    if (!node) { return null; }
    if (options?.noJSDoc) {
      let skipCount = 0;
      for (const ch of this.descendentListOf(node)) {
        if (!this.isJSDocKind(ch)) {
          if (skipCount === i) { return ch; }
          ++skipCount;
        }
      }
    }
    try { return node.getChildAt(i); } catch (e) {
      let j = 0;
      let target: ts.Node;
      node.forEachChild(ch => {
        if (j === i) { target = ch; }
        ++j;
      })
      return target;
    }
  }

  findParentBlock(node: ts.Node) {
    while (node) {
      if (node.kind === ts.SyntaxKind.Block) {
        return node;
      }
      node = node.parent;
    }
    return null;
  }

  nodeHasAncestor(node: ts.Node, parent: ts.Node) {
    while (node) {
      if (node === parent) {
        return true;
      }
      node = node.parent;
    }
    return null;
  }

  serializeNode(tsNode: ts.Node | ts.Node[] | ts.NodeArray<ts.Node>, head?, depth?): string {
    if (!tsNode) { return ''; }
    if (!head) { head = 'Node'; }
    let nodes: ts.Node[] = [];
    if (Array.isArray(tsNode)) {
      nodes = tsNode;
    } else {
      if ((tsNode as ts.NodeArray<ts.Node>).concat) {
        nodes = [ ...(tsNode as ts.NodeArray<ts.Node>) ];
      } else {
        nodes = [tsNode as ts.Node];
      }
    }
    const allContent = [];
    for (const node of nodes) {
      if (!node) { continue; }
      let text: string = '';
      try {
        text = node.getText();
      } catch (e) {
        text = (node as any).escapedText;
      }
      const content = [
        `File:  '${this.fileContext}' `,
        '[ ' + head + ' ] ',
        depth || (node as any)._depth || '',
        '    '.repeat((node as any)._depth || 0),
        (node as any)._node_index !== undefined ? ` (${(node as any)._node_index})` : '',
        ' ' + ts.SyntaxKind[node.kind] + '   ',
        text
      ].join(' ');
      allContent.push(content);
    }
    return allContent.join('\n');
  }

  output(content: string) {
    if (this.config.outputFile && this.config.outputCollector) {
      this.config.outputCollector.push(content);
    } else {
      console.log(content);
    }
  }

  outputNode(tsNode: ts.Node | ts.Node[] | ts.NodeArray<ts.Node>, head?, depth?) {
    const content = this.serializeNode(tsNode, head, depth);
    this.output(content);
  }

  outputNodeDecendents(node: ts.Node, head = 'DESCENDENTS', depthFirst = true) {
    this.findDescendent(node, ts.SyntaxKind.EndOfFileToken, depthFirst, 0, null, head);
  }

  markNodeForDescendentsOutput(node?: ts.Node) {
    this.nodeMarkedDescendentOutput = node;
  }

  private importTransformDefinition(transformName: string, moduleName: string): Error {
    try {
      const tf = require(moduleName).default as Class<RitzTransformer>;
      const testTf = new tf;
      const errorHeader = `Supplied transformer file (moduleName=${moduleName}) does not default export a proper Ritz transformer class`;
      if (!testTf.getTransformer) {
        return new Error(`${errorHeader}: 'getTransformer' function is missing (hint: make sure the class implements RitzTransformer)`);
      }
      if (testTf.name !== transformName) {
        return new Error(`${errorHeader}: transformer instance property 'name' must match transformName name. ('${testTf.name}' != '${transformName}')`);
      }
      this.addTransformer(transformName, () => new tf);
      return null;
    } catch (e) { return e; }
  }

  private filContentEligible(content: string) {
    return (
      content.indexOf(`// RITZ SKIP`) === -1 &&
      (
        content.indexOf(`// RITZ INCLUDE`) >= 0 ||
        content.indexOf(`/ritz.`) >= 0 ||
        content.indexOf(`/ritz.`) >= 0 ||
        content.indexOf(`.ritz.`) >= 0 ||
        content.indexOf(`.ritz.`) >= 0
      )
    )
  }

  private injectHeader(tsCode: string) {
    return [
      ritzConsts.header,
      // `// ritz targets: ${Object.keys(this.ritzTargets).join(', ')}`,
      `import { __ctxg, __fnr, __BlockContextRoot, __ScopeContextRoot } from '${this.getPackagePath()}'`,
      `__ctxg.__ritz_flow_controller_import(__filename, true);`,
      `__ctxg.__match_compiler_version('${Ritz.compilerVersion}');`,
      `const __ctxr = new __ScopeContextRoot('file', null, { file: __filename }); const __ctx = __ctxr; const __fn = __fnr;`,
      `const __blkr = new __BlockContextRoot(__ctx); const __blk = __blkr; const $r = __ctxg.__last_computed_v;`,
      `const __lbls = __ctxg.__validate_labeled_contexts(${JSON.stringify(this.namedLabeledContextsUsed)});`,
      this.preprocessedSection,
      tsCode
    ].join('\n');
  }

  private getPackagePath() {
    if (__dirname.indexOf('/node_modules/') >= 0) {
      return 'ritz2';
    } else {
      const depth = this.fileContext.split('/').length - 1;
      return '../'.repeat(depth) + __dirname.split(`/${Ritz.packageName}/`)[1] + '/runtime.context';
    }
  }

  private getPosition(pos: number, end: number, getEndingPosition = false) {
    const str = this.sourceFileFullText;
    let lineCount = 1;
    let lastLineAt = 0;
    let lastLineEndAt = 0;
    const targetPos = getEndingPosition ? end : pos;
    for (const lineInfo of this.sourceFileLines) {
      if (lineInfo.endAt >= targetPos) {
        lineCount = lineInfo.lineNumber;
        lastLineAt = lineInfo.startAt;
        lastLineEndAt = lineInfo.endAt;
        break;
      }
    }
    if (getEndingPosition) {
      return `${lineCount}:${end - lastLineAt}`;
    }
    return `${lineCount}:${pos - lastLineAt}`;
  }

}

export function requireParent(parentScopeName: string) {

}

export function ritzIfaceGuard(identifier?: string, fileName?: string, stackDepth = 4): any {
  if (Ritz.throwOnIfaceInvoke) {
    const e = RitzCodes.error(
      'USING_RITZ_IFACE_AS_ACTUAL',
      `Using untransformed ritz identifier${identifier ? ` '${identifier}'`: ''} in '${spotfull(new Error, stackDepth)}'. ` +
      `Please make sure all files using ritz are successfully transformed before running.` +
      ` ${fileName ? `(raised from '${fileName}')` : ''}`,
    ).error;
    console.error(e);
    throw e;
  }
}

export function ritzUntransformedGuard(identifier?: string, fileName?: string, stackDepth = 6): any {
  if (Ritz.throwOnIfaceInvoke) {
    const e = RitzCodes.error(
      'USING_RITZ_IDENTIFIER_FROM_NORMAL_IMPORT_SOURCE',
      `Using a ritz identifier${identifier ? ` '${identifier}'`: ''} imported normal context ` +
      `(without ".ritz.$TRANSFROM_NAME") in '${spotfull(new Error, stackDepth)}'. Please check imports so that ` +
      `ritz-specific identifiers are correctly imported from sources ending with "ritz.$TRANSFORM_NAME" ` +
      `(such as 'ritz.default')${fileName ? `(raised from code that wrongly imported '${fileName}')` : ''}`,
    ).error;
    console.error(e);
    throw e;
  }
}
