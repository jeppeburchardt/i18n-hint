import { Command } from "commander";
import type { FuncSpec } from "./analyzer/types.js";

export interface CliArgs {
  source: string;
  lang: string;
  func: FuncSpec;
}

export function parseArgs(argv: string[]): CliArgs {
  const program = new Command();

  program
    .name("i18n-hint")
    .description(
      "Audit i18n key usage in Vue/TypeScript projects"
    )
    .requiredOption("--source <path>", "Path to source files folder")
    .requiredOption("--lang <path>", "Path to language files folder")
    .requiredOption(
      "--func <spec>",
      'i18n function spec in format "package:composable:fn" e.g. "@/plugins/i18n:useI18n:t"'
    )
    .parse(argv);

  const opts = program.opts<{ source: string; lang: string; func: string }>();

  const parts = opts.func.split(":");
  if (parts.length !== 3) {
    console.error(
      `Error: --func must be in format "package:composable:fn", got: ${opts.func}`
    );
    process.exit(1);
  }

  const [packagePath, composableName, fnName] = parts;

  if (!packagePath || !composableName || !fnName) {
    console.error(
      `Error: all three parts of --func must be non-empty, got: ${opts.func}`
    );
    process.exit(1);
  }

  return {
    source: opts.source,
    lang: opts.lang,
    func: { packagePath, composableName, fnName },
  };
}
