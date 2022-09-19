/* Jovian (c) 2020, License: MIT */
// RITZ SKIP
import { Ritz, RitzTransformer, RitzTransformTargets } from "../ritz";
import { v4 as uuidv4 } from 'uuid';
import * as ts from 'typescript';
import { propertyAccessBannedRoots, specialGlobalFunctions } from "../global.words.list";

export interface DefaultTransformTarget {
  type: (
    'default_CallTransform' |
    'default_CallStatementTransform' |
    'default_CalledClosureTransform' |
    'default_IdentifierClosureTransform' |
    'default_StaticallyCollatedClosureTransform' |
    'default_DynamicallyCollatedClosureTransform' |
    'default_TernaryOperatorTransform' |
    'default_BinaryOperatorTransform' |
    'default_UnaryOperatorTransform' |
    'default_VoidOperatorTransform' |
    'default_DeleteOperatorTransform' |
    'default_DotOperatorTransform' |
    'default_ContextGlobalVariableTransform' |
    'default_CommentLoggingTransform' |
    'default_FlowControlTransform' |
    'default_ReturnTransform' |
    'default_AssignmentTransform' |
    'default_SuperGlobalTransform' |
    'default_LabeledClosureTransform' |
    'default_NonTargetCallTransform' |
    'default_ElementAccessTransform' |
    'unknown'
  );
  target: ts.Node;
  subject: ts.Node;
  meta?: { [key: string]: any; };
  shouldReturn?: ts.Node;
  parentBlock?: ts.Block;
  transformableBlock?: ts.Node;
  transformBlockWith?: (blockContent: ts.Node) => ts.Node;
}

interface PushedBlock {
  block: ts.Block;
  num: number;
  parentNum?: number;
}

export default class DefaultRitzTransformer2 implements RitzTransformer {
  name = 'default';
  id = uuidv4();
  passNumber = 1;
  needsAnotherPass = false;
  keepTransformTargets = false;
  transformTargets: RitzTransformTargets = {};
  iterationEndReplacer = null;
  private ritz: Ritz;
  private withinRitzImportPath = '';
  private transformTargetsSaved: {[key: string]: string} = {};
  private transformTargetsBySource: {[sourcePath: string]: string[]} = {};
  private transformContext: ts.TransformationContext = null;
  private depth = 0;
  private visitFunction: (node: ts.Node) => ts.Node;
  private flowControlCounter = 1;
  private blockScopeCounter = 1;
  private currentNode: ts.Node;
  private currentNodeParent: ts.Node;
  private currentNodeIndex = 0;
  private prevNode: ts.Node;
  private unclaimedBlocks: {[num: string]: PushedBlock} = {};
  private blockMeta: ReturnType<typeof this.blockScopeStatement>;
  constructor() {
    this.iterationEndReplacer = (tsCode: string) => {
      const lines = [];
      for (let line of tsCode.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('__ctxg.__op(') && line.startsWith(' ')) {
          line = 'await ' + line;
        }
        lines.push(line);
      }
      tsCode = lines.join('\n');
      tsCode = tsCode.split(' await await ').join(' await ');
      return tsCode;
    }
  }
  handleChildNodes(ritz: Ritz, node: ts.Node, visit: (node: ts.Node) => ts.Node) {
    ++this.depth;
    const overrideOutputBehavior = ritz.nodeMarkedDescendentOutput === node;
    let outputConfigSaved = false;
    if (overrideOutputBehavior) {
      outputConfigSaved = ritz.config.showDebugOutput;
      ritz.config.showDebugOutput = true;
    }
    const parentBeforePrev = this.currentNodeParent;
    this.currentNodeParent = node;
    const parentIndexPrev = this.currentNodeIndex;
    this.currentNodeIndex = 0;
    const postVisitNode = ts.visitEachChild(node, visit, this.transformContext);
    this.currentNodeParent = parentBeforePrev;
    this.currentNodeIndex = parentIndexPrev;
    (postVisitNode as any)._original = node;
    (node as any)._after = postVisitNode;
    if (postVisitNode !== node) {
      (postVisitNode as any)._node_parent = ((node as any)._node_parent?._after) ? (node as any)._node_parent?._after : (node as any)._node_parent;
      (postVisitNode as any)._prev_node = (node as any)._prev_node;
      (postVisitNode as any)._depth = (node as any)._depth;
      (postVisitNode as any)._node_children_before = (node as any)._node_children;
    }
    if (overrideOutputBehavior) {
      ritz.config.showDebugOutput = outputConfigSaved;
    }
    --this.depth;
    return postVisitNode;
  }
  handleFirstPass (ritz: Ritz) {
    this.needsAnotherPass = true;
    this.keepTransformTargets = true;
    const visit = (node: ts.Node): ts.Node => {
      let res;
      if (res = this.handleNodeBasic(ritz, node)) { return res; }
      if (ritz.isJSDocKind(node)) { return node; }
      this.markBlocks(node);

      if (node.kind === ts.SyntaxKind.BreakStatement) {
        const child = node.getChildAt(1);
        if (child?.kind === ts.SyntaxKind.Identifier) {
          throw new Error(`breaking to a label is forbidden in Ritz, at ${this.getFullFilePosition(node)}`);
        }
        const parentLoop = this.findParentLoop(node);
        if (parentLoop) {
          (node as any)._parent_loop = parentLoop;
          if (!(parentLoop as any)._break_sources) { (parentLoop as any)._break_sources = []; }
          (parentLoop as any)._break_sources.push(node);
          for (const ch of parentLoop.getChildren()) {
            if (ch.kind === ts.SyntaxKind.Block) { (ch as any)._is_break_point = true; break; }
          }
          return ts.factory.createBlock([
            ts.factory.createExpressionStatement(ts.factory.createAwaitExpression(ts.factory.createCallExpression(
              ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('__ctxg'), '__break'),
              [],
              ts.factory.createNodeArray<ts.Expression>([
                ts.factory.createStringLiteral(this.getFlowTrackingId(), true),
                ts.factory.createStringLiteral(this.getPosition(node), true),
                ts.factory.createIdentifier('__blk'),
              ])
            ))),
            ts.factory.createBreakStatement(),
          ]);
        }
      }

      if (node.kind === ts.SyntaxKind.ContinueStatement) {
        const child = node.getChildAt(1);
        if (child?.kind === ts.SyntaxKind.Identifier) {
          throw new Error(`continuing to a label is forbidden in Ritz, at ${this.getFullFilePosition(node)}`);
        }
        const parentLoop = this.findParentLoop(node);
        if (parentLoop) {
          (node as any)._parent_loop = parentLoop;
          if (!(parentLoop as any)._continue_sources) { (parentLoop as any)._continue_sources = []; }
          (parentLoop as any)._continue_sources.push(node);
          for (const ch of parentLoop.getChildren()) {
            if (ch.kind === ts.SyntaxKind.Block) { (ch as any)._is_continue_point = true; break; }
          }
          return ts.factory.createBlock([
            ts.factory.createExpressionStatement(ts.factory.createAwaitExpression(ts.factory.createCallExpression(
              ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('__ctxg'), '__continue'),
              [],
              ts.factory.createNodeArray<ts.Expression>([
                ts.factory.createStringLiteral(this.getFlowTrackingId(), true),
                ts.factory.createStringLiteral(this.getPosition(node), true),
                ts.factory.createIdentifier('__blk'),
              ])
            ))),
            ts.factory.createContinueStatement(),
          ]);
        }
      }

      if (
        node.kind === ts.SyntaxKind.ForOfStatement ||
        node.kind === ts.SyntaxKind.ForStatement ||
        node.kind === ts.SyntaxKind.ForInStatement ||
        node.kind === ts.SyntaxKind.WhileStatement ||
        node.kind === ts.SyntaxKind.DoStatement
      ) {
        let blockFound = false;
        for (const ch of node.getChildren()) {
          if (ch.kind === ts.SyntaxKind.Block) { blockFound = true; break; }
        }
        if (!blockFound) {
          throw new Error(`${ts.SyntaxKind[node.kind]} loop must be wrapped in a block, at ${this.getFullFilePosition(node)}`);
        }
      }

      let specialFoundInStmt: ReturnType<typeof this.findSpecialCallExpressions>;
      if (
        node.kind === ts.SyntaxKind.ExpressionStatement ||
        node.kind === ts.SyntaxKind.VariableDeclaration
      ) {
        const found = this.findSpecialCallExpressions(node);
        if (found?.length > 0) { specialFoundInStmt = found; }
      }

      // See if transform is eligible, and mark the parent block
      const transformEligible = this.ascertainTransformSubject(ritz, node);
      if (transformEligible) {
        if (transformEligible.transformableBlock) {
          (transformEligible.transformableBlock as any)._affected_by_transform = true;
        }
        const block = this.findParentBlock(transformEligible.target);
        if (block) {
          if (!(block as any)._transform_eligibles) { (block as any)._transform_eligibles = []; }
          (block as any)._transform_eligibles.push(transformEligible);
        }
      }

      const parentClosure = this.findParentBlockParentFunction(node);
      if (parentClosure) {
        if (!this.hasAsyncModifier(parentClosure) && !(parentClosure as any)._should_be_async) {
          (parentClosure as any)._should_be_async = true;
        }
        (parentClosure as any)._is_closure = true;
      }

      const arithmAssignResultStmt = this.handleArithmaticAssignmentExpand(node);
      if (arithmAssignResultStmt) {
        const block = this.findParentBlock(node);
        if (block) {
          if (!(block as any)._transform_eligibles) { (block as any)._transform_eligibles = []; }
          (block as any)._transform_eligibles.push(arithmAssignResultStmt);
        }
      }

      if (node.kind === ts.SyntaxKind.Identifier) {
        // const syncContext = !this.findParentBlock(node);
        // const asyncArg = syncContext ? ts.factory.createFalse() : ts.factory.createTrue();
        const parentIsPropNotAccess = (node as any)._node_parent?.kind !== ts.SyntaxKind.PropertyAccessExpression;
        let isUsedAsFirst = false;
        try {
          isUsedAsFirst = (node as any)._node_parent?._node_children?.[0]?.getText() === node.getText()
        } catch (e) {}
        if (parentIsPropNotAccess || isUsedAsFirst) {
          let superGlobalIden = '';
          try { superGlobalIden = node.getText(); } catch(e) {}
          if (superGlobalIden === '__context') {
            return this.attachOriginal(node, ts.factory.createCallExpression(
              ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('__ctxg'), '__get'), [],
              [ ts.factory.createFalse(), ts.factory.createIdentifier('__ctx')]
            ));
          } else if (superGlobalIden === '__block') {
            return this.attachOriginal(node, ts.factory.createCallExpression(
              ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('__ctxg'), '__get'), [],
              [ ts.factory.createFalse(), ts.factory.createIdentifier('__blk')]
            ));
          } else if (superGlobalIden === '__function') {
            return this.attachOriginal(node, ts.factory.createCallExpression(
              ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('__ctxg'), '__get'), [],
              [ ts.factory.createFalse(), ts.factory.createIdentifier('__fn')]
            ));
          } else if (superGlobalIden === '$r') {
            return this.attachOriginal(node, ts.factory.createCallExpression(
              ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('$r'), '$get'), [], []
            ));
          }
        }
      }

      // Handle import statements to get transform targets;
      const newTargetDetectedInImport = this.handleTargetCheckInImports(ritz, node);
      if (newTargetDetectedInImport) { return newTargetDetectedInImport; }

      const postVisitNode = this.handleChildNodes(ritz, node, visit);

      const specialExprInfo = this.specialCallExpressionInfo(postVisitNode);
      if (specialExprInfo) { return this.attachOriginal(node, specialExprInfo.expr); }
      if (specialFoundInStmt) {
        specialFoundInStmt = specialFoundInStmt.filter(a => (a === specialFoundInStmt.filter(b => a.word === b.word).pop()));
        if (node.kind === ts.SyntaxKind.ExpressionStatement) {
          const es = postVisitNode as ts.ExpressionStatement;
          return this.attachOriginal(node, ts.factory.createExpressionStatement(ts.factory.createAwaitExpression(ts.factory.createCallExpression(
            ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('__ctxg'), '__postfix_method'), [], [
              ts.factory.createIdentifier('__ctx'),
              ts.factory.createIdentifier('__blk'),
              ts.factory.createObjectLiteralExpression([
                ...(specialFoundInStmt.map(a => {
                  return ts.factory.createPropertyAssignment(a.word, ts.factory.createArrayLiteralExpression(a.args))
                }) as ts.PropertyAssignment[])
              ]),
              this.arrowFunctionOfBody(ts.factory.createBlock([ ts.factory.createReturnStatement(es.expression as ts.Expression) ], true))
            ]
          ))));
        } else if (node.kind === ts.SyntaxKind.VariableDeclaration) {
          const vd = postVisitNode as ts.VariableDeclaration;
          return this.attachOriginal(node, ts.factory.createVariableDeclaration(vd.name, vd.exclamationToken, vd.type, ts.factory.createAwaitExpression(ts.factory.createCallExpression(
            ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('__ctxg'), '__postfix_method'), [], [
              ts.factory.createIdentifier('__ctx'),
              ts.factory.createIdentifier('__blk'),
              ts.factory.createObjectLiteralExpression([
                ...(specialFoundInStmt.map(a => {
                  return ts.factory.createPropertyAssignment(a.word, ts.factory.createArrayLiteralExpression(a.args))
                }) as ts.PropertyAssignment[])
              ]),
              this.arrowFunctionOfBody(ts.factory.createBlock([ ts.factory.createReturnStatement(vd.initializer as ts.Expression) ], true))
            ]
          ))));
        }
      }

      if (!ritz.config.skipLoggingExecutionSteps && postVisitNode.kind === ts.SyntaxKind.IfStatement) {
        const ifStmt = postVisitNode as ts.IfStatement;
        if (this.findOriginalParent(ifStmt)?.kind === ts.SyntaxKind.IfStatement) {
          return this.attachOriginal(node, ts.factory.createIfStatement(
            ts.factory.createLogicalOr(
              ts.factory.createAwaitExpression(
                this.getLoggedExpression(true, this.getPosition(ifStmt), this.getTextFrom(ifStmt.expression, 'if (', ')'), null, 'COND'),
              ),
              ts.factory.createParenthesizedExpression(ifStmt.expression)
            ),
            ifStmt.thenStatement, ifStmt.elseStatement
          ));
        }
      }

      const arithmAssignResult = this.handleArithmaticAssignmentExpand(postVisitNode);
      if (arithmAssignResult) {
        const block = ritz.findParentBlock(postVisitNode);
        if (block) {
          if (!(block as any)._transform_eligibles) { (block as any)._transform_eligibles = []; }
          (block as any)._transform_eligibles.push(arithmAssignResult);
        }
        return arithmAssignResult;
      }

      if (this.isFunctionType(node)) {
        const asyncKeyword = this.hasAsyncModifier(node) ? [] : [ts.factory.createModifier(ts.SyntaxKind.AsyncKeyword)];
        if (node.kind === ts.SyntaxKind.ArrowFunction) {
          const af = postVisitNode as ts.ArrowFunction;
          (af.body as any)._async_affected = true;
          const newType = this.typeAsync(af.type);
          return this.attachOriginal(node, ts.factory.createArrowFunction(
            ts.getModifiers(af)?.length ? [...af.modifiers, ...asyncKeyword] : [...asyncKeyword],
            af.typeParameters, af.parameters, newType, af.equalsGreaterThanToken,
            this.getFunctionContextStatement(false, `(anonymous_${this.getFlowTrackingId()})`, af.body as ts.Block),
          ));
        } else if (node.kind === ts.SyntaxKind.FunctionDeclaration) {
          const af = postVisitNode as ts.FunctionDeclaration;
          (af.body as any)._async_affected = true;
          const newType = this.typeAsync(af.type);
          return this.attachOriginal(node, ts.factory.createFunctionDeclaration(
            ts.getModifiers(af)?.length ? [...af.modifiers, ...asyncKeyword] : [...asyncKeyword],
            af.asteriskToken, af.name, 
            af.typeParameters, this.injectOptionalContext(af.parameters), newType,
            this.getFunctionContextStatement(false, this.getTextFrom(af.name), af.body as ts.Block, true),
          ));
        } else if (node.kind === ts.SyntaxKind.FunctionExpression) {
          const af = postVisitNode as ts.FunctionExpression;
          (af.body as any)._async_affected = true;
          const newType = this.typeAsync(af.type);
          return this.attachOriginal(node, ts.factory.createFunctionExpression(
            ts.getModifiers(af)?.length ? [...af.modifiers, ...asyncKeyword] : [...asyncKeyword],
            af.asteriskToken, af.name, 
            af.typeParameters, this.injectOptionalContext(af.parameters), newType,
            this.getFunctionContextStatement(false, this.getTextFrom(af.name), af.body as ts.Block, true),
          ));
        } else if (node.kind === ts.SyntaxKind.MethodDeclaration) {
          const af = postVisitNode as ts.MethodDeclaration;
          (af.body as any)._async_affected = true;
          const newType = this.typeAsync(af.type);
          // console.log(ritz.serializeNode(ritz.getNodeChildAt(af, 0)));
          let decos = ts.getDecorators(af); if (!decos) { decos = []; }
          return this.attachOriginal(node, ts.factory.createMethodDeclaration(
            (ts.getModifiers(af)?.length > 0 ? [...decos, ...ts.getModifiers(af), ...asyncKeyword] : [...decos, ...asyncKeyword]) as readonly ts.Modifier[],
            af.asteriskToken, af.name, af.questionToken,
            af.typeParameters, this.injectOptionalContext(af.parameters), newType,
            this.getFunctionContextStatement(true, this.getTextFrom(af.name), af.body as ts.Block, true),
          ));
        }
      }

      if (postVisitNode.kind === ts.SyntaxKind.ReturnStatement) {
        const re = postVisitNode as ts.ReturnStatement;
        const stmtPos = this.getPosition(re);
        return this.attachOriginal(node, this.getReturnStatement(re.expression, stmtPos));
      }

      // Mark all statements with transform eligible elements with comment
      const newBlock = this.handleCommentsForTrasformTargetsInBlock(ritz, postVisitNode, node);
      if (newBlock) { return newBlock; }

      if (node.kind === ts.SyntaxKind.SourceFile) {
        const sf = postVisitNode as ts.SourceFile;
        const stmts: ts.Statement[] = [];
        for (const stmt of sf.statements) {
          const kindText = ts.SyntaxKind[stmt.kind];
          if (stmt.kind !== ts.SyntaxKind.EmptyStatement && stmt.kind !== ts.SyntaxKind.ImportDeclaration && (
              kindText.endsWith('Statement') ||
              kindText.endsWith('Declaration') ||
              this.isFunctionKind(stmt.kind)
          )) {
            const stmtOriginal = (stmt as any)._original ? (stmt as any)._original : stmt;
            const stmtOriText = this.getTextFrom(stmtOriginal); 
            if (stmtOriText === ';') { continue; }
            stmts.push(ts.factory.createExpressionStatement(
              this.getLoggedExpression(
                false,
                this.getPosition(stmtOriginal),
                stmtOriText,
                ts.factory.createStringLiteral(kindText, true),
                'EXPR')
            ));
          }
          stmts.push(stmt);
        }
        const newSourceFile = ts.factory.createSourceFile(stmts, sf.endOfFileToken, sf.flags);
        newSourceFile.amdDependencies = sf.amdDependencies;
        newSourceFile.fileName = sf.fileName;
        newSourceFile.hasNoDefaultLib = sf.hasNoDefaultLib;
        newSourceFile.impliedNodeFormat = sf.impliedNodeFormat;
        newSourceFile.isDeclarationFile = sf.isDeclarationFile;
        newSourceFile.languageVariant = sf.languageVariant;
        newSourceFile.languageVersion = sf.languageVersion;
        newSourceFile.libReferenceDirectives = sf.libReferenceDirectives;
        newSourceFile.moduleName = sf.moduleName;
        newSourceFile.referencedFiles = sf.referencedFiles;
        newSourceFile.text = sf.text;
        newSourceFile.typeReferenceDirectives = sf.typeReferenceDirectives;
        return newSourceFile;
      }

      return postVisitNode;
    };
    return visit;
  }
  injectOptionalContext(parameters: ts.NodeArray<ts.ParameterDeclaration>): ts.NodeArray<ts.ParameterDeclaration> {
    for (const param of parameters) {
      const paramName = param.name.getText();
      if (paramName === '__ctx' || paramName === '__ctxo') { return parameters; }
    }
    return ts.factory.createNodeArray<ts.ParameterDeclaration>([
      ...parameters,
      ts.factory.createParameterDeclaration(undefined, undefined, undefined, '__ctxo', ts.factory.createToken(ts.SyntaxKind.QuestionToken))
    ]);
  }
  handleOtherPass (ritz: Ritz) {
    const visit = (node: ts.Node): ts.Node => {
      let res;
      if (res = this.handleNodeBasic(ritz, node)) { return res; }
      if (ritz.isJSDocKind(node)) { return node; }
      if (this.checkWithinImportPath(node)) { return node; }
      if (this.handleMarkerCommand(node)) { return null; }
      this.markBlocks(node);

      const transformEligible = this.ascertainTransformSubject(ritz, node);
      if (transformEligible) { return transformEligible.shouldReturn; }

      if (node.kind === ts.SyntaxKind.ExpressionStatement) {
        let text = this.getTextFrom(node).trim();
        if (text.startsWith("'_c")) {
          const key = this.getCommentKey(text);
          return this.getCommentAnnotator(node, key, false);
        }
      }

      if (node.kind === ts.SyntaxKind.TaggedTemplateExpression) {
        const tte = node as ts.TaggedTemplateExpression;
        const childTemplateExprs = this.collectTemplateExpressions(node);
        const rootTempl: ts.Expression = (childTemplateExprs as any)._last_tagged_template_tag;
        if (rootTempl) {
          const isTargetIden = (rootTempl.kind === ts.SyntaxKind.Identifier && this.isTransformTarget(this.getTextFrom(rootTempl)));
          let isTargetExpr;
          if (!isTargetIden) {
            const accessChain = this.getAccessChain(rootTempl);
            isTargetExpr = this.isTransformTarget(this.getTextFrom(accessChain[0]));
          }
          if (isTargetIden || isTargetExpr) {
          const syncContext = !this.findParentBlock(node);
          return this.attachOriginal(node, 
                  this.wrap(ts.factory.createCallExpression(
                    rootTempl, [], [...childTemplateExprs.map(a => a.node)]
                  ), [], !syncContext, true))
          }
        }
      }

      const postVisitNode = this.handleChildNodes(ritz, node, visit);

      const decoResult = this.decoratorTransformMethodResult(ritz, postVisitNode, node);
      if (decoResult) { return decoResult; }

      const transformEligibleAfterVisit = this.ascertainTransformSubjectAfterVisit(ritz, node, postVisitNode);
      if (transformEligibleAfterVisit) { return transformEligibleAfterVisit.shouldReturn; }

      const transformedBlock = this.blockTransformableResult(node, postVisitNode);
      if (transformedBlock) { return transformedBlock; }

      // if (node.kind === ts.SyntaxKind.SourceFile) {
      //   const sf = postVisitNode as ts.SourceFile;
      //   const stmts: ts.Statement[] = [];
      //   for (const stmt of sf.statements) { stmts.push(stmt); }
      //   const newSourceFile = ts.factory.createSourceFile(stmts, sf.endOfFileToken, sf.flags);
      //   newSourceFile.amdDependencies = sf.amdDependencies;
      //   newSourceFile.fileName = sf.fileName;
      //   newSourceFile.hasNoDefaultLib = sf.hasNoDefaultLib;
      //   newSourceFile.impliedNodeFormat = sf.impliedNodeFormat;
      //   newSourceFile.isDeclarationFile = sf.isDeclarationFile;
      //   newSourceFile.languageVariant = sf.languageVariant;
      //   newSourceFile.languageVersion = sf.languageVersion;
      //   newSourceFile.libReferenceDirectives = sf.libReferenceDirectives;
      //   newSourceFile.moduleName = sf.moduleName;
      //   newSourceFile.referencedFiles = sf.referencedFiles;
      //   newSourceFile.text = sf.text;
      //   newSourceFile.typeReferenceDirectives = sf.typeReferenceDirectives;
      //   return newSourceFile;
      // }

      return postVisitNode;
    };
    return visit;
  }
  getTransformer(ritz: Ritz) {
    this.ritz = ritz;
    const transformer = <T extends ts.Node>(ctx: ts.TransformationContext) => (rootNode: T) => {
      this.transformContext = ctx;
      if (this.passNumber === 1) {
        this.visitFunction = this.handleFirstPass(ritz);
      } else {
        this.visitFunction = this.handleOtherPass(ritz);
      }
      const endNode = ts.visitNode(rootNode, this.visitFunction);
      if (this.passNumber <= 2) { this.needsAnotherPass = true; }
      return endNode;
    };
    return transformer;
  }
  private getLine(node: ts.Node, getEndingPosition = false) {
    const pos = this.getPosition(node, getEndingPosition);
    return parseInt(pos.split(':')[0], 10);
  }
  private getPosition(node: ts.Node, getEndingPosition = false) {
    if ((node as any)._original) { node = (node as any)._original; }
    const str = this.ritz.sourceFileFullText;
    let lineCount = 1;
    let lastLineAt = 0;
    let lastLineEndAt = 0;
    const targetPos = getEndingPosition ? node.end : node.pos;
    for (const lineInfo of this.ritz.sourceFileLines) {
      if (lineInfo.endAt >= targetPos) {
        lineCount = lineInfo.lineNumber;
        lastLineAt = lineInfo.startAt;
        lastLineEndAt = lineInfo.endAt;
        break;
      }
    }
    if (getEndingPosition) {
      return `${lineCount}:${node.end - lastLineAt}`;
    }
    let frontWhiteSpaces = 0;
    let withinCommentUntil = 0;
    for (let i = node.pos; i < node.end; ++i) {
      if (str[i] === undefined) { break; }
      if (str[i] === '\n') {
        ++lineCount;
        lastLineAt = i;
        frontWhiteSpaces = 0;
        continue;
      }
      if (withinCommentUntil) {
        ++frontWhiteSpaces;
        if(i >= withinCommentUntil) { withinCommentUntil = 0; }
        continue;
      }
      if (str[i].trim() !== '') {
        const commentSpot = this.ritz.sourceFileCommentStartSpots[i];
        if (commentSpot) {
          withinCommentUntil = commentSpot.end;
          ++frontWhiteSpaces;
          continue;
        } else {
          if (!withinCommentUntil) {
            if (str[i] === '/' && str[i+1] === '/') {
              withinCommentUntil = str.indexOf('\n', i);
            } else if (str[i] === '/' && str[i+1] === '*') {
              withinCommentUntil = str.indexOf('*/', i) + 2;
            }
          }
        }
        if (!withinCommentUntil) {
          ++frontWhiteSpaces;
          break;
        }
      }
      ++frontWhiteSpaces;
    }

    let lineRelpos = node.pos >= lastLineAt ? node.pos - lastLineAt : 0;
    let colum = lineRelpos + frontWhiteSpaces;
    return `${lineCount}:${colum}`;
  }
  private getFullFilePosition(node: ts.Node) {
    return `'${this.ritz.getFileContextAbsolute()}:${this.getPosition(node)}'`;
  }
  private findParentBlockParentFunction(node: ts.Node) {
    node = this.findParentBlock(node); if (!node) { return null; }
    let node2: ts.Node = (node as any)._node_parent;
    while (node2 && !this.isFunctionType(node2)) {
      node2 = (node2 as any)._node_parent;
    }
    return node2;
  }
  private findParentLoop(node: ts.Node) {
    if (!node) { return null; }
    let node2: ts.Node = (node as any)._node_parent;
    while (node2 && 
      (node2.kind !== ts.SyntaxKind.ForOfStatement &&
        node2.kind !== ts.SyntaxKind.ForStatement &&
        node2.kind !== ts.SyntaxKind.ForInStatement &&
        node2.kind !== ts.SyntaxKind.WhileStatement &&
        node2.kind !== ts.SyntaxKind.DoStatement)
    ) {
      node2 = (node2 as any)._node_parent;
    }
    return node2;
  }
  private findParentBlock(node: ts.Node) {
    let node2: ts.Node = (node as any)._node_parent;
    while (node2 && node2.kind !== ts.SyntaxKind.Block) {
      node2 = (node2 as any)._node_parent;
    }
    return node2;
  }
  private withinTypeDef(node: ts.Node) {
    let node2: ts.Node = (node as any)._node_parent;
    while (node2) {
      if (node2.kind === ts.SyntaxKind.TypeLiteral) { return true; }
      node2 = (node2 as any)._node_parent;
    }
    return false;
  }
  private isFromDecorator(node: ts.Node) {
    let node2: ts.Node = node;
    while (node2) {
      node2 = (node2 as any)._original?._node_parent ? (node2 as any)._original?._node_parent : (node2 as any)._node_parent;
      if (node2?.kind === ts.SyntaxKind.Decorator) {
        return true;
      }
      if (node2?.kind === ts.SyntaxKind.Block) {
        return false;
      }
    }
    return false;
  }
  private findFutureCollector(node: ts.Node, collectionExpr: string) {
    let node2: ts.Node = node as any;
    while (node2) {
      node2 = (node2 as any)._node_parent;
      if (node2 && node2.kind === ts.SyntaxKind.Block && (node2 as any)._future_compute_collector?.[collectionExpr]) {
        break;
      }
    }
    return (node2 as any)?._future_compute_collector;
  }
  private markBlocks(node: ts.Node) {
    if (node.kind === ts.SyntaxKind.Block) {
      (node as any)._block_id = '__ritz_blk_' + this.blockScopeCounter;
      (node as any)._block_id_num = this.blockScopeCounter;
      const blockTracker = {
        block: node as ts.Block,
        num: this.blockScopeCounter,
        parentNum: null as number,
      };
      this.unclaimedBlocks[blockTracker.num] = blockTracker;
      ++this.blockScopeCounter;
      const parentBlock = this.findParentBlock(node);
      if (parentBlock) {
        (node as any)._parent_block_id = (parentBlock as any)._block_id;
        (node as any)._parent_block_id_num = (parentBlock as any)._block_id_num;
        blockTracker.parentNum = (node as any)._parent_block_id_num;
      }
    }
  }
  private isPropertyDeclWithStringOnly(node: ts.Node) {
    return node.kind === ts.SyntaxKind.PropertyDeclaration && node.getChildAt(0)?.kind === ts.SyntaxKind.StringLiteral &&
    (node.getChildCount() === 1 || node.getChildCount() === 2 && node.getChildAt(1)?.kind === ts.SyntaxKind.SemicolonToken);
  }
  private outputAllSubnode(node: ts.Node) {
    if (!node) { return; }
    console.group(`${ts.SyntaxKind[node.kind]} :: ${this.getTextFrom(node)}`);
    node.forEachChild(ch => { this.outputAllSubnode(ch); });
    console.groupEnd();
  }
  private handleNodeBasic(ritz: Ritz, node: ts.Node): any {
    this.currentNode = node;
    (node as any)._depth = this.depth + 1;
    if (node !== this.currentNodeParent) {
      (node as any)._node_parent = this.currentNodeParent;
    }
    (node as any)._node_index = this.currentNodeIndex;
    if ((node as any)._node_parent) {
      (node as any)._node_parent._node_children[(node as any)._node_index] = node;
    }
    const areSiblings = this.prevNode !== this.currentNodeParent;
    (node as any)._prev_node = areSiblings ? this.prevNode : null;
    if (!(node as any)._node_children) { (node as any)._node_children = []; }
    if (areSiblings) { (this.prevNode as any)._next_node = node; }
    this.prevNode = node;
    ++this.currentNodeIndex;
    if (ritz.config.showDebugOutput || (ritz.nodeMarkedDescendentOutput && ritz.nodeHasAncestor(node, ritz.nodeMarkedDescendentOutput))) {
      ritz.outputNode(node);
    }
    if ((node as any)._delete_me) {
      return true;
    } else if ((node as any)._delete_me_when && (node as any)._delete_me_when()) {
      return true;
    }
    return null;
  }
  private handleCommands(command: string, ...args: string[]) {
    switch (command) {
      case 'loadRitzTarget': {
        const savedTargets = this.ritz.getCrossTransformsData(this.name, args[0]);
        if (!savedTargets) { throw new Error(`Unable to load cross transforms data key '${args[0]}'`); }
        this.transformTargetsSaved = this.transformTargets;
        this.transformTargets = this.ritz.getCrossTransformsData(this.name, args[0]);
      } break;
      case 'popRitzTarget': {
        if (this.transformTargetsSaved) { this.transformTargets = this.transformTargetsSaved; }
      } break;
    }
  }
  private handleMarkerCommand(node: ts.Node): boolean {
    if (node.kind === ts.SyntaxKind.ExpressionStatement && node.getText().trim().startsWith('__ctxg.__marker_command')) {
      const args = (node.getChildAt(0) as ts.CallExpression).arguments;
      const stringArgs = args.map(a => a.getText().slice(1, -1));
      this.handleCommands(stringArgs[0], ...stringArgs.slice(1));
      return true;
    }
    return false;
  }
  private isTransformTarget(iden: string) {
    if (iden.indexOf('.') >= 0) { iden = iden.split('.')[0]; }
    return this.transformTargets[iden] && iden.indexOf('$r') === -1 && iden.indexOf('__ctxg') === -1 && iden.indexOf('__ritz') === -1;
  }
  private shouldBeIgnored(node: ts.Node) { return (node as any)._ignore_me; }
  private checkWithinImportPath(node: ts.Node) {
    if (this.withinRitzImportPath && node.kind === ts.SyntaxKind.StringLiteral) {
      this.withinRitzImportPath = '';
    } else if (!this.withinRitzImportPath && node.kind === ts.SyntaxKind.ImportDeclaration) {
      this.withinRitzImportPath = 'yes';
      return false; // to let it iterate over its children to end it back
    }
    return this.withinRitzImportPath.length > 0;
  }
  private syncContext(node: ts.Node) {
    if (
      (node as any)._node_parent?.kind === ts.SyntaxKind.SourceFile ||
      (node as any)._original?._node_parent?.kind === ts.SyntaxKind.SourceFile
    ) {
      return true;
    }
    const parentBlock = this.findParentBlock(node);
    if (!parentBlock || (parentBlock as any)._node_parent?.kind === ts.SyntaxKind.Constructor) {
      return true;
    }
    if (this.isFromDecorator(node)) {
      return true;
    }
    return false;
  }
  private ascertainTransformSubject(ritz: Ritz, node: ts.Node): DefaultTransformTarget {
    let result: DefaultTransformTarget = null;
    if (node.kind === ts.SyntaxKind.ExpressionStatement || node.kind === ts.SyntaxKind.FirstStatement) {
      const comments = ritz.getPrecedingJSDocComments(node);
      if (comments && comments.length > 0) {
        // ritz.outputNode(comments);
        (node as any)._comments = comments;
      }
      const syncContext = this.syncContext(node);
      const nodeFirstChild = ritz.getNodeChildAt(node, 0, { noJSDoc: true });
      switch (nodeFirstChild.kind) {
        case ts.SyntaxKind.ArrowFunction: return null;
      }
      if (node.getText().endsWith(');')) {
        const block = ritz.getNextSibling(node, [ ts.SyntaxKind.EmptyStatement ]);
        if (block?.kind !== ts.SyntaxKind.Block && block?.kind !== ts.SyntaxKind.ExpressionStatement) { return null; }
        if (block.kind === ts.SyntaxKind.ExpressionStatement && ritz.getNodeChildAt(block, 0, { noJSDoc: true }).kind !== ts.SyntaxKind.ArrowFunction) { return null; }
        if (this.transformNotApplicableBlock(block)) { return null; }
        const semicolonCount = (block as any)._sibling_find_skip_count + 1;
        const nodeSecondDepthChild1 = ritz.getNodeChildAt(nodeFirstChild, 0, { noJSDoc: true });
        const nodeSecondDepthChild2 = ritz.getNodeChildAt(nodeFirstChild, 1, { noJSDoc: true });
        const nodeSecondDepthChild3 = ritz.getNodeChildAt(nodeFirstChild, 2, { noJSDoc: true });
        const nodeSecondDepthChild4 = ritz.getNodeChildAt(nodeFirstChild, 3, { noJSDoc: true });
        const nodeThirdDepthChild1 = ritz.getNodeChildAt(nodeSecondDepthChild1, 0, { noJSDoc: true });
        const nodeThirdDepthChild2 = ritz.getNodeChildAt(nodeSecondDepthChild1, 1, { noJSDoc: true });
        const nodeThirdDepthChild3 = ritz.getNodeChildAt(nodeSecondDepthChild1, 2, { noJSDoc: true });
        const nodeThirdDepthChild4 = ritz.getNodeChildAt(nodeSecondDepthChild1, 3, { noJSDoc: true });
        // console.log('1', nodeFirstChild ? ts.SyntaxKind[nodeFirstChild?.kind] : null, ritz.outputNode(nodeFirstChild));
        // console.log('2-1', nodeSecondDepthChild1 ? ts.SyntaxKind[nodeSecondDepthChild1?.kind]: null, ritz.outputNode(nodeSecondDepthChild1));
        let type = '';
        if (nodeFirstChild?.kind === ts.SyntaxKind.CallExpression) {
          type = 'standalone';
        } else if (
          nodeFirstChild?.kind === ts.SyntaxKind.BinaryExpression &&
          nodeSecondDepthChild3?.kind === ts.SyntaxKind.CallExpression
        ) {
          type = 'assignment';
        } else if (
          nodeFirstChild?.kind === ts.SyntaxKind.VariableDeclarationList
        ) {
          type = 'variable-declaration';
        } else {
          return null;
          throw new Error(`Ritz called closure transform syntax with invalid complex statements ` +
                          `(such as '${node.getText()}') in file ${this.getFullFilePosition(node)}`);
        }
        const ceFound = type !== 'variable-declaration' ?
            ritz.findScopeDescendent(node, ts.SyntaxKind.CallExpression) as ts.CallExpression
            : ritz.findScopeDescendent((nodeFirstChild as ts.VariableDeclarationList).declarations[0], ts.SyntaxKind.CallExpression) as ts.CallExpression;
        if (!ceFound) {
          // console.log('herererere')
          return null;
        }
        (block as any)._is_return_point = true;
        result = {
          type: 'default_CalledClosureTransform',
          target: node,
          subject: node,
          transformableBlock: block,
          transformBlockWith: (blockContext: ts.Block) => {
            const expr = this.wrap(ceFound, [this.arrowFunctionOfBody(blockContext)], !syncContext);
            if (type === 'standalone') {
              return ts.factory.createExpressionStatement(expr);
            } else if (type === 'assignment') {
              return ts.factory.createBinaryExpression(
                nodeSecondDepthChild1 as ts.Expression,
                ts.factory.createToken(ts.SyntaxKind.EqualsToken),
                expr
              );
            } else if (type === 'variable-declaration') {
              const vdl = nodeFirstChild as ts.VariableDeclarationList;
              const firstDecl = vdl.declarations[0];
              return ts.factory.createVariableDeclarationList([
                ts.factory.createVariableDeclaration(firstDecl.name, firstDecl.exclamationToken, firstDecl.type, expr)
              ], vdl.flags);
            }
          },
          shouldReturn: (type === 'standalone') ? comments[0] : null,
        };
      } else if (node.getText().endsWith(';')) {
        const nextNode = ritz.getNextSibling(node, [ts.SyntaxKind.EmptyStatement]);
        if (!nextNode) { return null; }
        // if (block?.kind !== ts.SyntaxKind.Block && block?.kind !== ts.SyntaxKind.ExpressionStatement) { return null; }
        // if (nextNode.kind === ts.SyntaxKind.ExpressionStatement && ritz.getNodeChildAt(nextNode, 0, { noJSDoc: true }).kind !== ts.SyntaxKind.ArrowFunction) { return null; }
        const semicolonCount = (nextNode as any)._sibling_find_skip_count + 1;
        if (nextNode?.kind === ts.SyntaxKind.Block || nextNode?.kind === ts.SyntaxKind.ExpressionStatement) {
          // const firstChildText = this.getTextFrom(nodeFirstChild);
          if (nextNode.kind === ts.SyntaxKind.ExpressionStatement && 
              ritz.getNodeChildAt(nextNode, 0, { noJSDoc: true }).kind !== ts.SyntaxKind.ArrowFunction) { return null; }
          let block  = nextNode;
          if (this.transformNotApplicableBlock(block)) { return null; }
          if (nodeFirstChild?.kind === ts.SyntaxKind.Identifier || nodeFirstChild?.kind === ts.SyntaxKind.PropertyAccessExpression) {
            // const awaitExpr = ritz.findScopeDescendent(block, ts.SyntaxKind.AwaitExpression);
            // if (awaitExpr) {
            //   throw new Error(`Ritz closure transform via identifier (such as '${node.getText()}') ` +
            //                   `with invalid await in closure (such as '${awaitExpr.getText()}') ` +
            //                   `in file ${this.getFullFilePosition(node)}`);
            // }
            let iden = nodeFirstChild;
            let idenText = iden.getText();
            if (idenText === 'should.reach.collectAll') {
              (block as any)._future_compute_collector = {
                id: this.getFlowTrackingId(),
                target: 'PropertyAccessExpression::should.reach',
                'PropertyAccessExpression::should.reach': []
              };
            }
            // if (iden.getText().indexOf('.') === -1) {
            //   iden = ritz.getIdentifierExpression(`${idenText}.call`);
            //   idenText = `${idenText}.call`;
            // }
            const ce = ts.factory.createCallExpression((iden as any), [], []);
            (ce as any)._idenName = idenText;
            (block as any)._is_return_point = true;
            result = {
              type: 'default_IdentifierClosureTransform',
              target: node,
              subject: nodeFirstChild,
              transformableBlock: block,
              transformBlockWith: (blockContext: ts.Block) => ts.factory.createExpressionStatement(
                this.wrap(ce, [this.arrowFunctionOfBody(blockContext, true, [])], !syncContext)
              ),
              shouldReturn: comments[0],
            };
          } else if (
            nodeFirstChild?.kind === ts.SyntaxKind.StringLiteral ||
            nodeFirstChild?.kind === ts.SyntaxKind.FirstTemplateToken ||
            nodeFirstChild?.kind === ts.SyntaxKind.TemplateExpression
          ) {
            const type = (nodeFirstChild?.kind === ts.SyntaxKind.StringLiteral) ?
                        'default_StaticallyCollatedClosureTransform' : 
                        'default_DynamicallyCollatedClosureTransform' ;
            const subject = nodeFirstChild as ts.Expression;
            (block as any)._is_return_point = true;
            result = {
              type,
              target: node,
              subject,
              transformableBlock: block,
              transformBlockWith: (blockContext: ts.Block) => ts.factory.createExpressionStatement(
                syncContext ? this.getCollateExpression(subject, blockContext)
                  : ts.factory.createAwaitExpression(this.getCollateExpression(subject, blockContext))
              )
            };
          } else {
            // throw new Error(`Ritz closure transform syntax with invalid complex statements ` +
            //                 `(such as '${node.getText()}') in file ${this.getFullFilePosition(node)}`);
            return null;
          }
        }
      }
    } else if (node.kind === ts.SyntaxKind.CallExpression) {
      const ce = node as ts.CallExpression;
      const nodeFirstChild = ritz.getNodeChildAt(node, 0, { noJSDoc: true });
      const callExprFuncText = nodeFirstChild.getText();
      const funcNamePath = callExprFuncText.split('.');
      const baseName = funcNamePath[0];
      const grandparentKind = (node as any)._node_parent?._node_parent?.kind;
      const syncContext = grandparentKind === ts.SyntaxKind.SourceFile;
      if (
        syncContext && ritz.config.extraGlobalWords.indexOf(baseName) >= 0 &&
        this.findOriginalParent(node)?.kind === ts.SyntaxKind.ExpressionStatement
      ) {
        let fromPropertyAccessExpr = false;
        if ((nodeFirstChild as any)?._prop_access_expr) { fromPropertyAccessExpr = true; }
        return result = {
          type: 'default_CallStatementTransform',
          target: node, subject: node,
          shouldReturn: this.wrapNonTarget(fromPropertyAccessExpr, !!ce.questionDotToken, node, ce.expression, ce.arguments, !syncContext)
        };
        // return result = {
        //   type: 'default_CallStatementTransform',
        //   target: node, subject: node,
        //   meta: { baseName, funcNamePath },
        //   shouldReturn: this.attachOriginal(node, ts.factory.createAwaitExpression(
        //     ts.factory.createParenthesizedExpression(
        //       ts.factory.createCallExpression(
        //         ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('$r'), '$set'), [],
        //         [ts.factory.createIdentifier('__blk'), ts.factory.createNull(), this.wrap(ce)]
        //       ))
        //   )),
        // };
      } else {
        // if (baseName === 'sleep') {
        //   console.log('3', baseName, this.transformTargets)
        // }
        // return result = {
        //   type: 'default_CallTransform',
        //   target: node, subject: node,
        //   meta: { baseName, funcNamePath },
        //   shouldReturn: this.attachOriginal(node, this.wrap(ce)),
        // };
      }
    }
    if (result && result.transformableBlock) {
      (node as any)._original_plus_block = result.transformableBlock;
      (result.transformableBlock as any)._transformable_by = result;
    }
    return result;
  }
  private isFlowTrackerExpression(node: ts.Expression) {
    if (node.kind === ts.SyntaxKind.CallExpression) {
      try {
        return node.getText().startsWith('__ctxg.__flow(');
      } catch (e) {}
      return false;
    }
    return false;
  }
  private getFlowTrackingId() {
    const id = this.flowControlCounter;
    ++this.flowControlCounter;
    return `${this.passNumber}_${id}`;
  }
  private ascertainTransformSubjectAfterVisit(ritz: Ritz, orignalNode: ts.Node, node: ts.Node) {
    let result: DefaultTransformTarget = null;
    if (!node) { return null; }
    const nodeFirstChild = ritz.getNodeChildAt(node, 0, { noJSDoc: true });
    const parentKind = (node as any)._original?._node_parent?.kind ?
                          (node as any)._original?._node_parent?.kind
                          : (node as any)._node_parent?.kind;
    const syncContext = this.syncContext(node);
    if (node.kind === ts.SyntaxKind.PropertyAccessExpression) {
      if (syncContext) { return null; }
      const overloadHandleResult = this.handleDotOperatorOverload(node, syncContext);
      if (overloadHandleResult) {
        return result = {
          type: 'default_DotOperatorTransform',
          target: node, subject: node,
          shouldReturn: this.attachOriginal(node, overloadHandleResult),
        };
      }
    } else if (node.kind === ts.SyntaxKind.NumericLiteral || node.kind === ts.SyntaxKind.BigIntLiteral) {
      return null;
      const parent = this.findOriginalParent(node);
      if (
        parent?.kind === ts.SyntaxKind.CallExpression &&
        this.getTextFrom(this.ritz.getNodeChildAt(parent, 0, {noJSDoc: true})).startsWith('__ctxg')
      ) { return null; }
      if (this.withinTypeDef(orignalNode)) { return null; }
      return result = {
        type: 'default_DotOperatorTransform',
        target: node, subject: node,
        shouldReturn: this.attachOriginal(node, ts.factory.createCallExpression(
          ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('__ctxg'), '__num'), [],
          [
            syncContext ? ts.factory.createFalse() : ts.factory.createTrue(),
            ts.factory.createIdentifier('__ctx'),
            ts.factory.createIdentifier('__blk'),
            node.kind === ts.SyntaxKind.NumericLiteral ?
              ts.factory.createNumericLiteral((node as ts.NumericLiteral).text) :
              ts.factory.createBigIntLiteral((node as ts.BigIntLiteral).text)
          ]))
      };
    } else if (node.kind === ts.SyntaxKind.ArrayLiteralExpression || node.kind === ts.SyntaxKind.ObjectLiteralExpression) {
      // if (node.kind === ts.SyntaxKind.ArrayLiteralExpression) {
      //   const ale = node as ts.ArrayLiteralExpression;
      //   return result = {
      //     type: 'default_DotOperatorTransform',
      //     target: node, subject: node,
      //     shouldReturn: this.attachOriginal(node, ts.factory.createArrayLiteralExpression(
      //       ale.elements.map(el => {
      //         if (el.kind === ts.SyntaxKind.num)
      //         return el;
      //       })
      //     )),
      //   };
      // } else if (node.kind === ts.SyntaxKind.ObjectLiteralExpression) {
      //   const ole = node as ts.ObjectLiteralExpression;
      // }
    } else if (node.kind === ts.SyntaxKind.ExpressionStatement) {
      let text: string = this.getTextFrom(node).trim();
      if (text.startsWith("'_c")) {
        const key = this.getCommentKey(text);
        return result = {
          type: 'default_CommentLoggingTransform',
          target: node, subject: node,
          shouldReturn: this.getCommentAnnotator(node, key, true),
        };
      }
      let accessDetails = '';
      if (nodeFirstChild.kind === ts.SyntaxKind.PropertyAccessExpression) {
        accessDetails = text.replace(';', '');
        if (accessDetails.startsWith('should.')) {
          if (accessDetails.startsWith('should.reach')) {
            const futureCollector = this.findFutureCollector(node, 'PropertyAccessExpression::should.reach');
            const collectionUid = this.getFlowTrackingId();
            futureCollector[`PropertyAccessExpression::should.reach`].push(collectionUid);
            return result = {
              type: 'default_CommentLoggingTransform',
              target: node, subject: node,
              shouldReturn: this.attachOriginal(node, 
                ts.factory.createCallExpression(
                  ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('$r'), '$set'), [],
                  [
                    ts.factory.createFalse(),
                    ts.factory.createIdentifier('__blk'),
                    ts.factory.createNull(),
                    ts.factory.createCallExpression(
                    ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('__ctxg'), '__future_collect'), [],
                    [
                      ts.factory.createIdentifier('__ctx'),
                      ts.factory.createIdentifier('__blk'),
                      ts.factory.createIdentifier('__future_collector'),
                      ts.factory.createStringLiteral(accessDetails, true),
                      ts.factory.createStringLiteral(collectionUid, true),
                    ])
                  ]
              ))
            };
          }
        }
      }
      let firstWord = text.split('.')[0];
      if (ritz.config.extraGlobalWords.indexOf(firstWord) >= 0) {
        if (nodeFirstChild.kind === ts.SyntaxKind.CallExpression) {
          const ce = nodeFirstChild as ts.CallExpression;
          if (ce.arguments.length > 0) {
            const args = ce.arguments[ce.arguments.length - 1];
            if (
              args.kind === ts.SyntaxKind.ArrayLiteralExpression &&
              (args as ts.ArrayLiteralExpression).elements.length === 4
            ) {
              const elems = (args as ts.ArrayLiteralExpression).elements;
              const lastElem = elems[elems.length - 1];
              if (
                lastElem.kind === ts.SyntaxKind.Identifier &&
                this.getTextFrom(lastElem).trim().startsWith('__blk')
              ) {
                return null;
              }
            }
          }
          return result = {
            type: 'default_FlowControlTransform',
            target: node, subject: node,
            shouldReturn: this.attachOriginal(node, ts.factory.createExpressionStatement(
              ts.factory.createAwaitExpression(
                ts.factory.createCallExpression(
                  ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('$r'), '$set'), [],
                  [
                    syncContext ? ts.factory.createFalse() : ts.factory.createTrue(),
                    ts.factory.createIdentifier('__blk'),
                    ts.factory.createNull(),
                    ts.factory.createAwaitExpression(
                    ts.factory.createCallExpression(
                      ce.expression, ce.typeArguments, [...(ce.arguments ? ce.arguments : []),
                        ts.factory.createArrayLiteralExpression([
                          ts.factory.createStringLiteral('', true),
                          ts.factory.createStringLiteral('', true),
                          ts.factory.createIdentifier('__ctx'),
                          ts.factory.createIdentifier('__blk')
                        ])
                      ]))
                  ]
                ))
            )),
          };
        }
      }
      if (!text) { return null; }
      if (!text.startsWith('__ctxg.__call(')) {
        if (
          text.startsWith('__ctxg') || text.startsWith('await __ctxg') ||
          text.startsWith('$r.set(') || text.startsWith('($r.set(') ||
          nodeFirstChild.kind === ts.SyntaxKind.AwaitExpression
        ) {
          return null;
        }
      }
      if (nodeFirstChild.kind === ts.SyntaxKind.BinaryExpression) {
        const node2 = ritz.getNodeChildAt(nodeFirstChild, 0, { noJSDoc: true });
        if (node2.kind === ts.SyntaxKind.PropertyAccessExpression) {
          const node3 = ritz.getNodeChildAt(node2, 0, { noJSDoc: true });
          if (node3.kind === ts.SyntaxKind.Identifier && (
              (node3 as ts.Identifier).text === '__ctxg' ||
              (node3 as ts.Identifier).text === '$r'
            )
            ) {
            return null;
          }
        }
      }
      if (syncContext) {
        return result = {
          type: 'default_AssignmentTransform',
          target: node, subject: node,
          shouldReturn: this.attachOriginal(node, ts.factory.createCallExpression(
              ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('$r'), '$set'), [],
              [
                syncContext ? ts.factory.createFalse() : ts.factory.createTrue(),
                ts.factory.createIdentifier('__blk'),
                ts.factory.createNull(),
                ritz.getNodeChildAt(node, 0, { noJSDoc: true }) as ts.Expression,
                ...(accessDetails ? [ ts.factory.createStringLiteral(accessDetails, true) ]: []),
              ]
            )),
        };
      } else {
        return result = {
          type: 'default_AssignmentTransform',
          target: node, subject: node,
          shouldReturn: this.attachOriginal(node, ts.factory.createAwaitExpression(
            ts.factory.createCallExpression(
              ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('$r'), '$set'), [],
              [
                syncContext ? ts.factory.createFalse() : ts.factory.createTrue(),
                ts.factory.createIdentifier('__blk'),
                ts.factory.createNull(),
                ritz.getNodeChildAt(node, 0, { noJSDoc: true }) as ts.Expression,
                ...(accessDetails ? [ ts.factory.createStringLiteral(accessDetails, true) ]: []),
              ]
            ))
          ),
        };
      }
    } else if (node.kind === ts.SyntaxKind.BinaryExpression) {
      const binExpr = node as ts.BinaryExpression;
      const opToken = binExpr.operatorToken.getText();
      if (this.isFlowTrackerExpression(binExpr.left) || this.isFlowTrackerExpression(binExpr.right)) { return null; }
      if (opToken === '=') {
        if (this.shouldBeIgnored(node)) { return null; }
        const leftExprText = this.getTextFrom(binExpr.left).trim();
        const rightExprText = this.getTextFrom(binExpr.right).trim();
        if (leftExprText.indexOf('__ctxg') >= 0 || leftExprText.indexOf('$r') >= 0) { return null; }
        if (rightExprText.indexOf('__ctxg') >= 0 || rightExprText.indexOf('$r') >= 0) { return null; }
        // redundant
        return null;
        // return result = {
        //   type: 'default_AssignmentTransform',
        //   target: node, subject: node,
        //   shouldReturn: this.attachOriginal(node, ts.factory.createAwaitExpression(
        //     ts.factory.createCallExpression(
        //       ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('$r'), '$set'), [],
        //       [binExpr]
        //     ))
        //   ),
        // };
      }
      if (this.syncOp(opToken)) {
        return result = {
          type: 'default_BinaryOperatorTransform',
          target: node, subject: node,
          shouldReturn: this.attachOriginal(node, this.getOperatorExpression(false, opToken, binExpr.left, binExpr.right)),
        };
      } else {
        return result = {
          type: 'default_BinaryOperatorTransform',
          target: node, subject: node,
          shouldReturn: this.attachOriginal(node, this.getOperatorExpression(!syncContext, opToken, binExpr.left, binExpr.right)),
        };
      }
    } else if (node.kind === ts.SyntaxKind.ElementAccessExpression) {
      const ea = node as ts.ElementAccessExpression;
      const nodeFirstChild = ritz.getNodeChildAt(node, 0, { noJSDoc: true });
      let nodeThirdChild = ritz.getNodeChildAt(node, 2, { noJSDoc: true });
      if (!nodeThirdChild) { nodeThirdChild = ritz.getNodeChildAt(node, 1, { noJSDoc: true }); }
      if (this.getTextFrom(nodeThirdChild) === '__ctx') { return null; }
      return result = {
        type: 'default_ElementAccessTransform',
        target: node, subject: node,
        shouldReturn: this.attachOriginal(node, ts.factory.createCallExpression(
          ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('__ctxg'), '__at'), [],
          [
            ts.factory.createIdentifier('__ctx'),
            ts.factory.createIdentifier('__blk'),
            ea.questionDotToken ? ts.factory.createTrue() : ts.factory.createFalse(),
            nodeFirstChild as ts.Expression,
            nodeThirdChild as ts.Expression,
          ]
        ))
      };
    } else if (node.kind === ts.SyntaxKind.AwaitExpression) {
      // const childText = this.getTextFrom(ritz.getNodeChildAt(node, 1, { noJSDoc: true })).trim();
      // if (childText.startsWith('($r.$r')) { return null; }
      if ((node as any)._node_parent?.kind === ts.SyntaxKind.ExpressionStatement) {
        let ch = ritz.getNodeChildAt(node, 1, { noJSDoc: true });
        if (!ch)  { ch = ritz.getNodeChildAt(node, 0, { noJSDoc: true }); }
        const childText = this.getTextFrom(ch).trim();
        if (childText.startsWith('__ctxg.')) {
          if (childText.startsWith('__ctxg.__flow(') ||
              childText.startsWith('__ctxg.__cmt(') ||
              childText.startsWith('__ctxg.__end_blk(') ||
              false) {
            return null;
          }
        }
        if (childText.startsWith('$r.$set(') || childText.startsWith('($r.$set(')) { return null; }
        if (!childText) {
          const callExprCh = ritz.getNodeChildAt(ch, 0, { noJSDoc: true });
          if (this.getTextFrom(callExprCh).indexOf('$r.') >= 0) {
            return null;
          }
        }
        return result = {
          type: 'default_CallStatementTransform',
          target: node, subject: node, 
          shouldReturn: this.attachOriginal(node, ts.factory.createAwaitExpression(
            ts.factory.createCallExpression(
              ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('$r'), '$set'), [],
              [
                syncContext ? ts.factory.createFalse() : ts.factory.createTrue(),
                ts.factory.createIdentifier('__blk'),
                ts.factory.createNull(),
                node as ts.AwaitExpression
              ]
            ))),
        };
      }
    } else if (node.kind === ts.SyntaxKind.VariableDeclaration) {
      if ((node as any)._node_parent?._node_parent?.kind !== ts.SyntaxKind.FirstStatement) { return null; }
      const vd = node as ts.VariableDeclaration;
      const varNameIden = ritz.getNodeChildAt(node, 0, { noJSDoc: true });
      const varNameText = this.getTextFrom(varNameIden).trim();
      if (varNameText.startsWith('__blk') || varNameText.startsWith('__ctx') || varNameText.indexOf('$r') >= 0) { return null; }
      const grandParent = this.findOriginalParent(node, 2);
      if (grandParent.kind === ts.SyntaxKind.FirstStatement && this.getTextFrom(grandParent).indexOf('declare ') >= 0) {
        return null;
      }
      if (vd.initializer) {
        const assignExprText = this.getTextFrom(vd.initializer).trim();
        if (assignExprText.startsWith('__ctxg') ||
            assignExprText.startsWith('$r.$set(') ||
            assignExprText.startsWith('($r.$set(') ||
            assignExprText.startsWith('await $r.$set(')
        ) { return null; }
        if (!assignExprText) {
          const assignExpr = ritz.getNodeChildAt(vd.initializer, 0, { noJSDoc: true });
          if (assignExpr.kind === ts.SyntaxKind.CallExpression) {
            const callExprCh = ritz.getNodeChildAt(assignExpr, 0, { noJSDoc: true });
            const callExprCh2 = ritz.getNodeChildAt(callExprCh, 0, { noJSDoc: true });
            const idenText = (callExprCh2 as ts.Identifier)?.escapedText + '';
            if (idenText.indexOf('$r') >= 0) { return null; }
          } else if (assignExpr.kind === ts.SyntaxKind.AwaitExpression) {
            const callExpr = ritz.getNodeChildAt(assignExpr, 0, { noJSDoc: true });
            if (callExpr.kind === ts.SyntaxKind.CallExpression) {
              const callExprCh = ritz.getNodeChildAt(callExpr, 0, { noJSDoc: true });
              const callExprCh2 = ritz.getNodeChildAt(callExprCh, 0, { noJSDoc: true });
              const idenText = (callExprCh2 as ts.Identifier).escapedText + '';
              if (idenText.indexOf('$r') >= 0) { return null; }
            }
          }
        }
        (vd.initializer as any)._set_transformed = true;
      }
      if (syncContext) {
        return result = {
          type: 'default_AssignmentTransform',
          target: node, subject: node,
          shouldReturn: this.attachOriginal(node, ts.factory.createVariableDeclaration(
            vd.name, vd.exclamationToken, vd.type,
              ts.factory.createCallExpression(
                ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('$r'), '$set'), [],
                [
                  syncContext ? ts.factory.createFalse() : ts.factory.createTrue(),
                  ts.factory.createIdentifier('__blk'),
                  ts.factory.createNull(),
                  vd.initializer ? vd.initializer : ts.factory.createVoidZero()]
              ))),
        };
      } else {
        return result = {
          type: 'default_AssignmentTransform',
          target: node, subject: node,
          shouldReturn: this.attachOriginal(node, ts.factory.createVariableDeclaration(
            vd.name, vd.exclamationToken, vd.type, ts.factory.createAwaitExpression(
              ts.factory.createCallExpression(
                ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('$r'), '$set'), [],
                [
                  syncContext ? ts.factory.createFalse() : ts.factory.createTrue(),
                  ts.factory.createIdentifier('__blk'),
                  ts.factory.createNull(),
                  vd.initializer ? vd.initializer : ts.factory.createVoidZero()]
              ))),
          ),
        };
      }
    } else if (
      node.kind === ts.SyntaxKind.PrefixUnaryExpression ||
      node.kind === ts.SyntaxKind.PostfixUnaryExpression
    ) { 
      const isPre = node.kind === ts.SyntaxKind.PrefixUnaryExpression;
      const isPost = node.kind === ts.SyntaxKind.PostfixUnaryExpression;
      const uexpr = node as (ts.PrefixUnaryExpression | ts.PostfixUnaryExpression);
      const uexpr2 = node as (ts.PrefixUnaryExpression | ts.PostfixUnaryExpression);
      const oper = uexpr.operator;
      let opToken =
        isPost && oper === ts.SyntaxKind.PlusPlusToken ? 'x++' :
        isPost && oper === ts.SyntaxKind.MinusMinusToken ? 'x--' :
        isPre && oper === ts.SyntaxKind.PlusPlusToken ? '++x' :
        isPre && oper === ts.SyntaxKind.MinusMinusToken ? '--x' :
        isPre && oper === ts.SyntaxKind.PlusToken ? '+x' :
        isPre && oper === ts.SyntaxKind.MinusToken ? '-x' :
        isPre && oper === ts.SyntaxKind.ExclamationToken ? '!' :
        isPre && oper === ts.SyntaxKind.TildeToken ? '~' :
        null;
      if (!opToken) { throw new Error(`Unknown unary operation with expression '${ts.SyntaxKind[uexpr.operator]}'`); }
      if (opToken === 'x++' || opToken === 'x--') {
        if ((node as any)._original?._node_parent.kind === ts.SyntaxKind.CallExpression) {
          const ce = (node as any)._original?._node_parent as ts.CallExpression;
          const ceIden = ritz.getNodeChildAt(ce.expression, 0, { noJSDoc: true });
          if (this.getTextFrom(ceIden).startsWith('__ctxg')) { return null; }
        }
        return result = {
          type: 'default_UnaryOperatorTransform',
          target: node, subject: node,
          shouldReturn: this.attachOriginal(node, this.getOperatorExpression(false, opToken, node as ts.Expression, null)),
        };
      } else {
        return result = {
          type: 'default_UnaryOperatorTransform',
          target: node, subject: node,
          shouldReturn: this.attachOriginal(node, this.getOperatorExpression(false, opToken, (node as any).operand, null)),
        };
      }
    } else if (node.kind === ts.SyntaxKind.TypeOfExpression) {
      return result = {
        type: 'default_BinaryOperatorTransform',
        target: node, subject: node,
        shouldReturn: this.attachOriginal(node, this.getOperatorExpression(!syncContext, 'typeof', (node as ts.TypeOfExpression).expression, null)),
      };
    } else if (node.kind === ts.SyntaxKind.LabeledStatement) {
      const ls = node as ts.LabeledStatement;
      const labelText = ls.label.getText();
      let nodeFirstChild = ritz.getNodeChildAt(node, 1, { noJSDoc: true });
      if (!nodeFirstChild || nodeFirstChild.kind === ts.SyntaxKind.ColonToken) {
        nodeFirstChild = ritz.getNodeChildAt(node, 2, { noJSDoc: true });
      }
      if (
        nodeFirstChild.kind === ts.SyntaxKind.ReturnStatement ||
        nodeFirstChild.kind === ts.SyntaxKind.ThrowStatement ||
        nodeFirstChild.kind === ts.SyntaxKind.ContinueStatement ||
        nodeFirstChild.kind === ts.SyntaxKind.BreakStatement
      ) {
        throw new Error(`Ritz closure transform via labeled context (such as '${this.getTextFrom(node)}') ` +
                        `cannot proceed with type '${ts.SyntaxKind[nodeFirstChild.kind]}' ` +
                        `in file ${this.getFullFilePosition(node)}`);
      }
      if (labelText === 'returns') {
        const kindText = ts.SyntaxKind[nodeFirstChild.kind];
        if (nodeFirstChild.kind === ts.SyntaxKind.ExpressionStatement) {
          const stmt = nodeFirstChild as ts.ExpressionStatement;
          return result = {
            type: 'default_LabeledClosureTransform',
            target: node, subject: node,
            shouldReturn: this.attachOriginal(node, this.getReturnStatement(stmt.expression)),
          };
        } else if (kindText.endsWith('Expression')) {
          const expr = nodeFirstChild as ts.Expression;
          return result = {
            type: 'default_LabeledClosureTransform',
            target: node, subject: node,
            shouldReturn: this.attachOriginal(node, this.getReturnStatement(expr)),
          };
        } else if (kindText.endsWith('Statement')) {
          console.warn(`Unknown '${labelText}:' clause with type ${kindText} (${this.ritz.getFileContext()})`);
        }
      } else if (labelText === 'returnBad') {
        const kindText = ts.SyntaxKind[nodeFirstChild.kind];
        if (nodeFirstChild.kind === ts.SyntaxKind.ExpressionStatement) {
          const stmt = nodeFirstChild as ts.ExpressionStatement;
          return result = {
            type: 'default_LabeledClosureTransform',
            target: node, subject: node,
            shouldReturn: this.attachOriginal(node, this.getConditionalReturnStatement(stmt.expression)),
          };
        } else if (kindText.endsWith('Expression')) {
          const expr = nodeFirstChild as ts.Expression;
          return result = {
            type: 'default_LabeledClosureTransform',
            target: node, subject: node,
            shouldReturn: this.attachOriginal(node, this.getConditionalReturnStatement(expr)),
          };
        } else if (kindText.endsWith('Statement')) {
          console.warn(`Unknown '${labelText}:' clause with type ${kindText} (${this.ritz.getFileContext()})`);
        }
      } else if (labelText === 'throwBad') {
        const kindText = ts.SyntaxKind[nodeFirstChild.kind];
        if (nodeFirstChild.kind === ts.SyntaxKind.ExpressionStatement) {
          const stmt = nodeFirstChild as ts.ExpressionStatement;
          return result = {
            type: 'default_LabeledClosureTransform',
            target: node, subject: node,
            shouldReturn: this.attachOriginal(node, this.getConditionalThrowStatement(stmt.expression)),
          };
        } else if (kindText.endsWith('Expression')) {
          const expr = nodeFirstChild as ts.Expression;
          return result = {
            type: 'default_LabeledClosureTransform',
            target: node, subject: node,
            shouldReturn: this.attachOriginal(node, this.getConditionalThrowStatement(expr)),
          };
        } else if (kindText.endsWith('Statement')) {
          console.warn(`Unknown '${labelText}:' clause with type ${kindText} (${this.ritz.getFileContext()})`);
        }
      } else if (labelText === 'throws' || labelText === 'raise' || labelText === 'raises') {
        const kindText = ts.SyntaxKind[nodeFirstChild.kind];
        if (nodeFirstChild.kind === ts.SyntaxKind.ExpressionStatement) {
          const stmt = nodeFirstChild as ts.ExpressionStatement;
          return result = {
            type: 'default_LabeledClosureTransform',
            target: node, subject: node,
            shouldReturn: this.attachOriginal(node, ts.factory.createThrowStatement(ts.factory.createAwaitExpression(ts.factory.createCallExpression(
                  ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('__ctxg'), '__throw',), [], ts.factory.createNodeArray<ts.Expression>([
                    ts.factory.createStringLiteral(this.getFlowTrackingId(), true), ts.factory.createIdentifier('__ctx'), ts.factory.createIdentifier('__blk'),
                    stmt.expression ]))))),
          };
        } else if (kindText.endsWith('Expression')) {
          const expr = nodeFirstChild as ts.Expression;
          return result = {
            type: 'default_LabeledClosureTransform',
            target: node, subject: node,
            shouldReturn: this.attachOriginal(node, ts.factory.createThrowStatement(ts.factory.createAwaitExpression(ts.factory.createCallExpression(
                  ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('__ctxg'), '__throw',), [], ts.factory.createNodeArray<ts.Expression>([
                    ts.factory.createStringLiteral(this.getFlowTrackingId(), true), ts.factory.createIdentifier('__ctx'), ts.factory.createIdentifier('__blk'),
                    expr ]))))),
          };
        } else if (kindText.endsWith('Statement')) {
          console.warn(`Unknown '${labelText}:' clause with type ${kindText} (${this.ritz.getFileContext()})`);
        }
      }
      this.ritz.namedLabeledContextsUsed[labelText] = 1;
      if (nodeFirstChild.kind === ts.SyntaxKind.Block) {
        return result = {
          type: 'default_LabeledClosureTransform',
          target: node, subject: node,
          shouldReturn: this.attachOriginal(node, this.labeledScope(labelText, nodeFirstChild as ts.Block)),
        };
      } else {
        const kindText = ts.SyntaxKind[nodeFirstChild.kind];
        if (nodeFirstChild.kind === ts.SyntaxKind.ExpressionStatement) {
          const stmt = nodeFirstChild as ts.ExpressionStatement;
          // stmt.expression
          // const stmtExpr = ritz.getNodeChildAt(stmt, 0, { noJSDoc: true });
          return result = {
            type: 'default_LabeledClosureTransform',
            target: node, subject: node,
            shouldReturn: this.attachOriginal(node, this.labeledScope(labelText, ts.factory.createBlock([
                          ts.factory.createReturnStatement(stmt.expression)], true)))
          };
        } else if (kindText.endsWith('Expression')) {
          const expr = nodeFirstChild as ts.Expression;
          return result = {
            type: 'default_LabeledClosureTransform',
            target: node, subject: node,
            shouldReturn: this.attachOriginal(node, this.labeledScope(labelText, ts.factory.createBlock([
                          ts.factory.createReturnStatement(expr)], true)))
          };
        } else if (kindText.endsWith('Statement')) {
          console.warn(`Unknown 'returns:' clause with type ${kindText} (${this.ritz.getFileContext()})`);
        }
      }
    } else if (node.kind === ts.SyntaxKind.ConditionalExpression) {
      const ce = node as ts.ConditionalExpression;
      const ceCondText = this.getTextFrom(ce.condition);
      if (ceCondText.indexOf('__ctx') >= 0) {
        return null;
      }
      return result = {
        type: 'default_TernaryOperatorTransform',
        target: node, subject: node,
        shouldReturn: this.attachOriginal(node, this.getOperatorExpression(false, '?', ce.condition, ce.whenTrue, ce.whenFalse)),
      };
    } else if (node.kind === ts.SyntaxKind.PropertyDeclaration || node.kind === ts.SyntaxKind.MethodDeclaration) {
      const prevNode = (node as any)._node_parent?._node_children?.[(node as any)._node_index - 1];
      if (prevNode && this.isPropertyDeclWithStringOnly(prevNode)) {
        const declText = prevNode.getText().slice(1,-1);
        if (declText.startsWith('__ritz_comment_')) {
          const commentKey = declText.split('__ritz_comment')[1];
          const metadataExpression = ts.factory.createStringLiteral(commentKey, true);
          const ce = ts.factory.createCallExpression(
            ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('__ctxg'), '__flow_deco'),
            [],
            ts.factory.createNodeArray<ts.Expression>([
              ts.factory.createStringLiteral(this.getFlowTrackingId(), true),
              ts.factory.createIdentifier('__ctx'),
              ts.factory.createIdentifier('__blk'),
              ts.factory.createStringLiteral('COMMENT', true),
              ts.factory.createCallExpression(
                ts.factory.createIdentifier('__ritz_get_comments_in_this_file'),
                [], ts.factory.createNodeArray<ts.Expression>([ts.factory.createStringLiteral(commentKey, true)])
              ),
              ...(metadataExpression ? [metadataExpression] : [])
            ])
          );
          let shouldReturn;
          let d: ts.PropertyDeclaration | ts.MethodDeclaration = node as any;
          const newDeco = [ts.factory.createDecorator(ce), ...(d.decorators ? d.decorators : []) ];
          if (node.kind === ts.SyntaxKind.PropertyDeclaration) {
            d = node as ts.PropertyDeclaration;
            shouldReturn = ts.factory.createPropertyDeclaration(
              newDeco, ts.getModifiers(d) as any, d.name, d.questionToken, d.type, d.initializer,
            );
          } else if (node.kind === ts.SyntaxKind.MethodDeclaration) {
            d = node as ts.MethodDeclaration;
            shouldReturn = ts.factory.createMethodDeclaration(
              newDeco, ts.getModifiers(d), d.asteriskToken, d.name, d.questionToken, d.typeParameters, d.parameters, d.type, d.body
            );
          }
          if (shouldReturn) {
            result = { type: 'default_CommentLoggingTransform', target: node, subject: node, shouldReturn };
            return result;
          }
        }
      } 
    } else if (node.kind === ts.SyntaxKind.VoidExpression) {
      const parentNode = this.findOriginalParent(node);
      const nodeFirstChild = ritz.getNodeChildAt(parentNode, 0, { noJSDoc: true });
      if (parentNode.kind === ts.SyntaxKind.CallExpression) {
        const accessChain = this.getAccessChain(nodeFirstChild);
        const baseName = this.getTextFrom(accessChain[0]);
        if (baseName === '__ctxg' || baseName === '$r') {
          return null;
        }
      }
      const ve = node as ts.VoidExpression;
      return result = {
        type: 'default_VoidOperatorTransform',
        target: node, subject: node,
        shouldReturn: this.attachOriginal(node, this.getOperatorExpression(!syncContext, 'void', ve.expression))
      };
    } else if (node.kind === ts.SyntaxKind.DeleteExpression) {
      const de = node as ts.DeleteExpression;
      const accessExpr = de.getChildAt(1);
      const targetExpr = accessExpr.getChildAt(0) as ts.Expression;
      let prop = accessExpr.getChildAt(2) as ts.Expression;
      let propText = '';
      if (prop.kind === ts.SyntaxKind.Identifier) {
        propText = (prop as ts.Identifier).getText();
        prop = ts.factory.createStringLiteral(propText, true);
      }
      return result = {
        type: 'default_DeleteOperatorTransform',
        target: node, subject: node,
        shouldReturn: this.attachOriginal(node, this.getOperatorExpression(!syncContext, 'delete', targetExpr, prop))
      };
    } else if (node.kind === ts.SyntaxKind.CallExpression) {
      const ce = node as ts.CallExpression;
      const nodeFirstChild = ritz.getNodeChildAt(ce, 0, { noJSDoc: true });
      const accessChain = this.getAccessChain(nodeFirstChild);
      const baseName = this.getTextFrom(accessChain[0]);
      let fromPropertyAccessExpr = false;
      if ((nodeFirstChild as any)?._prop_access_expr) { fromPropertyAccessExpr = true; }
      if (baseName === '$r' || baseName === '__ctxg') { return null; }
      if (this.isFromDecorator(node)) { return null; }
      if (!this.isTransformTarget(baseName)) {
        return result = {
          type: 'default_NonTargetCallTransform',
          target: node, subject: node,
          shouldReturn: this.wrapNonTarget(fromPropertyAccessExpr, !!ce.questionDotToken, node, ce.expression, ce.arguments, !syncContext),
        };
      }
      if (this.isTransformTarget(baseName)) {
        if (this.findOriginalParent(node).kind === ts.SyntaxKind.ExpressionStatement) {
          return result = {
            type: 'default_CallStatementTransform',
            target: node, subject: node,
            meta: { baseName },
            shouldReturn: this.attachOriginal(node, ts.factory.createAwaitExpression(
              ts.factory.createParenthesizedExpression(
                ts.factory.createCallExpression(
                  ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('$r'), '$set'), [],
                  [
                    syncContext ? ts.factory.createFalse() : ts.factory.createTrue(),
                    ts.factory.createIdentifier('__blk'),
                    ts.factory.createNull(),
                    this.wrap(ce, [], !syncContext)
                  ]
                ))
            )),
          };
        } else {
          return result = {
            type: 'default_CallTransform',
            target: node, subject: node,
            meta: { baseName },
            shouldReturn: this.attachOriginal(node, this.wrap(ce, [], !syncContext)),
          };
        }
      }
    }
    return result;
  }
  private attachOriginal<T>(node: ts.Node, final: T, ignoreMe = false) {
    if (!(final as any)._original) {
      (final as any)._original = node;
    }
    if (ignoreMe) {
      (final as any)._ignore_me = true;
    }
    return final;
  }
  private handleArithmaticAssignmentExpand(node: ts.Node) {
    if (node.kind === ts.SyntaxKind.BinaryExpression) {
      try {
        const binExpr = node as ts.BinaryExpression;
        const op = this.getTextFrom(binExpr.getChildAt(1));
        const left = binExpr.getChildAt(0) as ts.Expression;
        const right = binExpr.getChildAt(2) as ts.Expression;
        switch (op) {
          case '+=': return ts.factory.createBinaryExpression(
            left, ts.factory.createToken(ts.SyntaxKind.EqualsToken),
            ts.factory.createParenthesizedExpression(ts.factory.createBinaryExpression(left, ts.factory.createToken(ts.SyntaxKind.PlusToken), right))
          );
          case '-=': return ts.factory.createBinaryExpression(
            left, ts.factory.createToken(ts.SyntaxKind.EqualsToken),
            ts.factory.createParenthesizedExpression(ts.factory.createBinaryExpression(left, ts.factory.createToken(ts.SyntaxKind.MinusToken), right))
          );
          case '*=': return ts.factory.createBinaryExpression(
            left, ts.factory.createToken(ts.SyntaxKind.EqualsToken),
            ts.factory.createParenthesizedExpression(ts.factory.createBinaryExpression(left, ts.factory.createToken(ts.SyntaxKind.AsteriskToken), right))
          );
          case '/=': return ts.factory.createBinaryExpression(
            left, ts.factory.createToken(ts.SyntaxKind.EqualsToken),
            ts.factory.createParenthesizedExpression(ts.factory.createBinaryExpression(left, ts.factory.createToken(ts.SyntaxKind.SlashToken), right))
          );
          case '%=': return ts.factory.createBinaryExpression(
            left, ts.factory.createToken(ts.SyntaxKind.EqualsToken),
            ts.factory.createParenthesizedExpression(ts.factory.createBinaryExpression(left, ts.factory.createToken(ts.SyntaxKind.PercentToken), right))
          );
          case '**=': return ts.factory.createBinaryExpression(
            left, ts.factory.createToken(ts.SyntaxKind.EqualsToken),
            ts.factory.createParenthesizedExpression(ts.factory.createBinaryExpression(left, ts.factory.createToken(ts.SyntaxKind.AsteriskAsteriskToken), right))
          );
        }
      } catch (e) {
        
      }
    } else if (node.kind === ts.SyntaxKind.PrefixUnaryExpression) {
      const pu = node as ts.PrefixUnaryExpression;
      if (
        pu.operator === 45 || // ++X token
        pu.operator === 46 // --x token
      ) {
        const left = pu.getChildAt(1) as ts.Expression;
        return ts.factory.createBinaryExpression(left, ts.factory.createToken(ts.SyntaxKind.EqualsToken), pu);
      }
    }
    return null;
  }
  private handleTargetCheckInImports(ritz: Ritz, node: ts.Node): ts.Node {
    if (this.withinRitzImportPath) {
      switch (node.kind) {
        case ts.SyntaxKind.ImportSpecifier:
          const orignalName = node.getChildAt(0).getText();
          const importedNameIden = node.getChildAt(node.getChildCount() - 1) as ts.Identifier;
          const idenText = importedNameIden.getText();
          if (idenText) {
            this.transformTargets[idenText] = this.withinRitzImportPath;
            if (!this.transformTargetsBySource[this.withinRitzImportPath]){
              this.transformTargetsBySource[this.withinRitzImportPath] = [];
            }
            this.transformTargetsBySource[this.withinRitzImportPath].push(idenText);
            return ts.factory.createImportSpecifier(
              false,
              ts.factory.createIdentifier(orignalName + '__'),
              importedNameIden
            );
          }
          break;
        case ts.SyntaxKind.StringLiteral:
          const newPath = this.withinRitzImportPath
                              .replace(`/ritz.${this.name}`, '')
                              .replace(`.ritz.${this.name}`, '');
          this.withinRitzImportPath = '';
          return ts.factory.createStringLiteral(newPath, true);
      }
    } else {
      switch (node.kind) {
        case ts.SyntaxKind.ImportDeclaration:
          const srcPath = ritz.transformativeImportSource(node, this.name);
          if (srcPath) {
            this.withinRitzImportPath = srcPath;
          }
          break;
      }
    }
    return null;
  }
  private handleCommentsForTrasformTargetsInBlock(ritz: Ritz, node: ts.Node, originalNode: ts.Node) {
    let transformAffected = false;
    if (node !== originalNode) {
      (node as any)._transform_eligibles = (originalNode as any)._transform_eligibles;
      transformAffected = true;
    }
    if (node.kind !== ts.SyntaxKind.Block) {
      return null;
    }
    if ((node as any)._node_parent?.kind === ts.SyntaxKind.Constructor || 
      (originalNode as any)._node_parent?.kind === ts.SyntaxKind.Constructor) {
      return null;
    }
    const block = node as ts.Block;
    const statementsInSameLine: ts.Statement[] = [];
    const blockScopeHandle = this.blockScopeStatement(block);
    const newStatements: ts.Statement[] = transformAffected ? [] : [
      blockScopeHandle.statement,
      blockScopeHandle.blockAssignStatment,
      ...(blockScopeHandle.futureComputeCollectorStatement ? [blockScopeHandle.futureComputeCollectorStatement] : []),
    ];
    let lineAt = 0;
    for (const statement of block.statements) {
      const originalStmt = (statement as any)._original ? (statement as any)._original : statement;
      const thisStmtLineNumber = this.getLine(originalStmt);
      // if (thisStmtLineNumber === lineAt) {
      //   statementsInSameLine.push(statement);
      //   continue;
      // }
      this.handleStatementsInSameLine(block, statementsInSameLine, newStatements);
      statementsInSameLine.length = 0;
      statementsInSameLine.push(statement);
      lineAt = thisStmtLineNumber;
    }
    if (statementsInSameLine.length) {
      this.handleStatementsInSameLine(block, statementsInSameLine, newStatements);
    }
    return this.wrapTryCatch(ts.factory.createBlock(newStatements, true), blockScopeHandle, transformAffected);  
    // if (transformAffected) {
    //   return this.wrapTryCatch(ts.factory.createBlock(newStatements, true), blockScopeHandle);  
    // } else {
    //   newStatements.push(blockScopeHandle.endStatement);  
    //   return ts.factory.createBlock(newStatements, true);
    // }
  }
  private handleStatementsInSameLine(sourceBlock: ts.Block, statementsInSameLine: ts.Statement[], newStatements: ts.Statement[]) {
    if (!statementsInSameLine.length) { return; }
    let stmtLineTexts: string[] = [];
    const metadata = [];
    for (const stmt of statementsInSameLine) {
      const blockAffected = (stmt as any).affected_by_transform || (stmt as any)._original?._affected_by_transform;
      let stmtText = this.getTextFrom(stmt);  
      if (!stmtText && (stmt as any)._original) { stmtText = (stmt as any)._original.getText(); }
      if ((stmt as any)._original_plus_block) { stmtText += ' ' + (stmt as any)._original_plus_block.getText(); }
      if (!this.ritz.config.skipLoggingExecutionSteps && !blockAffected &&
          stmtText && stmtText.indexOf('__ritz_') === -1 && stmtText.indexOf('__ctxg.') === -1) {
          stmtLineTexts.push(stmtText);
      }
      if (stmt.kind !== ts.SyntaxKind.Block && stmt.kind !== ts.SyntaxKind.ArrowFunction) {
        metadata.push(ts.SyntaxKind[stmt.kind]);
      }
    }
    const metadataNode = statementsInSameLine.length <= 1 ? null : ts.factory.createArrayLiteralExpression(
      metadata.map(kindText => ts.factory.createStringLiteral(kindText, true))
    )
    const firstStmt = statementsInSameLine[0];
    const blockAffected = (firstStmt as any)._affected_by_transform || (firstStmt as any)._original?._affected_by_transform;
    const stmtTextsAll = stmtLineTexts.join(' ')
    if (!this.ritz.config.skipLoggingExecutionSteps && !blockAffected && stmtTextsAll &&
      stmtTextsAll !== ';' && stmtTextsAll.indexOf('__ritz_') === -1 && stmtTextsAll.indexOf('__ctxg.') === -1) {
      const blockParent = this.findOriginalParent(sourceBlock);
      const blockParentLocation = this.getFullFilePosition(blockParent);
      // if (blockParent.kind === ts.SyntaxKind.ArrowFunction) {
      //   const p = blockParent as ts.ArrowFunction;
      //   if (!p.modifiers || p.modifiers.filter(md => md.kind === ts.SyntaxKind.AsyncKeyword).length === 0) {
      //     throw new Error(`Missing 'async' keyword in 'ArrowFunction' declared at ${blockParentLocation}`);
      //   }
      // } else if (blockParent.kind === ts.SyntaxKind.FunctionDeclaration) {
      //   const p = blockParent as ts.FunctionDeclaration;
      //   if (!p.modifiers || p.modifiers.filter(md => md.kind === ts.SyntaxKind.AsyncKeyword).length === 0) {
      //     throw new Error(`Missing 'async' keyword in 'FunctionDeclaration' at ${blockParentLocation}`);
      //   }
      // } else if (blockParent.kind === ts.SyntaxKind.MethodDeclaration) {
      //   const p = blockParent as ts.MethodDeclaration;
      //   if (!p.modifiers || p.modifiers.filter(md => md.kind === ts.SyntaxKind.AsyncKeyword).length === 0) {
      //     throw new Error(`Missing 'async' keyword in 'MethodDeclaration' at ${blockParentLocation}`);
      //   }
      // }
      newStatements.push(this.getLoggedStatement(true, statementsInSameLine[0], stmtTextsAll, metadataNode));
    }
    for (const stmt of statementsInSameLine) {
      if (stmt.pos >= 0) {
        let text = ''; try { text = stmt.getText().slice(0, 100) } catch (e) {}
      }
      newStatements.push(stmt);
    }
  }
  private getTextFrom(node: ts.Node, prepend: string = '', append: string = '') {
    if (!node) { return ''; }
    let text = '';
    try {
      if ((node as any).text) { return (node as any).text; }
      text = node.getText();
      if (!text) { text = node.getFullText(); }
      return `${prepend}${text}${append}`;
    } catch (e) {
      const ori = (node as any)._original ? (node as any)._original : node;
      if (ori.pos >= 0) {
        text = this.ritz.getFileOriginalContent().slice(ori.pos, ori.end).trim();
      }
      const expr = (node as any).expression;
      if (expr) {
        switch (node.kind) {
          case ts.SyntaxKind.ReturnStatement: {
            return `return ${this.getTextFrom(expr, prepend, append)}`;
          }
          case ts.SyntaxKind.ForInStatement: {
            const fis = node as ts.ForInStatement;
            return `${prepend}${text}${append}`;
          }
          case ts.SyntaxKind.ForOfStatement: {
            const fos = node as ts.ForOfStatement;
            return `${prepend}${text}${append}`;
          }
        }
      }
      switch (node.kind) {
        case ts.SyntaxKind.IfStatement: {
          text = this.ritz.getFileOriginalContent().slice(ori.pos, ori.end).trim();
          return `${prepend}${text}${append}`;
        }
      }
      text = (node as any).escapedText;
    }
    if (!text) { text = ''; }
    return '';
  }
  private getLoggedStatement(async: boolean, statement: ts.Statement, stmtText: string, metadataNode?: ts.Expression) {
    const statementPos = this.getPosition(statement);
    return ts.factory.createExpressionStatement(
      ts.factory.createAwaitExpression(this.getLoggedExpression(async, statementPos, stmtText, metadataNode)),
    );
  }
  private getLoggedExpression(async: boolean, position: string, expr: string, metadataNode?: ts.Expression, flowType = 'EXPR') {
    const ce = ts.factory.createCallExpression(
      ts.factory.createPropertyAccessExpression(
        ts.factory.createIdentifier('__ctxg'), '__flow',
      ),
      [],
      [
        async ? ts.factory.createTrue() : ts.factory.createFalse(),
        ts.factory.createStringLiteral(this.getFlowTrackingId(), true),
        ts.factory.createStringLiteral(position, true),
        ts.factory.createIdentifier('__ctx'),
        ts.factory.createIdentifier('__blk'),
        ts.factory.createStringLiteral(flowType, true),
        ts.factory.createStringLiteral(this.restoreComments(expr), true),
        ...(metadataNode ? [metadataNode] : [])
      ]
    );
    (ce as any)._is_flow_tracker = { expression: expr };
    return ce;
  }
  private handleRitzReflectMember(ritz: Ritz, node: ts.Node, originalDecorator: ts.Decorator) {
    if (node.kind !== ts.SyntaxKind.MethodDeclaration) { return null; }
    if (this.getTextFrom(originalDecorator).indexOf('__ritz_reflect(') >= 0) { return null; }
    const md = node as ts.MethodDeclaration;
    // ritz.markNodeForDescendentsOutput(md.decorators[0]);
    // return null;
    const callIden = ts.getDecorators(md)[0].getChildAt(1);
    const allInfo = [
      ts.factory.createTrue(),
      ts.factory.createStringLiteral('member'),
      ts.factory.createStringLiteral(md.name.getText()),
      md.parameters ? ts.factory.createArrayLiteralExpression([
        ts.factory.createObjectLiteralExpression(
          md.parameters.map(param => {
            return ts.factory.createPropertyAssignment(
              param.name.getText(),
              ts.factory.createObjectLiteralExpression(
                [
                  ts.factory.createPropertyAssignment('name', ts.factory.createStringLiteral(param.name.getText())),
                  ...(ts.getDecorators(param).length ? [ts.factory.createPropertyAssignment('decorators', ts.factory.createArrayLiteralExpression(
                    ts.getDecorators(param).map(deco => ts.factory.createObjectLiteralExpression(
                      [ts.factory.createPropertyAssignment('expression', ts.factory.createStringLiteral(deco.getText()))],
                      true
                    ))
                  ))] : []),
                  ts.factory.createPropertyAssignment('spread', param.dotDotDotToken ? ts.factory.createTrue() : ts.factory.createFalse()),
                  ts.factory.createPropertyAssignment('optional', param.questionToken ? ts.factory.createTrue() : ts.factory.createFalse()),
                  ts.factory.createPropertyAssignment('initializer', param.initializer ? ts.factory.createStringLiteral(param.initializer.getText()) : ts.factory.createNull()),
                  ts.factory.createPropertyAssignment('type', param.type ? ts.factory.createObjectLiteralExpression(
                      [ts.factory.createPropertyAssignment('expression', ts.factory.createStringLiteral(param.type.getText()))],
                      true
                    )
                    : ts.factory.createNull()
                  ),
                ],
                true
              ),
            )
          }), true),
      ]) : ts.factory.createNull(),
    ];
    // const params = md.parameters ? [ts.factory.createArrayLiteralExpression([
    //   ts.factory.createObjectLiteralExpression(
    //     md.parameters.map(param => {
    //       return ts.factory.createPropertyAssignment(
    //         param.getChildAt(0).getText(),
    //         ts.factory.createStringLiteral(param.getChildAt(2).getText()),
    //       )
    //     }), true),
    // ])] : [];
    return ts.factory.createMethodDeclaration(
      [
        ts.factory.createDecorator(
          ts.factory.createCallExpression(
            callIden as ts.Expression,
            [],
            allInfo,
          )
        )
      ],
      ts.getModifiers(md),
      md.asteriskToken,
      md.name,
      md.questionToken,
      md.typeParameters,
      md.parameters,
      md.type,
      md.body,
    );
  }
  private hasAsyncModifier(node: ts.Node) {
    const modifiers = (node as any).modifiers as ts.ModifiersArray;
    let hasAsync = false;
    if (modifiers) {
      for (const modifier of modifiers) {
        if (modifier.kind === ts.SyntaxKind.AsyncKeyword) {
          hasAsync = true;
          break;
        }
      }
    }
    return hasAsync;
  }
  private decoratorTransformMethodResult(ritz: Ritz, node: ts.Node, nodeOriginal: ts.Node): ts.Node {
    if (node.kind !== ts.SyntaxKind.MethodDeclaration) { return null; }
    const md = node as ts.MethodDeclaration;
    const hasAsync = this.hasAsyncModifier(md);
    const prevModifiers = [ ...(ts.getModifiers(md)?.length ? ts.getModifiers(md) : []) ];
    // if (hasAsync) { return null; } // no need (already async)
    if (ts.getDecorators(md)) {
      // console.log(ts.getModifiers(md));
      const varKey = ritz.setCrossTransformsData(this.name, null, this.transformTargets);
      for (const decorator of ts.getDecorators(md)) {
        const decoName = this.getTextFrom(ritz.getNodeChildAt(decorator, 1, { noJSDoc: true })).split('(')[0];
        // console.log(decoName);
        if (decoName === '__ritz_reflect') {
          const res = this.handleRitzReflectMember(ritz, node, decorator);
          if (res) { return res; }
        }
        if (this.isTransformTarget(decoName)) {
          // this.needsAnotherPass = true;
          const decoratorCe = (decorator as any)._node_children[0]; //ritz.getNodeChildAt(decorator, 0, { noJSDoc: true });
          const decoratorCeArgs = (decoratorCe as any)._node_children[1];
          const args = decoratorCeArgs ? [decoratorCeArgs as ts.Expression] : [];
          const ce = ts.factory.createCallExpression(ts.factory.createIdentifier(decoName), [], [...args]);
          (ce as any)._idenName = decoName;
          // const blockScopeHandle = this.blockScopeStatement(md.body);
          (md.body as any)._is_return_point = true;
          const contextChooserStatement = this.getMemberContextStatement();
          const newWrappedStatement = ts.factory.createReturnStatement(
            this.wrap(ce, [
              ...(args.length === 0 ? [ts.factory.createStringLiteral(md.name.getText())] : []),
              this.arrowFunctionOfBody(ts.factory.createBlock(md.body.statements.slice(1), true)),
            ]),
          );
          const decoRest = ts.getDecorators(md)
                          //.filter(deco => deco !== decorator);
          const newMd = ts.factory.createMethodDeclaration(
            [ ...decoRest, ...prevModifiers, ...(hasAsync ? [] : [ts.factory.createModifier(ts.SyntaxKind.AsyncKeyword)]) ] as readonly ts.Modifier[],
            md.asteriskToken,
            md.name,
            md.questionToken,
            md.typeParameters,
            [
              ...(md.parameters ? md.parameters : []),
              // ts.factory.createParameterDeclaration(undefined, undefined, undefined, '__ctx'),
            ],
            md.type,
            ts.factory.createBlock([
              // blockScopeHandle.statement,
              // blockScopeHandle.blockAssignStatment,
              // ts.factory.createVariableDeclaration(),
              contextChooserStatement,
              newWrappedStatement,
              // blockScopeHandle.endStatement,
            ], true),
            // this.blockWithCommand(md.body,
            //   {
            //     scopeStartCommand: ['loadRitzTarget', varKey],
            //     scopeEndCommand: ['popRitzTarget'],
            //   }
            // ),
          );
          return newMd;
        }
      }
    }
    return null;
  }
  private handleDotOperatorOverload(node: ts.Node, syncContext: boolean): ts.Node {
    if (node.kind === ts.SyntaxKind.PropertyAccessExpression) {
      const parentNode = this.findOriginalParent(node);
      const parentkind = parentNode?.kind;
      if (
        parentkind === ts.SyntaxKind.PropertyAccessExpression ||
        parentkind === ts.SyntaxKind.VariableDeclaration ||
        parentkind === ts.SyntaxKind.BinaryExpression ||
        parentkind === ts.SyntaxKind.DeleteExpression ||
        parentkind === ts.SyntaxKind.PrefixUnaryExpression ||
        parentkind === ts.SyntaxKind.PostfixUnaryExpression
      ) {
        return null;
      }
      const accessChain = this.getAccessChain(node);
      const accessChainNonBase = accessChain.slice(1).filter(a => a);
      const accessChainRest: ts.Expression[] = [];
      const idenTexts: string[] = [];
      for (const elem of accessChainNonBase) {
        if ((elem as any)._has_question_mark) {
          accessChainRest.push(ts.factory.createTrue());
        }
        if (elem.kind === ts.SyntaxKind.Identifier) {
          // accessChainRest.push(ts.factory.createTrue());
          const idenText = (elem as ts.Identifier).text;
          idenTexts.push(idenText);
          accessChainRest.push(ts.factory.createStringLiteral(idenText, true));
        } else {
          // accessChainRest.push(ts.factory.createFalse());
          accessChainRest.push(elem);
        }
      }
      if (parentkind === ts.SyntaxKind.CallExpression) {
        const lastPropText = this.getTextFrom(accessChain[accessChain.length - 1]);
        if (this.ritz.config.extraPostfixMethods.indexOf(lastPropText) >= 0) {
          const pn = parentNode as ts.CallExpression;
          const parentNodeFirstChild = this.ritz.getNodeChildAt(parentNode, 0, { noJSDoc: true});
          if (parentNodeFirstChild === accessChain[0]) {
            return null;
          }
        }
      }
      const baseName = this.getTextFrom(accessChain[0]);
      if (baseName === '__fn' || baseName === '$r' || baseName ===  '__ctxg' || this.isTransformTarget(baseName) ||
          this.ritz.config.extraGlobalWords.indexOf(baseName) >= 0 ||
          propertyAccessBannedRoots.indexOf(baseName) >= 0) {
          return null;
      }
      if (parentkind === ts.SyntaxKind.ExpressionStatement) {
        const coreCe = ts.factory.createCallExpression(
              ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('$r'), '$set'), [],
              [
                syncContext ? ts.factory.createFalse() : ts.factory.createTrue(),
                ts.factory.createIdentifier('__blk'),
                ts.factory.createNull(),
                this.wrapAccess(node, accessChain[0], accessChainRest, false)
              ]
            );
        if (syncContext) {
          return this.attachOriginal(node, coreCe);
        } else {
          return this.attachOriginal(node, ts.factory.createAwaitExpression(coreCe));
        }
      } else {
        return this.wrapAccess(node, accessChain[0], accessChainRest, false);
      }
      // const baseExpr = this.ritz.getNodeChildAt(node, 0, { noJSDoc: true });
      // const accessExpr = this.ritz.getNodeChildAt(node, 2, { noJSDoc: true });
      // try { node.getChildAt(2); } catch (e) { return null; }
      // let propText = '';
      // try { propText = node.getChildAt(2)?.getText(); } catch (e) { return null; }
      // if (this.findOriginalParent(node, 1)?.kind === ts.SyntaxKind.DeleteExpression) { return null; }
      // for (const matcher of this.ritz.config.extraOverloadables) {
      //   if (
      //     (typeof matcher === 'string' && propText === matcher) ||
      //     (typeof matcher !== 'string' && matcher(this.ritz, this, node))
      //   ) {
      //     if (propText === matcher) {
      //       return this.getOperatorExpression(syncContext, propText, node.getChildAt(0) as ts.Expression);
      //     }
      //   }
      // }
    }
    return null;
  }
  private getOperatorExpression<T extends ts.Expression>(async: boolean, operator: string, a0?:T, a1?:T, a2?:T, a3?:T, a4?:T, a5?:T, a6?:T, a7?:T, a8?:T, a9?:T) {
    const ce = ts.factory.createCallExpression(
      ts.factory.createPropertyAccessExpression(
        ts.factory.createIdentifier('__ctxg'), '__op',
      ),
      [],
      ts.factory.createNodeArray<ts.Expression>([
        ts.factory.createIdentifier('__ctx'),
        ts.factory.createIdentifier('__blk'),
        ts.factory.createStringLiteral(operator),
        ...(a0 ? [a0] : []),
        ...(a1 ? [a1] : []),
        ...(a2 ? [a2] : []),
        ...(a3 ? [a3] : []),
        ...(a4 ? [a4] : []),
        ...(a5 ? [a5] : []),
        ...(a6 ? [a6] : []),
        ...(a7 ? [a7] : []),
        ...(a8 ? [a8] : []),
        ...(a9 ? [a9] : []),
      ]),
    );
    if (async) {
      return ts.factory.createAwaitExpression(ce);
    } else {
      return ce;
    }
  }
  private labeledScope(labelText: string, block: ts.Block) {
    return ts.factory.createAwaitExpression(
      ts.factory.createCallExpression(
        ts.factory.createPropertyAccessExpression(
          ts.factory.createIdentifier('__ctxg'), '__lbl',
        ),
        [],
        ts.factory.createNodeArray<ts.Expression>([
          ts.factory.createIdentifier('__ctx'),
          ts.factory.createIdentifier('__blk'),
          ts.factory.createStringLiteral(labelText, true),
          this.arrowFunctionOfBody(block),
        ])
      )
    );
  }
  private wrapTryCatch(blockOrExpr: ts.Block | ts.ConciseBody, blockMeta?: typeof this.blockMeta, transformAffected = false) {
    if (blockOrExpr.kind !== ts.SyntaxKind.Block) {
      blockOrExpr = ts.factory.createBlock([ts.factory.createReturnStatement(blockOrExpr)], true);
    }
    let block = blockOrExpr as ts.Block;
    if ((block.statements[0] as any).__block_wrap_stmt) {
      block = ts.factory.createBlock(block.statements.filter(a => !(a as any).__block_wrap_stmt));
    }
    const newBlock = ts.factory.createBlock(
      [
        blockMeta.returnRegisterStatement,
        blockMeta.statement,
        blockMeta.blockAssignStatment,
        ...(blockMeta.futureComputeCollectorStatement ? [blockMeta.futureComputeCollectorStatement] : []),
        ts.factory.createTryStatement(block, ts.factory.createCatchClause('__e', ts.factory.createBlock([
          ts.factory.createThrowStatement(
            ts.factory.createAwaitExpression(
              ts.factory.createCallExpression(
                ts.factory.createPropertyAccessExpression(
                  ts.factory.createIdentifier('__ctxg'), '__throw',
                ),
                [],
                ts.factory.createNodeArray<ts.Expression>([
                  ts.factory.createStringLiteral(this.getFlowTrackingId(), true),
                  ts.factory.createIdentifier('__ctx'),
                  ts.factory.createIdentifier('__blk'),
                  ts.factory.createIdentifier('__e'),
                ])
              )
            )
          )
        ])), undefined),
        blockMeta.endStatement
      ]
    );
    return newBlock;
  }
  private wrap(ce: ts.CallExpression | string, trailingArguments: ts.Node[] = [], async = true, fromTaggedTemplate = false) {
    const ceIsString = typeof ce === 'string';
    const ceExprText = ceIsString ? ce
                        : (ce as any)._idenName ? (ce as any)._idenName
                        : ce.expression.getText();
    const ceExpression = this.ritz.getIdentifierExpression(ceExprText);
    let metaCtxExpr = null;
    const asyncExpr = async ? ts.factory.createTrue() : ts.factory.createFalse();
    if (fromTaggedTemplate) {
      metaCtxExpr = ts.factory.createObjectLiteralExpression([
        ts.factory.createPropertyAssignment('async', asyncExpr),
        ts.factory.createPropertyAssignment('fromTaggedTemplate', ts.factory.createTrue()),
      ], false);
    } else {
      metaCtxExpr = asyncExpr;
    }
    const ce2 = ts.factory.createCallExpression(
      ts.factory.createPropertyAccessExpression(
        ts.factory.createIdentifier('__ctxg'), '__$',
      ),
      [],
      ts.factory.createNodeArray<ts.Expression>([
        metaCtxExpr,
        ts.factory.createIdentifier('__ctx'),
        ts.factory.createIdentifier('__blk'),
        ceExpression,
        ts.factory.createStringLiteral(ceExprText),
        ...(ceIsString ? [] : ce.arguments),
        ...trailingArguments as any[]
      ])
    );
    if (async) {
      return ts.factory.createAwaitExpression(ce2);  
    } else {
      return ce2;
    }
  }
  private arrowFunctionOfBody(body: ts.Block, async = true, parameters: ts.ParameterDeclaration[] = [], noContext = false) {
    const modifiers = [];
    if (async) { modifiers.push(ts.factory.createModifier(ts.SyntaxKind.AsyncKeyword)); }
    const af = ts.factory.createArrowFunction(
      modifiers,
      [],
      [
        ...(!noContext ? [ts.factory.createParameterDeclaration(undefined, undefined, undefined, '__ctx')] : []),
        ...parameters
      ],
      null,
      ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
      body,
    );
    return af;
  }
  private blockTransformableResult(node: ts.Node, postVisitNode: ts.Node) {
    if (!(node as any)._transformable_by) { return null; }
    if (node.kind === ts.SyntaxKind.Block) {
      const tfInfo: DefaultTransformTarget = (node as any)._transformable_by;
      if (!tfInfo?.transformBlockWith) { return null; }
      const blockContent = postVisitNode as ts.Block;
      return tfInfo.transformBlockWith(blockContent);  
    } else if(node.kind === ts.SyntaxKind.ExpressionStatement) {
      const tfInfo: DefaultTransformTarget = (node as any)._transformable_by;
      if (!tfInfo?.transformBlockWith) { return null; }
      const blockContent = (this.ritz.getNodeChildAt(postVisitNode, 0, { noJSDoc: true }) as ts.ArrowFunction).body;
      return tfInfo.transformBlockWith(blockContent);
    }
  }
  private blockScopeStatement(block: ts.Block, pushedBlock?: PushedBlock) {
    const id = (block as any)._block_id ? (block as any)._block_id : (block as any)._original?._block_id;;
    let parentId = (block as any)._parent_block_id ? (block as any)._parent_block_id : (block as any)._original?._parent_block_id;
    const original = (block as any)._original ? (block as any)._original : block;
    const srcLocation = this.getPosition(original);
    const srcEndLocation = this.getPosition(original, true);
    let blockNumber: number = (block as any)._block_id_num;
    let blockNumberParent = (block as any)._parent_block_id_num;
    if (!blockNumber) {
      if (!pushedBlock) {
        const pushedBlockKeys = Object.keys(this.unclaimedBlocks);
        const pushedBlockKey = pushedBlockKeys[pushedBlockKeys.length - 1];
        pushedBlock = this.unclaimedBlocks[pushedBlockKey];
        delete this.unclaimedBlocks[pushedBlockKey];
      }
      blockNumber = pushedBlock.num;
      blockNumberParent = pushedBlock.parentNum;
    }
    if (this.unclaimedBlocks[blockNumber]) { delete this.unclaimedBlocks[blockNumber]; }
    const parentKind = (block as any)._node_parent?.kind;
    const returnPoint = !!(
      (original as any)._is_return_point ||
      this.isFunctionKind(parentKind)
    );
    const futureComputeCollectPoint = (original as any)._future_compute_collector || (block as any)._future_compute_collector;
    const futureComputeCollectPointId = (original as any)._future_compute_collector?.id || (block as any)._future_compute_collector?.id;
    let futureComputeCollections = [];
    if (futureComputeCollectPoint) {
      const lit = futureComputeCollectPoint.target.split('::');
      const kind = lit[0];
      const match = lit[1];
      futureComputeCollections = this.getFutureCollections(block, kind, match);
    }
    const isLoop = !!(
      parentKind === ts.SyntaxKind.ForOfStatement ||
      parentKind === ts.SyntaxKind.ForStatement ||
      parentKind === ts.SyntaxKind.ForInStatement ||
      parentKind === ts.SyntaxKind.WhileStatement ||
      parentKind === ts.SyntaxKind.DoStatement
    );
    const loopSourceBlock = !!(
      (original as any)._is_break_point ||
      (original as any)._is_continue_point || 
      isLoop
    );
    const r = {
      blockNumber,
      blockNumberParent,
      futureComputeCollectorStatement: !futureComputeCollectPointId ? null : ts.factory.createVariableStatement(
        [], ts.factory.createVariableDeclarationList([
          ts.factory.createVariableDeclaration(
            '__future_collector', undefined, undefined,
            ts.factory.createCallExpression(
              ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('__ctxg'), '__new_future_collector'),
              [],
              ts.factory.createNodeArray<ts.Expression>([
                ts.factory.createStringLiteral(futureComputeCollectPointId, true),
                futureComputeCollectPoint.collecOnce ? ts.factory.createTrue() : ts.factory.createFalse(),
                ts.factory.createIdentifier('__ctx'),
                ts.factory.createIdentifier('__blk'),
                ts.factory.createStringLiteral(futureComputeCollectPoint.target, true),
                ts.factory.createArrayLiteralExpression(futureComputeCollections.map(target => ts.factory.createStringLiteral(target, true))),
              ]),
            ))
          ], ts.NodeFlags.Const),
        ),
      returnRegisterStatement: ts.factory.createVariableStatement(
        [], ts.factory.createVariableDeclarationList([
          ts.factory.createVariableDeclaration(
            '$r', undefined, undefined, ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('__ctxg'), '__last_computed_v')
          )], ts.NodeFlags.Const),
        ),
      statement: ts.factory.createVariableStatement(
        [], ts.factory.createVariableDeclarationList([
          ts.factory.createVariableDeclaration(
            '__blk_' + blockNumber, undefined, undefined, ts.factory.createAwaitExpression(ts.factory.createCallExpression(
              ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('__ctxg'), '__new_blk'),
              [],
              ts.factory.createNodeArray<ts.Expression>([
                ts.factory.createStringLiteral(this.getFlowTrackingId(), true),
                ts.factory.createStringLiteral(srcLocation, true),
                returnPoint ? ts.factory.createTrue() : ts.factory.createFalse(),
                loopSourceBlock ? ts.factory.createTrue() : ts.factory.createFalse(),
                ts.factory.createIdentifier('__ctx'),
                // id ? ts.factory.createStringLiteral(id, true) : ts.factory.createNull(),
                // id ? ts.factory.createStringLiteral(blockNumber + '', true) : ts.factory.createNull(),
                // parentId ? ts.factory.createStringLiteral(parentId, true) : ts.factory.createNull(),
                parentId ? ts.factory.createIdentifier('__blk_' + blockNumberParent) : ts.factory.createNull(),
                ts.factory.createIdentifier('__blkr'),
                ts.factory.createIdentifier('$r'),
                ts.factory.createStringLiteral(this.restoreComments(original.getText()), true),
              ]),
            )),
          )
        ], ts.NodeFlags.Const),
      ),
      blockAssignStatment: ts.factory.createVariableStatement(
        [], ts.factory.createVariableDeclarationList([
          ts.factory.createVariableDeclaration(
            '__blk', undefined, undefined, ts.factory.createIdentifier('__blk_' + blockNumber)
          )], ts.NodeFlags.Const),
        ),
      endStatement: ts.factory.createExpressionStatement(
        ts.factory.createAwaitExpression(
          ts.factory.createCallExpression(
            ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('__ctxg'), '__end_blk'),
            [],
            ts.factory.createNodeArray<ts.Expression>([
              ts.factory.createStringLiteral(this.getFlowTrackingId(), true),
              ts.factory.createStringLiteral(srcEndLocation, true),
              ts.factory.createIdentifier('__blk_' + blockNumber),
            ]),
          )
        )
      ),
    };
    (r.returnRegisterStatement as any).__block_wrap_stmt = true;
    (r.statement as any).__block_wrap_stmt = true;
    (r.blockAssignStatment as any).__block_wrap_stmt = true;
    (r.endStatement as any).__block_wrap_stmt = true;
    if ((r.futureComputeCollectorStatement as any)) {
      (r.futureComputeCollectorStatement as any).__block_wrap_stmt = true;
    }
    return r;
  }
  private blockWithCommand(block: ts.Block, args: { scopeStartCommand?: string[]; scopeEndCommand?: string[] }): ts.Block {
    const scopeStartCommand: ts.ExpressionStatement[] = !args.scopeStartCommand ? [] : [ts.factory.createExpressionStatement(
      ts.factory.createCallExpression(
        ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('__ctxg'), '__marker_command',),
        [], ts.factory.createNodeArray<ts.Expression>([ ...args.scopeStartCommand.map(a => ts.factory.createStringLiteral(a, true)) ])
      )
    )];
    const scopeEndCommand: ts.ExpressionStatement[] = !args.scopeEndCommand ? [] : [ts.factory.createExpressionStatement(
      ts.factory.createCallExpression(
        ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('__ctxg'), '__marker_command',),
        [], ts.factory.createNodeArray<ts.Expression>([ ...args.scopeEndCommand.map(a => ts.factory.createStringLiteral(a, true)) ])
      )
    )];
    let statements: ts.Statement[] = block ? [
      ...scopeStartCommand,
      ...block.statements,
      ...scopeEndCommand,
    ] : [
      ...scopeStartCommand,
      ...scopeEndCommand,
    ];
    return ts.factory.createBlock(statements, true);
  }
  private findOriginalParent(node: ts.Node, level: number = 1): ts.Node {
    if (!node) { return null; }
    if (level <= 0) { return (node as any)._original ? (node as any)._original : node; }
    const parent = (node as any)._original ? (node as any)._original._node_parent : (node as any)._node_parent;
    return this.findOriginalParent(parent, level - 1);
  }
  private getCommentKey(text: string) {
    return text.split("'_c")[1].split("'")[0].split(',')[0];
  }
  private getCommentAnnotator(node: ts.Node, key: string, awaited: boolean) {
    const ce = ts.factory.createCallExpression(
      ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('__ctxg'), '__cmt'), [],
      [
        ts.factory.createStringLiteral(this.getFlowTrackingId(), true),
        ts.factory.createStringLiteral(this.ritz.sourceFileCommentsRegistry[key].position, true),
        ts.factory.createStringLiteral(key, true),
        ts.factory.createIdentifier('__ritz_cmts'),
        ts.factory.createIdentifier('__ctx'),
        ts.factory.createIdentifier('__blk'),
      ]
    );
    if (awaited) {
      return this.attachOriginal(node, ts.factory.createAwaitExpression(ce));
    }
    return this.attachOriginal(node, ce);
  }
  private typeAsync(type: ts.TypeNode) {
    if (!type) { return type; }
    const typeText = this.getTextFrom(type);
    if (!typeText.startsWith('Promise')) {
      return ts.factory.createTypeReferenceNode('Promise', [type]);
    }
    return type;
  }
  private restoreComments(text: string) {
    if (text.indexOf("'_c") === -1) { return text; }
    const reg = this.ritz.sourceFileCommentsRegistry;
    for (const key of Object.keys(reg)) {
      const commentObj = reg[key];
      const head = `'_c${commentObj.key}';`;
      if (text.indexOf(head) >= 0) {
        const tail = `/*${commentObj.key}*/;`;
        if (text.indexOf(tail) >= 0) {
          text = text.split(head)[0] + commentObj.content + text.split(tail)[1];  
        } else {
          text = text.split(head).join(commentObj.content);
        }
        continue;
      }
      const head2 = `'_c${commentObj.key},';`;
      if (text.indexOf(head2) >= 0) {
        let semicolonCount = 0;
        const lit = text.split(head2);
        const front = lit[0];
        const end = lit[1];
        for (let i = 0; i < end.length; ++i) {
          if (end[i] !== ';') { break; }
          ++semicolonCount;
        }
        text = front + end.slice(semicolonCount);
        continue;
      }
    }
    return text;
  }
  private transformNotApplicableBlock(node: ts.Node) {
    if (!node || node.kind !== ts.SyntaxKind.Block) { return false; }
    const block = node as ts.Block;
    const stmt = block.statements[0];
    if (!stmt) { return false; }
    const ch0 = this.ritz.getNodeChildAt(stmt, 0, { noJSDoc: true });
    if (ch0.kind === ts.SyntaxKind.AwaitExpression) {
      const ch1 = this.ritz.getNodeChildAt(stmt, 0, { noJSDoc: true });
      if (ch1.kind === ts.SyntaxKind.CallExpression) {
        const ch2 = this.ritz.getNodeChildAt(ch1, 0, { noJSDoc: true });
        if (ch2.kind === ts.SyntaxKind.PropertyAccessExpression) {
          const ch3at0 = this.ritz.getNodeChildAt(ch2, 0, { noJSDoc: true });
          const ch3at0Text = this.getTextFrom(ch3at0);
          if (ch3at0Text === '__ctxg') {
            const ch3at1 = this.ritz.getNodeChildAt(ch2, 2, { noJSDoc: true });
            const ch3at1Text = this.getTextFrom(ch3at1);
            if (ch3at1Text === '__continue' || ch3at1Text === '__break') {
              return true;
            }
          }
        }
      }
    }
    return false;
  }
  private getFutureCollections(node: ts.Node, kind: string, match: string, collector: string[] = [], debug = false, depth = 0) {
    if (debug) {
      console.log(`${'    '.repeat(depth)}${ts.SyntaxKind[node.kind]}`);
    }
    if (node.kind === ts.SyntaxKind.Block) {
      for(const stmt of (node as ts.Block).statements) {
        this.getFutureCollections(stmt, kind, match, collector, debug, depth+1);
      }
    } else {
      if (ts.SyntaxKind[node.kind] === kind) {
        if (node.kind === ts.SyntaxKind.PropertyAccessExpression) {
          const accessChain = this.getAccessChain(node);
          const accessChainText = this.getAccessChainText(accessChain);
          if (accessChainText === match) { collector.push(match); }
        }
      }
      node.forEachChild(ch => {
        this.getFutureCollections(ch, kind, match, collector, debug, depth+1);
      });
    }
    return collector;
  }
  private getCollateExpression(subject: ts.Expression, blockContext: ts.Block) {
    return ts.factory.createCallExpression(
      ts.factory.createPropertyAccessExpression(
        ts.factory.createIdentifier('__ctxg'),
        '__collate',
      ),
      [], [
        ts.factory.createStringLiteral(this.getFlowTrackingId(), true),
        ts.factory.createIdentifier('__ctx'),
        ts.factory.createIdentifier('__blk'),
        subject,
        this.arrowFunctionOfBody(blockContext)
      ]
    );
  }
  private getMemberContextStatement() {
    return ts.factory.createVariableStatement(
      [], ts.factory.createVariableDeclarationList([
        ts.factory.createVariableDeclaration(
          '__ctx', undefined, undefined, ts.factory.createConditionalExpression(
            ts.factory.createElementAccessExpression(ts.factory.createIdentifier('this'), ts.factory.createStringLiteral('__ctx', true)),
            ts.factory.createToken(ts.SyntaxKind.QuestionToken),
            ts.factory.createElementAccessExpression(ts.factory.createIdentifier('this'), ts.factory.createStringLiteral('__ctx', true)),
            ts.factory.createToken(ts.SyntaxKind.ColonToken),
            ts.factory.createIdentifier('__ctxr')
          )
        )
      ], ts.NodeFlags.Const))
  }
  private getReturnStatement(expr: ts.Expression, stmtPos = null) {
    return ts.factory.createReturnStatement(
      ts.factory.createAwaitExpression(ts.factory.createCallExpression(
        ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('__ctxg'), '__return'),
        [],
        ts.factory.createNodeArray<ts.Expression>([
          ts.factory.createStringLiteral(this.getFlowTrackingId(), true),
          stmtPos ? ts.factory.createStringLiteral(stmtPos, true) : ts.factory.createNull(),
          ts.factory.createIdentifier('__blk'),
          ...(expr ? [expr] : [])
        ])
      ))
    )
  }
  private getConditionalReturnStatement(expr: ts.Expression, stmtPos = null) {
    return ts.factory.createIfStatement(ts.factory.createCallExpression(
      ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('__ctxg'), '__bad'),
      [], ts.factory.createNodeArray<ts.Expression>([
        ts.factory.createStringLiteral(this.getFlowTrackingId(), true),
        ts.factory.createIdentifier('__ctx'),
        ts.factory.createIdentifier('__blk'),
        expr
      ])),
      ts.factory.createReturnStatement(
        ts.factory.createAwaitExpression(ts.factory.createCallExpression(
          ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('__ctxg'), '__return'),
          [],
          ts.factory.createNodeArray<ts.Expression>([
            ts.factory.createStringLiteral(this.getFlowTrackingId(), true),
            stmtPos ? ts.factory.createStringLiteral(stmtPos, true) : ts.factory.createNull(),
            ts.factory.createIdentifier('__blk'),
          ])
        ))
    ));
  }
  private getConditionalThrowStatement(expr: ts.Expression, stmtPos = null) {
    return ts.factory.createIfStatement(ts.factory.createCallExpression(
      ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('__ctxg'), '__bad'),
      [], ts.factory.createNodeArray<ts.Expression>([
        ts.factory.createStringLiteral(this.getFlowTrackingId(), true),
        ts.factory.createIdentifier('__ctx'),
        ts.factory.createIdentifier('__blk'),
        expr
      ])),
      ts.factory.createThrowStatement(
        ts.factory.createAwaitExpression(ts.factory.createCallExpression(
          ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('__ctxg'), '__return'),
          [],
          ts.factory.createNodeArray<ts.Expression>([
            ts.factory.createStringLiteral(this.getFlowTrackingId(), true),
            ts.factory.createIdentifier('__ctx'),
            ts.factory.createIdentifier('__blk'),
          ])
        ))
    ));
  }
  private specialCallExpressionInfo(node: ts.Node): { word: string; args: ts.NodeArray<ts.Expression>, expr: ts.Expression } {
    if (node.kind === ts.SyntaxKind.CallExpression) {
      const ce = node as ts.CallExpression;
      if (ce.expression.kind === ts.SyntaxKind.PropertyAccessExpression) {
        const text = (ce.expression as ts.PropertyAccessExpression).name.text;
        const rootExpr = this.ritz.getNodeChildAt(ce.expression, 0, { noJSDoc: true });
        if (this.ritz.config.extraPostfixMethods.indexOf(text) >= 0) {
          return { word: text, args: ce.arguments, expr: rootExpr as ts.Expression};
        }
      }
    }
    return null;
  }
  private findSpecialCallExpressions(node: ts.Node, collated: { word: string; args: ts.NodeArray<ts.Expression>, expr: ts.Expression, depth: number }[] = [], depth = 0) {
    if (!collated) { collated = []; }
    let found = null;
    const specialInfo = this.specialCallExpressionInfo(node);
    if (specialInfo) {
      (node as any)._special_ce = true;
      found = { ...specialInfo, depth };
    }
    node.forEachChild(ch => {
      if(this.isFunctionType(ch)) { return; }
      this.findSpecialCallExpressions(ch, collated, depth + 1);
    });
    if (found) { collated.push(found); }
    return collated;
  }
  private getAccessChain(node: ts.Node, collated: ts.Expression[] = []): ts.Expression[] {
    if (!collated) { collated = []; }
    if (node.kind === ts.SyntaxKind.ParenthesizedExpression) {
      const pe = node as ts.ParenthesizedExpression;
      this.getAccessChain(pe.expression, collated);
    } else if (node.kind === ts.SyntaxKind.PropertyAccessExpression) {
      const pa = node as ts.PropertyAccessExpression;
      const firstChild = this.ritz.getNodeChildAt(node, 0, { noJSDoc: true });
      let secondChild = this.ritz.getNodeChildAt(node, 2, { noJSDoc: true });
      if (!secondChild) { secondChild = this.ritz.getNodeChildAt(node, 1, { noJSDoc: true }); }
      if (pa.questionDotToken) {
        (secondChild as any)._has_question_mark = true;
      }
      const chain = this.getAccessChain(firstChild, collated);
      collated.push(secondChild as ts.Expression);
      return chain;
    } else {
      collated.push(node as ts.Expression);
    }    
    return collated;
  }
  private getAccessChainText(nodes: ts.Expression[]): string {
    return nodes.map(a => this.getTextFrom(a)).join('.');
  }
  private wrapAccess(node: ts.Node, callBase: ts.Node, accessChainRest: ts.Expression[], awaited = false) {
    const ce = ts.factory.createCallExpression(
      ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('__ctxg'), '__dot'), [],
      [
        ts.factory.createIdentifier('__blk'),
        callBase as ts.Expression,
        ts.factory.createArrayLiteralExpression(accessChainRest),
      ]
    );
    const ret = awaited ? ts.factory.createAwaitExpression(ce) : ce;
    (ret as any)._prop_access_expr = true;
    return this.attachOriginal(node, ret);
  }
  private wrapNonTarget(fromPropertyAccessExpr: boolean, questionDotToken: boolean, node: ts.Node, callBaseExpr: ts.Expression, args: ts.NodeArray<ts.Expression>, awaited = false) {
    const ce = ts.factory.createCallExpression(
      ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('__ctxg'), '__call'), [],
      [
        ts.factory.createIdentifier('__blk'),
        fromPropertyAccessExpr ? ts.factory.createTrue() : ts.factory.createFalse(),
        questionDotToken ? ts.factory.createTrue() : ts.factory.createFalse(),
        awaited ? ts.factory.createTrue() : ts.factory.createFalse(),
        callBaseExpr,
        ts.factory.createArrayLiteralExpression(args),
      ]
    );
    if (awaited) {
      return this.attachOriginal(node, ts.factory.createAwaitExpression(ce));
    }
    return this.attachOriginal(node, ce);
  }
  private getFunctionContextStatement(withThis: boolean, fnName: string, block: ts.Block, withContext = false) {
    return this.attachOriginal(block, ts.factory.createBlock([
      ...(withContext ? [ts.factory.createVariableStatement(
        [], ts.factory.createVariableDeclarationList([
          ts.factory.createVariableDeclaration(
            '__ctx', undefined, undefined, ts.factory.createCallExpression(
              ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('__ctxg'), '__get_ctx'),
              [],
              ts.factory.createNodeArray<ts.Expression>([
                ts.factory.createIdentifier('arguments'),
                ts.factory.createIdentifier('__ctxr'),
              ]),
            ),
          )
        ], ts.NodeFlags.Const),
      )] : []),
      ts.factory.createVariableStatement(
        [], ts.factory.createVariableDeclarationList([
          ts.factory.createVariableDeclaration(
            '__fn', undefined, undefined, ts.factory.createCallExpression(
              ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('__ctxg'), '__fn_ctx'),
              [],
              ts.factory.createNodeArray<ts.Expression>([
                ts.factory.createStringLiteral(this.getFlowTrackingId(), true),
                ts.factory.createIdentifier('__filename'),
                ts.factory.createIdentifier('__ctx'),
                ts.factory.createStringLiteral(fnName, true),
                ...(withThis ? [ts.factory.createThis()] : []),
              ]),
            ),
          )
        ], ts.NodeFlags.Const),
      ),
      ts.factory.createIfStatement(
        ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('__fn'), 'doSkip'),
        ts.factory.createReturnStatement(ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('__fn'), 'doSkipReturn')),
      ),
      ...(block.statements ? block.statements : []),
    ], true));
  }
  private getStringExpressionWithoutComments(expression: string) {
    const printer: ts.Printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed, removeComments: true });
    const sourceFile: ts.SourceFile = ts.createSourceFile('_temp', expression, ts.ScriptTarget.ES2015, true, ts.ScriptKind.TS);
    const result = ts.transform(sourceFile, []);
    return printer.printNode(ts.EmitHint.SourceFile, result.transformed[0], sourceFile);
  }
  private isFunctionType(node: ts.Node) {
    if (!node) { return false; }
    return (
      node.kind === ts.SyntaxKind.ArrowFunction ||
      node.kind === ts.SyntaxKind.FunctionDeclaration ||
      node.kind === ts.SyntaxKind.FunctionExpression ||
      node.kind === ts.SyntaxKind.MethodDeclaration
    );
  }
  private isFunctionKind(kind: ts.SyntaxKind) {
    return (
      kind === ts.SyntaxKind.ArrowFunction ||
      kind === ts.SyntaxKind.FunctionDeclaration ||
      kind === ts.SyntaxKind.FunctionExpression ||
      kind === ts.SyntaxKind.MethodDeclaration
    );
  }
  private collectTemplateExpressions(node: ts.Node, collector: { kind: ts.SyntaxKind, node: ts.Expression}[] = []) {
    if (!node) { return null; }
    if (node.kind === ts.SyntaxKind.TaggedTemplateExpression) {
      const tte = node as ts.TaggedTemplateExpression;
      (collector as any)._last_tagged_template_tag = tte.tag;
      if (tte.tag.kind === ts.SyntaxKind.TaggedTemplateExpression) {
        this.collectTemplateExpressions(tte.tag, collector);
      }
      collector.push({
        kind: tte.template.kind,
        node: tte.template as ts.Expression,
      });
    }
    return collector;
  }
  private syncOp(op: string) {
    switch(op) {
      case '+':
      case '-':
      case '*':
      case '/':
      case '%':
      case '**':
      case '&&':
      case '||':
      case '??':
      case '&':
      case '|':
      case '^':
      case '<<':
      case '>>':
      case '>>>':
        return true;
    }
    return false;
  }
}
