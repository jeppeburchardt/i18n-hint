import { parse } from "@typescript-eslint/typescript-estree";
import type { TSESTree } from "@typescript-eslint/typescript-estree";
import type { FuncSpec, KeyUsage, Issue, AnalysisResult } from "./types.js";

// ---------------------------------------------------------------------------
// Internal state for a single file analysis
// ---------------------------------------------------------------------------

interface FileScope {
  /** Local names bound to the composable function; e.g. "useMyI18n" */
  composableAliases: Set<string>;
  /** Local names that are the direct translation fn; e.g. "translate" */
  directFnAliases: Set<string>;
  /** Local names that hold the composable result object; e.g. "translater" */
  objectBindings: Set<string>;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface KnownAliases {
  directFnAliases: Set<string>;
  objectBindings: Set<string>;
}

/**
 * Extract the translation fn aliases from a script block without analysing
 * call sites. Used by the Vue analyzer to pass scope into template expression
 * analysis.
 */
export function extractAliases(
  code: string,
  funcSpec: FuncSpec
): KnownAliases {
  let ast: TSESTree.Program;
  try {
    ast = parse(code, { jsx: false, loc: true, range: true, tolerant: true });
  } catch {
    return { directFnAliases: new Set(), objectBindings: new Set() };
  }

  const scope: FileScope = {
    composableAliases: new Set(),
    directFnAliases: new Set(),
    objectBindings: new Set(),
  };
  collectImportAliases(ast, funcSpec, scope);
  collectBindingAliases(ast, scope, funcSpec);
  return { directFnAliases: scope.directFnAliases, objectBindings: scope.objectBindings };
}

/**
 * Analyse a snippet of code for i18n calls using pre-seeded aliases
 * (no import/binding scanning). Used for template expression fragments.
 */
export function analyzeTsCodeWithAliases(
  code: string,
  filePath: string,
  known: KnownAliases,
  funcSpec: FuncSpec,
  lineOffset = 0,
  colOffset = 0
): AnalysisResult {
  let ast: TSESTree.Program;
  try {
    ast = parse(code, { jsx: false, loc: true, range: true, tolerant: true });
  } catch {
    return { usages: [], issues: [] };
  }

  const scope: FileScope = {
    composableAliases: new Set(),
    directFnAliases: new Set(known.directFnAliases),
    objectBindings: new Set(known.objectBindings),
  };

  const usages: KeyUsage[] = [];
  const issues: Issue[] = [];
  collectCalls(ast, scope, funcSpec, filePath, usages, issues, lineOffset, colOffset);
  return { usages, issues };
}

/**
 * Analyse a TypeScript/JavaScript source string for i18n key usages.
 *
 * @param code       The source code text
 * @param filePath   Absolute file path (used in Issue/KeyUsage output)
 * @param funcSpec   The i18n composable spec from CLI args
 * @param lineOffset Lines to add to every reported line (for embedded blocks)
 * @param colOffset  Columns to add on line 1 only (for embedded blocks)
 */
export function analyzeTsCode(
  code: string,
  filePath: string,
  funcSpec: FuncSpec,
  lineOffset = 0,
  colOffset = 0
): AnalysisResult {
  let ast: TSESTree.Program;

  try {
    ast = parse(code, {
      jsx: false,
      loc: true,
      range: true,
      tolerant: true,
    });
  } catch {
    return { usages: [], issues: [] };
  }

  const scope: FileScope = {
    composableAliases: new Set(),
    directFnAliases: new Set(),
    objectBindings: new Set(),
  };

  const usages: KeyUsage[] = [];
  const issues: Issue[] = [];

  collectImportAliases(ast, funcSpec, scope);
  collectBindingAliases(ast, scope, funcSpec);
  collectCalls(ast, scope, funcSpec, filePath, usages, issues, lineOffset, colOffset);

  return { usages, issues };
}

// ---------------------------------------------------------------------------
// Pass 1 — Import declarations
// ---------------------------------------------------------------------------

function collectImportAliases(
  ast: TSESTree.Program,
  funcSpec: FuncSpec,
  scope: FileScope
): void {
  for (const node of ast.body) {
    if (node.type !== "ImportDeclaration") continue;

    const importDecl = node as TSESTree.ImportDeclaration;
    if (importDecl.source.value !== funcSpec.packagePath) continue;

    for (const specifier of importDecl.specifiers) {
      if (specifier.type !== "ImportSpecifier") continue;

      const s = specifier as TSESTree.ImportSpecifier;
      const importedName =
        s.imported.type === "Identifier"
          ? (s.imported as TSESTree.Identifier).name
          : "";

      if (importedName === funcSpec.composableName) {
        scope.composableAliases.add(s.local.name);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Pass 2 — Variable binding aliases
// ---------------------------------------------------------------------------

function collectBindingAliases(
  ast: TSESTree.Program,
  scope: FileScope,
  funcSpec: FuncSpec
): void {
  visitNode(ast, (node) => {
    if (node.type !== "VariableDeclarator") return;

    const decl = node as TSESTree.VariableDeclarator;
    if (!decl.init || !isComposableCall(decl.init, scope)) return;

    if (decl.id.type === "ObjectPattern") {
      // const { t } = useI18n()   or   const { t: translate } = useMyI18n()
      for (const prop of (decl.id as TSESTree.ObjectPattern).properties) {
        if (prop.type !== "Property") continue;
        const p = prop as TSESTree.Property;
        if (p.computed) continue;

        const keyName =
          p.key.type === "Identifier"
            ? (p.key as TSESTree.Identifier).name
            : null;

        if (keyName !== funcSpec.fnName) continue;

        if (p.value.type === "Identifier") {
          scope.directFnAliases.add((p.value as TSESTree.Identifier).name);
        }
      }
    } else if (decl.id.type === "Identifier") {
      // const translater = useMyI18n()
      scope.objectBindings.add((decl.id as TSESTree.Identifier).name);
    }
  });
}

// ---------------------------------------------------------------------------
// Pass 3 — Call expression analysis
// ---------------------------------------------------------------------------

function collectCalls(
  ast: TSESTree.Program,
  scope: FileScope,
  funcSpec: FuncSpec,
  filePath: string,
  usages: KeyUsage[],
  issues: Issue[],
  lineOffset: number,
  colOffset: number
): void {
  visitNode(ast, (node) => {
    if (node.type !== "CallExpression") return;

    const call = node as TSESTree.CallExpression;
    if (!isTranslationCall(call, scope, funcSpec)) return;
    if (call.arguments.length === 0) return;

    const firstArg = call.arguments[0];
    const loc = call.loc!;
    const rawLine = loc.start.line;
    const rawCol = loc.start.column;

    // Lines are 1-based; columns are 0-based in AST → output as 1-based
    const line = rawLine + lineOffset;
    const col = rawLine === 1 ? rawCol + colOffset + 1 : rawCol + 1;

    if (firstArg.type === "Literal") {
      const lit = firstArg as TSESTree.Literal;
      if (typeof lit.value === "string") {
        usages.push({ key: lit.value, file: filePath, line, col });
        return;
      }
    }

    // Non-string argument → illegal key
    issues.push({
      type: "illegal-key",
      message: `i18n function called with non-string argument: ${describeIllegal(firstArg)}`,
      file: filePath,
      line,
      col,
    });
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isComposableCall(node: TSESTree.Node, scope: FileScope): boolean {
  if (node.type !== "CallExpression") return false;
  const call = node as TSESTree.CallExpression;
  return (
    call.callee.type === "Identifier" &&
    scope.composableAliases.has((call.callee as TSESTree.Identifier).name)
  );
}

function isTranslationCall(
  call: TSESTree.CallExpression,
  scope: FileScope,
  funcSpec: FuncSpec
): boolean {
  const callee = call.callee;

  // Direct call: t('key') or translate('key')
  if (callee.type === "Identifier") {
    return scope.directFnAliases.has((callee as TSESTree.Identifier).name);
  }

  // Member call: translater.t('key')
  if (callee.type === "MemberExpression") {
    const member = callee as TSESTree.MemberExpression;
    if (member.computed) return false;
    if (member.object.type !== "Identifier") return false;
    if (member.property.type !== "Identifier") return false;

    return (
      scope.objectBindings.has((member.object as TSESTree.Identifier).name) &&
      (member.property as TSESTree.Identifier).name === funcSpec.fnName
    );
  }

  return false;
}

function describeIllegal(node: TSESTree.Node): string {
  switch (node.type) {
    case "TemplateLiteral":
      return "template literal";
    case "Identifier":
      return `variable reference "${(node as TSESTree.Identifier).name}"`;
    case "BinaryExpression":
      return "string concatenation";
    case "CallExpression":
      return "function call";
    default:
      return node.type;
  }
}

/**
 * Simple depth-first visitor — calls `fn` on every node in the AST.
 */
export function visitNode(
  node: TSESTree.Node,
  fn: (n: TSESTree.Node) => void
): void {
  fn(node);

  for (const key of Object.keys(node)) {
    const child = (node as unknown as Record<string, unknown>)[key];
    if (!child || typeof child !== "object") continue;

    if (Array.isArray(child)) {
      for (const item of child) {
        if (
          item &&
          typeof item === "object" &&
          typeof (item as Record<string, unknown>).type === "string"
        ) {
          visitNode(item as TSESTree.Node, fn);
        }
      }
    } else if (
      typeof (child as Record<string, unknown>).type === "string"
    ) {
      visitNode(child as TSESTree.Node, fn);
    }
  }
}
