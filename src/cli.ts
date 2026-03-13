#!/usr/bin/env node
import { parseArgs } from "./args.js";
import { discoverLangFiles, validateLangFiles, allLangKeys } from "./langFiles.js";
import { walkFiles } from "./sourceFiles.js";
import { runAnalysis } from "./analyzer/index.js";
import { printReport } from "./reporter.js";

async function main(): Promise<void> {
  const { source, lang, func } = parseArgs(process.argv);

  // Load language files
  let langFiles;
  try {
    langFiles = await discoverLangFiles(lang);
  } catch (err) {
    console.error(`Error reading lang directory "${lang}": ${String(err)}`);
    process.exit(1);
  }

  if (langFiles.length === 0) {
    console.error(`No .json language files found in "${lang}"`);
    process.exit(1);
  }

  const { issues } = await runAnalysis({
    sourceDir: source,
    langFiles,
    funcSpec: func,
    walkFiles,
    validateLangFiles,
    allLangKeys,
  });

  const hasIssues = printReport(issues);
  process.exit(hasIssues ? 1 : 0);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
