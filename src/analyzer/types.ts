export interface FuncSpec {
  /** The import path to match literally, e.g. "@/plugins/i18n" */
  packagePath: string;
  /** The composable function name, e.g. "useI18n" */
  composableName: string;
  /** The translation function name on the composable result, e.g. "t" */
  fnName: string;
}

export interface KeyUsage {
  /** The translation key string, e.g. "feature.component.name" */
  key: string;
  /** Absolute path of the source file */
  file: string;
  /** 1-based line number */
  line: number;
  /** 1-based column number */
  col: number;
}

export type IssueType =
  | "missing-key"
  | "unused-key"
  | "illegal-key"
  | "lang-mismatch";

export interface Issue {
  type: IssueType;
  message: string;
  /** Absolute path of the source file (optional for lang-level issues) */
  file?: string;
  /** 1-based line number */
  line?: number;
  /** 1-based column number */
  col?: number;
}

export interface AnalysisResult {
  usages: KeyUsage[];
  issues: Issue[];
}
