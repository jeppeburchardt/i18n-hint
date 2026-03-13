import type { Issue } from "./analyzer/types.js";

/**
 * Format a single issue as an ESLint-style string.
 * e.g. "/path/to/file.ts:12:5: error [missing-key] Key "foo.bar" is not defined..."
 */
export function formatIssue(issue: Issue): string {
  const location =
    issue.file != null
      ? `${issue.file}:${issue.line ?? 0}:${issue.col ?? 0}`
      : "<lang>";
  return `${location}: error [${issue.type}] ${issue.message}`;
}

/**
 * Print all issues to stdout and return whether any were found.
 */
export function printReport(issues: Issue[]): boolean {
  if (issues.length === 0) {
    console.log("No i18n issues found.");
    return false;
  }

  // Sort: file issues first (by file, then line, then col), lang issues last
  const sorted = [...issues].sort((a, b) => {
    if (a.file && b.file) {
      if (a.file !== b.file) return a.file.localeCompare(b.file);
      if ((a.line ?? 0) !== (b.line ?? 0)) return (a.line ?? 0) - (b.line ?? 0);
      return (a.col ?? 0) - (b.col ?? 0);
    }
    if (a.file) return -1;
    if (b.file) return 1;
    return 0;
  });

  for (const issue of sorted) {
    console.log(formatIssue(issue));
  }

  console.log(`\n${issues.length} issue${issues.length === 1 ? "" : "s"} found.`);
  return true;
}
