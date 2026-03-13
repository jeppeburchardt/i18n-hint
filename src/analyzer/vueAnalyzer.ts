import { parse as parseSfc } from "@vue/compiler-sfc";
import { parse as parseTemplate } from "@vue/compiler-dom";
import type { TemplateChildNode, RootNode } from "@vue/compiler-dom";
import { analyzeTsCode, extractAliases, analyzeTsCodeWithAliases } from "./tsAnalyzer.js";
import type { KnownAliases } from "./tsAnalyzer.js";
import type { FuncSpec, KeyUsage, Issue, AnalysisResult } from "./types.js";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Analyse a Vue Single File Component for i18n key usages.
 */
export function analyzeVue(
  code: string,
  filePath: string,
  funcSpec: FuncSpec
): AnalysisResult {
  const { descriptor, errors } = parseSfc(code, { filename: filePath });

  if (errors.length > 0) {
    // Non-fatal: report parse errors but continue with whatever was parsed
  }

  const usages: KeyUsage[] = [];
  const issues: Issue[] = [];

  // --- Script / Script Setup ---
  const scriptBlock = descriptor.scriptSetup ?? descriptor.script;
  let knownAliases: KnownAliases = { directFnAliases: new Set(), objectBindings: new Set() };

  if (scriptBlock) {
    const scriptCode = scriptBlock.content;
    // loc.start.line is 1-based line of the opening tag in the SFC;
    // the content starts on the NEXT line after the tag, so line offset is
    // scriptBlock.loc.start.line (the tag's line)
    const lineOffset = scriptBlock.loc.start.line;
    const result = analyzeTsCode(scriptCode, filePath, funcSpec, lineOffset, 0);
    usages.push(...result.usages);
    issues.push(...result.issues);

    // Extract the aliases so the template can use the same fn names
    knownAliases = extractAliases(scriptCode, funcSpec);
  }

  // --- Template ---
  if (descriptor.template) {
    const templateBlock = descriptor.template;
    const templateContent = templateBlock.content;
    const templateLineOffset = templateBlock.loc.start.line;

    const templateResult = analyzeTemplateBlock(
      templateContent,
      filePath,
      funcSpec,
      templateLineOffset,
      knownAliases
    );
    usages.push(...templateResult.usages);
    issues.push(...templateResult.issues);
  }

  return { usages, issues };
}

// ---------------------------------------------------------------------------
// Template analysis
// ---------------------------------------------------------------------------

function analyzeTemplateBlock(
  templateContent: string,
  filePath: string,
  funcSpec: FuncSpec,
  templateLineOffset: number,
  knownAliases: KnownAliases
): AnalysisResult {
  const usages: KeyUsage[] = [];
  const issues: Issue[] = [];

  let templateAst: RootNode;
  try {
    templateAst = parseTemplate(templateContent, {
      parseMode: "base",
    });
  } catch {
    return { usages, issues };
  }

  // Collect all expression strings with their positions from the template AST
  const expressions = collectTemplateExpressions(templateAst, templateContent);

  for (const expr of expressions) {
    // Re-parse each expression as TypeScript to find translation calls.
    // Wrap in parentheses to ensure the expression parses as an expression statement.
    const wrappedCode = `(${expr.source})`;
    const result = analyzeTsCodeWithAliases(
      wrappedCode,
      filePath,
      knownAliases,
      funcSpec,
      // Line offset: the expression's line within the template + the template's
      // offset in the SFC file, minus 1 because the wrapping doesn't add a line.
      expr.line - 1 + templateLineOffset,
      // Col offset: the expression starts at expr.col characters into the line.
      // The wrap adds 1 char '(' so we subtract that.
      expr.col
    );
    usages.push(...result.usages);
    issues.push(...result.issues);
  }

  return { usages, issues };
}

// ---------------------------------------------------------------------------
// Template expression collection
// ---------------------------------------------------------------------------

interface TemplateExpression {
  source: string;
  /** 1-based line within the template content */
  line: number;
  /** 0-based column within the line */
  col: number;
}

function collectTemplateExpressions(
  node: RootNode | TemplateChildNode,
  templateContent: string
): TemplateExpression[] {
  const results: TemplateExpression[] = [];
  walkTemplateNode(node, templateContent, results);
  return results;
}

type AnyTemplateNode = RootNode | TemplateChildNode | { type: number; [key: string]: unknown };

function walkTemplateNode(
  node: AnyTemplateNode,
  templateContent: string,
  out: TemplateExpression[]
): void {
  // @vue/compiler-dom node types as numeric constants:
  // NodeTypes.INTERPOLATION = 5
  // NodeTypes.COMPOUND_EXPRESSION = 8
  // NodeTypes.SIMPLE_EXPRESSION = 4
  // NodeTypes.ELEMENT = 1
  // NodeTypes.ROOT = 0

  const nodeType = (node as { type: number }).type;

  if (nodeType === 5) {
    // Interpolation node: {{ expr }}
    // content is a SimpleExpression
    const interp = node as { type: 5; content: { type: number; content: string; loc: { start: { line: number; column: number } } } };
    if (interp.content && typeof interp.content.content === "string") {
      out.push({
        source: interp.content.content,
        line: interp.content.loc.start.line,
        col: interp.content.loc.start.column,
      });
    }
  } else if (nodeType === 4) {
    // SimpleExpression — may appear on directives
    const expr = node as { type: 4; content: string; isStatic: boolean; loc: { start: { line: number; column: number } } };
    if (!expr.isStatic && expr.content) {
      out.push({
        source: expr.content,
        line: expr.loc.start.line,
        col: expr.loc.start.column,
      });
    }
  }

  // Recurse into children
  const children = (node as Record<string, unknown>).children;
  if (Array.isArray(children)) {
    for (const child of children) {
      if (child && typeof child === "object") {
        walkTemplateNode(child as AnyTemplateNode, templateContent, out);
      }
    }
  }

  // Recurse into props (directives)
  const props = (node as Record<string, unknown>).props;
  if (Array.isArray(props)) {
    for (const prop of props) {
      if (prop && typeof prop === "object") {
        const p = prop as Record<string, unknown>;
        // Directive node type = 7
        if (p.type === 7 && p.exp && typeof p.exp === "object") {
          walkTemplateNode(p.exp as AnyTemplateNode, templateContent, out);
        }
      }
    }
  }
}
