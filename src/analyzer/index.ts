import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import type { FuncSpec, KeyUsage, Issue } from "./types.js";
import { analyzeTsCode } from "./tsAnalyzer.js";
import { analyzeVue } from "./vueAnalyzer.js";

export { analyzeTsCode, analyzeVue };

export interface RunAnalysisOptions {
  sourceDir: string;
  langFiles: import("../langFiles.js").LangFile[];
  funcSpec: FuncSpec;
  walkFiles: (dir: string) => AsyncGenerator<string>;
  validateLangFiles: (
    files: import("../langFiles.js").LangFile[]
  ) => Issue[];
  allLangKeys: (files: import("../langFiles.js").LangFile[]) => Set<string>;
}

export interface RunAnalysisResult {
  issues: Issue[];
}

export async function runAnalysis(
  opts: RunAnalysisOptions
): Promise<RunAnalysisResult> {
  const {
    sourceDir,
    langFiles,
    funcSpec,
    walkFiles,
    validateLangFiles,
    allLangKeys,
  } = opts;

  const allUsages: KeyUsage[] = [];
  const allIssues: Issue[] = [];

  // Lang file cross-validation
  allIssues.push(...validateLangFiles(langFiles));

  // Walk and analyse every source file
  for await (const filePath of walkFiles(sourceDir)) {
    const code = await readFile(filePath, "utf-8");
    const ext = extname(filePath).toLowerCase();

    let result: { usages: KeyUsage[]; issues: Issue[] };

    if (ext === ".vue") {
      result = analyzeVue(code, filePath, funcSpec);
    } else {
      result = analyzeTsCode(code, filePath, funcSpec);
    }

    allUsages.push(...result.usages);
    allIssues.push(...result.issues);
  }

  // Build a set of all used keys for quick lookup
  const usedKeys = new Set(allUsages.map((u) => u.key));

  // Keys referenced in source but missing from one or more lang files
  for (const usage of allUsages) {
    for (const lf of langFiles) {
      if (!lf.keys.has(usage.key)) {
        allIssues.push({
          type: "missing-key",
          message: `Key "${usage.key}" is not defined in language file "${lf.isoCode}"`,
          file: usage.file,
          line: usage.line,
          col: usage.col,
        });
      }
    }
  }

  // Keys present in lang files but never referenced in source
  const unusedCandidates = allLangKeys(langFiles);
  for (const key of unusedCandidates) {
    if (!usedKeys.has(key)) {
      // Find which lang file(s) declare this key for a useful message
      const declaringFiles = langFiles
        .filter((lf) => lf.keys.has(key))
        .map((lf) => lf.isoCode)
        .join(", ");
      allIssues.push({
        type: "unused-key",
        message: `Key "${key}" is defined in [${declaringFiles}] but never used in source files`,
      });
    }
  }

  return { issues: allIssues };
}
